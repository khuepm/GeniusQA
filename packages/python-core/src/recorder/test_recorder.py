"""Property-based tests for the Recorder module."""

import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import patch, MagicMock
import time
from recorder.recorder import Recorder
from storage.models import Action


# Feature: desktop-recorder-mvp, Property 12: PyAutoGUI availability check
# Validates: Requirements 8.4, 8.5
def test_dependency_check_property():
    """
    Test that check_dependencies correctly identifies missing libraries
    and provides clear error messages.
    
    This test verifies the actual state of dependencies in the current environment.
    """
    is_available, error_msg = Recorder.check_dependencies()
    
    # Check the structure of the response
    assert isinstance(is_available, bool)
    assert isinstance(error_msg, str)
    
    # Property: If dependencies are missing, error message should be clear
    if not is_available:
        assert len(error_msg) > 0
        assert "pip install" in error_msg
        # Error message should mention at least one library
        assert "pyautogui" in error_msg or "pynput" in error_msg
    else:
        # Property: If all dependencies are available, error message should be empty
        assert error_msg == ""


# Feature: desktop-recorder-mvp, Property 1: Recording captures all user actions
# Validates: Requirements 1.1, 1.3
@settings(max_examples=100, deadline=None)
@given(
    num_mouse_moves=st.integers(min_value=0, max_value=10),
    num_mouse_clicks=st.integers(min_value=0, max_value=10),
    num_key_presses=st.integers(min_value=0, max_value=10)
)
def test_recording_captures_all_actions_property(num_mouse_moves, num_mouse_clicks, num_key_presses):
    """
    For any sequence of user actions (mouse moves, clicks, key presses),
    the recorder should capture all actions with accurate timestamps.
    """
    # Disable screenshot capture to avoid Pillow dependency in this test
    recorder = Recorder(capture_screenshots=False)
    
    # Mock the listeners to avoid actually starting them
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener, \
         patch.object(Recorder, 'check_dependencies', return_value=(True, "")):
        
        # Create mock listener instances
        mock_mouse_instance = MagicMock()
        mock_keyboard_instance = MagicMock()
        mock_mouse_listener.return_value = mock_mouse_instance
        mock_keyboard_listener.return_value = mock_keyboard_instance
        
        recorder.start_recording()
        
        # Simulate actions by calling the callbacks directly
        # Simulate mouse moves
        for i in range(num_mouse_moves):
            recorder._on_mouse_move(100 + i, 200 + i)
        
        # Simulate mouse clicks
        from pynput.mouse import Button
        for i in range(num_mouse_clicks):
            recorder._on_mouse_click(150 + i, 250 + i, Button.left, True)
        
        # Simulate key presses (both press and release)
        from pynput.keyboard import KeyCode
        for i in range(num_key_presses):
            key = KeyCode.from_char(chr(97 + (i % 26)))  # a-z
            recorder._on_key_event(key, True)  # press
            recorder._on_key_event(key, False)  # release
        
        actions = recorder.stop_recording()
    
    # Property: All actions should be captured
    expected_count = num_mouse_moves + num_mouse_clicks + (num_key_presses * 2)
    assert len(actions) == expected_count
    
    # Property: All actions should have non-negative timestamps
    for action in actions:
        assert action.timestamp >= 0
    
    # Property: Timestamps should be monotonically increasing (or equal)
    for i in range(1, len(actions)):
        assert actions[i].timestamp >= actions[i-1].timestamp
    
    # Property: Mouse move actions should have coordinates
    mouse_moves = [a for a in actions if a.type == 'mouse_move']
    assert len(mouse_moves) == num_mouse_moves
    for action in mouse_moves:
        assert action.x is not None
        assert action.y is not None
    
    # Property: Mouse click actions should have coordinates and button
    mouse_clicks = [a for a in actions if a.type == 'mouse_click']
    assert len(mouse_clicks) == num_mouse_clicks
    for action in mouse_clicks:
        assert action.x is not None
        assert action.y is not None
        assert action.button is not None
    
    # Property: Key actions should have key field
    key_actions = [a for a in actions if a.type in ['key_press', 'key_release']]
    assert len(key_actions) == num_key_presses * 2
    for action in key_actions:
        assert action.key is not None


