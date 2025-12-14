# Requirements Document

## Introduction

The Test Case Driven Automation feature transforms the current flat action recording system into a structured approach where users define test scenarios as natural language test steps, then record actions mapped to specific steps. This creates synchronization between test cases and automation scripts, improves readability for non-technisers, and enables business-language reporting.

## Glossary

- **Test_Script**: A structured automation script containing metadata, test steps, and action pool
- **Test_Step**: An individual step in a test case with description, expected result, and references to action IDs
- **Action_Pool**: A flat repository of all recorded technical actions referenced by steps via ID
- **Assertion_Action**: An AI vision action flagged with is_assertion: true to verify UI state without performing interactions
- **Runtime_Status**: Execution result (Passed/Failed/Skipped) generated during playback, never persisted to script file
- **Test_Report**: Output showing pass/fail status for each test step in business language
- **Setup_Step**: Default step created automatically for actions recorded without an active step context

## Requirements

### Requirement 1

**User Story:** As a QA tester, I want to define test scenarios as structured steps with descriptions and expected results, so that my automation scripts are organized and readable.

#### Acceptance Criteria

1. WHEN a user creates a new test script, THE Test_Script SHALL contain metadata including title, description, pre-conditions, and tags
2. WHEN a user adds a test step, THE Test_Step SHALL require a description and expected result
3. WHEN a user reorders test steps, THE Test_Script SHALL maintain the correct execution sequence
4. WHEN a user deletes a test step, THE Test_Script SHALL prompt for action disposition (delete actions or move to another step)
5. THE Test_Script SHALL support unlimited test steps with unique identifiers

### Requirement 2

**User Story:** As a QA tester, I want to record actions for specific test steps, so that my recorded actions are properly organized and mapped to the correct test scenarios.

#### Acceptance Criteria

1. WHEN a user selects a test step and starts recording, THE Test_Script SHALL map all subsequent actions to that step's action_ids array
2. WHEN no test step is selected during recording, THE Test_Script SHALL create a Setup_Step at index 0 and map actions there
3. WHEN a user stops recording for a step, THE Test_Script SHALL update the visual indicator to show the step has mapped actions (runtime state only)
4. WHEN a user wants to add actions to an existing step, THE Test_Script SHALL support inserting new actions at any position within the step
5. THE Test_Script SHALL maintain action order within each test step during recording

### Requirement 3

**User Story:** As a QA tester, I want to use AI vision for result verification, so that I can automatically determine if test steps pass or fail based on visual confirmation.

#### Acceptance Criteria

1. WHEN a user marks an AI vision action as an assertion, THE Assertion_Action SHALL be flagged with is_assertion: true and SHALL NOT perform mouse or keyboard interactions
2. WHEN an assertion action executes and finds the target, THE Test_Step SHALL receive Runtime_Status of PASSED
3. WHEN an assertion action executes and fails to find the target after timeout, THE Test_Step SHALL receive Runtime_Status of FAILED
4. WHEN a test step contains multiple assertion actions, THE Test_Step SHALL pass only if all assertions succeed
5. THE Assertion_Action SHALL capture screenshots as proof for both pass and fail scenarios

### Requirement 4

**User Story:** As a QA tester, I want a dual-pane editor interface, so that I can manage test steps and action details efficiently in one view.

#### Acceptance Criteria

1. WHEN the editor loads, THE Test_Script SHALL display test steps in the left pane and action details in the right pane
2. WHEN a user selects a test step, THE Test_Script SHALL show only that step's mapped actions in the right pane
3. WHEN a user adds or removes test steps, THE Test_Script SHALL update the left pane display immediately
4. WHEN a user modifies action details, THE Test_Script SHALL reflect changes in the right pane without affecting step organization
5. THE Test_Script SHALL provide visual indicators: ⚪ Manual (no actions), 🟢 Mapped (has actions), 🔴 Recording (currently active)

### Requirement 5

**User Story:** As a QA tester, I want to execute test scripts and receive business-language reports, so that I can understand test results without technical knowledge.

#### Acceptance Criteria

1. WHEN test execution begins, THE Test_Script SHALL execute steps in sequential order
2. WHEN a step fails during execution, THE Test_Script SHALL mark subsequent steps as SKIPPED
3. WHEN test execution completes, THE Test_Report SHALL show pass/fail status for each step with descriptions
4. WHEN a step fails, THE Test_Report SHALL include error messages and screenshot evidence
5. THE Test_Report SHALL be exportable in HTML and JSON formats

### Requirement 6

**User Story:** As a system administrator, I want to migrate existing flat scripts to the new step-based format, so that current automation work is preserved during the transition.

#### Acceptance Criteria

1. WHEN the system encounters an old flat script format, THE Test_Script SHALL automatically migrate it to step-based format
2. WHEN migrating a flat script, THE Test_Script SHALL place all existing actions into a default "Step 1: Migrated Actions"
3. WHEN migration completes, THE Test_Script SHALL preserve all original action data and metadata
4. WHEN migration fails, THE Test_Script SHALL maintain the original script and log the error
5. THE Test_Script SHALL support both old and new formats during the transition period

### Requirement 7

**User Story:** As a QA tester, I want flexible step execution options, so that I can handle different testing scenarios and continue execution even when some steps fail.

#### Acceptance Criteria

1. WHEN a step is configured with continue_on_failure: true, THE Test_Script SHALL continue executing subsequent steps even if that step fails
2. WHEN merging two test steps, THE Test_Script SHALL combine their action_ids arrays in the correct order
3. WHEN splitting a test step, THE Test_Script SHALL allow users to select which actions belong to each resulting step
4. WHEN a step has no mapped actions, THE Test_Script SHALL skip the step during execution and log "Step [Name] skipped (Manual step - no actions recorded)"
5. THE Test_Script SHALL support conditional step execution based on previous step results

### Requirement 8

**User Story:** As a developer, I want clear separation between persistent script data and runtime execution state, so that script files remain clean and execution results don't corrupt the original test definitions.

#### Acceptance Criteria

1. THE Test_Script file format SHALL only contain static data: metadata, steps, and action references
2. THE Runtime_Status (Passed/Failed/Skipped) SHALL never be persisted to the script file
3. WHEN execution completes, THE Test_Report SHALL be generated as a separate output file
4. WHEN reopening a script after execution, THE Test_Script SHALL show original step indicators without execution results
5. THE Test_Script SHALL maintain action_ids as references to the Action_Pool, not embedded action data
