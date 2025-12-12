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


# =============================================================================
# Step-Based Recording Property Tests
# =============================================================================

# Feature: test-case-driven-automation, Property 2: Step Recording Behavior
# Validates: Requirements 2.1, 2.2, 2.5
@settings(max_examples=100, deadline=None)
@given(
    has_active_step=st.booleans(),
    num_actions=st.integers(min_value=1, max_value=10),
    step_id=st.text(min_size=1, max_size=50).filter(lambda x: x.strip())
)
def test_step_recording_behavior_property(has_active_step, num_actions, step_id):
    """
    **Feature: test-case-driven-automation, Property 2: Step Recording Behavior**
    **Validates: Requirements 2.1, 2.2, 2.5**
    
    For any recording session, when a test step is active, all recorded actions
    SHALL be mapped to that step's action_ids array in chronological order, and
    when no step is active, a Setup_Step SHALL be created automatically to contain
    the actions.
    """
    from storage.models import TestScript, EnhancedScriptMetadata, TestStep
    from datetime import datetime
    
    # Create a test script for step-based recording
    test_script = TestScript(
        meta=EnhancedScriptMetadata(
            title="Test Script",
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform="test"
        ),
        steps=[],
        action_pool={},
        variables={}
    )
    
    # Create recorder with step-based recording support
    recorder = Recorder(capture_screenshots=False)
    recorder.set_test_script(test_script)
    
    # Track step actions and setup step creation
    step_actions = {}
    setup_step_created = False
    created_setup_step_id = None
    
    def step_action_callback(step_id: str, action):
        """Callback to track actions mapped to steps."""
        if step_id not in step_actions:
            step_actions[step_id] = []
        step_actions[step_id].append(action)
    
    def setup_step_callback(action):
        """Callback to create Setup_Step when no step is active."""
        nonlocal setup_step_created, created_setup_step_id
        setup_step_created = True
        created_setup_step_id = f"setup_{len(test_script.steps)}"
        
        # Create the Setup_Step
        setup_step = TestStep(
            id=created_setup_step_id,
            order=1,
            description="Setup Step - Auto-created",
            expected_result="Setup actions complete",
            action_ids=[],
            continue_on_failure=False
        )
        test_script.steps.append(setup_step)
        
        return created_setup_step_id
    
    recorder.set_step_action_callback(step_action_callback)
    recorder.set_setup_step_callback(setup_step_callback)
    
    # Set active step if specified
    if has_active_step:
        # Create a test step and set it as active
        test_step = TestStep(
            id=step_id,
            order=1,
            description="Test Step",
            expected_result="Test actions complete",
            action_ids=[],
            continue_on_failure=False
        )
        test_script.steps.append(test_step)
        recorder.set_active_step(step_id)
    else:
        recorder.set_active_step(None)
    
    # Mock the listeners to avoid actually starting them
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener, \
         patch.object(Recorder, 'check_dependencies', return_value=(True, "")):
        
        mock_mouse_instance = MagicMock()
        mock_keyboard_instance = MagicMock()
        mock_mouse_listener.return_value = mock_mouse_instance
        mock_keyboard_listener.return_value = mock_keyboard_instance
        
        recorder.start_recording()
        
        # Simulate actions
        from pynput.mouse import Button
        for i in range(num_actions):
            recorder._on_mouse_click(100 + i, 200 + i, Button.left, True)
        
        actions = recorder.stop_recording()
    
    # Property: All actions should be recorded in flat list (backward compatibility)
    assert len(actions) == num_actions
    
    if has_active_step:
        # Property: When step is active, actions should be mapped to that step
        assert step_id in step_actions, f"Actions should be mapped to active step {step_id}"
        assert len(step_actions[step_id]) == num_actions, "All actions should be mapped to active step"
        
        # Property: Setup step should NOT be created when step is active
        assert not setup_step_created, "Setup step should not be created when step is active"
        
        # Property: Actions should be mapped in chronological order
        mapped_actions = step_actions[step_id]
        for i in range(1, len(mapped_actions)):
            assert mapped_actions[i].timestamp >= mapped_actions[i-1].timestamp, \
                "Actions should be mapped in chronological order"
    
    else:
        # Property: When no step is active, Setup_Step should be created automatically
        assert setup_step_created, "Setup step should be created when no step is active"
        assert created_setup_step_id is not None, "Setup step ID should be generated"
        
        # Property: Actions should be mapped to the created Setup_Step
        assert created_setup_step_id in step_actions, "Actions should be mapped to Setup_Step"
        assert len(step_actions[created_setup_step_id]) == num_actions, \
            "All actions should be mapped to Setup_Step"
        
        # Property: Setup_Step should be added to test script
        setup_steps = [s for s in test_script.steps if s.id == created_setup_step_id]
        assert len(setup_steps) == 1, "Exactly one Setup_Step should be created"
        
        setup_step = setup_steps[0]
        assert "Setup" in setup_step.description, "Setup step should have appropriate description"
        assert setup_step.order == 1, "Setup step should have order 1"


