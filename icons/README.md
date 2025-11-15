# Extension Icons

This directory should contain the following icon files:

- `icon16.png` - 16x16 pixels
- `icon32.png` - 32x32 pixels  
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

## Creating Icons

You can create these icons using:

1. **Online Tools:**
   - [Favicon Generator](https://www.favicon-generator.org/)
   - [RealFaviconGenerator](https://realfavicongenerator.net/)
   - [Favicon.io](https://favicon.io/)

2. **Design Tools:**
   - Figma
   - Canva
   - GIMP
   - Photoshop

3. **Icon Suggestions:**
   - Cookie emoji (🍪) on a blue/teal background
   - Sync/cloud icon with cookie theme
   - Simple geometric design representing sync

## Temporary Placeholder

For development, you can use simple colored square placeholders. The extension will work without icons, but they are recommended for a polished user experience.

To create quick placeholders, you can use ImageMagick:
```bash
for size in 16 32 48 128; do
  convert -size ${size}x${size} xc:#4a90e2 icons/icon${size}.png
done
```

Or use any image editor to create simple colored squares.
