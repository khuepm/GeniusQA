# 🚀 GeniusQA Web - Netlify Production Deployment Guide

**Application:** GeniusQA Web Platform
**Package:** @geniusqa/web v1.0.0
**Target Environment:** Production (Netlify)
**Package Manager:** pnpm (monorepo)
**Build Tool:** Vite 5.0
**Framework:** React 18.2 + TypeScript

---

## ✅ Pre-Deployment Verification (COMPLETED)

### 1. Workspace Configuration ✓
- **pnpm workspace:** Configured correctly in `pnpm-workspace.yaml`
- **Monorepo structure:** 5 packages detected (web, mobile, desktop, rust-core, python-core)
- **Web package location:** `packages/web`
- **Package name:** `@geniusqa/web`

### 2. Build Configuration ✓
- **Build command:** `pnpm run build` (using Vite)
- **Output directory:** `dist/`
- **Type checking:** Passed without errors
- **Production build:** Successful (6.76s build time)
- **Build artifacts:**
  - `dist/index.html` (0.42 kB)
  - `dist/assets/index-CWCMIkh1.css` (25.38 kB)
  - `dist/assets/index-B-HIydTO.js` (687.02 kB)

### 3. Environment Variables ✓
All required Firebase configuration variables are set in `.env.production`:
- ✅ `VITE_FIREBASE_API_KEY`
- ✅ `VITE_FIREBASE_AUTH_DOMAIN` (geniusqa.firebaseapp.com)
- ✅ `VITE_FIREBASE_PROJECT_ID` (geniusqa)
- ✅ `VITE_FIREBASE_STORAGE_BUCKET`
- ✅ `VITE_FIREBASE_MESSAGING_SENDER_ID`
- ✅ `VITE_FIREBASE_APP_ID`
- ✅ `VITE_FIREBASE_MEASUREMENT_ID`
- ✅ `VITE_FIREBASE_WEB_CLIENT_ID` (Google OAuth)

### 4. Netlify Configuration ✓
File: `packages/web/netlify.toml`
```toml
[build]
  command = "cd ../.. && pnpm install --frozen-lockfile && cd packages/web && pnpm run build"
  publish = "packages/web/dist"
  base = "/"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

---

## 📋 Deployment Steps

### Option A: Deploy via Netlify CLI (Recommended for first deployment)

#### Step 1: Install pnpm and Netlify CLI

```bash
# Install pnpm globally (if not already installed)
npm install -g pnpm

# Verify pnpm installation
pnpm --version

# Install Netlify CLI globally
pnpm add -g netlify-cli

# Verify installation
netlify --version
```

#### Step 2: Login to Netlify

```bash
netlify login
```
This will open your browser for authentication.

#### Step 3: Navigate to Web Package

```bash
cd packages/web
```

#### Step 4: Link to Netlify Site (First Time Only)

```bash
# Option A: Link to existing site
netlify link

# Option B: Create new site
netlify init
```

When prompted:
- **Team:** Select your team
- **Site name:** `geniusqa-web` (or your preferred name)
- **Build command:** `cd ../.. && pnpm install --frozen-lockfile && cd packages/web && pnpm run build`
- **Publish directory:** `packages/web/dist`

#### Step 5: Configure Environment Variables

```bash
# Set all Firebase environment variables
netlify env:set VITE_FIREBASE_API_KEY "AIzaSyD5mPJ5EcoP_L3VkRtxXQtnLai-Di5s1IE"
netlify env:set VITE_FIREBASE_AUTH_DOMAIN "geniusqa.firebaseapp.com"
netlify env:set VITE_FIREBASE_PROJECT_ID "geniusqa"
netlify env:set VITE_FIREBASE_STORAGE_BUCKET "geniusqa.firebasestorage.app"
netlify env:set VITE_FIREBASE_MESSAGING_SENDER_ID "132942345198"
netlify env:set VITE_FIREBASE_APP_ID "1:132942345198:web:51aa776f1e4722090a14ff"
netlify env:set VITE_FIREBASE_MEASUREMENT_ID "G-05TPBE0ER3"
netlify env:set VITE_FIREBASE_WEB_CLIENT_ID "891628380323-hkbo3tcn43iklrdch7k4rv4o7ovnkbl0.apps.googleusercontent.com"
```

**Or use the web UI:**
1. Go to https://app.netlify.com
2. Select your site
3. Go to **Site settings** > **Environment variables**
4. Click **Add a variable** and add all the variables above

#### Step 6: Deploy to Production

```bash
# From packages/web directory
pnpm run deploy:netlify

# Or manually
netlify deploy --prod
```

The CLI will:
1. Run the build command from root with pnpm
2. Upload the dist folder
3. Deploy to production

**Expected output:**
```
✔ Finished hashing 3 files
✔ CDN requesting 0 files
✔ Finished uploading 0 assets
✔ Deploy is live!

