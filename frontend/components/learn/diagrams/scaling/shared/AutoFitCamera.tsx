'use client'

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * AutoFitCamera — keeps all declared content points visible in the viewport.
 *
 * Drop this inside a <Canvas> alongside <OrbitControls>. It:
 * 1. On mount, computes the ideal camera distance so all `points` fit with padding
 * 2. Each frame, checks if projected points exceed the safe NDC zone
 * 3. If labels/objects clip outside the viewport, smoothly zooms out
 * 4. If the scene is too zoomed out (too much empty space), smoothly zooms in
 * 5. After user orbit/zoom via OrbitControls, re-evaluates and corrects
 *
 * Usage:
 *   <AutoFitCamera points={[[-3, 2.5, 0], [3, 2.5, 0], [0, 3, 0]]} />
 *
 * `points` should include approximate label anchor positions — anywhere
 * you have Html overlays or objects that must stay visible.
 */

const _proj = new THREE.Vector3()

interface AutoFitCameraProps {
  /** 3D positions that must remain visible (label anchors, object extremes) */
  points: [number, number, number][]
  /** Fraction of viewport to use. 0.82 = 82% (18% margin). Default 0.82 */
  padding?: number
  /** Correction speed (higher = snappier). Default 2.5 */
  speed?: number
  /** Minimum allowed camera distance. Default 4 */
  minDist?: number
  /** Maximum allowed camera distance. Default 20 */
  maxDist?: number
}

export function AutoFitCamera({
  points,
  padding = 0.82,
  speed = 2.5,
  minDist = 4,
  maxDist = 20,
}: AutoFitCameraProps) {
  const { camera } = useThree()
  const targetDistRef = useRef<number | null>(null)
  const stableFrames = useRef(0)

  // On mount: compute ideal distance and set camera
  useEffect(() => {
    if (points.length === 0) return
    const cam = camera as THREE.PerspectiveCamera

    // Compute bounding sphere of all points
    const box = new THREE.Box3()
    for (const [x, y, z] of points) {
      box.expandByPoint(new THREE.Vector3(x, y, z))
    }
    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)

    // Required distance to fit the bounding sphere in the camera frustum
    const fovRad = cam.fov * (Math.PI / 180)
    const hFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * cam.aspect)
    const halfAngle = Math.min(fovRad, hFovRad) / 2
    const idealDist = (sphere.radius / Math.sin(halfAngle)) * (1 / padding)

    // Clamp to bounds
    const clampedDist = Math.max(minDist, Math.min(maxDist, idealDist))

    // Move camera along its current direction to the ideal distance
    const currentDir = cam.position.clone().normalize()
    if (currentDir.lengthSq() < 0.001) currentDir.set(0, 1, 1).normalize()
    cam.position.copy(currentDir.multiplyScalar(clampedDist))
    cam.updateProjectionMatrix()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, delta) => {
    if (points.length === 0) return

    const cam = camera as THREE.PerspectiveCamera

    // Project all points to NDC (-1..1 range)
    let maxExtent = 0
    for (const [x, y, z] of points) {
      _proj.set(x, y, z)
      _proj.project(cam)
      // Check X and Y extents (Z is depth, ignore)
      maxExtent = Math.max(maxExtent, Math.abs(_proj.x), Math.abs(_proj.y))
    }

    const currentDist = cam.position.length()

    if (maxExtent > padding) {
      // Content is clipping — zoom out
      const ratio = maxExtent / padding
      targetDistRef.current = Math.min(currentDist * ratio * 1.05, maxDist)
      stableFrames.current = 0
    } else if (maxExtent < padding * 0.5) {
      // Too much empty space — zoom in (but only after 30 stable frames to avoid fighting)
      stableFrames.current++
      if (stableFrames.current > 30) {
        const ratio = maxExtent / (padding * 0.7)
        targetDistRef.current = Math.max(currentDist * ratio, minDist)
      }
    } else {
      stableFrames.current++
      targetDistRef.current = null
    }

    // Smoothly interpolate toward target distance
    if (targetDistRef.current !== null) {
      const target = targetDistRef.current
      const newDist = THREE.MathUtils.lerp(currentDist, target, Math.min(speed * delta, 0.15))
      const dir = cam.position.clone().normalize()
      if (dir.lengthSq() < 0.001) dir.set(0, 1, 1).normalize()
      cam.position.copy(dir.multiplyScalar(newDist))

      if (Math.abs(newDist - target) < 0.05) {
        targetDistRef.current = null
      }
    }
  })

  return null
}