def test_recorder_basic_functionality():
    """Basic unit test to verify recorder can start and stop."""
    recorder = Recorder(capture_screenshots=False)
    
    # Should not be recording initially
    assert recorder.is_recording is False
    
    # Mock the listeners to avoid actually starting them
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener, \
         patch.object(Recorder, 'check_dependencies', return_value=(True, "")):
        
        mock_mouse_instance = MagicMock()
        mock_keyboard_instance = MagicMock()
        mock_mouse_listener.return_value = mock_mouse_instance
        mock_keyboard_listener.return_value = mock_keyboard_instance
        
        # Start recording
        recorder.start_recording()
        assert recorder.is_recording is True
        
        # Stop recording
        actions = recorder.stop_recording()
        assert recorder.is_recording is False
        assert isinstance(actions, list)


def test_recorder_cannot_start_twice():
    """Test that starting recording twice raises an error."""
    recorder = Recorder(capture_screenshots=False)
    
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener, \
         patch.object(Recorder, 'check_dependencies', return_value=(True, "")):
        
        mock_mouse_instance = MagicMock()
        mock_keyboard_instance = MagicMock()
        mock_mouse_listener.return_value = mock_mouse_instance
        mock_keyboard_listener.return_value = mock_keyboard_instance
        
        recorder.start_recording()
        
        with pytest.raises(RuntimeError, match="Recording already in progress"):
            recorder.start_recording()
        
        recorder.stop_recording()


def test_recorder_cannot_stop_without_start():
    """Test that stopping without starting raises an error."""
    recorder = Recorder(capture_screenshots=False)
    
    with pytest.raises(RuntimeError, match="No recording in progress"):
        recorder.stop_recording()


def test_recorder_dependency_check():
    """Test that dependency check works correctly."""
    # Test without Pillow requirement (screenshots disabled)
    is_available, error_msg = Recorder.check_dependencies(check_pillow=False)
    
    # Check the structure of the response
    assert isinstance(is_available, bool)
    assert isinstance(error_msg, str)
    
    # If dependencies are missing, error message should be clear
    if not is_available:
        assert len(error_msg) > 0
        assert "pip install" in error_msg


# =============================================================================
# AI Vision Capture Property Tests
# =============================================================================

