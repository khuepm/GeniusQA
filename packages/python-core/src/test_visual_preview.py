"""
Test visual playback preview functionality.

This test verifies that the action preview callback is invoked correctly
during playback, allowing the UI to display visual feedback.
"""

import pytest
from storage.models import Action
from player.player import Player


def test_action_preview_callback_is_invoked():
    """Test that action_callback is invoked before each action execution."""
    # Create test actions
    actions = [
        Action(type='mouse_move', timestamp=0.0, x=100, y=200),
        Action(type='mouse_click', timestamp=0.1, x=100, y=200, button='left'),
        Action(type='key_press', timestamp=0.2, key='a'),
    ]
    
    # Track callback invocations
    callback_invocations = []
    
    def action_callback(action, index):
        callback_invocations.append({
            'index': index,
            'type': action.type,
            'timestamp': action.timestamp
        })
    
    # Create player with action callback
    player = Player(actions, action_callback=action_callback)
    
    # Mock _execute_action to avoid actual automation
    player._execute_action = lambda action: None
    
    # Start and wait for playback
    player.start_playback()
    player._playback_thread.join(timeout=2.0)
    
    # Verify callback was invoked for each action
    assert len(callback_invocations) == 3
    
    # Verify callback received correct data
    assert callback_invocations[0]['index'] == 0
    assert callback_invocations[0]['type'] == 'mouse_move'
    assert callback_invocations[0]['timestamp'] == 0.0
    
    assert callback_invocations[1]['index'] == 1
    assert callback_invocations[1]['type'] == 'mouse_click'
    assert callback_invocations[1]['timestamp'] == 0.1
    
    assert callback_invocations[2]['index'] == 2
    assert callback_invocations[2]['type'] == 'key_press'
    assert callback_invocations[2]['timestamp'] == 0.2


def test_action_preview_callback_errors_dont_stop_playback():
    """Test that errors in action_callback don't stop playback."""
    actions = [
        Action(type='mouse_move', timestamp=0.0, x=100, y=200),
        Action(type='mouse_click', timestamp=0.1, x=100, y=200, button='left'),
    ]
    
    # Track execution
    executed_actions = []
    
    def failing_callback(action, index):
        raise RuntimeError("Callback error")
    
    def track_execution(action):
        executed_actions.append(action.type)
    
    # Create player with failing callback
    player = Player(actions, action_callback=failing_callback)
    player._execute_action = track_execution
    
    # Start and wait for playback
    player.start_playback()
    player._playback_thread.join(timeout=2.0)
    
    # Verify all actions were still executed despite callback errors
    assert len(executed_actions) == 2
    assert executed_actions[0] == 'mouse_move'
    assert executed_actions[1] == 'mouse_click'


def test_action_preview_with_progress_callback():
    """Test that both action_callback and progress_callback work together."""
    actions = [
        Action(type='mouse_move', timestamp=0.0, x=100, y=200),
        Action(type='key_press', timestamp=0.1, key='a'),
    ]
    
    action_callbacks = []
    progress_callbacks = []
    
    def action_callback(action, index):
        action_callbacks.append(index)
    
    def progress_callback(current, total):
        progress_callbacks.append((current, total))
    
    # Create player with both callbacks
    player = Player(
        actions, 
        action_callback=action_callback,
        progress_callback=progress_callback
    )
    player._execute_action = lambda action: None
    
    # Start and wait for playback
    player.start_playback()
    player._playback_thread.join(timeout=2.0)
    
    # Verify both callbacks were invoked
    assert len(action_callbacks) == 2
    assert len(progress_callbacks) == 2
    
    # Verify order: action_callback before progress_callback
    assert action_callbacks[0] == 0
    assert progress_callbacks[0] == (1, 2)
    assert action_callbacks[1] == 1
    assert progress_callbacks[1] == (2, 2)


def test_action_preview_callback_optional():
    """Test that action_callback is optional and playback works without it."""
    actions = [
        Action(type='mouse_move', timestamp=0.0, x=100, y=200),
    ]
    
    executed = []
    
    # Create player without action_callback
    player = Player(actions)
    player._execute_action = lambda action: executed.append(action.type)
    
    # Start and wait for playback
    player.start_playback()
    player._playback_thread.join(timeout=2.0)
    
    # Verify playback still works
    assert len(executed) == 1
    assert executed[0] == 'mouse_move'
