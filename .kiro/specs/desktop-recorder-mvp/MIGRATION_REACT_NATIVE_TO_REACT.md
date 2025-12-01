# Migration: React Native to React + Vite + Tauri

## Issue Summary

The `desktop-recorder-mvp` spec and implementation have a critical architectural mismatch:

- **Spec Documents Originally Stated:** React Native desktop application
- **Actual Technology Stack:** React + Vite + Tauri (as shown in `package.json`)
- **Current Implementation:** Uses React Native components (View, Text, StyleSheet, TouchableOpacity, etc.)
- **Problem:** React Native components don't work in a Tauri + Vite environment

## What Needs to Change

### 1. Spec Documents ✅ UPDATED

The spec documents have been updated to reflect the correct technology stack:

- **requirements.md:** Updated glossary to mention "React + Vite + Tauri" instead of "React Native"
- **design.md:** Updated architecture, technology stack, and component descriptions
- **tasks.md:** Updated phase descriptions and added new migration tasks

### 2. UI Components ⚠️ NEEDS CONVERSION

All React Native components must be converted to standard React/HTML:

#### Component Mapping

| React Native | React + HTML | Notes |
|--------------|--------------|-------|
| `<View>` | `<div>` | Standard HTML container |
| `<Text>` | `<span>`, `<p>`, `<h1>`, etc. | Semantic HTML text elements |
| `<TouchableOpacity>` | `<button>` | Standard HTML button with `onClick` |
| `<ScrollView>` | `<div style={{overflow: 'auto'}}>` | CSS scrolling |
| `<Modal>` | HTML `<dialog>` or custom modal | Native dialog or React portal |
| `<FlatList>` | `.map()` with `<div>` | Standard list rendering |
| `StyleSheet.create()` | CSS Modules or styled-components | Standard CSS |
| `Animated` API | CSS transitions/animations | CSS-based animations |
| `onPress` | `onClick` | Standard event handler |

#### Files That Need Conversion

1. **GeniusQA/packages/desktop/src/screens/RecorderScreen.tsx**
   - Currently uses: View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList, Animated
   - Needs: Complete conversion to React + HTML

2. **GeniusQA/packages/desktop/src/screens/ScriptEditorScreen.tsx**
   - Likely uses similar React Native components
   - Needs: Complete conversion to React + HTML

3. **GeniusQA/packages/desktop/src/components/AuthButton.tsx**
   - May use TouchableOpacity or React Native button
   - Needs: Conversion to HTML button

4. **GeniusQA/packages/desktop/src/components/AuthInput.tsx**
   - May use React Native TextInput
   - Needs: Conversion to HTML input

5. **GeniusQA/packages/desktop/src/navigation/AppNavigator.tsx**
   - Currently may use React Navigation (React Native)
   - Should use: React Router (already in dependencies)

### 3. IPC Bridge ⚠️ NEEDS IMPLEMENTATION

The current IPC bridge likely assumes Node.js-style child process management. This needs to be replaced with Tauri's architecture:

#### Current (Incorrect) Approach
```typescript
// Node.js style - doesn't work in Tauri
import { spawn } from 'child_process';
const pythonProcess = spawn('python', ['script.py']);
```

#### Required Tauri Approach

**Frontend (TypeScript):**
```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

// Invoke Tauri command
await invoke('start_recording');

// Listen for events
await listen('playback_progress', (event) => {
  console.log('Progress:', event.payload);
});
```

**Backend (Rust - src-tauri/src/main.rs):**
```rust
use tauri::Manager;
use std::process::{Command, Stdio};

#[tauri::command]
async fn start_recording() -> Result<(), String> {
    // Spawn Python subprocess
    let output = Command::new("python")
        .arg("path/to/recorder.py")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    
    // Manage subprocess...
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording,
            start_playback,
            stop_playback,
            check_for_recordings,
            get_latest_recording,
            list_scripts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4. Testing ⚠️ NEEDS UPDATE

Tests need to be updated for React (not React Native):

- Replace `@testing-library/react-native` with `@testing-library/react`
- Update test assertions for HTML elements instead of React Native components
- Remove any React Native-specific test utilities

## Migration Steps

### Step 1: Convert RecorderScreen Component

1. Replace all React Native imports with React/HTML
2. Convert StyleSheet to CSS Modules or styled-components
3. Replace View → div
4. Replace Text → appropriate HTML text elements
5. Replace TouchableOpacity → button
6. Replace ScrollView → scrollable div
7. Replace Modal → HTML dialog or custom modal
8. Replace FlatList → standard .map() rendering
9. Replace Animated API → CSS transitions

### Step 2: Convert Other Components

1. Apply same conversions to ScriptEditorScreen
2. Convert AuthButton to HTML button
3. Convert AuthInput to HTML input
4. Update any other components using React Native

### Step 3: Implement Tauri Backend

1. Create Rust command handlers in `src-tauri/src/main.rs`
2. Implement Python subprocess management
3. Implement JSON message protocol
4. Implement event emission to frontend

### Step 4: Update IPC Bridge Service

1. Replace Node.js child_process with Tauri invoke/listen
2. Update type definitions
3. Test all commands and events

### Step 5: Update Tests

1. Replace React Native Testing Library with React Testing Library
2. Update test assertions for HTML elements
3. Run all tests and fix failures

### Step 6: Manual Testing

1. Test recording functionality
2. Test playback functionality
3. Test all UI interactions
4. Test error scenarios
5. Test on Windows, macOS, and Linux

## Benefits of This Migration

1. **Correct Architecture:** Aligns implementation with actual technology stack
2. **Better Performance:** Tauri apps are lighter and faster than Electron
3. **Native Integration:** Better OS integration through Rust
4. **Smaller Bundle Size:** No Chromium overhead
5. **Type Safety:** Rust backend provides additional type safety
6. **Standard Web Technologies:** Uses standard HTML/CSS/JS instead of React Native abstractions

## Timeline Estimate

- **Step 1 (RecorderScreen):** 4-6 hours
- **Step 2 (Other Components):** 2-4 hours
- **Step 3 (Tauri Backend):** 6-8 hours
- **Step 4 (IPC Bridge):** 2-3 hours
- **Step 5 (Tests):** 2-3 hours
- **Step 6 (Manual Testing):** 2-3 hours

**Total:** 18-27 hours of development work

## References

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Tauri Commands](https://tauri.app/v1/guides/features/command)
- [Tauri Events](https://tauri.app/v1/guides/features/events)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [CSS Modules](https://github.com/css-modules/css-modules)
