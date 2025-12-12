"""
Tests for script management IPC commands.

Tests the list_scripts, load_script, save_script, and delete_script commands
to ensure proper script editing functionality.
"""

import json
import pytest
from pathlib import Path
from datetime import datetime
from ipc.handler import IPCHandler
from storage.models import Action, ScriptMetadata, ScriptFile


@pytest.fixture
def handler():
    """Create an IPC handler instance."""
    return IPCHandler()


@pytest.fixture
def sample_script_data():
    """Create sample script data for testing."""
    return {
        'metadata': {
            'version': '1.0',
            'created_at': datetime.now().isoformat(),
            'duration': 10.5,
            'action_count': 3,
            'platform': 'darwin'
        },
        'actions': [
            {
                'type': 'mouse_move',
                'timestamp': 0.0,
                'x': 100,
                'y': 200
            },
            {
                'type': 'mouse_click',
                'timestamp': 1.0,
                'x': 100,
                'y': 200,
                'button': 'left'
            },
            {
                'type': 'key_press',
                'timestamp': 2.0,
                'key': 'a'
            }
        ]
    }


def test_list_scripts_empty_directory(handler, tmp_path, monkeypatch):
    """Test listing scripts when directory is empty."""
    # Set up empty recordings directory
    monkeypatch.setattr(handler.storage, 'base_dir', tmp_path)
    
    message = {'command': 'list_scripts', 'params': {}}
    response = handler._route_command(message)
    
    assert response['success'] is True
    assert response['data']['scripts'] == []


def test_list_scripts_with_recordings(handler, tmp_path, monkeypatch, sample_script_data):
    """Test listing scripts when recordings exist."""
    # Set up recordings directory with sample scripts
    monkeypatch.setattr(handler.storage, 'base_dir', tmp_path)
    
    # Create sample script files
    script1_path = tmp_path / 'script_20240101_120000.json'
    script2_path = tmp_path / 'script_20240101_130000.json'
    
    with open(script1_path, 'w') as f:
        json.dump(sample_script_data, f)
    
    with open(script2_path, 'w') as f:
        json.dump(sample_script_data, f)
    
    message = {'command': 'list_scripts', 'params': {}}
    response = handler._route_command(message)
    
    assert response['success'] is True
    assert len(response['data']['scripts']) == 2
    assert all('path' in script for script in response['data']['scripts'])
    assert all('filename' in script for script in response['data']['scripts'])
    assert all('created_at' in script for script in response['data']['scripts'])
    assert all('duration' in script for script in response['data']['scripts'])
    assert all('action_count' in script for script in response['data']['scripts'])


def test_list_scripts_skips_corrupted_files(handler, tmp_path, monkeypatch):
    """Test that list_scripts skips corrupted files."""
    monkeypatch.setattr(handler.storage, 'base_dir', tmp_path)
    
    # Create a valid script (must match script_*.json pattern)
    valid_script = tmp_path / 'script_20240101_120000.json'
    with open(valid_script, 'w') as f:
        json.dump({
            'metadata': {
                'version': '1.0',
                'created_at': datetime.now().isoformat(),
                'duration': 5.0,
                'action_count': 1,
                'platform': 'darwin'
            },
            'actions': [
                {'type': 'mouse_move', 'timestamp': 0.0, 'x': 100, 'y': 200}
            ]
        }, f)
    
    # Create a corrupted script (must match script_*.json pattern)
    corrupted_script = tmp_path / 'script_20240101_130000.json'
    with open(corrupted_script, 'w') as f:
        f.write('invalid json {')
    
    message = {'command': 'list_scripts', 'params': {}}
    response = handler._route_command(message)
    
    # Should succeed and return only the valid script
    assert response['success'] is True
    assert len(response['data']['scripts']) == 1
    assert response['data']['scripts'][0]['filename'] == 'script_20240101_120000.json'


def test_load_script_success(handler, tmp_path, monkeypatch, sample_script_data):
    """Test loading a script successfully."""
    monkeypatch.setattr(handler.storage, 'base_dir', tmp_path)
    
    # Create a script file
    script_path = tmp_path / 'test_script.json'
    with open(script_path, 'w') as f:
        json.dump(sample_script_data, f)
    
    message = {
        'command': 'load_script',
        'params': {'scriptPath': str(script_path)}
    }
    response = handler._route_command(message)
    
    assert response['success'] is True
    assert 'script' in response['data']
    assert response['data']['script']['metadata']['version'] == '1.0'
    assert len(response['data']['script']['actions']) == 3


def test_load_script_missing_path_parameter(handler):
    """Test loading script without providing path parameter."""
    message = {'command': 'load_script', 'params': {}}
    response = handler._route_command(message)
    
    assert response['success'] is False
    assert 'Missing required parameter: scriptPath' in response['error']


def test_load_script_file_not_found(handler, tmp_path):
    """Test loading a non-existent script."""
    nonexistent_path = tmp_path / 'nonexistent.json'
    
    message = {
        'command': 'load_script',
        'params': {'scriptPath': str(nonexistent_path)}
    }
    response = handler._route_command(message)
    
    assert response['success'] is False
    assert 'not found' in response['error'].lower()


def test_load_script_corrupted_json(handler, tmp_path, monkeypatch):
    """Test loading a script with corrupted JSON."""
    monkeypatch.setattr(handler.storage, 'base_dir', tmp_path)
    
    # Create a corrupted script file
    script_path = tmp_path / 'corrupted.json'
    with open(script_path, 'w') as f:
        f.write('invalid json {')
    
    message = {
        'command': 'load_script',
        'params': {'scriptPath': str(script_path)}
    }
    response = handler._route_command(message)
    
    assert response['success'] is False
    assert 'corrupted' in response['error'].lower()


