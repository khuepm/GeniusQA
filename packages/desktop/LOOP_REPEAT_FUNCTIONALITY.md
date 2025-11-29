# Loop/Repeat Functionality

## Overview

The Desktop Recorder MVP now supports loop/repeat functionality, allowing users to replay recorded scripts multiple times automatically. This feature is useful for:

- Stress testing applications by repeating actions
- Demonstrating workflows multiple times
- Automating repetitive tasks that need to run continuously
- Testing application behavior under repeated interactions

## Features

### Loop Count Options

Users can select from the following loop count options:

- **Once (1x)**: Play the script one time (default)
- **2x**: Repeat the script 2 times
- **3x**: Repeat the script 3 times
- **5x**: Repeat the script 5 times
- **∞ (Infinite)**: Loop continuously until manually stopped

### UI Controls

The loop control is located in the RecorderScreen, below the playback speed control:

```
Loop Count: 3x
[Once] [2x] [3x] [5x] [∞]
```

The selected loop count is highlighted, and the control is only enabled when:
- The application is in idle state
- Recordings are available

### Visual Feedback

During playback with loops:

1. **Progress Display**: Shows both action progress and loop progress
   - "Action 25 of 100"
   - "Loop 2 of 3"

2. **Infinite Loop Indicator**: When infinite loop is active
   - "Loop 5 (Infinite)"

3. **Preview Card**: The visual playback preview shows current loop information

### Stopping Loops

- Click the "Stop" button at any time to interrupt playback
- Infinite loops must be manually stopped
- The system adds a 500ms delay between loop iterations

## Technical Implementation

### Python Core (Player Module)

The `Player` class accepts a `loop_count` parameter:

```python
player = Player(
    actions,
    loop_count=3,  # Repeat 3 times
    speed=1.0
)
```

- `loop_count=1`: Play once (default)
- `loop_count=0`: Infinite loop
- `loop_count=N`: Repeat N times

### IPC Protocol

The `start_playback` command accepts a `loopCount` parameter:

```json
{
  "command": "start_playback",
  "params": {
    "scriptPath": "/path/to/script.json",
    "speed": 1.0,
    "loopCount": 3
  }
}
```

Progress events include loop information:

```json
{
  "type": "progress",
  "data": {
    "currentAction": 25,
    "totalActions": 100,
    "currentLoop": 2,
    "totalLoops": 3
  }
}
```

### React Native UI

The `RecorderScreen` component manages loop state:

```typescript
const [loopCount, setLoopCount] = useState<number>(1);
const [currentLoop, setCurrentLoop] = useState<number>(1);
const [totalLoops, setTotalLoops] = useState<number>(1);

// Start playback with loop count
await ipcBridge.startPlayback(scriptPath, playbackSpeed, loopCount);
```

## Testing

### Unit Tests

The implementation includes comprehensive tests:

1. **Player Module Tests** (`test_player.py`):
   - `test_loop_count_execution`: Verifies actions execute the correct number of times
   - `test_loop_count_default`: Confirms default is 1 (play once)
   - `test_infinite_loop_initialization`: Tests infinite loop setup
   - `test_infinite_loop_can_be_stopped`: Verifies infinite loops can be interrupted
   - `test_loop_count_negative_clamped`: Tests negative values are clamped to 0
   - `test_loop_progress_callback`: Verifies progress callbacks include loop info

2. **IPC Handler Tests** (`test_handler.py`):
   - `test_loop_count_parameter`: Verifies loop count is passed to Player
   - `test_loop_count_default`: Confirms default behavior
   - `test_infinite_loop_parameter`: Tests infinite loop parameter
   - `test_combined_speed_and_loop_parameters`: Tests speed + loop together

### Manual Testing

To test the loop functionality:

1. Record a simple script (e.g., click a button, type text)
2. Select different loop counts (2x, 3x, 5x)
3. Start playback and observe:
   - Actions repeat the specified number of times
   - Progress shows current loop number
   - 500ms delay between loops
4. Test infinite loop:
   - Select ∞ option
   - Start playback
   - Verify it continues looping
   - Click Stop to interrupt
5. Test with different playback speeds:
   - Combine 2x speed with 3x loops
   - Verify both parameters work together

## Use Cases

### Example 1: Stress Testing

```typescript
// Play a login script 100 times to test server load
await ipcBridge.startPlayback(loginScriptPath, 2.0, 100);
```

### Example 2: Continuous Monitoring

```typescript
// Run a health check script continuously
await ipcBridge.startPlayback(healthCheckPath, 1.0, 0);
// Stop manually when done monitoring
```

### Example 3: Demo Mode

```typescript
// Demonstrate a workflow 3 times at half speed
await ipcBridge.startPlayback(demoScriptPath, 0.5, 3);
```

## Limitations

1. **No Loop Delay Configuration**: The 500ms delay between loops is fixed
2. **No Loop-Specific Variables**: Variables are not reset between loops
3. **No Conditional Loops**: Cannot loop until a condition is met
4. **Memory Considerations**: Very large loop counts may consume significant time

## Future Enhancements

Potential improvements for future versions:

- Configurable delay between loops
- Loop until condition met (e.g., element appears)
- Variable reset between loops
- Loop-specific error handling
- Pause/resume during loops
- Loop statistics (success rate, timing)

## Requirements Validation

This implementation addresses the optional enhancement listed in the tasks:

- ✅ Loop/repeat functionality implemented
- ✅ UI controls for loop count selection
- ✅ Visual feedback during looped playback
- ✅ Infinite loop support with manual stop
- ✅ Integration with existing speed control
- ✅ Comprehensive test coverage

## Related Documentation

- [RECORDER_README.md](./RECORDER_README.md) - Main recorder documentation
- [PLAYBACK_SPEED_CONTROL.md](./PLAYBACK_SPEED_CONTROL.md) - Playback speed feature
- [IPC_PROTOCOL.md](../python-core/IPC_PROTOCOL.md) - IPC communication protocol
