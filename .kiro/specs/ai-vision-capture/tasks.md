# Implementation Plan: AI Vision Capture (Rust-First Strategy)

## Phase 1: Core Types and Data Schema (Universal)

Mục tiêu: Định nghĩa ngôn ngữ chung giữa Frontend (TS) và Backend (Rust).

- [x] 1. Define TypeScript types for AI Vision Capture
  - [x] 1.1 Creat3ả0k4cưe aiVisionCapture.types.ts with AIVisionCaptureAction, VisionROI , InteractionType, SearchScope interfaces
    - Define all interfaces as specified in design document
    - Include JSDoc comments for each field
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x]* 1.2 Write property test for schema validation (TS/Fast-check)  
    - **Property 1: AI Vision Capture Action Schema Validation**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Use fast-check to generate random action objects and verify required fields
 
- [x] 2. Define Rust Structs (Foundation)
  - [x] 2.1 Add AIVisionCaptureAction to script.rs
    - Define VisionROI struct with x, y, width, height
    - Define StaticData struct with original_screenshot, saved_x, saved_y, screen_dim
    - Define DynamicConfig struct with prompt, reference_images, roi, search_scope
    - Define CacheData struct with cached_x, cached_y, cache_dim
    - Add AIVisionCapture variant to ActionType enum
    - Implement Serialize/Deserialize with serde
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 2.2 Write property test for Rust round-trip serialization (Proptest)1
    - **Property 2: Round-trip Serialization Consistency**
    - **Validates: Requirements 5.6**
    - Use proptest to generate randbykom actions, serialize/deserialize, compare

- [x] 3. Checkpoint - Ensure Schema Consistency across TS and Rust
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Rust Recorder Extension (Data Producer)

Mục tiêu: Có khả năng chụp ảnh và tạo action thật để dùng làm test data.3

- [x] 4. Extend Rust Recorder for vision capture
  - [x] 4.1 Add hotkey detection in recorder.rs
    - Detect Cmd+F6 (macOS) or Ctrl+F6 (Windows/Linux) via global hook
    - Track modifier key states (Cmd/Ctrl held)
    - _Requirements: 1.1, 1.3_
  - [x] 4.2 Implement screenshot capture & Action creation
    - Capture screenshot using platform automation -> Save to buffer/file
    - Get current screen dimensions
    - Generate unique ID & file name (vision_{id}.png)
    - Construct AIVisionCaptureAction with default values
    - Add action to recorded_actions list
    - _Requirements: 1.2, 1.4_
  - [x] 4.3 Ensure Recording Continuity
    - Ensure the screenshot process does not block the event loop (async/thread)
    - Mouse and keyboard hooks remain active during capture
    - _Requirements: 1.3_
  - [x] 4.4 Write property test for recording continuity
    - **Property 13: Recording Continuity**
    - **Validates: Requirements 1.3**
    - Simulate hotkey during recording, verify events continue

- [x] 5. Checkpoint - User can record and generate a valid JSON script with Vision actions
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Rust Asset Manager & Utilities

Mục tiêu: Xử lý file ảnh an toàn, đa nền tảng trong Rust.

- [x] 6. Implement Rust Asset Manager
  - [x] 6.1 Create asset_manager.rs with core file operations
    - Implement save_reference_image(data, action_id) -> relative path
    - Implement get_asset_path(relative_path) -> absolute path
    - Implement delete_reference_image(relative_path)
    - Save to ./assets/ subdirectory relative to script file
    - _Requirements: 5.5, 2.6_
  - [x] 6.2 Implement Path Normalization (Cross-platform)
    - Implement to_posix_path() - convert OS path (\\) to POSIX (/)
    - Implement to_native_path() - convert POSIX to OS-native
    - Implement generate_unique_filename() with pattern vision_{action_id}_{timestamp}.{ext}
    - _Requirements: 5.9, 5.10, 5.11_
  - [x] 6.3 Write unit tests for Path Normalization and Unique Filenames
    - **Property 16: Asset Path Normalization (Cross-Platform)**
    - **Property 17: Asset File Naming Uniqueness**
    - **Validates: Requirements 5.9, 5.10, 5.11**

- [x] 7. Checkpoint - Assets are saved correctly in ./assets folder
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Rust Player Extension (Logic Core)

Mục tiêu: Thực thi logic Playback (Static & Cache) cực nhanh bằng Rust.

