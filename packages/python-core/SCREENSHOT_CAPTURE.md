# Screenshot Capture Feature

## Overview

The Desktop Recorder MVP now supports automatic screenshot capture during recording sessions. When enabled, the system captures a screenshot every time the user clicks the mouse, providing visual context for each click action.

## Features

- **Automatic Capture**: Screenshots are automatically captured on every mouse click
- **Sequential Numbering**: Screenshots are numbered sequentially (screenshot_0001.png, screenshot_0002.png, etc.)
- **Optional**: Screenshot capture can be enabled or disabled per recording session
- **Graceful Degradation**: If screenshot capture fails, recording continues without interruption
- **Organized Storage**: Screenshots are stored in a dedicated directory alongside the script file

## Dependencies

Screenshot capture requires the **Pillow** library:

```bash
pip install Pillow
```

This dependency is included in `requirements.txt` and will be installed automatically.

## Usage

### Python Core

#### Enable Screenshot Capture (Default)

```python
from recorder.recorder import Recorder
from pathlib import Path

# Create recorder with screenshot capture enabled
screenshots_dir = Path("~/GeniusQA/recordings/script_20240101_120000_screenshots")
recorder = Recorder(screenshots_dir=screenshots_dir, capture_screenshots=True)

recorder.start_recording()
# ... user performs actions ...
actions = recorder.stop_recording()
```

#### Disable Screenshot Capture

```python
# Create recorder without screenshot capture
recorder = Recorder(capture_screenshots=False)

recorder.start_recording()
# ... user performs actions ...
actions = recorder.stop_recording()
```

### IPC Commands

Screenshot capture can be controlled via the `start_recording` command:

```json
{
  "command": "start_recording",
  "params": {
    "captureScreenshots": true
  }
}
```

Set `captureScreenshots` to `false` to disable screenshot capture for a recording session.

## Data Model

The `Action` model now includes an optional `screenshot` field:

```python
class Action(BaseModel):
    type: Literal['mouse_move', 'mouse_click', 'key_press', 'key_release']
    timestamp: float
    x: Optional[int] = None
    y: Optional[int] = None
    button: Optional[Literal['left', 'right', 'middle']] = None
    key: Optional[str] = None
    screenshot: Optional[str] = None  # NEW: Filename of captured screenshot
```

### Example Script File with Screenshots

```json
{
  "metadata": {
    "version": "1.0",
    "created_at": "2024-01-01T12:00:00Z",
    "duration": 10.5,
    "action_count": 3,
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
      "button": "left",
      "screenshot": "screenshot_0001.png"
    },
    {
      "type": "mouse_click",
      "timestamp": 2.0,
      "x": 150,
      "y": 250,
      "button": "left",
      "screenshot": "screenshot_0002.png"
    }
  ]
}
```

## Storage Structure

Screenshots are stored in a directory named after the script file:

```
~/GeniusQA/recordings/
├── script_20240101_120000.json
└── script_20240101_120000_screenshots/
    ├── screenshot_0001.png
    ├── screenshot_0002.png
    └── screenshot_0003.png
```

## Error Handling

- If Pillow is not installed and screenshot capture is enabled, recording will fail with a clear error message
- If screenshot capture fails during recording (e.g., permission issues), the error is logged but recording continues
- Failed screenshot captures result in `null` values in the `screenshot` field

## Testing

The feature includes comprehensive unit tests:

```bash
cd packages/python-core
python -m pytest src/recorder/test_screenshot_capture.py -v
```

Test coverage includes:
- Screenshot capture on mouse clicks
- Sequential numbering of screenshots
- Disabling screenshot capture
- Graceful handling of screenshot failures
- Dependency checking for Pillow

## Performance Considerations

- Screenshots are captured synchronously during mouse clicks
- Each screenshot is saved immediately to disk
- Screenshot capture adds minimal overhead (~50-100ms per click)
- Large numbers of clicks may result in significant disk usage

## Future Enhancements

Potential improvements for future versions:
- Configurable screenshot quality/compression
- Screenshot capture on keyboard events
- Thumbnail generation for faster preview
- Screenshot comparison during playback
- Selective screenshot capture (e.g., only on specific actions)
