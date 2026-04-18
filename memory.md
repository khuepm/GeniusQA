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

## AI Builder

- Target OS + Record coordinates
  - Status: fixed
  - Fix: Propagated `targetOS` from UI into AI prompt context so AI stops asking OS.
  - Fix: Added clarification UI with `Record` button for coordinate questions; screenshot click-pick returns `(x,y)` and auto-sends it back to chat.
  - Fix: `capture_screenshot` fallback on macOS uses `screencapture` when Rust platform screenshot is not implemented.

## Script List

- Reveal in Finder button
  - Status: implemented
  - Fix: Added Tauri command `reveal_in_finder` in `packages/desktop/src-tauri/src/main.rs` (macOS uses `open -R`, Windows uses `explorer /select,`, Linux opens parent dir via `xdg-open`).
  - Fix: Added `IPCBridgeService.revealInFinder()` invoking `reveal_in_finder` + unit test.
  - Fix: Added `Reveal in Finder` button next to `Delete` in `ScriptListItem` and wired in `UnifiedScriptManager`, `ScriptEditorScreen`, `EnhancedScriptEditorScreen`.

## Recorder Options

- Screenshot capture on mouse click
  - Status: implemented
  - Feature: Added checkbox option in RecorderScreen to capture screenshots on every mouse click for AI analysis.
  - Implementation:
    - Added `captureScreenshotOnClick` state in `RecorderScreen.tsx` with checkbox UI in new "Recording Options" card
    - Updated `IPCBridgeService.startRecording()` to accept `captureScreenshotOnClick` parameter
    - Modified Tauri `start_recording` command in `main.rs` to accept `capture_screenshot_on_click` parameter
    - Added `route_command_with_options()` method in `core_router.rs` to pass options to cores
    - Added `route_to_python_with_options()` and `route_to_rust_with_options()` methods
    - Added `capture_screenshot_on_click` field to `AutomationConfig` in `rust-core/src/config.rs`
    - Added `set_capture_screenshot_on_click()` method to `Recorder` in `rust-core/src/recorder.rs`
  - Use case: AI can verify element type before executing actions (e.g., check if clicked element is an input field before typing)
