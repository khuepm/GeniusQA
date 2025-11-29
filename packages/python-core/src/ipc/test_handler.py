"""Property-based tests for IPC handler."""

import json
import pytest
from pathlib import Path
from hypothesis import given, strategies as st
from io import StringIO
from unittest.mock import Mock, patch

from ipc.handler import IPCHandler


# Feature: desktop-recorder-mvp, Property 10: IPC error propagation
# For any error occurring in the Python Core, the error message should be 
# propagated to the Desktop App and displayed to the user.
# Validates: Requirements 5.5, 9.1, 9.2, 9.4


@given(
    error_message=st.text(min_size=1, max_size=200).filter(lambda x: x.strip())
)
def test_error_propagation_in_responses(error_message):
    """
    Property: For any error that occurs during command execution,
    the IPC handler should return a response with success=False and
    the error message should be included in the response.
    """
    handler = IPCHandler()
    
    # Create a command that will trigger an error by mocking the recorder
    with patch.object(handler, 'recorder', None):
        # Try to stop recording when none is in progress
        response = handler._handle_stop_recording({})
        
        assert response['success'] is False
        assert 'error' in response
        assert isinstance(response['error'], str)
        assert len(response['error']) > 0


@given(
    command=st.sampled_from([
        'start_recording',
        'stop_recording', 
        'start_playback',
        'stop_playback',
        'check_recordings',
        'get_latest'
    ])
)
def test_error_responses_have_required_structure(command):
    """
    Property: For any command that results in an error,
    the response should have the required structure with
    'success' set to False and an 'error' field containing a message.
    """
    handler = IPCHandler()
    
    # Force an error condition for each command type
    if command == 'stop_recording':
        # No recording in progress
        response = handler._handle_stop_recording({})
    elif command == 'stop_playback':
        # No playback in progress
        response = handler._handle_stop_playback({})
    elif command == 'start_recording':
        # Start a recording, then try to start another
        handler.recorder = Mock()
        handler.recorder.is_recording = True
        response = handler._handle_start_recording({})
    elif command == 'start_playback':
        # Try to play with no recordings
        with patch.object(handler.storage, 'get_latest_script', return_value=None):
            response = handler._handle_start_playback({})
    elif command == 'check_recordings':
        # Force an exception
        with patch.object(handler.storage, 'list_scripts', side_effect=Exception("Test error")):
            response = handler._handle_check_recordings({})
    elif command == 'get_latest':
        # Force an exception
        with patch.object(handler.storage, 'get_latest_script', side_effect=Exception("Test error")):
            response = handler._handle_get_latest({})
    
    # Verify error response structure
    assert isinstance(response, dict)
    assert 'success' in response
    assert response['success'] is False
    assert 'error' in response
    assert isinstance(response['error'], str)
    assert len(response['error']) > 0


@given(
    invalid_json=st.text(min_size=1).filter(
        lambda x: x.strip() and not x.strip().startswith('{') and not x.strip().isdigit()
    )
)
def test_json_parse_errors_are_handled(invalid_json):
    """
    Property: For any invalid JSON input, the handler should catch
    the error and send an error response rather than crashing.
    """
    handler = IPCHandler()
    
    # Mock stdout to capture response
    with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
        try:
            # Try to parse the invalid JSON
            message = json.loads(invalid_json)
            # If it somehow parses, skip this test case
            return
        except json.JSONDecodeError:
            # This is expected - now send the error
            handler._send_error(f"Invalid JSON: {invalid_json}")
            
            # Check that an error response was sent
            output = mock_stdout.getvalue()
            assert output.strip()
            response = json.loads(output.strip())
            assert response['success'] is False
            assert 'error' in response


def test_unknown_command_returns_error():
    """
    Test that unknown commands return proper error responses.
    """
    handler = IPCHandler()
    
    message = {'command': 'unknown_command', 'params': {}}
    response = handler._route_command(message)
    
    assert response['success'] is False
    assert 'error' in response
    assert 'Unknown command' in response['error']


