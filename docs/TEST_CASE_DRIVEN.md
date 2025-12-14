# Test Case Driven Automation

## Overview

Test Case Driven Automation is GeniusQA's core innovation that transforms traditional flat action recording into a structured, business-readable approach. Instead of recording a linear sequence of technical actions, users define test scenarios as natural language test steps, then record actions mapped to specific steps.

This creates synchronization between test cases and automation scripts, improves readability for non-technical stakeholders, and enables business-language reporting while maintaining full technical control.

## Key Concepts

### Traditional vs Test Case Driven Approach

**Traditional Flat Recording:**
```
Script: "Login Test"
1. mouse_click(100, 200)
2. type_text("username")
3. mouse_click(150, 250)
4. type_text("password")
5. mouse_click(200, 300)
6. ai_vision_capture("dashboard")
```

**Test Case Driven Approach:**
```
Script: "User Login Workflow"

Step 1: "Enter valid credentials"
  Expected: "Username and password fields are populated"
  Actions: [mouse_click(100, 200), type_text("username"), mouse_click(150, 250), type_text("password")]

Step 2: "Submit login form"
  Expected: "Login button is clicked and form submits"
  Actions: [mouse_click(200, 300)]

Step 3: "Verify successful login"
  Expected: "Dashboard is displayed with user information"
  Actions: [ai_vision_capture("dashboard", is_assertion=true)]
```

### Core Components

#### 1. Test Script
The root container that holds metadata and organizes the entire test scenario.

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
```

#### 2. Test Step
Logical groupings that represent individual test scenarios with business-readable descriptions.

```typescript
interface TestStep {
  id: string;
  order: number;
  description: string;           // "Enter valid credentials"
  expected_result: string;       // "Username and password fields are populated"
  action_ids: string[];          // References to actions in the pool
  continue_on_failure?: boolean; // Optional: continue if this step fails
}
```

#### 3. Action Pool
Centralized repository of all technical actions, referenced by ID rather than embedded in steps.

```typescript
interface ActionPool {
  [actionId: string]: Action;  // mouse_click, keyboard_input, ai_vision_capture, etc.
}
```

## Dual-Pane Editor Interface

The Test Case Driven editor provides a split-pane interface that separates business logic from technical implementation:

### Left Pane: Test Step Planner
- **Step Management**: Create, edit, delete, and reorder test steps
- **Visual Indicators**: 
  - ⚪ Manual (no actions mapped)
  - 🟢 Mapped (has actions)
  - 🔴 Recording (currently active for recording)
- **Drag & Drop**: Reorder steps with visual feedback
- **Context Menu**: Right-click operations for step management

### Right Pane: Action Canvas
- **Filtered View**: Shows only actions for the selected test step
- **Action Details**: Edit coordinates, AI prompts, timing, and parameters
- **Action Insertion**: Add new actions at specific positions within steps
- **Visual Timeline**: Actions displayed in execution order with timestamps

### Recording Workflow

1. **Create Test Steps**: Define business scenarios with descriptions and expected results
2. **Select Active Step**: Choose which step to record actions for
3. **Start Recording**: All captured actions automatically map to the active step
4. **Switch Steps**: Change active step to record actions for different scenarios
5. **Review & Edit**: Use dual-pane editor to refine steps and actions

## AI Vision Assertions

Test Case Driven Automation introduces a powerful assertion system using AI vision:

### Assertion Actions
```typescript
interface AIVisionCaptureAction {
  type: 'ai_vision_capture';
  id: string;
  prompt: string;
  is_assertion: boolean;  // Key flag for assertion mode
  timeout_ms: number;
  screenshot_path?: string;
}
```

### Assertion Behavior
- **No Interaction**: Assertion actions don't perform mouse/keyboard interactions
- **Pass/Fail Logic**: Success = element found, Failure = timeout/not found
- **Evidence Capture**: Screenshots saved for both pass and fail scenarios
- **Step-Level Results**: Steps pass only when all assertions succeed

### Example Usage
```typescript
// Regular action - performs interaction
{
  type: 'ai_vision_capture',
  prompt: 'login button',
  is_assertion: false  // Will click the button
}

// Assertion action - only verifies presence
{
  type: 'ai_vision_capture', 
  prompt: 'dashboard welcome message',
  is_assertion: true   // Only checks if element exists
}
```

## Execution Engine

### Step-Based Execution Flow

1. **Sequential Processing**: Execute steps in order 1..N
2. **Step-Level Status**: Each step receives PASSED/FAILED/SKIPPED status
3. **Failure Handling**: Failed steps cause subsequent steps to be marked SKIPPED
4. **Manual Steps**: Steps with no actions are skipped with logging
5. **Continue on Failure**: Optional flag allows execution to continue despite failures

### Execution States
```typescript
type StepStatus = 'passed' | 'failed' | 'skipped' | 'pending';