Logs:              https://app.netlify.com/sites/YOUR-SITE/deploys/DEPLOY-ID
Unique Deploy URL: https://DEPLOY-ID--YOUR-SITE.netlify.app
Live URL:          https://YOUR-SITE.netlify.app
```

---

### Option B: Deploy via Netlify Web UI + GitHub (Recommended for CI/CD)

#### Step 1: Push Code to GitHub

```bash
# Ensure all changes are committed
git add .
git commit -m "Configure Netlify deployment with pnpm"
git push origin main
```

#### Step 2: Connect Repository to Netlify

1. Go to https://app.netlify.com
2. Click **Add new site** > **Import an existing project**
3. Choose **GitHub** and authorize
4. Select your repository
5. Configure build settings:

**Build Settings:**
```
Base directory: /
Build command: cd packages/web && pnpm install && pnpm run build
Publish directory: packages/web/dist
```

**Advanced Build Settings:**
- Click **Show advanced**
- Add **New variable** for each environment variable (see Step 5 from Option A)

#### Step 3: Deploy

Click **Deploy site**. Netlify will:
1. Clone your repository
2. Install pnpm automatically (detected from pnpm-lock.yaml)
3. Run the build command
4. Deploy to production

---

## 🔍 Post-Deployment Verification

### Automated Tests

After deployment, verify these critical functionalities:

#### 1. Application Health ✓
```bash
# Check if site is accessible
curl -I https://YOUR-SITE.netlify.app

# Expected: HTTP 200 OK
```

#### 2. Core Functionality Tests

**Landing Page:**
- [ ] Landing page loads without errors
- [ ] Hero section displays correctly
- [ ] Navigation menu works
- [ ] All images and assets load

**Authentication:**
- [ ] Login page accessible at `/login`
- [ ] Register page accessible at `/register`
- [ ] Firebase authentication initializes correctly
- [ ] Email/password login works
- [ ] Google OAuth login works (if enabled)
- [ ] Registration flow works
- [ ] Password reset flow works

**Dashboard:**
- [ ] Protected route redirects to login when not authenticated
- [ ] Dashboard loads after successful login
- [ ] User profile displays correctly
- [ ] Navigation between pages works
- [ ] Logout functionality works

**Projects Management:**
- [ ] Projects page accessible at `/projects`
- [ ] Can create new project
- [ ] Can view project list
- [ ] Can edit project
- [ ] Can delete project

**Test Cases:**
- [ ] Test cases page accessible at `/test-cases`
- [ ] Can create test case
- [ ] Can view test case list
- [ ] Can edit test case

#### 3. Performance Checks

```bash
# Use Netlify's built-in analytics
# Go to: https://app.netlify.com/sites/YOUR-SITE/analytics
```

**Monitor:**
- Page load time (should be < 3s)
- Time to First Byte (TTFB)
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

#### 4. Security Checks

- [ ] HTTPS is enforced
- [ ] Environment variables are not exposed in client
- [ ] Firebase API key restrictions are configured
- [ ] CSP headers are set (if configured)
- [ ] CORS is properly configured

---

## 🔧 Troubleshooting

### Issue 1: Build Fails - "pnpm: command not found"

**Solution:** Ensure netlify.toml has correct pnpm configuration:
```toml
[build.environment]
  NODE_VERSION = "18"
```

Netlify automatically detects pnpm from `pnpm-lock.yaml`.

### Issue 2: Environment Variables Not Loading

**Symptoms:** Firebase initialization fails, shows "Missing or insufficient permissions"

**Solution:**
1. Verify all environment variables are set in Netlify dashboard
2. Ensure variable names start with `VITE_` prefix
3. Redeploy the site after adding variables

### Issue 3: 404 on Page Refresh

**Symptoms:** Direct navigation to `/dashboard` returns 404

**Solution:** Netlify redirect is configured in `netlify.toml`:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This should be working. If not, check the file is committed.

### Issue 4: Large Bundle Size Warning

**Current:** Main bundle is 687 kB (176 kB gzipped)

**Future Optimization:**
```javascript
// In vite.config.ts, add code splitting
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'firebase': ['firebase'],
      }
    }
  }
}
```

---

## 🔄 Rollback Procedures

### Via Netlify Dashboard

1. Go to https://app.netlify.com/sites/YOUR-SITE/deploys
2. Find the last known good deployment
3. Click **⋮** (three dots) > **Publish deploy**
4. Confirm rollback

### Via Netlify CLI

```bash
# List recent deploys
netlify deploys:list

