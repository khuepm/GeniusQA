# Design Document

## Overview

Tài liệu này mô tả thiết kế kỹ thuật cho việc gộp màn hình Script Manager vào Unified Recording Screen thông qua hệ thống tab. Tab bar sẽ được đặt ở dưới cùng màn hình (trên status bar) với 4 tabs: Recording (mặc định), Script List, AI Builder, và Editor.

## Architecture

### Component Hierarchy

```
UnifiedRecordingScreen
├── ToolbarArea (existing)
├── DataArea (tab content)
│   ├── RecordingTabContent
│   ├── ScriptListTabContent
│   ├── AIBuilderTabContent
│   └── EditorTabContent
├── TabBar (new)
│   ├── TabButton (Recording)
│   ├── TabButton (Script List)
│   ├── TabButton (AI Builder)
│   └── TabButton (Editor)
└── StatusBar (existing)
```

### Layout Structure

```
┌─────────────────────────────────────┐
│           Toolbar Area              │  ← Existing toolbar
├─────────────────────────────────────┤
│                                     │
│                                     │
│           Data Area                 │  ← Tab content renders here
│        (Tab Content)                │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  🎬 Recording │ 📋 List │ 🤖 AI │ ✏️ Editor │  ← New Tab Bar (48px)
├─────────────────────────────────────┤
│           Status Bar                │  ← Existing status bar
└─────────────────────────────────────┘
```

## Components and Interfaces

### TabBar Component

```typescript
// Tab type definition
export type TabType = 'recording' | 'list' | 'builder' | 'editor';

// Tab configuration
interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  shortcut: string; // e.g., "⌘1" or "Ctrl+1"
}

// TabBar props
interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  disabled?: boolean;
  applicationMode: ApplicationMode;
}

// Tab button props
interface TabButtonProps {
  tab: TabConfig;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}
```

### Tab Content Components

```typescript
// RecordingTabContent - wraps existing recording interface
interface RecordingTabContentProps {
  recordingSession: RecordingSession | null;
  actions: Action[];
  onStartRecording: () => void;
  onStopRecording: () => void;
}

// ScriptListTabContent - adapted from UnifiedScriptManager
interface ScriptListTabContentProps {
  scripts: StoredScriptInfo[];
  filter: ScriptFilter;
  onFilterChange: (filter: ScriptFilter) => void;
  onScriptSelect: (script: StoredScriptInfo) => void;
  onScriptDelete: (script: StoredScriptInfo) => void;
  loading: boolean;
}

// AIBuilderTabContent - adapted from UnifiedScriptManager
interface AIBuilderTabContentProps {
  targetOS: TargetOS;
  onOSChange: (os: TargetOS) => void;
  onScriptGenerated: (script: ScriptData) => void;
  onScriptSaved: () => void;
}

// EditorTabContent - adapted from UnifiedScriptManager
interface EditorTabContentProps {
  script: ScriptData | null;
  selectedScript: StoredScriptInfo | null;
  editMode: boolean;
  onEditModeChange: (mode: boolean) => void;
  onScriptSave: () => void;
  onActionUpdate: (index: number, field: string, value: unknown) => void;
  onActionDelete: (index: number) => void;
}
```

### Tab State Context

```typescript
// Extended UnifiedInterface state
interface TabState {
  activeTab: TabType;
  tabStates: {
    recording: RecordingTabState;
    list: ScriptListTabState;
    builder: AIBuilderTabState;
    editor: EditorTabState;
  };
}

interface RecordingTabState {
  actions: Action[];
  isRecording: boolean;
}

interface ScriptListTabState {
  filter: ScriptFilter;
  searchQuery: string;
  selectedScriptPath: string | null;
}

interface AIBuilderTabState {
  chatHistory: ChatMessage[];
  generatedScript: ScriptData | null;
  targetOS: TargetOS;
}

interface EditorTabState {
  scriptData: ScriptData | null;
  editMode: boolean;
  textEditMode: boolean;
  unsavedChanges: boolean;
}
```

## Data Models

### Tab Configuration

```typescript
const TAB_CONFIGS: TabConfig[] = [
  { id: 'recording', label: 'Recording', icon: '🎬', shortcut: '⌘1' },
  { id: 'list', label: 'Script List', icon: '📋', shortcut: '⌘2' },
  { id: 'builder', label: 'AI Builder', icon: '🤖', shortcut: '⌘3' },
  { id: 'editor', label: 'Editor', icon: '✏️', shortcut: '⌘4' },
];
```

### State Actions

