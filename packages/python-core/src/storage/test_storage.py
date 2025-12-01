"""Property-based tests for Storage module."""

import pytest
from hypothesis import given, strategies as st
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
