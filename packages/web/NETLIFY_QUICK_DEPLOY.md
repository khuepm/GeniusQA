# 🚀 Quick Netlify Deployment - GeniusQA Web

## 5-Minute Deployment Guide

### Prerequisites ✓
- [x] pnpm monorepo structure verified
- [x] Build successful (687 kB bundle)
- [x] Type checking passed
- [x] Environment variables ready

---

## Deploy Now (CLI Method)

### 1. Install Tools
```bash
npm install -g pnpm netlify-cli
```

### 2. Login
```bash
netlify login
```

### 3. Deploy from Root Directory
```bash
# Navigate to project root
cd /path/to/geniusqa

# Deploy
cd packages/web
pnpm run deploy:netlify
```

### 4. Set Environment Variables
```bash
netlify env:set VITE_FIREBASE_API_KEY "AIzaSyD5mPJ5EcoP_L3VkRtxXQtnLai-Di5s1IE"
netlify env:set VITE_FIREBASE_AUTH_DOMAIN "geniusqa.firebaseapp.com"
netlify env:set VITE_FIREBASE_PROJECT_ID "geniusqa"
netlify env:set VITE_FIREBASE_STORAGE_BUCKET "geniusqa.firebasestorage.app"
netlify env:set VITE_FIREBASE_MESSAGING_SENDER_ID "132942345198"
netlify env:set VITE_FIREBASE_APP_ID "1:132942345198:web:51aa776f1e4722090a14ff"
netlify env:set VITE_FIREBASE_MEASUREMENT_ID "G-05TPBE0ER3"
netlify env:set VITE_FIREBASE_WEB_CLIENT_ID "891628380323-hkbo3tcn43iklrdch7k4rv4o7ovnkbl0.apps.googleusercontent.com"
```

### 5. Verify
```bash
netlify open:site
```

---

## Deploy via GitHub (CI/CD Method)

### 1. Push to GitHub
```bash
git push origin main
```

### 2. Connect on Netlify
1. Go to https://app.netlify.com
2. **Add new site** > **Import from Git**
3. Select repository

### 3. Build Settings
```
Base directory: /
Build command: cd packages/web && pnpm install && pnpm run build
Publish directory: packages/web/dist
```

### 4. Add Environment Variables
In Netlify dashboard > **Site settings** > **Environment variables**

Add all 8 variables from CLI method above.

### 5. Deploy
Click **Deploy site**

---

## Verification Checklist

After deployment, test:

- [ ] Landing page loads: `https://YOUR-SITE.netlify.app`
- [ ] Login page: `https://YOUR-SITE.netlify.app/login`
- [ ] Register page: `https://YOUR-SITE.netlify.app/register`
- [ ] Dashboard (after login): `https://YOUR-SITE.netlify.app/dashboard`
- [ ] Projects: `https://YOUR-SITE.netlify.app/projects`
- [ ] Can login with email/password
- [ ] Can register new account
- [ ] No console errors

---

## Important Files

All configured and ready:

- ✅ `netlify.toml` - Configured for pnpm monorepo
- ✅ `.env.production` - Firebase credentials set
- ✅ `package.json` - Deploy scripts ready
- ✅ `vite.config.ts` - Build configuration OK

---

## Need Help?

See full guide: `NETLIFY_DEPLOYMENT_GUIDE.md`

## Deployment Time

- **Build Time:** ~7 seconds
- **Upload Time:** ~10 seconds
- **Total:** < 1 minute

🎉 You're ready to deploy!
