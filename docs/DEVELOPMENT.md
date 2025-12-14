# GeniusQA Development Guide

## Getting Started

This guide covers everything you need to know to contribute to GeniusQA, from initial setup to advanced development workflows.

## Prerequisites

### Required Software
- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **pnpm** >= 9.0.0 (`npm install -g pnpm`)
- **Python** 3.9+ ([Download](https://python.org/))
- **Rust** (for Tauri desktop builds) ([Install](https://rustup.rs/))
- **Git** ([Download](https://git-scm.com/))

### Platform-Specific Requirements

#### Windows
- **Visual Studio Build Tools** (for native modules)
- **Windows SDK** (latest version)

#### macOS
- **Xcode Command Line Tools** (`xcode-select --install`)
- **macOS SDK** (included with Xcode)

#### Linux
- **Build essentials** (`sudo apt-get install build-essential`)
- **WebKit development libraries** (`sudo apt-get install webkit2gtk-4.0-dev`)

## Project Setup

### 1. Clone Repository
```bash
git clone https://github.com/khuepm/GeniusQA.git
cd GeniusQA
```

### 2. Install Dependencies
```bash
# Install all Node.js dependencies
pnpm install

# Install Python dependencies
cd packages/python-core
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Development dependencies
cd ../..
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
# Add your Firebase config, API keys, etc.
```

### 4. Verify Installation
```bash
# Check all packages build successfully
pnpm build

# Run tests to ensure everything works
pnpm test
```

## Development Workflow

### Starting Development Servers

#### Web Platform
```bash
# Start web development server
pnpm --filter @geniusqa/web dev

# Available at http://localhost:5173
# Hot reload enabled for React components
```

#### Desktop Application
```bash
# Start desktop app in development mode
pnpm --filter @geniusqa/desktop dev

# Launches Tauri app with hot reload
# Python backend starts automatically
```

#### Mobile Application
```bash
# Start React Native development
pnpm --filter @geniusqa/mobile dev

# Follow React Native setup instructions for your platform
```

#### Python Backend (Standalone)
```bash
cd packages/python-core
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Available at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Running Tests

#### All Tests
```bash
# Run all tests across all packages
pnpm test
```

#### Package-Specific Tests
```bash
# Web platform tests (Vitest)
pnpm --filter @geniusqa/web test

# Desktop tests (Jest + fast-check)
pnpm --filter @geniusqa/desktop test

# Mobile tests (Jest)
pnpm --filter @geniusqa/mobile test

# Python tests (pytest + Hypothesis)
cd packages/python-core
pytest
```

#### Property-Based Tests
```bash
# Run property-based tests with verbose output
pnpm --filter @geniusqa/desktop test --verbose

# Python property tests with detailed output
cd packages/python-core
pytest -v tests/property/
```

### Code Quality

#### Linting
```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter @geniusqa/web lint

# Auto-fix linting issues
pnpm --filter @geniusqa/web lint --fix
```

#### Type Checking
```bash
# Type check all TypeScript packages
pnpm type-check

# Type check specific package
pnpm --filter @geniusqa/desktop type-check
```

#### Formatting
```bash
# Format all code with Prettier
pnpm format

# Format specific files
npx prettier --write "packages/web/src/**/*.{ts,tsx}"
```

## Architecture Deep Dive

### Monorepo Structure
```
GeniusQA/
├── packages/
│   ├── web/                    # React web platform
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── pages/          # Route components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── services/       # API clients and business logic
│   │   │   ├── types/          # TypeScript type definitions
│   │   │   └── utils/          # Utility functions
│   │   ├── public/             # Static assets
│   │   └── package.json
│   │
│   ├── desktop/                # Tauri desktop application
│   │   ├── src/
│   │   │   ├── components/     # React components
│   │   │   │   ├── ActionCanvas.tsx
│   │   │   │   └── TestStepPlanner.tsx
│   │   │   ├── screens/        # Main application screens
│   │   │   │   └── EnhancedScriptEditorScreen.tsx
│   │   │   ├── services/       # Business logic services
│   │   │   │   └── scriptStorageService.ts
│   │   │   ├── types/          # TypeScript definitions
│   │   │   │   └── testCaseDriven.types.ts
│   │   │   └── utils/          # Utility functions
│   │   │       ├── stepSplitting.ts
│   │   │       ├── stepMerging.ts
│   │   │       └── sessionStateIsolation.ts
│   │   ├── src-tauri/          # Rust backend for Tauri
│   │   └── package.json
│   │
│   ├── mobile/                 # React Native mobile app
│   │   ├── src/
│   │   │   ├── components/     # React Native components
│   │   │   ├── screens/        # Navigation screens
│   │   │   ├── services/       # API clients
│   │   │   └── types/          # TypeScript definitions
│   │   └── package.json
│   │
│   └── python-core/            # FastAPI backend
│       ├── src/
│       │   ├── player/         # Test execution engine
│       │   │   ├── player.py
│       │   │   ├── test_player.py
│       │   │   └── test_report_generator.py
│       │   ├── recorder/       # Action recording system
│       │   │   ├── recorder.py
│       │   │   └── test_recorder.py
│       │   ├── storage/        # Data models and persistence
│       │   │   ├── models.py
│       │   │   └── test_models.py
│       │   └── ipc/            # Inter-process communication
│       │       └── handler.py
│       ├── tests/              # Test files
│       │   ├── unit/           # Unit tests
│       │   ├── integration/    # Integration tests
│       │   └── property/       # Property-based tests
│       └── requirements.txt
```

### Key Design Patterns

#### Test Case Driven Architecture
- **Separation of Concerns**: Business logic (test steps) separated from technical implementation (actions)
- **Action Pool Pattern**: Centralized action storage with ID-based references
- **Dual-Pane Interface**: Split UI for managing steps and actions independently

#### Property-Based Testing
- **Hypothesis** (Python): Generates random test data to validate universal properties
- **fast-check** (TypeScript): Ensures frontend logic correctness across all inputs
- **Invariant Validation**: Core system properties maintained across all operations

#### IPC Communication
- **Tauri Bridge**: Secure communication between React frontend and Rust/Python backend
- **Command Pattern**: Structured commands for recording, playback, and management
- **Event Streaming**: Real-time updates during test execution

## Contributing Guidelines

### Code Style

#### TypeScript/JavaScript
```typescript
// Use strict TypeScript with explicit types
interface TestStep {
  id: string;
  order: number;
  description: string;
  expected_result: string;
  action_ids: string[];
}

// Prefer functional components with hooks
const TestStepPlanner: React.FC<Props> = ({ steps, onStepSelect }) => {
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  
  // Use meaningful variable names
  const handleStepReorder = useCallback((newOrder: TestStep[]) => {
    // Implementation
  }, []);
  
  return (
    <div className="test-step-planner">
      {/* Component JSX */}
    </div>
  );
};
```

#### Python
```python
# Use type hints and Pydantic models
from typing import List, Optional
from pydantic import BaseModel, Field

class TestStep(BaseModel):
    id: str = Field(description="Unique step identifier")
    order: int = Field(ge=1, description="Execution order")
    description: str = Field(description="Human-readable step description")
    expected_result: str = Field(default="", description="Expected outcome")
    action_ids: List[str] = Field(default_factory=list)

# Use descriptive function names and docstrings
def execute_test_step(step: TestStep, action_pool: Dict[str, Action]) -> StepResult:
    """
    Execute a single test step by running all mapped actions in sequence.
    
    Args:
        step: The test step to execute
        action_pool: Dictionary of available actions
        
    Returns:
        StepResult containing execution status and details
    """
    # Implementation
```

### Testing Requirements

#### Unit Tests
- **Coverage**: Minimum 80% code coverage for new features
- **Naming**: Descriptive test names that explain the scenario
- **Structure**: Arrange-Act-Assert pattern

```typescript
describe('TestStepPlanner', () => {
  it('should reorder steps when drag and drop is performed', () => {
    // Arrange
    const initialSteps = [step1, step2, step3];
    const expectedOrder = [step2, step1, step3];
    
    // Act
    const result = reorderSteps(initialSteps, { from: 0, to: 1 });
    
    // Assert
    expect(result).toEqual(expectedOrder);
  });
});
```

#### Property-Based Tests
- **Tag Format**: `Feature: {feature-name}, Property {number}: {description}`
- **Iterations**: Minimum 100 iterations per property test
- **Invariants**: Focus on universal properties that should always hold

```typescript
// TypeScript property test example
describe('Property Tests: Step Reordering', () => {
  it('Feature: test-case-driven-automation, Property 3: Step Reordering Consistency', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string(),
        order: fc.integer(1, 100),
        description: fc.string(),
        expected_result: fc.string(),
        action_ids: fc.array(fc.string())
      })),
      (steps) => {
        // Property: reordering should preserve all steps
        const reordered = reorderSteps(steps, randomReorderOperation());
        expect(reordered).toHaveLength(steps.length);
        expect(new Set(reordered.map(s => s.id))).toEqual(new Set(steps.map(s => s.id)));
      }
    ), { numRuns: 100 });
  });
});
```

```python
# Python property test example
from hypothesis import given, strategies as st