- [x] 8. Implement Coordinate Scaling Logic
  - [x] 8.1 Implement scale_coordinates(x, y, old_dim, new_dim) in player.rs
    - Calculate proportional scaling: new_x = old_x * (new_width / old_width)
    - Clamp coordinates to screen bounds
    - Handle resolution differences proportionally
    - _Requirements: 4.3, 4.4_
  - [x] 8.2 Write property test for Coordinate Scaling (Proptest)
    - **Property 3: Coordinate Scaling Proportionality**
    - **Validates: Requirements 4.3, 4.5**
    - Generate random coordinates and resolutions, verify proportionality

- [x] 9. Implement Execution Dispatcher
  - [x] 9.1 Add execute_ai_vision_capture() to player.rs
    - Implement dispatcher checking is_dynamic flag
    - Priority Logic: Static (saved_x/y) -> Cache (cached_x/y) -> Dynamic (AI)
    - Log which mode is being used
    - _Requirements: 4.1_
  - [x] 9.2 Implement Static Mode Execution
    - Read saved_x, saved_y from static_data
    - Get current screen dimensions
    - Apply proportional scaling if resolution differs from screen_dim
    - Execute interaction_type at coordinates using platform automation
    - Skip and log warning if coordinates missing
    - _Requirements: 4.3, 4.4, 4.12_
  - [x] 9.3 Implement Cache Mode Execution
    - Check cached_x, cached_y validity in cache_data
    - Apply scaling using cache_dim if resolution differs
    - Execute interaction_type at cached coordinates
    - Log "Using cached coordinates (0 token cost)"
    - _Requirements: 4.5_
  - [x] 9.4 Stub/Placeholder for Dynamic Mode (AI Call)
    - Log "Dynamic Mode: Calling AI service..." or "Dynamic Mode not yet implemented"
    - Prepare for future integration with AI service
    - _Requirements: 4.6_
  - [x] 9.5 Write property test for playback priority order
    - **Property 14: Playback Priority Order**
    - **Validates: Requirements 4.1**
    - Verify Static → Cache → Dynamic order
  - [x] 9.6 Write property test for static mode zero AI calls
    - **Property 4: Static Mode Zero AI Calls**
    - **Validates: Requirements 4.3**
    - Mock AI service, verify no calls in static mode
  - [x] 9.7 Write property test for cache mode zero AI calls
    - **Property 5: Dynamic Cache Zero AI Calls**
    - **Validates: Requirements 4.5**
    - Mock AI service, verify no calls when cache exists

- [x] 10. Implement Interaction Type Execution (Rust)
  - [x] 10.1 Add execute_interaction() method
    - Support click, dblclick, rclick, hover
    - Use platform automation (enigo/rdev) for mouse actions
    - _Requirements: 2.7_

- [x] 11. Checkpoint - Player handles Static and Cached actions correctly 
  - Ensure all tests pass, ask the user if questions arise.

a o83ed7## Phase 5: AI Vision Service & Dynamic Integration

Mục tiêu: Kết nối trí tuệ nhân tạo (Gemini).

- [x] 12. Implement AI Vision Service (TypeScript)
  - [x] 12.1 Create aiVisionService.ts with Gemini Vision integration
    - Implement analyze() method with screenshot, prompt, reference_images
    - Implement setTimeout() for configurable timeout (default 15s)
    - Handle ROI cropping before sending to AI
    - Return AIVisionResponse with x, y, confidence, error
    - _Requirements: 4.6, 4.8, 4.10_
  - [x] 12.2 Write property test for AI timeout enforcement
    - **Property 11: AI Timeout Enforcement**
    - **Validates: Requirements 4.10, 4.11**
    - Mock slow responses, verify timeout behavior

