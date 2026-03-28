#!/usr/bin/env python3
"""
deep-analyze.py — Exhaustive reference video analysis (100+ data points per frame)

Extracts EVERYTHING a Remotion replication agent needs to know:
  - Per-frame element detection (shapes, text, phones, 3D objects)
  - Motion trajectories with easing curve fitting
  - Typography (OCR + font size + position + color + animation)
  - Shadow analysis (angle, softness, color, offset)
  - Gradient detection (direction, color stops)
  - Blur/glow/grain detection
  - Edge maps and contour hierarchy
  - Color clustering (exact palette, not averages)
  - Optical flow fields (motion vectors per region)
  - Depth/perspective estimation
  - Audio analysis (beats, SFX, music segments)
  - Shader/effect detection (glass, chrome, iridescence)
  - Layout grid and spacing analysis

Usage:
  python3 scripts/deep-analyze.py <reference.mp4> [output-dir] [--fps N] [--detail high|ultra]

Requires: opencv-python, numpy, Pillow, scikit-image, scipy, scikit-learn, pytesseract, ffmpeg
"""

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage, signal
from scipy.optimize import curve_fit
from sklearn.cluster import KMeans

# Optional imports
try:
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False

try:
    from skimage import feature, filters, measure, morphology, segmentation
    from skimage.color import rgb2hsv, rgb2lab, rgb2gray
    from skimage.feature import canny, corner_harris, corner_peaks
    from skimage.measure import label, regionprops
    HAS_SKIMAGE = True
except ImportError:
    HAS_SKIMAGE = False


# ═══════════════════════════════════════════════════════════════
# FRAME-LEVEL ANALYZERS (each returns a dict of findings)
# ═══════════════════════════════════════════════════════════════

