"""
Property-based tests for AI Vision Capture playback in Player module.

Tests the following properties:
- Property 4: Static Mode Zero AI Calls
- Property 5: Dynamic Cache Zero AI Calls
- Property 14: Playback Priority Order

Requirements: 4.1, 4.3, 4.5
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from typing import Dict, Any, Optional, Tuple, List
import uuid

from player.player import Player


# =============================================================================
# Strategies for generating AI Vision Capture actions
# =============================================================================

@st.composite
def screen_dimensions(draw) -> Tuple[int, int]:
    """Generate valid screen dimensions."""
    width = draw(st.integers(min_value=800, max_value=3840))
    height = draw(st.integers(min_value=600, max_value=2160))
    return (width, height)


@st.composite
def valid_coordinates(draw, max_x: int = 1920, max_y: int = 1080) -> Tuple[int, int]:
    """Generate valid screen coordinates."""
    x = draw(st.integers(min_value=0, max_value=max_x - 1))
    y = draw(st.integers(min_value=0, max_value=max_y - 1))
    return (x, y)


@st.composite
def interaction_type(draw) -> str:
    """Generate a valid interaction type."""
    return draw(st.sampled_from(['click', 'dblclick', 'rclick', 'hover']))


@st.composite
def static_mode_action(draw) -> Dict[str, Any]:
    """
    Generate a valid AI Vision Capture action in Static Mode.
    
    Static Mode: is_dynamic = False, has saved_x/saved_y
    """
    screen_dim = draw(screen_dimensions())
    coords = draw(valid_coordinates(max_x=screen_dim[0], max_y=screen_dim[1]))
    
    return {
        'type': 'ai_vision_capture',
        'id': str(uuid.uuid4()),
        'timestamp': draw(st.floats(min_value=0, max_value=1000)),
        'is_dynamic': False,
        'interaction': draw(interaction_type()),
        'static_data': {
            'original_screenshot': f'screenshots/vision_{uuid.uuid4()}.png',
            'saved_x': coords[0],
            'saved_y': coords[1],
            'screen_dim': list(screen_dim)
        },
        'dynamic_config': {
            'prompt': draw(st.text(min_size=1, max_size=100)),
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


@st.composite
def cached_mode_action(draw) -> Dict[str, Any]:
    """
    Generate a valid AI Vision Capture action in Dynamic Mode with cache.
    
    Dynamic Mode with Cache: is_dynamic = True, has cached_x/cached_y
    """
    screen_dim = draw(screen_dimensions())
    cached_coords = draw(valid_coordinates(max_x=screen_dim[0], max_y=screen_dim[1]))
    
    return {
        'type': 'ai_vision_capture',
        'id': str(uuid.uuid4()),
        'timestamp': draw(st.floats(min_value=0, max_value=1000)),
        'is_dynamic': True,
        'interaction': draw(interaction_type()),
        'static_data': {
            'original_screenshot': f'screenshots/vision_{uuid.uuid4()}.png',
            'saved_x': None,
            'saved_y': None,
            'screen_dim': list(screen_dim)
        },
        'dynamic_config': {
            'prompt': draw(st.text(min_size=1, max_size=100)),
            'reference_images': [],
            'roi': None,
            'search_scope': 'global'
        },
        'cache_data': {
            'cached_x': cached_coords[0],
            'cached_y': cached_coords[1],
            'cache_dim': list(screen_dim)
        }
    }


@st.composite
def dynamic_mode_action_no_cache(draw) -> Dict[str, Any]:
    """
    Generate a valid AI Vision Capture action in Dynamic Mode without cache.
    
    Dynamic Mode without Cache: is_dynamic = True, no cached_x/cached_y
    """
    screen_dim = draw(screen_dimensions())
    
    return {
        'type': 'ai_vision_capture',
        'id': str(uuid.uuid4()),
        'timestamp': draw(st.floats(min_value=0, max_value=1000)),
        'is_dynamic': True,
        'interaction': draw(interaction_type()),
        'static_data': {
            'original_screenshot': f'screenshots/vision_{uuid.uuid4()}.png',
            'saved_x': None,
            'saved_y': None,
            'screen_dim': list(screen_dim)
        },
        'dynamic_config': {
            'prompt': draw(st.text(min_size=1, max_size=100)),
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


# =============================================================================
# Property 4: Static Mode Zero AI Calls
# Feature: ai-vision-capture, Property 4: Static Mode Zero AI Calls
# Validates: Requirements 4.3
# =============================================================================

@settings(max_examples=100)
@given(static_mode_action())
def test_static_mode_zero_ai_calls(action: Dict[str, Any]):
    """
    **Feature: ai-vision-capture, Property 4: Static Mode Zero AI Calls**
    **Validates: Requirements 4.3**
    
    For any ai_vision_capture action with is_dynamic = false and valid saved_x/saved_y,
    playback SHALL execute the interaction at the saved coordinates without making
    any AI API calls.
    """
    # Ensure action has valid saved coordinates
    assume(action['static_data']['saved_x'] is not None)
    assume(action['static_data']['saved_y'] is not None)
    assume(action['is_dynamic'] == False)
    
    # Create player with the action
    player = Player([action])
    
    # Track AI calls
    ai_call_count = 0
    
    # Mock the AI service to track calls
    mock_ai_service = Mock()
    mock_ai_service.is_initialized.return_value = True
    
    async def mock_analyze(*args, **kwargs):
        nonlocal ai_call_count
        ai_call_count += 1
        return Mock(success=True, x=100, y=100)
    
    mock_ai_service.analyze = mock_analyze
    player._ai_service = mock_ai_service
    
    # Mock PyAutoGUI to avoid actual mouse/keyboard actions
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        # Mock screen size
        mock_pyautogui.size.return_value = Mock(
            width=action['static_data']['screen_dim'][0],
            height=action['static_data']['screen_dim'][1]
        )
        
        # Execute the action
        player._execute_action(action)
    
    # Verify NO AI calls were made
    assert ai_call_count == 0, \
        f"Static Mode should make 0 AI calls, but made {ai_call_count}"


# =============================================================================
# Property 5: Dynamic Cache Zero AI Calls
# Feature: ai-vision-capture, Property 5: Dynamic Cache Zero AI Calls
# Validates: Requirements 4.5
# =============================================================================

@settings(max_examples=100)
@given(cached_mode_action())
def test_dynamic_cache_zero_ai_calls(action: Dict[str, Any]):
    """
    **Feature: ai-vision-capture, Property 5: Dynamic Cache Zero AI Calls**
    **Validates: Requirements 4.5**
    
    For any ai_vision_capture action with is_dynamic = true AND valid cached_x/cached_y,
    playback SHALL execute the interaction at the cached coordinates (with scaling if
    needed) without making any AI API calls.
    """
    # Ensure action has valid cache
    assume(action['cache_data']['cached_x'] is not None)
    assume(action['cache_data']['cached_y'] is not None)
    assume(action['is_dynamic'] == True)
    
    # Create player with the action
    player = Player([action])
    
    # Track AI calls
    ai_call_count = 0
    
    # Mock the AI service to track calls
    mock_ai_service = Mock()
    mock_ai_service.is_initialized.return_value = True
    
    async def mock_analyze(*args, **kwargs):
        nonlocal ai_call_count
        ai_call_count += 1
        return Mock(success=True, x=100, y=100)
    
    mock_ai_service.analyze = mock_analyze
    player._ai_service = mock_ai_service
    
    # Mock PyAutoGUI to avoid actual mouse/keyboard actions
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        # Mock screen size to match cache_dim
        cache_dim = action['cache_data']['cache_dim']
        mock_pyautogui.size.return_value = Mock(
            width=cache_dim[0],
            height=cache_dim[1]
        )
        
        # Execute the action
        player._execute_action(action)
    
    # Verify NO AI calls were made
    assert ai_call_count == 0, \
        f"Cached Mode should make 0 AI calls, but made {ai_call_count}"


# =============================================================================
# Property 14: Playback Priority Order
# Feature: ai-vision-capture, Property 14: Playback Priority Order
# Validates: Requirements 4.1
# =============================================================================

@settings(max_examples=100)
@given(
    st.one_of(
        static_mode_action(),
        cached_mode_action(),
        dynamic_mode_action_no_cache()
    )
)
def test_playback_priority_order(action: Dict[str, Any]):
    """
    **Feature: ai-vision-capture, Property 14: Playback Priority Order**
    **Validates: Requirements 4.1**
    
    For any ai_vision_capture action, the Player SHALL check modes in this
    exact order: (1) Static saved_x/y, (2) Dynamic cached_x/y, (3) Dynamic AI call.
    The first valid option SHALL be used.
    """
    # Create player with the action
    player = Player([action])
    
    # Track which mode was used
    mode_used = None
    
    # Mock the execution methods to track which one is called
    original_static = player._execute_static_vision
    original_cached = player._execute_cached_vision
    original_dynamic = player._execute_dynamic_vision
    
    def mock_static(a):
        nonlocal mode_used
        mode_used = 'static'
    
    def mock_cached(a):
        nonlocal mode_used
        mode_used = 'cached'
    
    def mock_dynamic(a):
        nonlocal mode_used
        mode_used = 'dynamic'
    
    player._execute_static_vision = mock_static
    player._execute_cached_vision = mock_cached
    player._execute_dynamic_vision = mock_dynamic
    
    # Execute the action
    player._execute_ai_vision_capture(action)
    
    # Determine expected mode based on action state
    is_dynamic = action.get('is_dynamic', False)
    has_saved = (
        action.get('static_data', {}).get('saved_x') is not None and
        action.get('static_data', {}).get('saved_y') is not None
    )
    has_cache = (
        action.get('cache_data', {}).get('cached_x') is not None and
        action.get('cache_data', {}).get('cached_y') is not None
    )
    
    # Priority: Static (if not dynamic) -> Cache (if dynamic with cache) -> Dynamic (if dynamic without cache)
    if not is_dynamic:
        expected_mode = 'static'
    elif has_cache:
        expected_mode = 'cached'
    else:
        expected_mode = 'dynamic'
    
    assert mode_used == expected_mode, \
        f"Expected mode '{expected_mode}' but used '{mode_used}' " \
        f"(is_dynamic={is_dynamic}, has_saved={has_saved}, has_cache={has_cache})"


# =============================================================================
# Additional unit tests for edge cases
# =============================================================================

def test_static_mode_missing_coordinates_skips():
    """Static mode with missing coordinates should skip the action."""
    action = {
        'type': 'ai_vision_capture',
        'id': 'test-id',
        'timestamp': 0.0,
        'is_dynamic': False,
        'interaction': 'click',
        'static_data': {
            'original_screenshot': 'test.png',
            'saved_x': None,  # Missing
            'saved_y': None,  # Missing
            'screen_dim': [1920, 1080]
        },
        'dynamic_config': {
            'prompt': 'test',
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
    
    player = Player([action])
    
    # Track if interaction was executed
    interaction_executed = False
    
    def mock_interaction(x, y, interaction_type):
        nonlocal interaction_executed
        interaction_executed = True
    
    player._execute_interaction = mock_interaction
    
    # Execute
    player._execute_static_vision(action)
    
    # Should NOT execute interaction
    assert not interaction_executed, \
        "Static mode with missing coordinates should skip interaction"


def test_coordinate_scaling_proportionality():
    """Test that coordinate scaling maintains proportionality."""
    player = Player([])
    
    # Test cases: (original_x, original_y, original_dim, current_dim)
    test_cases = [
        # Same resolution - no scaling
        (100, 200, (1920, 1080), (1920, 1080)),
        # Double resolution
        (100, 200, (1920, 1080), (3840, 2160)),
        # Half resolution
        (100, 200, (1920, 1080), (960, 540)),
        # Different aspect ratio
        (100, 200, (1920, 1080), (1920, 1200)),
    ]
    
    for orig_x, orig_y, orig_dim, curr_dim in test_cases:
        scaled_x, scaled_y = player._scale_coordinates(orig_x, orig_y, orig_dim, curr_dim)
        
        # Check proportionality (with floating point tolerance)
        expected_x = orig_x * (curr_dim[0] / orig_dim[0])
        expected_y = orig_y * (curr_dim[1] / orig_dim[1])
        
        # Allow 1 pixel tolerance due to rounding
        assert abs(scaled_x - round(expected_x)) <= 1, \
            f"X scaling not proportional: {scaled_x} vs {expected_x}"
        assert abs(scaled_y - round(expected_y)) <= 1, \
            f"Y scaling not proportional: {scaled_y} vs {expected_y}"
        
        # Check bounds
        assert 0 <= scaled_x < curr_dim[0], \
            f"Scaled X {scaled_x} out of bounds [0, {curr_dim[0]})"
        assert 0 <= scaled_y < curr_dim[1], \
            f"Scaled Y {scaled_y} out of bounds [0, {curr_dim[1]})"


def test_has_valid_cache():
    """Test _has_valid_cache method."""
    player = Player([])
    
    # No cache
    action_no_cache = {
        'cache_data': {
            'cached_x': None,
            'cached_y': None,
            'cache_dim': None
        }
    }
    assert not player._has_valid_cache(action_no_cache)
    
    # Partial cache (only x)
    action_partial = {
        'cache_data': {
            'cached_x': 100,
            'cached_y': None,
            'cache_dim': None
        }
    }
    assert not player._has_valid_cache(action_partial)
    
    # Valid cache
    action_valid = {
        'cache_data': {
            'cached_x': 100,
            'cached_y': 200,
            'cache_dim': [1920, 1080]
        }
    }
    assert player._has_valid_cache(action_valid)
    
    # Missing cache_data
    action_missing = {}
    assert not player._has_valid_cache(action_missing)
    
    # None cache_data
    action_none = {'cache_data': None}
    assert not player._has_valid_cache(action_none)


# =============================================================================
# Property 7: Assertion Action Behavior
# Feature: test-case-driven-automation, Property 7: Assertion Action Behavior
# Validates: Requirements 3.1
# =============================================================================

@st.composite
def assertion_action(draw) -> Dict[str, Any]:
    """
    Generate a valid AI Vision Capture action with assertion mode enabled.
    
    This action should have is_assertion=True and may be in any mode
    (static, cached, or dynamic).
    """
    # Choose mode
    is_dynamic = draw(st.booleans())
    coords = draw(valid_coordinates())
    screen_dim = draw(screen_dimensions())
    
    action = {
        'type': 'ai_vision_capture',
        'id': str(uuid.uuid4()),
        'timestamp': draw(st.floats(min_value=0, max_value=1000)),
        'is_dynamic': is_dynamic,
        'is_assertion': True,  # This is the key difference
        'interaction': draw(interaction_type()),
        'static_data': {
            'original_screenshot': f'screenshots/vision_{uuid.uuid4()}.png',
            'screen_dim': list(screen_dim),
            'saved_x': coords[0] if not is_dynamic else None,
            'saved_y': coords[1] if not is_dynamic else None,
        },
        'dynamic_config': {
            'prompt': 'Find the element',
            'reference_images': [],
            'roi': None,
            'search_scope': 'global'
        },
        'cache_data': {
            'cached_x': coords[0] if is_dynamic else None,
            'cached_y': coords[1] if is_dynamic else None,
            'cache_dim': list(screen_dim) if is_dynamic else None
        }
    }
    
    return action


@settings(max_examples=100)
@given(assertion_action())
def test_assertion_action_behavior(action: Dict[str, Any]):
    """
    **Feature: test-case-driven-automation, Property 7: Assertion Action Behavior**
    **Validates: Requirements 3.1**
    
    For any AI vision action marked with is_assertion: true, the action SHALL not
    perform mouse or keyboard interactions and SHALL only return pass/fail status
    based on element detection.
    """
    # Ensure this is an assertion action
    assume(action['is_assertion'] == True)
    
    # Create player with the action
    player = Player([action])
    
    # Track interaction calls
    interaction_calls = []
    
    # Mock PyAutoGUI to track interaction calls
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        # Mock screen size
        mock_pyautogui.size.return_value = Mock(
            width=action['static_data']['screen_dim'][0],
            height=action['static_data']['screen_dim'][1]
        )
        
        # Track all interaction calls
        def track_interaction(func_name):
            def wrapper(*args, **kwargs):
                interaction_calls.append((func_name, args, kwargs))
                return Mock()
            return wrapper
        
        mock_pyautogui.click = track_interaction('click')
        mock_pyautogui.doubleClick = track_interaction('doubleClick')
        mock_pyautogui.rightClick = track_interaction('rightClick')
        mock_pyautogui.moveTo = track_interaction('moveTo')
        
        # Mock screenshot for evidence capture
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Execute the action
        player._execute_ai_vision_capture(action)
    
    # Verify NO interactions were performed
    assert len(interaction_calls) == 0, \
        f"Assertion actions should not perform interactions, but performed: {interaction_calls}"
    
    # Verify assertion result was set
    assert 'assertion_result' in action, \
        "Assertion action should have assertion_result set"
    
    assert 'passed' in action['assertion_result'], \
        "Assertion result should contain 'passed' field"
    
    assert isinstance(action['assertion_result']['passed'], bool), \
        "Assertion result 'passed' should be a boolean"
    
    # Verify evidence was captured
    assert 'assertion_evidence' in action, \
        "Assertion action should have evidence captured"
    
    assert 'screenshot_path' in action['assertion_evidence'], \
        "Assertion evidence should contain screenshot path"


@settings(max_examples=100)
@given(assertion_action())
def test_assertion_static_mode_element_found(action: Dict[str, Any]):
    """
    **Feature: test-case-driven-automation, Property 7: Assertion Action Behavior**
    **Validates: Requirements 3.1**
    
    For any assertion action in static mode with valid coordinates,
    the assertion should PASS without performing interactions.
    """
    # Ensure static mode with valid coordinates
    action['is_dynamic'] = False
    assume(action['static_data']['saved_x'] is not None)
    assume(action['static_data']['saved_y'] is not None)
    assume(action['is_assertion'] == True)
    
    # Create player
    player = Player([action])
    
    # Mock PyAutoGUI
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        mock_pyautogui.size.return_value = Mock(
            width=action['static_data']['screen_dim'][0],
            height=action['static_data']['screen_dim'][1]
        )
        
        # Mock screenshot for evidence
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Execute the action
        player._execute_ai_vision_capture(action)
    
    # Verify assertion passed
    assert action['assertion_result']['passed'] == True, \
        "Static mode assertion with valid coordinates should pass"
    
    assert "Element found at coordinates" in action['assertion_result']['message'], \
        "Assertion message should indicate element was found"


@settings(max_examples=100)
@given(assertion_action())
def test_assertion_static_mode_element_not_found(action: Dict[str, Any]):
    """
    **Feature: test-case-driven-automation, Property 7: Assertion Action Behavior**
    **Validates: Requirements 3.1**
    
    For any assertion action in static mode without valid coordinates,
    the assertion should FAIL without performing interactions.
    """
    # Ensure static mode without valid coordinates
    action['is_dynamic'] = False
    action['static_data']['saved_x'] = None
    action['static_data']['saved_y'] = None
    assume(action['is_assertion'] == True)
    
    # Create player
    player = Player([action])
    
    # Mock PyAutoGUI
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        mock_pyautogui.size.return_value = Mock(
            width=action['static_data']['screen_dim'][0],
            height=action['static_data']['screen_dim'][1]
        )
        
        # Mock screenshot for evidence
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Execute the action
        player._execute_ai_vision_capture(action)
    
    # Verify assertion failed
    assert action['assertion_result']['passed'] == False, \
        "Static mode assertion without valid coordinates should fail"
    
    assert "Element not found" in action['assertion_result']['message'], \
        "Assertion message should indicate element was not found"


# =============================================================================
# Property 10: Evidence Collection
# Feature: test-case-driven-automation, Property 10: Evidence Collection
# Validates: Requirements 3.5
# =============================================================================

@settings(max_examples=100)
@given(assertion_action())
def test_evidence_collection(action: Dict[str, Any]):
    """
    **Feature: test-case-driven-automation, Property 10: Evidence Collection**
    **Validates: Requirements 3.5**
    
    For any assertion action execution, screenshots SHALL be captured as proof
    regardless of pass or fail outcome.
    """
    # Ensure this is an assertion action
    assume(action['is_assertion'] == True)
    
    # Create player with the action
    player = Player([action])
    
    # Track screenshot calls
    screenshot_calls = []
    save_calls = []
    
    # Mock PyAutoGUI to track screenshot capture
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        # Mock screen size
        mock_pyautogui.size.return_value = Mock(
            width=action['static_data']['screen_dim'][0],
            height=action['static_data']['screen_dim'][1]
        )
        
        # Track screenshot calls
        def track_screenshot():
            screenshot_calls.append('screenshot')
            mock_screenshot = Mock()
            
            def track_save(filepath):
                save_calls.append(filepath)
            
            mock_screenshot.save = track_save
            return mock_screenshot
        
        mock_pyautogui.screenshot = track_screenshot
        
        # Mock Path.mkdir to avoid actual directory creation
        with patch('pathlib.Path.mkdir'):
            # Execute the action
            player._execute_ai_vision_capture(action)
    
    # Verify screenshot was captured
    assert len(screenshot_calls) > 0, \
        "Evidence collection should capture at least one screenshot"
    
    # Verify screenshot was saved
    assert len(save_calls) > 0, \
        "Evidence collection should save at least one screenshot"
    
    # Verify evidence path was stored in action
    assert 'assertion_evidence' in action, \
        "Action should contain assertion evidence"
    
    assert 'screenshot_path' in action['assertion_evidence'], \
        "Assertion evidence should contain screenshot path"
    
    # Verify the screenshot path is a string
    screenshot_path = action['assertion_evidence']['screenshot_path']
    assert isinstance(screenshot_path, str), \
        "Screenshot path should be a string"
    
    # Verify the path contains expected elements
    assert 'assertion_' in screenshot_path, \
        "Screenshot path should contain 'assertion_' prefix"
    
    assert action['id'] in screenshot_path, \
        "Screenshot path should contain the action ID"
    
    assert screenshot_path.endswith('.png'), \
        "Screenshot path should end with .png extension"


@settings(max_examples=100)
@given(assertion_action())
def test_evidence_collection_pass_and_fail(action: Dict[str, Any]):
    """
    **Feature: test-case-driven-automation, Property 10: Evidence Collection**
    **Validates: Requirements 3.5**
    
    For any assertion action, evidence should be collected regardless of
    whether the assertion passes or fails.
    """
    # Test both pass and fail scenarios
    for scenario in ['pass', 'fail']:
        # Reset action state
        if 'assertion_evidence' in action:
            del action['assertion_evidence']
        if 'assertion_result' in action:
            del action['assertion_result']
        
        # Configure action for pass/fail scenario
        if scenario == 'pass':
            # Static mode with valid coordinates = pass
            action['is_dynamic'] = False
            action['static_data']['saved_x'] = 100
            action['static_data']['saved_y'] = 200
        else:
            # Static mode without coordinates = fail
            action['is_dynamic'] = False
            action['static_data']['saved_x'] = None
            action['static_data']['saved_y'] = None
        
        # Create player
        player = Player([action])
        
        # Track evidence collection
        evidence_collected = False
        
        # Mock PyAutoGUI
        with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
             patch('player.player.pyautogui') as mock_pyautogui:
            
            mock_pyautogui.size.return_value = Mock(
                width=action['static_data']['screen_dim'][0],
                height=action['static_data']['screen_dim'][1]
            )
            
            # Track screenshot capture
            def track_screenshot():
                nonlocal evidence_collected
                evidence_collected = True
                mock_screenshot = Mock()
                mock_screenshot.save = Mock()
                return mock_screenshot
            
            mock_pyautogui.screenshot = track_screenshot
            
            # Mock Path.mkdir
            with patch('pathlib.Path.mkdir'):
                # Execute the action
                player._execute_ai_vision_capture(action)
        
        # Verify evidence was collected regardless of pass/fail
        assert evidence_collected, \
            f"Evidence should be collected for {scenario} scenario"
        
        assert 'assertion_evidence' in action, \
            f"Action should contain evidence for {scenario} scenario"
        
        assert 'screenshot_path' in action['assertion_evidence'], \
            f"Evidence should contain screenshot path for {scenario} scenario"


@settings(max_examples=100)
@given(assertion_action())
def test_evidence_collection_without_pyautogui(action: Dict[str, Any]):
    """
    **Feature: test-case-driven-automation, Property 10: Evidence Collection**
    **Validates: Requirements 3.5**
    
    When PyAutoGUI is not available, evidence collection should fail gracefully
    without breaking the assertion execution.
    """
    # Ensure this is an assertion action
    assume(action['is_assertion'] == True)
    
    # Create player
    player = Player([action])
    
    # Mock PyAutoGUI as unavailable
    with patch('player.player.PYAUTOGUI_AVAILABLE', False):
        # Execute the action - should not raise exception
        try:
            player._execute_ai_vision_capture(action)
        except Exception as e:
            pytest.fail(f"Evidence collection should fail gracefully when PyAutoGUI unavailable, but raised: {e}")
    
    # Verify assertion still executed (even without evidence)
    assert 'assertion_result' in action, \
        "Assertion should still execute even when evidence collection fails"
    
    # Evidence may or may not be present (graceful failure)
    # The important thing is that execution didn't crash

# =============================================================================
# Property 8: Assertion Result Handling
# Feature: test-case-driven-automation, Property 8: Assertion Result Handling
# Validates: Requirements 3.2, 3.3
# =============================================================================

@st.composite
def step_with_assertions(draw) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Generate a test step with multiple assertion actions.
    
    Returns tuple of (step_id, actions_list)
    """
    step_id = str(uuid.uuid4())
    
    # Generate 1-5 assertion actions
    num_assertions = draw(st.integers(min_value=1, max_value=5))
    actions = []
    
    for _ in range(num_assertions):
        action = draw(assertion_action())
        actions.append(action)
    
    # Optionally add some non-assertion actions
    num_regular = draw(st.integers(min_value=0, max_value=3))
    for _ in range(num_regular):
        regular_action = {
            'type': 'mouse_click',
            'id': str(uuid.uuid4()),
            'timestamp': draw(st.floats(min_value=0, max_value=1000)),
            'x': draw(st.integers(min_value=0, max_value=1920)),
            'y': draw(st.integers(min_value=0, max_value=1080)),
            'button': 'left'
        }
        actions.append(regular_action)
    
    return step_id, actions