- [x] 13. Connect Rust Player to AI Service (Dynamic Mode)
  - [x] 13.1 Implement method to trigger AI analysis from Rust
    - Option A: Rust calls TypeScript/Node process via IPC
    - Option B: Rust calls HTTP API directly
    - Capture current screenshot, send to AI service
    - Handle timeout (default 15s)
    - _Requirements: 4.6, 4.8, 4.10_
  - [x] 13.2 Implement ROI handling for Dynamic Mode
    - Check if roi exists and search_scope is 'regional'
    - Scale ROI proportionally if resolution differs
    - Crop screenshot to scaled ROI before sending to AI
    - _Requirements: 4.7_ỷzy5aty1
  - [x] 13.3 Implement update_cache logic after successful AI hit
    - Update action's cache_data with cached_x, cached_y, cache_dim
    - Persist updated script to file
    - Log "Caching AI result for future runs"
    - _Requirements: 4.9, 5.8_4my48a b4my48
  - [x] 13.4 Implement cache invalidation on AI failure
    - On AI error or timeout, clear cache_data (set to null)
    - Persist updated script
    - Log error message with details
    - Stop or skip based on global error handling settings
    - _Requirements: 4.11_
  - [x] 13.5 Write property test for dynamic mode AI request structure
    - **Property 6: Dynamic Mode AI Request Structure**
    - **Validates: Requirements 4.6, 4.8**
    - Verify request contains screenshot, prompt, reference_images
  - [x] 13.6 Write property test for cache persistence
    - **Property 7: Cache Persistence After AI Success**
    - **Validates: Requirements 4.9, 5.8**1
    - Verify AI results saved to cache_data
  - [x] 13.7 Write property test for cache invalidation on failure
    - **Property 8: Cache Invalidation On AI Failure**
    - **Validates: Requirements 4.11**
    - Verify cache cleared after AI failure

- [-] 14. Checkpoint - Dynamic Mode with AI integration works
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Vision Editor Component (UI)

Mục tiêu: Giao diện cho người dùng tương tác với dữ liệu đã có.
1
- [ ] 15. Implement ROI Tool Component
  - [ ] 15.1 Create ROITool.tsx with canvas-based drawing
    - Render image with overlay canvas
    - Implement mouse handlers for drawing ROI rectangle
    - Display dashed red border with corner handles
    - _Requirements: 2.2, 6.1_
  - [ ] 15.2 Implement Interactive Resize Handles
    - Implement resize handles (corners and edges)
    - Change cursor on handle hover
    - Display coordinates/dimensions in tooltip during drag
    - _Requirements: 6.2, 6.3_
  - [x] 15.3 Add target/crosshair marker rendering
    - Display marker at AI-returned coordinates
    - Implement marker drag for manual adjustment
    - Update saved_x/saved_y on marker drag end
    - _Requirements: 3.5, 6.4_
  - [x] 15.4 Write property test for ROI bounds validation
    - **Property 10: ROI Coordinate Bounds**
    - **Validates: Requirements 2.2, 2.3, 2.4**
    - Generate random ROI values, verify bounds constraints

- [ ] 16. Implement Vision Editor main component
  - [ ] 16.1 Create VisionEditor.tsx with layout structure
    - Display screenshot with ROITool
    - Add prompt textarea input
    - Add interaction type selector (Click, Double Click, Right Click, Hover)
    - Add Search Scope toggle (Global/Regional)
    - _Requirements: 2.1, 2.3, 2.4, 2.7_
  - [ ] 16.2 Implement Cache Invalidation Logic
    - Watch for changes to prompt, roi, reference_images
    - Reset cache_data to null when dynamic_config changes
    - Preserve cache when only interaction_type or is_dynamic changes
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ] 16.3 Implement mode toggle and status indicators
    - Add "Find at Runtime (Dynamic)" toggle
    - Display green icon for Static Mode (saved)
    - Display blue/purple icon for Dynamic Mode
    - Display "Ready for Playback (0 Token Cost)" indicator
    - _Requirements: 4.2, 6.6, 6.7, 3.6_
  - [ ] 16.4 Implement Analyze button and AI integration
    - Call AIVisionService.analyze() on click
    - Display spinner overlay during analysis
    - Update marker position on success
    - Display error message on failure
    - _Requirements: 3.2, 3.3, 3.4, 3.7, 6.5_
  - [ ] 16.5 Write property test for default mode
    - **Property 12: Default Mode Invariant**
    - **Validates: Requirements 3.1**
    - Create new actions, verify is_dynamic = false
  - [ ] 16.6 Write property test for editor cache invalidation
    - **Property 15: Editor Cache Invalidation**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - Generate actions with cache, modify dynamic_config, verify cache reset

- [ ] 17. Implement Reference Image Manager
  - [ ] 17.1 Create ReferenceImageManager.tsx
    - Display thumbnail grid of reference images
    - Implement paste handler (Ctrl+V / Cmd+V)
    - Implement drag-and-drop handler
    - Implement remove button for each thumbnail
    - _Requirements: 2.5, 2.6, 2.8_
  - [ ] 17.2 Write property test for asset persistence
    - **Property 9: Reference Image Asset Persistence**
    - **Validates: Requirements 5.5, 2.6**
    - Generate random images, verify file creation and path validity