@given(st.lists(st.builds(TestStep)))
def test_step_reordering_consistency(steps):
    """Feature: test-case-driven-automation, Property 3: Step Reordering Consistency"""
    # Property: reordering should preserve all steps
    reordered = reorder_steps(steps, generate_random_order())
    assert len(reordered) == len(steps)
    assert set(s.id for s in reordered) == set(s.id for s in steps)
```

### Pull Request Process

1. **Branch Naming**: Use descriptive branch names
   - `feature/test-case-driven-editor`
   - `fix/step-reordering-bug`
   - `docs/api-reference-update`

2. **Commit Messages**: Follow conventional commits
   ```
   feat(desktop): add dual-pane editor interface
   
   - Implement TestStepPlanner component for left pane
   - Add ActionCanvas component for right pane
   - Integrate with existing script editor screen
   
   Closes #123
   ```

3. **PR Description Template**:
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] Property tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   
   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No breaking changes (or documented)
   ```

4. **Review Process**:
   - All tests must pass
   - Code coverage maintained
   - At least one approving review
   - Documentation updated if needed

## Debugging

### Desktop Application
```bash
# Enable Tauri development tools
pnpm --filter @geniusqa/desktop dev --debug

# View Rust logs
RUST_LOG=debug pnpm --filter @geniusqa/desktop dev

# Debug React components
# Use React Developer Tools browser extension
```

