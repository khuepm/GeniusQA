# Requirements Document

## Introduction

This document specifies the requirements for Phase 2 of the Rust automation core implementation, focusing on fixing playback functionality and ensuring full feature parity with the Python core. The Phase 1 implementation successfully created the core infrastructure, but playback functionality (mouse cursor movement during script replay) is not working correctly. This phase will address these issues and complete the remaining functionality gaps.

## Glossary

- **Desktop App**: The React + Vite + Tauri cross-platform desktop application component of GeniusQA
- **Python Core**: The existing Python-based backend service that handles system automation using PyAutoGUI
- **Rust Core**: The Rust-based automation backend that provides equivalent functionality to Python Core
- **Playback Engine**: The component responsible for executing recorded Script Files
- **Script File**: A JSON-formatted file containing recorded user interactions (mouse movements, clicks, keyboard inputs)
- **Platform Automation**: Platform-specific implementation of mouse, keyboard, and screen automation
- **Action Execution**: The process of performing a single recorded action during playback
- **Timing Accuracy**: The precision with which playback reproduces the original timing of recorded actions
- **Event Streaming**: Real-time communication of playback progress and status to the UI

## Requirements

### Requirement 1

**User Story:** As a user, I want playback to actually move the mouse cursor and perform actions, so that I can replay my recorded automation scripts.

#### Acceptance Criteria

1. WHEN using Rust core playback THEN the system SHALL move the mouse cursor to the recorded positions
2. WHEN playing back mouse click actions THEN the system SHALL perform actual mouse clicks at the recorded coordinates
3. WHEN playing back keyboard actions THEN the system SHALL type the recorded text and key presses
4. WHEN playback executes an action THEN the system SHALL provide visible feedback that the action occurred
5. WHEN playback completes THEN the system SHALL have executed all actions from the Script File

### Requirement 2

**User Story:** As a user, I want playback timing to match the original recording, so that automation sequences work correctly.

#### Acceptance Criteria

1. WHEN playing back a script THEN the system SHALL respect the timestamp delays between actions
2. WHEN playback speed is set to 1.0x THEN the system SHALL execute actions with the same timing as recorded
3. WHEN playback speed is adjusted THEN the system SHALL scale timing delays proportionally
4. WHEN actions have zero or minimal delay THEN the system SHALL still execute them in the correct sequence
5. WHEN playback encounters timing errors THEN the system SHALL log detailed timing information for debugging

### Requirement 3

**User Story:** As a developer, I want comprehensive logging during playback, so that I can debug issues with action execution.

#### Acceptance Criteria

1. WHEN playback starts THEN the system SHALL log the script being played and playback parameters
2. WHEN each action executes THEN the system SHALL log the action type, coordinates, and execution result
3. WHEN platform automation calls are made THEN the system SHALL log the platform-specific API calls
4. WHEN errors occur during playback THEN the system SHALL log detailed error information including stack traces
5. WHEN playback completes THEN the system SHALL log summary statistics including success rate and timing

### Requirement 4

**User Story:** As a user, I want to see real-time feedback during playback, so that I can monitor automation progress.

#### Acceptance Criteria

1. WHEN playback is active THEN the system SHALL send progress updates to the UI at regular intervals
2. WHEN each action executes THEN the system SHALL send an action preview event to the UI
3. WHEN playback is paused THEN the system SHALL update the UI status immediately
4. WHEN playback encounters errors THEN the system SHALL display error messages in the UI
5. WHEN playback completes THEN the system SHALL send a completion event with final statistics

### Requirement 5

**User Story:** As a developer, I want platform-specific automation to be properly implemented, so that actions execute correctly on each operating system.

#### Acceptance Criteria

1. WHEN running on Windows THEN the system SHALL use Windows API (SendInput) for mouse and keyboard control
2. WHEN running on macOS THEN the system SHALL use Core Graphics and Accessibility APIs for automation
3. WHEN running on Linux THEN the system SHALL use X11 or Wayland APIs for automation
4. WHEN platform automation fails THEN the system SHALL provide platform-specific error messages
5. WHEN permissions are missing THEN the system SHALL detect and report the specific permission requirements

### Requirement 6

**User Story:** As a user, I want playback to handle edge cases gracefully, so that automation is reliable.

#### Acceptance Criteria

1. WHEN script contains invalid coordinates THEN the system SHALL clamp coordinates to screen bounds
2. WHEN script contains unsupported actions THEN the system SHALL skip them and log warnings
3. WHEN playback is stopped mid-execution THEN the system SHALL clean up resources and stop immediately
4. WHEN multiple playback requests occur THEN the system SHALL reject concurrent playback attempts
5. WHEN system is under load THEN the system SHALL maintain timing accuracy within acceptable tolerance

### Requirement 7

**User Story:** As a developer, I want comprehensive error handling in the playback engine, so that failures are caught and reported properly.

#### Acceptance Criteria

1. WHEN platform automation calls fail THEN the system SHALL catch exceptions and convert them to AutomationError
2. WHEN action execution fails THEN the system SHALL decide whether to continue or abort based on error severity
3. WHEN errors occur THEN the system SHALL include context information (action index, type, coordinates)
4. WHEN critical errors occur THEN the system SHALL stop playback and notify the user
5. WHEN recoverable errors occur THEN the system SHALL log warnings and continue playback

### Requirement 8

**User Story:** As a user, I want playback controls (pause, resume, stop) to work reliably, so that I can control automation execution.

#### Acceptance Criteria

1. WHEN pause is requested during playback THEN the system SHALL pause after completing the current action
2. WHEN resume is requested THEN the system SHALL continue from the paused position
3. WHEN stop is requested THEN the system SHALL terminate playback immediately and clean up resources
4. WHEN playback is paused THEN the system SHALL not consume CPU resources
5. WHEN controls are used THEN the system SHALL update UI state within 100ms

### Requirement 9

**User Story:** As a developer, I want the playback implementation to match the design document, so that the system behaves as specified.

#### Acceptance Criteria

1. WHEN reviewing the code THEN the Player struct SHALL match the design document interface
2. WHEN executing actions THEN the execute_action_sync method SHALL handle all ActionType variants
3. WHEN managing playback state THEN the system SHALL use atomic operations for thread-safe state management
4. WHEN streaming events THEN the system SHALL use the event sender pattern as designed
5. WHEN handling loops THEN the system SHALL correctly implement loop counting and reset logic

### Requirement 10

**User Story:** As a user, I want cross-core compatibility to work correctly, so that scripts recorded with one core play back correctly with the other.

#### Acceptance Criteria

1. WHEN playing a Python-recorded script with Rust core THEN the system SHALL execute all compatible actions
2. WHEN playing a Rust-recorded script with Python core THEN the system SHALL execute all compatible actions
3. WHEN script format differences exist THEN the system SHALL handle them gracefully with warnings
4. WHEN metadata differs between cores THEN the system SHALL preserve essential playback information
5. WHEN testing cross-core compatibility THEN the system SHALL provide validation tools and reports

