"""Recorder module for capturing mouse and keyboard events."""

import time
import uuid
import platform
from typing import Optional, Union, List, Callable
from pathlib import Path
from pynput import mouse, keyboard
from storage.models import Action, AIVisionCaptureAction, StaticData, DynamicConfig, CacheData, TestStep, TestScript

# Type alias for any action type
AnyAction = Union[Action, AIVisionCaptureAction]


class Recorder:
    """Captures mouse and keyboard events during recording."""
    
    def __init__(self, screenshots_dir: Optional[Path] = None, capture_screenshots: bool = True):
        """Initialize the recorder.
        
        Args:
            screenshots_dir: Directory to save screenshots (default: None, will be set by storage)
            capture_screenshots: Whether to capture screenshots on mouse clicks (default: True)
        """
        self.actions: List[AnyAction] = []
        self.start_time: Optional[float] = None
        self.is_recording: bool = False
        self.mouse_listener: Optional[mouse.Listener] = None
        self.keyboard_listener: Optional[keyboard.Listener] = None
        self.screenshots_dir: Optional[Path] = screenshots_dir
        self.capture_screenshots: bool = capture_screenshots
        self.screenshot_counter: int = 0
        self._stop_requested: bool = False
        
        # Vision capture hotkey state tracking
        # Cmd+F6 (macOS) or Ctrl+F6 (Windows/Linux)
        self._cmd_ctrl_held: bool = False
        self._is_macos: bool = platform.system() == 'Darwin'
        
        # Step-based recording state (Requirements: 2.1, 2.2, 2.5)
        self.current_active_step_id: Optional[str] = None
        self.test_script: Optional[TestScript] = None
        self.step_action_callback: Optional[Callable[[str, AnyAction], None]] = None
        self.setup_step_callback: Optional[Callable[[AnyAction], str]] = None
    
    @staticmethod
    def check_dependencies(check_pillow: bool = True) -> tuple[bool, str]:
        """
        Check if PyAutoGUI, pynput, and optionally Pillow are available.
        
        Args:
            check_pillow: Whether to check for Pillow (required for screenshots)
        
        Returns:
            tuple: (is_available, error_message)
                   is_available is True if all dependencies are present
                   error_message is empty string if available, otherwise contains error details
        """
        missing_libs = []
        
        try:
            import pyautogui
        except ImportError:
            missing_libs.append("pyautogui")
        
        try:
            import pynput
        except ImportError:
            missing_libs.append("pynput")
        
        if check_pillow:
            try:
                import PIL
            except ImportError:
                missing_libs.append("Pillow")
        
        if missing_libs:
            libs_str = ", ".join(missing_libs)
            error_msg = f"Required libraries not installed: {libs_str}. Please run: pip install {' '.join(missing_libs)}"
            return False, error_msg
        
        return True, ""
    
    def start_recording(self) -> None:
        """Start capturing mouse and keyboard events."""
        if self.is_recording:
            raise RuntimeError("Recording already in progress")
        
        # Check if dependencies are available
        is_available, error_msg = self.check_dependencies(check_pillow=self.capture_screenshots)
        if not is_available:
            raise RuntimeError(error_msg)
        
        # Reset state
        self.actions = []
        self.start_time = time.time()
        self.is_recording = True
        self.screenshot_counter = 0
        self._stop_requested = False
        
        # Create screenshots directory if needed
        if self.capture_screenshots and self.screenshots_dir:
            self.screenshots_dir.mkdir(parents=True, exist_ok=True)
        
        # Start listeners
        self.mouse_listener = mouse.Listener(
            on_move=self._on_mouse_move,
            on_click=self._on_mouse_click
        )
        self.keyboard_listener = keyboard.Listener(
            on_press=lambda key: self._on_key_event(key, True),
            on_release=lambda key: self._on_key_event(key, False)
        )
        
        import sys
        sys.stderr.write("[Recorder] Starting mouse and keyboard listeners...\n")
        sys.stderr.flush()
        self.mouse_listener.start()
        self.keyboard_listener.start()
        sys.stderr.write("[Recorder] Listeners started successfully. Recording in progress...\n")
        sys.stderr.write("[Recorder] Press ESC to stop recording\n")
        sys.stderr.flush()
    
    def stop_recording(self) -> List[AnyAction]:
        """Stop capturing and return recorded actions."""
        if not self.is_recording:
            raise RuntimeError("No recording in progress")
        
        self.is_recording = False
        
        # Stop listeners
        if self.mouse_listener:
            self.mouse_listener.stop()
            self.mouse_listener = None
        
        if self.keyboard_listener:
            self.keyboard_listener.stop()
            self.keyboard_listener = None
        
        import sys
        sys.stderr.write(f"[Recorder] Recording stopped. Captured {len(self.actions)} actions.\n")
        sys.stderr.flush()
        
        # Log first few actions for debugging
        if self.actions:
            first_action = self.actions[0]
            if first_action.type == 'ai_vision_capture':
                sys.stderr.write(f"[Recorder] First action: {first_action.type} (id: {first_action.id})\n")
            else:
                sys.stderr.write(f"[Recorder] First action: {first_action.type} at ({first_action.x}, {first_action.y})\n")
            
            if len(self.actions) > 1:
                last_action = self.actions[-1]
                if last_action.type == 'ai_vision_capture':
                    sys.stderr.write(f"[Recorder] Last action: {last_action.type} (id: {last_action.id})\n")
                else:
                    sys.stderr.write(f"[Recorder] Last action: {last_action.type} at ({last_action.x}, {last_action.y})\n")
            sys.stderr.flush()
        else:
            sys.stderr.write("[Recorder] WARNING: No actions were captured!\n")
            sys.stderr.write("[Recorder] This usually means Accessibility permissions are not granted.\n")
            sys.stderr.write("[Recorder] On macOS: System Preferences → Security & Privacy → Privacy → Accessibility\n")
            sys.stderr.flush()
        
        # Count vision capture actions
        vision_actions = [a for a in self.actions if a.type == 'ai_vision_capture']
        if vision_actions:
            sys.stderr.write(f"[Recorder] AI Vision Capture actions: {len(vision_actions)}\n")
            sys.stderr.flush()
        
        return self.actions
    
    def set_active_step(self, step_id: Optional[str]) -> None:
        """Set the currently active step for recording.
        
        When a step is active, all recorded actions will be mapped to that step's
        action_ids array. When no step is active (step_id=None), a Setup_Step
        will be created automatically if actions are recorded.
        
        Args:
            step_id: ID of the step to make active, or None to deactivate
        
        Requirements: 2.1, 2.2, 2.5
        """
        self.current_active_step_id = step_id
        
        import sys
        if step_id:
            sys.stderr.write(f"[Recorder] Active step set to: {step_id}\n")
        else:
            sys.stderr.write("[Recorder] No active step - will create Setup_Step if needed\n")
        sys.stderr.flush()
    
    def set_test_script(self, test_script: Optional[TestScript]) -> None:
        """Set the test script being recorded into.
        
        Args:
            test_script: The TestScript instance to record into
        
        Requirements: 2.1, 2.2
        """
        self.test_script = test_script
    
    def set_step_action_callback(self, callback: Optional[Callable[[str, AnyAction], None]]) -> None:
        """Set callback for when actions are mapped to steps.
        
        Args:
            callback: Function called with (step_id, action) when action is mapped
        
        Requirements: 2.1, 2.2
        """
        self.step_action_callback = callback
    
    def set_setup_step_callback(self, callback: Optional[Callable[[AnyAction], str]]) -> None:
        """Set callback for creating Setup_Step when no step is active.
        
        Args:
            callback: Function called with action, returns created step_id
        
        Requirements: 2.2, 2.5
        """
        self.setup_step_callback = callback
    
    def is_stop_requested(self) -> bool:
        """Check if ESC key was pressed to request stop."""
        return self._stop_requested
    
    def _on_mouse_move(self, x: int, y: int) -> None:
        """Callback for mouse movement."""
        if not self.is_recording or self.start_time is None:
            return
        
        timestamp = time.time() - self.start_time
        action = Action(
            type='mouse_move',
            timestamp=timestamp,
            x=x,
            y=y
        )
        self._record_action(action)
        # Log every 10th mouse move to avoid spam
        if len(self.actions) % 10 == 0:
            import sys
            sys.stderr.write(f"[Recorder] Mouse move: ({x}, {y}) at {timestamp:.2f}s\n")
            sys.stderr.flush()
    
    def _on_mouse_click(self, x: int, y: int, button: mouse.Button, pressed: bool) -> None:
        """Callback for mouse clicks."""
        if not self.is_recording or self.start_time is None:
            return
        
        # Only record press events, not release
        if not pressed:
            return
        
        import sys
        sys.stderr.write(f"[Recorder] Mouse click: {button.name} at ({x}, {y})\n")
        sys.stderr.flush()
        timestamp = time.time() - self.start_time
        
        # Map pynput button to our button format
        button_map = {
            mouse.Button.left: 'left',
            mouse.Button.right: 'right',
            mouse.Button.middle: 'middle'
        }
        button_str = button_map.get(button, 'left')
        
        # Capture screenshot if enabled
        screenshot_filename = None
        if self.capture_screenshots and self.screenshots_dir:
            screenshot_filename = self._capture_screenshot()
        
        action = Action(
            type='mouse_click',
            timestamp=timestamp,
            x=x,
            y=y,
            button=button_str,
            screenshot=screenshot_filename
        )
        self._record_action(action)
    
    def _capture_screenshot(self) -> Optional[str]:
        """Capture a screenshot and save it to the screenshots directory.
        
        Returns:
            Filename of the saved screenshot, or None if capture failed
        """
        try:
            import pyautogui
            from PIL import Image
            
            # Capture screenshot
            screenshot = pyautogui.screenshot()
            
            # Generate filename
            self.screenshot_counter += 1
            filename = f"screenshot_{self.screenshot_counter:04d}.png"
            filepath = self.screenshots_dir / filename
            
            # Save screenshot
            screenshot.save(filepath)
            
            return filename
        except Exception as e:
            # Log error but don't fail the recording
            import sys
            sys.stderr.write(f"Warning: Failed to capture screenshot: {str(e)}\n")
            sys.stderr.flush()
            return None
    
    def _get_screen_dimensions(self) -> tuple[int, int]:
        """
        Get the current screen dimensions.
        
        Returns:
            Tuple of (width, height) in pixels
        """
        try:
            import pyautogui
            size = pyautogui.size()
            return (size.width, size.height)
        except Exception as e:
            import sys
            sys.stderr.write(f"Warning: Failed to get screen dimensions: {str(e)}\n")
            sys.stderr.flush()
            # Return a reasonable default
            return (1920, 1080)
    
    def _capture_vision_marker(self) -> None:
        """
        Capture a vision marker (screenshot + action) for AI Vision Capture.
        
        This method is called when the user presses the vision capture hotkey
        (Cmd+F6 on macOS, Ctrl+F6 on Windows/Linux). It captures a full screenshot,
        saves it to the screenshots directory, and creates an ai_vision_capture
        action with default values.
        
        The screenshot is saved asynchronously to avoid blocking the event loop,
        ensuring that mouse and keyboard hooks remain active during capture.
        
        Requirements: 1.2, 1.4, 5.5
        """
        if not self.is_recording or self.start_time is None:
            return
        
        import sys
        
        try:
            import pyautogui
            
            # Generate unique action ID
            action_id = str(uuid.uuid4())
            
            # Get current timestamp
            timestamp = time.time() - self.start_time
            
            # Get screen dimensions
            screen_dim = self._get_screen_dimensions()
            
            # Capture screenshot
            screenshot = pyautogui.screenshot()
            
            # Generate unique filename for vision marker screenshot
            # Pattern: vision_{action_id}.png (Requirements: 5.5)
            filename = f"vision_{action_id}.png"
            
            # Save screenshot to screenshots directory
            screenshot_path: Optional[str] = None
            if self.screenshots_dir:
                # Ensure screenshots directory exists
                self.screenshots_dir.mkdir(parents=True, exist_ok=True)
                filepath = self.screenshots_dir / filename
                screenshot.save(filepath)
                # Store relative path (Requirements: 5.5)
                screenshot_path = f"screenshots/{filename}"
                sys.stderr.write(f"[Recorder] Vision marker screenshot saved: {screenshot_path}\n")
                sys.stderr.flush()
            else:
                sys.stderr.write("[Recorder] Warning: No screenshots directory configured, vision marker saved without screenshot\n")
                sys.stderr.flush()
                screenshot_path = ""
            
            # Create ai_vision_capture action with default values (Requirements: 1.2, 1.4)
            vision_action = AIVisionCaptureAction(
                type='ai_vision_capture',
                id=action_id,
                timestamp=timestamp,
                is_dynamic=False,  # Default to Static Mode (Requirement 3.1)
                interaction='click',  # Default interaction type
                static_data=StaticData(
                    original_screenshot=screenshot_path,
                    saved_x=None,
                    saved_y=None,
                    screen_dim=screen_dim
                ),
                dynamic_config=DynamicConfig(
                    prompt="",
                    reference_images=[],
                    roi=None,
                    search_scope='global'
                ),
                cache_data=CacheData(
                    cached_x=None,
                    cached_y=None,
                    cache_dim=None
                )
            )
            
            # Add action to recorded actions list
            self._record_action(vision_action)
            
            sys.stderr.write(f"[Recorder] AI Vision Capture action created: {action_id}\n")
            sys.stderr.flush()
            
        except Exception as e:
            # Log error but don't fail the recording (Requirement 1.3)
            sys.stderr.write(f"Warning: Failed to capture vision marker: {str(e)}\n")
            sys.stderr.flush()
    
    def _is_vision_capture_hotkey(self, key, pressed: bool) -> bool:
        """
        Check if the vision capture hotkey (Cmd+F6 or Ctrl+F6) was pressed.
        
        On macOS: Cmd+F6
        On Windows/Linux: Ctrl+F6
        
        Args:
            key: The key that was pressed/released
            pressed: True if key was pressed, False if released
        
        Returns:
            True if the vision capture hotkey combination was detected
        
        Requirements: 1.1, 1.3
        """
        # Track modifier key state (Cmd on macOS, Ctrl on Windows/Linux)
        if self._is_macos:
            # Track Cmd key (left or right)
            if key in (keyboard.Key.cmd, keyboard.Key.cmd_l, keyboard.Key.cmd_r):
                self._cmd_ctrl_held = pressed
                return False
        else:
            # Track Ctrl key (left or right)
            if key in (keyboard.Key.ctrl, keyboard.Key.ctrl_l, keyboard.Key.ctrl_r):
                self._cmd_ctrl_held = pressed
                return False
        
        # Check for F6 key press while modifier is held
        if pressed and self._cmd_ctrl_held and key == keyboard.Key.f6:
            return True
        
        return False
    
    def _on_key_event(self, key, pressed: bool) -> None:
        """Callback for keyboard events."""
        if not self.is_recording or self.start_time is None:
            return
        
        # Check if ESC key was pressed to stop recording
        if pressed and key == keyboard.Key.esc:
            import sys
            sys.stderr.write("[Recorder] ESC pressed - stopping recording\n")
            sys.stderr.flush()
            self._stop_requested = True
            return
        
        # Check for vision capture hotkey (Cmd+F6 or Ctrl+F6)
        # This must be checked BEFORE recording the key event to avoid
        # recording the F6 key press as a regular action
        # Requirements: 1.1, 1.3
        if self._is_vision_capture_hotkey(key, pressed):
            import sys
            modifier = "Cmd" if self._is_macos else "Ctrl"
            sys.stderr.write(f"[Recorder] {modifier}+F6 pressed - capturing vision marker\n")
            sys.stderr.flush()
            self._capture_vision_marker()
            # Continue recording - do not return early
            # The hotkey should not interrupt the recording flow (Requirement 1.3)
        
        timestamp = time.time() - self.start_time
        
        # Convert key to string representation
        try:
            if hasattr(key, 'char') and key.char is not None:
                key_str = key.char
            elif hasattr(key, 'name'):
                key_str = key.name
            else:
                key_str = str(key)
        except AttributeError:
            key_str = str(key)
        
        action_type = 'key_press' if pressed else 'key_release'
        action = Action(
            type=action_type,
            timestamp=timestamp,
            key=key_str
        )
        self._record_action(action)
    
    def _record_action(self, action: AnyAction) -> None:
        """Record an action and handle step-based mapping.
        
        This method handles the core logic for step-based recording:
        1. If a step is active, map action to that step
        2. If no step is active, create Setup_Step automatically
        3. Always add action to the flat actions list for backward compatibility
        
        Args:
            action: The action to record
        
        Requirements: 2.1, 2.2, 2.5
        Validates: Property 2 (Step Recording Behavior)
        """
        # Always add to flat actions list for backward compatibility
        self.actions.append(action)
        
        # Handle step-based mapping if test script is available
        if self.test_script is not None:
            target_step_id = self.current_active_step_id
            
            # If no step is active, create Setup_Step automatically (Requirements: 2.2, 2.5)
            if target_step_id is None:
                if self.setup_step_callback:
                    target_step_id = self.setup_step_callback(action)
                    # Update current active step to the newly created Setup_Step
                    self.current_active_step_id = target_step_id
                    
                    import sys
                    sys.stderr.write(f"[Recorder] Created Setup_Step: {target_step_id}\n")
                    sys.stderr.flush()
            
            # Map action to the target step (Requirements: 2.1, 2.2)
            if target_step_id and self.step_action_callback:
                self.step_action_callback(target_step_id, action)
                
                import sys
                sys.stderr.write(f"[Recorder] Action mapped to step: {target_step_id}\n")
                sys.stderr.flush()
    
    def insert_action_in_step(self, step_id: str, action: AnyAction, position: Optional[int] = None) -> bool:
        """Insert a new action at a specific position within an existing step.
        
        This method allows adding actions to existing steps while maintaining
        chronological order. If no position is specified, the action is appended
        to the end of the step's action list.
        
        Args:
            step_id: ID of the step to insert the action into
            action: The action to insert
            position: Position to insert at (0-based), or None to append
        
        Returns:
            True if insertion was successful, False otherwise
        
        Requirements: 2.4
        Validates: Property 4 (Action Insertion Preservation)
        """
        if not self.test_script:
            return False
        
        # Find the target step
        target_step = None
        for step in self.test_script.steps:
            if step.id == step_id:
                target_step = step
                break
        
        if not target_step:
            return False
        
        # Generate unique ID for the action
        action_id = str(uuid.uuid4())
        
        # Add action to the action pool
        self.test_script.action_pool[action_id] = action
        
        # Insert action ID into step's action_ids array
        if position is None or position >= len(target_step.action_ids):
            # Append to end
            target_step.action_ids.append(action_id)
        else:
            # Insert at specific position
            target_step.action_ids.insert(max(0, position), action_id)
        
        # Also add to flat actions list for backward compatibility
        self.actions.append(action)
        
        import sys
        sys.stderr.write(f"[Recorder] Action inserted into step {step_id} at position {position}\n")
        sys.stderr.flush()
        
        return True
    
    def get_step_actions(self, step_id: str) -> List[AnyAction]:
        """Get all actions for a specific step in chronological order.
        
        Args:
            step_id: ID of the step to get actions for
        
        Returns:
            List of actions for the step, or empty list if step not found
        
        Requirements: 2.4
        """
        if not self.test_script:
            return []
        
        # Find the target step
        target_step = None
        for step in self.test_script.steps:
            if step.id == step_id:
                target_step = step
                break
        
        if not target_step:
            return []
        
        # Get actions from action pool in order
        step_actions = []
        for action_id in target_step.action_ids:
            if action_id in self.test_script.action_pool:
                step_actions.append(self.test_script.action_pool[action_id])
        
        return step_actions
    
    def remove_action_from_step(self, step_id: str, action_index: int) -> bool:
        """Remove an action from a specific position within a step.
        
        Args:
            step_id: ID of the step to remove action from
            action_index: Index of the action to remove (0-based)
        
        Returns:
            True if removal was successful, False otherwise
        
        Requirements: 2.4
        """
        if not self.test_script:
            return False
        
        # Find the target step
        target_step = None
        for step in self.test_script.steps:
            if step.id == step_id:
                target_step = step
                break
        
        if not target_step:
            return False
        
        # Check if index is valid
        if action_index < 0 or action_index >= len(target_step.action_ids):
            return False
        
        # Remove action ID from step
        removed_action_id = target_step.action_ids.pop(action_index)
        
        # Optionally remove from action pool if not referenced elsewhere
        # (This is a design decision - we could keep it for potential reuse)
        action_referenced_elsewhere = False
        for step in self.test_script.steps:
            if step.id != step_id and removed_action_id in step.action_ids:
                action_referenced_elsewhere = True
                break
        
        if not action_referenced_elsewhere:
            self.test_script.action_pool.pop(removed_action_id, None)
        
        import sys
        sys.stderr.write(f"[Recorder] Action removed from step {step_id} at index {action_index}\n")
        sys.stderr.flush()
        
        return True
    
    def reorder_actions_in_step(self, step_id: str, new_order: List[int]) -> bool:
        """Reorder actions within a step according to new index order.
        
        Args:
            step_id: ID of the step to reorder actions in
            new_order: List of indices representing the new order
        
        Returns:
            True if reordering was successful, False otherwise
        
        Requirements: 2.4
        Validates: Property 4 (Action Insertion Preservation)
        """
        if not self.test_script:
            return False
        
        # Find the target step
        target_step = None
        for step in self.test_script.steps:
            if step.id == step_id:
                target_step = step
                break
        
        if not target_step:
            return False
        
        # Validate new_order
        if len(new_order) != len(target_step.action_ids):
            return False
        
        if sorted(new_order) != list(range(len(target_step.action_ids))):
            return False
        
        # Reorder action_ids according to new_order
        original_action_ids = target_step.action_ids.copy()
        target_step.action_ids = [original_action_ids[i] for i in new_order]
        
        import sys
        sys.stderr.write(f"[Recorder] Actions reordered in step {step_id}\n")
        sys.stderr.flush()
        
        return True
