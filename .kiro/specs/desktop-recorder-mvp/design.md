# Desktop Recorder MVP - Design Document

## Overview

The Desktop Recorder MVP enables users to record and replay mouse and keyboard interactions on their desktop. This feature bridges the React + Vite + Tauri desktop application with a Python automation core, creating a simple yet powerful automation tool. The MVP focuses on essential recording/playback functionality with a minimal three-button interface (Record, Start, Stop).

The system captures user interactions as timestamped actions, stores them in JSON format, and replays them with accurate timing. This design prioritizes simplicity, cross-platform compatibility, and AI-friendly script formats for future enhancement.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────┐
│   React + Vite Desktop App (UI)    │
│  ┌─────────────────────────────┐   │
│  │  RecorderScreen Component   │   │
│  │  - Record/Start/Stop buttons│   │
│  │  - Status display           │   │
│  └─────────────────────────────┘   │
│              │                      │
│              ▼                      │
│  ┌─────────────────────────────┐   │
│  │   Tauri IPC Bridge          │   │
│  │  - Tauri commands/events    │   │
│  │  - Process management       │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │ IPC Communication
               │ (Tauri → Python subprocess)
               ▼
┌─────────────────────────────────────┐
│      Python Core (Automation)       │
│  ┌─────────────────────────────┐   │
│  │   Recorder Module           │   │
│  │  - Event capture (PyAutoGUI)│   │
│  │  - Timestamp tracking       │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Player Module             │   │
│  │  - Action execution         │   │
│  │  - Timing control           │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Storage Module            │   │
│  │  - JSON serialization       │   │
│  │  - File management          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Local File System              │
│  ~/GeniusQA/recordings/             │
│    - script_20240101_120000.json    │
│    - script_20240101_130000.json    │
└─────────────────────────────────────┘
```

### Component Responsibilities

**React + Vite Desktop App:**
- Provides minimal UI with three buttons and status display
- Manages application state (Idle, Recording, Playing)
- Communicates with Python Core via Tauri commands
- Displays user feedback and error messages

**Tauri IPC Bridge:**
- Spawns and manages Python Core process via Tauri backend
- Exposes Tauri commands for frontend to invoke Python operations
- Serializes commands to JSON for Python Core
- Deserializes responses and events from Python Core
- Handles process lifecycle and error propagation

**Python Core:**
- Captures mouse and keyboard events using PyAutoGUI/pynput
- Stores actions with precise timestamps
- Reads and validates JSON script files
- Replays actions with accurate timing
- Manages local file storage

### Technology Stack

**Frontend:**
- React 18 (web-based UI)
- Vite (build tool and dev server)
- TypeScript for type safety
- React hooks for state management
- Standard HTML/CSS/JavaScript

**Desktop Framework:**
- Tauri (Rust-based desktop framework)
- Provides native OS integration
- Manages Python subprocess communication

**Backend:**
- Python 3.9+
- PyAutoGUI for cross-platform automation
- pynput for event listening (alternative/supplement to PyAutoGUI)
- Pydantic v2 for data validation
- JSON for script storage

**IPC Mechanism:**
- Tauri commands (frontend → Rust backend)
- Tauri events (Rust backend → frontend)
- Child process spawning from Tauri backend to Python
- JSON-based message protocol over stdin/stdout
- stderr for error logging

## Components and Interfaces

### React Components

#### RecorderScreen Component
```typescript
interface RecorderScreenState {
  status: 'idle' | 'recording' | 'playing';
  error: string | null;
  lastRecordingPath: string | null;
  hasRecordings: boolean;
}

interface RecorderScreenProps {
  // Minimal props, self-contained component
}
```

**Responsibilities:**
- Render three buttons with appropriate enabled/disabled states using standard HTML elements
- Display current status
- Handle button click events
- Show error messages
- Communicate with Tauri backend via Tauri commands

#### Button State Logic
- **Record Button**: Enabled when status is 'idle'
- **Start Button**: Enabled when status is 'idle' AND hasRecordings is true
- **Stop Button**: Enabled when status is 'recording' OR 'playing'

### Tauri IPC Bridge

#### Frontend Service (TypeScript)
```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

interface IPCBridgeService {
  startRecording(): Promise<void>;
  stopRecording(): Promise<RecordingResult>;
  startPlayback(scriptPath?: string): Promise<void>;
  stopPlayback(): Promise<void>;
  checkForRecordings(): Promise<boolean>;
  getLatestRecording(): Promise<string | null>;
}

interface RecordingResult {
  success: boolean;
  scriptPath?: string;
  actionCount?: number;
  duration?: number;
  error?: string;
}
```

#### Tauri Backend Commands (Rust)
```rust
#[tauri::command]
async fn start_recording() -> Result<(), String>

