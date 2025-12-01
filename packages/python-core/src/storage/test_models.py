"""Property-based tests for data models."""

import pytest
from hypothesis import given, strategies as st
from datetime import datetime
from .models import Action, ScriptMetadata, ScriptFile
from .storage import Storage
from pathlib import Path
import tempfile
import shutil


# Strategies for generating valid actions
@st.composite
def mouse_move_action(draw):
    """Generate a valid mouse_move action."""
    return Action(
        type='mouse_move',
        timestamp=draw(st.floats(min_value=0, max_value=1000)),
        x=draw(st.integers(min_value=0, max_value=3840)),
        y=draw(st.integers(min_value=0, max_value=2160))
    )


@st.composite
def mouse_click_action(draw):
    """Generate a valid mouse_click action."""
    return Action(
        type='mouse_click',
        timestamp=draw(st.floats(min_value=0, max_value=1000)),
        x=draw(st.integers(min_value=0, max_value=3840)),
        y=draw(st.integers(min_value=0, max_value=2160)),
        button=draw(st.sampled_from(['left', 'right', 'middle']))
    )


@st.composite
def key_press_action(draw):
    """Generate a valid key_press action."""
    return Action(
        type='key_press',
        timestamp=draw(st.floats(min_value=0, max_value=1000)),
        key=draw(st.text(min_size=1, max_size=10, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))))
    )


@st.composite
def key_release_action(draw):
    """Generate a valid key_release action."""
    return Action(
        type='key_release',
        timestamp=draw(st.floats(min_value=0, max_value=1000)),
        key=draw(st.text(min_size=1, max_size=10, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))))
    )


def valid_action():
    """Strategy for generating any valid action."""
    return st.one_of(
        mouse_move_action(),
        mouse_click_action(),
        key_press_action(),
        key_release_action()
    )


# Feature: desktop-recorder-mvp, Property 2: Script file format round-trip consistency
@given(st.lists(valid_action(), min_size=0, max_size=50))
def test_script_roundtrip_consistency(actions):
    """For any valid script file, loading and then saving it should produce an equivalent file.
    
    Validates: Requirements 3.1, 3.2, 3.3, 3.5
    """
    # Create a temporary directory for testing
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = Storage(base_dir=Path(tmpdir))
        
        # Save the actions
        saved_path = storage.save_script(actions)
        
        # Load the script back
        loaded_script = storage.load_script(saved_path)
        
        # Verify the actions are equivalent
        assert len(loaded_script.actions) == len(actions)
        
        for original, loaded in zip(actions, loaded_script.actions):
            assert loaded.type == original.type
            assert loaded.timestamp == original.timestamp
            assert loaded.x == original.x
            assert loaded.y == original.y
            assert loaded.button == original.button
            assert loaded.key == original.key
        
        # Verify metadata is correct
        assert loaded_script.metadata.action_count == len(actions)
        if actions:
            expected_duration = max(action.timestamp for action in actions)
            assert loaded_script.metadata.duration == expected_duration
        else:
            assert loaded_script.metadata.duration == 0.0



class TestScriptFileVariables:
    """Tests for variable support in ScriptFile model."""
    
    def test_script_file_with_variables(self):
        """Test creating a ScriptFile with variables."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=10.0,
            action_count=2,
            platform='darwin'
        )
        actions = [
            Action(type='key_press', timestamp=0.0, key='{{username}}'),
            Action(type='key_release', timestamp=0.1, key='{{username}}')
        ]
        variables = {'username': 'testuser', 'password': 'secret'}
        
        script = ScriptFile(metadata=metadata, actions=actions, variables=variables)
        
        assert script.variables == variables
        assert script.variables['username'] == 'testuser'
        assert script.variables['password'] == 'secret'
    
    def test_script_file_without_variables(self):
        """Test creating a ScriptFile without variables (default empty dict)."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=10.0,
            action_count=1,
            platform='darwin'
        )
        actions = [Action(type='key_press', timestamp=0.0, key='a')]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        assert script.variables == {}
    
    def test_script_file_variables_serialization(self):
        """Test that variables are correctly serialized to JSON."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=10.0,
            action_count=1,
            platform='darwin'
        )
        actions = [Action(type='key_press', timestamp=0.0, key='{{username}}')]
        variables = {'username': 'testuser'}
        
        script = ScriptFile(metadata=metadata, actions=actions, variables=variables)
        
        # Serialize to JSON
        json_data = script.model_dump(mode='json')
        
        assert 'variables' in json_data
        assert json_data['variables'] == variables
    
    def test_script_file_variables_deserialization(self):
        """Test that variables are correctly deserialized from JSON."""
        json_str = '''
        {
            "metadata": {
                "version": "1.0",
                "created_at": "2024-01-01T12:00:00",
                "duration": 10.0,
                "action_count": 1,
                "platform": "darwin"
            },
            "actions": [
                {
                    "type": "key_press",
                    "timestamp": 0.0,
                    "key": "{{username}}"
                }
            ],
            "variables": {
                "username": "testuser",
                "password": "secret123"
            }
        }
        '''
        
        script = ScriptFile.model_validate_json(json_str)
        
        assert script.variables == {'username': 'testuser', 'password': 'secret123'}
        assert script.actions[0].key == '{{username}}'
    
    def test_script_file_empty_variables_deserialization(self):
        """Test that missing variables field defaults to empty dict."""
        json_str = '''
        {
            "metadata": {
                "version": "1.0",
                "created_at": "2024-01-01T12:00:00",
                "duration": 10.0,
                "action_count": 1,
                "platform": "darwin"
            },
            "actions": [
                {
                    "type": "key_press",
                    "timestamp": 0.0,
                    "key": "a"
                }
            ]
        }
        '''
        
        script = ScriptFile.model_validate_json(json_str)
        
        assert script.variables == {}


# Property-based test for variables
@given(
    actions=st.lists(valid_action(), min_size=0, max_size=20),
    variables=st.dictionaries(
        keys=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))),
        values=st.text(min_size=0, max_size=50),
        min_size=0,
        max_size=10
    )
)
def test_script_with_variables_roundtrip(actions, variables):
    """Property: Script files with variables should round-trip correctly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = Storage(base_dir=Path(tmpdir))
        
        # Create a script with variables
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=10.0 if actions else 0.0,
            action_count=len(actions),
            platform='darwin'
        )
        script = ScriptFile(metadata=metadata, actions=actions, variables=variables)
        
        # Save to file
        import json
        script_path = Path(tmpdir) / 'test_script.json'
        with open(script_path, 'w') as f:
            json.dump(script.model_dump(mode='json'), f, default=str)
        
        # Load back
        loaded_script = storage.load_script(script_path)
        
        # Verify variables are preserved
        assert loaded_script.variables == variables
