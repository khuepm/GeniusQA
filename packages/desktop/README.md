# GeniusQA Desktop Application

Main desktop application for Windows and macOS built with React Native/Tauri.

## Features

- Native OS automation and system control
- Cross-platform support (Windows, macOS)
- Real-time task execution
- Integration with Python backend
- Remote control from mobile app
- Firebase Authentication (Google OAuth & Email/Password)

## Prerequisites

- **Rust**: Required for Tauri - Install from https://rustup.rs/
- **Node.js & pnpm**: Already configured in the monorepo
- **Firebase Project**: For authentication features

## Setup

For detailed setup instructions including Firebase configuration, OAuth setup, and Tauri configuration, see [SETUP.md](./SETUP.md).

Quick setup:
1. Install Rust: https://rustup.rs/
2. Configure Firebase in `src/config/firebase.config.ts`
3. Setup OAuth redirect URLs in Google Cloud Console
4. Install dependencies: `pnpm install` (from monorepo root)

## Getting Started

```bash
# From monorepo root
pnpm --filter @geniusqa/desktop dev
```

## Building

```bash
# From monorepo root
pnpm --filter @geniusqa/desktop build
```

Build artifacts will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
desktop/
├── src/                    # React Native source code
│   ├── components/         # Reusable UI components
│   ├── config/            # Firebase and app configuration
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── navigation/        # React Navigation setup
│   ├── screens/           # Screen components
│   ├── services/          # Firebase and API services
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Main application component
├── src-tauri/             # Tauri Rust backend
│   ├── src/               # Rust source code
│   ├── icons/             # Application icons
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── SETUP.md               # Detailed setup guide
└── package.json           # Node.js dependencies
```

## Authentication

The desktop app supports:
- Google OAuth Sign-In
- Email/Password Authentication
- Session persistence
- Automatic token refresh

See [SETUP.md](./SETUP.md) for configuration details.

## Troubleshooting

Run `pnpm tauri info` to check your Tauri setup and identify missing dependencies.

For authentication issues, see the troubleshooting section in [SETUP.md](./SETUP.md).
