"""Tests for screenshot capture during recording."""

import pytest
import sys
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from recorder.recorder import Recorder
from storage.models import Action


class TestScreenshotCapture:
    """Test screenshot capture functionality."""
    
    def test_recorder_initializes_with_screenshot_settings(self, tmp_path):
        """Test that recorder can be initialized with screenshot settings."""
        screenshots_dir = tmp_path / "screenshots"
        recorder = Recorder(screenshots_dir=screenshots_dir, capture_screenshots=True)
        
        assert recorder.screenshots_dir == screenshots_dir
        assert recorder.capture_screenshots is True
        assert recorder.screenshot_counter == 0
    
    def test_recorder_initializes_without_screenshots(self):
        """Test that recorder can be initialized without screenshot capture."""
        recorder = Recorder(screenshots_dir=None, capture_screenshots=False)
        
        assert recorder.screenshots_dir is None
        assert recorder.capture_screenshots is False
    
    def test_screenshots_directory_created_on_start(self, tmp_path):
        """Test that screenshots directory is created when recording starts."""
        screenshots_dir = tmp_path / "screenshots"
        recorder = Recorder(screenshots_dir=screenshots_dir, capture_screenshots=True)
        
        with patch('recorder.recorder.mouse.Listener'), \
             patch('recorder.recorder.keyboard.Listener'), \
             patch.object(Recorder, 'check_dependencies', return_value=(True, "")):
            recorder.start_recording()
        
        assert screenshots_dir.exists()
        assert screenshots_dir.is_dir()
        
        recorder.stop_recording()
    
    def test_screenshot_captured_on_mouse_click(self, tmp_path):
        """Test that screenshot is captured when mouse is clicked."""
        screenshots_dir = tmp_path / "screenshots"
        recorder = Recorder(screenshots_dir=screenshots_dir, capture_screenshots=True)
        
        # Mock pyautogui.screenshot to return a mock image
        mock_image = MagicMock()
        
        # Mock pyautogui module
        mock_pyautogui = MagicMock()
        mock_pyautogui.screenshot.return_value = mock_image
        
        with patch('recorder.recorder.mouse.Listener'), \
             patch('recorder.recorder.keyboard.Listener'), \
             patch.object(Recorder, 'check_dependencies', return_value=(True, "")), \
             patch.dict('sys.modules', {'pyautogui': mock_pyautogui, 'PIL': MagicMock()}):
            
            recorder.start_recording()
            
            # Simulate a mouse click
            from pynput import mouse
            recorder._on_mouse_click(100, 200, mouse.Button.left, True)
            
            # Check that screenshot was saved
            mock_image.save.assert_called_once()
            saved_path = mock_image.save.call_args[0][0]
            assert "screenshot_0001.png" in str(saved_path)
            
            # Check that action has screenshot reference
            assert len(recorder.actions) == 1
            assert recorder.actions[0].screenshot == "screenshot_0001.png"
            
            recorder.stop_recording()
    
    def test_multiple_screenshots_numbered_sequentially(self, tmp_path):
        """Test that multiple screenshots are numbered sequentially."""
        screenshots_dir = tmp_path / "screenshots"
        recorder = Recorder(screenshots_dir=screenshots_dir, capture_screenshots=True)
        
        mock_image = MagicMock()
        mock_pyautogui = MagicMock()
        mock_pyautogui.screenshot.return_value = mock_image
        
        with patch('recorder.recorder.mouse.Listener'), \
             patch('recorder.recorder.keyboard.Listener'), \
             patch.object(Recorder, 'check_dependencies', return_value=(True, "")), \
             patch.dict('sys.modules', {'pyautogui': mock_pyautogui, 'PIL': MagicMock()}):
            
            recorder.start_recording()
            
            # Simulate multiple mouse clicks
            from pynput import mouse
            recorder._on_mouse_click(100, 200, mouse.Button.left, True)
            recorder._on_mouse_click(150, 250, mouse.Button.left, True)
            recorder._on_mouse_click(200, 300, mouse.Button.left, True)
            
            # Check that screenshots are numbered correctly
            assert len(recorder.actions) == 3
            assert recorder.actions[0].screenshot == "screenshot_0001.png"
            assert recorder.actions[1].screenshot == "screenshot_0002.png"
            assert recorder.actions[2].screenshot == "screenshot_0003.png"
            
            recorder.stop_recording()
    
    def test_no_screenshot_when_disabled(self, tmp_path):
        """Test that no screenshot is captured when feature is disabled."""
        screenshots_dir = tmp_path / "screenshots"
        recorder = Recorder(screenshots_dir=screenshots_dir, capture_screenshots=False)
        
        with patch('recorder.recorder.mouse.Listener'), \
             patch('recorder.recorder.keyboard.Listener'), \
             patch.object(Recorder, 'check_dependencies', return_value=(True, "")):
            
            recorder.start_recording()
            
            # Simulate a mouse click
            from pynput import mouse
            recorder._on_mouse_click(100, 200, mouse.Button.left, True)
            
            # Check that action has no screenshot reference
            assert len(recorder.actions) == 1
            assert recorder.actions[0].screenshot is None
            
            recorder.stop_recording()
    
    def test_screenshot_failure_does_not_stop_recording(self, tmp_path):
        """Test that screenshot capture failure doesn't stop the recording."""
        screenshots_dir = tmp_path / "screenshots"
        recorder = Recorder(screenshots_dir=screenshots_dir, capture_screenshots=True)
        
        mock_pyautogui = MagicMock()
        mock_pyautogui.screenshot.side_effect = Exception("Screenshot failed")
        
        with patch('recorder.recorder.mouse.Listener'), \
             patch('recorder.recorder.keyboard.Listener'), \
             patch.object(Recorder, 'check_dependencies', return_value=(True, "")), \
             patch.dict('sys.modules', {'pyautogui': mock_pyautogui, 'PIL': MagicMock()}):
            
            recorder.start_recording()
            
            # Simulate a mouse click - should not raise exception
            from pynput import mouse
            recorder._on_mouse_click(100, 200, mouse.Button.left, True)
            
            # Check that action was recorded without screenshot
            assert len(recorder.actions) == 1
            assert recorder.actions[0].screenshot is None
            
            recorder.stop_recording()
    
    def test_action_model_accepts_screenshot_field(self):
        """Test that Action model accepts screenshot field."""
        action = Action(
            type='mouse_click',
            timestamp=1.0,
            x=100,
            y=200,
            button='left',
            screenshot='screenshot_0001.png'
        )
        
        assert action.screenshot == 'screenshot_0001.png'
    
    def test_action_model_screenshot_field_optional(self):
        """Test that Action model screenshot field is optional."""
        action = Action(
            type='mouse_click',
            timestamp=1.0,
            x=100,
            y=200,
            button='left'
        )
        
        assert action.screenshot is None
    
    def test_check_dependencies_includes_pillow(self):
        """Test that dependency check includes Pillow when screenshots enabled."""
        # Mock successful imports for pyautogui and pynput, but fail PIL
        with patch('builtins.__import__') as mock_import:
            def side_effect(name, *args, **kwargs):
                if name == 'PIL':
                    raise ImportError("No module named 'PIL'")
                elif name in ['pyautogui', 'pynput']:
                    return MagicMock()
                else:
                    # For other imports, use the real import
                    return __import__(name, *args, **kwargs)
            
            mock_import.side_effect = side_effect
            
            # PIL is not available, so check should fail
            is_available, error_msg = Recorder.check_dependencies(check_pillow=True)
            
            # Should fail because PIL is not available
            assert is_available is False
            assert 'Pillow' in error_msg
    
    def test_check_dependencies_skips_pillow_when_disabled(self):
        """Test that dependency check skips Pillow when screenshots disabled."""
        # Mock successful imports for pyautogui and pynput
        mock_modules = {
            'pyautogui': MagicMock(),
            'pynput': MagicMock()
        }
        
        with patch.dict('sys.modules', mock_modules):
            # Even if PIL is not available, should pass when check_pillow=False
            is_available, error_msg = Recorder.check_dependencies(check_pillow=False)
            
            # Should succeed even without PIL
            assert is_available is True
            assert 'Pillow' not in error_msg


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