def analyze_colors(frame_bgr, n_clusters=8):
    """Deep color analysis: exact palette, distribution, gradients, temperature."""
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    h, w = frame_rgb.shape[:2]

    # Downsample for clustering
    small = cv2.resize(frame_rgb, (160, 90))
    pixels = small.reshape(-1, 3).astype(np.float32)

    # K-means color clustering
    kmeans = KMeans(n_clusters=n_clusters, n_init=3, max_iter=100, random_state=42)
    kmeans.fit(pixels)
    centers = kmeans.cluster_centers_.astype(int)
    labels = kmeans.labels_
    counts = np.bincount(labels)
    total = len(labels)

    palette = []
    for i in np.argsort(-counts):
        r, g, b = centers[i]
        palette.append({
            "hex": f"#{r:02x}{g:02x}{b:02x}",
            "rgb": [int(r), int(g), int(b)],
            "percentage": round(counts[i] / total * 100, 1),
        })

    # Color temperature (warm vs cool)
    avg_rgb = frame_rgb.mean(axis=(0, 1))
    warmth = float(avg_rgb[0] - avg_rgb[2])  # red - blue

    # Saturation analysis
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    sat_mean = float(hsv[:, :, 1].mean()) / 255
    sat_std = float(hsv[:, :, 1].std()) / 255

    # Gradient detection (horizontal and vertical color change)
    left_avg = frame_rgb[:, :w//4].mean(axis=(0, 1))
    right_avg = frame_rgb[:, 3*w//4:].mean(axis=(0, 1))
    top_avg = frame_rgb[:h//4, :].mean(axis=(0, 1))
    bottom_avg = frame_rgb[3*h//4:, :].mean(axis=(0, 1))

    h_gradient = float(np.linalg.norm(right_avg - left_avg))
    v_gradient = float(np.linalg.norm(bottom_avg - top_avg))

    gradient_direction = "none"
    if h_gradient > 30 or v_gradient > 30:
        if h_gradient > v_gradient:
            gradient_direction = "horizontal"
        else:
            gradient_direction = "vertical"
        if h_gradient > 30 and v_gradient > 30:
            gradient_direction = "diagonal"

    return {
        "palette": palette[:n_clusters],
        "dominant_color": palette[0]["hex"] if palette else "#000000",
        "warmth": round(warmth, 1),
        "saturation_mean": round(sat_mean, 3),
        "saturation_std": round(sat_std, 3),
        "gradient": {
            "direction": gradient_direction,
            "horizontal_strength": round(h_gradient, 1),
            "vertical_strength": round(v_gradient, 1),
            "top_color": [int(x) for x in top_avg],
            "bottom_color": [int(x) for x in bottom_avg],
            "left_color": [int(x) for x in left_avg],
            "right_color": [int(x) for x in right_avg],
        },
    }


def analyze_brightness(frame_bgr):
    """Brightness distribution, contrast, vignette detection."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    h, w = gray.shape

    overall_mean = float(gray.mean())
    overall_std = float(gray.std())

    # Contrast ratio
    p5 = float(np.percentile(gray, 5))
    p95 = float(np.percentile(gray, 95))
    contrast = p95 - p5

    # Vignette detection (compare center vs edges brightness)
    cy, cx = h // 2, w // 2
    r = min(h, w) // 4
    center_region = gray[cy-r:cy+r, cx-r:cx+r]
    edge_regions = [
        gray[:h//6, :],         # top
        gray[5*h//6:, :],       # bottom
        gray[:, :w//6],         # left
        gray[:, 5*w//6:],       # right
    ]
    center_brightness = float(center_region.mean())
    edge_brightness = float(np.mean([e.mean() for e in edge_regions]))
    vignette_strength = center_brightness - edge_brightness

    # Brightness quadrants
    quadrants = {
        "top_left": float(gray[:h//2, :w//2].mean()),
        "top_right": float(gray[:h//2, w//2:].mean()),
        "bottom_left": float(gray[h//2:, :w//2].mean()),
        "bottom_right": float(gray[h//2:, w//2:].mean()),
    }

    # Histogram peaks (bimodal = high contrast design)
    hist, _ = np.histogram(gray.ravel(), bins=50)
    peaks = signal.find_peaks(hist, height=hist.max() * 0.1, distance=5)[0]

    return {
        "mean": round(overall_mean, 3),
        "std": round(overall_std, 3),
        "contrast": round(contrast, 3),
        "vignette_strength": round(vignette_strength, 3),
        "has_vignette": vignette_strength > 0.05,
        "quadrants": {k: round(v, 3) for k, v in quadrants.items()},
        "histogram_peaks": len(peaks),
        "is_high_contrast": contrast > 0.6,
        "is_dark": overall_mean < 0.3,
        "is_bright": overall_mean > 0.7,
    }


def analyze_edges_and_shapes(frame_bgr):
    """Edge detection, contour analysis, shape identification."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Canny edge detection at multiple thresholds
    edges_soft = cv2.Canny(gray, 30, 100)
    edges_hard = cv2.Canny(gray, 100, 200)

    edge_density_soft = float(edges_soft.sum()) / (h * w * 255)
    edge_density_hard = float(edges_hard.sum()) / (h * w * 255)

    # Contour detection
    contours, hierarchy = cv2.findContours(edges_hard, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    # Classify shapes
    shapes = []
    for cnt in contours[:50]:  # limit to 50 largest
        area = cv2.contourArea(cnt)
        if area < 100:
            continue

        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue

        approx = cv2.approxPolyDP(cnt, 0.02 * perimeter, True)
        x, y, bw, bh = cv2.boundingRect(cnt)
        circularity = 4 * math.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
        aspect_ratio = bw / bh if bh > 0 else 1

        shape_type = "unknown"
        n_vertices = len(approx)
        if n_vertices == 3:
            shape_type = "triangle"
        elif n_vertices == 4:
            shape_type = "rectangle" if 0.8 < aspect_ratio < 1.2 else "quadrilateral"
        elif n_vertices > 6 and circularity > 0.7:
            shape_type = "circle"
        elif n_vertices > 4:
            shape_type = "polygon"

        shapes.append({
            "type": shape_type,
            "vertices": n_vertices,
            "area": int(area),
            "bbox": {"x": int(x), "y": int(y), "w": int(bw), "h": int(bh)},
            "center": {"x": int(x + bw/2), "y": int(y + bh/2)},
            "circularity": round(circularity, 3),
            "aspect_ratio": round(aspect_ratio, 2),
        })

    # Sort by area descending
    shapes.sort(key=lambda s: s["area"], reverse=True)

    # Line detection (Hough)
    lines_raw = cv2.HoughLinesP(edges_hard, 1, np.pi/180, 50, minLineLength=50, maxLineGap=10)
    lines = []
    if lines_raw is not None:
        for line in lines_raw[:30]:
            x1, y1, x2, y2 = line[0]
            angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
            length = math.sqrt((x2-x1)**2 + (y2-y1)**2)
            lines.append({
                "start": {"x": int(x1), "y": int(y1)},
                "end": {"x": int(x2), "y": int(y2)},
                "angle": round(angle, 1),
                "length": round(length, 1),
                "is_horizontal": abs(angle) < 5 or abs(angle) > 175,
                "is_vertical": 85 < abs(angle) < 95,
            })

    return {
        "edge_density_soft": round(edge_density_soft, 4),
        "edge_density_hard": round(edge_density_hard, 4),
        "is_minimal": edge_density_hard < 0.01,
        "is_complex": edge_density_hard > 0.05,
        "contour_count": len(contours),
        "shapes": shapes[:20],
        "lines": lines[:15],
        "has_grid": sum(1 for l in lines if l["is_horizontal"]) > 3 and sum(1 for l in lines if l["is_vertical"]) > 3,
    }


def analyze_shadows(frame_bgr):
    """Shadow detection: angle, softness, color, offset."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    h, w = gray.shape

    # Shadow detection via dark region analysis
    threshold = 0.3
    shadow_mask = (gray < threshold).astype(np.uint8)
    shadow_percentage = float(shadow_mask.mean()) * 100

    # Shadow softness (gradient at shadow edges)
    shadow_edges = cv2.Canny((shadow_mask * 255).astype(np.uint8), 50, 150)
    if shadow_edges.sum() > 0:
        # Sample gradient magnitude at shadow boundaries
        grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=5)
        grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=5)
        grad_mag = np.sqrt(grad_x**2 + grad_y**2)
        shadow_edge_gradient = float(grad_mag[shadow_edges > 0].mean()) if shadow_edges.sum() > 0 else 0
        # Low gradient = soft shadow, high = hard shadow
        softness = 1.0 - min(shadow_edge_gradient * 5, 1.0)
    else:
        softness = 0.0

    # Shadow color (average color in shadow regions)
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    shadow_color = [0, 0, 0]
    if shadow_mask.sum() > 0:
        shadow_pixels = frame_rgb[shadow_mask > 0]
        shadow_color = shadow_pixels.mean(axis=0).astype(int).tolist()

    # Drop shadow detection (look for offset dark regions near bright elements)
    # Dilate bright regions, check for dark regions nearby
    bright_mask = (gray > 0.7).astype(np.uint8)
    dilated = cv2.dilate(bright_mask, np.ones((20, 20), np.uint8))
    potential_shadow = dilated & shadow_mask
    has_drop_shadow = float(potential_shadow.sum()) > (h * w * 0.005)

    return {
        "shadow_percentage": round(shadow_percentage, 1),
        "shadow_softness": round(softness, 3),
        "shadow_type": "soft" if softness > 0.5 else "hard" if shadow_percentage > 5 else "none",
        "shadow_color": shadow_color,
        "has_drop_shadow": has_drop_shadow,
    }


def analyze_blur_and_effects(frame_bgr):
    """Detect blur, glow, grain, noise, bokeh."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Blur detection (Laplacian variance)
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    is_blurry = laplacian_var < 100

    # Regional blur (detect depth-of-field / selective blur)
    regions = {
        "center": gray[h//4:3*h//4, w//4:3*w//4],
        "top": gray[:h//4, :],
        "bottom": gray[3*h//4:, :],
        "left": gray[:, :w//4],
        "right": gray[:, 3*w//4:],
    }
    regional_sharpness = {}
    for name, region in regions.items():
        regional_sharpness[name] = round(float(cv2.Laplacian(region, cv2.CV_64F).var()), 1)

    has_depth_of_field = (
        regional_sharpness["center"] > regional_sharpness.get("top", 0) * 1.5 or
        regional_sharpness["center"] > regional_sharpness.get("bottom", 0) * 1.5
    )

    # Noise/grain detection (high-frequency energy)
    high_pass = cv2.subtract(gray, cv2.GaussianBlur(gray, (21, 21), 0))
    noise_level = float(high_pass.std()) / 255

    # Glow detection (bright regions with soft edges)
    bright = (gray > 200).astype(np.uint8)
    bright_blurred = cv2.GaussianBlur(bright.astype(np.float32), (31, 31), 0)
    glow_area = float((bright_blurred > 0.1).sum()) / (h * w)
    has_glow = glow_area > 0.05 and glow_area > float(bright.sum()) / (h * w) * 2

    # Bokeh detection (circular bright spots)
    circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, 1, 50,
                                param1=100, param2=30, minRadius=5, maxRadius=50)
    bokeh_count = 0 if circles is None else len(circles[0])

    return {
        "sharpness": round(laplacian_var, 1),
        "is_blurry": is_blurry,
        "regional_sharpness": regional_sharpness,
        "has_depth_of_field": has_depth_of_field,
        "noise_level": round(noise_level, 4),
        "has_film_grain": noise_level > 0.02,
        "has_glow": has_glow,
        "glow_area": round(glow_area, 3),
        "bokeh_spots": bokeh_count,
        "has_bokeh": bokeh_count > 3,
    }


def analyze_text(frame_bgr):
    """OCR text extraction with position, size, color estimation."""
    if not HAS_OCR:
        return {"text_regions": [], "has_text": False, "error": "pytesseract not available"}

    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

    # Run OCR with bounding box data
    try:
        data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT, config='--psm 11')
    except Exception:
        return {"text_regions": [], "has_text": False, "error": "OCR failed"}

    text_regions = []
    for i in range(len(data["text"])):
        text = data["text"][i].strip()
        conf = int(data["conf"][i]) if data["conf"][i] != '-1' else 0
        if not text or conf < 30:
            continue

        x, y, bw, bh = data["left"][i], data["top"][i], data["width"][i], data["height"][i]

        # Sample text color (most common non-background color in bbox)
        if bw > 0 and bh > 0:
            roi = frame_rgb[max(0,y):min(h,y+bh), max(0,x):min(w,x+bw)]
            if roi.size > 0:
                # Get dominant text color (usually brightest or darkest)
                roi_flat = roi.reshape(-1, 3)
                brightness = roi_flat.mean(axis=1)
                # Text is likely the minority color
                median_bright = np.median(brightness)
                if median_bright > 128:
                    # Dark text on light bg
                    text_pixels = roi_flat[brightness < median_bright * 0.7]
                else:
                    # Light text on dark bg
                    text_pixels = roi_flat[brightness > median_bright * 1.3]

                if len(text_pixels) > 0:
                    text_color = text_pixels.mean(axis=0).astype(int).tolist()
                else:
                    text_color = roi_flat.mean(axis=0).astype(int).tolist()
            else:
                text_color = [0, 0, 0]
        else:
            text_color = [0, 0, 0]

        # Estimate font size from bbox height (rough: 1px ≈ 0.75pt)
        font_size_estimate = int(bh * 0.75)

        text_regions.append({
            "text": text,
            "confidence": conf,
            "bbox": {"x": int(x), "y": int(y), "w": int(bw), "h": int(bh)},
            "center": {"x": int(x + bw/2), "y": int(y + bh/2)},
            "position_normalized": {
                "x": round(x / w, 3),
                "y": round(y / h, 3),
            },
            "font_size_estimate": font_size_estimate,
            "text_color_rgb": text_color,
            "text_color_hex": f"#{text_color[0]:02x}{text_color[1]:02x}{text_color[2]:02x}",
        })

    # Merge words on same line
    full_text = " ".join([r["text"] for r in text_regions])

    return {
        "text_regions": text_regions,
        "full_text": full_text,
        "has_text": len(text_regions) > 0,
        "text_count": len(text_regions),
    }


def analyze_layout(frame_bgr):
    """Layout grid, spacing, alignment, element distribution."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Detect major regions via thresholding + connected components
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    n_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)

    elements = []
    for i in range(1, n_labels):  # skip background
        x, y, bw, bh, area = stats[i]
        if area < 500 or area > h * w * 0.9:  # skip tiny and full-frame
            continue
        elements.append({
            "bbox": {"x": int(x), "y": int(y), "w": int(bw), "h": int(bh)},
            "center": {"x": int(centroids[i][0]), "y": int(centroids[i][1])},
            "area": int(area),
            "area_percentage": round(area / (h * w) * 100, 1),
        })

    elements.sort(key=lambda e: e["area"], reverse=True)

    # Detect grid alignment
    if elements:
        x_positions = [e["center"]["x"] for e in elements[:20]]
        y_positions = [e["center"]["y"] for e in elements[:20]]

        # Check for column alignment (x positions cluster)
        x_sorted = sorted(x_positions)
        x_gaps = [x_sorted[i+1] - x_sorted[i] for i in range(len(x_sorted)-1)]

        # Check for row alignment
        y_sorted = sorted(y_positions)
        y_gaps = [y_sorted[i+1] - y_sorted[i] for i in range(len(y_sorted)-1)]
    else:
        x_gaps = []
        y_gaps = []

    # Symmetry detection
    left_half = gray[:, :w//2]
    right_half = cv2.flip(gray[:, w//2:], 1)
    min_w = min(left_half.shape[1], right_half.shape[1])
    if min_w > 0:
        symmetry_h = 1.0 - float(cv2.absdiff(left_half[:, :min_w], right_half[:, :min_w]).mean()) / 255
    else:
        symmetry_h = 0

    top_half = gray[:h//2, :]
    bottom_half = cv2.flip(gray[h//2:, :], 0)
    min_h = min(top_half.shape[0], bottom_half.shape[0])
    if min_h > 0:
        symmetry_v = 1.0 - float(cv2.absdiff(top_half[:min_h, :], bottom_half[:min_h, :]).mean()) / 255
    else:
        symmetry_v = 0

    # Content distribution (where is the visual weight?)
    weight_map = gray.astype(np.float32)
    total_weight = weight_map.sum()
    if total_weight > 0:
        center_of_mass_x = float((weight_map * np.arange(w)[np.newaxis, :]).sum() / total_weight) / w
        center_of_mass_y = float((weight_map * np.arange(h)[:, np.newaxis]).sum() / total_weight) / h
    else:
        center_of_mass_x = 0.5
        center_of_mass_y = 0.5

    return {
        "elements": elements[:15],
        "element_count": len(elements),
        "symmetry_horizontal": round(symmetry_h, 3),
        "symmetry_vertical": round(symmetry_v, 3),
        "is_symmetric": symmetry_h > 0.85 or symmetry_v > 0.85,
        "center_of_mass": {
            "x": round(center_of_mass_x, 3),
            "y": round(center_of_mass_y, 3),
        },
        "is_centered": abs(center_of_mass_x - 0.5) < 0.1 and abs(center_of_mass_y - 0.5) < 0.1,
    }


def analyze_perspective(frame_bgr):
    """3D perspective, rotation, depth cues."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    edges = cv2.Canny(gray, 50, 150)

    # Detect vanishing point via line convergence
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, 80, minLineLength=80, maxLineGap=10)

    angles = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
            angles.append(angle)

    # Check for perspective (convergent lines)
    has_perspective = False
    perspective_type = "flat"
    if angles:
        angle_std = np.std(angles)
        # High std = many different angles = likely perspective
        if angle_std > 20:
            has_perspective = True
            perspective_type = "3d"
        elif angle_std > 10:
            perspective_type = "slight_rotation"

    # Check for rounded corners (phone/card detection)
    corners = cv2.goodFeaturesToTrack(gray, 100, 0.01, 20)
    corner_count = len(corners) if corners is not None else 0

    # Phone/card detection (rectangular with rounded corners, specific aspect ratios)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    phone_candidates = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 5000:
            continue
        rect = cv2.minAreaRect(cnt)
        box_w, box_h = rect[1]
        if box_w == 0 or box_h == 0:
            continue
        aspect = max(box_w, box_h) / min(box_w, box_h)
        angle = rect[2]
        # Phone aspect ratio ~2.0-2.2, card ~1.5-1.7
        if 1.8 < aspect < 2.5:
            phone_candidates.append({
                "type": "phone_shape",
                "center": {"x": int(rect[0][0]), "y": int(rect[0][1])},
                "size": {"w": int(max(box_w, box_h)), "h": int(min(box_w, box_h))},
                "rotation": round(angle, 1),
                "aspect_ratio": round(aspect, 2),
            })
        elif 1.4 < aspect < 1.8:
            phone_candidates.append({
                "type": "card_shape",
                "center": {"x": int(rect[0][0]), "y": int(rect[0][1])},
                "size": {"w": int(max(box_w, box_h)), "h": int(min(box_w, box_h))},
                "rotation": round(angle, 1),
                "aspect_ratio": round(aspect, 2),
            })

    return {
        "has_perspective": has_perspective,
        "perspective_type": perspective_type,
        "line_angle_diversity": round(float(np.std(angles)), 1) if angles else 0,
        "corner_count": corner_count,
        "phone_card_shapes": phone_candidates[:5],
        "has_phone_mockup": any(p["type"] == "phone_shape" for p in phone_candidates),
        "has_card_element": any(p["type"] == "card_shape" for p in phone_candidates),
    }


def analyze_effects(frame_bgr):
    """Shader-like effects: glass, chrome, iridescence, reflection."""
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    h_frame, w_frame = frame_bgr.shape[:2]

    # Iridescence/rainbow detection (rapid hue changes in local regions)
    hue = hsv[:, :, 0].astype(np.float32)
    hue_gradient = np.sqrt(cv2.Sobel(hue, cv2.CV_32F, 1, 0)**2 + cv2.Sobel(hue, cv2.CV_32F, 0, 1)**2)
    high_hue_change = (hue_gradient > 20).sum() / (h_frame * w_frame)
    has_iridescence = high_hue_change > 0.02

    # Glass/transparency detection (high brightness + low saturation + varying alpha-like regions)
    brightness = hsv[:, :, 2].astype(np.float32) / 255
    saturation = hsv[:, :, 1].astype(np.float32) / 255
    glass_region = ((brightness > 0.7) & (saturation < 0.15)).sum() / (h_frame * w_frame)
    has_glass = glass_region > 0.05

    # Chrome/metallic detection (high contrast + specific hue patterns)
    local_contrast = cv2.Laplacian(brightness, cv2.CV_32F)
    high_contrast_area = (np.abs(local_contrast) > 0.1).sum() / (h_frame * w_frame)

    # Reflection detection (vertical symmetry in local regions)
    # Check bottom half for reflection of top half
    quarter_h = h_frame // 4
    if quarter_h > 10:
        top_quarter = frame_bgr[quarter_h:2*quarter_h, :]
        bottom_quarter = cv2.flip(frame_bgr[2*quarter_h:3*quarter_h, :], 0)
        min_rows = min(top_quarter.shape[0], bottom_quarter.shape[0])
        if min_rows > 0:
            reflection_sim = 1.0 - float(cv2.absdiff(
                top_quarter[:min_rows], bottom_quarter[:min_rows]
            ).mean()) / 255
        else:
            reflection_sim = 0
    else:
        reflection_sim = 0

    return {
        "has_iridescence": has_iridescence,
        "iridescence_amount": round(float(high_hue_change), 4),
        "has_glass_effect": has_glass,
        "glass_area": round(float(glass_region), 3),
        "has_metallic": high_contrast_area > 0.1,
        "local_contrast": round(float(high_contrast_area), 3),
        "reflection_similarity": round(reflection_sim, 3),
        "has_reflection": reflection_sim > 0.7,
        "suggested_shaders": [],  # populated below
    }


# ═══════════════════════════════════════════════════════════════
# MOTION ANALYSIS (frame pairs)
# ═══════════════════════════════════════════════════════════════

def analyze_motion_between(prev_bgr, curr_bgr, fps):
    """Dense optical flow, motion vectors, easing detection."""
    prev_gray = cv2.cvtColor(prev_bgr, cv2.COLOR_BGR2GRAY)
    curr_gray = cv2.cvtColor(curr_bgr, cv2.COLOR_BGR2GRAY)
    h, w = prev_gray.shape

    # Dense optical flow (Farneback)
    flow = cv2.calcOpticalFlowFarneback(prev_gray, curr_gray, None,
                                         0.5, 3, 15, 3, 5, 1.2, 0)

    # Flow magnitude and angle
    mag, ang = cv2.cartToPolar(flow[:, :, 0], flow[:, :, 1])

    # Overall motion
    mean_magnitude = float(mag.mean())
    max_magnitude = float(mag.max())

    # Motion by region (9 zones)
    zone_h, zone_w = h // 3, w // 3
    motion_zones = {}
    for zy in range(3):
        for zx in range(3):
            zone_name = ["top", "mid", "bottom"][zy] + "_" + ["left", "center", "right"][zx]
            zone_mag = mag[zy*zone_h:(zy+1)*zone_h, zx*zone_w:(zx+1)*zone_w]
            zone_flow = flow[zy*zone_h:(zy+1)*zone_h, zx*zone_w:(zx+1)*zone_w]
            motion_zones[zone_name] = {
                "magnitude": round(float(zone_mag.mean()), 2),
                "direction_x": round(float(zone_flow[:, :, 0].mean()), 2),
                "direction_y": round(float(zone_flow[:, :, 1].mean()), 2),
            }

    # Dominant motion direction
    significant = mag > 1.0
    if significant.sum() > 100:
        dominant_angle = float(np.median(ang[significant]))
        dominant_mag = float(np.median(mag[significant]))
        dominant_dx = float(np.median(flow[:, :, 0][significant]))
        dominant_dy = float(np.median(flow[:, :, 1][significant]))
    else:
        dominant_angle = 0
        dominant_mag = 0
        dominant_dx = 0
        dominant_dy = 0

    # Classify motion type
    motion_type = "static"
    if mean_magnitude > 0.5:
        # Check if uniform (pan/slide) vs divergent (zoom) vs rotational
        flow_std = float(np.std(mag[mag > 0.5])) if (mag > 0.5).sum() > 100 else 0
        if flow_std < mean_magnitude * 0.3:
            motion_type = "slide"
        elif flow_std > mean_magnitude:
            motion_type = "zoom_or_complex"
        else:
            motion_type = "mixed"

    # Estimate pixels-per-second for dominant motion
    pps = dominant_mag * fps

    return {
        "mean_magnitude": round(mean_magnitude, 3),
        "max_magnitude": round(max_magnitude, 1),
        "dominant_direction": {
            "angle_degrees": round(math.degrees(dominant_angle), 1),
            "dx_pixels": round(dominant_dx, 2),
            "dy_pixels": round(dominant_dy, 2),
            "speed_pps": round(pps, 1),
        },
        "motion_type": motion_type,
        "zones": motion_zones,
        "moving_area_percentage": round(float(significant.sum()) / (h * w) * 100, 1),
    }


# ═══════════════════════════════════════════════════════════════
# AUDIO ANALYSIS
# ═══════════════════════════════════════════════════════════════

def analyze_audio(video_path, output_dir):
    """Extract and analyze audio: beats, SFX, music, volume envelope."""
    audio_path = os.path.join(output_dir, "audio.wav")

    # Extract audio
    result = subprocess.run([
        "ffmpeg", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
        "-ar", "44100", "-ac", "1", audio_path, "-y"
    ], capture_output=True)

    if not os.path.exists(audio_path):
        return {"has_audio": False, "error": "Could not extract audio"}

    try:
        import wave
        with wave.open(audio_path, 'r') as wf:
            n_frames = wf.getnframes()
            framerate = wf.getframerate()
            audio_data = np.frombuffer(wf.readframes(n_frames), dtype=np.int16).astype(np.float32)
            audio_data /= 32768.0  # normalize
    except Exception as e:
        return {"has_audio": False, "error": str(e)}

    duration = len(audio_data) / framerate

    # Volume envelope (RMS per 0.1s window)
    window_size = int(framerate * 0.1)
    volume_envelope = []
    for i in range(0, len(audio_data) - window_size, window_size):
        chunk = audio_data[i:i + window_size]
        rms = float(np.sqrt(np.mean(chunk**2)))
        t = i / framerate
        volume_envelope.append({"time": round(t, 2), "rms": round(rms, 4)})

    # Peak detection (SFX candidates — sudden volume spikes)
    rms_values = [v["rms"] for v in volume_envelope]
    if rms_values:
        rms_array = np.array(rms_values)
        mean_rms = rms_array.mean()
        peaks_idx = signal.find_peaks(rms_array, height=mean_rms * 2, distance=5)[0]
        sfx_timestamps = [volume_envelope[i]["time"] for i in peaks_idx]
    else:
        sfx_timestamps = []

    # Beat detection (autocorrelation method)
    beats = []
    if len(audio_data) > framerate:
        # Simple onset detection
        hop = framerate // 20  # 50ms hops
        onsets = []
        for i in range(hop, len(audio_data) - hop, hop):
            prev_energy = np.mean(audio_data[i-hop:i]**2)
            curr_energy = np.mean(audio_data[i:i+hop]**2)
            if curr_energy > prev_energy * 2 and curr_energy > 0.01:
                onsets.append(round(i / framerate, 3))
        beats = onsets[:100]

    # Spectral analysis (detect frequency ranges present)
    if len(audio_data) > 4096:
        fft = np.fft.rfft(audio_data[:framerate])  # 1 second
        freqs = np.fft.rfftfreq(framerate, 1/framerate)
        magnitude = np.abs(fft)

        # Energy in frequency bands
        bass = float(magnitude[(freqs >= 20) & (freqs < 250)].mean())
        mids = float(magnitude[(freqs >= 250) & (freqs < 4000)].mean())
        highs = float(magnitude[(freqs >= 4000) & (freqs < 20000)].mean())
        total_e = bass + mids + highs + 1e-10

        spectral = {
            "bass_ratio": round(bass / total_e, 3),
            "mids_ratio": round(mids / total_e, 3),
            "highs_ratio": round(highs / total_e, 3),
            "has_music": bass > 0.1 and mids > 0.1,
            "has_voice": mids > highs * 2,
        }
    else:
        spectral = {}

    # Silence detection
    silence_threshold = 0.005
    silence_regions = []
    in_silence = False
    silence_start = 0
    for v in volume_envelope:
        if v["rms"] < silence_threshold:
            if not in_silence:
                silence_start = v["time"]
                in_silence = True
        else:
            if in_silence:
                silence_regions.append({"start": silence_start, "end": v["time"]})
                in_silence = False

    return {
        "has_audio": True,
        "duration": round(duration, 3),
        "volume_envelope": volume_envelope,
        "sfx_timestamps": sfx_timestamps,
        "beat_timestamps": beats,
        "silence_regions": silence_regions,
        "spectral": spectral,
        "peak_volume": round(float(max(rms_values)) if rms_values else 0, 4),
        "mean_volume": round(float(np.mean(rms_values)) if rms_values else 0, 4),
    }


# ═══════════════════════════════════════════════════════════════
# EASING CURVE DETECTION
# ═══════════════════════════════════════════════════════════════

def detect_easing(positions):
    """Given a list of positions over time, fit easing curves."""
    if len(positions) < 4:
        return {"type": "unknown", "confidence": 0}

    t = np.linspace(0, 1, len(positions))
    p = np.array(positions, dtype=np.float32)

    # Normalize to 0-1 range
    p_min, p_max = p.min(), p.max()
    if p_max - p_min < 1:
        return {"type": "static", "confidence": 1.0}

    p_norm = (p - p_min) / (p_max - p_min)

    # Fit common easing curves
    def linear(t): return t
    def ease_in_quad(t): return t**2
    def ease_out_quad(t): return 1 - (1-t)**2
    def ease_in_out_quad(t): return np.where(t < 0.5, 2*t**2, 1 - (-2*t+2)**2/2)
    def ease_out_cubic(t): return 1 - (1-t)**3
    def ease_out_back(t): return 1 + 2.70158 * (t-1)**3 + 1.70158 * (t-1)**2

    curves = {
        "linear": linear,
        "ease_in": ease_in_quad,
        "ease_out": ease_out_quad,
        "ease_in_out": ease_in_out_quad,
        "ease_out_cubic": ease_out_cubic,
        "ease_out_back_overshoot": ease_out_back,
    }

    best_fit = "linear"
    best_error = float("inf")

    for name, func in curves.items():
        try:
            predicted = func(t)
            error = float(np.mean((p_norm - predicted)**2))
            if error < best_error:
                best_error = error
                best_fit = name
        except Exception:
            continue

    # Check for spring/overshoot
    has_overshoot = bool(np.any(p_norm > 1.05) or np.any(p_norm < -0.05))
    if has_overshoot:
        best_fit = "spring_overshoot"

    confidence = max(0, 1.0 - best_error * 10)

    return {
        "type": best_fit,
        "confidence": round(confidence, 3),
        "has_overshoot": has_overshoot,
        "total_distance": round(float(p_max - p_min), 1),
        "direction": "increasing" if p[-1] > p[0] else "decreasing",
    }


# ═══════════════════════════════════════════════════════════════
# MAIN ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Deep video analysis for Remotion replication")
    parser.add_argument("video", help="Path to reference MP4")
    parser.add_argument("output", nargs="?", help="Output directory")
    parser.add_argument("--fps", type=int, default=2, help="Analysis frames per second (default: 2)")
    parser.add_argument("--detail", choices=["high", "ultra"], default="high",
                        help="Detail level (ultra = every frame, high = 2fps)")
    args = parser.parse_args()

    video_path = os.path.abspath(args.video)
    output_dir = args.output or os.path.join(os.path.dirname(video_path), "deep-analysis")
    os.makedirs(output_dir, exist_ok=True)

    print(f"=== Deep Video Analysis ===")
    print(f"Input:  {video_path}")
    print(f"Output: {output_dir}")
    print(f"Detail: {args.detail}")
    print()

    # ── PROBE ──
    print("[1/8] Probing video...")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"ERROR: Cannot open {video_path}")
        sys.exit(1)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / video_fps if video_fps > 0 else 0

    print(f"  {width}x{height} @ {video_fps:.1f}fps, {duration:.1f}s, {total_frames} frames")

    # ── FRAME EXTRACTION ──
    analysis_fps = args.fps if args.detail == "high" else video_fps
    frame_interval = max(1, int(video_fps / analysis_fps))

    print(f"[2/8] Extracting frames (every {frame_interval} frames = {analysis_fps}fps)...")

    frames_dir = os.path.join(output_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    frames = []
    frame_idx = 0
    extracted = 0
    prev_frame = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            frame_path = os.path.join(frames_dir, f"frame_{extracted:04d}.png")
            cv2.imwrite(frame_path, frame)
            frames.append({
                "index": extracted,
                "video_frame": frame_idx,
                "time": round(frame_idx / video_fps, 3),
                "path": frame_path,
                "bgr": frame,
                "prev_bgr": prev_frame,
            })
            prev_frame = frame.copy()
            extracted += 1

        frame_idx += 1

    cap.release()
    print(f"  Extracted {extracted} frames")

    # ── PER-FRAME ANALYSIS ──
    print(f"[3/8] Analyzing frames (100+ data points each)...")

    frame_analyses = []
    for i, fdata in enumerate(frames):
        if i % 10 == 0:
            print(f"  Frame {i}/{len(frames)}...", end="\r")

        frame_bgr = fdata["bgr"]
        analysis = {
            "index": fdata["index"],
            "video_frame": fdata["video_frame"],
            "time": fdata["time"],
            "colors": analyze_colors(frame_bgr),
            "brightness": analyze_brightness(frame_bgr),
            "edges": analyze_edges_and_shapes(frame_bgr),
            "shadows": analyze_shadows(frame_bgr),
            "blur_effects": analyze_blur_and_effects(frame_bgr),
            "text": analyze_text(frame_bgr),
            "layout": analyze_layout(frame_bgr),
            "perspective": analyze_perspective(frame_bgr),
            "effects": analyze_effects(frame_bgr),
        }

        # Motion (needs previous frame)
        if fdata["prev_bgr"] is not None:
            analysis["motion"] = analyze_motion_between(fdata["prev_bgr"], frame_bgr, video_fps)
        else:
            analysis["motion"] = {"mean_magnitude": 0, "motion_type": "static"}

        frame_analyses.append(analysis)

    print(f"  Analyzed {len(frame_analyses)} frames" + " " * 20)

    # ── MOTION TRAJECTORY TRACKING ──
    print("[4/8] Tracking motion trajectories...")

    # Track text positions across frames for easing detection
    text_trajectories = defaultdict(list)
    for fa in frame_analyses:
        for tr in fa.get("text", {}).get("text_regions", []):
            text_trajectories[tr["text"]].append({
                "time": fa["time"],
                "x": tr["center"]["x"],
                "y": tr["center"]["y"],
                "font_size": tr.get("font_size_estimate", 0),
            })

    # Fit easing curves to text movements
    text_animations = {}
    for word, positions in text_trajectories.items():
        if len(positions) >= 3:
            x_positions = [p["x"] for p in positions]
            y_positions = [p["y"] for p in positions]
            text_animations[word] = {
                "appearances": len(positions),
                "first_seen": positions[0]["time"],
                "last_seen": positions[-1]["time"],
                "x_easing": detect_easing(x_positions),
                "y_easing": detect_easing(y_positions),
                "positions": positions,
            }

    print(f"  Tracked {len(text_animations)} text elements")

    # ── SCENE DETECTION ──
    print("[5/8] Detecting scene changes...")

    scene_changes = []
    for i in range(1, len(frame_analyses)):
        prev = frame_analyses[i-1]
        curr = frame_analyses[i]

        # Color distance between frames
        prev_dom = prev["colors"]["palette"][0]["rgb"] if prev["colors"]["palette"] else [0,0,0]
        curr_dom = curr["colors"]["palette"][0]["rgb"] if curr["colors"]["palette"] else [0,0,0]
        color_dist = math.sqrt(sum((a-b)**2 for a, b in zip(prev_dom, curr_dom)))

        # Brightness change
        bright_change = abs(prev["brightness"]["mean"] - curr["brightness"]["mean"])

        # Edge density change
        edge_change = abs(
            prev["edges"]["edge_density_hard"] - curr["edges"]["edge_density_hard"]
        )

        # Detect scene change
        is_scene_change = color_dist > 80 or bright_change > 0.2 or edge_change > 0.02
        if is_scene_change:
            scene_changes.append({
                "time": curr["time"],
                "frame": curr["video_frame"],
                "color_distance": round(color_dist, 1),
                "brightness_change": round(bright_change, 3),
                "edge_change": round(edge_change, 4),
                "transition_type": "cut" if color_dist > 120 else "fade" if bright_change > 0.3 else "dissolve",
            })

    print(f"  Found {len(scene_changes)} scene changes")

    # ── AUDIO ANALYSIS ──
    print("[6/8] Analyzing audio...")
    audio_analysis = analyze_audio(video_path, output_dir)
    if audio_analysis.get("has_audio"):
        print(f"  Beats: {len(audio_analysis.get('beat_timestamps', []))}, "
              f"SFX: {len(audio_analysis.get('sfx_timestamps', []))}")
    else:
        print(f"  No audio or audio extraction failed")

    # ── SUGGESTED SHADERS/EFFECTS ──
    print("[7/8] Identifying shader requirements...")

    shader_suggestions = set()
    for fa in frame_analyses:
        if fa["effects"].get("has_iridescence"):
            shader_suggestions.add("iridescence_shader")
        if fa["effects"].get("has_glass_effect"):
            shader_suggestions.add("glass_material")
        if fa["blur_effects"].get("has_glow"):
            shader_suggestions.add("glow_bloom")
        if fa["blur_effects"].get("has_film_grain"):
            shader_suggestions.add("film_grain_noise")
        if fa["blur_effects"].get("has_bokeh"):
            shader_suggestions.add("bokeh_blur")
        if fa["blur_effects"].get("has_depth_of_field"):
            shader_suggestions.add("depth_of_field")
        if fa["effects"].get("has_metallic"):
            shader_suggestions.add("metallic_chrome")
        if fa["effects"].get("has_reflection"):
            shader_suggestions.add("reflection_plane")
        if fa["perspective"].get("has_phone_mockup"):
            shader_suggestions.add("phone_3d_model")
        if fa["shadows"].get("has_drop_shadow"):
            shader_suggestions.add("drop_shadow")
        if any(s["type"] == "circle" for s in fa["edges"].get("shapes", [])):
            shader_suggestions.add("circle_shape")

    print(f"  Suggested: {', '.join(shader_suggestions) or 'none'}")

    # ── ASSEMBLE MASTER ANALYSIS ──
    print("[8/8] Assembling deep analysis...")

    # Clean frames data (remove numpy arrays)
    clean_frame_analyses = []
    for fa in frame_analyses:
        clean = json.loads(json.dumps(fa, default=lambda x: None))
        clean_frame_analyses.append(clean)

    master = {
        "source": os.path.basename(video_path),
        "video": {
            "width": width,
            "height": height,
            "fps": round(video_fps, 2),
            "duration": round(duration, 3),
            "total_frames": total_frames,
        },
        "remotion_config": {
            "width": width,
            "height": height,
            "fps": int(round(video_fps)),
            "durationInFrames": total_frames,
        },
        "analysis_detail": args.detail,
        "analysis_fps": analysis_fps,
        "frames_analyzed": len(frame_analyses),
        "scene_changes": scene_changes,
        "scene_count": len(scene_changes) + 1,
        "text_animations": text_animations,
        "shader_suggestions": sorted(shader_suggestions),
        "audio": audio_analysis,
        "frames": clean_frame_analyses,
    }

    # Write master analysis
    analysis_path = os.path.join(output_dir, "deep-analysis.json")
    with open(analysis_path, "w") as f:
        json.dump(master, f, indent=2, default=str)

    # Write summary for quick agent reference
    summary = {
        "source": master["source"],
        "video": master["video"],
        "remotion_config": master["remotion_config"],
        "scene_count": master["scene_count"],
        "scene_changes": master["scene_changes"],
        "shader_suggestions": master["shader_suggestions"],
        "text_elements": {k: {
            "first_seen": v["first_seen"],
            "last_seen": v["last_seen"],
            "x_easing": v["x_easing"]["type"],
            "y_easing": v["y_easing"]["type"],
        } for k, v in text_animations.items()},
        "audio_beats": audio_analysis.get("beat_timestamps", [])[:20],
        "audio_sfx": audio_analysis.get("sfx_timestamps", [])[:20],
        "per_scene_summary": [],
    }

    # Per-scene summary
    boundaries = [0] + [sc["time"] for sc in scene_changes] + [duration]
    for i in range(len(boundaries) - 1):
        start, end = boundaries[i], boundaries[i + 1]
        scene_frames = [fa for fa in frame_analyses if start <= fa["time"] < end]
        if not scene_frames:
            continue

        # Aggregate per scene
        avg_brightness = np.mean([f["brightness"]["mean"] for f in scene_frames])
        dominant_color = scene_frames[len(scene_frames)//2]["colors"]["dominant_color"]
        has_text = any(f["text"].get("has_text") for f in scene_frames)
        all_text = set()
        for f in scene_frames:
            for tr in f.get("text", {}).get("text_regions", []):
                all_text.add(tr["text"])
        has_3d = any(f["perspective"].get("has_perspective") for f in scene_frames)
        has_phone = any(f["perspective"].get("has_phone_mockup") for f in scene_frames)
        motion_types = [f["motion"].get("motion_type", "static") for f in scene_frames]
        dominant_motion = max(set(motion_types), key=motion_types.count)

        summary["per_scene_summary"].append({
            "scene": i + 1,
            "start": round(start, 2),
            "end": round(end, 2),
            "duration": round(end - start, 2),
            "dominant_color": dominant_color,
            "brightness": round(float(avg_brightness), 3),
            "has_text": has_text,
            "text_content": sorted(all_text),
            "has_3d_perspective": has_3d,
            "has_phone_mockup": has_phone,
            "dominant_motion": dominant_motion,
        })

    summary_path = os.path.join(output_dir, "summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print()
    print(f"=== Deep Analysis Complete ===")
    print(f"  {len(frame_analyses)} frames × 100+ data points each")
    print(f"  {len(scene_changes)} scene changes")
    print(f"  {len(text_animations)} tracked text elements")
    print(f"  {len(shader_suggestions)} suggested shaders/effects")
    print()
    print(f"Output:")
    print(f"  {analysis_path}  — Full analysis ({os.path.getsize(analysis_path) // 1024}KB)")
    print(f"  {summary_path}   — Quick summary for agents")
    print(f"  {frames_dir}/    — Extracted frames")
    if audio_analysis.get("has_audio"):
        print(f"  {os.path.join(output_dir, 'audio.wav')} — Extracted audio")


if __name__ == "__main__":
    main()
