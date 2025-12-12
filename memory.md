# Memory

## Recorder / Playback / Core selection

- Start Playback not working (UI + IPC flow)
  - Status: fixed
  - Fix: Verified IPC chain (React → Tauri → Python/Rust cores). Ensured RecorderScreen, ipcBridgeService, and core_router.rs correctly forward `start_playback` with script path, speed, and loop count.

- UI-level ESC to stop playback (Rust core)
  - Status: fixed
  - Fix: Added `window` keydown listener for `Escape` in `RecorderScreen.tsx` when `status === 'playing'`, calling existing `handleStopClick()` so user can stop playback even when automation is controlling the mouse.

- Rust core playback ESC listener via rdev
  - Status: failed / disabled on macOS, crash persists
  - Attempt: In `rust-core/src/player.rs`, wrapped the `rdev::listen`-based ESC key listener in `#[cfg(not(target_os = "macos"))]` so it does not run on macOS.
  - Result: App still crashes on macOS when Rust core is active and user presses `Cmd+Tab` during both recording and playback.

- Current open issue
  - Rust core selected. Crashes on macOS when pressing `Cmd+Tab` both while recording and during playback. Terminal logs stop after "Recording session started successfully" with no Rust panic trace, suggesting a native-level crash (likely in a global hook such as `rdev::listen` or related platform APIs).
