# Project Structure

## Monorepo Organization

GeniusQA uses a pnpm workspace monorepo structure with packages organized under `packages/`:

```
GeniusQA/
├── packages/
│   ├── web/              # React + Vite web application
│   │   ├── src/          # Web source code
│   │   └── package.json  # @geniusqa/web
│   ├── mobile/           # React Native desktop app
│   │   └── package.json  # @geniusqa/mobile
│   └── python-core/      # Python FastAPI backend
│       └── requirements.txt
├── docs/                 # Documentation
├── .github/              # GitHub Actions workflows
├── pnpm-workspace.yaml   # Workspace configuration
├── tsconfig.json         # Root TypeScript config
└── package.json          # Root package (private)
```

## Package Naming Convention
- Scoped packages: `@geniusqa/<package-name>`
- Web: `@geniusqa/web`
- Mobile: `@geniusqa/mobile`

## Key Configuration Files
- `pnpm-workspace.yaml`: Defines workspace packages
- `tsconfig.json`: Shared TypeScript configuration (strict mode, ES5 target)
- `.eslintrc.json`: Shared ESLint rules
- `.prettierrc`: Code formatting rules

## Architecture Pattern
- **Monorepo**: Multiple related packages in single repository
- **Separation of Concerns**: Web, mobile, and backend as independent packages
- **Shared Configuration**: Root-level configs for TypeScript, ESLint, Prettier
