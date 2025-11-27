# Desktop Package Configuration Checklist

Use this checklist to verify that all platform-specific settings are properly configured for the GeniusQA Desktop package.

## ✅ Task 11: Platform-Specific Settings Configuration

### 1. Dependencies ✅

- [x] `@react-native-firebase/app` - Added to package.json
- [x] `@react-native-firebase/auth` - Added to package.json
- [x] `@react-native-google-signin/google-signin` - Added to package.json
- [x] `@react-native-async-storage/async-storage` - Added to package.json
- [x] `@react-navigation/native` - Added to package.json
- [x] `@react-navigation/stack` - Added to package.json
- [x] `@tauri-apps/cli` - Added to devDependencies
- [x] `@tauri-apps/api` - Added to devDependencies

**Verification**: Run `pnpm install` from monorepo root

### 2. Tauri Configuration ✅

#### 2.1 Firebase Domain Whitelist
- [x] Created `src-tauri/tauri.conf.json`
- [x] Added `*.googleapis.com` to HTTP scope
- [x] Added `*.firebaseapp.com` to HTTP scope
- [x] Added `*.firebase.com` to HTTP scope
- [x] Added `accounts.google.com` to HTTP scope
- [x] Added `securetoken.googleapis.com` to HTTP scope
- [x] Added `identitytoolkit.googleapis.com` to HTTP scope
- [x] Added `www.googleapis.com` to HTTP scope

**Verification**: Check `src-tauri/tauri.conf.json` → `tauri.allowlist.http.scope`

#### 2.2 Content Security Policy (CSP)
- [x] Configured CSP to allow Firebase connections
- [x] Added `connect-src` directive with Firebase domains
- [x] Allowed `script-src` for Firebase SDK
- [x] Allowed `style-src` for UI components

**Verification**: Check `src-tauri/tauri.conf.json` → `tauri.security.csp`

#### 2.3 Window Configuration
- [x] Set default window size (1200x800)
- [x] Set minimum window size (800x600)
- [x] Enabled window controls (close, minimize, maximize)
- [x] Configured window title

**Verification**: Check `src-tauri/tauri.conf.json` → `tauri.windows`

#### 2.4 Protocol Handler
- [x] Enabled asset protocol
- [x] Configured asset scope for app data
- [x] Setup for OAuth redirect handling

**Verification**: Check `src-tauri/tauri.conf.json` → `tauri.allowlist.protocol`

### 3. OAuth Redirect URLs ✅

#### 3.1 Documentation Created
- [x] Created `OAUTH_SETUP.md` with detailed instructions
- [x] Documented development redirect URL: `http://localhost`
- [x] Documented production redirect URL: `tauri://localhost`
- [x] Included troubleshooting guide

**User Action Required**: 
- [ ] Add `http://localhost` to Google Cloud Console
- [ ] Add `tauri://localhost` to Google Cloud Console

**Verification**: Follow steps in `OAUTH_SETUP.md`

### 4. Firebase Configuration ✅

#### 4.1 Config File
- [x] Firebase config file exists at `src/config/firebase.config.ts`
- [x] Added desktop-specific setup documentation
- [x] Documented OAuth redirect URL requirements
- [x] Documented Tauri security configuration
- [x] Added testing instructions

**User Action Required**:
- [ ] Replace placeholder values with actual Firebase credentials
- [ ] Add Web Client ID from Google Cloud Console

**Verification**: Check `src/config/firebase.config.ts` for placeholder values

### 5. Rust/Tauri Backend ✅

- [x] Created `src-tauri/Cargo.toml` with dependencies
- [x] Created `src-tauri/src/main.rs` with Tauri setup
- [x] Created `src-tauri/build.rs` for build configuration
- [x] Added `.gitignore` for Rust build artifacts

**User Action Required**:
- [ ] Install Rust from https://rustup.rs/

**Verification**: Run `rustc --version` to check Rust installation

### 6. Application Icons ✅

- [x] Created `src-tauri/icons/` directory
- [x] Added README with icon requirements
- [x] Documented icon generation process

**User Action Required**:
- [ ] Generate icons using `pnpm tauri icon <source-image>`
- [ ] Or manually add required icon files

