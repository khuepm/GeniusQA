# Application Icons

This directory should contain the application icons for different platforms:

- `32x32.png` - 32x32 pixel PNG icon
- `128x128.png` - 128x128 pixel PNG icon
- `128x128@2x.png` - 256x256 pixel PNG icon (2x retina)
- `icon.icns` - macOS icon file
- `icon.ico` - Windows icon file

## Generating Icons

You can use the Tauri icon generator to create all required icon formats from a single source image:

```bash
pnpm tauri icon path/to/your/icon.png
```

The source image should be at least 1024x1024 pixels for best results.

## Temporary Setup

For development purposes, you can use placeholder icons or copy icons from the Tauri default template.
