# Implementation Plan: Unified Recording Tabs

## Overview

Kế hoạch triển khai hệ thống tab để gộp Script Manager vào Unified Recording Screen. Tab bar sẽ nằm ở dưới cùng màn hình với 4 tabs: Recording, Script List, AI Builder, và Editor.

## Tasks

- [x] 1. Tạo TabBar component và cấu trúc cơ bản
  - [x] 1.1 Tạo types và interfaces cho tab system
    - Tạo file `packages/desktop/src/types/tabSystem.types.ts`
    - Định nghĩa TabType, TabConfig, TabBarProps, TabButtonProps
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Tạo TabBar component
    - Tạo file `packages/desktop/src/components/TabBar.tsx`
    - Render 4 tabs với icons và labels
    - Xử lý active state và click events
    - _Requirements: 1.1, 1.2, 7.1, 7.2_

  - [x] 1.3 Tạo TabBar CSS styles
    - Tạo file `packages/desktop/src/components/TabBar.css`
    - Styling cho tab bar (height 48px, positioned above status bar)
    - Active tab highlighting, hover effects
    - _Requirements: 1.5, 7.2, 7.3, 7.4, 7.5_

  - [x] 1.4 Write unit tests cho TabBar component
    - Test renders 4 tabs correctly
    - Test active tab styling
    - Test click handlers
    - _Requirements: 1.2, 7.1_

- [x] 2. Tạo Tab Content Components
  - [x] 2.1 Tạo RecordingTabContent component
    - Tạo file `packages/desktop/src/components/tabs/RecordingTabContent.tsx`
    - Hiển thị empty state message khi không có actions
    - Hiển thị danh sách actions khi đang recording
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Tạo ScriptListTabContent component
    - Tạo file `packages/desktop/src/components/tabs/ScriptListTabContent.tsx`
    - Tích hợp ScriptFilter và ScriptListItem từ UnifiedScriptManager
    - Xử lý script selection để chuyển sang Editor tab
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.3 Tạo AIBuilderTabContent component
    - Tạo file `packages/desktop/src/components/tabs/AIBuilderTabContent.tsx`
    - Tích hợp AIChatInterface và ScriptPreview từ UnifiedScriptManager
    - Bao gồm OSSelector và provider configuration
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.4 Tạo EditorTabContent component
    - Tạo file `packages/desktop/src/components/tabs/EditorTabContent.tsx`
    - Hiển thị placeholder khi không có script
    - Tích hợp script editor với visual và JSON editing modes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.5 Write property test cho Script Filtering
    - **Property 3: Script Filtering Correctness**
    - **Validates: Requirements 3.2**
    - **Result**: All 11 property tests pass (100 runs each)

- [x] 3. Checkpoint - Ensure all tests pass ✅
  - Ensure all tests pass, ask the user if questions arise.
  - **Result**: All 17 TabBar unit tests pass. No TypeScript errors in completed components.

- [x] 4. Tích hợp Tab State Management
  - [x] 4.1 Mở rộng UnifiedInterface state
    - Thêm activeTab và tabStates vào UnifiedInterfaceState
    - Thêm actions cho tab management
    - _Requirements: 6.1, 6.2, 6.3_
    - **Completed**: Added TabStates interface with RecordingTabState, ScriptListTabState, AIBuilderTabState, EditorTabState. Added SET_ACTIVE_TAB, UPDATE_TAB_STATE, LOAD_SCRIPT_IN_EDITOR, REFRESH_SCRIPT_LIST actions. Added helper functions in context.

  - [x] 4.2 Implement tab state preservation
    - Lưu state của mỗi tab khi chuyển đổi
    - Restore state khi quay lại tab
    - _Requirements: 6.1, 4.5_
    - **Completed**: Tab states are preserved in the `tabStates` object. When switching tabs via `SET_ACTIVE_TAB`, only `activeTab` changes while all tab states remain intact. `UPDATE_TAB_STATE` allows updating individual tab states without affecting others.

  - [x] 4.3 Implement tab switching restrictions
    - Block tab switching during playback
    - Allow tab switching during recording (recording continues)
    - _Requirements: 6.2, 6.4_
    - **Completed**: `SET_ACTIVE_TAB` reducer blocks tab switching when `playbackSession?.isActive` is true. Recording continues in background when switching tabs (no blocking for recording mode).

  - [x] 4.4 Write property test cho Tab State Preservation
    - **Property 6: Tab State Preservation**
    - **Validates: Requirements 6.1, 4.5**
    - **Result**: All 4 property tests pass (100 runs each) - tab state preservation, no reset on switch, rapid switching integrity, correct content after switches

  - [x] 4.5 Write property test cho Tab Switching Restrictions
    - **Property 8: Tab Switching Restrictions**
    - **Validates: Requirements 6.4**
    - **Result**: All 4 property tests pass (50 runs each) - tabs functional in idle, switching allowed when not playing, all tabs clickable in idle, switching allowed during recording

