# Design Document: Test Case Driven Automation

## Overview

The Test Case Driven Automation feature transforms the current flat action recording system into a hierarchical test case structure. This design enables users to organize automation scripts as business-readable test steps while maintaining full technical functionality. The system bridges the gap between manual test cases and automation scripts, providing synchronization between test documentation and executable code.

**Key Innovation**: The dual-pane editor interface allows users to think in terms of test steps (left pane) while managing technical actions (right pane), creating a natural workflow that scales from simple recordings to complex test scenarios.

## Architecture

### Current System Analysis

The existing system uses a flat action list structure:
- **ScriptFile**: Contains metadata + flat list of actions
- **Actions**: Mouse moves, clicks, keyboard events, AI vision captures
- **Editor**: Single-pane view showing all actions sequentially
- **Player**: Executes actions in chronological order

### New Hierarchical Architecture

The new system introduces a three-tier hierarchy:
- **Test_Script**: Root container with metadata and test steps
- **Test_Step**: Logical groupings with descriptions and action references
- **Action_Pool**: Flat repository of technical actions referenced by ID

```
Test_Script
├── metadata (title, description, pre-conditions, tags)
├── steps[]
│   ├── Test_Step_1 (id, order, description, expected_result, action_ids[])
│   ├── Test_Step_2 (id, order, description, expected_result, action_ids[])
│   └── ...
└── action_pool{}
    ├── action_001 (mouse_click, timestamp, x, y, button)
    ├── action_002 (ai_vision_capture, id, prompt, ...)
    └── ...
```

## Components and Interfaces

### 1. Data Models

#### Enhanced Script Schema
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
  // Runtime-only fields (never persisted)
  status?: 'passed' | 'failed' | 'skipped' | 'pending';
  error_message?: string;
  screenshot_proof?: string;
}
```

#### Migration Strategy
- **Backward Compatibility**: Automatic migration of existing flat scripts
- **Default Step**: All legacy actions placed in "Step 1: Legacy Import"
- **Non-Destructive**: Original files preserved until explicit save

### 2. Editor Interface Components

#### Left Pane: Test Step Planner
- **Step List**: Drag-and-drop reorderable test steps
- **Visual Indicators**: 
  - ⚪ Manual (no actions mapped)
  - 🟢 Mapped (has actions)
  - 🔴 Recording (currently active for recording)
- **Step Management**: Add, edit, delete, reorder operations
- **Context Menu**: Right-click options for step operations

#### Right Pane: Action Canvas
- **Filtered View**: Shows only actions for selected step
- **Action Details**: Edit coordinates, AI prompts, timing
- **Action Insertion**: Add new actions at specific positions
- **Visual Timeline**: Actions displayed in execution order

#### Recording State Management
```typescript
interface RecordingState {
  current_active_step_id: string | null;
  recording_mode: 'step' | 'setup' | 'inactive';
  pending_actions: Action[];
}
```

### 3. Player Engine Enhancements

#### Step-Based Execution
- **Sequential Processing**: Execute steps in order 1..N
- **Failure Handling**: Stop on step failure, mark subsequent as skipped
- **Manual Step Behavior**: Skip steps with no actions, log warning
- **Continue on Failure**: Optional flag to proceed despite step failures

#### Assertion Processing
- **AI Vision Assertions**: Actions marked with `is_assertion: true`
- **Pass/Fail Logic**: Success = element found, Failure = timeout/not found
- **Evidence Capture**: Screenshots for both pass and fail scenarios

## Data Models

### Core Entities

#### TestScript (Root Entity)
```python
class TestScript(BaseModel):
    meta: ScriptMetadata
    steps: List[TestStep]
    action_pool: Dict[str, AnyAction]
    variables: Dict[str, str] = Field(default_factory=dict)
```

#### TestStep (Logical Container)
```python
class TestStep(BaseModel):
    id: str = Field(description="Unique step identifier")
    order: int = Field(ge=1, description="Execution order")
    description: str = Field(description="Human-readable step description")
    expected_result: str = Field(default="", description="Expected outcome")
    action_ids: List[str] = Field(default_factory=list, description="References to actions in pool")
    continue_on_failure: bool = Field(default=False, description="Continue execution if step fails")
```

#### Action Pool Architecture
- **Centralized Storage**: All actions stored in flat dictionary by ID
- **Reference System**: Steps reference actions by ID, not embedding
- **Deduplication**: Same action can be referenced by multiple steps
- **Garbage Collection**: Unreferenced actions can be cleaned up

### Migration Schema
```python
class LegacyScript(BaseModel):
    metadata: ScriptMetadata
    actions: List[AnyAction]
    
