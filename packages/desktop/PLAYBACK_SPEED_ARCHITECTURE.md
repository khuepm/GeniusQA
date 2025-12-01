# Playback Speed Control - Architecture

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RecorderScreen (UI)                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Speed Control Section                              │    │
│  │                                                      │    │
│  │  Playback Speed: 1.0x                               │    │
│  │                                                      │    │
│  │  [0.5x]  [1x]  [1.5x]  [2x]                        │    │
│  │           ^^^^                                       │    │
│  │         (active)                                     │    │
│  │                                                      │    │
│  │  State: playbackSpeed = 1.0                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  [Start Playback] ──────────────────────────────────────┐  │
└──────────────────────────────────────────────────────────┼──┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────┐
│              IPCBridgeService (TypeScript)                   │
│                                                              │
│  startPlayback(scriptPath?, speed?)                         │
│      │                                                       │
│      ├─ Build params object                                 │
│      │  { scriptPath: "...", speed: 1.0 }                  │
│      │                                                       │
│      └─ sendCommand('start_playback', params)               │
│                                                              │
└──────────────────────────────────┬───────────────────────────┘
                                   │
                                   │ IPC (stdin/stdout)
                                   │ JSON message
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│              IPCHandler (Python)                             │
│                                                              │
│  _handle_start_playback(params)                             │
│      │                                                       │
│      ├─ Extract speed from params                           │
│      │  speed = params.get('speed', 1.0)                   │
│      │                                                       │
│      ├─ Load script file                                    │
│      │                                                       │
│      └─ Create Player with speed                            │
│         Player(actions, speed=speed)                        │
│                                                              │
└──────────────────────────────────┬───────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Player (Python)                             │
│                                                              │
│  __init__(actions, speed=1.0)                               │
│      │                                                       │
│      └─ self.speed = max(0.1, min(10.0, speed))            │
│         (clamp between 0.1x and 10.0x)                      │
│                                                              │
│  _calculate_delay(current, next_action)                     │
│      │                                                       │
│      ├─ delay = next.timestamp - current.timestamp          │
│      ├─ capped_delay = min(delay, 5.0)                     │
│      └─ return capped_delay / self.speed                    │
│                                                              │
│  _playback_loop()                                           │
│      │                                                       │
│      ├─ for each action:                                    │
│      │   ├─ execute_action(action)                         │
│      │   └─ sleep(calculated_delay)                        │
│      │                                                       │
│      └─ Delays are adjusted by speed multiplier            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```
User Action                 UI State              IPC Message           Python Core
─────────────────────────────────────────────────────────────────────────────────

1. User clicks [2x]
   │
   ├─> playbackSpeed = 2.0
   │
   
2. User clicks [Start Playback]
   │
   ├─> ipcBridge.startPlayback(
   │       scriptPath,
   │       2.0  ◄─── speed from state
   │   )
   │
   │                           {
   │                             command: "start_playback",
   │                             params: {
   │                               scriptPath: "...",
   │                               speed: 2.0
   │                             }
   │                           }
   │                           ────────────────────────────>
   │
   │                                                         3. Extract speed
   │                                                            speed = 2.0
   │
   │                                                         4. Create Player
   │                                                            Player(actions, speed=2.0)
   │
   │                                                         5. Start playback
   │                                                            - Action 1: execute
   │                                                            - Delay: 1.0s / 2.0 = 0.5s
   │                                                            - Action 2: execute
   │                                                            - Delay: 1.0s / 2.0 = 0.5s
   │                                                            - ...
   │
   │                           {
   │                             type: "progress",
   │                             data: { current: 1, total: 10 }
   │                           }
   │                           <────────────────────────────
   │
   ├─> Update progress UI
   │
   │                           {
   │                             type: "complete",
   │                             data: {}
   │                           }
   │                           <────────────────────────────
   │
   └─> status = 'idle'
```

## Speed Calculation Examples

### Example 1: Normal Speed (1.0x)

```
Original timestamps:
  Action 1: 0.0s
  Action 2: 1.0s
  Action 3: 2.5s

Delays:
  Between 1→2: 1.0s / 1.0 = 1.0s
  Between 2→3: 1.5s / 1.0 = 1.5s

Total playback time: 2.5s
```

### Example 2: Double Speed (2.0x)

```
Original timestamps:
  Action 1: 0.0s
  Action 2: 1.0s
  Action 3: 2.5s

Delays:
  Between 1→2: 1.0s / 2.0 = 0.5s
  Between 2→3: 1.5s / 2.0 = 0.75s

Total playback time: 1.25s (50% faster)
```

### Example 3: Half Speed (0.5x)

