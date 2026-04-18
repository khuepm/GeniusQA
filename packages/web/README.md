# GeniusQA Web Platform

Modern web application for product showcase, user authentication, and account management.

## Features

- **Landing Page**: Professional marketing site with feature highlights
- **Download Page**: Desktop app download for Windows and macOS
- **User Authentication**: Registration and login with Firebase
- **Dashboard**: User management and account settings
- **Project Management**: Create and manage test automation projects
- **Test Cases**: View and organize test cases
- **Test Runs**: Track test execution history
- **Auto-Generate**: AI-powered test case generation
- **Desktop Agents**: Manage desktop automation agents
- **API Integration**: Cloud service access control

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5.0
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Authentication**: Firebase Auth
- **Icons**: Lucide React
- **Deployment**: Netlify

## Getting Started

### From Monorepo Root (Recommended)

```bash
# Development
pnpm dev

# Build
pnpm build

# Preview
pnpm preview

# Type check
pnpm type-check

# Lint
pnpm lint

# Test
pnpm test
```

### From Web Package Directory

```bash
cd packages/web

# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Using pnpm Filter (From Anywhere)

```bash
# Development
pnpm --filter @geniusqa/web dev

# Build
pnpm --filter @geniusqa/web build

# Preview
pnpm --filter @geniusqa/web preview

# Type check
pnpm --filter @geniusqa/web type-check

# Add dependency
pnpm --filter @geniusqa/web add <package-name>

# Add dev dependency
pnpm --filter @geniusqa/web add -D <package-name>
```

## Pages

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/` | Landing | No | Home/marketing page |
| `/download` | Download | No | Desktop app download |
| `/login` | Login | No | User login |
| `/register` | Register | No | User registration |
| `/dashboard` | Dashboard | Yes | User dashboard |
| `/projects` | Projects | Yes | Project list |
| `/projects/new` | ProjectForm | Yes | Create project |
| `/projects/:id/edit` | ProjectForm | Yes | Edit project |
| `/testcases` | TestCases | Yes | Test case list |
| `/test-runs` | TestRuns | Yes | Test run history |
| `/auto-generate` | AutoGenerate | Yes | AI test generation |
| `/desktop-agents` | DesktopAgents | Yes | Desktop agent management |

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Development

```bash
# Start dev server (with hot reload)
pnpm dev

# Server runs at http://localhost:5173
```

## Building

```bash
# Build for production
pnpm build

# Output: packages/web/dist/
```

## Preview Production Build

```bash
# Build first
pnpm build

# Then preview
pnpm preview

# Preview runs at http://localhost:4173
```

## Type Checking

```bash
# Check TypeScript types
pnpm type-check
```

## Linting

```bash
# Lint code
pnpm lint
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch
```

## Deployment

### Netlify

Configured in `netlify.toml`:

```toml
[build]
  command = "pnpm --filter @geniusqa/web build"
  publish = "packages/web/dist"

[build.environment]
  NODE_VERSION = "18"
```

Deploy via:
1. Connect GitHub repo to Netlify
2. Configure build settings (already in netlify.toml)
3. Add environment variables
4. Deploy

## Project Structure

```
packages/web/
├── src/
│   ├── components/        # Reusable components
│   │   ├── Layout.tsx
│   │   └── ProtectedRoute.tsx
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx
│   ├── lib/               # Utilities
│   │   └── firebase.ts
│   ├── pages/             # Page components
│   │   ├── Landing.tsx
│   │   ├── Download.tsx   # NEW
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Projects.tsx
│   │   ├── ProjectForm.tsx
│   │   ├── TestCases.tsx
│   │   ├── TestRuns.tsx
│   │   ├── AutoGenerate.tsx
│   │   └── DesktopAgents.tsx
│   ├── types/             # TypeScript types
│   │   └── database.ts
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── public/                # Static assets
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript config
├── tailwind.config.js     # Tailwind config
├── postcss.config.js      # PostCSS config
├── netlify.toml           # Netlify config
└── package.json           # Package manifest
```

## Key Features

### Landing Page
- Hero section with CTA
- Features showcase
- Benefits section
- Testimonials
- Download section for desktop apps
- Responsive design

### Download Page
- Windows and macOS download options
- System requirements
- Platform-specific features
- Quick start guide
- Security information
- Installation help

### Authentication
- Firebase email/password auth
- Protected routes
- Auth context for state management
- Automatic redirects

### Dashboard
- User profile
- Quick actions
- Recent activity
- Statistics

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Vite for fast builds
- Code splitting
- Lazy loading
- Optimized images
- Production minification

## Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader support
- Color contrast compliance

## Documentation

See `/docs/web/` for detailed documentation:
- `download-page.md` - Download feature
- `pnpm-monorepo-guide.md` - pnpm usage
- `DOWNLOAD_FEATURE_SUMMARY.md` - Implementation summary
- `deployment.md` - Deployment guide
- `architecture.md` - Architecture overview
- `requirements.md` - Technical requirements

## Troubleshooting

### Port already in use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use different port
pnpm dev -- --port 3000
```

### Build errors

```bash
# Clean and reinstall
rm -rf node_modules dist
pnpm install
pnpm build
```

### TypeScript errors

```bash
# Run type check
pnpm type-check

# Fix common issues
pnpm --filter @geniusqa/web add -D @types/node
```

## Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Build and verify
5. Submit PR

## License

See LICENSE file in root directory.

## Support

For issues or questions:
- Check documentation in `/docs/web/`
- Review troubleshooting section
- Contact development team
