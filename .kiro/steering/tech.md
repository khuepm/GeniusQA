# Technology Stack

## Build System
- **Package Manager**: pnpm (monorepo with workspaces)
- **Workspace Structure**: Multi-package monorepo using pnpm workspaces

## Frontend Stack
- **Web**: React 18 + TypeScript + Vite
- **Mobile/Desktop**: React Native + TypeScript
- **Routing**: React Router v6 (web)
- **Testing**: Vitest (web), Jest (mobile)

## Backend Stack
- **Language**: Python 3.9+
- **Framework**: FastAPI + Uvicorn
- **System Automation**: PyAutoGUI, keyboard, mouse libraries
- **Validation**: Pydantic v2

## Code Quality
- **Linting**: ESLint with recommended rules
- **TypeScript**: Strict mode enabled, ES5 target
- **Formatting**: Prettier configured

## Common Commands

### Root Level
```bash
pnpm install          # Install all dependencies
```

### Web Package
```bash
pnpm --filter @geniusqa/web dev      # Start dev server
pnpm --filter @geniusqa/web build    # Build for production
pnpm --filter @geniusqa/web test     # Run tests
pnpm --filter @geniusqa/web lint     # Lint code
```

### Mobile Package
```bash
pnpm --filter @geniusqa/mobile dev   # Start React Native
pnpm --filter @geniusqa/mobile test  # Run tests
```

### Python Core
```bash
cd packages/python-core
pip install -r requirements.txt      # Install dependencies
```