#[tauri::command]
async fn stop_recording() -> Result<RecordingResult, String>

#[tauri::command]
async fn start_playback(script_path: Option<String>) -> Result<(), String>

#[tauri::command]
async fn stop_playback() -> Result<(), String>

#[tauri::command]
async fn check_for_recordings() -> Result<bool, String>

#[tauri::command]
async fn get_latest_recording() -> Result<Option<String>, String>
```

#### Tauri Events
```typescript
interface TauriEvent {
  type: 'progress' | 'complete' | 'error';
  data: any;
}
```

**Implementation Notes:**
- Tauri backend spawns Python process on first command
- Keep Python process alive for duration of app session
- Use Tauri's `invoke()` for commands (frontend → backend)
- Use Tauri's `emit()` and `listen()` for events (backend → frontend)
- Rust backend manages Python subprocess via `std::process::Command`
- Use JSON.stringify/parse for message serialization with Python
- Implement timeout handling for commands
- Buffer stdout/stderr for message parsing

### Python Core Modules

#### Recorder Module

```python
from pydantic import BaseModel
from typing import Literal
from datetime import datetime

class Action(BaseModel):
    type: Literal['mouse_move', 'mouse_click', 'key_press', 'key_release']
    timestamp: float  # Seconds since recording start
    x: int | None = None  # For mouse actions
    y: int | None = None  # For mouse actions
    button: Literal['left', 'right', 'middle'] | None = None  # For clicks
    key: str | None = None  # For keyboard actions

class Recorder:
    def start_recording(self) -> None:
        """Start capturing mouse and keyboard events"""
        
    def stop_recording(self) -> list[Action]:
        """Stop capturing and return recorded actions"""
        
    def _on_mouse_move(self, x: int, y: int) -> None:
        """Callback for mouse movement"""
        
    def _on_mouse_click(self, x: int, y: int, button: str, pressed: bool) -> None:
        """Callback for mouse clicks"""
        
    def _on_key_event(self, key: str, pressed: bool) -> None:
        """Callback for keyboard events"""
```

**Design Decisions:**
- Use pynput for event listening (more reliable than PyAutoGUI for capture)
- Store timestamps as float (seconds since recording start) for precision
- Separate mouse_move from mouse_click for granular control
- Distinguish key_press from key_release for accurate replay
- Use Pydantic models for type safety and validation

#### Player Module

```python
class Player:
    def __init__(self, actions: list[Action]):
        self.actions = actions
        self.is_playing = False
        
    def start_playback(self) -> None:
        """Execute actions with timing"""
        
    def stop_playback(self) -> None:
        """Interrupt playback"""
        
    def _execute_action(self, action: Action) -> None:
        """Execute a single action using PyAutoGUI"""
        
    def _calculate_delay(self, current: Action, next: Action) -> float:
        """Calculate delay between actions, capped at 5 seconds"""
```

**Design Decisions:**
- Use PyAutoGUI for action execution (reliable cross-platform)
- Implement interruptible playback with threading
- Cap delays at 5 seconds to prevent excessive waiting
- Maintain 50ms timing accuracy target
- Use sleep() for delays between actions

#### Storage Module

```python
from pathlib import Path

class ScriptMetadata(BaseModel):
    version: str = "1.0"
    created_at: datetime
    duration: float  # Total recording duration in seconds
    action_count: int
    platform: str  # 'windows', 'darwin', 'linux'

class ScriptFile(BaseModel):
    metadata: ScriptMetadata
    actions: list[Action]

class Storage:
    def __init__(self, base_dir: Path = Path.home() / "GeniusQA" / "recordings"):
        self.base_dir = base_dir
        
    def save_script(self, actions: list[Action]) -> Path:
        """Save actions to JSON file with timestamp"""
        
    def load_script(self, path: Path) -> ScriptFile:
        """Load and validate script file"""
        
    def get_latest_script(self) -> Path | None:
        """Find most recent script file"""
        
    def list_scripts(self) -> list[Path]:
        """List all script files"""
        
    def validate_script(self, data: dict) -> bool:
        """Validate JSON schema"""