```
Original timestamps:
  Action 1: 0.0s
  Action 2: 1.0s
  Action 3: 2.5s

Delays:
  Between 1→2: 1.0s / 0.5 = 2.0s
  Between 2→3: 1.5s / 0.5 = 3.0s

Total playback time: 5.0s (100% slower)
```

### Example 4: Long Delay with Speed

```
Original timestamps:
  Action 1: 0.0s
  Action 2: 10.0s  (10 second delay)

Without speed:
  Delay: min(10.0, 5.0) = 5.0s (capped)

With 2.0x speed:
  Delay: 5.0s / 2.0 = 2.5s

With 0.5x speed:
  Delay: 5.0s / 0.5 = 10.0s
```

## State Management

### UI State

```typescript
interface RecorderScreenState {
  playbackSpeed: number;  // Current selected speed (0.5, 1.0, 1.5, 2.0)
  status: RecorderStatus; // 'idle' | 'recording' | 'playing'
  // ... other state
}
```

### Speed Button States

```
Status: idle
  ├─ Speed buttons: ENABLED
  └─ Can change speed: YES

Status: recording
  ├─ Speed buttons: DISABLED
  └─ Can change speed: NO

Status: playing
  ├─ Speed buttons: DISABLED
  └─ Can change speed: NO
```

## Error Handling

```
User selects speed
    ↓
Speed stored in UI state
    ↓
User starts playback
    ↓
Speed sent to Python Core
    ↓
Python validates and clamps speed
    ↓
    ├─ If speed < 0.1: clamp to 0.1
    ├─ If speed > 10.0: clamp to 10.0
    └─ Otherwise: use as-is
    ↓
Player uses validated speed
    ↓
Playback executes with adjusted delays
```

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Unit Tests (Python)                       │
│                                                              │
│  test_playback_speed_multiplier                             │
│    ├─ Generate random speeds (0.1 - 10.0)                  │
│    ├─ Generate random delays (0.1 - 5.0)                   │
│    └─ Verify: calculated_delay = delay / speed             │
│                                                              │
│  test_playback_speed_clamping                               │
│    ├─ Test speed < 0.1 → clamped to 0.1                   │
│    ├─ Test speed > 10.0 → clamped to 10.0                 │
│    └─ Test valid range → unchanged                         │
│                                                              │
│  test_playback_speed_default                                │
│    └─ Verify: default speed = 1.0                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 Integration Tests (Python)                   │
│                                                              │
│  test_playback_speed_parameter                              │
│    ├─ Mock IPC handler                                      │
│    ├─ Send start_playback with speed=2.0                   │
│    └─ Verify: Player created with speed=2.0                │
│                                                              │
│  test_playback_speed_default                                │
│    ├─ Send start_playback without speed                    │
│    └─ Verify: Player created with speed=1.0                │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Manual Tests (UI)                          │
│                                                              │
│  - UI element display                                        │
│  - Speed selection interaction                               │
│  - Playback at different speeds                             │
│  - State management during recording/playback               │
│  - Speed persistence across sessions                        │
│  - Cross-platform compatibility                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Memory Impact

```
Additional memory per Player instance:
  - 1 float (speed): 8 bytes
  
Total impact: Negligible
```

### CPU Impact

```
Speed calculation per action pair:
  - 1 subtraction (timestamp difference)
  - 1 min operation (delay capping)
  - 1 division (speed adjustment)
  
Total: ~3 floating-point operations
Impact: Negligible (< 1μs per action)
```

### Thread Safety

```
Speed is set during Player initialization
  ↓
Speed is read-only during playback
  ↓
No synchronization needed
  ↓
Thread-safe by design
```

## Extensibility

### Adding New Speed Presets

```typescript
// In RecorderScreen.tsx
const speedPresets = [0.5, 1.0, 1.5, 2.0, 3.0];  // Add 3.0x

speedPresets.map(speed => (
  <TouchableOpacity
    style={[styles.speedButton, playbackSpeed === speed && styles.speedButtonActive]}
    onPress={() => setPlaybackSpeed(speed)}
  >
    <Text>{speed}x</Text>
  </TouchableOpacity>
))
```

### Custom Speed Input

```typescript
// Future enhancement
<TextInput
  value={playbackSpeed.toString()}
  onChangeText={(text) => {
    const speed = parseFloat(text);
    if (!isNaN(speed) && speed >= 0.1 && speed <= 10.0) {
      setPlaybackSpeed(speed);
    }
  }}
  keyboardType="decimal-pad"
/>
```

### Dynamic Speed Control

```python
# Future enhancement - would require refactoring
class Player:
    def set_speed(self, new_speed: float):
        """Change speed during playback"""
        self.speed = max(0.1, min(10.0, new_speed))
```