- [x] 5. Tích hợp vào UnifiedInterface
  - [x] 5.1 Update UnifiedInterface layout
    - Thêm TabBar component vào layout
    - Đặt TabBar ở dưới Data Area, trên Status Bar
    - _Requirements: 1.1, 1.4_

  - [x] 5.2 Implement tab content rendering
    - Render tab content dựa trên activeTab
    - Đảm bảo Recording tab là default
    - _Requirements: 1.3, 2.1, 3.1, 4.1, 5.1_

  - [x] 5.3 Wire up tab interactions
    - Script selection → Editor tab với script loaded
    - Script saved → Refresh Script List
    - _Requirements: 3.4, 4.4, 5.5, 6.3_

  - [x] 5.4 Write property test cho Tab Bar Visibility
    - **Property 1: Tab Bar Visibility Across Modes**
    - **Validates: Requirements 1.4**

  - [x] 5.5 Write property test cho Script Selection Navigation
    - **Property 4: Script Selection Navigation**
    - **Validates: Requirements 3.4, 6.3**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - **Result**: All 12 property tests for Task 5 pass (Property 1: Tab Bar Visibility - 6 tests, Property 4: Script Selection Navigation - 6 tests).

- [-] 7. Implement Keyboard Navigation
  - [x] 7.1 Add keyboard shortcuts cho tab switching
    - Ctrl/Cmd + 1 → Recording tab
    - Ctrl/Cmd + 2 → Script List tab
    - Ctrl/Cmd + 3 → AI Builder tab
    - Ctrl/Cmd + 4 → Editor tab
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
    - **Completed**: Added keyboard shortcuts in `handleKeyDown` callback in UnifiedInterface.tsx

  - [x] 7.2 Implement shortcut restrictions
    - Disable shortcuts during recording
    - Disable shortcuts during playback
    - _Requirements: 8.5_
    - **Completed**: Shortcuts are disabled when `applicationMode === 'recording'` or `applicationMode === 'playing'` or `playbackSession?.isActive`

  - [-] 7.3 Write property test cho Keyboard Shortcuts
    - **Property 9: Keyboard Shortcuts Conditional Behavior**
    - **Validates: Requirements 8.5**
    - **Status: FAILED** - Tests written but failing due to jsdom keyboard event simulation limitations. The keyboard events dispatched to window in test environment don't properly trigger the React component's event listener. Counterexamples: ["4"], ["2"]

- [-] 8. Update CSS và Visual Polish
  - [x] 8.1 Update UnifiedInterface.css
    - Thêm styles cho tab layout
    - Đảm bảo responsive design
    - _Requirements: 7.3, 7.5_

  - [ ] 8.2 Add mode indicators
    - Visual indicators trên tab bar theo application mode
    - _Requirements: 6.5_

  - [ ] 8.3 Write unit tests cho visual states
    - Test mode indicators
    - Test responsive behavior
    - _Requirements: 6.5, 7.5_

- [-] 9. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - **Status**: 
    - TabBar unit tests: 23/23 PASS ✅
    - UnifiedInterface property tests: 21/24 PASS, 3 FAIL ❌
    - Failing tests are Property 9 (Keyboard Shortcuts Conditional Behavior) - known jsdom limitation
  - **User action required**: See Task 7.3 for details on failing keyboard shortcut tests

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Reuse existing components từ UnifiedScriptManager để giảm code duplication
