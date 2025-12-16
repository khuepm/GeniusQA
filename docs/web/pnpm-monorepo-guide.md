# pnpm Monorepo Guide

## Overview

GeniusQA sử dụng **pnpm workspaces** để quản lý monorepo với nhiều packages. Document này hướng dẫn cách sử dụng pnpm filter commands.

## Why pnpm?

- **Fast**: Nhanh hơn npm/yarn nhờ hard links và content-addressable storage
- **Efficient**: Tiết kiệm disk space với shared dependencies
- **Strict**: Ngăn chặn phantom dependencies
- **Workspace Support**: Built-in monorepo support

## Repository Structure

```
geniusqa/
├── packages/
│   ├── web/              # Web platform (@geniusqa/web)
│   ├── desktop/          # Desktop app (@geniusqa/desktop)
│   ├── mobile/           # Mobile app (@geniusqa/mobile)
│   ├── rust-core/        # Rust automation core
│   └── python-core/      # Python automation backend
├── package.json          # Root package.json
└── pnpm-workspace.yaml   # Workspace config
```

## Installation

### Install pnpm globally

```bash
npm install -g pnpm
```

### Install all dependencies

```bash
# From root directory
pnpm install

# This will install dependencies for all packages
```

## Working with Workspaces

### Filter Commands

pnpm cung cấp `--filter` flag để chạy commands cho specific packages.

#### Syntax

```bash
pnpm --filter <package-name> <command>
```

### Package Names

Mỗi package có name trong `package.json`:

- Web: `@geniusqa/web`
- Desktop: `@geniusqa/desktop`
- Mobile: `@geniusqa/mobile`

## Common Commands

### Web Package (@geniusqa/web)

```bash
# Development server
pnpm --filter @geniusqa/web dev

# Build for production
pnpm --filter @geniusqa/web build

# Preview production build
pnpm --filter @geniusqa/web preview

# Run tests
pnpm --filter @geniusqa/web test

# Lint code
pnpm --filter @geniusqa/web lint

# Type check
pnpm --filter @geniusqa/web type-check

# Install new dependency
pnpm --filter @geniusqa/web add <package-name>

# Install dev dependency
pnpm --filter @geniusqa/web add -D <package-name>

# Remove dependency
pnpm --filter @geniusqa/web remove <package-name>
```

### Root Scripts (Shortcuts)

Root `package.json` có shortcuts cho web package:

```bash
# From root directory:
pnpm dev              # Same as: pnpm --filter @geniusqa/web dev
pnpm build            # Same as: pnpm --filter @geniusqa/web build
pnpm preview          # Same as: pnpm --filter @geniusqa/web preview
pnpm lint             # Same as: pnpm --filter @geniusqa/web lint
pnpm type-check       # Same as: pnpm --filter @geniusqa/web type-check
pnpm test             # Same as: pnpm --filter @geniusqa/web test
```

### Desktop Package

```bash
# Development
pnpm --filter @geniusqa/desktop dev

# Build
pnpm --filter @geniusqa/desktop build
```

### Multiple Packages

```bash
# Run command for multiple packages
pnpm --filter @geniusqa/web --filter @geniusqa/desktop build

# Run command for all packages
pnpm -r build

# Run command recursively in order
pnpm --recursive build
```

## Development Workflow

### Starting a New Feature

```bash
# 1. Pull latest changes
git pull

# 2. Install/update dependencies
pnpm install

# 3. Start development server
pnpm dev  # or pnpm --filter @geniusqa/web dev

# 4. Open browser to http://localhost:5173
```

### Adding a New Dependency

```bash
# Add to web package
pnpm --filter @geniusqa/web add react-query

# Add dev dependency
pnpm --filter @geniusqa/web add -D @types/node

# Add to multiple packages
pnpm --filter @geniusqa/web --filter @geniusqa/desktop add lodash
```

### Building for Production

