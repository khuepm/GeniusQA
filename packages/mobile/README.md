# GeniusQA Mobile Application

React Native mobile app for remote control, notifications, and agent management with Firebase authentication.

## Features

- **User Authentication**: Google OAuth and Email/Password sign-in via Firebase
- **Session Persistence**: Automatic login on app restart
- **Remote Control**: Control desktop app remotely
- **Real-time Notifications**: Push notifications and alerts
- **Agent Management**: Monitor and manage automation agents
- **Account Management**: User profile and API key management
- **Cloud Integration**: Seamless cloud service integration

## Prerequisites

- Node.js 18+ and pnpm
- Expo CLI (`npm install -g expo-cli`)
- Firebase project with Authentication enabled
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

## Firebase Configuration

Before running the app, you need to configure Firebase:

1. **Read the Setup Guide**: See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed instructions
2. **Download Configuration Files**:
   - `google-services.json` for Android
   - `GoogleService-Info.plist` for iOS
3. **Update Configuration**: Edit `src/config/firebase.config.ts` with your Firebase credentials
4. **Configure OAuth**: Update `app.json` with your OAuth redirect schemes

### Quick Configuration Steps

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication with Email/Password and Google Sign-In
3. Download `google-services.json` and place in package root
4. Download `GoogleService-Info.plist` and place in package root
5. Update `src/config/firebase.config.ts` with your credentials
6. Update `app.json` with your `REVERSED_CLIENT_ID`

See [CONFIGURATION_CHECKLIST.md](./CONFIGURATION_CHECKLIST.md) for a complete checklist.

## Getting Started

```bash
# Install dependencies
cd packages/mobile
pnpm install

# Start development server
pnpm dev

# Run on Android (press 'a' after dev server starts)
# Run on iOS (press 'i' after dev server starts)
```

## Available Scripts

```bash
pnpm dev          # Start Expo development server
pnpm build        # Build the app
pnpm test         # Run tests
pnpm lint         # Lint code
pnpm type-check   # TypeScript type checking
```

## Project Structure

```
mobile/
├── src/
│   ├── screens/          # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   └── DashboardScreen.tsx
│   ├── components/       # Reusable UI components
│   │   ├── AuthButton.tsx
│   │   ├── AuthInput.tsx
│   │   └── LoadingSpinner.tsx
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── services/         # Business logic and API calls
│   │   └── firebaseService.ts
│   ├── navigation/       # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── types/           # TypeScript type definitions
│   │   └── auth.types.ts
│   └── config/          # Configuration files
│       └── firebase.config.ts
├── app.json             # Expo configuration
├── package.json         # Dependencies and scripts
└── FIREBASE_SETUP.md    # Firebase setup guide
```

## Authentication Features

- **Google Sign-In**: One-tap authentication with Google account
- **Email/Password**: Traditional email and password authentication
- **Registration**: New user sign-up with email verification
- **Session Management**: Automatic session persistence and restoration
- **Secure Sign-Out**: Complete session cleanup on logout

## Development

### Running on Android

1. Start an Android emulator or connect a physical device
2. Run `pnpm dev`
3. Press `a` to open on Android

### Running on iOS

1. Start an iOS simulator (macOS only)
2. Run `pnpm dev`
3. Press `i` to open on iOS

### Testing Authentication

1. Launch the app
2. Try Google Sign-In (requires proper OAuth configuration)
3. Try Email/Password sign-up
4. Try Email/Password sign-in
5. Verify session persistence by restarting the app
6. Test sign-out functionality

## Building for Production

### Android

```bash
# Using EAS Build
eas build --platform android

# Or using Expo build
expo build:android
```

### iOS

```bash
# Using EAS Build
eas build --platform ios

# Or using Expo build
expo build:ios
```

## Troubleshooting

### Common Issues

**Firebase not initialized**
- Check `firebase.config.ts` has correct credentials
- Verify Firebase project is active

**Google Sign-In fails**
- Verify Web Client ID in `firebase.config.ts`
- Check `REVERSED_CLIENT_ID` in `app.json`
- Ensure SHA-1 fingerprint added to Firebase (Android)

**Build errors**
- Run `pnpm install` to ensure all dependencies are installed
- Clear cache: `expo start -c`
- Check that Firebase config files are present

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for more troubleshooting tips.

## Documentation

- [Firebase Setup Guide](./FIREBASE_SETUP.md) - Complete Firebase configuration instructions
- [Configuration Checklist](./CONFIGURATION_CHECKLIST.md) - Verify all settings are correct
- [React Native Firebase](https://rnfirebase.io/) - Official documentation
- [Expo Documentation](https://docs.expo.dev/) - Expo framework docs

## Security

- Never commit `google-services.json` or `GoogleService-Info.plist` to version control
- Use environment variables for sensitive configuration in production
- Keep Firebase API keys secure
- Rotate credentials if accidentally exposed

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Write tests for new features
4. Update documentation as needed
5. Follow the project's ESLint and Prettier configuration

## License

See the root LICENSE file for details.