@settings(max_examples=100)
@given(step_with_assertions())
def test_assertion_result_handling_pass(step_data: Tuple[str, List[Dict[str, Any]]]):
    """
    **Feature: test-case-driven-automation, Property 8: Assertion Result Handling**
    **Validates: Requirements 3.2, 3.3**
    
    For any assertion action execution, when the target is found the step SHALL
    receive PASSED status, and when the target is not found after timeout the
    step SHALL receive FAILED status.
    """
    step_id, actions = step_data
    assertion_actions = [action for action in actions if action.get('is_assertion', False)]
    assume(len(assertion_actions) > 0)
    
    # Create player
    player = Player(actions)
    
    # Set all assertions to pass (simulate found elements)
    for action in assertion_actions:
        # Configure for static mode with valid coordinates (will pass)
        action['is_dynamic'] = False
        action['static_data']['saved_x'] = 100
        action['static_data']['saved_y'] = 200
    
    # Execute all assertion actions
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        # Mock screen size and screenshot
        mock_pyautogui.size.return_value = Mock(width=1920, height=1080)
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Mock Path.mkdir
        with patch('pathlib.Path.mkdir'):
            for action in assertion_actions:
                player._execute_ai_vision_capture(action)
    
    # Process step assertions
    step_result = player._process_step_assertions(step_id, actions)
    
    # Verify step passed
    assert step_result['status'] == 'passed', \
        f"Step should pass when all assertions pass, but got: {step_result['status']}"
    
    assert step_result['failed_assertions'] == 0, \
        f"Should have 0 failed assertions, but got: {step_result['failed_assertions']}"
    
    assert step_result['passed_assertions'] == len(assertion_actions), \
        f"Should have {len(assertion_actions)} passed assertions, but got: {step_result['passed_assertions']}"
    
    assert "All" in step_result['message'] and "passed" in step_result['message'], \
        f"Message should indicate all assertions passed: {step_result['message']}"


