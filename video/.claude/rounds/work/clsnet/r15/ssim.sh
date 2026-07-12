#!/bin/bash
# whole-frame or crop SSIM. Usage: ssim.sh <imgA> <imgB>
ffmpeg -nostdin -loglevel error -i "$1" -i "$2" -lavfi "ssim" -f null - 2>&1 | grep -o "All:[0-9.]*" | head -1