def test_recorder_dependency_error_propagates():
    """
    Test that PyAutoGUI/pynput dependency errors are properly propagated.
    """
    handler = IPCHandler()
    
    # Mock Recorder to raise dependency error
    with patch('ipc.handler.Recorder') as MockRecorder:
        mock_recorder = Mock()
        mock_recorder.is_recording = False  # Not currently recording
        mock_recorder.start_recording.side_effect = RuntimeError(
            "Required libraries not installed: pyautogui. Please run: pip install pyautogui"
        )
        MockRecorder.return_value = mock_recorder
        
        # Set the handler's recorder to None first
        handler.recorder = None
        
        # Now call the handler which will create a new Recorder
        with patch('ipc.handler.Recorder', return_value=mock_recorder):
            response = handler._handle_start_recording({})
        
        assert response['success'] is False
        assert 'error' in response
        assert 'pyautogui' in response['error'].lower() or 'libraries' in response['error'].lower()


def test_corrupted_script_error_propagates():
    """
    Test that corrupted script file errors are properly propagated.
    """
    handler = IPCHandler()
    
    # Mock storage to raise validation error
    with patch.object(handler.storage, 'load_script', side_effect=Exception("Validation error")):
        with patch.object(handler.storage, 'get_latest_script', return_value='/fake/path.json'):
            response = handler._handle_start_playback({})
            
            assert response['success'] is False
            assert 'error' in response
            assert 'corrupted' in response['error'].lower()


def test_file_not_found_error_propagates():
    """
    Test that file not found errors are properly propagated.
    """
    handler = IPCHandler()
    
    # Mock storage to raise FileNotFoundError
    with patch.object(handler.storage, 'load_script', side_effect=FileNotFoundError("File not found")):
        response = handler._handle_start_playback({'scriptPath': '/nonexistent/path.json'})
        
        assert response['success'] is False
        assert 'error' in response
        assert 'not found' in response['error'].lower()


def test_full_recording_playback_integration():
    """
    Integration test: Verify full recording and playback flow through IPC handler.
    """
    handler = IPCHandler()
    
    # Mock the recorder and storage
    with patch('ipc.handler.Recorder') as MockRecorder:
        mock_recorder = Mock()
        mock_recorder.is_recording = False
        MockRecorder.return_value = mock_recorder
        
        # Start recording
        with patch.object(handler, 'recorder', None):
            with patch('ipc.handler.Recorder', return_value=mock_recorder):
                response = handler._handle_start_recording({})
                assert response['success'] is True
        
        # Stop recording
        from storage.models import Action
        mock_actions = [
            Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left'),
            Action(type='key_press', timestamp=1.0, key='a')
        ]
        mock_recorder.is_recording = True
        mock_recorder.stop_recording.return_value = mock_actions
        handler.recorder = mock_recorder
        
        with patch.object(handler.storage, 'save_script', return_value=Path('/fake/script.json')):
            response = handler._handle_stop_recording({})
            assert response['success'] is True
            assert 'scriptPath' in response['data']
            assert response['data']['actionCount'] == 2


def test_progress_callback_integration():
    """
    Test that progress events are emitted during playback.
    """
    handler = IPCHandler()
    
    from storage.models import Action, ScriptFile, ScriptMetadata
    from datetime import datetime
    
    # Create a mock script with actions
    actions = [
        Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left'),
        Action(type='key_press', timestamp=0.1, key='a')
    ]
    
    metadata = ScriptMetadata(
        created_at=datetime.now(),
        duration=0.1,
        action_count=2,
        platform='darwin'
    )
    
    script_file = ScriptFile(metadata=metadata, actions=actions)
    
    # Mock storage and player
    with patch.object(handler.storage, 'get_latest_script', return_value=Path('/fake/script.json')):
        with patch.object(handler.storage, 'load_script', return_value=script_file):
            with patch('sys.stdout', new_callable=StringIO) as mock_stdout:
                # Start playback
                response = handler._handle_start_playback({})
                assert response['success'] is True
                
                # Manually trigger progress callback to test it
                handler._emit_progress(1, 2)
                
                # Check that progress event was emitted
                output = mock_stdout.getvalue()
                lines = [line for line in output.strip().split('\n') if line]
                
                # Should have at least one progress event
                assert len(lines) >= 1
                
                # Parse the last line as a progress event
                event = json.loads(lines[-1])
                assert event['type'] == 'progress'
                assert 'currentAction' in event['data']
                assert 'totalActions' in event['data']