@settings(max_examples=100)
@given(step_with_assertions())
def test_assertion_result_handling_fail(step_data: Tuple[str, List[Dict[str, Any]]]):
    """
    **Feature: test-case-driven-automation, Property 8: Assertion Result Handling**
    **Validates: Requirements 3.2, 3.3**
    
    For any assertion action execution, when the target is not found after timeout
    the step SHALL receive FAILED status.
    """
    step_id, actions = step_data
    assertion_actions = [action for action in actions if action.get('is_assertion', False)]
    assume(len(assertion_actions) > 0)
    
    # Create player
    player = Player(actions)
    
    # Set all assertions to fail (simulate elements not found)
    for action in assertion_actions:
        # Configure for static mode without valid coordinates (will fail)
        action['is_dynamic'] = False
        action['static_data']['saved_x'] = None
        action['static_data']['saved_y'] = None
    
    # Execute all assertion actions
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        # Mock screen size and screenshot
        mock_pyautogui.size.return_value = Mock(width=1920, height=1080)
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Mock Path.mkdir
        with patch('pathlib.Path.mkdir'):
            for action in assertion_actions:
                player._execute_ai_vision_capture(action)
    
    # Process step assertions
    step_result = player._process_step_assertions(step_id, actions)
    
    # Verify step failed
    assert step_result['status'] == 'failed', \
        f"Step should fail when assertions fail, but got: {step_result['status']}"
    
    assert step_result['failed_assertions'] == len(assertion_actions), \
        f"Should have {len(assertion_actions)} failed assertions, but got: {step_result['failed_assertions']}"
    
    assert step_result['passed_assertions'] == 0, \
        f"Should have 0 passed assertions, but got: {step_result['passed_assertions']}"
    
    assert "failed" in step_result['message'].lower(), \
        f"Message should indicate assertion failure: {step_result['message']}"