def test_step_recording_active_step_management():
    """Test that active step management works correctly."""
    from storage.models import TestScript, EnhancedScriptMetadata, TestStep
    from datetime import datetime
    
    recorder = Recorder(capture_screenshots=False)
    
    # Initially no active step
    assert recorder.current_active_step_id is None
    
    # Set active step
    test_step_id = "test-step-123"
    recorder.set_active_step(test_step_id)
    assert recorder.current_active_step_id == test_step_id
    
    # Clear active step
    recorder.set_active_step(None)
    assert recorder.current_active_step_id is None


def test_step_recording_test_script_management():
    """Test that test script management works correctly."""
    from storage.models import TestScript, EnhancedScriptMetadata
    from datetime import datetime
    
    recorder = Recorder(capture_screenshots=False)
    
    # Initially no test script
    assert recorder.test_script is None
    
    # Set test script
    test_script = TestScript(
        meta=EnhancedScriptMetadata(
            title="Test Script",
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform="test"
        ),
        steps=[],
        action_pool={},
        variables={}
    )
    
    recorder.set_test_script(test_script)
    assert recorder.test_script is test_script
    
    # Clear test script
    recorder.set_test_script(None)
    assert recorder.test_script is None


def test_step_recording_callback_management():
    """Test that callback management works correctly."""
    recorder = Recorder(capture_screenshots=False)
    
    # Initially no callbacks
    assert recorder.step_action_callback is None
    assert recorder.setup_step_callback is None
    
    # Set callbacks
    def step_callback(step_id, action):
        pass
    
    def setup_callback(action):
        return "setup-id"
    
    recorder.set_step_action_callback(step_callback)
    recorder.set_setup_step_callback(setup_callback)
    
    assert recorder.step_action_callback is step_callback
    assert recorder.setup_step_callback is setup_callback
    
    # Clear callbacks
    recorder.set_step_action_callback(None)
    recorder.set_setup_step_callback(None)
    
    assert recorder.step_action_callback is None
    assert recorder.setup_step_callback is None


