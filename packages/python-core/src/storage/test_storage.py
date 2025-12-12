"""Property-based tests for Storage module."""

import pytest
from hypothesis import given, strategies as st, settings
from pathlib import Path
import tempfile
import shutil
import time

from .models import Action
from .storage import Storage


# Reuse action strategies from test_models
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


# Feature: desktop-recorder-mvp, Property 7: Recording termination saves file
@given(st.lists(valid_action(), min_size=1, max_size=20))
def test_recording_termination_saves_file(actions):
    """For any active recording session, when stop is triggered, a script file should be created.
    
    Validates: Requirements 1.3, 1.4, 6.1, 6.3
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = Storage(base_dir=Path(tmpdir))
        
        # Simulate recording termination by saving actions
        saved_path = storage.save_script(actions)
        
        # Verify file was created
        assert saved_path.exists()
        assert saved_path.is_file()
        
        # Verify filename follows timestamp pattern
        assert saved_path.name.startswith("script_")
        assert saved_path.name.endswith(".json")
        
        # Verify file is in the correct directory
        assert saved_path.parent == storage.base_dir


# Feature: desktop-recorder-mvp, Property 8: Storage directory auto-creation
@given(st.lists(valid_action(), min_size=0, max_size=10))
def test_storage_directory_auto_creation(actions):
    """For any system state where the recordings directory does not exist, 
    the first save operation should create the directory automatically.
    
    Validates: Requirements 6.2
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a non-existent subdirectory path
        non_existent_dir = Path(tmpdir) / "recordings" / "nested" / "path"
        assert not non_existent_dir.exists()
        
        storage = Storage(base_dir=non_existent_dir)
        
        # Save should create the directory
        saved_path = storage.save_script(actions)
        
        # Verify directory was created
        assert non_existent_dir.exists()
        assert non_existent_dir.is_dir()
        assert saved_path.exists()


