# Requirements Document

## Introduction

This document specifies the requirements for the Desktop Recorder MVP feature of GeniusQA. The feature enables users to record mouse and keyboard interactions on their operating system, save them as structured script files, and replay those interactions automatically. This MVP focuses on the core recording and playback functionality with a minimal user interface.

## Glossary

- **Desktop App**: The React + Vite + Tauri cross-platform desktop application component of GeniusQA
- **Python Core**: The Python-based backend service that handles system automation using PyAutoGUI
- **Script File**: A JSON-formatted file containing recorded user interactions (mouse movements, clicks, keyboard inputs)
- **Recording Session**: The period during which user interactions are being captured
- **Playback Session**: The period during which recorded interactions are being replayed
- **Action**: A single recorded interaction (e.g., mouse click, key press, mouse move)
- **IPC Bridge**: Inter-Process Communication mechanism between React UI and Python Core via Tauri commands

## Requirements

### Requirement 1

**User Story:** As a user, I want to start and stop recording my mouse and keyboard interactions, so that I can capture workflows for later automation.

#### Acceptance Criteria

1. WHEN a user clicks the Record button THEN the Desktop App SHALL initiate a recording session and capture all mouse movements, clicks, and keyboard inputs
2. WHEN a recording session is active THEN the Desktop App SHALL display visual feedback indicating recording is in progress
3. WHEN a user clicks the Stop button during recording THEN the Desktop App SHALL terminate the recording session and save the captured actions to a local Script File
4. WHEN a recording session ends THEN the Desktop App SHALL generate a unique filename with timestamp for the Script File
5. WHEN no recording session is active THEN the Desktop App SHALL disable the Stop button

### Requirement 2

**User Story:** As a user, I want to replay recorded interactions, so that I can automate repetitive tasks without manual intervention.

#### Acceptance Criteria

1. WHEN a user clicks the Start button THEN the Desktop App SHALL load the most recent Script File and initiate a playback session
2. WHEN a playback session is active THEN the Python Core SHALL execute each Action in the Script File sequentially with recorded timing
3. WHEN a user clicks the Stop button during playback THEN the Desktop App SHALL immediately terminate the playback session
4. WHEN a playback session completes successfully THEN the Desktop App SHALL display completion feedback
5. WHEN no Script File exists THEN the Desktop App SHALL disable the Start button and display an appropriate message

### Requirement 3

**User Story:** As a developer, I want recorded interactions stored in a standard JSON format, so that AI systems can easily generate and modify automation scripts.

#### Acceptance Criteria

1. WHEN the Python Core saves a Script File THEN the system SHALL use JSON format with a defined schema
2. WHEN the Script File is created THEN the system SHALL include metadata (version, timestamp, duration, action count)
3. WHEN an Action is recorded THEN the system SHALL store the action type, coordinates (for mouse), key codes (for keyboard), and timestamp
4. WHEN the Script File format is designed THEN the system SHALL follow industry-standard patterns similar to Selenium IDE format
5. WHEN the Python Core reads a Script File THEN the system SHALL validate the JSON schema before playback

### Requirement 4

**User Story:** As a user, I want the desktop interface to be extremely simple with only essential controls, so that I can focus on my automation tasks without distraction.

#### Acceptance Criteria

1. WHEN the Desktop App launches THEN the system SHALL display only three buttons: Record, Start, and Stop
2. WHEN buttons are displayed THEN the system SHALL use clear, intuitive labels and visual states
3. WHEN a button is disabled THEN the system SHALL provide visual indication of the disabled state
4. WHEN the user interface is rendered THEN the system SHALL maintain a clean, minimal aesthetic
5. WHEN the Desktop App is in any state THEN the system SHALL display current status (Idle, Recording, Playing)

### Requirement 5

**User Story:** As a system architect, I want clear separation between the React Native UI and Python automation core, so that the system is maintainable and platform-independent.

#### Acceptance Criteria

1. WHEN the Desktop App needs to start recording THEN the system SHALL communicate with Python Core via IPC Bridge
2. WHEN the Python Core captures actions THEN the system SHALL store them independently of the UI layer
3. WHEN the Desktop App requests playback THEN the system SHALL pass the Script File path to Python Core via IPC Bridge
4. WHEN the Python Core executes actions THEN the system SHALL report progress back to Desktop App via IPC Bridge
5. WHEN errors occur in Python Core THEN the system SHALL propagate error messages to Desktop App for user display

### Requirement 6

**User Story:** As a user, I want recorded scripts saved locally on my machine, so that I can access and manage my automation workflows offline.

#### Acceptance Criteria

1. WHEN a Script File is saved THEN the Python Core SHALL store it in a designated local directory
2. WHEN the local directory does not exist THEN the Python Core SHALL create it automatically
3. WHEN Script Files are stored THEN the system SHALL use a consistent naming convention with timestamps
4. WHEN the Desktop App starts THEN the system SHALL verify the local storage directory is accessible
5. WHEN multiple Script Files exist THEN the system SHALL identify the most recent file for default playback

### Requirement 7

**User Story:** As a user, I want accurate timing preserved during playback, so that automated workflows execute at the same pace as my original actions.

#### Acceptance Criteria

1. WHEN the Python Core records an Action THEN the system SHALL capture the timestamp relative to recording start
2. WHEN the Python Core plays back actions THEN the system SHALL respect the time delays between consecutive actions
3. WHEN calculating delays THEN the system SHALL use the difference between consecutive action timestamps
4. WHEN playback timing is implemented THEN the system SHALL maintain accuracy within 50 milliseconds
5. WHEN very long delays are detected (over 5 seconds) THEN the system SHALL cap the delay to prevent excessive waiting

### Requirement 8

**User Story:** As a developer, I want the Python Core to use PyAutoGUI for system automation, so that the solution works cross-platform and is well-supported.

#### Acceptance Criteria

1. WHEN the Python Core captures mouse events THEN the system SHALL use PyAutoGUI or equivalent libraries
2. WHEN the Python Core captures keyboard events THEN the system SHALL use PyAutoGUI or equivalent libraries
3. WHEN the Python Core replays actions THEN the system SHALL use PyAutoGUI to simulate mouse and keyboard events
4. WHEN PyAutoGUI is unavailable THEN the system SHALL report a clear error message to the Desktop App
5. WHEN the Python Core initializes THEN the system SHALL verify PyAutoGUI is properly installed and functional

### Requirement 9

**User Story:** As a user, I want clear error messages when something goes wrong, so that I can understand and resolve issues quickly.

#### Acceptance Criteria

1. WHEN an error occurs during recording THEN the Desktop App SHALL display a user-friendly error message
2. WHEN an error occurs during playback THEN the Desktop App SHALL stop playback and display the error
3. WHEN a Script File is corrupted THEN the system SHALL detect the issue and inform the user
4. WHEN the Python Core is unavailable THEN the Desktop App SHALL display a connection error message
5. WHEN permissions are insufficient for automation THEN the system SHALL provide guidance on enabling required permissions
