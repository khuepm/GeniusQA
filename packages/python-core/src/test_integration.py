"""
Integration tests for desktop recorder MVP end-to-end flows.
Tests complete recording, playback, error recovery, and IPC communication.
Requirements: All (1.1-9.5)
"""

import json
import pytest
import tempfile
import time
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from storage.models import Action, ScriptFile, ScriptMetadata
from storage.storage import Storage
from recorder.recorder import Recorder
from player.player import Player
from ipc.handler import IPCHandler


class TestCompleteRecordingFlow:
    """Test complete recording flow from start to finish."""

    def test_full_recording_session_with_actions(self):
        """
        Test a complete recording session that captures actions and saves to file.
        Requirements: 1.1, 1.3, 1.4, 6.1, 6.3
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Create mock actions that would be captured
            mock_actions = [
                Action(type='mouse_move', timestamp=0.0, x=100, y=200),
                Action(type='mouse_click', timestamp=0.5, x=100, y=200, button='left'),
                Action(type='key_press', timestamp=1.0, key='a'),
                Action(type='key_release', timestamp=1.1, key='a'),
            ]
            
            # Save the recording
            script_path = storage.save_script(mock_actions)
            
            # Verify file was created
            assert script_path.exists()
            assert script_path.suffix == '.json'
            
            # Verify file can be loaded back
            loaded_script = storage.load_script(script_path)
            assert len(loaded_script.actions) == 4
            assert loaded_script.actions[0].type == 'mouse_move'
            assert loaded_script.actions[1].type == 'mouse_click'
            assert loaded_script.metadata.action_count == 4

    def test_recording_with_no_actions(self):
        """
        Test recording session that captures no actions.
        Requirements: 1.1, 1.3
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Save empty recording
            script_path = storage.save_script([])
            
            # Verify file was created
            assert script_path.exists()
            
            # Verify file contains empty actions list
            loaded_script = storage.load_script(script_path)
            assert len(loaded_script.actions) == 0
            assert loaded_script.metadata.action_count == 0

    def test_multiple_recording_sessions(self):
        """
        Test multiple recording sessions create separate files.
        Requirements: 1.1, 1.3, 1.4, 6.3
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # First recording
            actions1 = [Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')]
            path1 = storage.save_script(actions1)
            
            # Longer delay to ensure different timestamps (1 second resolution)
            time.sleep(1.1)
            
            # Second recording
            actions2 = [Action(type='key_press', timestamp=0.0, key='b')]
            path2 = storage.save_script(actions2)
            
            # Verify different files
            assert path1 != path2
            assert path1.exists()
            assert path2.exists()
            
            # Verify both can be loaded
            script1 = storage.load_script(path1)
            script2 = storage.load_script(path2)
            assert len(script1.actions) == 1
            assert len(script2.actions) == 1
            assert script1.actions[0].type == 'mouse_click'
            assert script2.actions[0].type == 'key_press'

    def test_recording_creates_directory_if_missing(self):
        """
        Test that recording auto-creates storage directory.
        Requirements: 6.2
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            # Use a subdirectory that doesn't exist yet
            storage_dir = Path(tmpdir) / 'recordings' / 'nested'
            assert not storage_dir.exists()
            
            storage = Storage(base_dir=storage_dir)
            
            # Save a recording
            actions = [Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')]
            script_path = storage.save_script(actions)
            
            # Verify directory was created
            assert storage_dir.exists()
            assert script_path.exists()


class TestCompletePlaybackFlow:
    """Test complete playback flow from start to finish."""

    def test_full_playback_session(self):
        """
        Test a complete playback session that loads and executes actions.
        Requirements: 2.1, 2.2, 7.1, 7.2, 7.3
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Create and save a script
            actions = [
                Action(type='mouse_move', timestamp=0.0, x=100, y=200),
                Action(type='mouse_click', timestamp=0.1, x=100, y=200, button='left'),
                Action(type='key_press', timestamp=0.2, key='a'),
            ]
            script_path = storage.save_script(actions)
            
            # Load the script
            script_file = storage.load_script(script_path)
            
            # Create player with mock PyAutoGUI
            with patch('player.player.PYAUTOGUI_AVAILABLE', True):
                with patch('player.player.pyautogui', create=True) as mock_pyautogui:
                    player = Player(script_file.actions)
                    
                    # Mock the execution to be instant
                    mock_pyautogui.moveTo = Mock()
                    mock_pyautogui.click = Mock()
                    mock_pyautogui.press = Mock()
                    
                    # Start playback (non-blocking for test)
                    player.start_playback()
                    
                    # Wait a bit for playback to start
                    time.sleep(0.1)
                    
                    # Stop playback
                    player.stop_playback()
                    
                    # Verify player was started
                    assert player._playback_thread is not None

    def test_playback_with_timing_delays(self):
        """
        Test that playback respects timing between actions.
        Requirements: 7.1, 7.2, 7.3, 7.4
        """
        actions = [
            Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left'),
            Action(type='mouse_click', timestamp=0.5, x=200, y=300, button='left'),
        ]
        
        with patch('player.player.PYAUTOGUI_AVAILABLE', True):
            with patch('player.player.pyautogui', create=True):
                player = Player(actions)
                
                # Calculate expected delay
                delay = player._calculate_delay(actions[0], actions[1])
                
                # Should be approximately 0.5 seconds
                assert 0.4 <= delay <= 0.6

    def test_playback_with_long_delay_capping(self):
        """
        Test that very long delays are capped at 5 seconds.
        Requirements: 7.5
        """
        actions = [
            Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left'),
            Action(type='mouse_click', timestamp=10.0, x=200, y=300, button='left'),
        ]
        
        with patch('player.player.PYAUTOGUI_AVAILABLE', True):
            with patch('player.player.pyautogui', create=True):
                player = Player(actions)
                
                # Calculate delay
                delay = player._calculate_delay(actions[0], actions[1])
                
                # Should be capped at 5 seconds
                assert delay == 5.0

    def test_playback_interruption(self):
        """
        Test that playback can be interrupted mid-execution.
        Requirements: 2.3
        """
        actions = [
            Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left'),
            Action(type='mouse_click', timestamp=1.0, x=200, y=300, button='left'),
            Action(type='mouse_click', timestamp=2.0, x=300, y=400, button='left'),
        ]
        
        with patch('player.player.PYAUTOGUI_AVAILABLE', True):
            with patch('player.player.pyautogui', create=True):
                player = Player(actions)
                
                # Start playback
                player.start_playback()
                
                # Immediately stop
                player.stop_playback()
                
                # Verify playback stopped
                assert not player.is_playing

    def test_playback_of_latest_recording(self):
        """
        Test loading and playing the most recent recording.
        Requirements: 2.1, 6.5
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Create multiple recordings
            actions1 = [Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')]
            storage.save_script(actions1)
            
            time.sleep(0.01)
            
            actions2 = [Action(type='key_press', timestamp=0.0, key='b')]
            path2 = storage.save_script(actions2)
            
            # Get latest
            latest_path = storage.get_latest_script()
            
            # Should be the second recording
            assert latest_path == path2
            
            # Load and verify
            script = storage.load_script(latest_path)
            assert len(script.actions) == 1
            assert script.actions[0].key == 'b'


class TestErrorRecoveryScenarios:
    """Test error recovery in various failure scenarios."""

    def test_recovery_from_corrupted_json(self):
        """
        Test handling of corrupted JSON files.
        Requirements: 9.3
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Create a corrupted file
            corrupted_path = storage.base_dir / 'corrupted.json'
            corrupted_path.write_text('{ invalid json }')
            
            # Try to load it
            with pytest.raises(Exception) as exc_info:
                storage.load_script(corrupted_path)
            
            # Should raise an error
            assert exc_info.value is not None

    def test_recovery_from_invalid_schema(self):
        """
        Test handling of files with invalid schema.
        Requirements: 9.3
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Create a file with invalid schema
            invalid_path = storage.base_dir / 'invalid.json'
            invalid_data = {
                'metadata': {
                    'version': '1.0',
                    'created_at': datetime.now().isoformat(),
                    'duration': 1.0,
                    'action_count': 1,
                    'platform': 'darwin'
                },
                'actions': [
                    {
                        'type': 'invalid_type',  # Invalid action type
                        'timestamp': 0.0
                    }
                ]
            }
            invalid_path.write_text(json.dumps(invalid_data))
            
            # Try to load it
            with pytest.raises(Exception):
                storage.load_script(invalid_path)

    def test_recovery_from_missing_file(self):
        """
        Test handling of missing script files.
        Requirements: 9.2
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Try to load non-existent file
            with pytest.raises(FileNotFoundError):
                storage.load_script(Path('/nonexistent/file.json'))

    def test_recovery_from_no_recordings(self):
        """
        Test handling when no recordings exist.
        Requirements: 2.5, 9.4
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Try to get latest when none exist
            latest = storage.get_latest_script()
            
            # Should return None
            assert latest is None

    def test_recovery_from_permission_error(self):
        """
        Test handling of permission errors.
        Requirements: 9.1, 9.5
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Mock the open function to raise PermissionError
            actions = [Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')]
            
            with patch('builtins.open', side_effect=PermissionError("Access denied")):
                with pytest.raises(PermissionError):
                    storage.save_script(actions)

    def test_recovery_from_disk_full_error(self):
        """
        Test handling of disk full errors.
        Requirements: 9.2, 9.5
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Mock the open function to raise OSError (disk full)
            actions = [Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')]
            
            with patch('builtins.open', side_effect=OSError("No space left on device")):
                with pytest.raises(OSError):
                    storage.save_script(actions)


class TestIPCCommunication:
    """Test IPC communication between React Native and Python Core."""

    def test_ipc_start_recording_command(self):
        """
        Test IPC handler processes start_recording command.
        Requirements: 5.1, 5.3
        """
        handler = IPCHandler()
        
        # Mock Recorder to avoid actual recording
        with patch('ipc.handler.Recorder') as MockRecorder:
            mock_recorder = Mock()
            mock_recorder.is_recording = False
            MockRecorder.return_value = mock_recorder
            
            handler.recorder = None
            
            with patch('ipc.handler.Recorder', return_value=mock_recorder):
                message = {'command': 'start_recording', 'params': {}}
                response = handler._route_command(message)
                
                assert response['success'] is True

    def test_ipc_stop_recording_command(self):
        """
        Test IPC handler processes stop_recording command.
        Requirements: 5.1, 5.3
        """
        handler = IPCHandler()
        
        # Start recording first
        with patch('ipc.handler.Recorder') as MockRecorder:
            mock_recorder = Mock()
            mock_recorder.is_recording = True
            mock_recorder.stop_recording.return_value = [
                Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')
            ]
            handler.recorder = mock_recorder
            
            with patch.object(handler.storage, 'save_script', return_value=Path('/fake/script.json')):
                message = {'command': 'stop_recording', 'params': {}}
                response = handler._route_command(message)
                
                assert response['success'] is True
                assert 'scriptPath' in response['data']

    def test_ipc_start_playback_command(self):
        """
        Test IPC handler processes start_playback command.
        Requirements: 5.1, 5.3
        """
        handler = IPCHandler()
        
        # Create mock script
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
                message = {'command': 'start_playback', 'params': {}}
                response = handler._route_command(message)
                
                assert response['success'] is True

    def test_ipc_stop_playback_command(self):
        """
        Test IPC handler processes stop_playback command.
        Requirements: 5.1, 5.3
        """
        handler = IPCHandler()
        
        # Mock player
        with patch('ipc.handler.Player') as MockPlayer:
            mock_player = Mock()
            mock_player.is_playing = True
            handler.player = mock_player
            
            message = {'command': 'stop_playback', 'params': {}}
            response = handler._route_command(message)
            
            assert response['success'] is True

    def test_ipc_check_recordings_command(self):
        """
        Test IPC handler processes check_recordings command.
        Requirements: 5.1, 5.3
        """
        handler = IPCHandler()
        
        with patch.object(handler.storage, 'list_scripts', return_value=[Path('/fake/script.json')]):
            message = {'command': 'check_recordings', 'params': {}}
            response = handler._route_command(message)
            
            assert response['success'] is True
            assert response['data']['hasRecordings'] is True

    def test_ipc_get_latest_command(self):
        """
        Test IPC handler processes get_latest command.
        Requirements: 5.1, 5.3
        """
        handler = IPCHandler()
        
        with patch.object(handler.storage, 'get_latest_script', return_value=Path('/fake/script.json')):
            message = {'command': 'get_latest', 'params': {}}
            response = handler._route_command(message)
            
            assert response['success'] is True
            assert response['data']['scriptPath'] == '/fake/script.json'

    def test_ipc_error_response_format(self):
        """
        Test IPC error responses have correct format.
        Requirements: 5.5, 9.1, 9.2, 9.4
        """
        handler = IPCHandler()
        
        # Try to stop recording when none is in progress
        message = {'command': 'stop_recording', 'params': {}}
        response = handler._route_command(message)
        
        assert response['success'] is False
        assert 'error' in response
        assert isinstance(response['error'], str)

    def test_ipc_unknown_command(self):
        """
        Test IPC handler handles unknown commands.
        Requirements: 5.5
        """
        handler = IPCHandler()
        
        message = {'command': 'unknown_command', 'params': {}}
        response = handler._route_command(message)
        
        assert response['success'] is False
        assert 'error' in response

    def test_ipc_full_recording_playback_cycle(self):
        """
        Test complete IPC cycle: start recording -> stop recording -> start playback -> stop playback.
        Requirements: All
        """
        handler = IPCHandler()
        
        # 1. Start recording
        with patch('ipc.handler.Recorder') as MockRecorder:
            mock_recorder = Mock()
            mock_recorder.is_recording = False
            MockRecorder.return_value = mock_recorder
            
            handler.recorder = None
            with patch('ipc.handler.Recorder', return_value=mock_recorder):
                response1 = handler._route_command({'command': 'start_recording', 'params': {}})
                assert response1['success'] is True
        
        # 2. Stop recording
        mock_recorder.is_recording = True
        mock_recorder.stop_recording.return_value = [
            Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')
        ]
        handler.recorder = mock_recorder
        
        with patch.object(handler.storage, 'save_script', return_value=Path('/fake/script.json')):
            response2 = handler._route_command({'command': 'stop_recording', 'params': {}})
            assert response2['success'] is True
            assert 'scriptPath' in response2['data']
        
        # 3. Start playback
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=0.0,
            action_count=1,
            platform='darwin'
        )
        script_file = ScriptFile(
            metadata=metadata,
            actions=[Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left')]
        )
        
        with patch.object(handler.storage, 'get_latest_script', return_value=Path('/fake/script.json')):
            with patch.object(handler.storage, 'load_script', return_value=script_file):
                response3 = handler._route_command({'command': 'start_playback', 'params': {}})
                assert response3['success'] is True
        
        # 4. Stop playback
        with patch('ipc.handler.Player') as MockPlayer:
            mock_player = Mock()
            mock_player.is_playing = True
            handler.player = mock_player
            
            response4 = handler._route_command({'command': 'stop_playback', 'params': {}})
            assert response4['success'] is True


class TestScriptFileRoundTrip:
    """Test script file serialization and deserialization."""

    def test_save_and_load_preserves_data(self):
        """
        Test that saving and loading a script preserves all data.
        Requirements: 3.1, 3.2, 3.3, 3.5
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Create actions with various types
            original_actions = [
                Action(type='mouse_move', timestamp=0.0, x=100, y=200),
                Action(type='mouse_click', timestamp=0.5, x=100, y=200, button='left'),
                Action(type='mouse_click', timestamp=1.0, x=150, y=250, button='right'),
                Action(type='key_press', timestamp=1.5, key='a'),
                Action(type='key_release', timestamp=1.6, key='a'),
                Action(type='key_press', timestamp=2.0, key='shift'),
            ]
            
            # Save
            script_path = storage.save_script(original_actions)
            
            # Load
            loaded_script = storage.load_script(script_path)
            
            # Verify all actions preserved
            assert len(loaded_script.actions) == len(original_actions)
            
            for original, loaded in zip(original_actions, loaded_script.actions):
                assert loaded.type == original.type
                assert loaded.timestamp == original.timestamp
                assert loaded.x == original.x
                assert loaded.y == original.y
                assert loaded.button == original.button
                assert loaded.key == original.key

    def test_metadata_is_generated_correctly(self):
        """
        Test that metadata is correctly generated when saving.
        Requirements: 3.1, 3.2
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            actions = [
                Action(type='mouse_click', timestamp=0.0, x=100, y=200, button='left'),
                Action(type='key_press', timestamp=5.5, key='a'),
            ]
            
            script_path = storage.save_script(actions)
            loaded_script = storage.load_script(script_path)
            
            # Verify metadata
            assert loaded_script.metadata.version == '1.0'
            assert loaded_script.metadata.action_count == 2
            assert loaded_script.metadata.duration == 5.5
            assert loaded_script.metadata.platform in ['darwin', 'linux', 'windows']
            assert isinstance(loaded_script.metadata.created_at, datetime)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
