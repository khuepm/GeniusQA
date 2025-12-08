# Implementation Plan: AI Vision Capture

## Phase 1: Core Types and Data Models

- [ ] 1. Define TypeScript types for AI Vision Capture
  - [ ] 1.1 Create aiVisionCapture.types.ts with AIVisionCaptureAction, VisionROI, InteractionType, SearchScope interfaces
    - Define all interfaces as specified in design document
    - Include JSDoc comments for each field
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 1.2 Write property test for schema validation
    - **Property 1: AI Vision Capture Action Schema Validation**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Use fast-check to generate random action objects and verify required fields

- [ ] 2. Extend Python storage models
  - [ ] 2.1 Add Pydantic models for AIVisionCaptureAction in models.py
    - Add VisionROI, StaticData, DynamicConfig, CacheData models
    - Ensure compatibility with existing Action model
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 2.2 Write property test for round-trip serialization (Python)
    - **Property 2: Round-trip Serialization Consistency**
    - **Validates: Requirements 5.6**
    - Use hypothesis to generate random actions, serialize to JSON, deserialize, compare

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Python Recorder Extension (Early - for real test data)

- [ ] 4. Extend Python Recorder for vision capture hotkey
  - [ ] 4.1 Add hotkey detection in recorder.py
    - Detect Cmd+F6 (macOS) or Ctrl+F6 (Windows/Linux)
    - Implement _is_vision_capture_hotkey() method
    - Track modifier key states (Cmd/Ctrl held)
    - Ensure hotkey does not interrupt recording flow
    - _Requirements: 1.1, 1.3_
  - [ ] 4.2 Implement _capture_vision_marker() method
    - Capture full screenshot using existing screenshot module
    - Get current screen dimensions
    - Create ai_vision_capture action with default values
    - Generate unique action ID (uuid4)
    - Add action to recorded_actions list
    - _Requirements: 1.2, 1.4_
  - [ ] 4.3 Implement screenshot storage for vision markers
    - Save screenshot to screenshots/ subdirectory
    - Use naming pattern vision_{action_id}.png
    - Store relative path in static_data.original_screenshot
    - _Requirements: 5.5_
  - [ ] 4.4 Write property test for recording continuity
    - **Property 13: Recording Continuity**
    - **Validates: Requirements 1.3**
    - Simulate hotkey during recording, verify events continue

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Asset Manager with Cross-Platform Support

- [ ] 6. Implement Asset Manager service (TypeScript)
  - [ ] 6.1 Create assetManager.ts with core file operations
    - Implement constructor with scriptPath
    - Implement getAssetsDir() to return ./assets/ relative path
    - Implement saveReferenceImage() with unique filename generation
    - Implement loadReferenceImage() and deleteReferenceImage()
    - _Requirements: 5.5, 2.6_
  - [ ] 6.2 Implement path normalization utilities
    - Implement toPosixPath() - convert any path to forward slashes
    - Implement toNativePath() - convert POSIX to OS-native (use path.sep)
    - Implement generateUniqueFilename() with pattern vision_{actionId}_{timestamp}.{ext}
    - _Requirements: 5.9, 5.10, 5.11_
  - [ ] 6.3 Write property test for path normalization
    - **Property 16: Asset Path Normalization (Cross-Platform)**
    - **Validates: Requirements 5.9, 5.10**
    - Generate paths with mixed separators, verify POSIX output
  - [ ] 6.4 Write property test for filename uniqueness
    - **Property 17: Asset File Naming Uniqueness**
    - **Validates: Requirements 5.11**
    - Generate multiple images, verify unique filenames

- [ ] 7. Implement Python Asset Manager
  - [ ] 7.1 Create asset_manager.py with file operations
    - Implement AssetManager class with script_path
    - Implement save_reference_image() with unique filename
    - Implement load_reference_image() and delete_reference_image()
    - _Requirements: 5.5, 2.6_
  - [ ] 7.2 Implement path normalization utilities (Python)
    - Implement to_posix_path() - convert to forward slashes
    - Implement to_native_path() - convert to OS-native
    - Implement generate_unique_filename() with pattern vision_{action_id}_{timestamp}.{ext}
    - _Requirements: 5.9, 5.10, 5.11_
  - [ ] 7.3 Write property test for Python path normalization
    - **Property 16: Asset Path Normalization (Cross-Platform)**
    - **Validates: Requirements 5.9, 5.10**
    - Generate paths with mixed separators, verify POSIX output

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: AI Vision Service

