"""Property-based tests for data models."""

import pytest
from hypothesis import given, strategies as st, settings
from datetime import datetime
from .models import (
    Action, ScriptMetadata, ScriptFile,
    VisionROI, StaticData, DynamicConfig, CacheData, AIVisionCaptureAction
)
from .storage import Storage
from pathlib import Path
import tempfile
import shutil
import json
import uuid


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
@settings(deadline=None)  # Disable deadline due to variable file I/O times
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


# =============================================================================
# AI Vision Capture Property Tests
# =============================================================================

# Strategies for generating valid AI Vision Capture components

@st.composite
def vision_roi_strategy(draw):
    """Generate a valid VisionROI."""
    return VisionROI(
        x=draw(st.integers(min_value=0, max_value=3840)),
        y=draw(st.integers(min_value=0, max_value=2160)),
        width=draw(st.integers(min_value=1, max_value=1920)),
        height=draw(st.integers(min_value=1, max_value=1080))
    )


@st.composite
def static_data_strategy(draw):
    """Generate valid StaticData."""
    return StaticData(
        original_screenshot=draw(st.text(
            min_size=1, max_size=50,
            alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_-./'))
        ),
        saved_x=draw(st.one_of(st.none(), st.integers(min_value=0, max_value=3840))),
        saved_y=draw(st.one_of(st.none(), st.integers(min_value=0, max_value=2160))),
        screen_dim=(
            draw(st.integers(min_value=640, max_value=7680)),
            draw(st.integers(min_value=480, max_value=4320))
        )
    )


@st.composite
def dynamic_config_strategy(draw):
    """Generate valid DynamicConfig."""
    has_roi = draw(st.booleans())
    return DynamicConfig(
        prompt=draw(st.text(min_size=0, max_size=200)),
        reference_images=draw(st.lists(
            st.text(min_size=1, max_size=50, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_-./'))
            , min_size=0, max_size=5
        )),
        roi=draw(vision_roi_strategy()) if has_roi else None,
        search_scope=draw(st.sampled_from(['global', 'regional']))
    )


@st.composite
def cache_data_strategy(draw):
    """Generate valid CacheData."""
    has_cache = draw(st.booleans())
    if has_cache:
        return CacheData(
            cached_x=draw(st.integers(min_value=0, max_value=3840)),
            cached_y=draw(st.integers(min_value=0, max_value=2160)),
            cache_dim=(
                draw(st.integers(min_value=640, max_value=7680)),
                draw(st.integers(min_value=480, max_value=4320))
            )
        )
    return CacheData()


@st.composite
def ai_vision_capture_action_strategy(draw):
    """Generate a valid AIVisionCaptureAction."""
    return AIVisionCaptureAction(
        id=str(uuid.uuid4()),
        timestamp=draw(st.floats(min_value=0, max_value=1000, allow_nan=False, allow_infinity=False)),
        is_dynamic=draw(st.booleans()),
        interaction=draw(st.sampled_from(['click', 'dblclick', 'rclick', 'hover'])),
        static_data=draw(static_data_strategy()),
        dynamic_config=draw(dynamic_config_strategy()),
        cache_data=draw(cache_data_strategy())
    )


# Feature: ai-vision-capture, Property 2: Round-trip Serialization Consistency
@settings(max_examples=100)
@given(action=ai_vision_capture_action_strategy())
def test_ai_vision_capture_roundtrip_serialization(action):
    """
    Property 2: Round-trip Serialization Consistency
    
    For any valid ai_vision_capture action, serializing to JSON and then 
    deserializing SHALL produce an equivalent action object with identical field values.
    
    **Feature: ai-vision-capture, Property 2: Round-trip Serialization Consistency**
    **Validates: Requirements 5.6**
    """
    # Serialize to JSON
    json_str = action.model_dump_json()
    
    # Deserialize back to object
    loaded_action = AIVisionCaptureAction.model_validate_json(json_str)
    
    # Verify all fields are equivalent
    assert loaded_action.type == action.type
    assert loaded_action.id == action.id
    assert loaded_action.timestamp == action.timestamp
    assert loaded_action.is_dynamic == action.is_dynamic
    assert loaded_action.interaction == action.interaction
    
    # Verify static_data
    assert loaded_action.static_data.original_screenshot == action.static_data.original_screenshot
    assert loaded_action.static_data.saved_x == action.static_data.saved_x
    assert loaded_action.static_data.saved_y == action.static_data.saved_y
    assert loaded_action.static_data.screen_dim == action.static_data.screen_dim
    
    # Verify dynamic_config
    assert loaded_action.dynamic_config.prompt == action.dynamic_config.prompt
    assert loaded_action.dynamic_config.reference_images == action.dynamic_config.reference_images
    assert loaded_action.dynamic_config.search_scope == action.dynamic_config.search_scope
    
    if action.dynamic_config.roi is not None:
        assert loaded_action.dynamic_config.roi is not None
        assert loaded_action.dynamic_config.roi.x == action.dynamic_config.roi.x
        assert loaded_action.dynamic_config.roi.y == action.dynamic_config.roi.y
        assert loaded_action.dynamic_config.roi.width == action.dynamic_config.roi.width
        assert loaded_action.dynamic_config.roi.height == action.dynamic_config.roi.height
    else:
        assert loaded_action.dynamic_config.roi is None
    
    # Verify cache_data
    assert loaded_action.cache_data.cached_x == action.cache_data.cached_x
    assert loaded_action.cache_data.cached_y == action.cache_data.cached_y
    assert loaded_action.cache_data.cache_dim == action.cache_data.cache_dim


# Additional test: Verify model_dump produces equivalent dict
@settings(max_examples=100)
@given(action=ai_vision_capture_action_strategy())
def test_ai_vision_capture_dict_roundtrip(action):
    """
    Test that model_dump and model_validate produce equivalent objects.
    
    **Feature: ai-vision-capture, Property 2: Round-trip Serialization Consistency**
    **Validates: Requirements 5.6**
    """
    # Convert to dict
    action_dict = action.model_dump()
    
    # Reconstruct from dict
    loaded_action = AIVisionCaptureAction.model_validate(action_dict)
    
    # Verify equivalence
    assert loaded_action.model_dump() == action.model_dump()