interface ExecutionResult {
  step_id: string;
  status: StepStatus;
  error_message?: string;
  screenshot_proof?: string;
  execution_time_ms: number;
}
```

### Business Language Reporting

The execution engine generates reports in natural language that non-technical stakeholders can understand:

```
Test Report: User Login Workflow
Executed: 2024-12-13 10:30:00
Duration: 2.3 seconds

✅ Step 1: Enter valid credentials
   Expected: Username and password fields are populated
   Result: PASSED - All form fields successfully populated
   
✅ Step 2: Submit login form  
   Expected: Login button is clicked and form submits
   Result: PASSED - Form submitted successfully
   
❌ Step 3: Verify successful login
   Expected: Dashboard is displayed with user information
   Result: FAILED - Dashboard welcome message not found after 5s timeout
   Evidence: screenshot_20241213_103002.png
   
⏭️ Step 4: Navigate to user profile
   Result: SKIPPED - Previous step failed
```

## Advanced Features

### Step Merging
Combine multiple test steps into a single step while preserving action order:

```typescript
// Before merging
Step 1: "Open application" -> [action_001, action_002]
Step 2: "Navigate to login" -> [action_003, action_004]

// After merging
Step 1: "Open application and navigate to login" -> [action_001, action_002, action_003, action_004]
```

### Step Splitting
Split a single step into multiple steps with user-selected action distribution:

```typescript
// Before splitting
Step 1: "Complete login process" -> [action_001, action_002, action_003, action_004]

// After splitting (user selects action distribution)
Step 1: "Enter credentials" -> [action_001, action_002]
Step 2: "Submit and verify" -> [action_003, action_004]
```

### Conditional Execution
Execute steps based on results of previous steps:

```typescript
interface TestStep {
  // ... other properties
  execution_condition?: {
    depends_on_step: string;
    required_status: 'passed' | 'failed';
  };
}
```

## Migration from Legacy Scripts

GeniusQA automatically migrates existing flat scripts to the new step-based format:

### Migration Process
1. **Detection**: System identifies legacy flat script format
2. **Default Step Creation**: All actions placed in "Step 1: Legacy Import"
3. **Data Preservation**: All original action data and metadata maintained
4. **Validation**: Migrated script validated for correctness
5. **Fallback**: Original script preserved if migration fails

### Migration Example
```python
# Legacy format
{
  "metadata": {...},
  "actions": [action1, action2, action3, ...]
}

# Migrated format
{
  "meta": {...},
  "steps": [{
    "id": "step_001",
    "order": 1,
    "description": "Legacy Import - Migrated Actions",
    "expected_result": "All actions execute successfully",
    "action_ids": ["action_001", "action_002", "action_003"]
  }],
  "action_pool": {
    "action_001": action1,
    "action_002": action2,
    "action_003": action3
  }
}
```

## Best Practices

### Writing Effective Test Steps
1. **Clear Descriptions**: Use action-oriented language ("Enter user credentials", not "Type in fields")
2. **Specific Expected Results**: Define measurable outcomes ("Login button becomes enabled")
3. **Logical Grouping**: Group related actions into coherent steps
4. **Appropriate Granularity**: Balance between too many micro-steps and overly complex steps

### Organizing Action Pools
1. **Meaningful IDs**: Use descriptive action identifiers
2. **Reusability**: Design actions that can be referenced by multiple steps
3. **Cleanup**: Remove unreferenced actions periodically
4. **Documentation**: Add comments to complex actions

### Assertion Strategy
1. **Strategic Placement**: Use assertions at key verification points
2. **Timeout Configuration**: Set appropriate timeouts for different UI elements
3. **Error Messages**: Provide clear failure descriptions
4. **Evidence Collection**: Ensure screenshots capture relevant UI state

### Performance Optimization
1. **Step Granularity**: Balance readability with execution efficiency
2. **Action Batching**: Group rapid sequential actions when appropriate
3. **Timeout Management**: Use realistic timeouts to avoid unnecessary delays
4. **Resource Cleanup**: Ensure proper cleanup of screenshots and temporary files

## Integration with GeniusQA Platform

Test Case Driven Automation integrates seamlessly with other GeniusQA components:

- **Web Dashboard**: View and manage test scripts from web interface
- **Mobile App**: Monitor test execution and receive notifications
- **Cloud Services**: Share scripts and collaborate with team members
- **Reporting**: Export test results in multiple formats (HTML, JSON, PDF)

This approach transforms automation from a purely technical activity into a collaborative process that bridges business requirements with technical implementation, making automation accessible to broader teams while maintaining the power and flexibility needed for complex scenarios.