**Verification**: Check `src-tauri/icons/` for required files:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

### 7. Build Configuration Testing ✅

#### 7.1 Validation Script
- [x] Created `scripts/validate-config.js`
- [x] Added validation for Firebase config
- [x] Added validation for Tauri config
- [x] Added validation for Rust installation
- [x] Added validation for dependencies
- [x] Added validation for icons
- [x] Added `validate` script to package.json

**Verification**: Run `pnpm --filter @geniusqa/desktop validate`

#### 7.2 Package Scripts
- [x] Added `tauri` script for CLI access
- [x] Added `tauri:info` script for system info
- [x] Added `validate` script for config validation

**Verification**: Check `package.json` scripts section

### 8. Documentation ✅

- [x] Created `SETUP.md` - Comprehensive setup guide
- [x] Created `OAUTH_SETUP.md` - OAuth configuration guide
- [x] Created `CONFIGURATION_CHECKLIST.md` - This checklist
- [x] Updated `README.md` with setup references
- [x] Added troubleshooting sections
- [x] Documented all prerequisites

**Verification**: Review documentation files for completeness

## Testing Checklist

### Development Testing

- [ ] Run `pnpm install` from monorepo root
- [ ] Run `pnpm --filter @geniusqa/desktop validate`
- [ ] Fix any errors reported by validation script
- [ ] Run `pnpm --filter @geniusqa/desktop tauri:info`
- [ ] Verify Rust and system dependencies
- [ ] Run `pnpm --filter @geniusqa/desktop dev`
- [ ] Test Google OAuth sign-in
- [ ] Test email/password authentication
- [ ] Test session persistence
- [ ] Test sign-out functionality

### Production Build Testing

- [ ] Run `pnpm --filter @geniusqa/desktop build`
- [ ] Verify build completes without errors
- [ ] Check `src-tauri/target/release/bundle/` for installers
- [ ] Install the built application
- [ ] Test OAuth with `tauri://localhost` redirect
- [ ] Test all authentication flows in production build
- [ ] Verify window controls work correctly
- [ ] Test on both macOS and Windows (if applicable)

## Requirements Coverage

This task addresses the following requirements from the spec:

- **Requirement 1.1**: Google OAuth authentication support
  - ✅ Tauri configured to allow Firebase/Google domains
  - ✅ OAuth redirect URLs documented
  - ✅ HTTP scope includes all necessary endpoints

- **Requirement 2.2**: Email/password authentication
  - ✅ Firebase config setup for email auth
  - ✅ Tauri allows Firebase Authentication API calls

- **Requirement 5.2**: Session persistence
  - ✅ AsyncStorage dependency included
  - ✅ Tauri protocol allows local data storage
  - ✅ Asset scope configured for app data

## Next Steps

After completing this checklist:

1. **Configure Firebase**:
   - Update `src/config/firebase.config.ts` with real credentials
   - Follow `SETUP.md` for detailed instructions

2. **Setup OAuth**:
   - Add redirect URLs to Google Cloud Console
   - Follow `OAUTH_SETUP.md` for step-by-step guide

3. **Generate Icons**:
   - Create or obtain a 1024x1024 source image
   - Run `pnpm tauri icon <source-image>`

4. **Test Configuration**:
   - Run validation script
   - Test development build
   - Test production build

5. **Deploy**:
   - Build for target platforms
   - Distribute installers
   - Monitor authentication logs

## Support Resources

- **Setup Guide**: [SETUP.md](./SETUP.md)
- **OAuth Guide**: [OAUTH_SETUP.md](./OAUTH_SETUP.md)
- **Main README**: [README.md](./README.md)
- **Tauri Docs**: https://tauri.app/v1/guides/
- **Firebase Docs**: https://firebase.google.com/docs/auth

## Status Summary

✅ **COMPLETED**: All configuration files and documentation created
⚠️ **USER ACTION REQUIRED**: 
- Install Rust
- Configure Firebase credentials
- Setup OAuth redirect URLs
- Generate application icons

The desktop package is now fully configured for Firebase Authentication with proper Tauri security settings, OAuth support, and comprehensive documentation.
