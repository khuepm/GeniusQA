# Script Editor Feature

## Overview

The Script Editor is a UI feature that allows users to view, edit, and manage their recorded automation scripts. It provides a comprehensive interface for script management beyond the basic record and playback functionality.

## Features

### Script List View
- View all recorded scripts in a list
- Display script metadata (filename, creation date, duration, action count)
- Select scripts to view or edit
- Delete scripts with confirmation dialog
- Refresh the script list

### Script Editor View
- View complete script metadata (version, creation date, duration, action count, platform)
- View all actions in the script with detailed information
- Edit mode for modifying scripts
- Delete individual actions from scripts
- Save changes back to the script file

### Script Management
- List all available scripts
- Load specific scripts for viewing/editing
- Save modified scripts
- Delete scripts permanently

## User Interface

### Layout
The Script Editor uses a two-panel layout:
- **Left Panel**: List of all available scripts
- **Right Panel**: Selected script details and editor

### Navigation
- Access from Dashboard: Click "Open Script Editor" button
- Access from Recorder Screen: Click "Open Script Editor" button in the "Manage Scripts" section
- Back button to return to previous screen

### Actions
- **Refresh**: Reload the script list
- **Select Script**: Click on a script in the list to view it
- **Edit**: Click "Edit" button to enter edit mode
- **Save**: Save changes to the script (only in edit mode)
- **Cancel**: Discard changes and exit edit mode
- **Delete Script**: Delete a script from the list (with confirmation)
- **Delete Action**: Remove an action from the script (only in edit mode)

## Technical Implementation

### Frontend (React Native)
- **Component**: `ScriptEditorScreen.tsx`
- **Location**: `packages/desktop/src/screens/ScriptEditorScreen.tsx`
- **Navigation**: Added to `AppNavigator.tsx` as `ScriptEditor` route

### IPC Bridge Service
New methods added to `ipcBridgeService.ts`:
- `listScripts()`: Get list of all available scripts
- `loadScript(scriptPath)`: Load a specific script file
- `saveScript(scriptPath, scriptData)`: Save changes to a script
- `deleteScript(scriptPath)`: Delete a script file

### Python Core (Backend)
New IPC commands added to `handler.py`:
- `list_scripts`: Returns array of script information
- `load_script`: Loads and returns script data
- `save_script`: Validates and saves script data
- `delete_script`: Deletes a script file

### Data Flow
1. User opens Script Editor
2. Frontend requests script list via IPC
3. Python Core scans recordings directory and returns script metadata
4. User selects a script
5. Frontend requests script data via IPC
6. Python Core loads and validates the script file
7. User edits the script (optional)
8. Frontend sends modified script data via IPC
9. Python Core validates and saves the changes

## Script File Format

Scripts are stored as JSON files with the following structure:

```json
{
  "metadata": {
    "version": "1.0",
    "created_at": "2024-01-01T12:00:00Z",
    "duration": 45.5,
    "action_count": 127,
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
      "button": "left"
    },
    {
      "type": "key_press",
      "timestamp": 1.2,
      "key": "a"
    }
  ]
}
```

## Error Handling

The Script Editor handles various error scenarios:
- **No scripts found**: Displays message to record a session first
- **Script not found**: Shows error if script file was deleted
- **Corrupted script**: Skips corrupted files in list, shows error on load
- **Invalid script data**: Validates before saving, shows error if invalid
- **Permission errors**: Shows appropriate error message
- **File system errors**: Handles disk full, read-only, etc.

## Testing

### Python Tests
Location: `packages/python-core/src/ipc/test_script_management.py`

Tests cover:
- Listing scripts (empty, with recordings, with corrupted files)
- Loading scripts (success, missing file, corrupted JSON)
- Saving scripts (success, invalid data, missing parameters)
- Deleting scripts (success, missing file)
- Complete editing workflow

Run tests:
```bash
cd packages/python-core
python3 -m pytest src/ipc/test_script_management.py -v
```

### Manual Testing
1. Record several scripts using the Recorder
2. Open Script Editor from Dashboard or Recorder screen
3. Verify all scripts appear in the list
4. Select a script and verify details are displayed
5. Click Edit and modify the script
6. Save changes and verify they persist
7. Delete a script and verify it's removed
8. Test error scenarios (corrupted files, etc.)

## Future Enhancements

Potential improvements for the Script Editor:
- Add new actions to scripts
- Reorder actions via drag-and-drop
- Duplicate scripts
- Export/import scripts
- Search and filter scripts
- Batch operations (delete multiple, merge scripts)
- Script templates
- Visual timeline view of actions
- Undo/redo functionality
- Script validation with detailed error messages
- Script comparison (diff view)

## Integration with Existing Features

The Script Editor integrates seamlessly with existing features:
- **Recorder**: Can open Script Editor to manage recorded scripts
- **Dashboard**: Provides access to Script Editor
- **Storage**: Uses same storage module and directory structure
- **IPC Bridge**: Extends existing IPC communication pattern
- **Error Handling**: Follows same error handling conventions

## Security Considerations

- Scripts are stored locally only
- File paths are validated to prevent directory traversal
- Script data is validated before saving
- Deletion requires user confirmation
- No automatic script execution from editor
- Read-only view by default (edit mode must be explicitly enabled)