### Python Backend
```bash
# Run with debug logging
cd packages/python-core
PYTHONPATH=src python -m debugpy --listen 5678 --wait-for-client -m uvicorn src.main:app --reload

# Use pytest with debugging
pytest --pdb tests/test_player.py::test_step_execution
```

### Common Issues

#### Build Failures
```bash
# Clear all caches and reinstall
pnpm clean
rm -rf node_modules packages/*/node_modules
pnpm install

# Rebuild native modules
pnpm rebuild
```

#### Test Failures
```bash
# Run tests with verbose output
pnpm test --verbose

# Run specific test file
pnpm --filter @geniusqa/desktop test ActionCanvas.test.tsx

# Debug property test failures
pnpm --filter @geniusqa/desktop test --verbose stepReordering.property.test.ts
```

## Performance Optimization

### Frontend Performance
- **Code Splitting**: Use React.lazy for route-based splitting
- **Memoization**: Use React.memo and useMemo for expensive computations
- **Virtual Scrolling**: For large lists of test steps or actions

### Backend Performance
- **Async Operations**: Use asyncio for I/O bound operations
- **Connection Pooling**: Reuse database connections
- **Caching**: Cache frequently accessed data

### Testing Performance
- **Parallel Execution**: Run tests in parallel where possible
- **Test Isolation**: Ensure tests don't interfere with each other
- **Resource Cleanup**: Properly clean up resources after tests

## Deployment

### Development Deployment
```bash
# Build all packages
pnpm build

# Start production servers
pnpm start
```

### Production Deployment
```bash
# Build desktop application
pnpm --filter @geniusqa/desktop build

# Build web platform
pnpm --filter @geniusqa/web build

# Package Python backend
cd packages/python-core
pip install -r requirements.txt
python -m build
```

This development guide provides everything needed to contribute effectively to GeniusQA while maintaining code quality and following established patterns.
