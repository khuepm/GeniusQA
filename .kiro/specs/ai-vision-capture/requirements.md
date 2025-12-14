# Requirements Document

## Introduction

Tính năng AI Vision Capture cho phép người dùng chèn các điểm đánh dấu AI vào quá trình ghi script. Khi nhấn tổ hợp phím Cmd+F6 (macOS) hoặc Ctrl+F6 (Windows/Linux) trong khi đang ghi, hệ thống sẽ chụp ảnh màn hình và tạo một action đặc biệt gọi là `ai_vision_capture`. 

Trong trình chỉnh sửa script, người dùng có thể:
- Khoanh vùng trên ảnh chụp (vision_region/ROI)
- Nhập prompt mô tả mục tiêu
- Dán thêm ảnh tham chiếu (reference images) để AI nhận diện chính xác hơn
- Chọn loại tương tác (Click, Double Click, Right Click, Hover)
- Chọn chế độ Static (mặc định, tiết kiệm token) hoặc Dynamic (gọi AI khi playback)

Hệ thống hỗ trợ 2 chế độ:
- **Static Mode (mặc định)**: AI phân tích ngay khi edit, lưu tọa độ vào script, playback không cần gọi AI (0 token cost)
- **Dynamic Mode**: Lưu prompt và reference images, gọi AI khi playback để tìm element trên màn hình hiện tại (cho UI động)

## Glossary

- **AI_Vision_Capture**: Action đặc biệt được chèn vào script khi người dùng nhấn hotkey, chứa ảnh chụp màn hình và thông tin kích thước màn hình
- **Vision_Region (ROI)**: Vùng hình chữ nhật được người dùng khoanh trên ảnh chụp, dùng để giới hạn phạm vi tìm kiếm của AI
- **Reference_Image**: Ảnh tham chiếu nhỏ (icon, button) được người dùng dán vào để AI so khớp visual features
- **Asset_Manager**: Module quản lý việc lưu trữ và truy xuất các file ảnh tham chiếu (tránh lưu base64 trực tiếp vào script file)
- **Interaction_Type**: Loại hành động cần thực hiện tại tọa độ tìm được (Click, Double Click, Right Click, Hover)
- **Static_Mode**: Chế độ mặc định - AI phân tích ngay khi edit, lưu tọa độ cố định, playback không tốn token
- **Dynamic_Mode**: Chế độ linh hoạt - lưu prompt/reference images, gọi AI khi playback để tìm element trên màn hình hiện tại
- **Dynamic_Cache**: Tọa độ (cached_x, cached_y) được lưu lại sau khi AI tìm thấy phần tử trong quá trình playback Dynamic Mode thành công lần đầu tiên, giúp tiết kiệm token cho các lần chạy sau
- **Cache_Dim**: Kích thước màn hình lúc cache được tạo, dùng để scale tọa độ cache khi resolution thay đổi
- **Search_Scope**: Phạm vi tìm kiếm - Global (toàn màn hình) hoặc Regional (trong ROI)
- **Recorder**: Module Python/Rust ghi lại các thao tác chuột và bàn phím
- **Script_Editor**: Giao diện chỉnh sửa script trong desktop app
- **Player**: Module thực thi playback script
- **Hotkey**: Tổ hợp phím Cmd+F6 (macOS) hoặc Ctrl+F6 (Windows/Linux)
- **Screen_Dimensions**: Kích thước màn hình (width, height) tại thời điểm chụp

## Requirements

### Requirement 1

**User Story:** As a user, I want to insert AI vision markers during recording so that I can capture the visual state of the UI for later analysis.

#### Acceptance Criteria

1.1. WHEN a user presses Cmd+F6 (macOS) or Ctrl+F6 (Windows/Linux) during recording THEN the Recorder SHALL capture a full screenshot

1.2. THE Recorder SHALL create an ai_vision_capture action containing original_screenshot_path, screen_width, screen_height, and timestamp

1.3. THE Recorder SHALL NOT interrupt the recording flow when the hotkey is pressed (mouse and keyboard hooks remain active)

1.4. WHEN the recording stops THEN all ai_vision_capture actions SHALL be saved within the script structure with their associated screenshots

### Requirement 2

**User Story:** As a user, I want to define what to look for using prompts and reference images, and specify where to look to optimize accuracy.

