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
from typing import Dict, Any, Optional, Tuple
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
