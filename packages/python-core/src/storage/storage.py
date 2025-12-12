"""
Storage module for managing script files.

This module provides the Storage class which handles all file system operations
for recording scripts. It manages the local recordings directory, generates
timestamp-based filenames, serializes/deserializes script files, and provides
utilities for finding and listing recordings.

The Storage class implements automatic directory creation, JSON serialization
with Pydantic models, and comprehensive error handling for file system operations.

Supports AI Vision Capture actions with validation, cache_data persistence,
and automatic assets folder management.

Requirements: 5.5, 5.6, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5
"""

import json
import platform
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Any, Dict
from pydantic import ValidationError

from .models import Action, ScriptFile, ScriptMetadata, AIVisionCaptureAction, AnyAction


class Storage:
    """
    Manages storage and retrieval of script files.
    
    The Storage class provides a high-level interface for saving and loading
    recording scripts. It handles directory management, filename generation,
    JSON serialization, and script file discovery.
    
    All script files are stored in a local directory (default: ~/GeniusQA/recordings/)
    with timestamp-based filenames for uniqueness and chronological ordering.
    
    Attributes:
        base_dir: Path to the directory where script files are stored
    
    Examples:
        >>> storage = Storage()
        >>> actions = [Action(...), Action(...)]
        >>> path = storage.save_script(actions)
        >>> script = storage.load_script(path)
        >>> latest = storage.get_latest_script()
    
    Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
    Validates: Property 7 (Recording termination saves file)
    Validates: Property 8 (Storage directory auto-creation)
    Validates: Property 9 (Latest recording identification)
    """
    
    def __init__(self, base_dir: Optional[Path] = None):
        """
        Initialize storage with base directory.
        
        Creates a Storage instance configured to use the specified directory
        for storing script files. If no directory is provided, uses the default
        location in the user's home directory.
        
        The directory is not created until the first save operation.
        
        Args:
            base_dir: Base directory for storing scripts. If None, defaults to
                ~/GeniusQA/recordings/
        
        Examples:
            >>> storage = Storage()  # Use default directory
            >>> storage = Storage(Path("/custom/path"))  # Use custom directory
        """
        if base_dir is None:
            base_dir = Path.home() / "GeniusQA" / "recordings"
        self.base_dir = Path(base_dir)
    
    def get_screenshots_dir(self, script_name: str) -> Path:
        """
        Get the screenshots directory for a specific script.
        
        Args:
            script_name: Name of the script file (without extension)
            
        Returns:
            Path to the screenshots directory for this script
        """
        return self.base_dir / f"{script_name}_screenshots"
    
    def _ensure_directory_exists(self) -> None:
        """
        Create the storage directory if it doesn't exist.
        
        Creates the base directory and any necessary parent directories.
        Uses exist_ok=True to avoid errors if the directory already exists.
        
        This method is called automatically by save_script() to ensure the
        directory exists before attempting to write files.
        
        Raises:
            PermissionError: If insufficient permissions to create directory
            OSError: If file system error occurs
        
        Requirements: 6.2
        Validates: Property 8 (Storage directory auto-creation)
        """
        self.base_dir.mkdir(parents=True, exist_ok=True)
    
    def _ensure_assets_folder_exists(self, script_path: Path) -> None:
        """
        Ensure the assets folder exists for a script file.
        
        Creates the ./assets/ subdirectory relative to the script file
        if it doesn't exist. This is used when loading scripts with
        ai_vision_capture actions to ensure reference images can be loaded.
        
        Args:
            script_path: Path to the script file
            
        Requirements: 5.5
        """
        assets_dir = script_path.parent / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)
    
    def _validate_ai_vision_capture_action(self, action_data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate an ai_vision_capture action dictionary.
        
        Checks that all required fields are present and have valid types/values.
        This is used during script loading to ensure data integrity.
        
        Args:
            action_data: Dictionary containing action data
            
        Returns:
            Tuple of (is_valid, error_message) where:
            - is_valid: True if validation succeeded, False otherwise
            - error_message: None if valid, error description string if invalid
            
        Requirements: 5.6
        """
        try:
            # Required fields
            required_fields = ['type', 'id', 'timestamp', 'static_data']
            for field in required_fields:
                if field not in action_data:
                    return False, f"Missing required field: {field}"
            
            # Validate type
            if action_data.get('type') != 'ai_vision_capture':
                return False, f"Invalid action type: {action_data.get('type')}"
            
            # Validate static_data
            static_data = action_data.get('static_data', {})
            if not isinstance(static_data, dict):
                return False, "static_data must be a dictionary"
            
            if 'original_screenshot' not in static_data:
                return False, "static_data.original_screenshot is required"
            
            if 'screen_dim' not in static_data:
                return False, "static_data.screen_dim is required"
            
            screen_dim = static_data.get('screen_dim')
            if not isinstance(screen_dim, (list, tuple)) or len(screen_dim) != 2:
                return False, "static_data.screen_dim must be [width, height]"
            
            # Validate dynamic_config if present
            dynamic_config = action_data.get('dynamic_config', {})
            if dynamic_config:
                if not isinstance(dynamic_config, dict):
                    return False, "dynamic_config must be a dictionary"
                
                # Validate ROI if present
                roi = dynamic_config.get('roi')
                if roi is not None:
                    if not isinstance(roi, dict):
                        return False, "dynamic_config.roi must be a dictionary"
                    roi_fields = ['x', 'y', 'width', 'height']
                    for field in roi_fields:
                        if field not in roi:
                            return False, f"dynamic_config.roi.{field} is required"
                        if not isinstance(roi[field], (int, float)):
                            return False, f"dynamic_config.roi.{field} must be a number"
                
                # Validate search_scope if present
                search_scope = dynamic_config.get('search_scope')
                if search_scope is not None and search_scope not in ['global', 'regional']:
                    return False, f"Invalid search_scope: {search_scope}"
            
            # Validate cache_data if present
            cache_data = action_data.get('cache_data', {})
            if cache_data:
                if not isinstance(cache_data, dict):
                    return False, "cache_data must be a dictionary"
                
                cache_dim = cache_data.get('cache_dim')
                if cache_dim is not None:
                    if not isinstance(cache_dim, (list, tuple)) or len(cache_dim) != 2:
                        return False, "cache_data.cache_dim must be [width, height]"
            
            # Validate interaction type if present
            interaction = action_data.get('interaction', 'click')
            if interaction not in ['click', 'dblclick', 'rclick', 'hover']:
                return False, f"Invalid interaction type: {interaction}"
            
            # Use Pydantic model for full validation
            AIVisionCaptureAction.model_validate(action_data)
            
            return True, None
            
        except ValidationError as e:
            return False, str(e)
        except Exception as e:
            return False, f"Validation error: {str(e)}"
    
    def _has_ai_vision_capture_actions(self, actions: List[AnyAction]) -> bool:
        """
        Check if the action list contains any ai_vision_capture actions.
        
        Args:
            actions: List of actions to check
            
        Returns:
            True if any ai_vision_capture actions are present
        """
        for action in actions:
            if isinstance(action, AIVisionCaptureAction):
                return True
            if isinstance(action, dict) and action.get('type') == 'ai_vision_capture':
                return True
        return False
    
    def save_script(self, actions: list[AnyAction], screenshots_dir: Optional[Path] = None) -> Path:
        """
        Save actions to a JSON file with timestamp-based filename.
        
        Creates a ScriptFile with metadata, serializes it to JSON, and saves it
        to the recordings directory with a unique timestamp-based filename.
        The directory is created automatically if it doesn't exist.
        
        For scripts containing ai_vision_capture actions, the assets folder
        is created automatically to store reference images.
        
        Filename format: script_YYYYMMDD_HHMMSS.json
        Example: script_20240101_120000.json
        
        The saved file includes:
        - Metadata (version, timestamp, duration, action count, platform)
        - Complete list of actions in chronological order
        - cache_data for ai_vision_capture actions (persisted for future runs)
        
        Args:
            actions: List of Action or AIVisionCaptureAction objects to save. Can be empty.
            screenshots_dir: Optional path to screenshots directory (for cleanup if save fails)
            
        Returns:
            Path object pointing to the saved script file
            
        Raises:
            PermissionError: If directory cannot be created or file cannot be written
            OSError: If file system error occurs (disk full, etc.)
        
        Examples:
            >>> storage = Storage()
            >>> actions = [
            ...     Action(type='mouse_click', timestamp=0.5, x=100, y=200, button='left'),
            ...     Action(type='key_press', timestamp=1.0, key='a')
            ... ]
            >>> path = storage.save_script(actions)
            >>> print(path)
            /Users/name/GeniusQA/recordings/script_20240101_120000.json
        
        Requirements: 1.3, 1.4, 5.5, 5.8, 6.1, 6.3
        Validates: Property 7 (Recording termination saves file)
        Validates: Property 7 (Cache Persistence After AI Success)
        """
        try:
            self._ensure_directory_exists()
        except PermissionError as e:
            raise PermissionError(f"Cannot create recordings directory: {e}")
        except OSError as e:
            raise OSError(f"File system error creating directory: {e}")
        
        # Calculate duration from actions
        duration = 0.0
        if actions:
            duration = max(action.timestamp for action in actions)
        
        # Create metadata
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=duration,
            action_count=len(actions),
            platform=platform.system().lower()
        )
        
        # Create script file
        script_file = ScriptFile(metadata=metadata, actions=actions)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"script_{timestamp}.json"
        filepath = self.base_dir / filename
        
        # Ensure assets folder exists if we have ai_vision_capture actions
        if self._has_ai_vision_capture_actions(actions):
            self._ensure_assets_folder_exists(filepath)
        
        # Save to file (cache_data is automatically included via model_dump)
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(script_file.model_dump(mode='json'), f, indent=2, default=str)
        except PermissionError as e:
            raise PermissionError(f"Cannot write to file {filepath}: {e}")
        except OSError as e:
            raise OSError(f"File system error writing file: {e}")
        
        return filepath
    
    def save_script_to_path(self, actions: list[AnyAction], filepath: Path) -> Path:
        """
        Save actions to a specific file path.
        
        Similar to save_script but saves to a specified path instead of
        generating a timestamp-based filename. Useful for updating existing
        scripts with new cache_data after successful AI calls.
        
        Args:
            actions: List of Action or AIVisionCaptureAction objects to save
            filepath: Path where the script should be saved
            
        Returns:
            Path object pointing to the saved script file
            
        Raises:
            PermissionError: If file cannot be written
            OSError: If file system error occurs
        
        Requirements: 5.8
        Validates: Property 7 (Cache Persistence After AI Success)
        """
        # Ensure parent directory exists
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        # Calculate duration from actions
        duration = 0.0
        if actions:
            duration = max(action.timestamp for action in actions)
        
        # Create metadata
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=duration,
            action_count=len(actions),
            platform=platform.system().lower()
        )
        
        # Create script file
        script_file = ScriptFile(metadata=metadata, actions=actions)
        
        # Ensure assets folder exists if we have ai_vision_capture actions
        if self._has_ai_vision_capture_actions(actions):
            self._ensure_assets_folder_exists(filepath)
        
        # Save to file
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(script_file.model_dump(mode='json'), f, indent=2, default=str)
        except PermissionError as e:
            raise PermissionError(f"Cannot write to file {filepath}: {e}")
        except OSError as e:
            raise OSError(f"File system error writing file: {e}")
        
        return filepath
    
    def update_action_cache(
        self, 
        script_path: Path, 
        action_id: str, 
        cached_x: int, 
        cached_y: int, 
        cache_dim: tuple[int, int]
    ) -> bool:
        """
        Update cache_data for a specific ai_vision_capture action.
        
        Loads the script, finds the action by ID, updates its cache_data,
        and saves the script back to disk. This is used after a successful
        Dynamic Mode AI call to persist the cache for future runs.
        
        Args:
            script_path: Path to the script file
            action_id: ID of the action to update
            cached_x: X coordinate to cache
            cached_y: Y coordinate to cache
            cache_dim: Screen dimensions when cache was created
            
        Returns:
            True if update was successful, False otherwise
            
        Requirements: 5.8
        Validates: Property 7 (Cache Persistence After AI Success)
        """
        try:
            # Load the script
            script = self.load_script(script_path)
            
            # Find and update the action
            updated = False
            for i, action in enumerate(script.actions):
                if isinstance(action, AIVisionCaptureAction) and action.id == action_id:
                    # Update cache_data
                    action.cache_data.cached_x = cached_x
                    action.cache_data.cached_y = cached_y
                    action.cache_data.cache_dim = cache_dim
                    updated = True
                    break
            
            if not updated:
                return False
            
            # Save the updated script
            self.save_script_to_path(script.actions, script_path)
            return True
            
        except Exception:
            return False
    
    def clear_action_cache(self, script_path: Path, action_id: str) -> bool:
        """
        Clear cache_data for a specific ai_vision_capture action.
        
        Loads the script, finds the action by ID, clears its cache_data,
        and saves the script back to disk. This is used after a failed
        Dynamic Mode AI call to ensure fresh search on next run.
        
        Args:
            script_path: Path to the script file
            action_id: ID of the action to update
            
        Returns:
            True if update was successful, False otherwise
            
        Requirements: 4.11
        Validates: Property 8 (Cache Invalidation On AI Failure)
        """
        try:
            # Load the script
            script = self.load_script(script_path)
            
            # Find and update the action
            updated = False
            for i, action in enumerate(script.actions):
                if isinstance(action, AIVisionCaptureAction) and action.id == action_id:
                    # Clear cache_data
                    action.cache_data.cached_x = None
                    action.cache_data.cached_y = None
                    action.cache_data.cache_dim = None
                    updated = True
                    break
            
            if not updated:
                return False
            
            # Save the updated script
            self.save_script_to_path(script.actions, script_path)
            return True
            
        except Exception:
            return False
    
    def load_script(self, path: Path) -> ScriptFile:
        """
        Load and validate a script file.
        
        Reads a JSON script file from disk, parses it, and validates it against
        the ScriptFile schema using Pydantic. This ensures the file contains
        valid metadata and actions before playback.
        
        For scripts containing ai_vision_capture actions:
        - Validates all ai_vision_capture actions
        - Ensures the assets folder exists for reference images
        
        Args:
            path: Path object pointing to the script file to load
            
        Returns:
            Validated ScriptFile object containing metadata and actions
            
        Raises:
            FileNotFoundError: If the specified file doesn't exist
            PermissionError: If insufficient permissions to read the file
            json.JSONDecodeError: If file contains invalid JSON
            ValidationError: If file doesn't match the ScriptFile schema
        
        Examples:
            >>> storage = Storage()
            >>> script = storage.load_script(Path("~/GeniusQA/recordings/script_20240101_120000.json"))
            >>> print(f"Loaded {script.metadata.action_count} actions")
        
        Requirements: 3.5, 5.5, 5.6, 6.2
        Validates: Property 2 (Script file format round-trip consistency)
        Validates: Property 11 (Schema validation rejects invalid files)
        """
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Validate ai_vision_capture actions before full validation
        actions = data.get('actions', [])
        for action_data in actions:
            if action_data.get('type') == 'ai_vision_capture':
                is_valid, error = self._validate_ai_vision_capture_action(action_data)
                if not is_valid:
                    raise ValidationError.from_exception_data(
                        title='AIVisionCaptureAction',
                        line_errors=[{
                            'type': 'value_error',
                            'loc': ('actions',),
                            'msg': error or 'Invalid ai_vision_capture action',
                            'input': action_data
                        }]
                    )
        
        # Parse and validate the full script
        script = ScriptFile.model_validate(data)
        
        # Ensure assets folder exists if we have ai_vision_capture actions
        if self._has_ai_vision_capture_actions(script.actions):
            self._ensure_assets_folder_exists(path)
        
        return script
    
    def get_latest_script(self) -> Optional[Path]:
        """
        Find the most recent script file.
        
        Searches the recordings directory for script files and returns the path
        to the one with the most recent modification time. This is used to
        determine which recording to play when no specific path is provided.
        
        Returns:
            Path to the latest script file, or None if no scripts exist or
            directory doesn't exist
        
        Examples:
            >>> storage = Storage()
            >>> latest = storage.get_latest_script()
            >>> if latest:
            ...     print(f"Latest recording: {latest.name}")
            ... else:
            ...     print("No recordings found")
        
        Requirements: 6.5
        Validates: Property 9 (Latest recording identification)
        """
        if not self.base_dir.exists():
            return None
        
        script_files = list(self.base_dir.glob("script_*.json"))
        if not script_files:
            return None
        
        # Sort by modification time, most recent first
        script_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return script_files[0]
    
    def list_scripts(self) -> list[Path]:
        """
        List all script files in the storage directory.
        
        Finds all JSON files matching the script filename pattern (script_*.json)
        and returns them sorted by modification time with newest first.
        
        Returns:
            List of Path objects pointing to script files, sorted by modification
            time (newest first). Returns empty list if directory doesn't exist or
            contains no scripts.
        
        Examples:
            >>> storage = Storage()
            >>> scripts = storage.list_scripts()
            >>> for script in scripts:
            ...     print(script.name)
            script_20240101_150000.json
            script_20240101_120000.json
            script_20240101_100000.json
        
        Requirements: 6.4
        """
        if not self.base_dir.exists():
            return []
        
        script_files = list(self.base_dir.glob("script_*.json"))
        script_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return script_files
    
    def validate_script(self, data: dict) -> tuple[bool, Optional[str]]:
        """
        Validate a script file dictionary against the schema.
        
        Attempts to validate a dictionary representation of a script file using
        the Pydantic ScriptFile model. This is useful for checking if a loaded
        JSON file is valid before attempting to use it.
        
        For scripts containing ai_vision_capture actions, performs additional
        validation of the action structure and required fields.
        
        Args:
            data: Dictionary containing script data (typically from json.load())
            
        Returns:
            Tuple of (is_valid, error_message) where:
            - is_valid: True if validation succeeded, False otherwise
            - error_message: None if valid, error description string if invalid
        
        Examples:
            >>> storage = Storage()
            >>> with open('script.json') as f:
            ...     data = json.load(f)
            >>> is_valid, error = storage.validate_script(data)
            >>> if not is_valid:
            ...     print(f"Invalid script: {error}")
        
        Requirements: 3.5, 5.6, 9.3
        Validates: Property 11 (Schema validation rejects invalid files)
        """
        try:
            # Validate ai_vision_capture actions first
            actions = data.get('actions', [])
            for i, action_data in enumerate(actions):
                if action_data.get('type') == 'ai_vision_capture':
                    is_valid, error = self._validate_ai_vision_capture_action(action_data)
                    if not is_valid:
                        return False, f"Invalid ai_vision_capture action at index {i}: {error}"
            
            # Full schema validation
            ScriptFile.model_validate(data)
            return True, None
        except ValidationError as e:
            return False, str(e)
        except Exception as e:
            return False, f"Validation error: {str(e)}"
