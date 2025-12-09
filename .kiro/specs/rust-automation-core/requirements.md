# Requirements Document

## Introduction

This document specifies the requirements for adding a Rust-based automation core as an alternative to the existing Python core in GeniusQA Desktop. The feature enables users to choose between Python and Rust for their automation backend, providing improved performance, memory safety, and cross-platform compatibility. The Rust core will implement the same automation capabilities as the Python core while offering better resource efficiency and native system integration.

## Glossary

- **Desktop App**: The React + Vite + Tauri cross-platform desktop application component of GeniusQA
- **Python Core**: The existing Python-based backend service that handles system automation using PyAutoGUI
- **Rust Core**: The new Rust-based automation backend that provides equivalent functionality to Python Core
- **Automation Backend**: The underlying system that performs mouse and keyboard automation (either Python or Rust)
- **Core Selector**: UI component that allows users to choose between Python and Rust automation backends
- **IPC Bridge**: Inter-Process Communication mechanism between React UI and automation backends via Tauri commands
- **Script File**: A JSON-formatted file containing recorded user interactions (mouse movements, clicks, keyboard inputs)
- **Backend Configuration**: User preference settings that determine which automation core to use
- **Cross-Platform Automation**: System automation that works consistently across Windows, macOS, and Linux
- **Native System Integration**: Direct integration with operating system APIs for automation without external dependencies

## Requirements

### Requirement 1

**User Story:** As a user, I want to choose between Python and Rust automation cores, so that I can select the backend that best fits my performance and compatibility needs.

#### Acceptance Criteria

1. WHEN the Desktop App launches THEN the system SHALL display a core selection interface allowing users to choose between Python and Rust backends
2. WHEN a user selects an automation core THEN the Desktop App SHALL persist this preference and use it for all subsequent automation operations
3. WHEN a user switches automation cores THEN the Desktop App SHALL validate the selected core is available and functional before switching
4. IF the selected automation core is unavailable THEN the Desktop App SHALL display an error message and fall back to the previously working core
5. WHEN the core selection is changed THEN the Desktop App SHALL restart any active automation processes using the new core

### Requirement 2

**User Story:** As a user, I want the Rust automation core to provide the same recording functionality as Python, so that I can capture interactions with improved performance.

#### Acceptance Criteria

1. WHEN using Rust core and clicking Record THEN the system SHALL capture all mouse movements, clicks, and keyboard inputs using native Rust libraries
2. WHEN recording with Rust core THEN the system SHALL generate Script Files in the same JSON format as Python core for compatibility
3. WHEN stopping recording with Rust core THEN the system SHALL save captured actions with accurate timestamps and metadata
4. WHEN recording with Rust core THEN the system SHALL provide real-time feedback and status updates to the Desktop App
5. WHEN using Rust core THEN the system SHALL handle recording errors gracefully and provide clear error messages

### Requirement 3

**User Story:** As a user, I want the Rust automation core to provide the same playback functionality as Python, so that I can replay interactions with better performance and reliability.

#### Acceptance Criteria

1. WHEN using Rust core and starting playback THEN the system SHALL execute Script File actions with the same timing accuracy as Python core
2. WHEN playing back with Rust core THEN the system SHALL support all playback features including speed control, looping, and pause/resume
3. WHEN using Rust core playback THEN the system SHALL provide progress updates and action previews to the Desktop App
4. WHEN playback encounters errors with Rust core THEN the system SHALL handle them gracefully and report detailed error information
5. WHEN using Rust core THEN the system SHALL maintain compatibility with Script Files created by Python core

### Requirement 4

**User Story:** As a developer, I want the Rust automation core implemented as a separate package, so that it maintains clean separation and can be developed independently.

#### Acceptance Criteria

1. WHEN implementing Rust core THEN the system SHALL create a new package at `packages/rust-core` with its own Cargo.toml and dependencies
2. WHEN the Rust package is built THEN the system SHALL produce a library that can be integrated with the existing Tauri backend
3. WHEN integrating Rust core THEN the system SHALL use the same IPC command interface as Python core for seamless UI integration
4. WHEN the Rust core is unavailable THEN the system SHALL gracefully fall back to Python core without breaking functionality
5. WHEN both cores are available THEN the system SHALL allow runtime switching between them without application restart

