# GeniusQA API Reference

## Overview

The GeniusQA Python Core provides a comprehensive FastAPI-based backend that handles test script execution, action recording, AI vision processing, and system automation. The API is designed to support both the desktop application (via IPC) and web platform (via HTTP).

## Base Configuration

- **Base URL**: `http://localhost:8000` (development)
- **API Version**: v1
- **Content Type**: `application/json`
- **Authentication**: JWT Bearer tokens (web), IPC authentication (desktop)

## Core Data Models

### TestScript
```python
class TestScript(BaseModel):
    meta: ScriptMetadata
    steps: List[TestStep]
    action_pool: Dict[str, AnyAction]
    variables: Dict[str, str] = Field(default_factory=dict)
```

### TestStep
```python
class TestStep(BaseModel):
    id: str = Field(description="Unique step identifier")
    order: int = Field(ge=1, description="Execution order")
    description: str = Field(description="Human-readable step description")
    expected_result: str = Field(default="", description="Expected outcome")
    action_ids: List[str] = Field(default_factory=list)
    continue_on_failure: bool = Field(default=False)
```

### Action Types
```python
class MouseClickAction(BaseModel):
    type: Literal["mouse_click"]
    id: str
    x: int
    y: int
    button: str = "left"
    timestamp: float

class AIVisionCaptureAction(BaseModel):
    type: Literal["ai_vision_capture"]
    id: str
    prompt: str
    is_assertion: bool = False
    timeout_ms: int = 5000
    screenshot_path: Optional[str] = None
```

## Script Management API

### Create Script
```http
POST /api/v1/scripts
Content-Type: application/json

{
  "title": "User Login Test",
  "description": "Automated login workflow validation",
  "tags": ["login", "authentication"],
  "pre_condition": "Application is running and login page is visible"
}
```

**Response:**
```json
{
  "id": "script_12345",
  "meta": {
    "id": "script_12345",
    "title": "User Login Test",
    "description": "Automated login workflow validation",
    "created_at": 1702467600,
    "tags": ["login", "authentication"],
    "pre_condition": "Application is running and login page is visible"
  },
  "steps": [],
  "action_pool": {},
  "variables": {}
}
```

### Get Script
```http
GET /api/v1/scripts/{script_id}
```

**Response:**
```json
{
  "id": "script_12345",
  "meta": { ... },
  "steps": [
    {
      "id": "step_001",
      "order": 1,
      "description": "Enter valid credentials",
      "expected_result": "Username and password fields are populated",
      "action_ids": ["action_001", "action_002"],
      "continue_on_failure": false
    }
  ],
  "action_pool": {
    "action_001": {
      "type": "mouse_click",
      "id": "action_001",
      "x": 100,
      "y": 200,
      "button": "left",
      "timestamp": 1702467650.123
    }
  },
  "variables": {}
}
```

### Update Script
```http
PUT /api/v1/scripts/{script_id}
Content-Type: application/json

{
  "meta": { ... },
  "steps": [ ... ],
  "action_pool": { ... },
  "variables": { ... }
}
```

### Delete Script
```http
DELETE /api/v1/scripts/{script_id}
```

### List Scripts
```http
GET /api/v1/scripts?page=1&limit=20&tags=login,auth
```

**Response:**
```json
{
  "scripts": [
    {
      "id": "script_12345",
      "meta": { ... },
      "step_count": 3,
      "action_count": 12,
      "last_executed": 1702467800
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

## Test Step Management API

### Add Test Step
```http
POST /api/v1/scripts/{script_id}/steps
Content-Type: application/json

{
  "description": "Verify successful login",
  "expected_result": "Dashboard is displayed with user information",
  "order": 3
}
```

### Update Test Step
```http
PUT /api/v1/scripts/{script_id}/steps/{step_id}
Content-Type: application/json

{
  "description": "Updated step description",
  "expected_result": "Updated expected result",
  "continue_on_failure": true
}
```

### Reorder Steps
```http
POST /api/v1/scripts/{script_id}/steps/reorder
Content-Type: application/json

{
  "step_orders": [
    {"step_id": "step_001", "order": 2},
    {"step_id": "step_002", "order": 1},
    {"step_id": "step_003", "order": 3}
  ]
}
```

### Delete Test Step
```http
DELETE /api/v1/scripts/{script_id}/steps/{step_id}?action_disposition=move_to_setup
```

**Query Parameters:**
- `action_disposition`: `delete_actions` | `move_to_setup` | `move_to_step:{step_id}`

## Recording API

### Start Recording Session
```http
POST /api/v1/recording/start
Content-Type: application/json

{
  "script_id": "script_12345",
  "active_step_id": "step_001"
}
```

**Response:**
```json
{
  "session_id": "rec_67890",
  "status": "recording",
  "active_step_id": "step_001",
  "started_at": 1702467900
}
```

### Stop Recording Session
```http
POST /api/v1/recording/stop
Content-Type: application/json

{
  "session_id": "rec_67890"
}
```

### Set Active Step
```http
POST /api/v1/recording/set-active-step
Content-Type: application/json

{
  "session_id": "rec_67890",
  "step_id": "step_002"
}
```

### Get Recording Status
```http
GET /api/v1/recording/status/{session_id}
```

**Response:**
```json
{
  "session_id": "rec_67890",
  "status": "recording",
  "active_step_id": "step_002",
  "actions_recorded": 5,
  "started_at": 1702467900
}
```

## Execution API

### Execute Script
```http
POST /api/v1/execution/run
Content-Type: application/json

