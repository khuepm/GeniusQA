"""Property-based tests for data models."""

import pytest
from hypothesis import given, strategies as st, settings
from datetime import datetime
from pydantic import ValidationError
from .models import (
    Action, ScriptMetadata, ScriptFile,
    VisionROI, StaticData, DynamicConfig, CacheData, AIVisionCaptureAction,
    TestStep, TestScript, EnhancedScriptMetadata
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

# =============================================================================
# Test Case Driven Automation Property Tests
# =============================================================================

from .models import TestStep, TestScript, EnhancedScriptMetadata


# Strategies for generating valid test case driven automation components

@st.composite
def enhanced_metadata_strategy(draw):
    """Generate valid EnhancedScriptMetadata."""
    return EnhancedScriptMetadata(
        created_at=draw(st.datetimes(min_value=datetime(2020, 1, 1), max_value=datetime(2030, 12, 31))),
        duration=draw(st.floats(min_value=0, max_value=3600, allow_nan=False, allow_infinity=False)),
        action_count=draw(st.integers(min_value=0, max_value=1000)),
        platform=draw(st.sampled_from(['windows', 'darwin', 'linux'])),
        title=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd', 'Pc', 'Pd', 'Ps', 'Pe', 'Po'), 
            whitelist_characters=' ')).filter(lambda x: x.strip())),
        description=draw(st.text(min_size=0, max_size=500)),
        pre_conditions=draw(st.text(min_size=0, max_size=300)),
        tags=draw(st.lists(
            st.text(min_size=1, max_size=20, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='-_')),
            min_size=0, max_size=10
        ))
    )


@st.composite
def step_strategy(draw, order=None):
    """Generate valid TestStep."""
    return TestStep(
        id=str(uuid.uuid4()),
        order=order if order is not None else draw(st.integers(min_value=1, max_value=100)),
        description=draw(st.text(min_size=1, max_size=200, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd', 'Pc', 'Pd', 'Ps', 'Pe', 'Po'), 
            whitelist_characters=' ')).filter(lambda x: x.strip())),
        expected_result=draw(st.text(min_size=0, max_size=200)),
        action_ids=draw(st.lists(
            st.text(min_size=1, max_size=36, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='-')),
            min_size=0, max_size=20
        )),
        continue_on_failure=draw(st.booleans())
    )


@st.composite
def script_strategy(draw):
    """Generate valid TestScript with proper step ordering."""
    # Generate metadata
    metadata = draw(enhanced_metadata_strategy())
    
    # Generate steps with sequential ordering
    num_steps = draw(st.integers(min_value=0, max_value=10))
    steps = []
    for i in range(num_steps):
        step = draw(step_strategy(order=i+1))
        steps.append(step)
    
    # Generate action pool
    all_action_ids = []
    for step in steps:
        all_action_ids.extend(step.action_ids)
    
    # Create actions for all referenced IDs
    action_pool = {}
    for action_id in set(all_action_ids):
        action = draw(valid_action())
        action_pool[action_id] = action
    
    # Add some extra actions not referenced by steps
    extra_actions = draw(st.integers(min_value=0, max_value=5))
    for _ in range(extra_actions):
        extra_id = str(uuid.uuid4())
        extra_action = draw(valid_action())
        action_pool[extra_id] = extra_action
    
    # Generate variables
    variables = draw(st.dictionaries(
        keys=st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_')),
        values=st.text(min_size=0, max_size=50),
        min_size=0, max_size=5
    ))
    
    return TestScript(
        meta=metadata,
        steps=steps,
        action_pool=action_pool,
        variables=variables
    )


