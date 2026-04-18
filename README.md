# GeniusQA

**Intelligent Test Case Driven Automation Platform**

GeniusQA transforms system automation by bridging the gap between manual test cases and executable automation scripts. Create structured test scenarios in natural language, record technical actions mapped to specific steps, and generate business-readable reports—all while maintaining full technical control.

## 🎯 Core Innovation

**Test Case Driven Automation**: Unlike traditional flat action recording, GeniusQA organizes automation as hierarchical test cases where business-readable test steps contain mapped technical actions. This creates synchronization between test documentation and executable code, enabling both technical and non-technical stakeholders to understand and maintain automation scripts.

## 🏗️ Architecture

GeniusQA is built as a multi-platform monorepo with four core components:

- **🖥️ Desktop Application** - Cross-platform Tauri app (Windows/macOS) with native OS automation capabilities
- **📱 Mobile Application** - Remote control, notifications, and test execution monitoring  
- **🐍 Python Core** - FastAPI backend providing system automation, AI vision processing, and intelligent test execution
- **🌐 Web Platform** - Authentication, dashboard, API key management, and cloud service integration

## ✨ Key Features

### Test Case Driven Automation
- **Structured Test Steps**: Organize automation as business-readable test scenarios
- **Action Pool Architecture**: Technical actions stored centrally, referenced by test steps
- **Dual-Pane Editor**: Manage test steps (left) and technical actions (right) in unified interface
- **AI Vision Assertions**: Automated pass/fail determination using visual element detection
- **Business Language Reports**: Generate test results in natural language for stakeholders

### Advanced Automation Capabilities
- **Native OS Control**: Direct system automation using PyAutoGUI, keyboard, and mouse libraries
- **AI-Powered Vision**: Intelligent element detection and interaction using computer vision
- **Cross-Platform Support**: Consistent automation across Windows and macOS environments
- **Session State Isolation**: Clean separation between test definitions and execution results

### Developer Experience
- **Property-Based Testing**: Comprehensive correctness validation using Hypothesis and fast-check
- **Automatic Migration**: Seamless upgrade from legacy flat scripts to step-based format
- **TypeScript + Python**: Type-safe development with strict validation
- **Monorepo Architecture**: Organized codebase with shared configurations and dependencies

## 📦 Monorepo Structure

```
GeniusQA/
├── packages/
│   ├── desktop/              # Tauri desktop application
│   │   ├── src/
│   │   │   ├── components/   # React components (ActionCanvas, TestStepPlanner)
│   │   │   ├── screens/      # Main screens (EnhancedScriptEditorScreen)
│   │   │   ├── services/     # Business logic (scriptStorageService)
│   │   │   ├── types/        # TypeScript definitions
│   │   │   └── utils/        # Utilities (stepSplitting, stepMerging)
│   │   └── package.json      # @geniusqa/desktop
│   ├── mobile/               # React Native mobile app
│   │   └── package.json      # @geniusqa/mobile  
│   ├── python-core/          # FastAPI backend
│   │   ├── src/
│   │   │   ├── player/       # Test execution engine
│   │   │   ├── recorder/     # Action recording system
│   │   │   ├── storage/      # Data models and persistence
│   │   │   └── ipc/          # Inter-process communication
│   │   └── requirements.txt
│   └── web/                  # React web platform
│       ├── src/
│       └── package.json      # @geniusqa/web
├── docs/                     # Project documentation
├── .kiro/                    # Kiro AI assistant configuration
│   └── specs/                # Feature specifications
└── pnpm-workspace.yaml       # Workspace configuration
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 9.0.0  
- **Python** 3.9+
- **Rust** (for Tauri desktop builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/khuepm/GeniusQA.git
cd GeniusQA

# Install all dependencies
pnpm install

# Install Python dependencies
cd packages/python-core
pip install -r requirements.txt
cd ../..
```

### Development

```bash
# Start web development server
pnpm --filter @geniusqa/web dev

# Start desktop application
pnpm --filter @geniusqa/desktop dev

# Start mobile development
pnpm --filter @geniusqa/mobile dev

# Run Python backend
cd packages/python-core
uvicorn src.main:app --reload
```

### Building

```bash
# Build web platform
pnpm --filter @geniusqa/web build

# Build desktop application
pnpm --filter @geniusqa/desktop build

# Build all packages
pnpm build
```

### Testing

```bash
# Run web tests
pnpm --filter @geniusqa/web test

# Run desktop tests (includes property-based tests)
pnpm --filter @geniusqa/desktop test

# Run Python tests
cd packages/python-core
pytest
```

### Release (GitHub)

1.  **Tag a new version**:
    ```bash
    git tag v1.0.0
    git push origin v1.0.0
    ```
2.  **GitHub Action**: A workflow will automatically build the application and create a release with the downloadable assets (dmg, app, exe).

### Local Build

To build the desktop application locally:

```bash
# Using the helper script
./scripts/build-desktop.sh

# Or manually
cd packages/desktop
pnpm tauri build
```
The output will be in `packages/desktop/src-tauri/target/release/bundle/`.

## 🧪 Testing Strategy

GeniusQA employs a comprehensive dual testing approach:

- **Unit Tests**: Verify specific examples, edge cases, and integration points
- **Property-Based Tests**: Validate universal correctness properties using Hypothesis (Python) and fast-check (TypeScript)

Each property-based test runs 100+ iterations to ensure statistical confidence and validates core system invariants across all valid inputs.

## 📚 Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md) - System design and component interactions
- [Test Case Driven Automation](./docs/TEST_CASE_DRIVEN.md) - Core feature specification and usage
- [API Reference](./docs/API.md) - Backend API documentation
- [Development Guide](./docs/DEVELOPMENT.md) - Setup and contribution guidelines

## 🛠️ Technology Stack

### Frontend
- **React 18** + **TypeScript** + **Vite** (Web)
- **React Native** + **TypeScript** (Mobile)  
- **Tauri** + **React** (Desktop)
- **Testing**: Vitest (web), Jest + fast-check (desktop)

### Backend
- **FastAPI** + **Uvicorn** (Python 3.9+)
- **PyAutoGUI** + **pynput** (System automation)
- **Pydantic v2** (Data validation)
- **Testing**: pytest + Hypothesis

### Build System
- **pnpm workspaces** (Monorepo management)
- **TypeScript** (Strict mode, ES5 target)
- **ESLint** + **Prettier** (Code quality)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the coding standards
4. Run tests (`pnpm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

MIT License - See [LICENSE](./LICENSE) file for details.

## 👨‍💻 Author

**khuepm** - [GitHub Profile](https://github.com/khuepm)

## 🔗 Links

- **Repository**: https://github.com/khuepm/GeniusQA
- **Issues**: https://github.com/khuepm/GeniusQA/issues
- **Discussions**: https://github.com/khuepm/GeniusQA/discussions
