# Mobile Package Configuration Checklist

This checklist helps you verify that all platform-specific settings are correctly configured for the GeniusQA mobile app.

## ✅ Configuration Status

### 1. Dependencies Installation

- [ ] All npm packages installed (`pnpm install` in mobile package)
- [ ] Firebase packages present:
  - [ ] `@react-native-firebase/app`
  - [ ] `@react-native-firebase/auth`
  - [ ] `@react-native-google-signin/google-signin`
  - [ ] `@react-native-async-storage/async-storage`
- [ ] Navigation packages present:
  - [ ] `@react-navigation/native`
  - [ ] `@react-navigation/stack`
  - [ ] `react-native-screens`
  - [ ] `react-native-safe-area-context`
  - [ ] `react-native-gesture-handler`

### 2. Firebase Project Setup

- [ ] Firebase project created at [Firebase Console](https://console.firebase.google.com/)
- [ ] Authentication enabled in Firebase Console
- [ ] Email/Password provider enabled
- [ ] Google Sign-In provider enabled
- [ ] OAuth consent screen configured

### 3. Android Configuration

- [ ] Android app registered in Firebase Console
- [ ] Package name set to: `com.geniusqa.mobile`
- [ ] `google-services.json` downloaded from Firebase
- [ ] `google-services.json` placed in: `GeniusQA/packages/mobile/google-services.json`
- [ ] `google-services.json` contains correct package name
- [ ] `google-services.json` added to `.gitignore`
- [ ] SHA-1 fingerprint added to Firebase (for Google Sign-In)

### 4. iOS Configuration

- [ ] iOS app registered in Firebase Console
- [ ] Bundle ID set to: `com.geniusqa.mobile`
- [ ] `GoogleService-Info.plist` downloaded from Firebase
- [ ] `GoogleService-Info.plist` placed in: `GeniusQA/packages/mobile/GoogleService-Info.plist`
- [ ] `GoogleService-Info.plist` contains correct bundle ID
- [ ] `GoogleService-Info.plist` added to `.gitignore`
- [ ] `REVERSED_CLIENT_ID` extracted from plist file

### 5. Expo Configuration (app.json)

- [ ] `app.json` file created
- [ ] iOS bundle identifier set: `com.geniusqa.mobile`
- [ ] Android package name set: `com.geniusqa.mobile`
- [ ] iOS `googleServicesFile` path configured
- [ ] Android `googleServicesFile` path configured
- [ ] iOS `CFBundleURLSchemes` configured with `REVERSED_CLIENT_ID`
- [ ] Firebase plugins added to `plugins` array

### 6. Firebase Configuration (firebase.config.ts)

- [ ] `src/config/firebase.config.ts` exists
- [ ] `apiKey` updated with real value
- [ ] `authDomain` updated with real value
- [ ] `projectId` updated with real value
- [ ] `storageBucket` updated with real value
- [ ] `messagingSenderId` updated with real value
- [ ] `appId` updated with real value
- [ ] `webClientId` updated with Web Client ID from Firebase

### 7. Google Sign-In Configuration

- [ ] Web Client ID obtained from Firebase Console
- [ ] Web Client ID added to `firebase.config.ts`
- [ ] Google Sign-In configured in `firebaseService.ts`
- [ ] OAuth redirect schemes configured in `app.json`

### 8. Build Configuration

- [ ] Expo CLI installed globally
- [ ] EAS CLI installed (if using EAS Build)
- [ ] Development build tested on Android emulator
- [ ] Development build tested on iOS simulator
- [ ] Production build configuration verified

### 9. Testing

- [ ] App launches successfully on Android
- [ ] App launches successfully on iOS
- [ ] Email sign-up flow works
- [ ] Email sign-in flow works
- [ ] Google Sign-In flow works on Android
- [ ] Google Sign-In flow works on iOS
- [ ] Sign-out functionality works
- [ ] Session persistence works (app restart)
- [ ] Error messages display correctly

### 10. Security

- [ ] Actual `google-services.json` not committed to git
- [ ] Actual `GoogleService-Info.plist` not committed to git
- [ ] `.gitignore` includes Firebase config files
- [ ] Example files provided for reference
- [ ] No API keys or secrets in version control

## 📋 Quick Start Commands

```bash
# Install dependencies
cd GeniusQA/packages/mobile
pnpm install

# Start development server
pnpm dev

# Run on Android emulator
# Press 'a' after dev server starts

# Run on iOS simulator
# Press 'i' after dev server starts

# Type check
pnpm type-check

# Lint code
pnpm lint

# Run tests
pnpm test
```

## 🔧 Configuration Files Reference

### Required Files (Not in Git)
- `google-services.json` - Android Firebase configuration
- `GoogleService-Info.plist` - iOS Firebase configuration

### Example Files (In Git)
- `google-services.json.example` - Template for Android
- `GoogleService-Info.plist.example` - Template for iOS

### Configuration Files (In Git)
- `app.json` - Expo configuration with OAuth schemes
- `src/config/firebase.config.ts` - Firebase SDK configuration
- `FIREBASE_SETUP.md` - Detailed setup instructions

## 🚨 Common Issues

### Issue: "google-services.json not found"
**Solution**: Download from Firebase Console and place in mobile package root

### Issue: "GoogleService-Info.plist not found"
**Solution**: Download from Firebase Console and place in mobile package root

### Issue: "Package name mismatch"
**Solution**: Ensure package name is `com.geniusqa.mobile` in both Firebase and app.json

### Issue: "Google Sign-In fails"
**Solution**: 
1. Verify Web Client ID in firebase.config.ts
2. Verify REVERSED_CLIENT_ID in app.json
3. Ensure SHA-1 fingerprint added to Firebase (Android)

### Issue: "Firebase not initialized"
**Solution**: Check firebase.config.ts has correct credentials

## 📚 Documentation Links

- [Firebase Setup Guide](./FIREBASE_SETUP.md)
- [React Native Firebase Docs](https://rnfirebase.io/)
- [Expo Documentation](https://docs.expo.dev/)
- [Google Sign-In Setup](https://github.com/react-native-google-signin/google-signin)

## ✨ Next Steps

After completing this checklist:
1. Test all authentication flows thoroughly
2. Verify session persistence
3. Test on physical devices (not just emulators)
4. Configure production builds
5. Set up continuous integration
6. Implement additional features

---

**Last Updated**: Task 12 Implementation
**Status**: Configuration Complete - Ready for Firebase Credentials