```typescript
// New action types for tab management
type TabAction =
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'UPDATE_TAB_STATE'; payload: { tab: TabType; state: Partial<TabState> } }
  | { type: 'LOAD_SCRIPT_IN_EDITOR'; payload: { script: StoredScriptInfo; data: ScriptData } }
  | { type: 'REFRESH_SCRIPT_LIST' };
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tab Bar Visibility Across Modes

*For any* application mode (idle, recording, playing, editing), the Tab_Bar component SHALL be rendered and visible in the DOM.

**Validates: Requirements 1.4**

### Property 2: Recording Actions Real-time Display

*For any* recording session with N actions, when a new action is captured, the Data_Area SHALL display N+1 actions within 100ms.

**Validates: Requirements 2.3**

### Property 3: Script Filtering Correctness

*For any* script list and filter configuration, the filtered results SHALL only contain scripts matching the filter criteria (source type, search query).

**Validates: Requirements 3.2**

### Property 4: Script Selection Navigation

*For any* script selected in Script_List_Tab, the system SHALL switch activeTab to 'editor' AND load the selected script's data into EditorTabState.

**Validates: Requirements 3.4, 6.3**

### Property 5: Script Metadata Completeness

*For any* script displayed in Script_List_Tab, the rendered output SHALL include filename, creation date, action count, and source type.

**Validates: Requirements 3.5**

### Property 6: Tab State Preservation

*For any* sequence of tab switches, each tab's state (filter, search, chat history, editor content) SHALL be preserved when returning to that tab.

**Validates: Requirements 6.1, 4.5**

### Property 7: Background Recording Continuation

*For any* active recording session, switching to a different tab SHALL NOT stop the recording, and actions SHALL continue to be captured.

**Validates: Requirements 6.2**

### Property 8: Tab Switching Restrictions

*For any* playback session (isPlaying = true), attempting to switch tabs SHALL be blocked and activeTab SHALL remain unchanged.

**Validates: Requirements 6.4**

### Property 9: Keyboard Shortcuts Conditional Behavior

*For any* keyboard shortcut (Ctrl/Cmd + 1-4) pressed during recording or playback, the tab switch SHALL NOT occur.

**Validates: Requirements 8.5**

## Error Handling

### Tab Switch Errors

```typescript
// Handle errors during tab content loading
const handleTabSwitchError = (error: Error, targetTab: TabType) => {
  console.error(`Failed to switch to ${targetTab}:`, error);
  // Show error notification
  // Remain on current tab
  // Log error for debugging
};
```

### State Recovery

```typescript
// Recover from invalid tab state
const recoverTabState = (tab: TabType): TabState => {
  switch (tab) {
    case 'recording':
      return { actions: [], isRecording: false };
    case 'list':
      return { filter: { source: 'all' }, searchQuery: '', selectedScriptPath: null };
    case 'builder':
      return { chatHistory: [], generatedScript: null, targetOS: 'universal' };
    case 'editor':
      return { scriptData: null, editMode: false, textEditMode: false, unsavedChanges: false };
  }
};
```

### Unsaved Changes Warning

```typescript
// Warn user before switching tabs with unsaved changes
const handleTabChangeWithUnsavedChanges = (
  currentTab: TabType,
  targetTab: TabType,
  hasUnsavedChanges: boolean
): boolean => {
  if (hasUnsavedChanges && currentTab === 'editor') {
    return window.confirm('You have unsaved changes. Are you sure you want to switch tabs?');
  }
  return true;
};
```

## Testing Strategy

### Unit Tests

Unit tests sẽ kiểm tra các trường hợp cụ thể và edge cases:

1. **TabBar Component**
   - Renders 4 tabs with correct labels and icons
   - Active tab has correct styling
   - Click handler calls onTabChange with correct tab id
   - Disabled state prevents clicks

2. **Tab Content Components**
   - RecordingTabContent shows empty state message when no actions
   - ScriptListTabContent renders script items correctly
   - EditorTabContent shows placeholder when no script loaded

3. **Keyboard Shortcuts**
   - Ctrl/Cmd + 1-4 triggers correct tab switch
   - Shortcuts blocked during recording/playback

### Property-Based Tests

Property tests sẽ sử dụng **fast-check** library để verify các correctness properties:

```typescript
// Example property test structure
import * as fc from 'fast-check';

describe('Tab System Properties', () => {
  // Property 1: Tab bar visibility
  it('should keep tab bar visible across all modes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('idle', 'recording', 'playing', 'editing'),
        (mode) => {
          // Setup component with mode
          // Assert tab bar is visible
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6: State preservation
  it('should preserve tab state across switches', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('recording', 'list', 'builder', 'editor'), { minLength: 2, maxLength: 10 }),
        (tabSequence) => {
          // Switch through tabs
          // Verify each tab's state is preserved
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

1. **Tab Navigation Flow**
   - Select script in list → switches to editor with script loaded
   - Save script in AI Builder → refreshes script list

2. **Recording During Tab Switches**
   - Start recording → switch tabs → verify recording continues
   - Return to recording tab → verify actions are displayed

3. **Keyboard Navigation**
   - Test all shortcuts in idle mode
   - Verify shortcuts blocked during operations
