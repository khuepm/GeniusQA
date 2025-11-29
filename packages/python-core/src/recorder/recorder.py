"""Recorder module for capturing mouse and keyboard events."""

import time
from typing import Optional
from pynput import mouse, keyboard
from storage.models import Action


class Recorder:
    """Captures mouse and keyboard events during recording."""
    
    def __init__(self):
        """Initialize the recorder."""
        self.actions: list[Action] = []
        self.start_time: Optional[float] = None
        self.is_recording: bool = False
        self.mouse_listener: Optional[mouse.Listener] = None
        self.keyboard_listener: Optional[keyboard.Listener] = None
    
    @staticmethod
    def check_dependencies() -> tuple[bool, str]:
        """
        Check if PyAutoGUI and pynput are available.
        
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
        is_available, error_msg = self.check_dependencies()
        if not is_available:
            raise RuntimeError(error_msg)
        
        # Reset state
        self.actions = []
        self.start_time = time.time()
        self.is_recording = True
        
        # Start listeners
        self.mouse_listener = mouse.Listener(
            on_move=self._on_mouse_move,
            on_click=self._on_mouse_click
        )
        self.keyboard_listener = keyboard.Listener(
            on_press=lambda key: self._on_key_event(key, True),
            on_release=lambda key: self._on_key_event(key, False)
        )
        
        self.mouse_listener.start()
        self.keyboard_listener.start()
    
    def stop_recording(self) -> list[Action]:
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
        
        return self.actions
    
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
        self.actions.append(action)
    
    def _on_mouse_click(self, x: int, y: int, button: mouse.Button, pressed: bool) -> None:
        """Callback for mouse clicks."""
        if not self.is_recording or self.start_time is None:
            return
        
        # Only record press events, not release
        if not pressed:
            return
        
        timestamp = time.time() - self.start_time
        
        # Map pynput button to our button format
        button_map = {
            mouse.Button.left: 'left',
            mouse.Button.right: 'right',
            mouse.Button.middle: 'middle'
        }
        button_str = button_map.get(button, 'left')
        
        action = Action(
            type='mouse_click',
            timestamp=timestamp,
            x=x,
            y=y,
            button=button_str
        )
        self.actions.append(action)
    
    def _on_key_event(self, key, pressed: bool) -> None:
        """Callback for keyboard events."""
        if not self.is_recording or self.start_time is None:
            return
        
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
        self.actions.append(action)
