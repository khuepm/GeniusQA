# Firebase Configuration Setup for Mobile

This guide explains how to configure Firebase for the GeniusQA mobile app (iOS and Android).

## Prerequisites

1. A Firebase project created at [Firebase Console](https://console.firebase.google.com/)
2. Firebase Authentication enabled with Email/Password and Google Sign-In providers
3. Node.js and pnpm installed
4. Expo CLI installed (`npm install -g expo-cli`)

## Android Configuration

### Step 1: Download google-services.json

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click on the Android icon or "Add app" to add an Android app
4. Register your app with package name: `com.geniusqa.mobile`
5. Download the `google-services.json` file
6. Place it in the root of the mobile package: `GeniusQA/packages/mobile/google-services.json`

### Step 2: Verify Configuration

The `google-services.json` file should contain:
- Your project ID
- Your Android API key
- OAuth client IDs
- Package name matching `com.geniusqa.mobile`

**Important**: Never commit the actual `google-services.json` file to version control. It's already in `.gitignore`.

## iOS Configuration

### Step 1: Download GoogleService-Info.plist

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click on the iOS icon or "Add app" to add an iOS app
4. Register your app with bundle ID: `com.geniusqa.mobile`
5. Download the `GoogleService-Info.plist` file
6. Place it in the root of the mobile package: `GeniusQA/packages/mobile/GoogleService-Info.plist`

### Step 2: Configure OAuth Redirect Scheme

1. Open the `GoogleService-Info.plist` file you downloaded
2. Find the `REVERSED_CLIENT_ID` value (looks like `com.googleusercontent.apps.XXXXXXXXXX`)
3. Update `app.json` with this value:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": [
              "YOUR_REVERSED_CLIENT_ID_HERE"
            ]
          }
        ]
      }
    }
  }
}
```

**Important**: Never commit the actual `GoogleService-Info.plist` file to version control. It's already in `.gitignore`.

## Google Sign-In Configuration

### Step 1: Enable Google Sign-In in Firebase

1. Go to Firebase Console > Authentication > Sign-in method
2. Enable "Google" as a sign-in provider
3. Configure the OAuth consent screen if prompted

### Step 2: Get Web Client ID

1. In Firebase Console, go to Project Settings
2. Scroll down to "Your apps" section
3. Find the Web app configuration
4. Copy the Web Client ID (looks like `XXXXXXXXXX.apps.googleusercontent.com`)
5. Update `firebase.config.ts` with this Web Client ID:

```typescript
export const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
```

## Update Firebase Configuration

Update `src/config/firebase.config.ts` with your Firebase project credentials:

```typescript
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

## Testing the Configuration

### Test on Android

```bash
cd GeniusQA/packages/mobile
pnpm dev
# Press 'a' to open on Android emulator
```

### Test on iOS

```bash
cd GeniusQA/packages/mobile
pnpm dev
# Press 'i' to open on iOS simulator
```

### Verify Authentication

1. Launch the app on your device/emulator
2. Try signing in with Google - should open Google sign-in flow
3. Try signing up with email/password
4. Try signing in with email/password
5. Verify that you can sign out

## Troubleshooting

### Android Issues

**Problem**: "google-services.json not found"
- **Solution**: Ensure the file is in `GeniusQA/packages/mobile/google-services.json`

**Problem**: "Package name mismatch"
- **Solution**: Verify package name in `google-services.json` matches `com.geniusqa.mobile`

### iOS Issues

**Problem**: "GoogleService-Info.plist not found"
- **Solution**: Ensure the file is in `GeniusQA/packages/mobile/GoogleService-Info.plist`

**Problem**: "Invalid bundle identifier"
- **Solution**: Verify bundle ID in `GoogleService-Info.plist` matches `com.geniusqa.mobile`

**Problem**: "Google Sign-In not working"
- **Solution**: Verify `REVERSED_CLIENT_ID` is correctly configured in `app.json`

### General Issues

**Problem**: "Firebase not initialized"
- **Solution**: Check that `firebase.config.ts` has correct credentials

**Problem**: "Google Sign-In fails"
- **Solution**: Verify Web Client ID is configured in `firebase.config.ts`

## Security Notes

1. **Never commit** actual Firebase configuration files to version control
2. The following files are in `.gitignore`:
   - `google-services.json`
   - `GoogleService-Info.plist`
   - `firebase.config.ts` (if it contains real credentials)
3. Use environment variables or secure secret management for production
4. Rotate API keys if accidentally exposed

## Example Files

Example configuration files are provided:
- `google-services.json.example` - Template for Android configuration
- `GoogleService-Info.plist.example` - Template for iOS configuration

Copy these files and replace the placeholder values with your actual Firebase credentials.

## Next Steps

After configuration:
1. Test authentication flows on both platforms
2. Verify session persistence works correctly
3. Test sign-out functionality
4. Proceed with implementing additional features

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Firebase](https://rnfirebase.io/)
- [Google Sign-In for React Native](https://github.com/react-native-google-signin/google-signin)
- [Expo Documentation](https://docs.expo.dev/)