{
  "script_id": "script_12345",
  "execution_options": {
    "continue_on_failure": false,
    "step_delay_ms": 1000,
    "screenshot_on_failure": true
  }
}
```

**Response:**
```json
{
  "execution_id": "exec_11111",
  "status": "running",
  "started_at": 1702468000,
  "script_id": "script_12345"
}
```

### Get Execution Status
```http
GET /api/v1/execution/status/{execution_id}
```

**Response:**
```json
{
  "execution_id": "exec_11111",
  "status": "completed",
  "started_at": 1702468000,
  "completed_at": 1702468015,
  "duration_ms": 15000,
  "step_results": [
    {
      "step_id": "step_001",
      "status": "passed",
      "execution_time_ms": 2300,
      "screenshot_proof": null
    },
    {
      "step_id": "step_002", 
      "status": "failed",
      "execution_time_ms": 5000,
      "error_message": "Dashboard welcome message not found after 5s timeout",
      "screenshot_proof": "screenshots/exec_11111_step_002_failure.png"
    },
    {
      "step_id": "step_003",
      "status": "skipped",
      "execution_time_ms": 0,
      "error_message": "Previous step failed"
    }
  ]
}
```

### Stop Execution
```http
POST /api/v1/execution/stop
Content-Type: application/json

{
  "execution_id": "exec_11111"
}
```

## Reporting API

### Generate Test Report
```http
POST /api/v1/reports/generate
Content-Type: application/json

{
  "execution_id": "exec_11111",
  "format": "html",
  "include_screenshots": true
}
```

**Response:**
```json
{
  "report_id": "report_22222",
  "format": "html",
  "download_url": "/api/v1/reports/download/report_22222",
  "generated_at": 1702468100
}
```

### Download Report
```http
GET /api/v1/reports/download/{report_id}
```

**Response:** Binary file download (HTML, JSON, or PDF)

### List Reports
```http
GET /api/v1/reports?script_id=script_12345&limit=10
```

## AI Vision API

### Process Vision Capture
```http
POST /api/v1/ai-vision/process
Content-Type: application/json

{
  "prompt": "login button",
  "screenshot_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "is_assertion": false,
  "timeout_ms": 5000
}
```

**Response:**
```json
{
  "found": true,
  "confidence": 0.95,
  "coordinates": {
    "x": 150,
    "y": 300,
    "width": 80,
    "height": 30
  },
  "processing_time_ms": 1200
}
```

### Validate Element Presence
```http
POST /api/v1/ai-vision/validate
Content-Type: application/json

{
  "prompt": "dashboard welcome message",
  "screenshot_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "timeout_ms": 3000
}
```

## System Automation API

### Simulate Mouse Click
```http
POST /api/v1/automation/mouse/click
Content-Type: application/json

{
  "x": 150,
  "y": 300,
  "button": "left",
  "double_click": false
}
```

### Simulate Keyboard Input
```http
POST /api/v1/automation/keyboard/type
Content-Type: application/json

{
  "text": "Hello World",
  "delay_ms": 50
}
```

### Take Screenshot
```http
POST /api/v1/automation/screenshot
Content-Type: application/json

{
  "region": {
    "x": 0,
    "y": 0,
    "width": 1920,
    "height": 1080
  }
}
```

**Response:**
```json
{
  "screenshot_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "timestamp": 1702468200,
  "dimensions": {
    "width": 1920,
    "height": 1080
  }
}
```

## WebSocket Events

### Real-time Execution Updates
```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8000/ws/execution/{execution_id}');

// Event types received:
{
  "type": "step_started",
  "step_id": "step_001",
  "timestamp": 1702468000
}

{
  "type": "step_completed",
  "step_id": "step_001", 
  "status": "passed",
  "execution_time_ms": 2300
}

{
  "type": "execution_completed",
  "execution_id": "exec_11111",
  "final_status": "failed",
  "total_duration_ms": 15000
}
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "SCRIPT_NOT_FOUND",
    "message": "Script with ID 'script_12345' not found",
    "details": {
      "script_id": "script_12345",
      "timestamp": 1702468300
    }
  }
}
```

### Common Error Codes
- `SCRIPT_NOT_FOUND`: Script ID does not exist
- `INVALID_STEP_ORDER`: Step ordering conflict
- `RECORDING_SESSION_ACTIVE`: Cannot modify script during recording
- `EXECUTION_IN_PROGRESS`: Cannot modify script during execution
- `AI_VISION_TIMEOUT`: Element not found within timeout
- `SYSTEM_AUTOMATION_ERROR`: OS-level automation failure
- `VALIDATION_ERROR`: Request data validation failed

## Rate Limiting

- **Recording API**: 100 requests/minute per session
- **Execution API**: 10 concurrent executions per user
- **AI Vision API**: 50 requests/minute per user
- **General API**: 1000 requests/hour per user

## Authentication

### JWT Token (Web Platform)
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### IPC Authentication (Desktop App)
Authentication handled automatically through Tauri's secure IPC bridge.

## SDK Examples

### Python SDK
```python
from geniusqa import GeniusQAClient

client = GeniusQAClient(base_url="http://localhost:8000")

# Create and execute a test script
script = client.create_script(
    title="Login Test",
    description="Automated login validation"
)

step = client.add_step(
    script_id=script.id,
    description="Enter credentials",
    expected_result="Fields are populated"
)

execution = client.execute_script(script.id)
result = client.wait_for_completion(execution.id)
```

### JavaScript SDK
```javascript
import { GeniusQAClient } from '@geniusqa/sdk';

const client = new GeniusQAClient('http://localhost:8000');

// Real-time execution monitoring
const execution = await client.executeScript('script_12345');
client.onExecutionUpdate(execution.id, (event) => {
  console.log(`Step ${event.step_id}: ${event.status}`);
});
```

This API provides comprehensive access to all GeniusQA automation capabilities while maintaining clean separation between business logic (test steps) and technical implementation (actions).