- [ ] 18. Checkpoint - Vision Editor UI is functional
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: TypeScript Asset Manager

- [ ] 19. Implement Asset Manager service (TypeScript)
  - [ ] 19.1 Create assetManager.ts with core file operations
    - Implement constructor with scriptPath
    - Implement getAssetsDir() to return ./assets/ relative path
    - Implement saveReferenceImage() with unique filename generation
    - Implement loadReferenceImage() and deleteReferenceImage()
    - _Requirements: 5.5, 2.6_
  - [ ] 19.2 Implement path normalization utilities (TypeScript)
    - Implement toPosixPath() - convert any path to forward slashes
    - Implement toNativePath() - convert POSIX to OS-native (use path.sep)
    - Implement generateUniqueFilename() with pattern vision_{actionId}_{timestamp}.{ext}
    - _Requirements: 5.9, 5.10, 5.11_
  - [ ] 19.3 Write property test for TS path normalization
    - **Property 16: Asset Path Normalization (Cross-Platform)**
    - **Validates: Requirements 5.9, 5.10**
    - Generate paths with mixed separators, verify POSIX output
  - [ ] 19.4 Write property test for TS filename uniqueness
    - **Property 17: Asset File Naming Uniqueness**
    - **Validates: Requirements 5.11**
    - Generate multiple images, verify unique filenames

- [ ] 20. Checkpoint - TypeScript Asset Manager works
  - Ensure all tests pass, ask the user if questions arise.

## Phase 8: Integration and Script Editor

- [ ] 21. Integrate VisionEditor into ScriptEditorScreen
  - [ ] 21.1 Add VisionEditor rendering for ai_vision_capture actions
    - Detect action type and render VisionEditor
    - Wire up onUpdate callback to script state
    - Wire up onAnalyze to AIVisionService
    - _Requirements: 2.1_
  - [ ] 21.2 Add CSS styles for VisionEditor
    - Style ROI tool with dashed red border
    - Style reference image thumbnails
    - Style mode indicators and buttons
    - _Requirements: 6.1, 6.6, 6.7_

- [ ] 22. Update script storage to handle ai_vision_capture
  - [ ] 22.1 Extend scriptStorageService.ts
    - Handle ai_vision_capture action serialization
    - Ensure assets folder is created when saving
    - Validate ai_vision_capture actions on load
    - _Requirements: 5.5, 5.6_

- [ ] 23. Implement IPC bridge for vision capture
  - [ ] 23.1 Add IPC commands for vision capture
    - Add "capture_vision_marker" command to trigger from UI
    - Add "analyze_vision" command to call AI from Desktop
    - Add "update_vision_cache" command to persist cache
    - _Requirements: 1.1, 3.3, 4.9_

- [ ] 24. Checkpoint - Full integration works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Phase 9: Python Support (Legacy/Hybrid - Optional)

Mục tiêu: Đảm bảo tính tương thích nếu vẫn dùng Python.

- [ ]* 25. Extend Python storage models (Optional)
  - [ ]* 25.1 Add Pydantic models for AIVisionCaptureAction in models.py
    - Add VisionROI, StaticData, DynamicConfig, CacheData models
    - Ensure compatibility with existing Action model
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 25.2 Write property test for round-trip serialization (Python)
    - **Property 2: Round-trip Serialization Consistency**
    - **Validates: Requirements 5.6**
    - Use hypothesis to generate random actions, serialize to JSON, deserialize, compare

- [ ]* 26. Extend Python Recorder for vision capture hotkey (Optional)
  - [ ]* 26.1 Add hotkey detection in recorder.py
    - Detect Cmd+F6 (macOS) or Ctrl+F6 (Windows/Linux)
    - Implement _is_vision_capture_hotkey() method
    - Track modifier key states (Cmd/Ctrl held)
    - Ensure hotkey does not interrupt recording flow
    - _Requirements: 1.1, 1.3_
  - [ ]* 26.2 Implement _capture_vision_marker() method
    - Capture full screenshot using existing screenshot module
    - Get current screen dimensions
    - Create ai_vision_capture action with default values
    - Generate unique action ID (uuid4)
    - Add action to recorded_actions list
    - _Requirements: 1.2, 1.4_
  - [ ]* 26.3 Implement screenshot storage for vision markers
    - Save screenshot to screenshots/ subdirectory
    - Use naming pattern vision_{action_id}.png
    - Store relative path in static_data.original_screenshot
    - _Requirements: 5.5_
  - [ ]* 26.4 Write property test for recording continuity (Python)
    - **Property 13: Recording Continuity**
    - **Validates: Requirements 1.3**
    - Simulate hotkey during recording, verify events continue

