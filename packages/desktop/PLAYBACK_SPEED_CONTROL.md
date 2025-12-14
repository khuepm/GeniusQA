# Playback Speed Control

## Overview

The Desktop Recorder MVP now supports playback speed control, allowing users to adjust the speed at which recorded scripts are replayed. This feature is useful for:

- **Debugging**: Slow down playback (0.5x) to observe actions in detail
- **Quick Testing**: Speed up playback (2x) to quickly verify workflows
- **Demonstrations**: Adjust speed for optimal viewing experience

## Features

### Speed Options

The UI provides four preset speed options:

- **0.5x**: Half speed (slower playback)
- **1.0x**: Normal speed (default)
- **1.5x**: 1.5x speed
- **2.0x**: Double speed (faster playback)

### Technical Details

#### Speed Range
- Minimum: 0.1x (10% of normal speed)
- Maximum: 10.0x (10x normal speed)
- Default: 1.0x (normal speed)

#### Implementation

**Python Core (`player.py`):**
- The `Player` class accepts a `speed` parameter in its constructor
- Speed is clamped between 0.1x and 10.0x for safety
- Delays between actions are divided by the speed multiplier
- Example: With 2.0x speed, a 1-second delay becomes 0.5 seconds

**IPC Bridge (`ipcBridgeService.ts`):**
- The `startPlayback()` method accepts an optional `speed` parameter
- Speed is passed to Python Core via the IPC protocol
- Default speed is 1.0x if not specified

**UI (`RecorderScreen.tsx`):**
- Speed control buttons appear when recordings are available
- Active speed is highlighted with blue styling
- Speed can only be changed when playback is idle
- Selected speed persists across playback sessions

## Usage

### From the UI

1. Navigate to the Recorder screen
2. Ensure you have at least one recording
3. Select your desired playback speed using the speed buttons
4. Click "Start Playback" to play at the selected speed

### Programmatic Usage

```typescript
// Play at normal speed
await ipcBridge.startPlayback();

// Play at double speed
await ipcBridge.startPlayback(undefined, 2.0);

// Play specific script at half speed
await ipcBridge.startPlayback('/path/to/script.json', 0.5);
```

### Python API

```python
from player.player import Player

# Create player with 2x speed
player = Player(actions, speed=2.0)
player.start_playback()

# Speed is clamped automatically
player_slow = Player(actions, speed=0.01)  # Becomes 0.1x
player_fast = Player(actions, speed=100.0)  # Becomes 10.0x
```

## Testing

### Unit Tests

**Python Tests (`test_player.py`):**
- `test_playback_speed_multiplier`: Verifies delays are adjusted correctly
- `test_playback_speed_initialization`: Tests speed parameter acceptance
- `test_playback_speed_default`: Verifies default 1.0x speed
- `test_playback_speed_clamping`: Tests speed range limits

**IPC Tests (`test_handler.py`):**
- `test_playback_speed_parameter`: Verifies speed is passed to Player
- `test_playback_speed_default`: Tests default speed behavior

### Property-Based Tests

The speed control feature is tested with property-based testing using Hypothesis:

```python
@given(
    st.floats(min_value=0.1, max_value=10.0),  # speed
    st.floats(min_value=0.1, max_value=5.0)    # delay
)
def test_playback_speed_multiplier(speed, base_delay):
    """Verifies delays are correctly adjusted by speed multiplier"""
```

## Architecture

### Data Flow

```
User selects speed in UI
    ↓
RecorderScreen stores speed in state
    ↓
User clicks "Start Playback"
    ↓
ipcBridge.startPlayback(scriptPath, speed)
    ↓
IPC message sent to Python Core
    ↓
IPCHandler creates Player with speed parameter
    ↓
Player adjusts delays: delay / speed
    ↓
Actions execute at adjusted speed
```

### Timing Calculation

The speed multiplier affects the delay between actions:

```python
def _calculate_delay(self, current, next_action) -> float:
    delay = next_action.timestamp - current.timestamp
    capped_delay = min(delay, 5.0)  # Cap at 5 seconds
    return capped_delay / self.speed  # Apply speed
```

**Examples:**
- Normal speed (1.0x): 1.0s delay → 1.0s actual delay
- Double speed (2.0x): 1.0s delay → 0.5s actual delay
- Half speed (0.5x): 1.0s delay → 2.0s actual delay

## Limitations

1. **Speed Range**: Limited to 0.1x - 10.0x for safety and usability
2. **Action Execution**: Only delays are affected; actual action execution time is not changed
3. **System Limitations**: Very fast speeds may be limited by system response time
4. **UI Presets**: UI only shows 4 preset speeds, but API supports any value in range

## Future Enhancements

Potential improvements for future versions:

- Custom speed input field for precise control
- Speed adjustment during playback (dynamic speed control)
- Speed presets saved per script
- Visual indicator of current playback speed during execution
- Keyboard shortcuts for speed adjustment

## Related Files

- `GeniusQA/packages/python-core/src/player/player.py` - Player implementation
- `GeniusQA/packages/python-core/src/ipc/handler.py` - IPC handler
- `GeniusQA/packages/desktop/src/services/ipcBridgeService.ts` - IPC bridge
- `GeniusQA/packages/desktop/src/screens/RecorderScreen.tsx` - UI implementation
- `GeniusQA/packages/python-core/src/player/test_player.py` - Unit tests
- `GeniusQA/packages/python-core/src/ipc/test_handler.py` - IPC tests
