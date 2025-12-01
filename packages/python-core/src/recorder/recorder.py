"""Recorder module for capturing mouse and keyboard events."""

import time
from typing import Optional
from pathlib import Path
from pynput import mouse, keyboard
from storage.models import Action


class Recorder:
    """Captures mouse and keyboard events during recording."""
    
    def __init__(self, screenshots_dir: Optional[Path] = None, capture_screenshots: bool = True):
        """Initialize the recorder.
        
        Args:
            screenshots_dir: Directory to save screenshots (default: None, will be set by storage)
            capture_screenshots: Whether to capture screenshots on mouse clicks (default: True)
        """
        self.actions: list[Action] = []
        self.start_time: Optional[float] = None
        self.is_recording: bool = False
        self.mouse_listener: Optional[mouse.Listener] = None
        self.keyboard_listener: Optional[keyboard.Listener] = None
        self.screenshots_dir: Optional[Path] = screenshots_dir
        self.capture_screenshots: bool = capture_screenshots
        self.screenshot_counter: int = 0
        self._stop_requested: bool = False
    
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
        
        import sys
        sys.stderr.write(f"[Recorder] Recording stopped. Captured {len(self.actions)} actions.\n")
        sys.stderr.flush()
        
        # Log first few actions for debugging
        if self.actions:
            sys.stderr.write(f"[Recorder] First action: {self.actions[0].type} at ({self.actions[0].x}, {self.actions[0].y})\n")
            if len(self.actions) > 1:
                sys.stderr.write(f"[Recorder] Last action: {self.actions[-1].type} at ({self.actions[-1].x}, {self.actions[-1].y})\n")
            sys.stderr.flush()
        else:
            sys.stderr.write("[Recorder] WARNING: No actions were captured!\n")
            sys.stderr.write("[Recorder] This usually means Accessibility permissions are not granted.\n")
            sys.stderr.write("[Recorder] On macOS: System Preferences → Security & Privacy → Privacy → Accessibility\n")
            sys.stderr.flush()
        
        return self.actions
    
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
        self.actions.append(action)
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
        self.actions.append(action)
    
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
