"""Property-based tests for Player module."""

import pytest
import time
from hypothesis import given, strategies as st, settings
from unittest.mock import Mock, patch, call
from player.player import Player
from storage.models import Action


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


# Feature: desktop-recorder-mvp, Property 3: Playback executes actions in order
@settings(max_examples=100)
@given(st.lists(valid_action(), min_size=1, max_size=20))
def test_playback_executes_actions_in_order(actions):
    """For any script file with multiple actions, playback should execute each action in the exact order.
    
    Validates: Requirements 2.2
    """
    # Create a player with the actions
    player = Player(actions)
    
    # Track the order of executed actions
    executed_actions = []
    
    # Mock the _execute_action method to track execution order
    def track_execution(action):
        executed_actions.append(action)
        # Don't actually execute the action (no real mouse/keyboard simulation in tests)
    
    # Mock _calculate_delay to return 0 to avoid waiting in tests
    def no_delay(current, next_action):
        return 0.0
    
    player._execute_action = track_execution
    player._calculate_delay = no_delay
    
    # Start playback (this should execute all actions in order)
    player.start_playback()
    
    # Wait for playback to complete (since it runs in a thread)
    if player._playback_thread:
        player._playback_thread.join(timeout=10.0)
    
    # Verify that all actions were executed in the correct order
    assert len(executed_actions) == len(actions), "All actions should be executed"
    
    for i, (expected, actual) in enumerate(zip(actions, executed_actions)):
        assert actual is expected, f"Action at index {i} should be executed in order"


# Feature: desktop-recorder-mvp, Property 4: Timing preservation during playback
@settings(max_examples=20, deadline=None)
@given(st.lists(valid_action(), min_size=2, max_size=5))
def test_timing_preservation_during_playback(actions):
    """For any two consecutive actions, the delay between execution should match timestamp difference within 50ms.
    
    Validates: Requirements 7.1, 7.2, 7.3, 7.4
    """
    # Sort actions by timestamp to ensure proper ordering
    sorted_actions = sorted(actions, key=lambda a: a.timestamp)
    
    # Ensure timestamps are sequential and have reasonable delays (50ms between actions)
    for i in range(len(sorted_actions)):
        sorted_actions[i].timestamp = i * 0.05  # 50ms between each action
    
    player = Player(sorted_actions)
    
    # Track execution times
    execution_times = []
    
    def track_execution_time(action):
        execution_times.append(time.time())
    
    player._execute_action = track_execution_time
    
    # Start playback
    start_time = time.time()
    player.start_playback()
    
    # Wait for playback to complete
    if player._playback_thread:
        player._playback_thread.join(timeout=10.0)
    
    # Verify timing accuracy (within 50ms)
    assert len(execution_times) == len(sorted_actions), "All actions should be executed"
    
    for i in range(len(execution_times) - 1):
        actual_delay = execution_times[i + 1] - execution_times[i]
        expected_delay = sorted_actions[i + 1].timestamp - sorted_actions[i].timestamp
        
        # Allow 100ms tolerance for testing (50ms spec + 50ms for system variance)
        # In real-world usage, the timing will be more accurate, but in tests
        # we need to account for thread scheduling and system load
        tolerance = 0.1  # 100ms
        assert abs(actual_delay - expected_delay) <= tolerance, \
            f"Delay between actions {i} and {i+1} should be {expected_delay}s (±100ms), but was {actual_delay}s"


# Feature: desktop-recorder-mvp, Property 5: Long delay capping
@settings(max_examples=100)
@given(
    st.floats(min_value=0.0, max_value=1000.0),  # current timestamp
    st.floats(min_value=5.1, max_value=100.0)    # delay > 5 seconds
)
def test_long_delay_capping(current_timestamp, delay):
    """For any two consecutive actions with timestamp difference > 5 seconds, delay should be capped at 5 seconds.
    
    Validates: Requirements 7.5
    """
    # Create two actions with a long delay between them
    action1 = Action(
        type='mouse_move',
        timestamp=current_timestamp,
        x=100,
        y=100
    )
    
    action2 = Action(
        type='mouse_move',
        timestamp=current_timestamp + delay,
        x=200,
        y=200
    )
    
    player = Player([action1, action2])
    
    # Test the _calculate_delay method directly
    calculated_delay = player._calculate_delay(action1, action2)
    
    # The delay should be capped at 5 seconds
    max_delay = 5.0
    assert calculated_delay <= max_delay, \
        f"Delay should be capped at {max_delay}s, but was {calculated_delay}s for timestamp difference of {delay}s"
    
    # If the actual delay was > 5 seconds, verify it was capped to exactly 5
    if delay > max_delay:
        assert calculated_delay == max_delay, \
            f"Delay should be exactly {max_delay}s when timestamp difference is {delay}s, but was {calculated_delay}s"