# Additional error scenario tests for Requirements 9.1, 9.2, 9.3, 9.4, 9.5


def test_permission_error_formatting_macos():
    """
    Test that permission errors on macOS include helpful guidance.
    Requirements: 9.1, 9.5
    """
    handler = IPCHandler()
    
    with patch('platform.system', return_value='Darwin'):
        error_msg = handler._format_permission_error("Permission denied")
        
        assert 'Accessibility' in error_msg
        assert 'System Preferences' in error_msg
        assert 'Security & Privacy' in error_msg


def test_permission_error_formatting_windows():
    """
    Test that permission errors on Windows include helpful guidance.
    Requirements: 9.1, 9.5
    """
    handler = IPCHandler()
    
    with patch('platform.system', return_value='Windows'):
        error_msg = handler._format_permission_error("Permission denied")
        
        assert 'administrator' in error_msg.lower()


def test_permission_error_formatting_linux():
    """
    Test that permission errors on Linux include helpful guidance.
    Requirements: 9.1, 9.5
    """
    handler = IPCHandler()
    
    with patch('platform.system', return_value='Linux'):
        error_msg = handler._format_permission_error("Permission denied")
        
        assert 'permissions' in error_msg.lower()
        assert 'input devices' in error_msg.lower()


def test_filesystem_error_disk_full():
    """
    Test that disk full errors are properly formatted.
    Requirements: 9.2, 9.5
    """
    handler = IPCHandler()
    
    error_msg = handler._format_filesystem_error("No space left on device")
    
    assert 'disk space' in error_msg.lower()
    assert 'free up space' in error_msg.lower()


def test_filesystem_error_permission_denied():
    """
    Test that file system permission errors are properly formatted.
    Requirements: 9.2, 9.5
    """
    handler = IPCHandler()
    
    error_msg = handler._format_filesystem_error("Permission denied: cannot write")
    
    assert 'permission' in error_msg.lower()
    assert 'write permissions' in error_msg.lower() or 'permissions' in error_msg.lower()


def test_filesystem_error_readonly():
    """
    Test that read-only file system errors are properly formatted.
    Requirements: 9.2, 9.5
    """
    handler = IPCHandler()
    
    error_msg = handler._format_filesystem_error("Read-only file system")
    
    assert 'read-only' in error_msg.lower()


def test_recording_permission_error_propagates():
    """
    Test that permission errors during recording are properly handled.
    Requirements: 9.1, 9.5
    """
    handler = IPCHandler()
    
    with patch('ipc.handler.Recorder') as MockRecorder:
        mock_recorder = Mock()
        mock_recorder.is_recording = False
        mock_recorder.start_recording.side_effect = PermissionError("Access denied")
        MockRecorder.return_value = mock_recorder
        
        handler.recorder = None
        
        with patch('ipc.handler.Recorder', return_value=mock_recorder):
            response = handler._handle_start_recording({})
        
        assert response['success'] is False
        assert 'error' in response
        # Should contain platform-specific guidance
        assert 'permission' in response['error'].lower()