# Feature: test-case-driven-automation, Property 4: Action Insertion Preservation
# Validates: Requirements 2.4
@settings(max_examples=100, deadline=None)
@given(
    initial_actions=st.integers(min_value=1, max_value=10),
    insertion_position=st.integers(min_value=0, max_value=10),
    num_insertions=st.integers(min_value=1, max_value=5)
)
def test_action_insertion_preservation_property(initial_actions, insertion_position, num_insertions):
    """
    **Feature: test-case-driven-automation, Property 4: Action Insertion Preservation**
    **Validates: Requirements 2.4**
    
    For any existing test step, when new actions are inserted at any position,
    the final action order SHALL maintain chronological consistency within the step.
    """
    from storage.models import TestScript, EnhancedScriptMetadata, TestStep, Action
    from datetime import datetime
    import uuid
    
    # Create a test script with a step containing initial actions
    test_script = TestScript(
        meta=EnhancedScriptMetadata(
            title="Test Script",
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform="test"
        ),
        steps=[],
        action_pool={},
        variables={}
    )
    
    # Create a test step
    step_id = "test-step-123"
    test_step = TestStep(
        id=step_id,
        order=1,
        description="Test Step",
        expected_result="Test actions complete",
        action_ids=[],
        continue_on_failure=False
    )
    test_script.steps.append(test_step)
    
    # Create initial actions and add them to the step
    initial_action_ids = []
    for i in range(initial_actions):
        action_id = str(uuid.uuid4())
        action = Action(
            type='mouse_click',
            timestamp=float(i),  # Sequential timestamps
            x=100 + i,
            y=200 + i,
            button='left'
        )
        test_script.action_pool[action_id] = action
        test_step.action_ids.append(action_id)
        initial_action_ids.append(action_id)
    
    # Create recorder and set up step-based recording
    recorder = Recorder(capture_screenshots=False)
    recorder.set_test_script(test_script)
    
    # Clamp insertion position to valid range
    max_position = len(test_step.action_ids)
    clamped_position = min(insertion_position, max_position)
    
    # Insert new actions at the specified position
    inserted_actions = []
    for i in range(num_insertions):
        new_action = Action(
            type='key_press',
            timestamp=float(initial_actions + i + 0.5),  # Later timestamps
            key=f'key_{i}'
        )
        
        # Insert at position (will be clamped by the method)
        success = recorder.insert_action_in_step(step_id, new_action, clamped_position + i)
        assert success, f"Action insertion {i} should succeed"
        inserted_actions.append(new_action)
    
    # Get final actions in the step
    final_actions = recorder.get_step_actions(step_id)
    
    # Property: Total action count should be initial + inserted
    assert len(final_actions) == initial_actions + num_insertions, \
        f"Expected {initial_actions + num_insertions} actions, got {len(final_actions)}"
    
    # Property: All original actions should still be present
    original_action_types = [a.type for a in final_actions if a.type == 'mouse_click']
    assert len(original_action_types) == initial_actions, \
        "All original mouse_click actions should be preserved"
    
    # Property: All inserted actions should be present
    inserted_action_types = [a.type for a in final_actions if a.type == 'key_press']
    assert len(inserted_action_types) == num_insertions, \
        "All inserted key_press actions should be present"
    
    # Property: Actions should maintain some form of logical order
    # (The exact order depends on insertion position, but we can verify structure)
    mouse_clicks = [i for i, a in enumerate(final_actions) if a.type == 'mouse_click']
    key_presses = [i for i, a in enumerate(final_actions) if a.type == 'key_press']
    
    # Property: Mouse clicks should maintain their relative order
    for i in range(1, len(mouse_clicks)):
        mouse_action_1 = final_actions[mouse_clicks[i-1]]
        mouse_action_2 = final_actions[mouse_clicks[i]]
        assert mouse_action_1.x < mouse_action_2.x, \
            "Original mouse click actions should maintain their relative order"
    
    # Property: Key presses should maintain their relative order
    for i in range(1, len(key_presses)):
        key_action_1 = final_actions[key_presses[i-1]]
        key_action_2 = final_actions[key_presses[i]]
        assert key_action_1.key < key_action_2.key, \
            "Inserted key press actions should maintain their relative order"
    
    # Property: Action pool should contain all actions
    assert len(test_script.action_pool) == initial_actions + num_insertions, \
        "Action pool should contain all actions"
    
    # Property: Step action_ids should reference all actions in action pool
    for action_id in test_step.action_ids:
        assert action_id in test_script.action_pool, \
            f"Action ID {action_id} should exist in action pool"


def test_action_insertion_edge_cases():
    """Test edge cases for action insertion."""
    from storage.models import TestScript, EnhancedScriptMetadata, TestStep, Action
    from datetime import datetime
    import uuid
    
    # Create test script and step
    test_script = TestScript(
        meta=EnhancedScriptMetadata(
            title="Test Script",
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform="test"
        ),
        steps=[],
        action_pool={},
        variables={}
    )
    
    step_id = "test-step"
    test_step = TestStep(
        id=step_id,
        order=1,
        description="Test Step",
        expected_result="Test complete",
        action_ids=[],
        continue_on_failure=False
    )
    test_script.steps.append(test_step)
    
    recorder = Recorder(capture_screenshots=False)
    recorder.set_test_script(test_script)
    
    # Test insertion into empty step
    action1 = Action(type='mouse_click', timestamp=1.0, x=100, y=100, button='left')
    success = recorder.insert_action_in_step(step_id, action1, 0)
    assert success
    assert len(test_step.action_ids) == 1
    
    # Test insertion at end (position beyond current length)
    action2 = Action(type='mouse_click', timestamp=2.0, x=200, y=200, button='left')
    success = recorder.insert_action_in_step(step_id, action2, 999)  # Beyond end
    assert success
    assert len(test_step.action_ids) == 2
    
    # Test insertion in middle
    action3 = Action(type='key_press', timestamp=1.5, key='a')
    success = recorder.insert_action_in_step(step_id, action3, 1)
    assert success
    assert len(test_step.action_ids) == 3
    
    # Verify order: action1, action3, action2
    actions = recorder.get_step_actions(step_id)
    assert actions[0].timestamp == 1.0
    assert actions[1].timestamp == 1.5
    assert actions[2].timestamp == 2.0
    
    # Test insertion into non-existent step
    action4 = Action(type='mouse_move', timestamp=3.0, x=300, y=300)
    success = recorder.insert_action_in_step("non-existent", action4, 0)
    assert not success