- [ ] 9. Implement AI Vision Service (TypeScript)
  - [ ] 9.1 Create aiVisionService.ts with Gemini Vision integration
    - Implement analyze() method with screenshot, prompt, reference_images
    - Implement setTimeout() for configurable timeout (default 15s)
    - Handle ROI cropping before sending to AI
    - Return AIVisionResponse with x, y, confidence, error
    - _Requirements: 4.6, 4.8, 4.10_
  - [ ] 9.2 Write property test for AI timeout enforcement
    - **Property 11: AI Timeout Enforcement**
    - **Validates: Requirements 4.10, 4.11**
    - Mock slow responses, verify timeout behavior

- [ ] 10. Implement Python AI Vision Service
  - [ ] 10.1 Create ai_vision_service.py with Gemini Vision integration
    - Implement AIVisionService class with analyze() method
    - Accept screenshot (base64), prompt, reference_images
    - Implement configurable timeout (default 15s)
    - Return AIVisionResponse with x, y, confidence, error
    - _Requirements: 4.6, 4.8, 4.10_
  - [ ] 10.2 Implement image preprocessing utilities
    - Add crop_to_roi() function for Regional Search
    - Add scale_roi() function for resolution differences
    - Add encode_image_base64() helper
    - _Requirements: 4.7_
  - [ ] 10.3 Write property test for AI timeout enforcement (Python)
    - **Property 11: AI Timeout Enforcement**
    - **Validates: Requirements 4.10, 4.11**
    - Mock slow responses, verify timeout behavior

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: ROI Tool Component

- [ ] 12. Implement ROI Tool component
  - [ ] 12.1 Create ROITool.tsx with canvas-based drawing
    - Render image with overlay canvas
    - Implement mouse handlers for drawing ROI rectangle
    - Implement resize handles (corners and edges)
    - Display dashed red border with corner handles
    - _Requirements: 2.2, 6.1, 6.2_
  - [ ] 12.2 Implement ROI coordinate validation and display
    - Validate ROI bounds within screen dimensions
    - Display coordinates/dimensions in tooltip during drag
    - Change cursor on handle hover
    - _Requirements: 6.3_
  - [ ] 12.3 Write property test for ROI bounds validation
    - **Property 10: ROI Coordinate Bounds**
    - **Validates: Requirements 2.2, 2.3, 2.4**
    - Generate random ROI values, verify bounds constraints

- [ ] 13. Implement marker display and drag
  - [ ] 13.1 Add target/crosshair marker rendering to ROITool
    - Display marker at AI-returned coordinates
    - Implement marker drag for manual adjustment
    - Update saved_x/saved_y on marker drag end
    - _Requirements: 3.5, 6.4_

- [ ] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Reference Image Manager

- [ ] 15. Implement Reference Image Manager component
  - [ ] 15.1 Create ReferenceImageManager.tsx
    - Display thumbnail grid of reference images
    - Implement paste handler (Ctrl+V / Cmd+V)
    - Implement drag-and-drop handler
    - Implement remove button for each thumbnail
    - _Requirements: 2.5, 2.6, 2.8_
  - [ ] 15.2 Write property test for asset persistence
    - **Property 9: Reference Image Asset Persistence**
    - **Validates: Requirements 5.5, 2.6**
    - Generate random images, verify file creation and path validity

- [ ] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: Vision Editor Component

- [ ] 17. Implement Vision Editor main component
  - [ ] 17.1 Create VisionEditor.tsx with layout structure
    - Display screenshot with ROITool
    - Add prompt textarea input
    - Add ReferenceImageManager
    - Add interaction type selector (Click, Double Click, Right Click, Hover)
    - Add Search Scope toggle (Global/Regional)
    - _Requirements: 2.1, 2.4, 2.7, 2.3_
  - [ ] 17.2 Implement mode toggle and status indicators
    - Add "Find at Runtime (Dynamic)" toggle
    - Display green icon for Static Mode (saved)
    - Display blue/purple icon for Dynamic Mode
    - Display "Ready for Playback (0 Token Cost)" indicator
    - _Requirements: 4.2, 6.6, 6.7, 3.6_
  - [ ] 17.3 Write property test for default mode
    - **Property 12: Default Mode Invariant**
    - **Validates: Requirements 3.1**
    - Create new actions, verify is_dynamic = false

- [ ] 18. Implement cache invalidation logic
  - [ ] 18.1 Add handleDynamicConfigChange with cache reset
    - Watch for changes to prompt, roi, reference_images
    - Reset cache_data to null when dynamic_config changes
    - Preserve cache when only interaction_type or is_dynamic changes
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ] 18.2 Write property test for editor cache invalidation
    - **Property 15: Editor Cache Invalidation**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - Generate actions with cache, modify dynamic_config, verify cache reset