#### Acceptance Criteria

2.1. WHEN selecting an ai_vision_capture action THEN the Script_Editor SHALL display the screenshot with a ROI (Region of Interest) drawing tool

2.2. THE Script_Editor SHALL allow drawing and resizing a vision_region (ROI) with red dashed border lines and corner handles

2.3. THE Script_Editor SHALL provide a "Search Scope" setting with options: Global Search (ignore ROI, search full screen) and Regional Search (search only within the defined vision_region)

2.4. THE Script_Editor SHALL provide a text input area for user_prompt (description of the target element)

2.5. THE Script_Editor SHALL accept pasted images (Ctrl+V / Cmd+V) or drag-and-drop into the prompt area as reference_images

2.6. WHEN an image is pasted or dropped THEN the Script_Editor SHALL display a thumbnail preview, save the image to a local assets folder managed by the Asset_Manager, and store the relative path in the action data

2.7. THE Script_Editor SHALL allow selecting the interaction_type with options: Left Click (default), Right Click, Double Click, and Hover

2.8. WHEN multiple reference images are added THEN the Script_Editor SHALL display all thumbnails and allow removal of individual images

### Requirement 3

**User Story:** As a user, I want the system to calculate coordinates immediately during editing (Static Mode) to avoid paying AI costs during every playback.

#### Acceptance Criteria

3.1. THE default mode for new ai_vision_capture actions SHALL be Static Mode (is_dynamic = false)

3.2. WHEN in Static Mode THEN the user SHALL trigger "Analyze" to calculate coordinates

3.3. WHEN "Analyze" is triggered THEN the Script_Editor SHALL send the original captured screenshot (cropped to ROI if Regional Search is set), user_prompt, and reference_images to the AI service

3.4. WHEN AI returns coordinates THEN the Script_Editor SHALL display a pin/marker on the screenshot at the returned location and save the absolute coordinates to saved_x and saved_y

3.5. THE Script_Editor SHALL allow the user to manually drag and adjust the result marker if the AI is slightly off, and the final saved_x and saved_y will be the user-adjusted position

3.6. IF the analysis is successful THEN the Script_Editor SHALL show a "Ready for Playback (0 Token Cost)" indicator

3.7. IF the AI analysis fails or returns invalid coordinates THEN the Script_Editor SHALL display an error message and maintain the current state

### Requirement 4

**User Story:** As a user, I want to enable runtime analysis for elements that move or change, with intelligent caching to minimize token costs across multiple playback runs.

#### Acceptance Criteria

4.1. WHEN the Player encounters an ai_vision_capture action THEN the Player SHALL check the following in order: (1) Static Mode (saved_x/y), (2) Dynamic Cache (cached_x/y), (3) Dynamic Mode (Call AI)

4.2. THE Script_Editor SHALL allow toggling "Find at Runtime (Dynamic)" to enable Dynamic Mode

4.3. WHEN is_dynamic is false (Static Mode) AND screen resolution matches recording THEN the Player SHALL read saved_x and saved_y and execute the interaction_type at those coordinates without calling AI

4.4. WHEN is_dynamic is false (Static Mode) AND screen resolution differs from recording THEN the Player SHALL apply proportional scaling to saved_x and saved_y before executing

4.5. WHEN is_dynamic is true AND cached_x and cached_y are present THEN the Player SHALL treat the action as cached: apply proportional scaling using cache_dim (if resolution differs) and execute the interaction_type at the cached coordinates WITHOUT calling AI (0 token cost)

4.6. WHEN is_dynamic is true AND no cache exists THEN the Player SHALL capture a new screenshot of the current runtime screen

4.7. WHEN in Dynamic Mode AND vision_region is defined AND Regional Search is active AND screen resolution differs from recording THEN the Player SHALL scale the vision_region proportionally to the current resolution, then crop the new screenshot to that scaled region before sending to AI

4.8. WHEN in Dynamic Mode without cache THEN the Player SHALL send the screenshot, user_prompt, and reference_images to the AI service and execute the interaction_type at the returned coordinates

4.9. WHEN Dynamic Mode AI search succeeds THEN the Player SHALL save the returned coordinates to cached_x and cached_y along with current screen dimensions to cache_dim BEFORE executing the interaction_type

4.10. THE Player SHALL wait for a maximum of 15 seconds (configurable) for the AI response in Dynamic Mode