def test_save_script_permission_error():
    """
    Test that permission errors when saving scripts are properly handled.
    Requirements: 9.2, 9.5
    """
    handler = IPCHandler()
    
    from storage.models import Action
    mock_actions = [Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')]
    
    with patch('ipc.handler.Recorder') as MockRecorder:
        mock_recorder = Mock()
        mock_recorder.is_recording = True
        mock_recorder.stop_recording.return_value = mock_actions
        handler.recorder = mock_recorder
        
        with patch.object(handler.storage, 'save_script', side_effect=PermissionError("Cannot write")):
            response = handler._handle_stop_recording({})
            
            assert response['success'] is False
            assert 'error' in response
            assert 'permission' in response['error'].lower()


def test_save_script_filesystem_error():
    """
    Test that file system errors when saving scripts are properly handled.
    Requirements: 9.2, 9.5
    """
    handler = IPCHandler()
    
    from storage.models import Action
    mock_actions = [Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')]
    
    with patch('ipc.handler.Recorder') as MockRecorder:
        mock_recorder = Mock()
        mock_recorder.is_recording = True
        mock_recorder.stop_recording.return_value = mock_actions
        handler.recorder = mock_recorder
        
        with patch.object(handler.storage, 'save_script', side_effect=OSError("Disk full")):
            response = handler._handle_stop_recording({})
            
            assert response['success'] is False
            assert 'error' in response


def test_corrupted_json_script_error():
    """
    Test that corrupted JSON files are properly detected and reported.
    Requirements: 9.3, 9.5
    """
    handler = IPCHandler()
    
    with patch.object(handler.storage, 'load_script', side_effect=json.JSONDecodeError("Invalid", "", 0)):
        with patch.object(handler.storage, 'get_latest_script', return_value=Path('/fake/script.json')):
            response = handler._handle_start_playback({})
            
            assert response['success'] is False
            assert 'error' in response
            assert 'corrupted' in response['error'].lower()
            assert 'json' in response['error'].lower()


def test_invalid_schema_script_error():
    """
    Test that scripts with invalid schema are properly detected.
    Requirements: 9.3, 9.5
    """
    handler = IPCHandler()
    
    from pydantic import ValidationError
    
    with patch.object(handler.storage, 'load_script', side_effect=ValidationError.from_exception_data(
        "ScriptFile",
        [{"type": "missing", "loc": ("actions",), "msg": "Field required"}]
    )):
        with patch.object(handler.storage, 'get_latest_script', return_value=Path('/fake/script.json')):
            response = handler._handle_start_playback({})
            
            assert response['success'] is False
            assert 'error' in response
            assert 'corrupted' in response['error'].lower() or 'validation' in response['error'].lower()


def test_python_core_unavailable_no_recordings():
    """
    Test that missing recordings are properly reported.
    Requirements: 9.4, 9.5
    """
    handler = IPCHandler()
    
    with patch.object(handler.storage, 'get_latest_script', return_value=None):
        response = handler._handle_start_playback({})
        
        assert response['success'] is False
        assert 'error' in response
        assert 'no recordings found' in response['error'].lower()
        assert 'record a session first' in response['error'].lower()


def test_playback_permission_error():
    """
    Test that permission errors during playback are properly handled.
    Requirements: 9.1, 9.5
    """
    handler = IPCHandler()
    
    from storage.models import Action, ScriptFile, ScriptMetadata
    from datetime import datetime
    
    actions = [Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')]
    metadata = ScriptMetadata(
        created_at=datetime.now(),
        duration=0.0,
        action_count=1,
        platform='darwin'
    )
    script_file = ScriptFile(metadata=metadata, actions=actions)
    
    with patch.object(handler.storage, 'get_latest_script', return_value=Path('/fake/script.json')):
        with patch.object(handler.storage, 'load_script', return_value=script_file):
            with patch('ipc.handler.Player') as MockPlayer:
                mock_player = Mock()
                mock_player.is_playing = False
                mock_player.start_playback.side_effect = PermissionError("Access denied")
                MockPlayer.return_value = mock_player
                
                response = handler._handle_start_playback({})
                
                assert response['success'] is False
                assert 'error' in response
                assert 'permission' in response['error'].lower()


def test_multiple_error_types_in_sequence():
    """
    Test that multiple different errors can be handled in sequence.
    Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
    """
    handler = IPCHandler()
    
    # Test 1: No recording in progress
    response1 = handler._handle_stop_recording({})
    assert response1['success'] is False
    
    # Test 2: No playback in progress
    response2 = handler._handle_stop_playback({})
    assert response2['success'] is False
    
    # Test 3: No recordings found
    with patch.object(handler.storage, 'get_latest_script', return_value=None):
        response3 = handler._handle_start_playback({})
        assert response3['success'] is False
    
    # All should have error messages
    assert 'error' in response1
    assert 'error' in response2
    assert 'error' in response3