def migrate_legacy_script(legacy: LegacyScript) -> TestScript:
    """Convert flat action list to step-based structure"""
    # Create default step for all legacy actions
    default_step = TestStep(
        id=str(uuid.uuid4()),
        order=1,
        description="Legacy Import - Migrated Actions",
        expected_result="All actions execute successfully",
        action_ids=[str(uuid.uuid4()) for _ in legacy.actions]
    )
    
    # Build action pool with generated IDs
    action_pool = {
        action_id: action 
        for action_id, action in zip(default_step.action_ids, legacy.actions)
    }
    
    return TestScript(
        meta=legacy.metadata,
        steps=[default_step],
        action_pool=action_pool
    )
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

<function_calls>
<invoke name="prework">
<parameter name="featureName">test-case-driven-automation

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

**Consolidation Decisions:**
- Properties 1.1, 1.2, and 1.5 can be combined into a comprehensive script structure validation property
- Properties 2.1, 2.2, and 2.5 can be unified into a single recording behavior property
- Properties 3.2 and 3.3 can be combined into assertion result handling
- Properties 5.1, 5.2, and 7.4 can be merged into execution flow management
- Properties 6.1, 6.2, and 6.3 can be consolidated into migration correctness
- Properties 8.1, 8.2, and 8.5 can be unified into data persistence architecture

### Core Correctness Properties

**Property 1: Test Script Structure Validation**
*For any* test script creation or modification, the script SHALL contain all required metadata fields (title, description, pre-conditions, tags), all test steps SHALL have unique identifiers and required descriptions, and the system SHALL support unlimited test steps
**Validates: Requirements 1.1, 1.2, 1.5**

**Property 2: Step Recording Behavior**
*For any* recording session, when a test step is active, all recorded actions SHALL be mapped to that step's action_ids array in chronological order, and when no step is active, a Setup_Step SHALL be created automatically to contain the actions
**Validates: Requirements 2.1, 2.2, 2.5**

**Property 3: Step Reordering Consistency**
*For any* test script with multiple steps, when steps are reordered, the execution sequence SHALL match the new order arrangement
**Validates: Requirements 1.3**

**Property 4: Action Insertion Preservation**
*For any* existing test step, when new actions are inserted at any position, the final action order SHALL maintain chronological consistency within the step
**Validates: Requirements 2.4**

**Property 5: Action-Step Isolation**
*For any* action modification within a step, the changes SHALL not affect the organization or structure of other steps in the script
**Validates: Requirements 4.4**

**Property 6: Step Selection Filtering**
*For any* test step selection in the editor, the action display SHALL show only the actions referenced by that step's action_ids array
**Validates: Requirements 4.2**

**Property 7: Assertion Action Behavior**
*For any* AI vision action marked with is_assertion: true, the action SHALL not perform mouse or keyboard interactions and SHALL only return pass/fail status based on element detection
**Validates: Requirements 3.1**

**Property 8: Assertion Result Handling**
*For any* assertion action execution, when the target is found the step SHALL receive PASSED status, and when the target is not found after timeout the step SHALL receive FAILED status
**Validates: Requirements 3.2, 3.3**

**Property 9: Multiple Assertion Logic**
*For any* test step containing multiple assertion actions, the step SHALL pass only when all assertions succeed
**Validates: Requirements 3.4**

**Property 10: Evidence Collection**
*For any* assertion action execution, screenshots SHALL be captured as proof regardless of pass or fail outcome
**Validates: Requirements 3.5**

**Property 11: Execution Flow Management**
*For any* test script execution, steps SHALL execute in sequential order, failed steps SHALL cause subsequent steps to be marked as SKIPPED (unless continue_on_failure is enabled), and steps with no actions SHALL be skipped with appropriate logging
**Validates: Requirements 5.1, 5.2, 7.4**

**Property 12: Continue on Failure**
*For any* test step configured with continue_on_failure: true, when that step fails, subsequent steps SHALL continue executing normally
**Validates: Requirements 7.1**

**Property 13: Step Merging Preservation**
*For any* two test steps being merged, the resulting step SHALL contain all action_ids from both steps in chronological order
**Validates: Requirements 7.2**

**Property 14: Conditional Execution**
*For any* test step with conditional execution rules, the step SHALL execute only when the specified conditions based on previous step results are met
**Validates: Requirements 7.5**

**Property 15: Report Generation**
*For any* completed test execution, the report SHALL show pass/fail status for each step with descriptions, include error messages and screenshots for failed steps, and be exportable in both HTML and JSON formats
**Validates: Requirements 5.3, 5.4, 5.5**

