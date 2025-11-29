# IPC Protocol Documentation

## Overview

The Python Core communicates with the React Native Desktop App via JSON messages over stdin/stdout. This document describes the complete message protocol for the Desktop Recorder MVP feature.

**Architecture:**
- React Native spawns Python process as child process
- Commands sent via stdin (one JSON message per line)
- Responses sent via stdout (one JSON message per line)
- Errors logged to stderr for debugging
- Process remains alive for duration of app session

**Requirements:** 5.1, 5.3, 5.4, 5.5

## Message Format

### Command Message (stdin)

```json
{
  "command": "command_name",
  "params": {
    "param1": "value1"
  }
}
```

### Response Message (stdout)

```json
{
  "success": true,
  "data": {
    "key": "value"
  }
}
```

### Error Response (stdout)

```json
{
  "success": false,
  "error": "Error message"
}
```

### Event Message (stdout)

```json
{
  "type": "progress",
  "data": {
    "currentAction": 50,
    "totalActions": 100
  }
}
```

## Commands

### start_recording

Start capturing mouse and keyboard events.

**Request:**
```json
{
  "command": "start_recording",
  "params": {}
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "status": "recording"
  }
}
```

**Error Responses:**
- Recording already in progress
- PyAutoGUI/pynput not installed

### stop_recording

Stop capturing and save the recording to a file.

**Request:**
```json
{
  "command": "stop_recording",
  "params": {}
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "scriptPath": "/path/to/script_20240101_120000.json",
    "actionCount": 127,
    "duration": 45.5
  }
}
```

**Error Responses:**
- No recording in progress

### start_playback

Start playing back a recorded script.

**Request:**
```json
{
  "command": "start_playback",
  "params": {
    "scriptPath": "/path/to/script.json"  // Optional, uses latest if omitted
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "status": "playing",
    "actionCount": 127
  }
}
```

**Progress Events (during playback):**
```json
{
  "type": "progress",
  "data": {
    "currentAction": 50,
    "totalActions": 127
  }
}
```

**Error Responses:**
- Playback already in progress
- No recordings found
- Script file not found
- Script file corrupted

### stop_playback

Stop the current playback.

**Request:**
```json
{
  "command": "stop_playback",
  "params": {}
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "status": "stopped"
  }
}
```

**Error Responses:**
- No playback in progress

### check_recordings

Check if any recordings exist.

**Request:**
```json
{
  "command": "check_recordings",
  "params": {}
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "hasRecordings": true,
    "count": 5
  }
}
```

### get_latest

Get the path to the most recent recording.

**Request:**
```json
{
  "command": "get_latest",
  "params": {}
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "scriptPath": "/path/to/script_20240101_120000.json"
  }
}
```

**Response when no recordings exist:**
```json
{
  "success": true,
  "data": {
    "scriptPath": null
  }
}
```

## Error Messages

The IPC handler provides user-friendly error messages for common scenarios:

- **Permission denied**: "Recording failed: Permission denied. Please enable Accessibility permissions in System Preferences."
- **No recordings**: "No recordings found. Please record a session first."
- **Corrupted file**: "Script file corrupted: Unable to parse JSON. The file may be damaged."
- **Missing dependencies**: "Required libraries not installed: pyautogui. Please run: pip install pyautogui"

## Usage Example

### Starting the Python Core

```bash
cd packages/python-core/src
python3 -c "
import sys
from ipc.handler import IPCHandler
handler = IPCHandler()
handler.run()
"
```

### Sending Commands

```bash
# Check for recordings
echo '{"command": "check_recordings"}' | python3 -m ipc_handler

# Start recording
echo '{"command": "start_recording"}' | python3 -m ipc_handler

# Stop recording
echo '{"command": "stop_recording"}' | python3 -m ipc_handler

# Start playback
echo '{"command": "start_playback"}' | python3 -m ipc_handler

# Stop playback
echo '{"command": "stop_playback"}' | python3 -m ipc_handler
```

## Error Handling

All errors are caught and returned as JSON responses with `success: false`. Errors are also logged to stderr for debugging.

## Testing

Run the test suite:

```bash
cd packages/python-core
python -m pytest src/ipc/test_handler.py -v
```

Run manual tests:

```bash
python test_ipc_manual.py
```

Test with stdin/stdout:

```bash
./test_ipc_stdin.sh
```
