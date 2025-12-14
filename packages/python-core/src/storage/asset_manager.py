"""
Asset Manager for AI Vision Capture.

Manages storage and retrieval of reference images for AI Vision Capture.
Handles cross-platform path normalization and unique filename generation.

Requirements: 5.5, 5.9, 5.10, 5.11, 2.6
"""

import base64
import os
import time
import uuid
import re
from pathlib import Path
from typing import Optional, Tuple, Union


# =============================================================================
# Path Normalization Utilities (Requirements: 5.9, 5.10)
# =============================================================================

def to_posix_path(path: str) -> str:
    """
    Convert any path to POSIX format (forward slashes).
    Used for storing paths in script JSON regardless of OS.
    
    Requirements: 5.9
    
    Args:
        path: Path with any separator style
        
    Returns:
        Path with forward slashes only
        
    Examples:
        >>> to_posix_path("assets\\\\image.png")
        'assets/image.png'
        >>> to_posix_path("assets/image.png")
        'assets/image.png'
    """
    return path.replace('\\', '/')


def to_native_path(posix_path: str) -> str:
    """
    Convert POSIX path to OS-native format.
    Used when loading paths from script JSON for file operations.
    
    Requirements: 5.10
    
    Args:
        posix_path: Path with forward slashes
        
    Returns:
        Path with OS-native separators
        
    Examples:
        >>> # On Windows:
        >>> to_native_path("assets/image.png")
        'assets\\\\image.png'
        >>> # On Unix:
        >>> to_native_path("assets/image.png")
        'assets/image.png'
    """
    if os.name == 'nt':  # Windows
        return posix_path.replace('/', '\\')
    return posix_path


def generate_unique_filename(action_id: str, extension: str) -> str:
    """
    Generate a unique filename for reference images.
    Pattern: vision_{action_id}_{timestamp}.{extension}
    
    Requirements: 5.11
    
    Args:
        action_id: UUID of the action
        extension: File extension (e.g., 'png', 'jpg')
        
    Returns:
        Unique filename
        
    Examples:
        >>> filename = generate_unique_filename("abc123", "png")
        >>> filename.startswith("vision_abc123_")
        True
        >>> filename.endswith(".png")
        True
    """
    # Get current timestamp in milliseconds
    timestamp = int(time.time() * 1000)
    
    # Sanitize action_id to remove any invalid characters
    sanitized_id = re.sub(r'[^a-zA-Z0-9-]', '', action_id)
    
    # Sanitize extension to remove leading dot if present
    sanitized_ext = extension.lstrip('.').lower()
    
    return f"vision_{sanitized_id}_{timestamp}.{sanitized_ext}"


def get_extension(input_str: str) -> str:
    """
    Extract file extension from a filename or MIME type.
    
    Args:
        input_str: Filename, path, or MIME type
        
    Returns:
        File extension without dot (e.g., 'png')
        
    Examples:
        >>> get_extension("image/png")
        'png'
        >>> get_extension("photo.jpg")
        'jpg'
        >>> get_extension("path/to/image.PNG")
        'png'
    """
    # Check if it's a MIME type
    if '/' in input_str:
        mime_map = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
        }
        return mime_map.get(input_str.lower(), 'png')
    
    # Extract from filename/path
    match = re.search(r'\.([a-zA-Z0-9]+)$', input_str)
    return match.group(1).lower() if match else 'png'


# =============================================================================
# Asset Manager Class (Requirements: 5.5, 2.6)
# =============================================================================