4.11. IF Dynamic Mode AI fails to find the element OR timeout occurs THEN the Player SHALL clear any existing cached_x and cached_y values to ensure the next run calls AI for fresh search, then log an error and stop or skip based on global error handling settings

4.12. WHEN is_dynamic is false AND saved coordinates are missing THEN the Player SHALL skip the action and log a warning

### Requirement 5

**User Story:** As a developer, I need an efficient storage format that references external assets rather than embedding them.

#### Acceptance Criteria

5.1. THE ai_vision_capture action object SHALL include core fields: type, id (uuid), timestamp, is_dynamic (boolean, default false), and interaction_type

5.2. THE action object SHALL include static_data containing: original_screenshot (path), saved_x (integer, nullable), saved_y (integer, nullable), and screen_dim (width, height array)

5.3. THE action object SHALL include dynamic_config containing: prompt (string), reference_images (array of relative paths), roi (object with x, y, width, height, nullable), and search_scope (global or regional)

5.4. THE action object SHALL include cache_data containing: cached_x (integer, nullable), cached_y (integer, nullable), and cache_dim (width, height array, nullable) for storing Dynamic Mode results

5.5. WHEN saving the script THEN any pasted reference_images SHALL be saved to a ./assets/ subdirectory relative to the script file

5.6. WHEN a script file containing ai_vision_capture actions is loaded THEN the Storage_Module SHALL validate all fields and reconstruct the action objects correctly

5.7. WHEN serializing and then deserializing an ai_vision_capture action THEN the Storage_Module SHALL produce an equivalent action object (round-trip consistency)

5.8. WHEN Dynamic Mode AI succeeds THEN the Player SHALL persist cache_data (cached_x, cached_y, cache_dim) to the script file to preserve cache across application restarts

5.9. WHEN storing reference_image paths in the script JSON THEN the Asset_Manager SHALL normalize all paths to POSIX format (forward slashes `/`) regardless of the operating system

5.10. WHEN loading reference_image paths from the script JSON THEN the Asset_Manager SHALL convert POSIX paths to OS-native format for file operations

5.11. WHEN saving a reference image (via paste or drag-drop) THEN the Asset_Manager SHALL generate a unique filename using the pattern `vision_{action_id}_{timestamp}.{extension}` to prevent filename collisions

### Requirement 6

**User Story:** As a user, I want visual feedback when working with vision regions and AI analysis, so that I can accurately define the area and understand the system state.

#### Acceptance Criteria

6.1. WHEN a vision_region is displayed THEN the Script_Editor SHALL render it with dashed red lines and corner/edge handles for resizing

6.2. WHEN the mouse hovers over a resize handle THEN the Script_Editor SHALL change the cursor to indicate resize direction

6.3. WHEN a vision_region is being dragged or resized THEN the Script_Editor SHALL display the current coordinates and dimensions in a tooltip or info panel

6.4. WHEN AI returns coordinates THEN the Script_Editor SHALL display the detected point as a target/crosshair icon on the screenshot

6.5. WHILE AI is analyzing (in Editor or during Playback) THEN the system SHALL display a spinner overlay as loading indicator

6.6. WHEN the action is in Static Mode THEN the Script_Editor SHALL display a green icon indicating "Saved/Cached"

6.7. WHEN the action is in Dynamic Mode THEN the Script_Editor SHALL display a blue/purple icon indicating "AI Active"

### Requirement 7

**User Story:** As a user, I want the system to automatically invalidate cached coordinates when I modify the AI configuration, so that stale cache does not cause incorrect playback.

#### Acceptance Criteria

7.1. WHEN a user modifies the prompt field in VisionEditor AND cache_data contains valid cached_x/cached_y THEN the Script_Editor SHALL reset cache_data to null immediately

7.2. WHEN a user modifies the roi (Region of Interest) in VisionEditor AND cache_data contains valid cached_x/cached_y THEN the Script_Editor SHALL reset cache_data to null immediately

7.3. WHEN a user adds or removes reference_images in VisionEditor AND cache_data contains valid cached_x/cached_y THEN the Script_Editor SHALL reset cache_data to null immediately

7.4. WHEN a user changes only interaction_type or is_dynamic toggle THEN the Script_Editor SHALL preserve existing cache_data (no invalidation needed)