### Requirement 5

**User Story:** As a user, I want the Rust automation core to use native system APIs, so that I get better performance and don't need external Python dependencies.

#### Acceptance Criteria

1. WHEN using Rust core on Windows THEN the system SHALL use Windows API directly for mouse and keyboard automation
2. WHEN using Rust core on macOS THEN the system SHALL use Core Graphics and Carbon APIs for automation without requiring Python
3. WHEN using Rust core on Linux THEN the system SHALL use X11 or Wayland APIs for cross-platform compatibility
4. WHEN Rust core initializes THEN the system SHALL verify required system permissions without depending on PyAutoGUI
5. WHEN using Rust core THEN the system SHALL provide equivalent or better performance compared to Python core

### Requirement 6

**User Story:** As a system administrator, I want clear indication of which automation core is active, so that I can troubleshoot issues and understand system behavior.

#### Acceptance Criteria

1. WHEN the Desktop App is running THEN the system SHALL display the currently active automation core in the UI status area
2. WHEN automation operations are performed THEN the system SHALL log which core is handling the operations
3. WHEN errors occur THEN the system SHALL clearly indicate which automation core generated the error
4. WHEN switching cores THEN the system SHALL provide visual feedback about the transition and any validation results
5. WHEN the system starts THEN the system SHALL display which automation cores are available and which is selected

### Requirement 7

**User Story:** As a user, I want seamless migration between automation cores, so that my existing recordings work regardless of which backend I choose.

#### Acceptance Criteria

1. WHEN switching from Python to Rust core THEN the system SHALL continue to support playback of all existing Script Files
2. WHEN switching from Rust to Python core THEN the system SHALL maintain compatibility with Script Files created by Rust core
3. WHEN using either core THEN the system SHALL generate Script Files with identical JSON schema and metadata structure
4. WHEN migrating between cores THEN the system SHALL preserve all user preferences for playback speed, looping, and other settings
5. WHEN both cores are available THEN the system SHALL allow users to test recordings with both backends for comparison

### Requirement 8

**User Story:** As a developer, I want the Rust core to integrate with the existing Tauri architecture, so that minimal changes are required to the current codebase.

#### Acceptance Criteria

1. WHEN implementing Rust core THEN the system SHALL extend existing Tauri commands to support core selection and routing
2. WHEN Rust core is active THEN the system SHALL use the same event system for progress updates and error reporting
3. WHEN integrating Rust core THEN the system SHALL maintain the existing IPC Bridge Service interface without breaking changes
4. WHEN both cores are available THEN the system SHALL route commands to the appropriate backend based on user selection
5. WHEN Rust core is integrated THEN the system SHALL maintain all existing error handling and user feedback mechanisms

### Requirement 9

**User Story:** As a user, I want automatic core detection and fallback, so that the application works reliably even if one automation backend is unavailable.

#### Acceptance Criteria

1. WHEN the Desktop App starts THEN the system SHALL automatically detect which automation cores are available and functional
2. WHEN the preferred core is unavailable THEN the system SHALL automatically fall back to the available alternative core
3. WHEN no automation cores are available THEN the system SHALL display clear instructions for installing required dependencies
4. WHEN a core becomes unavailable during operation THEN the system SHALL gracefully handle the failure and offer core switching
5. WHEN core availability changes THEN the system SHALL update the UI to reflect current options and status

### Requirement 10a

**User Story:** As a user, I want performance metrics and comparison between cores,4my48a  so that I can make informed decisions about which backend to use.2u
s3iúhoo
#### Acceptance Criteria

1. WHEN automation operations complete THEN the system SHALL record2 performance metrics including execution time and resource usage
2. WHEN both cores  1are available THEN the system SHALL provide a comparison view showing relative performance characteristics
3. WHEN displaying core selection THEN the system SHALL show estimated performance benefits and trade-offs for each option
4. WHEN switching cores THEN the system SHALL provide feedback about expected performance changes
5. WHEN performance1 issues occur THEN the system SHALL suggest trying the alternative automation core
1 by
a
txhw6mt4cqtp2vedt9e
c
t4so8v