# Feature: desktop-recorder-mvp, Property 9: Latest recording identification
@settings(deadline=None)  # Disable deadline due to variable file I/O times
@given(st.lists(st.lists(valid_action(), min_size=1, max_size=5), min_size=2, max_size=5))
def test_latest_recording_identification(action_lists):
    """For any set of script files in the storage directory, 
    the system should correctly identify the file with the most recent timestamp.
    
    Validates: Requirements 6.5
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = Storage(base_dir=Path(tmpdir))
        
        saved_paths = []
        for actions in action_lists:
            # Save each script with a small delay to ensure different timestamps
            path = storage.save_script(actions)
            saved_paths.append(path)
            time.sleep(0.01)  # Small delay to ensure different modification times
        
        # Get the latest script
        latest = storage.get_latest_script()
        
        # Verify it's the last one we saved
        assert latest is not None
        assert latest == saved_paths[-1]
        
        # Verify it has the most recent modification time
        for path in saved_paths[:-1]:
            assert latest.stat().st_mtime >= path.stat().st_mtime


# =============================================================================
# AI Vision Capture Storage Tests (Requirements: 5.5, 5.6, 5.8)
# =============================================================================

from .models import AIVisionCaptureAction, StaticData, DynamicConfig, CacheData, VisionROI
import uuid


@st.composite
def ai_vision_capture_action(draw):
    """Generate a valid ai_vision_capture action."""
    action_id = str(uuid.uuid4())
    
    # Generate optional ROI
    has_roi = draw(st.booleans())
    roi = None
    if has_roi:
        roi = VisionROI(
            x=draw(st.integers(min_value=0, max_value=1000)),
            y=draw(st.integers(min_value=0, max_value=1000)),
            width=draw(st.integers(min_value=1, max_value=500)),
            height=draw(st.integers(min_value=1, max_value=500))
        )
    
    # Generate optional cache data
    has_cache = draw(st.booleans())
    cache_data = CacheData()
    if has_cache:
        cache_data = CacheData(
            cached_x=draw(st.integers(min_value=0, max_value=1920)),
            cached_y=draw(st.integers(min_value=0, max_value=1080)),
            cache_dim=(1920, 1080)
        )
    
    return AIVisionCaptureAction(
        type='ai_vision_capture',
        id=action_id,
        timestamp=draw(st.floats(min_value=0, max_value=1000)),
        is_dynamic=draw(st.booleans()),
        interaction=draw(st.sampled_from(['click', 'dblclick', 'rclick', 'hover'])),
        static_data=StaticData(
            original_screenshot=f"screenshots/vision_{action_id}.png",
            saved_x=draw(st.one_of(st.none(), st.integers(min_value=0, max_value=1920))),
            saved_y=draw(st.one_of(st.none(), st.integers(min_value=0, max_value=1080))),
            screen_dim=(1920, 1080)
        ),
        dynamic_config=DynamicConfig(
            prompt=draw(st.text(min_size=0, max_size=100)),
            reference_images=[],
            roi=roi,
            search_scope=draw(st.sampled_from(['global', 'regional']))
        ),
        cache_data=cache_data
    )


def mixed_action():
    """Strategy for generating any valid action (including ai_vision_capture)."""
    return st.one_of(
        valid_action(),
        ai_vision_capture_action()
    )


class TestAIVisionCaptureStorage:
    """Tests for AI Vision Capture storage functionality."""
    
    def test_save_script_with_ai_vision_capture_creates_assets_folder(self):
        """Saving a script with ai_vision_capture actions should create assets folder.
        
        Validates: Requirements 5.5
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Create an ai_vision_capture action
            action = AIVisionCaptureAction(
                type='ai_vision_capture',
                id=str(uuid.uuid4()),
                timestamp=1.0,
                is_dynamic=False,
                interaction='click',
                static_data=StaticData(
                    original_screenshot="screenshots/test.png",
                    saved_x=100,
                    saved_y=200,
                    screen_dim=(1920, 1080)
                ),
                dynamic_config=DynamicConfig(),
                cache_data=CacheData()
            )
            
            # Save the script
            saved_path = storage.save_script([action])
            
            # Verify assets folder was created
            assets_dir = saved_path.parent / "assets"
            assert assets_dir.exists()
            assert assets_dir.is_dir()
    
    def test_load_script_with_ai_vision_capture_creates_assets_folder(self):
        """Loading a script with ai_vision_capture actions should create assets folder.
        
        Validates: Requirements 5.5
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Create an ai_vision_capture action
            action = AIVisionCaptureAction(
                type='ai_vision_capture',
                id=str(uuid.uuid4()),
                timestamp=1.0,
                is_dynamic=False,
                interaction='click',
                static_data=StaticData(
                    original_screenshot="screenshots/test.png",
                    saved_x=100,
                    saved_y=200,
                    screen_dim=(1920, 1080)
                ),
                dynamic_config=DynamicConfig(),
                cache_data=CacheData()
            )
            
            # Save the script
            saved_path = storage.save_script([action])
            
            # Remove assets folder to test load creates it
            assets_dir = saved_path.parent / "assets"
            if assets_dir.exists():
                shutil.rmtree(assets_dir)
            
            # Load the script
            loaded = storage.load_script(saved_path)
            
            # Verify assets folder was created
            assert assets_dir.exists()
            assert assets_dir.is_dir()
    
    def test_validate_ai_vision_capture_action_valid(self):
        """Valid ai_vision_capture action should pass validation.
        
        Validates: Requirements 5.6
        """
        storage = Storage()
        
        valid_action_data = {
            'type': 'ai_vision_capture',
            'id': str(uuid.uuid4()),
            'timestamp': 1.0,
            'is_dynamic': False,
            'interaction': 'click',
            'static_data': {
                'original_screenshot': 'screenshots/test.png',
                'saved_x': 100,
                'saved_y': 200,
                'screen_dim': [1920, 1080]
            },
            'dynamic_config': {
                'prompt': 'Click the button',
                'reference_images': [],
                'roi': None,
                'search_scope': 'global'
            },
            'cache_data': {
                'cached_x': None,
                'cached_y': None,
                'cache_dim': None
            }
        }
        
        is_valid, error = storage._validate_ai_vision_capture_action(valid_action_data)
        assert is_valid is True
        assert error is None
    
    def test_validate_ai_vision_capture_action_missing_required_field(self):
        """ai_vision_capture action missing required field should fail validation.
        
        Validates: Requirements 5.6
        """
        storage = Storage()
        
        # Missing static_data
        invalid_action_data = {
            'type': 'ai_vision_capture',
            'id': str(uuid.uuid4()),
            'timestamp': 1.0
        }
        
        is_valid, error = storage._validate_ai_vision_capture_action(invalid_action_data)
        assert is_valid is False
        assert 'static_data' in error.lower()
    
    def test_validate_ai_vision_capture_action_invalid_interaction(self):
        """ai_vision_capture action with invalid interaction should fail validation.
        
        Validates: Requirements 5.6
        """
        storage = Storage()
        
        invalid_action_data = {
            'type': 'ai_vision_capture',
            'id': str(uuid.uuid4()),
            'timestamp': 1.0,
            'interaction': 'invalid_type',
            'static_data': {
                'original_screenshot': 'screenshots/test.png',
                'saved_x': 100,
                'saved_y': 200,
                'screen_dim': [1920, 1080]
            }
        }
        
        is_valid, error = storage._validate_ai_vision_capture_action(invalid_action_data)
        assert is_valid is False
        assert 'interaction' in error.lower()
    
    def test_update_action_cache(self):
        """update_action_cache should persist cache_data to script file.
        
        Validates: Requirements 5.8
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            action_id = str(uuid.uuid4())
            action = AIVisionCaptureAction(
                type='ai_vision_capture',
                id=action_id,
                timestamp=1.0,
                is_dynamic=True,
                interaction='click',
                static_data=StaticData(
                    original_screenshot="screenshots/test.png",
                    saved_x=None,
                    saved_y=None,
                    screen_dim=(1920, 1080)
                ),
                dynamic_config=DynamicConfig(prompt="Click button"),
                cache_data=CacheData()  # No cache initially
            )
            
            # Save the script
            saved_path = storage.save_script([action])
            
            # Update cache
            result = storage.update_action_cache(
                saved_path, 
                action_id, 
                cached_x=500, 
                cached_y=300, 
                cache_dim=(1920, 1080)
            )
            
            assert result is True
            
            # Reload and verify cache was persisted
            loaded = storage.load_script(saved_path)
            loaded_action = loaded.actions[0]
            
            assert isinstance(loaded_action, AIVisionCaptureAction)
            assert loaded_action.cache_data.cached_x == 500
            assert loaded_action.cache_data.cached_y == 300
            assert loaded_action.cache_data.cache_dim == (1920, 1080)
    
    def test_clear_action_cache(self):
        """clear_action_cache should remove cache_data from script file.
        
        Validates: Requirements 4.11
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            action_id = str(uuid.uuid4())
            action = AIVisionCaptureAction(
                type='ai_vision_capture',
                id=action_id,
                timestamp=1.0,
                is_dynamic=True,
                interaction='click',
                static_data=StaticData(
                    original_screenshot="screenshots/test.png",
                    saved_x=None,
                    saved_y=None,
                    screen_dim=(1920, 1080)
                ),
                dynamic_config=DynamicConfig(prompt="Click button"),
                cache_data=CacheData(
                    cached_x=500,
                    cached_y=300,
                    cache_dim=(1920, 1080)
                )
            )
            
            # Save the script
            saved_path = storage.save_script([action])
            
            # Clear cache
            result = storage.clear_action_cache(saved_path, action_id)
            
            assert result is True
            
            # Reload and verify cache was cleared
            loaded = storage.load_script(saved_path)
            loaded_action = loaded.actions[0]
            
            assert isinstance(loaded_action, AIVisionCaptureAction)
            assert loaded_action.cache_data.cached_x is None
            assert loaded_action.cache_data.cached_y is None
            assert loaded_action.cache_data.cache_dim is None
    
    @given(st.lists(mixed_action(), min_size=1, max_size=10))
    @settings(deadline=None)  # Disable deadline due to variable file I/O times
    def test_mixed_actions_roundtrip(self, actions):
        """Scripts with mixed action types should round-trip correctly.
        
        Validates: Requirements 5.6
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = Storage(base_dir=Path(tmpdir))
            
            # Save the script
            saved_path = storage.save_script(actions)
            
            # Load the script
            loaded = storage.load_script(saved_path)
            
            # Verify action count matches
            assert len(loaded.actions) == len(actions)
            
            # Verify action types match
            for original, loaded_action in zip(actions, loaded.actions):
                if isinstance(original, AIVisionCaptureAction):
                    assert isinstance(loaded_action, AIVisionCaptureAction)
                    assert loaded_action.id == original.id
                    assert loaded_action.is_dynamic == original.is_dynamic
                else:
                    assert isinstance(loaded_action, Action)
                    assert loaded_action.type == original.type
    
    def test_validate_script_with_invalid_ai_vision_capture(self):
        """validate_script should reject scripts with invalid ai_vision_capture actions.
        
        Validates: Requirements 5.6
        """
        storage = Storage()
        
        invalid_script_data = {
            'metadata': {
                'version': '1.0',
                'created_at': '2024-01-01T00:00:00',
                'duration': 1.0,
                'action_count': 1,
                'platform': 'darwin'
            },
            'actions': [
                {
                    'type': 'ai_vision_capture',
                    'id': str(uuid.uuid4()),
                    'timestamp': 1.0,
                    # Missing static_data - should fail validation
                }
            ]
        }
        
        is_valid, error = storage.validate_script(invalid_script_data)
        assert is_valid is False
        assert 'ai_vision_capture' in error.lower() or 'static_data' in error.lower()