def test_save_script_success(handler, tmp_path, monkeypatch, sample_script_data):
    """Test saving a script successfully."""
    monkeypatch.setattr(handler.storage, 'base_dir', tmp_path)
    
    script_path = tmp_path / 'test_script.json'
    
    message = {
        'command': 'save_script',
        'params': {
            'scriptPath': str(script_path),
            'scriptData': sample_script_data
        }
    }
    response = handler._route_command(message)
    
    assert response['success'] is True
    assert script_path.exists()
    
    # Verify the saved content
    with open(script_path, 'r') as f:
        saved_data = json.load(f)
    assert saved_data['metadata']['version'] == '1.0'
    assert len(saved_data['actions']) == 3


def test_save_script_missing_parameters(handler):
    """Test saving script without required parameters."""
    # Missing scriptPath
    message = {
        'command': 'save_script',
        'params': {'scriptData': {}}
    }
    response = handler._route_command(message)
    assert response['success'] is False
    assert 'Missing required parameter: scriptPath' in response['error']
    
    # Missing scriptData
    message = {
        'command': 'save_script',
        'params': {'scriptPath': '/some/path'}
    }
    response = handler._route_command(message)
    assert response['success'] is False
    assert 'Missing required parameter: scriptData' in response['error']


def test_save_script_invalid_data(handler, tmp_path):
    """Test saving script with invalid data structure."""
    script_path = tmp_path / 'test_script.json'
    
    # Invalid script data (missing required fields)
    invalid_data = {
        'metadata': {'version': '1.0'},  # Missing required fields
        'actions': []
    }
    
    message = {
        'command': 'save_script',
        'params': {
            'scriptPath': str(script_path),
            'scriptData': invalid_data
        }
    }
    response = handler._route_command(message)
    
    assert response['success'] is False
    assert 'Invalid script data' in response['error']


def test_delete_script_success(handler, tmp_path, monkeypatch, sample_script_data):
    """Test deleting a script successfully."""
    monkeypatch.setattr(handler.storage, 'base_dir', tmp_path)
    
    # Create a script file
    script_path = tmp_path / 'test_script.json'
    with open(script_path, 'w') as f:
        json.dump(sample_script_data, f)
    
    assert script_path.exists()
    
    message = {
        'command': 'delete_script',
        'params': {'scriptPath': str(script_path)}
    }
    response = handler._route_command(message)
    
    assert response['success'] is True
    assert not script_path.exists()


def test_delete_script_missing_parameter(handler):
    """Test deleting script without path parameter."""
    message = {'command': 'delete_script', 'params': {}}
    response = handler._route_command(message)
    
    assert response['success'] is False
    assert 'Missing required parameter: scriptPath' in response['error']


def test_delete_script_file_not_found(handler, tmp_path):
    """Test deleting a non-existent script."""
    nonexistent_path = tmp_path / 'nonexistent.json'
    
    message = {
        'command': 'delete_script',
        'params': {'scriptPath': str(nonexistent_path)}
    }
    response = handler._route_command(message)
    
    assert response['success'] is False
    assert 'not found' in response['error'].lower()


def test_script_editing_workflow(handler, tmp_path, monkeypatch, sample_script_data):
    """Test complete workflow: list, load, modify, save, delete."""
    monkeypatch.setattr(handler.storage, 'base_dir', tmp_path)
    
    # 1. List scripts (should be empty)
    response = handler._route_command({'command': 'list_scripts', 'params': {}})
    assert response['success'] is True
    assert len(response['data']['scripts']) == 0
    
    # 2. Create a script (must match script_*.json pattern)
    script_path = tmp_path / 'script_20240101_120000.json'
    with open(script_path, 'w') as f:
        json.dump(sample_script_data, f)
    
    # 3. List scripts (should have one)
    response = handler._route_command({'command': 'list_scripts', 'params': {}})
    assert response['success'] is True
    assert len(response['data']['scripts']) == 1
    
    # 4. Load the script
    response = handler._route_command({
        'command': 'load_script',
        'params': {'scriptPath': str(script_path)}
    })
    assert response['success'] is True
    loaded_script = response['data']['script']
    
    # 5. Modify the script
    loaded_script['metadata']['duration'] = 20.0
    loaded_script['actions'].append({
        'type': 'key_release',
        'timestamp': 3.0,
        'key': 'a'
    })
    
    # 6. Save the modified script
    response = handler._route_command({
        'command': 'save_script',
        'params': {
            'scriptPath': str(script_path),
            'scriptData': loaded_script
        }
    })
    assert response['success'] is True
    
    # 7. Load again to verify changes
    response = handler._route_command({
        'command': 'load_script',
        'params': {'scriptPath': str(script_path)}
    })
    assert response['success'] is True
    assert response['data']['script']['metadata']['duration'] == 20.0
    assert len(response['data']['script']['actions']) == 4
    
    # 8. Delete the script
    response = handler._route_command({
        'command': 'delete_script',
        'params': {'scriptPath': str(script_path)}
    })
    assert response['success'] is True
    
    # 9. List scripts (should be empty again)
    response = handler._route_command({'command': 'list_scripts', 'params': {}})
    assert response['success'] is True
    assert len(response['data']['scripts']) == 0