def test_action_removal_from_step():
    """Test action removal functionality."""
    from storage.models import TestScript, EnhancedScriptMetadata, TestStep, Action
    from datetime import datetime
    import uuid
    
    # Create test script with actions
    test_script = TestScript(
        meta=EnhancedScriptMetadata(
            title="Test Script",
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform="test"
        ),
        steps=[],
        action_pool={},
        variables={}
    )
    
    step_id = "test-step"
    test_step = TestStep(
        id=step_id,
        order=1,
        description="Test Step",
        expected_result="Test complete",
        action_ids=[],
        continue_on_failure=False
    )
    test_script.steps.append(test_step)
    
    # Add some actions
    action_ids = []
    for i in range(3):
        action_id = str(uuid.uuid4())
        action = Action(
            type='mouse_click',
            timestamp=float(i),
            x=100 + i,
            y=200 + i,
            button='left'
        )
        test_script.action_pool[action_id] = action
        test_step.action_ids.append(action_id)
        action_ids.append(action_id)
    
    recorder = Recorder(capture_screenshots=False)
    recorder.set_test_script(test_script)
    
    # Test removal from middle
    success = recorder.remove_action_from_step(step_id, 1)
    assert success
    assert len(test_step.action_ids) == 2
    assert action_ids[1] not in test_step.action_ids
    assert action_ids[1] not in test_script.action_pool  # Should be removed from pool
    
    # Test removal of invalid index
    success = recorder.remove_action_from_step(step_id, 999)
    assert not success
    
    # Test removal from non-existent step
    success = recorder.remove_action_from_step("non-existent", 0)
    assert not success


def test_action_reordering_in_step():
    """Test action reordering functionality."""
    from storage.models import TestScript, EnhancedScriptMetadata, TestStep, Action
    from datetime import datetime
    import uuid
    
    # Create test script with actions
    test_script = TestScript(
        meta=EnhancedScriptMetadata(
            title="Test Script",
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform="test"
        ),
        steps=[],
        action_pool={},
        variables={}
    )
    
    step_id = "test-step"
    test_step = TestStep(
        id=step_id,
        order=1,
        description="Test Step",
        expected_result="Test complete",
        action_ids=[],
        continue_on_failure=False
    )
    test_script.steps.append(test_step)
    
    # Add actions with distinct properties for verification
    actions_data = [
        {'x': 100, 'y': 100},
        {'x': 200, 'y': 200},
        {'x': 300, 'y': 300}
    ]
    
    original_action_ids = []
    for i, data in enumerate(actions_data):
        action_id = str(uuid.uuid4())
        action = Action(
            type='mouse_click',
            timestamp=float(i),
            x=data['x'],
            y=data['y'],
            button='left'
        )
        test_script.action_pool[action_id] = action
        test_step.action_ids.append(action_id)
        original_action_ids.append(action_id)
    
    recorder = Recorder(capture_screenshots=False)
    recorder.set_test_script(test_script)
    
    # Test reordering: reverse the order [0,1,2] -> [2,1,0]
    new_order = [2, 1, 0]
    success = recorder.reorder_actions_in_step(step_id, new_order)
    assert success
    
    # Verify new order
    actions = recorder.get_step_actions(step_id)
    assert len(actions) == 3
    assert actions[0].x == 300  # Originally index 2
    assert actions[1].x == 200  # Originally index 1
    assert actions[2].x == 100  # Originally index 0
    
    # Test invalid reordering (wrong length)
    success = recorder.reorder_actions_in_step(step_id, [0, 1])  # Too short
    assert not success
    
    # Test invalid reordering (invalid indices)
    success = recorder.reorder_actions_in_step(step_id, [0, 1, 3])  # Index 3 doesn't exist
    assert not success
    
    # Test reordering non-existent step
    success = recorder.reorder_actions_in_step("non-existent", [0, 1, 2])
    assert not success
