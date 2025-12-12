# OAuth Redirect URLs Setup for Desktop

This guide explains how to configure OAuth redirect URLs for the GeniusQA Desktop application.

## Why Redirect URLs Matter

When users sign in with Google OAuth, Google needs to know where to redirect them after authentication. For desktop applications using Tauri, we need to configure specific redirect URLs.

## Required Redirect URLs

Add these redirect URLs to your Google Cloud Console OAuth configuration:

### Development
```
http://localhost
```
This is used during development when running `pnpm dev`.

### Production
```
tauri://localhost
```
This is used in production builds. Tauri uses a custom protocol handler.

### Optional (if using custom domain)
```
https://yourdomain.com/auth/callback
```
If you plan to use a web-based OAuth flow with a custom domain.

## Step-by-Step Configuration

### 1. Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project from the dropdown
3. Navigate to **APIs & Services** > **Credentials**

### 2. Find Your OAuth Client

1. Look for the **Web client** (auto created by Google Service)
2. This should have a name like "Web client (auto created by Google Service)"
3. Click on it to edit

### 3. Add Authorized Redirect URIs

1. Scroll to **Authorized redirect URIs** section
2. Click **+ ADD URI**
3. Add each of the following:
   - `http://localhost`
   - `tauri://localhost`
4. Click **SAVE**

### 4. Verify Configuration

After saving, you should see both URIs listed:

```
Authorized redirect URIs
• http://localhost
• tauri://localhost
```

## Testing

### Test Development Flow

1. Run the app: `pnpm --filter @geniusqa/desktop dev`
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Verify successful redirect back to app

### Test Production Build

1. Build the app: `pnpm --filter @geniusqa/desktop build`
2. Install and run the built application
3. Test Google sign-in
4. Verify OAuth redirect works with `tauri://localhost`

## Common Issues

### Issue: "redirect_uri_mismatch" Error

**Cause**: The redirect URI used by the app doesn't match any configured in Google Cloud Console.

**Solution**:
1. Check the error message for the exact redirect URI being used
2. Add that exact URI to Google Cloud Console
3. Wait a few minutes for changes to propagate
4. Try again

### Issue: OAuth Popup Closes Immediately

**Cause**: Tauri security settings may be blocking the OAuth flow.

**Solution**:
1. Verify `tauri.conf.json` includes Firebase domains in HTTP scope
2. Check CSP policy allows connections to Google domains
3. Review browser console for security errors

### Issue: Works in Dev but Not in Production

**Cause**: Production builds use `tauri://localhost` instead of `http://localhost`.

**Solution**:
1. Ensure `tauri://localhost` is added to authorized redirect URIs
2. Rebuild the application after configuration changes
3. Clear any cached OAuth tokens

## Security Considerations

### Redirect URI Validation

- Google validates redirect URIs to prevent OAuth hijacking
- Only add redirect URIs you control
- Use HTTPS for web-based redirects (except localhost)

### Custom Protocol Security

- `tauri://localhost` is a custom protocol handler
- Tauri ensures only your app can handle this protocol
- This prevents other apps from intercepting OAuth tokens

### Best Practices

1. **Minimize Redirect URIs**: Only add URIs you actually use
2. **Use Specific Paths**: Instead of `http://localhost`, use `http://localhost/auth/callback` if possible
3. **Monitor Usage**: Check Google Cloud Console for OAuth usage and errors
4. **Rotate Secrets**: Periodically rotate OAuth client secrets (if using confidential clients)

## Platform-Specific Notes

### macOS

- Custom protocol handlers are registered automatically by Tauri
- No additional configuration needed
- Works with both development and production builds

### Windows

- Custom protocol handlers are registered during installation
- May require administrator privileges for first-time setup
- Antivirus software may flag custom protocol registration

## Debugging OAuth Flow

### Enable Verbose Logging

In your Firebase service, add logging:

```typescript
console.log('Starting OAuth flow...');
console.log('Redirect URI:', redirectUri);
```

### Check Tauri Logs

Development mode shows Tauri logs in the terminal. Look for:
- HTTP request logs
- Protocol handler registrations
- Security policy violations

### Use Browser DevTools

Open DevTools in the Tauri window:
- macOS: `Cmd + Option + I`
- Windows: `Ctrl + Shift + I`

Check:
- Console for JavaScript errors
- Network tab for failed requests
- Application tab for stored tokens

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Tauri Custom Protocol Guide](https://tauri.app/v1/guides/building/custom-protocol)
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth/web/google-signin)

## Support

If you encounter issues:
1. Check this guide first
2. Review the main [SETUP.md](./SETUP.md)
3. Check Firebase Console authentication logs
4. Review Tauri DevTools console
