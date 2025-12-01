"""Player module for replaying recorded actions."""

import sys
import time
import threading
from typing import List

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


class Player:
    """Executes recorded actions with timing."""
    
    def __init__(self, actions: List, progress_callback=None, variables=None, action_callback=None, speed=1.0, loop_count=1, stop_callback=None):
        """Initialize the player with actions.
        
        Args:
            actions: List of actions to play back
            progress_callback: Optional callback function(current, total) for progress updates
            variables: Optional dictionary of variable names to values for substitution
            action_callback: Optional callback function(action, index) called before executing each action
            speed: Playback speed multiplier (0.5 = half speed, 2.0 = double speed). Default is 1.0
            loop_count: Number of times to repeat playback (1 = play once, 0 = infinite loop). Default is 1
            stop_callback: Optional callback function() called when playback is stopped by ESC key
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
                    print(f"[Player] Executing action {i+1}/{len(self.actions)}: {action.type} at ({action.x}, {action.y})", flush=True)
                    
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
        """
        if not PYAUTOGUI_AVAILABLE:
            return
        
        action_type = action.type
        
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
