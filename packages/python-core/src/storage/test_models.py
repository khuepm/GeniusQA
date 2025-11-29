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