- [ ] 19. Implement Analyze button and AI integration
  - [ ] 19.1 Add Analyze button with loading state
    - Call AIVisionService.analyze() on click
    - Display spinner overlay during analysis
    - Update marker position on success
    - Display error message on failure
    - _Requirements: 3.2, 3.3, 3.4, 3.7, 6.5_

- [ ] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


## Phase 8: Python Player Extension

- [ ] 21. Extend Python Player for ai_vision_capture playback
  - [ ] 21.1 Implement _execute_ai_vision_capture() dispatcher
    - Check is_dynamic flag first
    - Route to static, cached, or dynamic execution
    - Log which mode is being used
    - _Requirements: 4.1_
  - [ ] 21.2 Implement coordinate scaling utility
    - Add _scale_coordinates() method
    - Calculate proportional scaling: new_x = old_x * (new_width / old_width)
    - Clamp coordinates to screen bounds
    - _Requirements: 4.4, 4.7_
  - [ ] 21.3 Write property test for playback priority order
    - **Property 14: Playback Priority Order**
    - **Validates: Requirements 4.1**
    - Verify Static → Cache → Dynamic order

- [ ] 22. Implement Static Mode playback
  - [ ] 22.1 Add _execute_static_vision() method
    - Read saved_x, saved_y from static_data
    - Get current screen dimensions
    - Apply proportional scaling if resolution differs from screen_dim
    - Execute interaction_type at coordinates using PyAutoGUI
    - Skip and log warning if coordinates missing
    - _Requirements: 4.3, 4.4, 4.12_
  - [ ] 22.2 Implement interaction type execution
    - Add _execute_interaction() method
    - Support click, dblclick, rclick, hover
    - Use pyautogui.click(), pyautogui.doubleClick(), pyautogui.rightClick(), pyautogui.moveTo()
    - _Requirements: 2.7_
  - [ ] 22.3 Write property test for static mode zero AI calls
    - **Property 4: Static Mode Zero AI Calls**
    - **Validates: Requirements 4.3**
    - Mock AI service, verify no calls in static mode
  - [ ] 22.4 Write property test for coordinate scaling
    - **Property 3: Coordinate Scaling Proportionality**
    - **Validates: Requirements 4.3, 4.5**
    - Generate random coordinates and resolutions, verify proportionality

- [ ] 23. Implement Dynamic Cache playback
  - [ ] 23.1 Add _has_valid_cache() method
    - Check cached_x, cached_y in cache_data are not None
    - Return boolean indicating cache validity
    - _Requirements: 4.5_
  - [ ] 23.2 Add _execute_cached_vision() method
    - Read cached_x, cached_y from cache_data
    - Apply scaling using cache_dim if resolution differs
    - Execute interaction_type at cached coordinates
    - Log "Using cached coordinates (0 token cost)"
    - _Requirements: 4.5_
  - [ ] 23.3 Write property test for cache mode zero AI calls
    - **Property 5: Dynamic Cache Zero AI Calls**
    - **Validates: Requirements 4.5**
    - Mock AI service, verify no calls when cache exists

- [ ] 24. Implement Dynamic Mode AI playback
  - [ ] 24.1 Add _execute_dynamic_vision() method
    - Capture current screenshot using screenshot module
    - Get current screen dimensions
    - _Requirements: 4.6_
  - [ ] 24.2 Implement ROI handling for Dynamic Mode
    - Check if roi exists and search_scope is 'regional'
    - Scale ROI proportionally if resolution differs
    - Crop screenshot to scaled ROI before sending to AI
    - _Requirements: 4.7_
  - [ ] 24.3 Implement AI service call
    - Load reference_images from asset paths
    - Call AIVisionService.analyze() with screenshot, prompt, reference_images
    - Handle timeout (default 15s)
    - Execute interaction_type at returned coordinates
    - _Requirements: 4.8, 4.10_
  - [ ] 24.4 Write property test for dynamic mode AI request structure
    - **Property 6: Dynamic Mode AI Request Structure**
    - **Validates: Requirements 4.6, 4.8**
    - Verify request contains screenshot, prompt, reference_images

