# Visual Playback Preview Feature

## Overview

The Visual Playback Preview feature provides real-time visual feedback during script playback, allowing users to see exactly what actions are being executed as they happen. This enhances the user experience by making the automation process transparent and easier to understand.

## Features

### Real-Time Action Display
- Shows the current action being executed with a clear, animated preview card
- Displays action type (mouse move, click, key press/release)
- Shows action details (coordinates, button, key)
- Indicates timestamp of the action

### Progress Tracking
- Visual progress bar showing playback completion percentage
- Action counter (e.g., "Action 5 of 20")
- Smooth fade-in/fade-out animations

### Screenshot Indicators
- Shows when an action has an associated screenshot
- Provides visual indication with a camera icon

### Action Icons
- 🖱️ Mouse movement
- 👆 Mouse click
- ⌨️ Keyboard actions

## Architecture

### Backend (Python Core)

#### Player Module Enhancement
The `Player` class now supports an optional `action_callback` parameter:

```python
player = Player(
    actions,
    progress_callback=progress_handler,
    action_callback=action_preview_handler,  # New callback
    variables=variables
)
```

The `action_callback` is invoked before each action is executed, providing:
- The action object with all its properties
- The action index (0-based)

#### IPC Handler Enhancement
The IPC handler emits a new event type: `action_preview`

```json
{
  "type": "action_preview",
  "data": {
    "index": 5,
    "action": {
      "type": "mouse_click",
      "timestamp": 2.5,
      "x": 100,
      "y": 200,
      "button": "left",
      "key": null,
      "screenshot": "screenshot_001.png"
    }
  }
}
```

### Frontend (React Native)

#### Type Definitions
New types added to `recorder.types.ts`:
- `ActionData`: Represents a single action with all properties
- `ActionPreviewData`: Contains action and its index
- `IPCEventType`: Extended to include `'action_preview'`

#### RecorderScreen Component
Enhanced with:
- State management for current action and preview visibility
- Event listener for `action_preview` events
- Animated preview card with fade-in/fade-out effects
- Helper functions for formatting action display
- Progress bar visualization

## User Experience

### During Playback
1. User clicks "Start Playback"
2. Preview card fades in at the top of the screen
3. For each action:
   - Preview card updates with action details
   - Progress bar advances
   - Action counter increments
4. When playback completes, preview card fades out

### Preview Card Contents
```
🖱️ Playback Preview                    Action 5 of 20

MOUSE_CLICK
Click left button at (450, 320)
Time: 2.50s
📸 Screenshot available

[████████████░░░░░░░░] 25%
```

## Implementation Details

### Event Flow
1. Python Player starts playback
2. Before executing each action:
   - `action_callback` is invoked
   - IPC handler emits `action_preview` event
3. React Native receives event
4. UI updates preview card with action details
5. Action is executed
6. Progress callback updates progress bar

### Error Handling
- Callback errors don't stop playback
- Preview card gracefully handles missing data
- Fade-out animation on errors or completion

### Performance Considerations
- Lightweight event emission (minimal serialization)
- Efficient React state updates
- Smooth animations using native driver
- No blocking of playback execution

## Testing

### Python Tests
Located in `src/test_visual_preview.py`:
- ✅ Action callback invocation
- ✅ Error resilience
- ✅ Integration with progress callback
- ✅ Optional callback behavior

### Manual Testing
1. Record a script with various action types
2. Start playback
3. Observe preview card updates
4. Verify progress bar accuracy
5. Check fade animations
6. Test with scripts containing screenshots

## Configuration

No configuration required. The feature is automatically enabled during playback.

To disable preview (if needed in future):
- Backend: Don't pass `action_callback` to Player
- Frontend: Don't render preview card when `showPreview` is false

## Future Enhancements

Potential improvements:
- [ ] Visual overlay showing mouse cursor position
- [ ] Keyboard visualization (on-screen keyboard)
- [ ] Screenshot thumbnail display in preview
- [ ] Playback speed indicator
- [ ] Action history/timeline view
- [ ] Pause/resume with preview frozen
- [ ] Click to jump to specific action

## API Reference

### Python

#### Player.__init__
```python
def __init__(
    self, 
    actions: List, 
    progress_callback=None, 
    variables=None, 
    action_callback=None  # New parameter
):
```

**Parameters:**
- `action_callback`: Optional callable `(action, index) -> None`

#### IPC Event: action_preview
```python
{
    'type': 'action_preview',
    'data': {
        'index': int,
        'action': {
            'type': str,
            'timestamp': float,
            'x': int | None,
            'y': int | None,
            'button': str | None,
            'key': str | None,
            'screenshot': str | None
        }
    }
}
```

### TypeScript

#### ActionData Interface
```typescript
interface ActionData {
  type: 'mouse_move' | 'mouse_click' | 'key_press' | 'key_release';
  timestamp: number;
  x: number | null;
  y: number | null;
  button: 'left' | 'right' | 'middle' | null;
  key: string | null;
  screenshot: string | null;
}
```

#### ActionPreviewData Interface
```typescript
interface ActionPreviewData {
  index: number;
  action: ActionData;
}
```

## Troubleshooting

### Preview Not Showing
- Check that playback is active (status === 'playing')
- Verify IPC bridge is connected
- Check browser/app console for errors

### Preview Flickering
- Ensure animations are using native driver
- Check for rapid state updates

### Preview Out of Sync
- Verify action_callback is invoked before execution
- Check network/IPC latency

## Related Documentation
- [Recorder README](./RECORDER_README.md)
- [IPC Protocol](../python-core/IPC_PROTOCOL.md)
- [Manual Testing Guide](./MANUAL_TESTING_GUIDE.md)