# Feature: test-case-driven-automation, Property 1: Test Script Structure Validation
@settings(max_examples=100)
@given(script=script_strategy())
def test_script_structure_validation(script):
    """
    Property 1: Test Script Structure Validation
    
    For any test script creation or modification, the script SHALL contain all required 
    metadata fields (title, description, pre-conditions, tags), all test steps SHALL 
    have unique identifiers and required descriptions, and the system SHALL support 
    unlimited test steps.
    
    **Feature: test-case-driven-automation, Property 1: Test Script Structure Validation**
    **Validates: Requirements 1.1, 1.2, 1.5**
    """
    # Verify metadata contains all required fields
    assert script.meta.title is not None
    assert len(script.meta.title.strip()) > 0
    assert script.meta.description is not None  # Can be empty string
    assert script.meta.pre_conditions is not None  # Can be empty string
    assert script.meta.tags is not None  # Can be empty list
    assert script.meta.created_at is not None
    assert script.meta.duration >= 0
    assert script.meta.action_count >= 0
    assert script.meta.platform is not None
    
    # Verify all test steps have unique identifiers
    step_ids = [step.id for step in script.steps]
    assert len(step_ids) == len(set(step_ids)), "All step IDs must be unique"
    
    # Verify all test steps have required descriptions
    for step in script.steps:
        assert step.description is not None
        assert len(step.description.strip()) > 0, "Step descriptions cannot be empty"
        assert step.order >= 1, "Step order must be positive"
    
    # Verify sequential ordering if steps exist
    if script.steps:
        orders = [step.order for step in script.steps]
        expected_orders = list(range(1, len(script.steps) + 1))
        assert sorted(orders) == expected_orders, "Step orders must be sequential starting from 1"
    
    # Verify action pool structure
    assert isinstance(script.action_pool, dict)
    for action_id, action in script.action_pool.items():
        assert isinstance(action_id, str)
        assert len(action_id.strip()) > 0
        # Action should be valid (this is tested by existing action validation)
    
    # Verify variables structure
    assert isinstance(script.variables, dict)
    for var_name, var_value in script.variables.items():
        assert isinstance(var_name, str)
        assert isinstance(var_value, str)


# Test edge cases for validation
def test_empty_test_script():
    """Test that empty TestScript is valid."""
    metadata = EnhancedScriptMetadata(
        created_at=datetime.now(),
        duration=0.0,
        action_count=0,
        platform='darwin',
        title='Empty Test'
    )
    
    script = TestScript(
        meta=metadata,
        steps=[],
        action_pool={},
        variables={}
    )
    
    # Should be valid
    assert len(script.steps) == 0
    assert len(script.action_pool) == 0
    assert len(script.variables) == 0


def test_invalid_step_descriptions():
    """Test that empty step descriptions are rejected."""
    with pytest.raises(ValidationError, match="String should have at least 1 character"):
        TestStep(
            id=str(uuid.uuid4()),
            order=1,
            description="",  # Empty description should fail
            expected_result="Should work",
            action_ids=[]
        )
    
    with pytest.raises(ValueError, match="Step description cannot be empty or whitespace-only"):
        TestStep(
            id=str(uuid.uuid4()),
            order=1,
            description="   ",  # Whitespace-only description should fail
            expected_result="Should work",
            action_ids=[]
        )


def test_invalid_script_titles():
    """Test that empty script titles are rejected."""
    with pytest.raises(ValidationError, match="String should have at least 1 character"):
        EnhancedScriptMetadata(
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform='darwin',
            title=""  # Empty title should fail
        )
    
    with pytest.raises(ValueError, match="Script title cannot be empty or whitespace-only"):
        EnhancedScriptMetadata(
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform='darwin',
            title="   "  # Whitespace-only title should fail
        )


def test_duplicate_step_ids():
    """Test that duplicate step IDs are rejected."""
    metadata = EnhancedScriptMetadata(
        created_at=datetime.now(),
        duration=0.0,
        action_count=0,
        platform='darwin',
        title='Test Script'
    )
    
    duplicate_id = str(uuid.uuid4())
    steps = [
        TestStep(id=duplicate_id, order=1, description="Step 1"),
        TestStep(id=duplicate_id, order=2, description="Step 2")  # Duplicate ID
    ]
    
    with pytest.raises(ValueError, match="All step IDs must be unique"):
        TestScript(
            meta=metadata,
            steps=steps,
            action_pool={},
            variables={}
        )


def test_non_sequential_step_orders():
    """Test that non-sequential step orders are rejected."""
    metadata = EnhancedScriptMetadata(
        created_at=datetime.now(),
        duration=0.0,
        action_count=0,
        platform='darwin',
        title='Test Script'
    )
    
    steps = [
        TestStep(id=str(uuid.uuid4()), order=1, description="Step 1"),
        TestStep(id=str(uuid.uuid4()), order=3, description="Step 3")  # Missing order 2
    ]
    
    with pytest.raises(ValueError, match="Step orders must be sequential"):
        TestScript(
            meta=metadata,
            steps=steps,
            action_pool={},
            variables={}
        )
# =============================================================================
# Migration Property Tests
# =============================================================================

from .models import migrate_legacy_script, is_legacy_format, load_script_with_migration