@settings(max_examples=100)
@given(step_with_assertions())
def test_assertion_result_handling_mixed(step_data: Tuple[str, List[Dict[str, Any]]]):
    """
    **Feature: test-case-driven-automation, Property 8: Assertion Result Handling**
    **Validates: Requirements 3.2, 3.3**
    
    For any step with mixed assertion results, the step should fail if any
    assertion fails (all must pass for step to pass).
    """
    step_id, actions = step_data
    assertion_actions = [action for action in actions if action.get('is_assertion', False)]
    assume(len(assertion_actions) >= 2)  # Need at least 2 for mixed results
    
    # Create player
    player = Player(actions)
    
    # Set mixed results: first assertion passes, rest fail
    for i, action in enumerate(assertion_actions):
        if i == 0:
            # First assertion passes
            action['is_dynamic'] = False
            action['static_data']['saved_x'] = 100
            action['static_data']['saved_y'] = 200
        else:
            # Rest fail
            action['is_dynamic'] = False
            action['static_data']['saved_x'] = None
            action['static_data']['saved_y'] = None
    
    # Execute all assertion actions
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        # Mock screen size and screenshot
        mock_pyautogui.size.return_value = Mock(width=1920, height=1080)
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Mock Path.mkdir
        with patch('pathlib.Path.mkdir'):
            for action in assertion_actions:
                player._execute_ai_vision_capture(action)
    
    # Process step assertions
    step_result = player._process_step_assertions(step_id, actions)
    
    # Verify step failed (because at least one assertion failed)
    assert step_result['status'] == 'failed', \
        f"Step should fail when any assertion fails, but got: {step_result['status']}"
    
    assert step_result['passed_assertions'] == 1, \
        f"Should have 1 passed assertion, but got: {step_result['passed_assertions']}"
    
    assert step_result['failed_assertions'] == len(assertion_actions) - 1, \
        f"Should have {len(assertion_actions) - 1} failed assertions, but got: {step_result['failed_assertions']}"


