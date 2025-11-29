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
        elif command == 'check_recordings':
            return self._handle_check_recordings(params)
        elif command == 'get_latest':
            return self._handle_get_latest(params)
        else:
            return {
                'success': False,
                'error': f"Unknown command: {command}"
            }
    
    def _handle_start_recording(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle start_recording command."""
        try:
            if self.recorder and self.recorder.is_recording:
                return {
                    'success': False,
                    'error': "Recording already in progress"
                }
            
            self.recorder = Recorder()
            self.recorder.start_recording()
            
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
            script_path = self.storage.save_script(actions)
            
            # Calculate duration
            duration = 0.0
            if actions:
                duration = max(action.timestamp for action in actions)
            
            return {
                'success': True,
                'data': {
                    'scriptPath': str(script_path),
                    'actionCount': len(actions),
                    'duration': duration
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
            
            # Start playback with progress callback
            self.player = Player(script_file.actions, progress_callback=self._emit_progress)
            self.player.start_playback()
            
            return {
                'success': True,
                'data': {
                    'status': 'playing',
                    'actionCount': len(script_file.actions)
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
    
    def _emit_progress(self, current: int, total: int) -> None:
        """Emit progress event during playback.
        
        Args:
            current: Current action number (1-indexed)
            total: Total number of actions
        """
        event = {
            'type': 'progress',
            'data': {
                'currentAction': current,
                'totalActions': total
            }
        }
        try:
            json_str = json.dumps(event)
            sys.stdout.write(json_str + '\n')
            sys.stdout.flush()
        except Exception as e:
            self._log_error(f"Failed to emit progress event: {str(e)}")
    
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
