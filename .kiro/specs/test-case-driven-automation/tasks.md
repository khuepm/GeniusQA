# Implementation Plan: Test Case Driven Automation

## Overview

This implementation plan transforms the current flat action recording system into a hierarchical test case structure. The plan follows an incremental approach, building from data models through UI components to execution engine enhancements.

## Task List

- [x] 1. Data Model Foundation and Migration
  - Create enhanced data models for test scripts, steps, and action pools
  - Implement automatic migration from legacy flat scripts to step-based format
  - Add validation for new hierarchical structure
  - _Requirements: 1.1, 1.2, 1.5, 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.5_

- [x] 1.1 Extend Python data models for step-based scripts
  - Create TestStep and TestScript models in storage/models.py
  - Implement Action_Pool architecture with ID-based references
  - Add validation for step descriptions and expected results
  - _Requirements: 1.1, 1.2, 1.5, 8.1, 8.5_

- [x] 1.2 Write property test for script structure validation
  - **Property 1: Test Script Structure Validation**
  - **Validates: Requirements 1.1, 1.2, 1.5**

- [x] 1.3 Implement legacy script migration logic
  - Create migration function to convert flat scripts to step-based format
  - Place all legacy actions in default "Step 1: Legacy Import" step
  - Preserve all original action data and metadata during migration
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 1.4 Write property test for migration correctness
  - **Property 16: Legacy Migration Correctness**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 1.5 Add TypeScript interfaces for frontend step management
  - Create TestScript and TestStep interfaces in desktop package
  - Update existing Action types to support action pool references
  - Add runtime state interfaces for step status tracking
  - _Requirements: 1.1, 1.2, 8.1, 8.2_

- [x] 1.6 Write property test for data persistence architecture
  - **Property 18: Data Persistence Architecture**
  - **Validates: Requirements 8.1, 8.2, 8.5**

- [x] 2. Recording Engine Integration
  - Integrate step-based recording with existing recorder
  - Implement action mapping to active test steps
  - Add support for setup step creation when no step is active
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 2.1 Extend recorder to support step-based action mapping
  - Add current_active_step_id state to recorder
  - Implement action mapping to selected step's action_ids array
  - Create automatic Setup_Step when no step is selected during recording
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 2.2 Write property test for step recording behavior
  - **Property 2: Step Recording Behavior**
  - **Validates: Requirements 2.1, 2.2, 2.5**

- [x] 2.3 Implement action insertion within existing steps
  - Add capability to insert new actions at specific positions within steps
  - Maintain chronological order when inserting actions
  - Update action_ids arrays to reflect new action positions
  - _Requirements: 2.4_

- [x] 2.4 Write property test for action insertion preservation
  - **Property 4: Action Insertion Preservation**
  - **Validates: Requirements 2.4**

- [x] 2.5 Update IPC bridge for step-based recording commands
  - Add commands for setting active recording step
  - Implement step creation and management through IPC
  - Update recording status to include active step information
  - _Requirements: 2.1, 2.2_

- [x] 3. Dual-Pane Editor Interface
  - Create new dual-pane layout with step planner and action canvas
  - Implement step management UI with drag-and-drop reordering
  - Add visual indicators for step status and recording state
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 3.1 Create TestStepPlanner component (left pane)
  - Implement step list with drag-and-drop reordering capability
  - Add visual indicators: ⚪ Manual, 🟢 Mapped, 🔴 Recording
  - Create step management controls (add, edit, delete, reorder)
  - _Requirements: 1.3, 4.1, 4.3, 4.5_

- [x] 3.2 Write property test for step reordering consistency
  - **Property 3: Step Reordering Consistency**
  - **Validates: Requirements 1.3**

- [x] 3.3 Create ActionCanvas component (right pane)
  - Display filtered actions for selected test step only
  - Implement action detail editing (coordinates, AI prompts, timing)
  - Add action insertion controls for existing steps
  - _Requirements: 4.2, 4.4_

- [x] 3.4 Write property test for step selection filtering
  - **Property 6: Step Selection Filtering**
  - **Validates: Requirements 4.2**

- [x] 3.5 Write property test for action-step isolation
  - **Property 5: Action-Step Isolation**
  - **Validates: Requirements 4.4**

- [x] 3.6 Integrate dual-pane editor with existing ScriptEditorScreen
  - Replace current single-pane action list with dual-pane layout
  - Maintain compatibility with existing script loading and saving
  - Add step-based navigation and selection state management
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. AI Vision Assertion System
  - Implement assertion mode for AI vision capture actions
  - Add pass/fail logic based on element detection results
  - Integrate assertion processing with step execution engine
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5.1 Extend AIVisionCaptureAction with assertion support
  - Add is_assertion boolean flag to AI vision actions
  - Implement assertion-only execution (no mouse/keyboard interactions)
  - Add screenshot capture for both pass and fail scenarios
  - _Requirements: 3.1, 3.5_

- [x] 5.2 Write property test for assertion action behavior
  - **Property 7: Assertion Action Behavior**
  - **Validates: Requirements 3.1**

- [x] 5.3 Write property test for evidence collection
  - **Property 10: Evidence Collection**
  - **Validates: Requirements 3.5**

- [x] 5.4 Implement assertion result processing
  - Add pass/fail status determination based on AI vision results
  - Implement timeout handling for failed element detection
  - Update step status based on assertion outcomes
  - _Requirements: 3.2, 3.3_

