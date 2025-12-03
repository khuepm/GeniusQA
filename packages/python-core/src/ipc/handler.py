"""IPC handler for communication with React Native frontend."""

import sys
import json
from pathlib import Path
from typing import Any, Dict, Optional

from recorder.recorder import Recorder
from player.player import Player
from storage.storage import Storage
from storage.models import ScriptFile


class IPCHandler:
    """Handles IPC communication via stdin/stdout."""
    
    def __init__(self):
        """Initialize the IPC handler."""
        self.recorder: Optional[Recorder] = None
        self.player: Optional[Player] = None
        self.storage = Storage()
        self.current_recording_actions = []
    
    def run(self) -> None:
        """Start the IPC message loop reading from stdin."""
        try:
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                
                try:
                    message = json.loads(line)
                    response = self._route_command(message)
                    self._send_response(response)
                except json.JSONDecodeError as e:
                    self._send_error(f"Invalid JSON: {str(e)}")
                except Exception as e:
                    self._send_error(f"Command error: {str(e)}")
                    self._log_error(f"Unexpected error: {str(e)}")
        except KeyboardInterrupt:
            self._log_error("IPC handler interrupted")
        except Exception as e:
            self._log_error(f"Fatal IPC error: {str(e)}")
            raise
    
    def _route_command(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Route incoming command to appropriate handler.
        
        Args:
            message: Parsed JSON message with 'command' and optional 'params'
            
        Returns:
            Response dictionary with 'success' and optional 'data' or 'error'
        """
        command = message.get('command')
        params = message.get('params', {})
        
        if command == 'start_recording':
            return self._handle_start_recording(params)
        elif command == 'stop_recording':
            return self._handle_stop_recording(params)
        elif command == 'start_playback':
            return self._handle_start_playback(params)
        elif command == 'stop_playback':
            return self._handle_stop_playback(params)
        elif command == 'pause_playback':
            return self._handle_pause_playback(params)
        elif command == 'check_recordings':
            return self._handle_check_recordings(params)
        elif command == 'get_latest':
            return self._handle_get_latest(params)
        elif command == 'list_scripts':
            return self._handle_list_scripts(params)
        elif command == 'load_script':
            return self._handle_load_script(params)
        elif command == 'save_script':
            return self._handle_save_script(params)
        elif command == 'delete_script':
            return self._handle_delete_script(params)
        else:
            return {
                'success': False,
                'error': f"Unknown command: {command}"
            }
    
    def _handle_start_recording(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle start_recording command."""
        try:
            # Clean up old recorder if it exists and is not recording
            if self.recorder and not self.recorder.is_recording:
                self.recorder = None
            
            if self.recorder and self.recorder.is_recording:
                return {
                    'success': False,
                    'error': "Recording already in progress"
                }
            
            # Get screenshot capture preference from params (default: True)
            capture_screenshots = params.get('captureScreenshots', True)
            
            # Generate a temporary screenshots directory name
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshots_dir = self.storage.base_dir / f"script_{timestamp}_screenshots"
            
            self.recorder = Recorder(
                screenshots_dir=screenshots_dir if capture_screenshots else None,
                capture_screenshots=capture_screenshots
            )
            self.recorder.start_recording()
            
            # Start a thread to monitor for ESC key press
            import threading
            def monitor_stop_request():
                import time
                while self.recorder and self.recorder.is_recording:
                    if self.recorder.is_stop_requested():
                        # Auto-stop recording
                        try:
                            actions = self.recorder.stop_recording()
                            screenshots_dir = self.recorder.screenshots_dir
                            script_path = self.storage.save_script(actions, screenshots_dir=screenshots_dir)
                            
                            # Calculate duration and screenshot count
                            duration = 0.0
                            screenshot_count = 0
                            if actions:
                                duration = max(action.timestamp for action in actions)
                                screenshot_count = sum(1 for action in actions if action.screenshot is not None)
                            
                            # Emit stop event
                            event = {
                                'type': 'recording_stopped',
                                'data': {
                                    'scriptPath': str(script_path),
                                    'actionCount': len(actions),
                                    'duration': duration,
                                    'screenshotCount': screenshot_count
                                }
                            }
                            self._send_response(event)
                        except Exception as e:
                            self._log_error(f"Failed to auto-stop recording: {str(e)}")
                        break
                    time.sleep(0.1)
            
            threading.Thread(target=monitor_stop_request, daemon=True).start()
            
            return {
                'success': True,
                'data': {'status': 'recording'}
            }
        except PermissionError as e:
            return {
                'success': False,
                'error': self._format_permission_error(str(e))
            }
        except RuntimeError as e:
            # This catches dependency errors from check_dependencies
            return {
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Recording failed: {str(e)}"
            }
    
    def _handle_stop_recording(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle stop_recording command."""
        try:
            if not self.recorder or not self.recorder.is_recording:
                return {
                    'success': False,
                    'error': "No recording in progress"
                }
            
            actions = self.recorder.stop_recording()
            screenshots_dir = self.recorder.screenshots_dir
            script_path = self.storage.save_script(actions, screenshots_dir=screenshots_dir)
            
            # Calculate duration and screenshot count
            duration = 0.0
            screenshot_count = 0
            if actions:
                duration = max(action.timestamp for action in actions)
                screenshot_count = sum(1 for action in actions if action.screenshot is not None)
            
            return {
                'success': True,
                'data': {
                    'scriptPath': str(script_path),
                    'actionCount': len(actions),
                    'duration': duration,
                    'screenshotCount': screenshot_count
                }
            }
        except PermissionError as e:
            return {
                'success': False,
                'error': f"Permission denied: Unable to save recording. Please check file system permissions for the recordings directory."
            }
        except OSError as e:
            return {
                'success': False,
                'error': self._format_filesystem_error(str(e))
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to stop recording: {str(e)}"
            }
    
    def _handle_start_playback(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle start_playback command."""
        try:
            if self.player and self.player.is_playing:
                return {
                    'success': False,
                    'error': "Playback already in progress"
                }
            
            # Get script path from params or use latest
            script_path_str = params.get('scriptPath')
            if script_path_str:
                script_path = Path(script_path_str)
            else:
                script_path = self.storage.get_latest_script()
                if not script_path:
                    return {
                        'success': False,
                        'error': "No recordings found. Please record a session first."
                    }
            
            # Load script
            try:
                script_file = self.storage.load_script(script_path)
            except FileNotFoundError:
                return {
                    'success': False,
                    'error': f"Script file not found: {script_path}. The file may have been moved or deleted."
                }
            except json.JSONDecodeError as e:
                return {
                    'success': False,
                    'error': f"Script file corrupted: Invalid JSON format. The file may be damaged or incomplete."
                }
            except Exception as e:
                error_msg = str(e)
                if "validation" in error_msg.lower():
                    return {
                        'success': False,
                        'error': f"Script file corrupted: File does not match expected format. {error_msg}"
                    }
                return {
                    'success': False,
                    'error': f"Failed to load script: {error_msg}"
                }
            
            # Get variable overrides from params, merge with script defaults
            variables = dict(script_file.variables) if script_file.variables else {}
            variable_overrides = params.get('variables', {})
            variables.update(variable_overrides)
            
            # Get playback speed from params (default: 1.0)
            speed = params.get('speed', 1.0)
            
            # Get loop count from params (default: 1, 0 = infinite)
            loop_count = params.get('loopCount', 1)
            
            # Start playback with progress callback, action callback, variables, speed, and loop count
            self.player = Player(
                script_file.actions, 
                progress_callback=self._emit_progress, 
                action_callback=self._emit_action_preview,
                variables=variables,
                speed=speed,
                loop_count=loop_count,
                stop_callback=self._emit_playback_stopped
            )
            self.player.pause_callback = self._emit_playback_paused
            
            # Start playback - this may raise PermissionError
            self.player.start_playback()
            
            # Monitor completion in a separate thread
            import threading
            def monitor_playback():
                # Wait for playback to complete
                if self.player._playback_thread:
                    self.player._playback_thread.join()
                
                # Emit completion event if playback finished normally (not stopped by ESC)
                if not self.player._stopped_by_esc:
                    self._emit_complete()
            
            threading.Thread(target=monitor_playback, daemon=True).start()
            
            return {
                'success': True,
                'data': {
                    'status': 'playing',
                    'actionCount': len(script_file.actions),
                    'variables': variables
                }
            }
        except PermissionError as e:
            return {
                'success': False,
                'error': self._format_permission_error(str(e))
            }
        except RuntimeError as e:
            return {
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Playback failed: {str(e)}"
            }
    
    def _handle_stop_playback(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle stop_playback command."""
        try:
            if not self.player or not self.player.is_playing:
                return {
                    'success': False,
                    'error': "No playback in progress"
                }
            
            self.player.stop_playback()
            
            return {
                'success': True,
                'data': {'status': 'stopped'}
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _handle_pause_playback(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle pause_playback command."""
        try:
            if not self.player or not self.player.is_playing:
                return {
                    'success': False,
                    'error': "No playback in progress"
                }
            
            self.player.toggle_pause()
            is_paused = self.player.is_paused
            
            return {
                'success': True,
                'data': {
                    'status': 'paused' if is_paused else 'playing',
                    'isPaused': is_paused
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _handle_check_recordings(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle check_recordings command."""
        try:
            scripts = self.storage.list_scripts()
            has_recordings = len(scripts) > 0
            
            return {
                'success': True,
                'data': {
                    'hasRecordings': has_recordings,
                    'count': len(scripts)
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _handle_get_latest(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get_latest command."""
        try:
            latest_script = self.storage.get_latest_script()
            
            if latest_script:
                return {
                    'success': True,
                    'data': {
                        'scriptPath': str(latest_script)
                    }
                }
            else:
                return {
                    'success': True,
                    'data': {
                        'scriptPath': None
                    }
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _send_response(self, response: Dict[str, Any]) -> None:
        """Send JSON response to stdout.
        
        Args:
            response: Response dictionary to send
        """
        try:
            json_str = json.dumps(response)
            sys.stdout.write(json_str + '\n')
            sys.stdout.flush()
        except Exception as e:
            self._log_error(f"Failed to send response: {str(e)}")
    
    def _send_error(self, error_message: str) -> None:
        """Send error response to stdout.
        
        Args:
            error_message: Error message to send
        """
        response = {
            'success': False,
            'error': error_message
        }
        self._send_response(response)
    
    def _log_error(self, message: str) -> None:
        """Log error message to stderr.
        
        Args:
            message: Error message to log
        """
        sys.stderr.write(f"ERROR: {message}\n")
        sys.stderr.flush()
    
    def _emit_progress(self, current: int, total: int, current_loop: int = 1, total_loops: int = 1) -> None:
        """Emit progress event during playback.
        
        Args:
            current: Current action number (1-indexed)
            total: Total number of actions
            current_loop: Current loop iteration (1-indexed)
            total_loops: Total number of loops (0 = infinite)
        """
        event = {
            'type': 'progress',
            'data': {
                'currentAction': current,
                'totalActions': total,
                'currentLoop': current_loop,
                'totalLoops': total_loops
            }
        }
        try:
            json_str = json.dumps(event)
            sys.stdout.write(json_str + '\n')
            sys.stdout.flush()
        except Exception as e:
            self._log_error(f"Failed to emit progress event: {str(e)}")
    
    def _emit_action_preview(self, action, index: int) -> None:
        """Emit action preview event before executing an action.
        
        Args:
            action: The action about to be executed
            index: The index of the action (0-based)
        """
        event = {
            'type': 'action_preview',
            'data': {
                'index': index,
                'action': {
                    'type': action.type,
                    'timestamp': action.timestamp,
                    'x': action.x,
                    'y': action.y,
                    'button': action.button,
                    'key': action.key,
                    'screenshot': action.screenshot
                }
            }
        }
        try:
            json_str = json.dumps(event)
            sys.stdout.write(json_str + '\n')
            sys.stdout.flush()
        except Exception as e:
            self._log_error(f"Failed to emit action preview event: {str(e)}")
    
    def _emit_playback_stopped(self) -> None:
        """Emit playback_stopped event when ESC key is pressed during playback."""
        event = {
            'type': 'playback_stopped',
            'data': {
                'reason': 'esc_key'
            }
        }
        try:
            json_str = json.dumps(event)
            sys.stdout.write(json_str + '\n')
            sys.stdout.flush()
        except Exception as e:
            self._log_error(f"Failed to emit playback_stopped event: {str(e)}")
    
    def _emit_playback_paused(self, is_paused: bool) -> None:
        """Emit playback_paused event when Cmd+ESC is pressed during playback."""
        event = {
            'type': 'playback_paused',
            'data': {
                'isPaused': is_paused
            }
        }
        try:
            json_str = json.dumps(event)
            sys.stdout.write(json_str + '\n')
            sys.stdout.flush()
        except Exception as e:
            self._log_error(f"Failed to emit playback_paused event: {str(e)}")
    
    def _emit_complete(self) -> None:
        """Emit complete event when playback finishes successfully."""
        event = {
            'type': 'complete',
            'data': {
                'completed': True,
                'reason': 'finished'
            }
        }
        try:
            json_str = json.dumps(event)
            sys.stdout.write(json_str + '\n')
            sys.stdout.flush()
        except Exception as e:
            self._log_error(f"Failed to emit complete event: {str(e)}")
    
    def _format_permission_error(self, error_msg: str) -> str:
        """Format permission error with platform-specific guidance.
        
        Args:
            error_msg: Original error message
            
        Returns:
            User-friendly error message with guidance
        """
        import platform
        system = platform.system().lower()
        
        if system == 'darwin':  # macOS
            return (
                "Permission denied: GeniusQA needs Accessibility permissions to record and replay interactions. "
                "Please enable permissions in System Preferences > Security & Privacy > Privacy > Accessibility."
            )
        elif system == 'windows':
            return (
                "Permission denied: GeniusQA may need administrator privileges to record and replay interactions. "
                "Try running the application as administrator."
            )
        elif system == 'linux':
            return (
                "Permission denied: GeniusQA needs permissions to access input devices. "
                "Please ensure your user has the necessary permissions or run with appropriate privileges."
            )
        else:
            return f"Permission denied: {error_msg}. Please check system permissions for input monitoring and automation."
    
    def _format_filesystem_error(self, error_msg: str) -> str:
        """Format file system error with helpful guidance.
        
        Args:
            error_msg: Original error message
            
        Returns:
            User-friendly error message
        """
        error_lower = error_msg.lower()
        
        if 'no space' in error_lower or 'disk full' in error_lower:
            return "File system error: Not enough disk space to save recording. Please free up space and try again."
        elif 'permission' in error_lower or 'access' in error_lower:
            return "File system error: Permission denied. Please check write permissions for the recordings directory."
        elif 'read-only' in error_lower:
            return "File system error: Cannot write to read-only file system. Please check directory permissions."
        else:
            return f"File system error: {error_msg}. Please check directory permissions and available disk space."
    
    def _handle_list_scripts(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle list_scripts command.
        
        Returns a list of all available script files with their metadata.
        """
        try:
            scripts = self.storage.list_scripts()
            script_info = []
            
            for script_path in scripts:
                try:
                    # Load script to get metadata
                    script_file = self.storage.load_script(script_path)
                    script_info.append({
                        'path': str(script_path),
                        'filename': script_path.name,
                        'created_at': script_file.metadata.created_at.isoformat(),
                        'duration': script_file.metadata.duration,
                        'action_count': script_file.metadata.action_count,
                    })
                except Exception as e:
                    # Skip corrupted files
                    self._log_error(f"Failed to load script {script_path}: {str(e)}")
                    continue
            
            return {
                'success': True,
                'data': {
                    'scripts': script_info
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to list scripts: {str(e)}"
            }
    
    def _handle_load_script(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle load_script command.
        
        Loads a specific script file and returns its complete data.
        """
        try:
            script_path_str = params.get('scriptPath')
            if not script_path_str:
                return {
                    'success': False,
                    'error': "Missing required parameter: scriptPath"
                }
            
            script_path = Path(script_path_str)
            
            # Load the script
            try:
                script_file = self.storage.load_script(script_path)
            except FileNotFoundError:
                return {
                    'success': False,
                    'error': f"Script file not found: {script_path.name}"
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'error': f"Script file corrupted: Invalid JSON format"
                }
            except Exception as e:
                return {
                    'success': False,
                    'error': f"Failed to load script: {str(e)}"
                }
            
            # Convert to dict for JSON serialization
            script_dict = {
                'metadata': {
                    'version': script_file.metadata.version,
                    'created_at': script_file.metadata.created_at.isoformat(),
                    'duration': script_file.metadata.duration,
                    'action_count': script_file.metadata.action_count,
                    'platform': script_file.metadata.platform,
                },
                'actions': [action.model_dump() for action in script_file.actions]
            }
            
            return {
                'success': True,
                'data': {
                    'script': script_dict
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to load script: {str(e)}"
            }
    
    def _handle_save_script(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle save_script command.
        
        Saves modified script data back to the file.
        """
        try:
            script_path_str = params.get('scriptPath')
            script_data = params.get('scriptData')
            
            if not script_path_str:
                return {
                    'success': False,
                    'error': "Missing required parameter: scriptPath"
                }
            
            if not script_data:
                return {
                    'success': False,
                    'error': "Missing required parameter: scriptData"
                }
            
            script_path = Path(script_path_str)
            
            # Validate and parse the script data
            try:
                script_file = ScriptFile.model_validate(script_data)
            except Exception as e:
                return {
                    'success': False,
                    'error': f"Invalid script data: {str(e)}"
                }
            
            # Save the script
            try:
                with open(script_path, 'w') as f:
                    json.dump(script_file.model_dump(mode='json'), f, indent=2, default=str)
            except PermissionError:
                return {
                    'success': False,
                    'error': "Permission denied: Unable to save script file"
                }
            except OSError as e:
                return {
                    'success': False,
                    'error': self._format_filesystem_error(str(e))
                }
            
            return {
                'success': True,
                'data': {
                    'scriptPath': str(script_path)
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to save script: {str(e)}"
            }
    
    def _handle_delete_script(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle delete_script command.
        
        Deletes a script file from the recordings directory.
        """
        try:
            script_path_str = params.get('scriptPath')
            
            if not script_path_str:
                return {
                    'success': False,
                    'error': "Missing required parameter: scriptPath"
                }
            
            script_path = Path(script_path_str)
            
            # Check if file exists
            if not script_path.exists():
                return {
                    'success': False,
                    'error': f"Script file not found: {script_path.name}"
                }
            
            # Delete the file
            try:
                script_path.unlink()
            except PermissionError:
                return {
                    'success': False,
                    'error': "Permission denied: Unable to delete script file"
                }
            except OSError as e:
                return {
                    'success': False,
                    'error': self._format_filesystem_error(str(e))
                }
            
            return {
                'success': True,
                'data': {
                    'deleted': str(script_path)
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to delete script: {str(e)}"
            }