# Feature: ai-vision-capture, Property 13: Recording Continuity
# Validates: Requirements 1.3
@settings(max_examples=100, deadline=None)
@given(
    num_events_before=st.integers(min_value=1, max_value=5),
    num_events_after=st.integers(min_value=1, max_value=5)
)
def test_recording_continuity_property(num_events_before, num_events_after):
    """
    **Feature: ai-vision-capture, Property 13: Recording Continuity**
    **Validates: Requirements 1.3**
    
    For any recording session, pressing the vision capture hotkey SHALL NOT
    interrupt the capture of subsequent mouse and keyboard events.
    
    This test verifies that:
    1. Events before the hotkey are captured
    2. The vision capture action is created
    3. Events after the hotkey continue to be captured
    4. The total action count matches expected (before + vision + after)
    """
    # Disable screenshot capture to avoid Pillow dependency in this test
    recorder = Recorder(capture_screenshots=False)
    
    # Mock pyautogui module for vision capture
    mock_pyautogui = MagicMock()
    mock_screenshot = MagicMock()
    mock_pyautogui.screenshot.return_value = mock_screenshot
    mock_pyautogui.size.return_value = MagicMock(width=1920, height=1080)
    
    # Mock the listeners and dependencies
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener, \
         patch.object(Recorder, 'check_dependencies', return_value=(True, "")), \
         patch.dict('sys.modules', {'pyautogui': mock_pyautogui}):
        
        # Create mock listener instances
        mock_mouse_instance = MagicMock()
        mock_keyboard_instance = MagicMock()
        mock_mouse_listener.return_value = mock_mouse_instance
        mock_keyboard_listener.return_value = mock_keyboard_instance
        
        recorder.start_recording()
        
        # Simulate events BEFORE the hotkey
        from pynput.mouse import Button
        for i in range(num_events_before):
            recorder._on_mouse_click(100 + i, 200 + i, Button.left, True)
        
        events_before_count = len(recorder.actions)
        
        # Simulate the vision capture hotkey (Ctrl+F6 on non-macOS)
        # First, simulate Ctrl key press to set modifier state
        recorder._cmd_ctrl_held = True
        
        # Then simulate F6 key press while Ctrl is held
        from pynput.keyboard import Key
        recorder._on_key_event(Key.f6, True)
        
        # Check that vision capture action was created
        vision_actions = [a for a in recorder.actions if a.type == 'ai_vision_capture']
        assert len(vision_actions) == 1, "Vision capture action should be created"
        
        # Simulate events AFTER the hotkey
        for i in range(num_events_after):
            recorder._on_mouse_click(300 + i, 400 + i, Button.left, True)
        
        actions = recorder.stop_recording()
    
    # Property: All events should be captured (before + vision + F6 key + after)
    # Note: The F6 key press is also recorded as a key_press action
    expected_count = num_events_before + 1 + 1 + num_events_after  # before + vision + f6_key + after
    assert len(actions) == expected_count, f"Expected {expected_count} actions, got {len(actions)}"
    
    # Property: Vision capture action should be present
    vision_actions = [a for a in actions if a.type == 'ai_vision_capture']
    assert len(vision_actions) == 1, "Exactly one vision capture action should exist"
    
    # Property: Vision capture action should have valid structure
    vision_action = vision_actions[0]
    assert vision_action.id is not None, "Vision action should have an ID"
    assert vision_action.timestamp >= 0, "Vision action should have valid timestamp"
    assert vision_action.is_dynamic is False, "Vision action should default to Static Mode"
    assert vision_action.interaction == 'click', "Vision action should default to click interaction"
    
    # Property: Events after hotkey should be captured
    # Find the index of the vision action
    vision_index = next(i for i, a in enumerate(actions) if a.type == 'ai_vision_capture')
    
    # Count mouse clicks after the vision action (excluding the F6 key press)
    clicks_after = [a for a in actions[vision_index+1:] if a.type == 'mouse_click']
    assert len(clicks_after) == num_events_after, f"Expected {num_events_after} clicks after hotkey, got {len(clicks_after)}"


def test_vision_capture_hotkey_detection_macos():
    """Test that Cmd+F6 is detected on macOS."""
    recorder = Recorder(capture_screenshots=False)
    
    # Simulate macOS
    recorder._is_macos = True
    recorder._cmd_ctrl_held = False
    
    from pynput.keyboard import Key
    
    # Cmd key press should set modifier state
    result = recorder._is_vision_capture_hotkey(Key.cmd, True)
    assert result is False, "Cmd key alone should not trigger hotkey"
    assert recorder._cmd_ctrl_held is True, "Cmd key should set modifier state"
    
    # F6 while Cmd is held should trigger hotkey
    result = recorder._is_vision_capture_hotkey(Key.f6, True)
    assert result is True, "Cmd+F6 should trigger hotkey on macOS"
    
    # Cmd key release should clear modifier state
    result = recorder._is_vision_capture_hotkey(Key.cmd, False)
    assert result is False
    assert recorder._cmd_ctrl_held is False, "Cmd release should clear modifier state"


def test_vision_capture_hotkey_detection_windows_linux():
    """Test that Ctrl+F6 is detected on Windows/Linux."""
    recorder = Recorder(capture_screenshots=False)
    
    # Simulate Windows/Linux
    recorder._is_macos = False
    recorder._cmd_ctrl_held = False
    
    from pynput.keyboard import Key
    
    # Ctrl key press should set modifier state
    result = recorder._is_vision_capture_hotkey(Key.ctrl, True)
    assert result is False, "Ctrl key alone should not trigger hotkey"
    assert recorder._cmd_ctrl_held is True, "Ctrl key should set modifier state"
    
    # F6 while Ctrl is held should trigger hotkey
    result = recorder._is_vision_capture_hotkey(Key.f6, True)
    assert result is True, "Ctrl+F6 should trigger hotkey on Windows/Linux"
    
    # Ctrl key release should clear modifier state
    result = recorder._is_vision_capture_hotkey(Key.ctrl, False)
    assert result is False
    assert recorder._cmd_ctrl_held is False, "Ctrl release should clear modifier state"


