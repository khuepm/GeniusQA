# Blank Screen After Core Switch - Debug Guide

## Problem
Sau khi switch từ Python sang Rust core, giao diện trở nên trống trơn (blank screen).

## Debug Steps

### 1. Check Browser Console
Mở DevTools (F12 hoặc Cmd+Option+I) và kiểm tra:

**Console Tab:**
- Tìm `[DEBUG]` logs để theo dõi flow
- Kiểm tra errors (màu đỏ)
- Kiểm tra warnings (màu vàng)

**Key logs to look for:**
```
[DEBUG] handleCoreChange called: { newCore: 'rust', currentStatus: 'idle' }
[DEBUG] Starting core switch to: rust
[DEBUG] IPC selectCore completed
[DEBUG] Current core state updated to: rust
[DEBUG] Core status refreshed
[DEBUG] Checking for recordings...
[DEBUG] checkForRecordings result: false
[DEBUG] No recordings found, clearing state
[DEBUG] Successfully switched to rust core
[DEBUG] handleCoreChange completed, coreLoading set to false
[DEBUG] RecorderScreen render: { status: 'idle', currentCore: 'rust', hasRecordings: false, ... }
```

### 2. Check React DevTools
Install React DevTools extension và kiểm tra:

**Components Tab:**
- Tìm `RecorderScreen` component
- Xem state values
- Kiểm tra xem component có mount không
- Xem props được pass vào CoreSelector

**Profiler Tab:**
- Record một session khi switch core
- Xem component nào re-render
- Kiểm tra render time

### 3. Check Network Tab
**Kiểm tra:**
- Có failed requests không?
- Response format từ Rust core
- Response status codes

### 4. Check Elements Tab
**Kiểm tra DOM:**
- Element `.recorder-container` có tồn tại không?
- Element có CSS `display: none` hoặc `visibility: hidden` không?
- Check computed styles
- Check z-index issues

### 5. Test Rust Core Responses

**Mở Tauri DevTools Console và test:**
```javascript
// Test checkForRecordings
window.__TAURI__.invoke('check_recordings')
  .then(result => console.log('checkForRecordings:', result))
  .catch(err => console.error('Error:', err));

// Test listScripts  
window.__TAURI__.invoke('list_scripts')
  .then(result => console.log('listScripts:', result))
  .catch(err => console.error('Error:', err));

// Test getCoreStatus
window.__TAURI__.invoke('get_core_status')
  .then(result => console.log('coreStatus:', result))
  .catch(err => console.error('Error:', err));
```

## Common Issues & Solutions

### Issue 1: Component Crashes Silently
**Symptom:** No render logs, blank screen
**Solution:** Add Error Boundary

### Issue 2: CSS Display Issue
**Symptom:** Render logs present, but nothing visible
**Solution:** Check CSS, z-index, display properties

### Issue 3: State Corruption
**Symptom:** Invalid state values in render logs
**Solution:** Reset state properly in handleCoreChange

### Issue 4: IPC Response Format Mismatch
**Symptom:** Errors parsing Rust core responses
**Solution:** Match Python core response format exactly

### Issue 5: Async State Update Race Condition
**Symptom:** Inconsistent state, some updates missing
**Solution:** Use functional setState, await all updates

## Expected Behavior

### When Switching to Rust Core (No Recordings)
1. CoreSelector shows "Switching..." indicator
2. IPC call to `select_core('rust')` succeeds
3. `checkForRecordings` returns `false`
4. UI shows:
   - ✅ Header "GeniusQA Recorder"
   - ✅ Status: "Idle"
   - ✅ CoreSelector with Rust selected
   - ✅ Record/Stop Recording buttons
   - ❌ Script Selection (hidden when hasRecordings=false)
   - ❌ Playback Speed (hidden when hasRecordings=false)
   - ❌ Loop Control (hidden when hasRecordings=false)
   - ✅ Play/Stop/Pause buttons (disabled when no script selected)

### When Switching Back to Python Core (With Recordings)
1. CoreSelector shows "Switching..." indicator
2. IPC call to `select_core('python')` succeeds
3. `checkForRecordings` returns `true`
4. `listScripts` returns array of scripts
5. UI shows all controls including Script Selection, Playback Speed, Loop Control

## Debugging Commands

### Check if Tauri IPC is working
```javascript
// In browser console
window.__TAURI__.invoke('get_available_cores')
  .then(cores => console.log('Available cores:', cores));
```

### Force re-render
```javascript
// In React DevTools console
$r.forceUpdate();
```

### Check component state
```javascript
// In React DevTools console, select RecorderScreen component
console.log($r.state);
```

## Files to Check

1. `packages/desktop/src/screens/RecorderScreen.tsx` - Main component
2. `packages/desktop/src/components/CoreSelector.tsx` - Core selection UI
3. `packages/desktop/src/services/ipcBridgeService.ts` - IPC communication
4. `packages/desktop/src-tauri/src/core_router.rs` - Rust core routing
5. `packages/desktop/src/screens/RecorderScreen.css` - Styling

## Next Steps

1. Run app: `cd packages/desktop && pnpm dev`
2. Open app and DevTools
3. Switch to Rust core
4. Collect logs from console
5. Check Elements tab for DOM
6. Report findings with:
   - Console logs
   - Component state from React DevTools
   - DOM structure from Elements tab
   - Network requests if any
