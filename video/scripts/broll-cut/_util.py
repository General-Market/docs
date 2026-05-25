"""Shared helpers for the broll-cut toolkit.

Everything here is intentionally small and dependency-light: ffmpeg/ffprobe on
the PATH and Pillow. No remote calls, no state — the scripts that import this
are meant to be run by hand or driven by an agent, one step at a time.
"""

from __future__ import annotations

import json
import re
import subprocess
import unicodedata
from dataclasses import dataclass
from pathlib import Path

ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"


def run(cmd: list[str], quiet: bool = True) -> str:
    """Run a command, return stdout, raise with stderr on failure."""
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(
            f"command failed ({res.returncode}): {' '.join(cmd[:6])}…\n{res.stderr.strip()}"
        )
    return res.stdout


@dataclass
class Probe:
    width: int
    height: int
    fps: float
    duration: float
    nframes: int

    @property
    def frame_step(self) -> float:
        return 1.0 / self.fps


def probe(video: str | Path) -> Probe:
    """Read width/height/fps/duration/frame-count from a video."""
    out = run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,nb_frames",
        "-show_entries", "format=duration",
        "-of", "json", str(video),
    ])
    data = json.loads(out)
    st = data["streams"][0]
    num, den = st["r_frame_rate"].split("/")
    fps = float(num) / float(den)
    dur = float(data["format"]["duration"])
    nframes = int(st.get("nb_frames") or 0) or round(dur * fps)
    return Probe(int(st["width"]), int(st["height"]), fps, dur, nframes)


_TS_RE = re.compile(r"^\s*(\d+):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d+))?\s*$")


def parse_ts(text: str) -> float:
    """Parse '0:04', '1:39', '1:02:03', '1:02:03.250' or a bare '12.5' to seconds."""
    text = text.strip()
    m = _TS_RE.match(text)
    if m:
        a, b, c, frac = m.groups()
        frac = float(f"0.{frac}") if frac else 0.0
        if c is None:  # M:SS
            return int(a) * 60 + int(b) + frac
        return int(a) * 3600 + int(b) * 60 + int(c) + frac  # H:MM:SS
    return float(text)  # bare seconds


def fmt_ts(sec: float) -> str:
    """Format seconds as H:MM:SS.mmm (hours dropped when zero)."""
    if sec < 0:
        sec = 0.0
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    if h:
        return f"{h}:{m:02d}:{s:06.3f}"
    return f"{m}:{s:06.3f}"


def slug(text: str) -> str:
    """Kebab-case ASCII slug from a free-text description."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return text or "clip"
