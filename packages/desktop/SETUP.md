# GeniusQA Desktop - Setup Guide

This guide will help you configure the desktop application for Firebase Authentication with Google OAuth.

## Prerequisites

1. **Rust**: Tauri requires Rust to be installed
   - Install from: https://rustup.rs/
   - Verify: `rustc --version`

2. **Node.js & pnpm**: Already configured in the monorepo
   - Verify: `pnpm --version`

3. **Firebase Project**: You need a Firebase project with Authentication enabled
   - Create at: https://console.firebase.google.com/

## Step 1: Firebase Configuration

### 1.1 Get Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (gear icon)
4. Scroll to "Your apps" section
5. Click "Add app" and select Web (</>) if you haven't already
6. Copy the configuration values

### 1.2 Update firebase.config.ts

Edit `src/config/firebase.config.ts` and replace the placeholder values:

```typescript
const firebaseConfig: FirebaseConfig = {
  apiKey: 'YOUR_ACTUAL_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
};
```

## Step 2: Google OAuth Setup

### 2.1 Enable Google Sign-In in Firebase

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Click on **Google** provider
3. Enable it and save

### 2.2 Configure OAuth Redirect URLs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** > **Credentials**
4. Find your **Web Client** (created by Firebase)
5. Add **Authorized redirect URIs**:
   - `http://localhost` (for development)
   - `tauri://localhost` (for production builds)
   - Your custom domain if applicable

### 2.3 Get Web Client ID

1. In the same Credentials page, copy the **Client ID** from your Web Client
2. This is your `webClientId` in firebase.config.ts
3. **Important**: Use the Web Client ID, not Android or iOS client IDs

## Step 3: Tauri Configuration

The Tauri configuration is already set up in `src-tauri/tauri.conf.json` with:

### 3.1 Firebase Domain Whitelist

The following domains are whitelisted for HTTP requests:
- `*.googleapis.com`
- `*.firebaseapp.com`
- `*.firebase.com`
- `accounts.google.com`
- `securetoken.googleapis.com`
- `identitytoolkit.googleapis.com`

### 3.2 Content Security Policy (CSP)

The CSP allows connections to Firebase services while maintaining security.

### 3.3 OAuth Protocol Handler

The Tauri configuration supports custom protocol handlers for OAuth redirects.

## Step 4: Application Icons

### 4.1 Generate Icons

Create application icons for different platforms:

```bash
# From the desktop package directory
pnpm tauri icon path/to/your/icon.png
```

The source image should be at least 1024x1024 pixels.

### 4.2 Manual Icon Setup

If you prefer manual setup, place the following files in `src-tauri/icons/`:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

## Step 5: Install Dependencies

From the monorepo root:

```bash
pnpm install
```

This will install all dependencies including Tauri CLI tools.

## Step 6: Development Testing

### 6.1 Start Development Server

```bash
pnpm --filter @geniusqa/desktop dev
```

This will:
1. Start the React Native bundler
2. Launch the Tauri development window
3. Enable hot reload for quick iteration

### 6.2 Test Authentication Flow

1. Click "Sign in with Google" button
2. Complete the Google OAuth flow in the browser
3. Verify successful login and navigation to dashboard
4. Test email/password authentication
5. Test logout functionality

### 6.3 Common Development Issues

**Issue**: "Failed to fetch" errors
- **Solution**: Check that Firebase domains are in the HTTP scope in `tauri.conf.json`

**Issue**: OAuth redirect fails
- **Solution**: Verify redirect URIs in Google Cloud Console include `http://localhost`

**Issue**: Rust compilation errors
- **Solution**: Ensure Rust is installed and up to date: `rustup update`

## Step 7: Production Build

### 7.1 Build for Production

```bash
pnpm --filter @geniusqa/desktop build
```

This creates platform-specific installers in `src-tauri/target/release/bundle/`.

### 7.2 Platform-Specific Builds

**macOS**:
- Produces `.app` bundle and `.dmg` installer
- Located in `src-tauri/target/release/bundle/macos/`

**Windows**:
- Produces `.exe` installer and `.msi` package
- Located in `src-tauri/target/release/bundle/windows/`

### 7.3 Production OAuth Configuration

For production builds, ensure:
1. OAuth redirect URI `tauri://localhost` is added in Google Cloud Console
2. Firebase config uses production values (not development placeholders)
3. Application is code-signed (optional but recommended)

## Step 8: Troubleshooting

### Check Tauri Configuration

```bash
pnpm tauri info
```

This displays your Tauri setup and identifies any missing dependencies.

### Enable Debug Logging

In development, open the DevTools:
- macOS: `Cmd + Option + I`
- Windows: `Ctrl + Shift + I`

Check console for Firebase authentication errors.

### Verify Firebase Connection

Test Firebase initialization by checking the console logs when the app starts.

## Security Considerations

1. **Never commit** `firebase.config.ts` with real credentials to public repositories
2. Use environment variables for sensitive configuration in production
3. Keep Tauri and dependencies updated for security patches
4. Review and minimize the Tauri allowlist permissions as needed

## Additional Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [React Native Firebase](https://rnfirebase.io/)
- [Google Sign-In Setup](https://developers.google.com/identity/sign-in/web/sign-in)

## Support

For issues specific to GeniusQA Desktop, please check:
1. This setup guide
2. The main project README
3. Firebase Console for authentication logs
4. Tauri DevTools console for runtime errors
