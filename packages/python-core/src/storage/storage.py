"""
Storage module for managing script files.

This module provides the Storage class which handles all file system operations
for recording scripts. It manages the local recordings directory, generates
timestamp-based filenames, serializes/deserializes script files, and provides
utilities for finding and listing recordings.

The Storage class implements automatic directory creation, JSON serialization
with Pydantic models, and comprehensive error handling for file system operations.

Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
"""

import json
import platform
from datetime import datetime
from pathlib import Path
from typing import Optional
from pydantic import ValidationError

from .models import Action, ScriptFile, ScriptMetadata


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
    
    def save_script(self, actions: list[Action]) -> Path:
        """
        Save actions to a JSON file with timestamp-based filename.
        
        Creates a ScriptFile with metadata, serializes it to JSON, and saves it
        to the recordings directory with a unique timestamp-based filename.
        The directory is created automatically if it doesn't exist.
        
        Filename format: script_YYYYMMDD_HHMMSS.json
        Example: script_20240101_120000.json
        
        The saved file includes:
        - Metadata (version, timestamp, duration, action count, platform)
        - Complete list of actions in chronological order
        
        Args:
            actions: List of Action objects to save. Can be empty.
            
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
        
        Requirements: 1.3, 1.4, 6.1, 6.3
        Validates: Property 7 (Recording termination saves file)
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
        
        # Save to file
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(script_file.model_dump(mode='json'), f, indent=2, default=str)
        except PermissionError as e:
            raise PermissionError(f"Cannot write to file {filepath}: {e}")
        except OSError as e:
            raise OSError(f"File system error writing file: {e}")
        
        return filepath
    
    def load_script(self, path: Path) -> ScriptFile:
        """
        Load and validate a script file.
        
        Reads a JSON script file from disk, parses it, and validates it against
        the ScriptFile schema using Pydantic. This ensures the file contains
        valid metadata and actions before playback.
        
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
        
        Requirements: 3.5, 6.2
        Validates: Property 2 (Script file format round-trip consistency)
        Validates: Property 11 (Schema validation rejects invalid files)
        """
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return ScriptFile.model_validate(data)
    
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
        
        Requirements: 3.5, 9.3
        Validates: Property 11 (Schema validation rejects invalid files)
        """
        try:
            ScriptFile.model_validate(data)
            return True, None
        except ValidationError as e:
            return False, str(e)
        except Exception as e:
            return False, f"Validation error: {str(e)}"