@settings(max_examples=100)
@given(st.floats(min_value=1.0, max_value=120.0))
def test_assertion_timeout_handling(timeout_seconds: float):
    """
    **Feature: test-case-driven-automation, Property 8: Assertion Result Handling**
    **Validates: Requirements 3.3**
    
    For any assertion timeout, the assertion should be marked as failed with
    appropriate timeout message.
    """
    # Create assertion action
    action = {
        'type': 'ai_vision_capture',
        'id': str(uuid.uuid4()),
        'timestamp': 0.0,
        'is_dynamic': True,
        'is_assertion': True,
        'interaction': 'click',
        'static_data': {
            'original_screenshot': 'test.png',
            'screen_dim': [1920, 1080],
            'saved_x': None,
            'saved_y': None,
        },
        'dynamic_config': {
            'prompt': 'Find element',
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
    
    # Create player
    player = Player([action])
    
    # Handle timeout
    player._handle_assertion_timeout(action, timeout_seconds)
    
    # Verify timeout was handled correctly
    assert 'assertion_result' in action, \
        "Timeout should set assertion result"
    
    assert action['assertion_result']['passed'] == False, \
        "Timeout should mark assertion as failed"
    
    timeout_message = action['assertion_result']['message']
    assert 'timed out' in timeout_message.lower(), \
        f"Timeout message should mention timeout: {timeout_message}"
    
    # Check that the timeout duration is approximately represented in the message
    # (allowing for formatting differences like rounding to 1 decimal place)
    expected_duration_str = f"{timeout_seconds:.1f}"
    assert expected_duration_str in timeout_message, \
        f"Timeout message should include duration (formatted): expected '{expected_duration_str}' in '{timeout_message}'"

# =============================================================================
# Property 9: Multiple Assertion Logic
# Feature: test-case-driven-automation, Property 9: Multiple Assertion Logic
# Validates: Requirements 3.4
# =============================================================================

@st.composite
def mixed_step_actions(draw) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Generate a test step with mixed regular actions and assertion actions.
    
    Returns tuple of (step_id, actions_list)
    """
    step_id = str(uuid.uuid4())
    actions = []
    
    # Generate 1-3 regular actions
    num_regular = draw(st.integers(min_value=1, max_value=3))
    for _ in range(num_regular):
        regular_action = {
            'type': 'mouse_click',
            'id': str(uuid.uuid4()),
            'timestamp': draw(st.floats(min_value=0, max_value=1000)),
            'x': draw(st.integers(min_value=0, max_value=1920)),
            'y': draw(st.integers(min_value=0, max_value=1080)),
            'button': 'left'
        }
        actions.append(regular_action)
    
    # Generate 2-4 assertion actions
    num_assertions = draw(st.integers(min_value=2, max_value=4))
    for _ in range(num_assertions):
        assertion = draw(assertion_action())
        actions.append(assertion)
    
    return step_id, actions


@settings(max_examples=100)
@given(mixed_step_actions())
def test_multiple_assertion_logic_all_pass(step_data: Tuple[str, List[Dict[str, Any]]]):
    """
    **Feature: test-case-driven-automation, Property 9: Multiple Assertion Logic**
    **Validates: Requirements 3.4**
    
    For any test step containing multiple assertion actions, the step SHALL pass
    only when all assertions succeed.
    """
    step_id, actions = step_data
    assertion_actions = [action for action in actions if action.get('is_assertion', False)]
    assume(len(assertion_actions) >= 2)
    
    # Create player
    player = Player(actions)
    
    # Configure all assertions to pass
    for action in assertion_actions:
        action['is_dynamic'] = False
        action['static_data']['saved_x'] = 100
        action['static_data']['saved_y'] = 200
    
    # Mock execution environment
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        mock_pyautogui.size.return_value = Mock(width=1920, height=1080)
        mock_pyautogui.click = Mock()
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Mock Path.mkdir and regular action execution
        with patch('pathlib.Path.mkdir'), \
             patch.object(player, '_execute_action') as mock_execute_action:
            
            # Mock regular action execution to succeed
            mock_execute_action.return_value = None
            
            # Execute step with mixed actions
            step_result = player._execute_step_with_assertions(step_id, actions)
    
    # Verify step passed when all assertions pass
    assert step_result['status'] == 'passed', \
        f"Step should pass when all assertions pass, but got: {step_result['status']}"
    
    assert step_result['assertion_result']['failed_assertions'] == 0, \
        f"Should have 0 failed assertions, but got: {step_result['assertion_result']['failed_assertions']}"
    
    assert step_result['assertion_result']['passed_assertions'] == len(assertion_actions), \
        f"Should have {len(assertion_actions)} passed assertions, but got: {step_result['assertion_result']['passed_assertions']}"
    
    assert "passed" in step_result['message'].lower(), \
        f"Message should indicate step passed: {step_result['message']}"


@settings(max_examples=100)
@given(mixed_step_actions())
def test_multiple_assertion_logic_any_fail(step_data: Tuple[str, List[Dict[str, Any]]]):
    """
    **Feature: test-case-driven-automation, Property 9: Multiple Assertion Logic**
    **Validates: Requirements 3.4**
    
    For any test step containing multiple assertion actions, the step SHALL fail
    if any assertion fails (all must pass for step to pass).
    """
    step_id, actions = step_data
    assertion_actions = [action for action in actions if action.get('is_assertion', False)]
    assume(len(assertion_actions) >= 2)
    
    # Create player
    player = Player(actions)
    
    # Configure first assertion to fail, rest to pass
    for i, action in enumerate(assertion_actions):
        if i == 0:
            # First assertion fails
            action['is_dynamic'] = False
            action['static_data']['saved_x'] = None
            action['static_data']['saved_y'] = None
        else:
            # Rest pass
            action['is_dynamic'] = False
            action['static_data']['saved_x'] = 100
            action['static_data']['saved_y'] = 200
    
    # Mock execution environment
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        mock_pyautogui.size.return_value = Mock(width=1920, height=1080)
        mock_pyautogui.click = Mock()
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Mock Path.mkdir and regular action execution
        with patch('pathlib.Path.mkdir'), \
             patch.object(player, '_execute_action') as mock_execute_action:
            
            # Mock regular action execution to succeed
            mock_execute_action.return_value = None
            
            # Execute step with mixed actions
            step_result = player._execute_step_with_assertions(step_id, actions)
    
    # Verify step failed when any assertion fails
    assert step_result['status'] == 'failed', \
        f"Step should fail when any assertion fails, but got: {step_result['status']}"
    
    assert step_result['assertion_result']['failed_assertions'] >= 1, \
        f"Should have at least 1 failed assertion, but got: {step_result['assertion_result']['failed_assertions']}"
    
    assert step_result['assertion_result']['passed_assertions'] == len(assertion_actions) - 1, \
        f"Should have {len(assertion_actions) - 1} passed assertions, but got: {step_result['assertion_result']['passed_assertions']}"
    
    assert "failed" in step_result['message'].lower(), \
        f"Message should indicate step failed: {step_result['message']}"


@settings(max_examples=100)
@given(mixed_step_actions())
def test_multiple_assertion_comprehensive_error_reporting(step_data: Tuple[str, List[Dict[str, Any]]]):
    """
    **Feature: test-case-driven-automation, Property 9: Multiple Assertion Logic**
    **Validates: Requirements 3.4**
    
    For any step with failed assertions, comprehensive error reporting should
    provide detailed information about each assertion result.
    """
    step_id, actions = step_data
    assertion_actions = [action for action in actions if action.get('is_assertion', False)]
    assume(len(assertion_actions) >= 2)
    
    # Create player
    player = Player(actions)
    
    # Configure mixed assertion results
    for i, action in enumerate(assertion_actions):
        if i % 2 == 0:
            # Even indices fail
            action['is_dynamic'] = False
            action['static_data']['saved_x'] = None
            action['static_data']['saved_y'] = None
        else:
            # Odd indices pass
            action['is_dynamic'] = False
            action['static_data']['saved_x'] = 100
            action['static_data']['saved_y'] = 200
    
    # Execute assertions to generate results
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        mock_pyautogui.size.return_value = Mock(width=1920, height=1080)
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Mock Path.mkdir
        with patch('pathlib.Path.mkdir'):
            for action in assertion_actions:
                player._execute_ai_vision_capture(action)
    
    # Generate comprehensive error report
    error_report = player._generate_assertion_error_report(step_id, actions)
    
    # Verify comprehensive error reporting
    assert error_report['step_id'] == step_id, \
        "Error report should contain correct step ID"
    
    assert error_report['total_assertions'] == len(assertion_actions), \
        f"Error report should show {len(assertion_actions)} total assertions"
    
    assert error_report['failed_count'] > 0, \
        "Error report should show failed assertions"
    
    assert error_report['passed_count'] > 0, \
        "Error report should show passed assertions"
    
    assert len(error_report['failed_assertions']) == error_report['failed_count'], \
        "Failed assertions list should match failed count"
    
    assert len(error_report['passed_assertions']) == error_report['passed_count'], \
        "Passed assertions list should match passed count"
    
    # Verify each failed assertion has detailed information
    for failed_assertion in error_report['failed_assertions']:
        assert 'action_id' in failed_assertion, \
            "Failed assertion should include action ID"
        
        assert 'message' in failed_assertion, \
            "Failed assertion should include error message"
        
        assert 'timestamp' in failed_assertion, \
            "Failed assertion should include timestamp"
        
        assert failed_assertion['passed'] == False, \
            "Failed assertion should be marked as not passed"
    
    # Verify each passed assertion has detailed information
    for passed_assertion in error_report['passed_assertions']:
        assert 'action_id' in passed_assertion, \
            "Passed assertion should include action ID"
        
        assert passed_assertion['passed'] == True, \
            "Passed assertion should be marked as passed"


@settings(max_examples=100)
@given(mixed_step_actions())
def test_mixed_action_execution_order(step_data: Tuple[str, List[Dict[str, Any]]]):
    """
    **Feature: test-case-driven-automation, Property 9: Multiple Assertion Logic**
    **Validates: Requirements 3.4**
    
    For any step with mixed actions, regular actions should be executed before
    assertions, and the step result should reflect both types of execution.
    """
    step_id, actions = step_data
    regular_actions = [action for action in actions if not action.get('is_assertion', False)]
    assertion_actions = [action for action in actions if action.get('is_assertion', False)]
    assume(len(regular_actions) >= 1 and len(assertion_actions) >= 1)
    
    # Create player
    player = Player(actions)
    
    # Configure assertions to pass
    for action in assertion_actions:
        action['is_dynamic'] = False
        action['static_data']['saved_x'] = 100
        action['static_data']['saved_y'] = 200
    
    # Track execution order
    execution_order = []
    
    # Mock regular action execution
    def track_regular_action(action):
        execution_order.append(('regular', action.get('id', 'unknown')))
        # Don't actually execute to avoid errors - just return success
    
    # Mock assertion execution
    original_execute_ai_vision = player._execute_ai_vision_capture
    def track_assertion_action(action):
        execution_order.append(('assertion', action.get('id', 'unknown')))
        # Call original to set assertion results
        return original_execute_ai_vision(action)
    
    with patch('player.player.PYAUTOGUI_AVAILABLE', True), \
         patch('player.player.pyautogui') as mock_pyautogui:
        
        mock_pyautogui.size.return_value = Mock(width=1920, height=1080)
        mock_pyautogui.click = Mock()
        mock_screenshot = Mock()
        mock_screenshot.save = Mock()
        mock_pyautogui.screenshot.return_value = mock_screenshot
        
        # Mock Path.mkdir and patch execution methods
        with patch('pathlib.Path.mkdir'), \
             patch.object(player, '_execute_action', side_effect=track_regular_action), \
             patch.object(player, '_execute_ai_vision_capture', side_effect=track_assertion_action):
            
            # Execute step with mixed actions
            step_result = player._execute_step_with_assertions(step_id, actions)
    
    # Verify execution order: all regular actions before all assertions
    regular_indices = [i for i, (action_type, _) in enumerate(execution_order) if action_type == 'regular']
    assertion_indices = [i for i, (action_type, _) in enumerate(execution_order) if action_type == 'assertion']
    
    if regular_indices and assertion_indices:
        max_regular_index = max(regular_indices)
        min_assertion_index = min(assertion_indices)
        
        assert max_regular_index < min_assertion_index, \
            f"Regular actions should execute before assertions. Order: {execution_order}"
    
    # Verify step result includes both action types
    assert step_result['regular_actions_count'] == len(regular_actions), \
        f"Step result should show {len(regular_actions)} regular actions"
    
    assert step_result['assertion_actions_count'] == len(assertion_actions), \
        f"Step result should show {len(assertion_actions)} assertion actions"