```

**Design Decisions:**
- Store in user home directory for easy access
- Use timestamp-based filenames for uniqueness
- Include metadata for AI processing and debugging
- Validate schema on load to catch corruption
- Use Pydantic for automatic JSON serialization

## Data Models

### Script File Format

```json
{
  "metadata": {
    "version": "1.0",
    "created_at": "2024-01-01T12:00:00Z",
    "duration": 45.5,
    "action_count": 127,
    "platform": "darwin"
  },
  "actions": [
    {
      "type": "mouse_move",
      "timestamp": 0.0,
      "x": 100,
      "y": 200
    },
    {
      "type": "mouse_click",
      "timestamp": 0.5,
      "x": 100,
      "y": 200,
      "button": "left"
    },
    {
      "type": "key_press",
      "timestamp": 1.2,
      "key": "a"
    },
    {
      "type": "key_release",
      "timestamp": 1.3,
      "key": "a"
    }
  ]
}
```

**Format Rationale:**
- JSON for universal compatibility and AI readability
- Metadata section for context and validation
- Flat action array for simple sequential processing
- Relative timestamps for easy timing calculation
- Similar to Selenium IDE format for familiarity
- Platform field for future platform-specific handling

### IPC Message Protocol

**Command Message (React Native → Python):**
```json
{
  "command": "start_recording",
  "params": {}
}
```

**Response Message (Python → React Native):**
```json
{
  "success": true,
  "data": {
    "scriptPath": "/path/to/script.json",
    "actionCount": 127,
    "duration": 45.5
  }
}
```

**Event Message (Python → React Native):**
```json
{
  "type": "progress",
  "data": {
    "currentAction": 50,
    "totalActions": 127
  }
}
```

**Error Message:**
```json
{
  "success": false,
  "error": "PyAutoGUI not installed. Please run: pip install pyautogui"
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Recording captures all user actions
*For any* recording session, when a user performs mouse or keyboard actions, all actions should be captured and stored in the script file with accurate timestamps.
**Validates: Requirements 1.1, 1.3**

### Property 2: Script file format round-trip consistency
*For any* valid script file, loading and then saving it should produce an equivalent file with the same actions and metadata structure.
**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

### Property 3: Playback executes actions in order
*For any* script file with multiple actions, playback should execute each action in the exact order they appear in the actions array.
**Validates: Requirements 2.2**

### Property 4: Timing preservation during playback
*For any* two consecutive actions in a script file, the delay between their execution during playback should match the difference in their timestamps within 50ms accuracy.
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 5: Long delay capping
*For any* two consecutive actions with a timestamp difference greater than 5 seconds, the actual delay during playback should be capped at 5 seconds.
**Validates: Requirements 7.5**

### Property 6: Button state consistency
*For any* application state (idle, recording, playing), the enabled/disabled state of each button should match the specification: Record enabled only when idle, Start enabled only when idle with recordings, Stop enabled only when recording or playing.
**Validates: Requirements 1.5, 2.5, 4.3**

### Property 7: Recording termination saves file
*For any* active recording session, when stop is triggered, a script file should be created in the local storage directory with a unique timestamp-based filename.
**Validates: Requirements 1.3, 1.4, 6.1, 6.3**

### Property 8: Storage directory auto-creation
*For any* system state where the recordings directory does not exist, the first save operation should create the directory automatically.
**Validates: Requirements 6.2**

### Property 9: Latest recording identification
*For any* set of script files in the storage directory, the system should correctly identify the file with the most recent timestamp as the latest recording.
**Validates: Requirements 6.5**

### Property 10: IPC error propagation
*For any* error occurring in the Python Core, the error message should be propagated to the Desktop App and displayed to the user.
**Validates: Requirements 5.5, 9.1, 9.2, 9.4**

### Property 11: Schema validation rejects invalid files
*For any* JSON file that does not conform to the script file schema, the validation function should reject it and return a clear error message.
**Validates: Requirements 3.5, 9.3**

### Property 12: PyAutoGUI availability check
*For any* Python Core initialization, if PyAutoGUI is not installed or functional, the system should detect this and report a clear error message.
**Validates: Requirements 8.4, 8.5**

## Error Handling

### Error Categories

**1. Recording Errors**
- Permission denied for input monitoring
- PyAutoGUI/pynput not installed
- Disk full when saving script
- Recording already in progress

**2. Playback Errors**
- No script file found
- Corrupted/invalid script file
- Permission denied for automation
- Playback already in progress
- Action execution failure (e.g., coordinates out of bounds)

**3. IPC Errors**
- Python process failed to start
- Python process crashed
- Communication timeout
- Message parsing error

**4. Storage Errors**
- Directory creation failed
- File write permission denied
- File read error
- Invalid file format

### Error Handling Strategy

**Python Core:**
- Wrap all operations in try-except blocks
- Return structured error responses via IPC
- Log errors to stderr for debugging
- Provide actionable error messages

**React Native App:**
- Display user-friendly error messages
- Reset to idle state on errors
- Provide guidance for common issues (permissions, installation)
- Log errors for debugging

**Error Message Examples:**
```
"Recording failed: Permission denied. Please enable Accessibility permissions in System Preferences."

"Playback failed: No recordings found. Please record a session first."

"Script file corrupted: Unable to parse JSON. The file may be damaged."

"Python Core unavailable: Please ensure Python 3.9+ is installed."
```

## Testing Strategy

### Unit Testing

**React Components:**
- RecorderScreen button state logic
- Status display rendering
- Error message display
- Standard React Testing Library tests

**Tauri IPC Bridge:**
- Tauri command invocations
- Event listener setup
- Error handling

**Rust Backend (Tauri):**
- Command handlers
- Python process management
- Message serialization/deserialization
- Process lifecycle management

**Python Modules:**
- Action model validation
- Script file serialization/deserialization
- Timestamp calculation
- Delay capping logic
- File path generation

### Property-Based Testing

We will use **fast-check** for TypeScript/JavaScript property-based testing and **Hypothesis** for Python property-based testing. Each property-based test should run a minimum of 100 iterations.

**Property Test Requirements:**
- Each test must include a comment referencing the design property
- Format: `// Feature: desktop-recorder-mvp, Property X: [property text]`
- Tests should generate random but valid inputs
- Tests should verify the universal property holds across all inputs

**Example Property Tests:**

```typescript
// Feature: desktop-recorder-mvp, Property 6: Button state consistency
test('button states match specification for all app states', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('idle', 'recording', 'playing'),
      fc.boolean(), // hasRecordings
      (status, hasRecordings) => {
        const states = calculateButtonStates(status, hasRecordings);
        // Verify button states match specification
      }
    ),
    { numRuns: 100 }
  );
});
```

```python
# Feature: desktop-recorder-mvp, Property 2: Script file format round-trip consistency
@given(st.lists(st.builds(Action)))
def test_script_roundtrip(actions):
    """For any valid script, load then save produces equivalent file"""
    storage = Storage()
    path = storage.save_script(actions)
    loaded = storage.load_script(path)
    assert loaded.actions == actions
```

### Integration Testing

- End-to-end recording and playback flow
- IPC communication between React Native and Python
- File system operations
- Error scenarios (missing permissions, corrupted files)

### Manual Testing

- Cross-platform testing (Windows, macOS, Linux)
- Permission dialogs and user guidance
- UI responsiveness during long operations
- Timing accuracy verification

## Implementation Notes

### Platform-Specific Considerations

**macOS:**
- Requires Accessibility permissions for input monitoring
- Requires Accessibility permissions for automation
- Prompt user to enable in System Preferences > Security & Privacy

**Windows:**
- May require running as administrator for some automation
- No special permissions typically needed for PyAutoGUI

**Linux:**
- X11 vs Wayland considerations
- May need xdotool for some operations

### Performance Considerations

- Mouse move events can be very frequent; consider sampling/throttling
- Large script files (>10MB) may need streaming parser
- Playback should run in separate thread to avoid UI blocking
- IPC message buffering for high-frequency events

### Future Enhancements (Out of Scope for MVP)

- Script editing UI
- Multiple script management
- Script library/templates
- AI-generated scripts
- Conditional logic in scripts
- Variable substitution
- Screenshot capture during recording
- Visual playback preview
- Playback speed control
- Loop/repeat functionality

## Security Considerations

- Script files contain sensitive information (keystrokes, screen positions)
- Store scripts locally only, never transmit without encryption
- Warn users about running untrusted scripts
- Validate all script inputs before execution
- Sanitize file paths to prevent directory traversal
- Limit automation scope (no system-level operations in MVP)

## Dependencies

**React + Vite Frontend:**
- react >= 18.2.0
- react-dom >= 18.2.0
- typescript >= 5.3.3
- vite >= 5.0.0
- @vitejs/plugin-react

**Tauri Desktop:**
- @tauri-apps/api >= 1.5.0
- @tauri-apps/cli >= 1.5.0
- Rust toolchain (for Tauri backend)

**Python Core:**
- python >= 3.9
- pyautogui >= 0.9.53
- pynput >= 1.7.6
- pydantic >= 2.0.0

**Development:**
- vitest (React testing)
- @testing-library/react (React component testing)
- pytest (Python testing)
- hypothesis (Python property testing)
- fast-check (TypeScript property testing)

## Deployment

**Tauri Desktop App:**
- Bundle Python Core with app distribution using Tauri's resource bundling
- Include Python runtime or require system Python
- Package dependencies (PyAutoGUI, pynput) or provide installation script
- Tauri builds native executables for Windows (.exe), macOS (.app), and Linux (.AppImage/.deb)

**Python Core:**
- Distribute as standalone script or package
- Include requirements.txt for dependency installation
- Provide setup script for first-run configuration
- Bundle with Tauri app in resources directory

## Success Metrics

- Recording captures 100% of user actions
- Playback timing accuracy within 50ms
- Zero data loss during save/load operations
- Error messages clear and actionable
- UI responsive (<100ms button feedback)
- Cross-platform compatibility (Windows, macOS, Linux)