- [x] 5.5 Write property test for assertion result handling
  - **Property 8: Assertion Result Handling**
  - **Validates: Requirements 3.2, 3.3**

- [x] 5.6 Add multiple assertion logic for test steps
  - Implement logic where steps pass only when all assertions succeed
  - Handle mixed assertion and regular action execution within steps
  - Add comprehensive error reporting for failed assertions
  - _Requirements: 3.4_

- [x] 5.7 Write property test for multiple assertion logic
  - **Property 9: Multiple Assertion Logic**
  - **Validates: Requirements 3.4**

- [x] 6. Step-Based Execution Engine
  - Extend player to execute actions grouped by test steps
  - Implement step-level error handling and failure cascade
  - Add business-language reporting for step results
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1, 7.4_

- [x] 6.1 Extend Player class for step-based execution
  - Implement sequential step execution in defined order
  - Add step-level progress tracking and reporting
  - Handle manual steps (no actions) with appropriate skipping and logging
  - _Requirements: 5.1, 7.4_

- [x] 6.2 Write property test for execution flow management
  - **Property 11: Execution Flow Management**
  - **Validates: Requirements 5.1, 5.2, 7.4**

- [x] 6.3 Implement failure cascade and continue-on-failure logic
  - Mark subsequent steps as SKIPPED when a step fails
  - Add continue_on_failure flag support for individual steps
  - Implement conditional execution based on previous step results
  - _Requirements: 5.2, 7.1, 7.5_

- [x] 6.4 Write property test for continue on failure
  - **Property 12: Continue on Failure**
  - **Validates: Requirements 7.1**

- [x] 6.5 Write property test for conditional execution
  - **Property 14: Conditional Execution**
  - **Validates: Requirements 7.5**

- [x] 6.6 Create business-language test report generator
  - Generate step-level pass/fail reports with descriptions
  - Include error messages and screenshot evidence for failures
  - Support both HTML and JSON export formats
  - _Requirements: 5.3, 5.4, 5.5_

- [x] 6.7 Write property test for report generation
  - **Property 15: Report Generation**
  - **Validates: Requirements 5.3, 5.4, 5.5**

- [x] 6.8 Write property test for report separation
  - **Property 19: Report Separation**
  - **Validates: Requirements 8.3**

- [x] 7. Advanced Step Management Features
  - Implement step merging and splitting capabilities
  - Add advanced step configuration options
  - Integrate with existing script management workflows
  - _Requirements: 7.2, 7.3, 8.4_

- [x] 7.1 Implement step merging functionality
  - Create UI controls for merging two or more test steps
  - Combine action_ids arrays in chronological order during merge
  - Preserve all action data and maintain execution order
  - _Requirements: 7.2_

- [x] 7.2 Write property test for step merging preservation
  - **Property 13: Step Merging Preservation**
  - **Validates: Requirements 7.2**

- [x] 7.3 Add step splitting capabilities
  - Create UI for splitting single steps into multiple steps
  - Allow user selection of which actions belong to each resulting step
  - Maintain action order and references during split operations
  - _Requirements: 7.3_

- [x] 7.4 Implement session state isolation
  - Ensure script reopening shows clean state without execution results
  - Separate runtime status from persistent script data
  - Add proper state cleanup between execution sessions
  - _Requirements: 8.4_

- [x] 7.5 Write property test for session state isolation
  - **Property 20: Session State Isolation**
  - **Validates: Requirements 8.4**

- [x] 8. Integration and Compatibility
  - Ensure backward compatibility with existing workflows
  - Update all script management interfaces for step-based scripts
  - Add comprehensive error handling and recovery mechanisms
  - _Requirements: 6.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8.1 Update script storage service for step-based scripts
  - Extend scriptStorageService to handle new TestScript format
  - Maintain compatibility with existing flat script loading
  - Add validation for step-based script structure
  - _Requirements: 6.5, 8.1, 8.5_

- [x] 8.2 Write property test for format compatibility
  - **Property 17: Format Compatibility**
  - **Validates: Requirements 6.5**

- [x] 8.3 Update RecorderScreen for step-based recording
  - Integrate step selection controls with recording interface
  - Add step management UI to recorder screen
  - Update recording status display to show active step information
  - _Requirements: 2.1, 2.2, 4.1_

- [x] 8.4 Add comprehensive error handling and recovery
  - Implement graceful fallbacks for corrupted step data
  - Add validation and error reporting for invalid step configurations
  - Create recovery mechanisms for failed migrations and operations
  - _Requirements: 6.4, 8.4_

- [x] 9. Final Integration and Testing
  - Perform end-to-end testing of complete workflow
  - Validate all property-based tests and correctness guarantees
  - Ensure seamless integration with existing GeniusQA features
  - _Requirements: All_

- [x] 9.1 End-to-end workflow validation
  - Test complete workflow from script creation through execution and reporting
  - Validate step-based recording, editing, and playback functionality
  - Ensure proper integration with AI vision capture and assertion features
  - _Requirements: All_

- [x] 9.2 Write integration tests for complete workflows
  - Create comprehensive integration tests covering all major user workflows
  - Test migration scenarios with various legacy script formats
  - Validate error handling and recovery across all components
  - _Requirements: All_

- [x] 9.3 Performance optimization and validation
  - Optimize step-based execution for large scripts with many steps
  - Validate memory usage and performance with complex test scenarios
  - Ensure UI responsiveness with large numbers of steps and actions
  - _Requirements: 1.5, 4.2, 5.1_

- [x] 10. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