@st.composite
def legacy_script_strategy(draw):
    """Generate valid legacy ScriptFile."""
    actions = draw(st.lists(valid_action(), min_size=0, max_size=20))
    
    metadata = ScriptMetadata(
        created_at=draw(st.datetimes(min_value=datetime(2020, 1, 1), max_value=datetime(2030, 12, 31))),
        duration=draw(st.floats(min_value=0, max_value=3600, allow_nan=False, allow_infinity=False)),
        action_count=len(actions),
        platform=draw(st.sampled_from(['windows', 'darwin', 'linux']))
    )
    
    variables = draw(st.dictionaries(
        keys=st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_')),
        values=st.text(min_size=0, max_size=50),
        min_size=0, max_size=5
    ))
    
    return ScriptFile(
        metadata=metadata,
        actions=actions,
        variables=variables
    )


# Feature: test-case-driven-automation, Property 16: Legacy Migration Correctness
@settings(max_examples=100)
@given(legacy_script=legacy_script_strategy())
def test_legacy_migration_correctness(legacy_script):
    """
    Property 16: Legacy Migration Correctness
    
    For any legacy flat script format, the migration SHALL automatically convert it to 
    step-based format with all actions placed in a default step, preserve all original 
    action data and metadata, and maintain the original script if migration fails.
    
    **Feature: test-case-driven-automation, Property 16: Legacy Migration Correctness**
    **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    """
    # Migrate the legacy script
    migrated_script, success = migrate_legacy_script(legacy_script)
    
    # Migration should succeed for valid legacy scripts
    assert success is True, "Migration should succeed for valid legacy scripts"
    
    # Verify all actions are placed in a default step
    assert len(migrated_script.steps) == 1, "Should create exactly one default step"
    default_step = migrated_script.steps[0]
    assert default_step.order == 1, "Default step should have order 1"
    assert default_step.description == "Legacy Import - Migrated Actions", "Default step should have correct description"
    assert default_step.expected_result == "All actions execute successfully", "Default step should have correct expected result"
    
    # Verify all original actions are preserved in action pool
    assert len(migrated_script.action_pool) == len(legacy_script.actions), "All actions should be preserved in action pool"
    assert len(default_step.action_ids) == len(legacy_script.actions), "All actions should be referenced by default step"
    
    # Verify action data is preserved
    migrated_actions = [migrated_script.action_pool[aid] for aid in default_step.action_ids]
    for original, migrated in zip(legacy_script.actions, migrated_actions):
        assert migrated.type == original.type, "Action type should be preserved"
        assert migrated.timestamp == original.timestamp, "Action timestamp should be preserved"
        assert migrated.x == original.x, "Action x coordinate should be preserved"
        assert migrated.y == original.y, "Action y coordinate should be preserved"
        assert migrated.button == original.button, "Action button should be preserved"
        assert migrated.key == original.key, "Action key should be preserved"
        assert migrated.screenshot == original.screenshot, "Action screenshot should be preserved"
    
    # Verify metadata is preserved and enhanced
    assert migrated_script.meta.created_at == legacy_script.metadata.created_at, "Creation time should be preserved"
    assert migrated_script.meta.duration == legacy_script.metadata.duration, "Duration should be preserved"
    assert migrated_script.meta.action_count == legacy_script.metadata.action_count, "Action count should be preserved"
    assert migrated_script.meta.platform == legacy_script.metadata.platform, "Platform should be preserved"
    assert migrated_script.meta.version == "2.0", "Version should be updated to 2.0"
    assert len(migrated_script.meta.title.strip()) > 0, "Title should be non-empty"
    
    # Verify variables are preserved
    assert migrated_script.variables == legacy_script.variables, "Variables should be preserved"
    
    # Verify enhanced metadata has required fields
    assert migrated_script.meta.title is not None, "Title should be set"
    assert migrated_script.meta.description is not None, "Description should be set"
    assert migrated_script.meta.pre_conditions is not None, "Pre-conditions should be set"
    assert migrated_script.meta.tags is not None, "Tags should be set"


# Test format detection property
@settings(max_examples=50)
@given(legacy_script=legacy_script_strategy())
def test_format_detection_property(legacy_script):
    """Test that legacy format detection works correctly."""
    # Convert to dict (simulating JSON loading)
    legacy_data = legacy_script.model_dump(mode='json')
    
    # Should be detected as legacy format
    assert is_legacy_format(legacy_data) is True, "Legacy script should be detected as legacy format"
    
    # Migrate and convert to new format dict
    migrated_script, success = migrate_legacy_script(legacy_script)
    assert success is True
    
    new_data = migrated_script.model_dump(mode='json')
    
    # Should be detected as new format
    assert is_legacy_format(new_data) is False, "Migrated script should be detected as new format"


