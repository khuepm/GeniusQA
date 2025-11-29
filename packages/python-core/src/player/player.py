"""Player module for replaying recorded actions."""

import time
import threading
from typing import List

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False


class Player:
    """Executes recorded actions with timing."""
    
    def __init__(self, actions: List, progress_callback=None, variables=None, action_callback=None, speed=1.0, loop_count=1):
        """Initialize the player with actions.
        
        Args:
            actions: List of actions to play back
            progress_callback: Optional callback function(current, total) for progress updates
            variables: Optional dictionary of variable names to values for substitution
            action_callback: Optional callback function(action, index) called before executing each action
            speed: Playback speed multiplier (0.5 = half speed, 2.0 = double speed). Default is 1.0
            loop_count: Number of times to repeat playback (1 = play once, 0 = infinite loop). Default is 1
        """
        self.actions = actions
        self.is_playing = False
        self._playback_thread = None
        self.progress_callback = progress_callback
        self.action_callback = action_callback
        self.variables = variables or {}
        self.speed = max(0.1, min(10.0, speed))  # Clamp speed between 0.1x and 10x
        self.loop_count = max(0, loop_count)  # 0 means infinite loop
        self.current_loop = 0
    
    def start_playback(self) -> None:
        """Execute actions with timing in a separate thread."""
        if self.is_playing:
            raise RuntimeError("Playback already in progress")
        
        self.is_playing = True
        self._playback_thread = threading.Thread(target=self._playback_loop)
        self._playback_thread.start()
    
    def _playback_loop(self) -> None:
        """Internal playback loop that executes actions with timing."""
        try:
            # Determine number of iterations
            iterations = float('inf') if self.loop_count == 0 else self.loop_count
            self.current_loop = 0
            
            while self.current_loop < iterations and self.is_playing:
                for i, action in enumerate(self.actions):
                    if not self.is_playing:
                        break
                    
                    # Notify about the action before executing it
                    if self.action_callback:
                        try:
                            self.action_callback(action, i)
                        except Exception:
                            # Don't let callback errors stop playback
                            pass
                    
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
                        
                        # Sleep in small increments to allow interruption
                        elapsed = 0.0
                        sleep_increment = 0.01  # 10ms increments
                        while elapsed < delay and self.is_playing:
                            time.sleep(min(sleep_increment, delay - elapsed))
                            elapsed += sleep_increment
                
                # Increment loop counter
                self.current_loop += 1
                
                # If not the last iteration and still playing, add a small delay between loops
                if self.current_loop < iterations and self.is_playing:
                    time.sleep(0.5)  # 500ms delay between loops
        finally:
            self.is_playing = False
    
    def stop_playback(self) -> None:
        """Interrupt playback."""
        self.is_playing = False
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
        """
        if not PYAUTOGUI_AVAILABLE:
            return
        
        action_type = action.type
        
        if action_type == 'mouse_move':
            pyautogui.moveTo(action.x, action.y)
        elif action_type == 'mouse_click':
            pyautogui.click(action.x, action.y, button=action.button)
        elif action_type == 'key_press':
            # Apply variable substitution to key values
            key = self._substitute_variables(action.key) if action.key else action.key
            pyautogui.keyDown(key)
        elif action_type == 'key_release':
            # Apply variable substitution to key values
            key = self._substitute_variables(action.key) if action.key else action.key
            pyautogui.keyUp(key)
    
    def _calculate_delay(self, current, next_action) -> float:
        """Calculate delay between actions, capped at 5 seconds, adjusted by speed."""
        delay = next_action.timestamp - current.timestamp
        capped_delay = min(delay, 5.0)
        # Apply speed multiplier (higher speed = shorter delay)
        return capped_delay / self.speed
