# Requirements Document

## Introduction

Tính năng này gộp màn hình Script Manager vào Unified Recording Screen bằng cách thêm hệ thống tab ở phía dưới màn hình (trên thanh status). Các tab sẽ cho phép người dùng chuyển đổi giữa các chế độ xem khác nhau: Recording (mặc định), Script List, AI Builder, và Editor. Nội dung của mỗi tab sẽ hiển thị trong khu vực data ở giữa màn hình.

## Glossary

- **Unified_Recording_Screen**: Màn hình ghi hành động chính của ứng dụng desktop
- **Tab_Bar**: Thanh điều hướng tab nằm ở dưới cùng màn hình, trên thanh status
- **Data_Area**: Khu vực hiển thị nội dung chính ở giữa màn hình
- **Recording_Tab**: Tab mặc định hiển thị giao diện ghi hành động
- **Script_List_Tab**: Tab hiển thị danh sách tất cả scripts
- **AI_Builder_Tab**: Tab hiển thị giao diện tạo script bằng AI
- **Editor_Tab**: Tab hiển thị trình chỉnh sửa script
- **Status_Bar**: Thanh trạng thái ở dưới cùng màn hình

## Requirements

### Requirement 1: Tab Bar Layout

**User Story:** As a user, I want to see a tab bar at the bottom of the recording screen, so that I can easily switch between different views without leaving the main interface.

#### Acceptance Criteria

1. THE Tab_Bar SHALL be positioned at the bottom of the Unified_Recording_Screen, directly above the Status_Bar
2. THE Tab_Bar SHALL display four tabs: Recording, Script List, AI Builder, and Editor
3. WHEN the application starts, THE Recording_Tab SHALL be selected by default
4. THE Tab_Bar SHALL remain visible across all application modes (idle, recording, playing, editing)
5. THE Tab_Bar SHALL have a consistent height of 48 pixels

### Requirement 2: Recording Tab Content

**User Story:** As a user, I want the Recording tab to show the current recording interface, so that I can capture actions as before.

#### Acceptance Criteria

1. WHEN the Recording_Tab is selected, THE Data_Area SHALL display the recording interface
2. WHEN no recording session is active, THE Data_Area SHALL display "No Actions Yet. Click Record to start capturing actions."
3. WHEN a recording session is active, THE Data_Area SHALL display the list of captured actions in real-time
4. THE Recording_Tab SHALL preserve all existing recording functionality including start, stop, and pause controls

### Requirement 3: Script List Tab Integration

**User Story:** As a user, I want to access the Script List from a tab, so that I can view and manage all my scripts without navigating away.

#### Acceptance Criteria

1. WHEN the Script_List_Tab is selected, THE Data_Area SHALL display the script list interface from UnifiedScriptManager
2. THE Script_List_Tab SHALL include script filtering functionality (by source: all, recorded, AI-generated)
3. THE Script_List_Tab SHALL include search functionality
4. WHEN a script is selected in the list, THE system SHALL switch to the Editor_Tab with the selected script loaded
5. THE Script_List_Tab SHALL display script metadata including filename, creation date, action count, and source type

### Requirement 4: AI Builder Tab Integration

**User Story:** As a user, I want to access the AI Builder from a tab, so that I can create scripts using AI without leaving the main interface.

#### Acceptance Criteria

1. WHEN the AI_Builder_Tab is selected, THE Data_Area SHALL display the AI chat interface and script preview
2. THE AI_Builder_Tab SHALL include OS selector for target platform
3. THE AI_Builder_Tab SHALL include provider selection and configuration
4. WHEN a script is generated and saved, THE system SHALL refresh the Script_List_Tab
5. THE AI_Builder_Tab SHALL preserve chat history within the current session

### Requirement 5: Editor Tab Integration

**User Story:** As a user, I want to access the Script Editor from a tab, so that I can edit scripts without navigating away.

#### Acceptance Criteria

1. WHEN the Editor_Tab is selected with no script loaded, THE Data_Area SHALL display a placeholder prompting to select a script
2. WHEN the Editor_Tab is selected with a script loaded, THE Data_Area SHALL display the script editor interface
3. THE Editor_Tab SHALL support both visual editing and raw JSON editing modes
4. THE Editor_Tab SHALL display script metadata and action list
5. WHEN changes are saved in the Editor_Tab, THE Script_List_Tab SHALL be refreshed

### Requirement 6: Tab State Management

**User Story:** As a user, I want the tab system to remember my context, so that I don't lose my work when switching between tabs.

#### Acceptance Criteria

1. WHEN switching between tabs, THE system SHALL preserve the state of each tab
2. WHEN switching from Recording_Tab during an active recording, THE system SHALL continue recording in the background
3. WHEN switching to Editor_Tab from Script_List_Tab, THE system SHALL load the selected script automatically
4. THE system SHALL prevent switching to certain tabs during specific operations (e.g., cannot switch during playback)
5. WHEN the application mode changes, THE Tab_Bar SHALL update visual indicators accordingly

### Requirement 7: Visual Design

**User Story:** As a user, I want the tab bar to have a clear and consistent visual design, so that I can easily identify and select tabs.

#### Acceptance Criteria

1. THE Tab_Bar SHALL display icons and labels for each tab
2. THE active tab SHALL be visually distinguished with a highlighted background and accent color
3. THE Tab_Bar SHALL use consistent styling with the existing application theme
4. WHEN hovering over a tab, THE system SHALL display a subtle hover effect
5. THE Tab_Bar SHALL be responsive and work on different screen sizes

### Requirement 8: Keyboard Navigation

**User Story:** As a user, I want to navigate between tabs using keyboard shortcuts, so that I can work more efficiently.

#### Acceptance Criteria

1. WHEN pressing Ctrl/Cmd + 1, THE system SHALL switch to Recording_Tab
2. WHEN pressing Ctrl/Cmd + 2, THE system SHALL switch to Script_List_Tab
3. WHEN pressing Ctrl/Cmd + 3, THE system SHALL switch to AI_Builder_Tab
4. WHEN pressing Ctrl/Cmd + 4, THE system SHALL switch to Editor_Tab
5. THE keyboard shortcuts SHALL be disabled during active recording or playback to prevent accidental interruption