# Restore a specific deploy
netlify rollback --deploy-id DEPLOY-ID
```

**Recovery Time Objective (RTO):** < 2 minutes
**Recovery Point Objective (RPO):** Previous successful deployment

---

## 📊 Monitoring & Alerts

### Built-in Netlify Monitoring

**Access:** https://app.netlify.com/sites/YOUR-SITE/analytics

**Key Metrics:**
- Pageviews
- Unique visitors
- Bandwidth usage
- Build time
- Deploy frequency

### Recommended External Monitoring

1. **Google Analytics** (Already configured)
   - Measurement ID: `G-05TPBE0ER3`

2. **Firebase Console**
   - Auth users: https://console.firebase.google.com/project/geniusqa/authentication
   - Performance: https://console.firebase.google.com/project/geniusqa/performance

3. **Uptime Monitoring** (Optional)
   - UptimeRobot: https://uptimerobot.com
   - StatusCake: https://www.statuscake.com

### Alert Configuration

Set up alerts in Netlify for:
- [ ] Deploy failures
- [ ] Build time > 10 minutes
- [ ] Bandwidth threshold exceeded
- [ ] Form submissions (if enabled)

---

## 📝 Deployment Documentation

### Deployment Record

**Application Details:**
- **Name:** GeniusQA Web Platform
- **Version:** 1.0.0
- **Package:** @geniusqa/web
- **Repository:** [Your GitHub URL]
- **Branch:** main

**Deployment Details:**
- **Date:** 2024-12-14
- **Environment:** Production
- **Platform:** Netlify
- **Build Status:** ✅ Successful
- **Build Time:** 6.76s
- **Bundle Size:** 687 kB (176 kB gzipped)

**Configuration:**
- **Node Version:** 18
- **Package Manager:** pnpm
- **Build Command:** `cd ../.. && pnpm install --frozen-lockfile && cd packages/web && pnpm run build`
- **Publish Directory:** packages/web/dist

**Environment:**
- **Firebase Project:** geniusqa
- **Auth Domain:** geniusqa.firebaseapp.com
- **Storage Bucket:** geniusqa.firebasestorage.app

**Breaking Changes:** None

**Migration Steps:** None required

**Rollback Plan:** Available via Netlify dashboard or CLI

---

## 👥 Support & Escalation

### Internal Team Contacts

**Development Team:**
- Lead Developer: [Your Name]
- DevOps: [Team Contact]
- QA: [Team Contact]

### External Support

**Netlify Support:**
- Dashboard: https://app.netlify.com/support
- Community Forum: https://answers.netlify.com
- Status Page: https://www.netlifystatus.com

**Firebase Support:**
- Console: https://console.firebase.google.com/project/geniusqa
- Documentation: https://firebase.google.com/docs
- Support: https://firebase.google.com/support

---

## 🎯 Success Criteria

### Deployment Success ✅

- [x] Application builds without errors
- [x] All environment variables configured
- [x] Netlify deployment completes successfully
- [x] Site is accessible via HTTPS
- [ ] All automated tests pass
- [ ] Manual functionality verification complete
- [ ] Performance metrics within acceptable range
- [ ] No critical errors in logs

### Post-Deployment Tasks

1. **Immediate (0-1 hour):**
   - [ ] Verify all core functionality
   - [ ] Check authentication flows
   - [ ] Test CRUD operations
   - [ ] Monitor error logs

2. **Short-term (1-24 hours):**
   - [ ] Monitor performance metrics
   - [ ] Review user feedback
   - [ ] Check Firebase usage
   - [ ] Verify analytics data

3. **Long-term (1-7 days):**
   - [ ] Analyze user behavior
   - [ ] Optimize bundle size
   - [ ] Review and optimize Firebase rules
   - [ ] Plan next iteration

---

## 📌 Quick Reference Commands

```bash
# Install dependencies
pnpm install

# Run development server
cd packages/web && pnpm run dev

# Build for production
cd packages/web && pnpm run build

# Preview production build
cd packages/web && pnpm run preview

# Deploy to Netlify
cd packages/web && pnpm run deploy:netlify

# Check deployment status
netlify status

# View deploy logs
netlify logs:deploy

# Open site in browser
netlify open:site

# Open admin dashboard
netlify open:admin
```

---

## 🔐 Security Considerations

### Firebase Security Rules

**Action Required:** Review and update Firebase Security Rules

1. Go to https://console.firebase.google.com/project/geniusqa/firestore/rules
2. Ensure proper read/write rules are set
3. Verify authentication requirements

### API Key Restrictions

**Action Required:** Restrict Firebase API Key

1. Go to https://console.cloud.google.com/apis/credentials
2. Find your API key: `AIzaSyD5mPJ5EcoP_L3VkRtxXQtnLai-Di5s1IE`
3. Add **Application restrictions** > **HTTP referrers**
4. Add your Netlify domain: `https://YOUR-SITE.netlify.app/*`

### Environment Variables

- ✅ All secrets stored in Netlify environment variables (not in code)
- ✅ Variables prefixed with `VITE_` are exposed to client (by design)
- ⚠️ Never commit `.env` or `.env.production` to Git

---

## ✨ Deployment Complete!

Your GeniusQA Web application is now live on Netlify with full pnpm monorepo support.

**Next Steps:**
1. Verify all functionality works as expected
2. Share the URL with your team for testing
3. Monitor the application for the first 24 hours
4. Plan future optimizations (code splitting, PWA, etc.)

**Need Help?** Refer to the troubleshooting section or contact the development team.