class AssetManager:
    """
    Asset Manager class for managing reference images.
    
    Handles saving, loading, and deleting reference images for AI Vision Capture.
    All paths stored in script JSON use POSIX format (forward slashes) for
    cross-platform compatibility.
    
    Requirements: 5.5, 2.6
    
    Attributes:
        script_path: Path to the script file (used to determine assets directory)
        
    Examples:
        >>> manager = AssetManager("/path/to/script.json")
        >>> result = manager.save_reference_image(image_data, "action-uuid-123")
        >>> print(result)  # ('assets/vision_action-uuid-123_1702123456789.png', None)
    """
    
    def __init__(self, script_path: str):
        """
        Create an AssetManager instance.
        
        Args:
            script_path: Path to the script file (used to determine assets directory)
        """
        self.script_path = script_path
    
    def get_assets_dir(self) -> str:
        """
        Get the assets directory path relative to the script file.
        Always returns POSIX format path.
        
        Returns:
            Relative path to assets directory (e.g., "assets/")
        """
        return "assets/"
    
    def get_absolute_assets_dir(self) -> str:
        """
        Get the absolute path to the assets directory.
        
        Returns:
            Absolute path to assets directory in POSIX format
        """
        script_dir = self._get_script_directory()
        return to_posix_path(os.path.join(script_dir, self.get_assets_dir()))
    
    def _get_script_directory(self) -> str:
        """
        Get the directory containing the script file.
        
        Returns:
            Directory path
        """
        return os.path.dirname(os.path.abspath(self.script_path))
    
    def _ensure_assets_dir_exists(self) -> None:
        """
        Ensure the assets directory exists, creating it if necessary.
        """
        assets_dir = os.path.join(self._get_script_directory(), "assets")
        os.makedirs(assets_dir, exist_ok=True)
    
    def save_reference_image(
        self,
        image_data: Union[bytes, str],
        action_id: str,
        mime_type: str = "image/png"
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Save a reference image with auto-generated unique filename.
        
        Requirements: 5.5, 5.11, 2.6
        
        Args:
            image_data: Raw bytes or base64 encoded string
            action_id: UUID of the action (for unique naming)
            mime_type: MIME type (defaults to 'image/png')
            
        Returns:
            Tuple of (relative_path, error):
            - On success: (relative_path in POSIX format, None)
            - On failure: (None, error_message)
            
        Examples:
            >>> manager = AssetManager("/path/to/script.json")
            >>> path, error = manager.save_reference_image(b"...", "uuid-123")
            >>> if error is None:
            ...     print(f"Saved to: {path}")
        """
        try:
            # Ensure assets directory exists
            self._ensure_assets_dir_exists()
            
            # Determine extension from MIME type
            extension = get_extension(mime_type)
            
            # Generate unique filename
            filename = generate_unique_filename(action_id, extension)
            
            # Relative path in POSIX format
            relative_path = f"{self.get_assets_dir()}{filename}"
            
            # Absolute path for file operations
            absolute_path = os.path.join(
                self._get_script_directory(),
                to_native_path(relative_path)
            )
            
            # Convert image data to bytes if needed
            if isinstance(image_data, str):
                # Handle data URL format
                if image_data.startswith('data:'):
                    # Extract base64 from data URL
                    base64_data = image_data.split(',')[1] if ',' in image_data else image_data
                else:
                    base64_data = image_data
                image_bytes = base64.b64decode(base64_data)
            else:
                image_bytes = image_data
            
            # Write to file
            with open(absolute_path, 'wb') as f:
                f.write(image_bytes)
            
            return (to_posix_path(relative_path), None)
            
        except Exception as e:
            return (None, f"Failed to save reference image: {str(e)}")
    
    def load_reference_image(self, relative_path: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Load a reference image by relative path.
        
        Requirements: 5.10
        
        Args:
            relative_path: Path in POSIX format from script JSON
            
        Returns:
            Tuple of (base64_data, error):
            - On success: (base64 encoded image data, None)
            - On failure: (None, error_message)
            
        Examples:
            >>> manager = AssetManager("/path/to/script.json")
            >>> data, error = manager.load_reference_image("assets/vision_123.png")
            >>> if error is None:
            ...     print(f"Loaded {len(data)} bytes")
        """
        try:
            # Convert to absolute path with native separators
            absolute_path = os.path.join(
                self._get_script_directory(),
                to_native_path(relative_path)
            )
            
            # Read file
            with open(absolute_path, 'rb') as f:
                image_bytes = f.read()
            
            # Encode to base64
            base64_data = base64.b64encode(image_bytes).decode('utf-8')
            
            return (base64_data, None)
            
        except FileNotFoundError:
            return (None, f"Reference image not found: {relative_path}")
        except Exception as e:
            return (None, f"Failed to load reference image: {str(e)}")
    
    def delete_reference_image(self, relative_path: str) -> Optional[str]:
        """
        Delete a reference image by relative path.
        
        Args:
            relative_path: Path in POSIX format from script JSON
            
        Returns:
            None on success, error message on failure
            
        Examples:
            >>> manager = AssetManager("/path/to/script.json")
            >>> error = manager.delete_reference_image("assets/vision_123.png")
            >>> if error is None:
            ...     print("Deleted successfully")
        """
        try:
            # Convert to absolute path with native separators
            absolute_path = os.path.join(
                self._get_script_directory(),
                to_native_path(relative_path)
            )
            
            # Delete file
            os.remove(absolute_path)
            
            return None
            
        except FileNotFoundError:
            return f"Reference image not found: {relative_path}"
        except Exception as e:
            return f"Failed to delete reference image: {str(e)}"
    
    def asset_exists(self, relative_path: str) -> bool:
        """
        Check if an asset exists at the given relative path.
        
        Args:
            relative_path: Path in POSIX format
            
        Returns:
            True if asset exists, False otherwise
        """
        absolute_path = os.path.join(
            self._get_script_directory(),
            to_native_path(relative_path)
        )
        return os.path.exists(absolute_path)


def create_asset_manager(script_path: str) -> AssetManager:
    """
    Create an AssetManager instance for a script.
    
    Args:
        script_path: Path to the script file
        
    Returns:
        AssetManager instance
    """
    return AssetManager(script_path)
