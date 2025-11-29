"""Storage module for managing script files."""

import json
import platform
from datetime import datetime
from pathlib import Path
from typing import Optional
from pydantic import ValidationError

from .models import Action, ScriptFile, ScriptMetadata


class Storage:
    """Manages storage and retrieval of script files."""
    
    def __init__(self, base_dir: Optional[Path] = None):
        """Initialize storage with base directory.
        
        Args:
            base_dir: Base directory for storing scripts. Defaults to ~/GeniusQA/recordings
        """
        if base_dir is None:
            base_dir = Path.home() / "GeniusQA" / "recordings"
        self.base_dir = Path(base_dir)
    
    def _ensure_directory_exists(self) -> None:
        """Create the storage directory if it doesn't exist."""
        self.base_dir.mkdir(parents=True, exist_ok=True)
    
    def save_script(self, actions: list[Action]) -> Path:
        """Save actions to a JSON file with timestamp-based filename.
        
        Args:
            actions: List of actions to save
            
        Returns:
            Path to the saved script file
            
        Raises:
            IOError: If file cannot be written
        """
        self._ensure_directory_exists()
        
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
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(script_file.model_dump(mode='json'), f, indent=2, default=str)
        
        return filepath
    
    def load_script(self, path: Path) -> ScriptFile:
        """Load and validate a script file.
        
        Args:
            path: Path to the script file
            
        Returns:
            Validated ScriptFile object
            
        Raises:
            FileNotFoundError: If file doesn't exist
            ValidationError: If file doesn't match schema
            json.JSONDecodeError: If file is not valid JSON
        """
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return ScriptFile.model_validate(data)
    
    def get_latest_script(self) -> Optional[Path]:
        """Find the most recent script file.
        
        Returns:
            Path to the latest script file, or None if no scripts exist
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
        """List all script files in the storage directory.
        
        Returns:
            List of paths to script files, sorted by modification time (newest first)
        """
        if not self.base_dir.exists():
            return []
        
        script_files = list(self.base_dir.glob("script_*.json"))
        script_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return script_files
    
    def validate_script(self, data: dict) -> tuple[bool, Optional[str]]:
        """Validate a script file dictionary against the schema.
        
        Args:
            data: Dictionary containing script data
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            ScriptFile.model_validate(data)
            return True, None
        except ValidationError as e:
            return False, str(e)
        except Exception as e:
            return False, f"Validation error: {str(e)}"