# Test load_script_with_migration property
@settings(max_examples=50)
@given(legacy_script=legacy_script_strategy())
def test_load_with_migration_property(legacy_script):
    """Test that load_script_with_migration handles both formats correctly."""
    # Test with legacy format
    legacy_data = legacy_script.model_dump(mode='json')
    
    loaded_script, was_migrated, success = load_script_with_migration(legacy_data)
    
    assert success is True, "Loading should succeed"
    assert was_migrated is True, "Should indicate migration was performed"
    assert loaded_script.meta.version == "2.0", "Should be migrated to version 2.0"
    assert len(loaded_script.steps) == 1, "Should have default step"
    assert len(loaded_script.action_pool) == len(legacy_script.actions), "All actions should be preserved"
    
    # Test with new format (migrate first, then test loading)
    migrated_script, _ = migrate_legacy_script(legacy_script)
    new_data = migrated_script.model_dump(mode='json')
    
    loaded_script2, was_migrated2, success2 = load_script_with_migration(new_data)
    
    assert success2 is True, "Loading new format should succeed"
    assert was_migrated2 is False, "Should indicate no migration was needed"
    assert loaded_script2.meta.version == "2.0", "Should remain version 2.0"
# =============================================================================
# Data Persistence Architecture Property Tests
# =============================================================================

import json


# Feature: test-case-driven-automation, Property 18: Data Persistence Architecture
@settings(max_examples=100)
@given(script=script_strategy())
def test_data_persistence_architecture(script):
    """
    Property 18: Data Persistence Architecture
    
    For any test script file, the format SHALL contain only static data (metadata, steps, 
    action references), runtime status SHALL never be persisted, and action_ids SHALL 
    reference the Action_Pool rather than embedding action data.
    
    **Feature: test-case-driven-automation, Property 18: Data Persistence Architecture**
    **Validates: Requirements 8.1, 8.2, 8.5**
    """
    # Serialize script to JSON (simulating file persistence)
    json_data = script.model_dump(mode='json')
    json_str = json.dumps(json_data, default=str)
    
    # Verify the JSON structure contains only static data
    parsed_data = json.loads(json_str)
    
    # Verify top-level structure contains only expected static fields
    expected_top_level_fields = {'meta', 'steps', 'action_pool', 'variables'}
    actual_top_level_fields = set(parsed_data.keys())
    assert actual_top_level_fields == expected_top_level_fields, f"Top-level fields should be {expected_top_level_fields}, got {actual_top_level_fields}"
    
    # Verify metadata contains only static data (no runtime status)
    meta_fields = set(parsed_data['meta'].keys())
    runtime_fields = {'status', 'error_message', 'screenshot_proof', 'execution_time', 'started_at', 'completed_at'}
    assert not any(field in meta_fields for field in runtime_fields), "Metadata should not contain runtime status fields"
    
    # Verify steps contain only static data (no runtime status)
    for step_data in parsed_data['steps']:
        step_fields = set(step_data.keys())
        expected_step_fields = {'id', 'order', 'description', 'expected_result', 'action_ids', 'continue_on_failure'}
        assert step_fields == expected_step_fields, f"Step fields should be {expected_step_fields}, got {step_fields}"
        
        # Verify no runtime status fields in steps
        assert not any(field in step_fields for field in runtime_fields), "Steps should not contain runtime status fields"
        
        # Verify action_ids are references (strings), not embedded action objects
        assert isinstance(step_data['action_ids'], list), "action_ids should be a list"
        for action_id in step_data['action_ids']:
            assert isinstance(action_id, str), "Each action_id should be a string reference"
            assert len(action_id.strip()) > 0, "Action IDs should be non-empty strings"
    
    # Verify action_pool contains actions keyed by ID
    assert isinstance(parsed_data['action_pool'], dict), "action_pool should be a dictionary"
    for action_id, action_data in parsed_data['action_pool'].items():
        assert isinstance(action_id, str), "Action pool keys should be strings"
        assert len(action_id.strip()) > 0, "Action IDs should be non-empty"
        assert isinstance(action_data, dict), "Action pool values should be action objects"
        
        # Verify action contains expected fields but no runtime status
        action_fields = set(action_data.keys())
        assert not any(field in action_fields for field in runtime_fields), "Actions should not contain runtime status fields"
    
    # Verify variables are simple key-value pairs (no complex objects)
    assert isinstance(parsed_data['variables'], dict), "variables should be a dictionary"
    for var_name, var_value in parsed_data['variables'].items():
        assert isinstance(var_name, str), "Variable names should be strings"
        assert isinstance(var_value, str), "Variable values should be strings"
    
    # Verify round-trip consistency (no data loss during serialization)
    loaded_script = TestScript.model_validate(parsed_data)
    
    # Verify all original data is preserved
    assert loaded_script.meta.title == script.meta.title
    assert loaded_script.meta.description == script.meta.description
    assert loaded_script.meta.created_at == script.meta.created_at
    assert len(loaded_script.steps) == len(script.steps)
    assert len(loaded_script.action_pool) == len(script.action_pool)
    assert loaded_script.variables == script.variables
    
    # Verify step references are preserved
    for original_step, loaded_step in zip(script.steps, loaded_script.steps):
        assert loaded_step.id == original_step.id
        assert loaded_step.order == original_step.order
        assert loaded_step.description == original_step.description
        assert loaded_step.action_ids == original_step.action_ids