- [ ]* 27. Implement Python Asset Manager (Optional)
  - [ ]* 27.1 Create asset_manager.py with file operations
    - Implement AssetManager class with script_path
    - Implement save_reference_image() with unique filename
    - Implement load_reference_image() and delete_reference_image()
    - _Requirements: 5.5, 2.6_
  - [ ]* 27.2 Implement path normalization utilities (Python)
    - Implement to_posix_path() - convert to forward slashes
    - Implement to_native_path() - convert to OS-native
    - Implement generate_unique_filename() with pattern vision_{action_id}_{timestamp}.{ext}
    - _Requirements: 5.9, 5.10, 5.11_
  - [ ]* 27.3 Write property test for Python path normalization
    - **Property 16: Asset Path Normalization (Cross-Platform)**
    - **Validates: Requirements 5.9, 5.10**
    - Generate paths with mixed separators, verify POSIX output

- [ ]* 28. Implement Python AI Vision Service (Optional)
  - [ ]* 28.1 Create ai_vision_service.py with Gemini Vision integration
    - Implement AIVisionService class with analyze() method
    - Accept screenshot (base64), prompt, reference_images
    - Implement configurable timeout (default 15s)
    - Return AIVisionResponse with x, y, confidence, error
    - _Requirements: 4.6, 4.8, 4.10_
  - [ ]* 28.2 Implement image preprocessing utilities
    - Add crop_to_roi() function for Regional Search
    - Add scale_roi() function for resolution differences
    - Add encode_image_base64() helper
    - _Requirements: 4.7_
  - [ ]* 28.3 Write property test for AI timeout enforcement (Python)
    - **Property 11: AI Timeout Enforcement**
    - **Validates: Requirements 4.10, 4.11**
    - Mock slow responses, verify timeout behavior

- [ ]* 29. Extend Python Player for ai_vision_capture playback (Optional)
  - [ ]* 29.1 Implement _execute_ai_vision_capture() dispatcher
    - Check is_dynamic flag first
    - Route to static, cached, or dynamic execution
    - Log which mode is being used
    - _Requirements: 4.1_
  - [ ]* 29.2 Implement coordinate scaling utility (Python)
    - Add _scale_coordinates() method
    - Calculate proportional scaling: new_x = old_x * (new_width / old_width)
    - Clamp coordinates to screen bounds
    - _Requirements: 4.4, 4.7_
  - [ ]* 29.3 Implement Static Mode playback (Python)
    - Read saved_x, saved_y from static_data
    - Apply proportional scaling if resolution differs
    - Execute interaction_type at coordinates using PyAutoGUI
    - Skip and log warning if coordinates missing
    - _Requirements: 4.3, 4.4, 4.12_
  - [ ]* 29.4 Implement Cache Mode playback (Python)
    - Check cached_x, cached_y validity
    - Apply scaling using cache_dim
    - Execute interaction at cached coordinates
    - _Requirements: 4.5_
  - [ ]* 29.5 Implement Dynamic Mode AI playback (Python)
    - Capture current screenshot
    - Handle ROI cropping for Regional Search
    - Call AIVisionService.analyze()
    - Execute interaction at returned coordinates
    - _Requirements: 4.6, 4.7, 4.8_
  - [ ]* 29.6 Implement cache persistence and invalidation (Python)
    - Save AI results to cache_data after success
    - Clear cache on AI failure
    - Persist updated script
    - _Requirements: 4.9, 4.11, 5.8_
  - [ ]* 29.7 Write property tests for Python Player
    - **Property 4: Static Mode Zero AI Calls**
    - **Property 5: Dynamic Cache Zero AI Calls**
    - **Property 14: Playback Priority Order**
    - **Validates: Requirements 4.1, 4.3, 4.5**

- [ ]* 30. Update Python storage module (Optional)
  - [ ]* 30.1 Extend storage.py for ai_vision_capture
    - Add validation for ai_vision_capture actions
    - Handle cache_data persistence on script save
    - Ensure assets folder exists when loading scripts
    - _Requirements: 5.5, 5.6, 5.8_

- [ ] 31. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
