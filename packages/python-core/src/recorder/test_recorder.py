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
    recorder = Recorder()
    
    # Mock the listeners to avoid actually starting them
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener:
        
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
    recorder = Recorder()
    
    # Should not be recording initially
    assert recorder.is_recording is False
    
    # Mock the listeners to avoid actually starting them
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener:
        
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
    recorder = Recorder()
    
    with patch('recorder.recorder.mouse.Listener') as mock_mouse_listener, \
         patch('recorder.recorder.keyboard.Listener') as mock_keyboard_listener:
        
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
    recorder = Recorder()
    
    with pytest.raises(RuntimeError, match="No recording in progress"):
        recorder.stop_recording()


def test_recorder_dependency_check():
    """Test that dependency check works correctly."""
    is_available, error_msg = Recorder.check_dependencies()
    
    # In our test environment, dependencies should be available
    assert is_available is True
    assert error_msg == ""