# Test that runtime status is never included in serialization
def test_runtime_status_exclusion():
    """Test that runtime status fields are never included in serialized data."""
    # Create a test script
    metadata = EnhancedScriptMetadata(
        created_at=datetime.now(),
        duration=10.0,
        action_count=1,
        platform='darwin',
        title='Test Script'
    )
    
    step = TestStep(
        id=str(uuid.uuid4()),
        order=1,
        description="Test step",
        expected_result="Should work",
        action_ids=["action-001"]
    )
    
    action = Action(type='mouse_click', timestamp=0.0, x=100, y=100, button='left')
    
    script = TestScript(
        meta=metadata,
        steps=[step],
        action_pool={"action-001": action},
        variables={}
    )
    
    # Serialize to JSON
    json_data = script.model_dump(mode='json')
    
    # Verify no runtime fields are present anywhere
    json_str = json.dumps(json_data, default=str)
    runtime_keywords = ['status', 'error_message', 'screenshot_proof', 'execution_time', 'started_at', 'completed_at']
    
    for keyword in runtime_keywords:
        assert keyword not in json_str, f"Runtime field '{keyword}' should not appear in serialized data"


# Test action pool reference integrity
@settings(max_examples=50)
@given(script=script_strategy())
def test_action_pool_reference_integrity(script):
    """Test that all action references in steps point to valid actions in the pool."""
    # Collect all action IDs referenced by steps
    referenced_action_ids = set()
    for step in script.steps:
        referenced_action_ids.update(step.action_ids)
    
    # Verify all referenced actions exist in the action pool
    action_pool_ids = set(script.action_pool.keys())
    
    for action_id in referenced_action_ids:
        assert action_id in action_pool_ids, f"Action ID '{action_id}' referenced by step but not found in action pool"
    
    # Verify action pool contains valid actions
    for action_id, action in script.action_pool.items():
        assert isinstance(action_id, str), "Action pool keys should be strings"
        assert len(action_id.strip()) > 0, "Action IDs should be non-empty"
        # Action validation is handled by the Action model itself


# Test separation of concerns between static and runtime data
def test_static_runtime_separation():
    """Test that static script data is completely separate from runtime execution data."""
    # Create a script with static data only
    metadata = EnhancedScriptMetadata(
        created_at=datetime.now(),
        duration=10.0,
        action_count=2,
        platform='darwin',
        title='Separation Test'
    )
    
    steps = [
        TestStep(
            id=str(uuid.uuid4()),
            order=1,
            description="First step",
            action_ids=["action-001"]
        ),
        TestStep(
            id=str(uuid.uuid4()),
            order=2,
            description="Second step", 
            action_ids=["action-002"]
        )
    ]
    
    actions = {
        "action-001": Action(type='mouse_click', timestamp=0.0, x=100, y=100, button='left'),
        "action-002": Action(type='key_press', timestamp=1.0, key='a')
    }
    
    script = TestScript(
        meta=metadata,
        steps=steps,
        action_pool=actions,
        variables={}
    )
    
    # Serialize and deserialize
    json_data = script.model_dump(mode='json')
    loaded_script = TestScript.model_validate(json_data)
    
    # Verify the loaded script is identical to original (no runtime data contamination)
    assert loaded_script.meta.title == script.meta.title
    assert len(loaded_script.steps) == len(script.steps)
    assert len(loaded_script.action_pool) == len(script.action_pool)
    
    # Verify steps contain only static data
    for original_step, loaded_step in zip(script.steps, loaded_script.steps):
        assert loaded_step.id == original_step.id
        assert loaded_step.order == original_step.order
        assert loaded_step.description == original_step.description
        assert loaded_step.expected_result == original_step.expected_result
        assert loaded_step.action_ids == original_step.action_ids
        assert loaded_step.continue_on_failure == original_step.continue_on_failure
        
        # Verify no additional fields were added during round-trip
        loaded_dict = loaded_step.model_dump()
        original_dict = original_step.model_dump()
        assert set(loaded_dict.keys()) == set(original_dict.keys()), "No additional fields should be added during serialization"
