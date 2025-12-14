# GeniusQA Architecture Overview

## System Architecture

GeniusQA is designed as a distributed multi-platform system with clear separation of concerns across four main components. The architecture enables seamless automation across different platforms while maintaining a unified user experience.

## Component Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Platform  │    │ Desktop App     │    │  Mobile App     │
│   (React/Vite)  │    │ (Tauri/React)   │    │ (React Native)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │              ┌───────▼───────┐              │
          │              │ IPC Bridge    │              │
          │              │ (Tauri APIs)  │              │
          │              └───────┬───────┘              │
          │                      │                      │
          └──────────────────────▼──────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Python Core          │
                    │    (FastAPI/Uvicorn)    │
                    │                         │
                    │  ┌─────────────────┐    │
                    │  │ Test Execution  │    │
                    │  │ Engine (Player) │    │
                    │  └─────────────────┘    │
                    │                         │
                    │  ┌─────────────────┐    │
                    │  │ Action Recording│    │
                    │  │ System          │    │
                    │  └─────────────────┘    │
                    │                         │
                    │  ┌─────────────────┐    │
                    │  │ AI Vision       │    │
                    │  │ Processing      │    │
                    │  └─────────────────┘    │
                    │                         │
                    │  ┌─────────────────┐    │
                    │  │ System          │    │
                    │  │ Automation      │    │
                    │  └─────────────────┘    │
                    └─────────────────────────┘
```

## Core Components

### 1. Web Platform (`packages/web`)

**Purpose**: Authentication, dashboard, and cloud service integration

**Technology Stack**:
- React 18 + TypeScript
- Vite (build tool)
- React Router v6 (routing)
- Firebase (authentication)
- Tailwind CSS (styling)

**Key Features**:
- User authentication and account management
- API key management and configuration
- Cloud service integration dashboard
- Test execution monitoring and reporting
- Script sharing and collaboration

**Architecture Patterns**:
- Component-based React architecture
- Firebase SDK integration for auth
- RESTful API communication with Python core
- Responsive design for cross-device compatibility

### 2. Desktop Application (`packages/desktop`)

**Purpose**: Primary automation interface with native OS control

**Technology Stack**:
- Tauri (native desktop framework)
- React + TypeScript (UI layer)
- Rust (native backend via Tauri)
- Jest + fast-check (testing)

**Key Features**:
- **Test Case Driven Automation**: Dual-pane editor for managing test steps and actions
- **Native OS Integration**: Direct system control and automation
- **AI Vision Interface**: Visual element detection and interaction
- **Script Management**: Create, edit, and organize automation scripts
- **Real-time Recording**: Capture user actions and map to test steps

**Core Components**:
- `EnhancedScriptEditorScreen`: Main editing interface
- `TestStepPlanner`: Left pane for managing test steps
- `ActionCanvas`: Right pane for action details and editing
- `scriptStorageService`: Script persistence and management
- `sessionStateIsolation`: Clean separation of runtime and persistent data

### 3. Mobile Application (`packages/mobile`)

**Purpose**: Remote control and monitoring companion

**Technology Stack**:
- React Native + TypeScript
- Jest (testing)
- Platform-specific native modules

**Key Features**:
- Remote test execution control
- Real-time execution monitoring
- Push notifications for test results
- Mobile-optimized script viewing
- Quick action triggers

### 4. Python Core (`packages/python-core`)

**Purpose**: Backend automation engine and system integration

**Technology Stack**:
- FastAPI + Uvicorn (web framework)
- PyAutoGUI + pynput (system automation)
- Pydantic v2 (data validation)
- pytest + Hypothesis (testing)

**Core Modules**:

#### Player Engine (`src/player/`)
- **TestPlayer**: Executes test scripts with step-based logic
- **AIVisionPlayer**: Handles AI-powered element detection
- **ReportGenerator**: Creates business-language test reports

#### Recording System (`src/recorder/`)
- **Recorder**: Captures user actions and system events
- **ActionMapper**: Maps recorded actions to test steps
- **EventProcessor**: Processes and filters system events

#### Storage Layer (`src/storage/`)
- **Models**: Pydantic data models for scripts, steps, and actions
- **Migration**: Automatic conversion from legacy flat scripts
- **Persistence**: File-based storage with validation

#### IPC Handler (`src/ipc/`)
- **Handler**: Inter-process communication bridge
- **CommandProcessor**: Processes commands from desktop app
- **EventEmitter**: Sends events back to frontend

## Data Flow Architecture

### Test Case Driven Automation Flow

```
1. User creates test steps in TestStepPlanner
   ↓
