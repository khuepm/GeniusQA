"""Player module for replaying recorded actions."""

import sys
import time
import threading
import json
import asyncio
from typing import List, Optional, Tuple, Dict, Any
from pathlib import Path

try:
    import pyautogui
    # Disable pyautogui's built-in pause for faster execution
    pyautogui.PAUSE = 0
    pyautogui.FAILSAFE = True  # Keep failsafe enabled (move mouse to corner to abort)
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

try:
    from pynput import keyboard
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False

# Import AI Vision components
try:
    from vision.ai_vision_service import AIVisionService, AIVisionRequest, VisionROI as ServiceVisionROI
    from vision.image_utils import scale_coordinates, scale_roi, crop_to_roi, encode_image_base64
    AI_VISION_AVAILABLE = True
except ImportError:
    AI_VISION_AVAILABLE = False

try:
    from storage.models import AIVisionCaptureAction
    AI_VISION_MODELS_AVAILABLE = True
except ImportError:
    AI_VISION_MODELS_AVAILABLE = False


class Player:
    """Executes recorded actions with timing."""
    
    def __init__(self, actions: List, progress_callback=None, variables=None, action_callback=None, speed=1.0, loop_count=1, stop_callback=None, script_path: Optional[str] = None, ai_api_key: Optional[str] = None):
        """Initialize the player with actions.
        
        Args:
            actions: List of actions to play back
            progress_callback: Optional callback function(current, total) for progress updates
            variables: Optional dictionary of variable names to values for substitution
            action_callback: Optional callback function(action, index) called before executing each action
            speed: Playback speed multiplier (0.5 = half speed, 2.0 = double speed). Default is 1.0
            loop_count: Number of times to repeat playback (1 = play once, 0 = infinite loop). Default is 1
            stop_callback: Optional callback function() called when playback is stopped by ESC key
            script_path: Optional path to the script file (for cache persistence)
            ai_api_key: Optional API key for AI Vision service
        """
        self.actions = actions
        self.is_playing = False
        self.is_paused = False
        self._playback_thread = None
        self.progress_callback = progress_callback
        self.action_callback = action_callback
        self.stop_callback = stop_callback
        self.pause_callback = None
        self.variables = variables or {}
        self.speed = max(0.1, min(10.0, speed))  # Clamp speed between 0.1x and 10x
        self.loop_count = max(0, loop_count)  # 0 means infinite loop
        self.current_loop = 0
        self._keyboard_listener = None
        self._stopped_by_esc = False
        self._cmd_pressed = False
        
        # AI Vision Capture support
        self.script_path = script_path
        self.ai_api_key = ai_api_key
        self._ai_service: Optional[Any] = None
        self._ai_call_count = 0  # Track AI calls for testing
    
    def start_playback(self) -> None:
        """Execute actions with timing in a separate thread."""
        if self.is_playing:
            raise RuntimeError("Playback already in progress")
        
        self.is_playing = True
        
        # Start keyboard listener for ESC key to stop playback, Cmd+ESC to pause
        if PYNPUT_AVAILABLE:
            self._keyboard_listener = keyboard.Listener(
                on_press=self._on_key_press,
                on_release=self._on_key_release
            )
            self._keyboard_listener.start()
            sys.stderr.write("[Player] Press ESC to stop, Cmd+ESC to pause/resume\n")
            sys.stderr.flush()
        
        self._playback_thread = threading.Thread(target=self._playback_loop)
        self._playback_thread.start()
    
    def _playback_loop(self) -> None:
        """Internal playback loop that executes actions with timing."""
        try:
            # Determine number of iterations
            iterations = float('inf') if self.loop_count == 0 else self.loop_count
            self.current_loop = 0
            
            print(f"[Player] Starting playback: {len(self.actions)} actions, speed={self.speed}x, loops={self.loop_count}", flush=True)
            
            while self.current_loop < iterations and self.is_playing:
                for i, action in enumerate(self.actions):
                    if not self.is_playing:
                        break
                    
                    # Wait while paused
                    while self.is_paused and self.is_playing:
                        time.sleep(0.1)
                    
                    if not self.is_playing:
                        break
                    
                    # Notify about the action before executing it
                    if self.action_callback:
                        try:
                            self.action_callback(action, i)
                        except Exception:
                            # Don't let callback errors stop playback
                            pass
                    
                    # Log action being executed
                    action_type = action.type if hasattr(action, 'type') else action.get('type', 'unknown')
                    if action_type == 'ai_vision_capture':
                        action_id = action.id if hasattr(action, 'id') else action.get('id', 'unknown')
                        print(f"[Player] Executing action {i+1}/{len(self.actions)}: {action_type} (id={action_id})", flush=True)
                    else:
                        action_x = action.x if hasattr(action, 'x') else action.get('x', 0)
                        action_y = action.y if hasattr(action, 'y') else action.get('y', 0)
                        print(f"[Player] Executing action {i+1}/{len(self.actions)}: {action_type} at ({action_x}, {action_y})", flush=True)
                    
                    # Execute the current action
                    self._execute_action(action)
                    
                    # Report progress if callback is provided
                    if self.progress_callback:
                        try:
                            self.progress_callback(i + 1, len(self.actions), self.current_loop + 1, self.loop_count)
                        except Exception:
                            # Don't let callback errors stop playback
                            pass
                    
                    # Calculate and apply delay before next action
                    if i < len(self.actions) - 1:
                        next_action = self.actions[i + 1]
                        delay = self._calculate_delay(action, next_action)
                        
                        # Sleep in small increments to allow interruption and pause
                        elapsed = 0.0
                        sleep_increment = 0.01  # 10ms increments
                        while elapsed < delay and self.is_playing:
                            # Check for pause during delay
                            while self.is_paused and self.is_playing:
                                time.sleep(0.1)
                            if not self.is_playing:
                                break
                            time.sleep(min(sleep_increment, delay - elapsed))
                            elapsed += sleep_increment
                
                # Increment loop counter
                self.current_loop += 1
                
                # If not the last iteration and still playing, add a small delay between loops
                if self.current_loop < iterations and self.is_playing:
                    time.sleep(0.5)  # 500ms delay between loops
        finally:
            self.is_playing = False
            
            # Emit completion event if not stopped by ESC
            if not self._stopped_by_esc and self.progress_callback:
                try:
                    # Emit final progress (100%)
                    self.progress_callback(len(self.actions), len(self.actions), self.current_loop, self.loop_count)
                    # Emit completion event
                    import json
                    import sys
                    event = {
                        'type': 'complete',
                        'data': {
                            'totalActions': len(self.actions),
                            'totalLoops': self.current_loop,
                            'completed': True
                        }
                    }
                    json_str = json.dumps(event)
                    sys.stdout.write(json_str + '\n')
                    sys.stdout.flush()
                except Exception:
                    pass
    
    def stop_playback(self) -> None:
        """Interrupt playback."""
        self.is_playing = False
        
        # Stop keyboard listener
        if self._keyboard_listener:
            self._keyboard_listener.stop()
            self._keyboard_listener = None
        
        if self._playback_thread and self._playback_thread.is_alive():
            self._playback_thread.join(timeout=1.0)
    
    def _substitute_variables(self, text: str) -> str:
        """Substitute variables in text using {{variable_name}} syntax.
        
        Args:
            text: Text that may contain variable placeholders
            
        Returns:
            Text with variables substituted
        """
        if not text or not self.variables:
            return text
        
        result = text
        for var_name, var_value in self.variables.items():
            placeholder = f"{{{{{var_name}}}}}"
            result = result.replace(placeholder, var_value)
        
        return result
    
    def _execute_action(self, action) -> None:
        """Execute a single action using PyAutoGUI.
        
        This method can be overridden or mocked for testing.
        Supports variable substitution in key actions.
        Supports AI Vision Capture actions.
        """
        # Get action type - handle both Pydantic models and dicts
        if hasattr(action, 'type'):
            action_type = action.type
        elif isinstance(action, dict):
            action_type = action.get('type')
        else:
            return
        
        # Handle AI Vision Capture actions
        if action_type == 'ai_vision_capture':
            # Convert to dict if needed
            if hasattr(action, 'model_dump'):
                action_dict = action.model_dump(mode='json')
            elif isinstance(action, dict):
                action_dict = action
            else:
                action_dict = dict(action)
            
            self._execute_ai_vision_capture(action_dict)
            return
        
        if not PYAUTOGUI_AVAILABLE:
            return
        
        if action_type == 'mouse_move':
            # Skip mouse_move at high speeds for better performance
            # Only execute mouse moves at speeds <= 2x
            if self.speed <= 2.0:
                pyautogui.moveTo(action.x, action.y, _pause=False)
            # At higher speeds, skip mouse moves entirely - just jump to click positions
        elif action_type == 'mouse_click':
            # Always move to position before clicking
            pyautogui.click(action.x, action.y, button=action.button, _pause=False)
        elif action_type == 'key_press':
            # Apply variable substitution to key values
            key = self._substitute_variables(action.key) if action.key else action.key
            pyautogui.keyDown(key, _pause=False)
        elif action_type == 'key_release':
            # Apply variable substitution to key values
            key = self._substitute_variables(action.key) if action.key else action.key
            pyautogui.keyUp(key, _pause=False)
    
    def _calculate_delay(self, current, next_action) -> float:
        """Calculate delay between actions, capped at 5 seconds, adjusted by speed."""
        delay = next_action.timestamp - current.timestamp
        capped_delay = min(delay, 5.0)
        # Apply speed multiplier (higher speed = shorter delay)
        return capped_delay / self.speed
    
    def _on_key_press(self, key) -> None:
        """Handle keyboard events to detect ESC/Cmd+ESC for stop/pause."""
        try:
            # Track Cmd key state
            if key == keyboard.Key.cmd or key == keyboard.Key.cmd_r:
                self._cmd_pressed = True
                return
            
            # Check if ESC key was pressed
            if key == keyboard.Key.esc:
                if self._cmd_pressed:
                    # Cmd+ESC = Pause/Resume
                    sys.stderr.write("[Player] Cmd+ESC pressed - toggling pause\n")
                    sys.stderr.flush()
                    self.toggle_pause()
                    if self.pause_callback:
                        try:
                            self.pause_callback(self.is_paused)
                        except Exception:
                            pass
                else:
                    # ESC only = Stop
                    sys.stderr.write("[Player] ESC pressed - stopping playback\n")
                    sys.stderr.flush()
                    self._stopped_by_esc = True
                    self.stop_playback()
                    if self.stop_callback:
                        try:
                            self.stop_callback()
                        except Exception:
                            pass
        except Exception:
            pass
    
    def _on_key_release(self, key) -> None:
        """Handle key release to track Cmd key state."""
        try:
            if key == keyboard.Key.cmd or key == keyboard.Key.cmd_r:
                self._cmd_pressed = False
        except Exception:
            pass
    
    def toggle_pause(self) -> None:
        """Toggle pause state."""
        self.is_paused = not self.is_paused
        state = "paused" if self.is_paused else "resumed"
        sys.stderr.write(f"[Player] Playback {state}\n")
        sys.stderr.flush()
    
    def pause_playback(self) -> None:
        """Pause playback."""
        self.is_paused = True
        sys.stderr.write("[Player] Playback paused\n")
        sys.stderr.flush()
    
    def resume_playback(self) -> None:
        """Resume playback."""
        self.is_paused = False
        sys.stderr.write("[Player] Playback resumed\n")
        sys.stderr.flush()
    
    # =========================================================================
    # AI Vision Capture Playback Methods
    # Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.11, 4.12
    # =========================================================================
    
    def _get_current_screen_dimensions(self) -> Tuple[int, int]:
        """Get current screen dimensions.
        
        Returns:
            Tuple of (width, height)
        """
        if PYAUTOGUI_AVAILABLE:
            size = pyautogui.size()
            return (size.width, size.height)
        return (1920, 1080)  # Default fallback
    
    def _scale_coordinates(
        self,
        x: int,
        y: int,
        original_dim: Tuple[int, int],
        current_dim: Tuple[int, int]
    ) -> Tuple[int, int]:
        """Scale coordinates proportionally when resolution differs.
        
        Requirements: 4.4, 4.7
        
        Property 3: Coordinate Scaling Proportionality
        For any saved coordinates (x, y) and screen dimensions, when the playback
        screen resolution differs from the recorded resolution, the scaled coordinates
        SHALL be proportional: scaled_x / new_width == original_x / original_width
        
        Args:
            x: Original X coordinate
            y: Original Y coordinate
            original_dim: Original screen dimensions (width, height)
            current_dim: Current screen dimensions (width, height)
            
        Returns:
            Tuple of (scaled_x, scaled_y) clamped to screen bounds
        """
        orig_width, orig_height = original_dim
        curr_width, curr_height = current_dim
        
        # Avoid division by zero
        if orig_width <= 0 or orig_height <= 0:
            return (x, y)
        
        if curr_width <= 0 or curr_height <= 0:
            return (x, y)
        
        # Calculate scale factors
        scale_x = curr_width / orig_width
        scale_y = curr_height / orig_height
        
        # Scale coordinates
        scaled_x = int(round(x * scale_x))
        scaled_y = int(round(y * scale_y))
        
        # Clamp to screen bounds
        scaled_x = max(0, min(scaled_x, curr_width - 1))
        scaled_y = max(0, min(scaled_y, curr_height - 1))
        
        return (scaled_x, scaled_y)
    
    def _execute_interaction(self, x: int, y: int, interaction_type: str) -> None:
        """Execute the specified interaction at the given coordinates.
        
        Requirements: 2.7
        
        Args:
            x: X coordinate
            y: Y coordinate
            interaction_type: One of 'click', 'dblclick', 'rclick', 'hover'
        """
        if not PYAUTOGUI_AVAILABLE:
            sys.stderr.write(f"[Player] PyAutoGUI not available, skipping interaction at ({x}, {y})\n")
            sys.stderr.flush()
            return
        
        if interaction_type == 'click':
            pyautogui.click(x, y, _pause=False)
        elif interaction_type == 'dblclick':
            pyautogui.doubleClick(x, y, _pause=False)
        elif interaction_type == 'rclick':
            pyautogui.rightClick(x, y, _pause=False)
        elif interaction_type == 'hover':
            pyautogui.moveTo(x, y, _pause=False)
        else:
            # Default to click
            pyautogui.click(x, y, _pause=False)
    
    def _has_valid_cache(self, action: Dict[str, Any]) -> bool:
        """Check if action has valid cached coordinates.
        
        Args:
            action: AI Vision Capture action dictionary
            
        Returns:
            True if cache_data contains valid cached_x and cached_y
        """
        cache_data = action.get('cache_data', {})
        if cache_data is None:
            return False
        return cache_data.get('cached_x') is not None and cache_data.get('cached_y') is not None
    
    def _execute_ai_vision_capture(self, action: Dict[str, Any]) -> None:
        """Execute ai_vision_capture action based on mode.
        
        Requirements: 4.1
        
        Property 14: Playback Priority Order
        For any ai_vision_capture action, the Player SHALL check modes in this
        exact order: (1) Static saved_x/y, (2) Dynamic cached_x/y, (3) Dynamic AI call.
        The first valid option SHALL be used.
        
        Priority order:
        1. Static Mode (saved_x/y) - 0 token cost
        2. Dynamic Cache (cached_x/y) - 0 token cost
        3. Dynamic Mode (Call AI) - token cost, then cache result
        
        Args:
            action: AI Vision Capture action dictionary
        """
        is_dynamic = action.get('is_dynamic', False)
        
        if not is_dynamic:
            # Static Mode - use saved coordinates
            sys.stderr.write("[Player] AI Vision: Using Static Mode (saved coordinates)\n")
            sys.stderr.flush()
            self._execute_static_vision(action)
        elif self._has_valid_cache(action):
            # Dynamic Mode with cache - use cached coordinates
            sys.stderr.write("[Player] AI Vision: Using Cached Mode (0 token cost)\n")
            sys.stderr.flush()
            self._execute_cached_vision(action)
        else:
            # Dynamic Mode without cache - call AI
            sys.stderr.write("[Player] AI Vision: Using Dynamic Mode (calling AI)\n")
            sys.stderr.flush()
            self._execute_dynamic_vision(action)
    
    def _execute_static_vision(self, action: Dict[str, Any]) -> None:
        """Execute using static saved coordinates.
        
        Requirements: 4.3, 4.4, 4.12
        
        Property 4: Static Mode Zero AI Calls
        For any ai_vision_capture action with is_dynamic = false and valid saved_x/saved_y,
        playback SHALL execute the interaction at the saved coordinates without making
        any AI API calls.
        
        Args:
            action: AI Vision Capture action dictionary
        """
        static_data = action.get('static_data', {})
        saved_x = static_data.get('saved_x')
        saved_y = static_data.get('saved_y')
        
        # Check if coordinates are missing (Requirement 4.12)
        if saved_x is None or saved_y is None:
            sys.stderr.write(f"[Player] Warning: AI Vision action {action.get('id', 'unknown')} has no saved coordinates, skipping\n")
            sys.stderr.flush()
            return
        
        # Get screen dimensions
        screen_dim = static_data.get('screen_dim', (1920, 1080))
        if isinstance(screen_dim, list):
            screen_dim = tuple(screen_dim)
        
        current_dim = self._get_current_screen_dimensions()
        
        # Apply proportional scaling if resolution differs (Requirement 4.4)
        if screen_dim != current_dim:
            sys.stderr.write(f"[Player] Scaling coordinates from {screen_dim} to {current_dim}\n")
            sys.stderr.flush()
            x, y = self._scale_coordinates(saved_x, saved_y, screen_dim, current_dim)
        else:
            x, y = saved_x, saved_y
        
        # Execute interaction
        interaction_type = action.get('interaction', 'click')
        sys.stderr.write(f"[Player] Executing {interaction_type} at ({x}, {y})\n")
        sys.stderr.flush()
        self._execute_interaction(x, y, interaction_type)
    
    def _execute_cached_vision(self, action: Dict[str, Any]) -> None:
        """Execute using cached coordinates from previous AI call.
        
        Requirements: 4.5
        
        Property 5: Dynamic Cache Zero AI Calls
        For any ai_vision_capture action with is_dynamic = true AND valid cached_x/cached_y,
        playback SHALL execute the interaction at the cached coordinates (with scaling if
        needed) without making any AI API calls.
        
        Args:
            action: AI Vision Capture action dictionary
        """
        cache_data = action.get('cache_data', {})
        cached_x = cache_data.get('cached_x')
        cached_y = cache_data.get('cached_y')
        cache_dim = cache_data.get('cache_dim')
        
        if cached_x is None or cached_y is None:
            # Should not happen if _has_valid_cache was checked, but handle gracefully
            sys.stderr.write("[Player] Warning: Cache data invalid, falling back to dynamic mode\n")
            sys.stderr.flush()
            self._execute_dynamic_vision(action)
            return
        
        # Get current screen dimensions
        current_dim = self._get_current_screen_dimensions()
        
        # Apply scaling using cache_dim if resolution differs
        if cache_dim is not None:
            if isinstance(cache_dim, list):
                cache_dim = tuple(cache_dim)
            
            if cache_dim != current_dim:
                sys.stderr.write(f"[Player] Scaling cached coordinates from {cache_dim} to {current_dim}\n")
                sys.stderr.flush()
                x, y = self._scale_coordinates(cached_x, cached_y, cache_dim, current_dim)
            else:
                x, y = cached_x, cached_y
        else:
            x, y = cached_x, cached_y
        
        # Execute interaction
        interaction_type = action.get('interaction', 'click')
        sys.stderr.write(f"[Player] Executing {interaction_type} at cached ({x}, {y}) - 0 token cost\n")
        sys.stderr.flush()
        self._execute_interaction(x, y, interaction_type)
    
    def _execute_dynamic_vision(self, action: Dict[str, Any]) -> None:
        """Execute using AI to find element on current screen.
        
        Requirements: 4.6, 4.7, 4.8, 4.9, 4.11
        
        Args:
            action: AI Vision Capture action dictionary
        """
        if not AI_VISION_AVAILABLE:
            sys.stderr.write("[Player] Error: AI Vision service not available\n")
            sys.stderr.flush()
            self._clear_cache(action)
            return
        
        # Initialize AI service if needed
        if self._ai_service is None:
            self._ai_service = AIVisionService()
            if self.ai_api_key:
                # Run async initialization in sync context
                asyncio.get_event_loop().run_until_complete(
                    self._ai_service.initialize(self.ai_api_key)
                )
        
        if not self._ai_service.is_initialized():
            sys.stderr.write("[Player] Error: AI Vision service not initialized (no API key)\n")
            sys.stderr.flush()
            self._clear_cache(action)
            return
        
        try:
            # Capture current screenshot
            if not PYAUTOGUI_AVAILABLE:
                sys.stderr.write("[Player] Error: Cannot capture screenshot (PyAutoGUI not available)\n")
                sys.stderr.flush()
                self._clear_cache(action)
                return
            
            screenshot = pyautogui.screenshot()
            
            # Convert to base64
            import io
            import base64
            buffer = io.BytesIO()
            screenshot.save(buffer, format='PNG')
            screenshot_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            # Get dynamic config
            dynamic_config = action.get('dynamic_config', {})
            prompt = dynamic_config.get('prompt', '')
            reference_images = dynamic_config.get('reference_images', [])
            roi = dynamic_config.get('roi')
            search_scope = dynamic_config.get('search_scope', 'global')
            
            # Handle ROI for Regional Search (Requirement 4.7)
            roi_obj = None
            if roi and search_scope == 'regional':
                # Get original screen dimensions
                static_data = action.get('static_data', {})
                original_dim = static_data.get('screen_dim', (1920, 1080))
                if isinstance(original_dim, list):
                    original_dim = tuple(original_dim)
                
                current_dim = self._get_current_screen_dimensions()
                
                # Scale ROI if resolution differs
                if original_dim != current_dim:
                    scaled_roi = scale_roi(
                        roi.get('x', 0),
                        roi.get('y', 0),
                        roi.get('width', 100),
                        roi.get('height', 100),
                        original_dim,
                        current_dim
                    )
                    roi_obj = ServiceVisionROI(
                        x=scaled_roi[0],
                        y=scaled_roi[1],
                        width=scaled_roi[2],
                        height=scaled_roi[3]
                    )
                else:
                    roi_obj = ServiceVisionROI(
                        x=roi.get('x', 0),
                        y=roi.get('y', 0),
                        width=roi.get('width', 100),
                        height=roi.get('height', 100)
                    )
            
            # Create AI request
            request = AIVisionRequest(
                screenshot=screenshot_base64,
                prompt=prompt,
                reference_images=reference_images,
                roi=roi_obj
            )
            
            # Call AI service (Requirement 4.8)
            self._ai_call_count += 1
            sys.stderr.write(f"[Player] Calling AI Vision service (call #{self._ai_call_count})...\n")
            sys.stderr.flush()
            
            # Run async call in sync context
            response = asyncio.get_event_loop().run_until_complete(
                self._ai_service.analyze(request)
            )
            
            if response.success and response.x is not None and response.y is not None:
                # AI found the element
                x, y = response.x, response.y
                
                # Save to cache before executing (Requirement 4.9)
                current_dim = self._get_current_screen_dimensions()
                self._save_to_cache(action, x, y, current_dim)
                
                # Execute interaction
                interaction_type = action.get('interaction', 'click')
                sys.stderr.write(f"[Player] AI found element at ({x}, {y}), executing {interaction_type}\n")
                sys.stderr.flush()
                self._execute_interaction(x, y, interaction_type)
            else:
                # AI failed to find element (Requirement 4.11)
                error_msg = response.error or "Element not found"
                sys.stderr.write(f"[Player] AI Vision failed: {error_msg}\n")
                sys.stderr.flush()
                self._clear_cache(action)
                
        except asyncio.TimeoutError:
            sys.stderr.write(f"[Player] AI Vision timed out\n")
            sys.stderr.flush()
            self._clear_cache(action)
        except Exception as e:
            sys.stderr.write(f"[Player] AI Vision error: {str(e)}\n")
            sys.stderr.flush()
            self._clear_cache(action)
    
    def _save_to_cache(
        self,
        action: Dict[str, Any],
        x: int,
        y: int,
        screen_dim: Tuple[int, int]
    ) -> None:
        """Save AI result to cache for future runs.
        
        Requirements: 4.9, 5.8
        
        Property 7: Cache Persistence After AI Success
        For any successful Dynamic Mode AI call, the returned coordinates SHALL be
        saved to cache_data (cached_x, cached_y, cache_dim) and persisted to the
        script file.
        
        Args:
            action: AI Vision Capture action dictionary
            x: X coordinate from AI
            y: Y coordinate from AI
            screen_dim: Current screen dimensions
        """
        # Update action's cache_data
        if 'cache_data' not in action:
            action['cache_data'] = {}
        
        action['cache_data']['cached_x'] = x
        action['cache_data']['cached_y'] = y
        action['cache_data']['cache_dim'] = list(screen_dim)
        
        sys.stderr.write(f"[Player] Caching AI result: ({x}, {y}) at {screen_dim}\n")
        sys.stderr.flush()
        
        # Persist to script file if path is available
        self._persist_script()
    
    def _clear_cache(self, action: Dict[str, Any]) -> None:
        """Clear cache data after AI failure.
        
        Requirements: 4.11
        
        Property 8: Cache Invalidation On AI Failure
        For any failed Dynamic Mode AI call (error or timeout), any existing
        cache_data SHALL be cleared (cached_x, cached_y set to null).
        
        Args:
            action: AI Vision Capture action dictionary
        """
        if 'cache_data' in action:
            action['cache_data']['cached_x'] = None
            action['cache_data']['cached_y'] = None
            action['cache_data']['cache_dim'] = None
        
        sys.stderr.write("[Player] Cleared cache due to AI failure\n")
        sys.stderr.flush()
        
        # Persist to script file if path is available
        self._persist_script()
    
    def _persist_script(self) -> None:
        """Persist the current script state to file.
        
        Requirements: 5.8
        """
        if not self.script_path:
            return
        
        try:
            # Load current script
            script_path = Path(self.script_path)
            if not script_path.exists():
                return
            
            with open(script_path, 'r', encoding='utf-8') as f:
                script_data = json.load(f)
            
            # Update actions with current state
            # Note: self.actions may be Pydantic models or dicts
            updated_actions = []
            for action in self.actions:
                if hasattr(action, 'model_dump'):
                    updated_actions.append(action.model_dump(mode='json'))
                elif isinstance(action, dict):
                    updated_actions.append(action)
                else:
                    # Try to convert to dict
                    updated_actions.append(dict(action))
            
            script_data['actions'] = updated_actions
            
            # Save back to file
            with open(script_path, 'w', encoding='utf-8') as f:
                json.dump(script_data, f, indent=2, default=str)
            
            sys.stderr.write(f"[Player] Script persisted to {script_path}\n")
            sys.stderr.flush()
            
        except Exception as e:
            sys.stderr.write(f"[Player] Warning: Failed to persist script: {e}\n")
            sys.stderr.flush()
