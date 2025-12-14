# Tauri Environment Variables - Important Notes

## ⚠️ Critical: process.env Does NOT Work in Tauri

In Tauri applications, **`process.env` is NOT available** because the frontend code runs in a browser context, not in Node.js.

### Why?

- Tauri uses a web view (browser) to render the frontend
- The browser environment does not have access to Node.js APIs like `process.env`
- Only the Rust backend has access to system environment variables

### Solution: Use Vite's import.meta.env

Vite (our build tool) provides `import.meta.env` to access environment variables at build time.

## Environment Variable Requirements

### 1. Prefix with VITE_

All environment variables that need to be accessible in the frontend **MUST** be prefixed with `VITE_`:

```bash
# ❌ WRONG - Will NOT work in Tauri
FIREBASE_API_KEY=your-key

# ✅ CORRECT - Will work in Tauri
VITE_FIREBASE_API_KEY=your-key
```

### 2. Use import.meta.env, NOT process.env

```typescript
// ❌ WRONG - Will cause runtime error in Tauri
const apiKey = process.env.FIREBASE_API_KEY;

// ✅ CORRECT - Works in Tauri
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
```

### 3. Use Our Helper Functions

We've created helper functions in `src/utils/env.ts` that automatically handle the `VITE_` prefix:

```typescript
import { getEnvVar } from './utils/env';

// This automatically adds VITE_ prefix
const apiKey = getEnvVar('FIREBASE_API_KEY');
// Internally uses: import.meta.env.VITE_FIREBASE_API_KEY
```

## File Structure

```
packages/desktop/
├── .env                    # Your actual config (gitignored)
├── .env.example           # Template with VITE_ prefix
└── src/
    ├── utils/
    │   └── env.ts         # Helper functions for env vars
    └── config/
        └── firebase.config.ts  # Uses getEnvVar()
```

## Environment Files

### .env (Local Development)

```bash
VITE_FIREBASE_API_KEY=your-actual-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
# ... other variables with VITE_ prefix
```

### .env.example (Template)

```bash
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
# ... template values with VITE_ prefix
```

## TypeScript Support

Add type definitions for your environment variables in `src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  // ... other variables
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## Build Time vs Runtime

### Build Time (Vite)
- Environment variables are injected at **build time**
- Values are replaced in the code during bundling
- Cannot be changed after build without rebuilding

### Runtime (Tauri Backend)
- If you need runtime environment variables, use Tauri commands
- Access them in Rust backend and expose via IPC
- Example: System paths, user preferences, etc.

## Security Considerations

### ⚠️ Important Security Notes

1. **All VITE_ variables are PUBLIC**
   - They are embedded in the frontend bundle
   - Anyone can inspect them in the browser DevTools
   - Never put secrets in VITE_ variables

2. **Safe for Frontend**
   - Firebase API keys (safe - they're meant to be public)
   - Public configuration values
   - Feature flags

3. **NOT Safe for Frontend**
   - Database passwords
   - Private API keys
   - Secret tokens
   - Admin credentials

4. **For Secrets, Use Tauri Backend**
   - Store secrets in Rust backend
   - Access via Tauri commands
   - Never expose to frontend

## Common Mistakes to Avoid

### ❌ Mistake 1: Using process.env
```typescript
// This will cause: ReferenceError: process is not defined
const key = process.env.VITE_FIREBASE_API_KEY;
```

### ❌ Mistake 2: Forgetting VITE_ prefix
```typescript
// This will return undefined
const key = import.meta.env.FIREBASE_API_KEY;
```

### ❌ Mistake 3: Expecting runtime changes
```typescript
// Changing .env after build won't affect the app
// Values are baked in at build time
```

### ✅ Correct Usage
```typescript
import { getEnvVar } from './utils/env';

// Automatically handles VITE_ prefix
const apiKey = getEnvVar('FIREBASE_API_KEY');

// Or use import.meta.env directly
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
```

## Testing

### In Development
```bash
# Start dev server - reads from .env
pnpm --filter @geniusqa/desktop dev
```

### In Production Build
```bash
# Build - injects env vars from .env
pnpm --filter @geniusqa/desktop build
```

### Different Environments
```bash
# Use .env.production for production builds
# Use .env.development for development
# Vite automatically loads the right file
```

## Troubleshooting

### Problem: Environment variable is undefined

**Check:**
1. Does the variable have `VITE_` prefix in `.env`?
2. Did you restart the dev server after changing `.env`?
3. Is the variable name correct (case-sensitive)?
4. Is `.env` in the correct directory (`packages/desktop/`)?

### Problem: Changes to .env not reflected

**Solution:**
- Restart the dev server: `Ctrl+C` then `pnpm dev`
- Environment variables are loaded at startup

### Problem: Works in dev but not in production build

**Check:**
- Ensure `.env` file exists during build
- Verify `VITE_` prefix is used
- Check build logs for warnings

## References

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Tauri Environment Variables](https://tauri.app/v1/guides/building/environment-variables)
- [Firebase Web Setup](https://firebase.google.com/docs/web/setup)

## Summary

| Aspect | Node.js | Tauri (Browser) |
|--------|---------|-----------------|
| Access | `process.env.VAR` | `import.meta.env.VITE_VAR` |
| Prefix | None required | `VITE_` required |
| When loaded | Runtime | Build time |
| Can change after build | Yes | No |
| Security | Can be private | Always public |

**Remember:** In Tauri, always use `import.meta.env.VITE_*` instead of `process.env.*`
