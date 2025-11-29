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
    
    def __init__(self, actions: List):
        """Initialize the player with actions."""
        self.actions = actions
        self.is_playing = False
        self._playback_thread = None
    
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
            for i, action in enumerate(self.actions):
                if not self.is_playing:
                    break
                
                # Execute the current action
                self._execute_action(action)
                
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
        finally:
            self.is_playing = False
    
    def stop_playback(self) -> None:
        """Interrupt playback."""
        self.is_playing = False
        if self._playback_thread and self._playback_thread.is_alive():
            self._playback_thread.join(timeout=1.0)
    
    def _execute_action(self, action) -> None:
        """Execute a single action using PyAutoGUI.
        
        This method can be overridden or mocked for testing.
        """
        if not PYAUTOGUI_AVAILABLE:
            return
        
        action_type = action.type
        
        if action_type == 'mouse_move':
            pyautogui.moveTo(action.x, action.y)
        elif action_type == 'mouse_click':
            pyautogui.click(action.x, action.y, button=action.button)
        elif action_type == 'key_press':
            pyautogui.keyDown(action.key)
        elif action_type == 'key_release':
            pyautogui.keyUp(action.key)
    
    def _calculate_delay(self, current, next_action) -> float:
        """Calculate delay between actions, capped at 5 seconds."""
        delay = next_action.timestamp - current.timestamp
        return min(delay, 5.0)
