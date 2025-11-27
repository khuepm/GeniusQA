# Assets Directory

This directory contains app assets referenced in `app.json`.

## Required Assets

Place the following assets in this directory:

- `icon.png` - App icon (1024x1024px)
- `splash.png` - Splash screen image
- `adaptive-icon.png` - Android adaptive icon (1024x1024px)
- `favicon.png` - Web favicon (48x48px or larger)

## Asset Guidelines

### App Icon (icon.png)
- Size: 1024x1024 pixels
- Format: PNG with transparency
- Used for: iOS and Android app icons

### Splash Screen (splash.png)
- Recommended size: 2048x2048 pixels
- Format: PNG
- Background: White (#ffffff) as configured in app.json
- Used for: App launch screen

### Adaptive Icon (adaptive-icon.png)
- Size: 1024x1024 pixels
- Format: PNG with transparency
- Safe zone: Keep important content in center 66% (684x684px)
- Used for: Android adaptive icons

### Favicon (favicon.png)
- Size: 48x48 pixels or larger
- Format: PNG
- Used for: Web version favicon

## Generating Assets

You can use tools like:
- [App Icon Generator](https://appicon.co/)
- [Expo Asset Generator](https://docs.expo.dev/guides/app-icons/)
- Adobe Illustrator or Figma for custom designs

## Placeholder Assets

For development, you can use placeholder assets:
- Create simple colored squares with the app name
- Use online generators for quick placeholders
- Replace with final designs before production release
