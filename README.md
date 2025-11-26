# GeniusQA

Intelligent Q&A System with Cross-Platform Desktop App and Web Dashboard. 

## About

GeniusQA is a comprehensive platform that combines:
- 🖥️ **Desktop Application**: Native Windows & macOS app built with React Native for OS-level automation
- 🐍 **Python Backend**: Advanced automation and system control using Python and its ecosystem
- 🌐 **Web Platform**: Modern web interface for product showcase, user authentication, and account management

## License

MIT License - see [LICENSE](./LICENSE) file for details

## Monorepo Structure

This project uses `pnpm` workspaces for monorepo management. 

### Packages

- **packages/mobile** - React Native desktop application (Windows & macOS)
- **packages/python-core** - Python backend for system automation and native features
- **packages/web** - Web platform for authentication, dashboard, and management

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0
- Python 3. 9+

### Installation

```bash
# Install dependencies for all packages
pnpm install

# Start development servers
pnpm dev

# Run tests
pnpm test

# Build all packages
pnpm build
