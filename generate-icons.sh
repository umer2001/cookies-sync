#!/bin/bash
# Simple script to generate placeholder icons using ImageMagick
# Usage: ./generate-icons.sh

if command -v convert &> /dev/null; then
    echo "Generating icons with ImageMagick..."
    for size in 16 32 48 128; do
        convert -size ${size}x${size} xc:#4a90e2 -pointsize $((size/2)) -fill white -gravity center -annotate +0+0 "🍪" icons/icon${size}.png
        echo "Created icon${size}.png"
    done
    echo "All icons generated successfully!"
elif command -v magick &> /dev/null; then
    echo "Generating icons with ImageMagick (magick command)..."
    for size in 16 32 48 128; do
        magick -size ${size}x${size} xc:#4a90e2 -pointsize $((size/2)) -fill white -gravity center -annotate +0+0 "🍪" icons/icon${size}.png
        echo "Created icon${size}.png"
    done
    echo "All icons generated successfully!"
else
    echo "ImageMagick not found. Please install it or create icons manually."
    echo "See icons/README.md for instructions."
    exit 1
fi