2. User selects step and starts recording
   ↓
3. Recorder captures actions and maps to active step
   ↓
4. Actions stored in Action Pool, referenced by step IDs
   ↓
5. User executes test script
   ↓
6. Player executes steps sequentially
   ↓
7. AI Vision processes assertions
   ↓
8. Report Generator creates business-language results
```

### Data Models

#### Test Script Structure
```typescript
interface TestScript {
  meta: {
    id: string;
    title: string;
    description: string;
    created_at: number;
    tags: string[];
    pre_condition: string;
  };
  steps: TestStep[];
  action_pool: Record<string, Action>;
  variables: Record<string, string>;
}

interface TestStep {
  id: string;
  order: number;
  description: string;
  expected_result: string;
  action_ids: string[];
  continue_on_failure?: boolean;
}
```

#### Action Pool Architecture
- **Centralized Storage**: All actions stored in flat dictionary by ID
- **Reference System**: Steps reference actions by ID, not embedding
- **Deduplication**: Same action can be referenced by multiple steps
- **Garbage Collection**: Unreferenced actions can be cleaned up

## Communication Patterns

### Desktop ↔ Python Core
- **IPC Bridge**: Tauri's native IPC system
- **Command Pattern**: Structured commands for recording, playback, and management
- **Event Streaming**: Real-time updates during execution
- **Error Handling**: Graceful degradation and recovery

### Web ↔ Python Core
- **RESTful APIs**: Standard HTTP endpoints for script management
- **WebSocket**: Real-time execution monitoring
- **Authentication**: JWT-based secure communication
- **File Upload**: Script import/export functionality

### Mobile ↔ System
- **Push Notifications**: Test completion and error alerts
- **Remote Commands**: Trigger execution from mobile device
- **Status Sync**: Real-time execution status updates

## Security Architecture

### Authentication & Authorization
- **Firebase Auth**: Centralized user management
- **API Keys**: Secure service-to-service communication
- **Role-Based Access**: Different permission levels for users
- **Session Management**: Secure token handling

### System Security
- **Sandboxed Execution**: Isolated test execution environment
- **Permission Model**: Explicit user consent for system access
- **Audit Logging**: Comprehensive action logging for security
- **Data Encryption**: Sensitive data encrypted at rest and in transit

## Scalability Considerations

### Performance Optimization
- **Lazy Loading**: Components and data loaded on demand
- **Action Batching**: Efficient bulk operations for large scripts
- **Memory Management**: Proper cleanup of resources
- **Caching**: Strategic caching of frequently accessed data

### Horizontal Scaling
- **Stateless Design**: Python core designed for horizontal scaling
- **Load Balancing**: Multiple Python instances for high throughput
- **Database Abstraction**: Ready for database backend migration
- **Microservice Ready**: Clear service boundaries for future splitting

## Testing Architecture

### Property-Based Testing
- **Hypothesis** (Python): Validates universal properties across random inputs
- **fast-check** (TypeScript): Ensures correctness of frontend logic
- **100+ Iterations**: Statistical confidence in correctness properties
- **Invariant Validation**: Core system properties maintained across all operations

### Integration Testing
- **End-to-End Workflows**: Complete user journey validation
- **Cross-Platform Testing**: Consistent behavior across platforms
- **Performance Testing**: Load testing for large scripts and datasets
- **Error Recovery Testing**: Graceful handling of failure scenarios

## Deployment Architecture

### Development Environment
- **pnpm Workspaces**: Unified dependency management
- **Hot Reloading**: Fast development iteration
- **Type Safety**: Comprehensive TypeScript coverage
- **Linting & Formatting**: Consistent code quality

### Production Deployment
- **Desktop**: Tauri native installers for Windows/macOS
- **Web**: Static site deployment with CDN
- **Mobile**: App store distribution
- **Backend**: Containerized Python services

This architecture provides a solid foundation for scalable, maintainable, and secure automation platform that bridges technical and business requirements through its innovative Test Case Driven approach.