- [ ] 25. Implement cache persistence and invalidation
  - [ ] 25.1 Add _save_to_cache() method
    - Update action's cache_data with cached_x, cached_y, cache_dim
    - Call storage module to persist updated script
    - Log "Caching AI result for future runs"
    - _Requirements: 4.9, 5.8_
  - [ ] 25.2 Add _clear_cache() method
    - Set cached_x, cached_y to None
    - Set cache_dim to None
    - Persist updated script
    - _Requirements: 4.11_
  - [ ] 25.3 Implement error handling for AI failure
    - On AI error or timeout, call _clear_cache()
    - Log error message with details
    - Stop or skip based on global error handling settings
    - _Requirements: 4.11_
  - [ ] 25.4 Write property test for cache persistence
    - **Property 7: Cache Persistence After AI Success**
    - **Validates: Requirements 4.9, 5.8**
    - Verify AI results saved to cache_data
  - [ ] 25.5 Write property test for cache invalidation on failure
    - **Property 8: Cache Invalidation On AI Failure**
    - **Validates: Requirements 4.11**
    - Verify cache cleared after AI failure

- [ ] 26. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 9: Rust Core Extension

- [ ] 27. Extend Rust script types for ai_vision_capture
  - [ ] 27.1 Add AIVisionCaptureAction to script.rs
    - Define VisionROI struct with x, y, width, height
    - Define StaticData struct with original_screenshot, saved_x, saved_y, screen_dim
    - Define DynamicConfig struct with prompt, reference_images, roi, search_scope
    - Define CacheData struct with cached_x, cached_y, cache_dim
    - Add AIVisionCapture variant to ActionType enum
    - Implement Serialize/Deserialize with serde
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 27.2 Write property test for Rust round-trip serialization
    - **Property 2: Round-trip Serialization Consistency (Rust)**
    - **Validates: Requirements 5.6**
    - Use proptest to generate random actions, serialize/deserialize

- [ ] 28. Extend Rust Player for ai_vision_capture
  - [ ] 28.1 Add execute_ai_vision_capture() to player.rs
    - Implement dispatcher checking is_dynamic flag
    - Route to static, cached, or dynamic execution
    - _Requirements: 4.1_
  - [ ] 28.2 Implement Static Mode execution in Rust
    - Read saved_x, saved_y from static_data
    - Apply proportional scaling if resolution differs
    - Execute interaction using platform automation
    - _Requirements: 4.3, 4.4_
  - [ ] 28.3 Implement Cache Mode execution in Rust
    - Check cached_x, cached_y validity
    - Apply scaling using cache_dim
    - Execute interaction at cached coordinates
    - _Requirements: 4.5_
  - [ ] 28.4 Implement coordinate scaling utility (Rust)
    - Add scale_coordinates() function
    - Handle resolution differences proportionally
    - Clamp to screen bounds
    - _Requirements: 4.4, 4.7_

- [ ] 29. Extend Rust Recorder for vision capture hotkey
  - [ ] 29.1 Add hotkey detection to recorder.rs
    - Detect Cmd+F6 (macOS) / Ctrl+F6 (Windows/Linux) in key event handler
    - Track modifier key states
    - _Requirements: 1.1_
  - [ ] 29.2 Implement vision marker capture in Rust
    - Capture screenshot using platform automation
    - Get current screen dimensions
    - Create ai_vision_capture action with default values
    - Generate unique action ID
    - Add action to recorded_actions
    - Ensure recording continuity (don't block event loop)
    - _Requirements: 1.2, 1.3, 1.4_

- [ ] 30. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 10: Integration and Script Editor

- [ ] 31. Integrate VisionEditor into ScriptEditorScreen
  - [ ] 31.1 Add VisionEditor rendering for ai_vision_capture actions
    - Detect action type and render VisionEditor
    - Wire up onUpdate callback to script state
    - Wire up onAnalyze to AIVisionService
    - _Requirements: 2.1_
  - [ ] 31.2 Add CSS styles for VisionEditor
    - Style ROI tool with dashed red border
    - Style reference image thumbnails
    - Style mode indicators and buttons
    - _Requirements: 6.1, 6.6, 6.7_

- [ ] 32. Update script storage to handle ai_vision_capture
  - [ ] 32.1 Extend scriptStorageService.ts
    - Handle ai_vision_capture action serialization
    - Ensure assets folder is created when saving
    - Validate ai_vision_capture actions on load
    - _Requirements: 5.5, 5.6_

- [ ] 33. Update Python storage module
  - [ ] 33.1 Extend storage.py for ai_vision_capture
    - Add validation for ai_vision_capture actions
    - Handle cache_data persistence on script save
    - Ensure assets folder exists when loading scripts
    - _Requirements: 5.5, 5.6, 5.8_

- [ ] 34. Implement IPC bridge for vision capture
  - [ ] 34.1 Add IPC commands for vision capture
    - Add "capture_vision_marker" command to trigger from UI
    - Add "analyze_vision" command to call AI from Desktop
    - Add "update_vision_cache" command to persist cache
    - _Requirements: 1.1, 3.3, 4.9_

- [ ] 35. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