**Property 16: Legacy Migration Correctness**
*For any* legacy flat script format, the migration SHALL automatically convert it to step-based format with all actions placed in a default step, preserve all original action data and metadata, and maintain the original script if migration fails
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

**Property 17: Format Compatibility**
*For any* system operation during transition period, both old flat format and new step-based format SHALL be supported correctly
**Validates: Requirements 6.5**

**Property 18: Data Persistence Architecture**
*For any* test script file, the format SHALL contain only static data (metadata, steps, action references), runtime status SHALL never be persisted, and action_ids SHALL reference the Action_Pool rather than embedding action data
**Validates: Requirements 8.1, 8.2, 8.5**

**Property 19: Report Separation**
*For any* test execution completion, the test report SHALL be generated as a separate output file from the script file
**Validates: Requirements 8.3**

**Property 20: Session State Isolation**
*For any* script reopened after execution, the display SHALL show original step indicators without any previous execution results
**Validates: Requirements 8.4**

## Error Handling

### Recording Phase Errors
- **No Active Step**: Automatically create Setup_Step for orphaned actions
- **Invalid Step Data**: Validate step descriptions and expected results before creation
- **Action Mapping Failures**: Graceful fallback to Setup_Step if step reference is invalid

### Execution Phase Errors
- **Step Failure Cascade**: Mark subsequent steps as SKIPPED unless continue_on_failure is enabled
- **Assertion Timeouts**: Capture failure screenshot and mark step as FAILED
- **Missing Actions**: Skip steps with no mapped actions and log appropriate warnings
- **Action Execution Errors**: Fail the containing step and provide detailed error messages

### Migration Errors
- **Format Detection Failures**: Preserve original file and log detailed error information
- **Data Corruption**: Maintain backup of original script during migration attempts
- **Partial Migration**: Rollback to original state if migration cannot complete successfully

### UI State Errors
- **Step Selection Failures**: Gracefully handle invalid step references in UI
- **Action Display Errors**: Show error placeholders for corrupted or missing actions
- **Recording State Corruption**: Reset to safe idle state if recording state becomes invalid

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit testing and property-based testing to ensure comprehensive coverage:

**Unit Testing Requirements:**
- Unit tests verify specific examples, edge cases, and error conditions
- Integration points between components (editor ↔ recorder ↔ player)
- UI component behavior and state management
- Migration scenarios with known legacy script formats
- Error handling paths and recovery mechanisms

**Property-Based Testing Requirements:**
- Property tests verify universal properties across all valid inputs using **Hypothesis** for Python components and **fast-check** for TypeScript components
- Each property-based test SHALL run a minimum of 100 iterations to ensure statistical confidence
- Each property-based test MUST be tagged with a comment referencing the design document property using format: **Feature: test-case-driven-automation, Property {number}: {property_text}**
- Property tests generate random test scripts, steps, actions, and execution scenarios
- Validation of data structure invariants across all operations

**Coverage Requirements:**
- Unit tests handle concrete scenarios and integration verification
- Property tests handle universal correctness guarantees and data integrity
- Both approaches together provide comprehensive validation of the system

### Test Data Generation

**Script Generation:**
- Random metadata with various field combinations
- Variable numbers of test steps (0 to 100+)
- Mixed action types including AI vision captures
- Edge cases: empty scripts, single-step scripts, deeply nested scenarios

**Action Generation:**
- All supported action types (mouse, keyboard, AI vision)
- Realistic coordinate ranges and timing sequences
- Invalid data scenarios for error handling validation
- Large action sequences for performance testing

**Execution Scenarios:**
- Success paths with all steps passing
- Failure scenarios with various step failure patterns
- Mixed assertion outcomes within single scripts
- Continue-on-failure behavior validation

## Implementation Notes

### Phase 1: Data Model Migration
- Extend existing ScriptFile model to support step hierarchy
- Implement automatic migration for legacy scripts
- Add validation for new step-based structure
- Maintain backward compatibility during transition

### Phase 2: Editor Interface
- Implement dual-pane layout with step planner and action canvas
- Add drag-and-drop reordering for test steps
- Integrate recording state management with step selection
- Implement visual indicators for step status

### Phase 3: Execution Engine
- Extend Player class to handle step-based execution
- Implement assertion processing for AI vision actions
- Add step-level error handling and failure cascade logic
- Generate business-language test reports

### Phase 4: Advanced Features
- Implement continue-on-failure step configuration
- Add step merging and splitting capabilities
- Implement conditional execution based on step results
- Add comprehensive test report export functionality