```bash
# Build web package
pnpm build

# Or explicitly:
pnpm --filter @geniusqa/web build

# Output will be in packages/web/dist/
```

### Running Tests

```bash
# Run web tests
pnpm test

# Or explicitly:
pnpm --filter @geniusqa/web test

# Watch mode
pnpm --filter @geniusqa/web test -- --watch
```

## Advanced Usage

### Working Directory

```bash
# Change to package directory
cd packages/web

# Now you can use regular pnpm commands
pnpm dev
pnpm build
pnpm add <package>
```

### Filtering by Pattern

```bash
# All packages starting with @geniusqa/
pnpm --filter "@geniusqa/*" build

# All packages except web
pnpm --filter "!@geniusqa/web" build
```

### Dependency Graph

```bash
# Show why a package is installed
pnpm why <package-name>

# List all packages
pnpm list --depth 0

# List in specific package
pnpm --filter @geniusqa/web list
```

### Cleaning

```bash
# Remove all node_modules
pnpm -r clean
rm -rf node_modules

# Reinstall everything
pnpm install

# Clean build outputs
pnpm --filter @geniusqa/web clean
```

## Troubleshooting

### Issue: "Command not found: pnpm"

**Solution**: Install pnpm globally
```bash
npm install -g pnpm
```

### Issue: Dependencies not found

**Solution**: Run install from root
```bash
pnpm install
```

### Issue: Wrong Node version

**Solution**: Check Node version (need Node 18+)
```bash
node --version
# If < 18, upgrade Node.js
```

### Issue: Cache problems

**Solution**: Clear pnpm cache
```bash
pnpm store prune
pnpm install
```

### Issue: Lock file conflicts

**Solution**: Remove and regenerate
```bash
rm pnpm-lock.yaml
pnpm install
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Web

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install

      - run: pnpm --filter @geniusqa/web build
```

### Netlify Configuration

```toml
[build]
  command = "pnpm --filter @geniusqa/web build"
  publish = "packages/web/dist"

[build.environment]
  NODE_VERSION = "18"
  NPM_FLAGS = "--version"
```

## Best Practices

### 1. Always use filter for workspace commands

```bash
# Good
pnpm --filter @geniusqa/web add lodash

# Bad (affects root or wrong package)
pnpm add lodash
```

### 2. Use root scripts for common tasks

```bash
# Good - clear and short
pnpm dev
pnpm build

# Also good - explicit
pnpm --filter @geniusqa/web dev
```

### 3. Install from root

```bash
# Good - installs all packages
cd geniusqa/
pnpm install

# Less ideal - only one package
cd packages/web/
pnpm install
```

### 4. Commit lock file

Always commit `pnpm-lock.yaml`:
```bash
git add pnpm-lock.yaml
git commit -m "Update dependencies"
```

### 5. Use workspaces for shared code

If you have shared utilities, create a shared package:
```
packages/
  shared/
    package.json  # @geniusqa/shared
```

Then import in other packages:
```json
{
  "dependencies": {
    "@geniusqa/shared": "workspace:*"
  }
}
```

## Resources

- [pnpm Documentation](https://pnpm.io/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [pnpm CLI](https://pnpm.io/cli/run)
- [pnpm vs npm/yarn](https://pnpm.io/feature-comparison)

## Quick Reference

| Task | Command |
|------|---------|
| Install all | `pnpm install` |
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Add package | `pnpm --filter @geniusqa/web add <pkg>` |
| Remove package | `pnpm --filter @geniusqa/web remove <pkg>` |
| Clean install | `rm -rf node_modules && pnpm install` |
| Update deps | `pnpm update` |
| Check outdated | `pnpm outdated` |

## Support

Nếu gặp vấn đề với pnpm hoặc monorepo setup, check:
1. Node version (>= 18)
2. pnpm version (>= 8)
3. pnpm-workspace.yaml exists
4. Package names match in filter commands

For more help, contact the team or check [pnpm docs](https://pnpm.io/).