def test_vision_capture_creates_valid_action(tmp_path):
    """Test that vision capture creates a valid AIVisionCaptureAction."""
    screenshots_dir = tmp_path / "screenshots"
    recorder = Recorder(screenshots_dir=screenshots_dir, capture_screenshots=True)
    
    # Mock pyautogui module
    mock_pyautogui = MagicMock()
    mock_screenshot = MagicMock()
    mock_pyautogui.screenshot.return_value = mock_screenshot
    mock_pyautogui.size.return_value = MagicMock(width=1920, height=1080)
    
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener, \
         patch.object(Recorder, 'check_dependencies', return_value=(True, "")), \
         patch.dict('sys.modules', {'pyautogui': mock_pyautogui}):
        
        mock_mouse_instance = MagicMock()
        mock_keyboard_instance = MagicMock()
        mock_mouse_listener.return_value = mock_mouse_instance
        mock_keyboard_listener.return_value = mock_keyboard_instance
        
        recorder.start_recording()
        
        # Trigger vision capture
        recorder._capture_vision_marker()
        
        actions = recorder.stop_recording()
    
    # Should have exactly one action
    assert len(actions) == 1
    
    # Should be an AIVisionCaptureAction
    action = actions[0]
    assert action.type == 'ai_vision_capture'
    
    # Validate structure
    assert action.id is not None
    assert len(action.id) == 36  # UUID format
    assert action.timestamp >= 0
    assert action.is_dynamic is False
    assert action.interaction == 'click'
    
    # Validate static_data
    assert action.static_data is not None
    assert action.static_data.original_screenshot.startswith('screenshots/vision_')
    assert action.static_data.saved_x is None
    assert action.static_data.saved_y is None
    assert action.static_data.screen_dim == (1920, 1080)
    
    # Validate dynamic_config
    assert action.dynamic_config is not None
    assert action.dynamic_config.prompt == ""
    assert action.dynamic_config.reference_images == []
    assert action.dynamic_config.roi is None
    assert action.dynamic_config.search_scope == 'global'
    
    # Validate cache_data
    assert action.cache_data is not None
    assert action.cache_data.cached_x is None
    assert action.cache_data.cached_y is None
    assert action.cache_data.cache_dim is None


def test_vision_capture_does_not_block_recording(tmp_path):
    """Test that vision capture does not block subsequent event capture."""
    screenshots_dir = tmp_path / "screenshots"
    recorder = Recorder(screenshots_dir=screenshots_dir, capture_screenshots=True)
    
    # Mock pyautogui module
    mock_pyautogui = MagicMock()
    mock_screenshot = MagicMock()
    mock_pyautogui.screenshot.return_value = mock_screenshot
    mock_pyautogui.size.return_value = MagicMock(width=1920, height=1080)
    
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener, \
         patch.object(Recorder, 'check_dependencies', return_value=(True, "")), \
         patch.dict('sys.modules', {'pyautogui': mock_pyautogui}):
        
        mock_mouse_instance = MagicMock()
        mock_keyboard_instance = MagicMock()
        mock_mouse_listener.return_value = mock_mouse_instance
        mock_keyboard_listener.return_value = mock_keyboard_instance
        
        recorder.start_recording()
        
        # Capture some events before
        from pynput.mouse import Button
        recorder._on_mouse_click(100, 100, Button.left, True)
        
        # Trigger vision capture
        recorder._capture_vision_marker()
        
        # Capture some events after - this should work without issues
        recorder._on_mouse_click(200, 200, Button.left, True)
        recorder._on_mouse_move(300, 300)
        
        actions = recorder.stop_recording()
    
    # Should have 4 actions: click, vision, click, move
    assert len(actions) == 4
    
    # Verify order
    assert actions[0].type == 'mouse_click'
    assert actions[1].type == 'ai_vision_capture'
    assert actions[2].type == 'mouse_click'
    assert actions[3].type == 'mouse_move'
