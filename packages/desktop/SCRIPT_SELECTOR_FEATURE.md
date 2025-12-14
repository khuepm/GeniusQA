# Script Selector Feature

## Overview

The Script Selector feature allows users to choose which recorded script to play back from the RecorderScreen, rather than always playing the most recent recording.

## Implementation

### User Interface

The feature adds a script selection dropdown to the RecorderScreen that appears when recordings are available:

1. **Script Selection Button**: Displays the currently selected script filename
2. **Modal Selector**: Opens a modal dialog showing all available scripts
3. **Script List**: Shows each script with:
   - Filename
   - Creation date/time
   - Duration
   - Action count
4. **Visual Feedback**: Selected script is highlighted in the list

### User Flow

1. User records one or more sessions
2. A "Selected Script" dropdown appears in the Controls section
3. User clicks the dropdown to open the script selector modal
4. User selects a script from the list
5. The selected script name is displayed in the dropdown
6. When user clicks "Start Playback", the selected script is played

### Technical Details

**State Management:**
- `selectedScriptPath`: Stores the path to the currently selected script
- `availableScripts`: Array of script metadata objects
- `showScriptSelector`: Controls modal visibility

**Key Functions:**
- `loadAvailableScripts()`: Fetches list of all scripts from Python Core
- `handleScriptSelect()`: Updates selected script and closes modal
- `openScriptSelector()`: Loads scripts and opens modal
- `getSelectedScriptName()`: Returns display name for selected script

**Integration:**
- Uses existing `ipcBridge.listScripts()` method
- Automatically refreshes script list after recording
- Defaults to latest recording on initialization
- Falls back to latest recording if no script selected

### Files Modified

- `GeniusQA/packages/desktop/src/screens/RecorderScreen.tsx`
  - Added script selection UI components
  - Added modal for script selection
  - Added state management for selected script
  - Integrated with existing IPC bridge methods

### Dependencies

No new dependencies were added. The feature uses:
- Existing `listScripts()` IPC method
- React Native's `Modal` component
- React Native's `FlatList` component
- Existing styling patterns

## User Benefits

1. **Flexibility**: Users can replay any recorded script, not just the latest
2. **Convenience**: No need to navigate to Script Editor for simple playback
3. **Clarity**: Clear visual indication of which script will be played
4. **Efficiency**: Quick access to all recordings from the main screen

## Future Enhancements

Potential improvements for this feature:
- Search/filter scripts by name or date
- Sort scripts by different criteria (date, duration, action count)
- Preview script details before selection
- Favorite/pin frequently used scripts
- Delete scripts directly from the selector
