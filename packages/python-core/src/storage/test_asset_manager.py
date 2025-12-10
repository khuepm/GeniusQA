"""Property-based tests for Asset Manager.

Tests for path normalization utilities and asset management functionality.

Requirements: 5.9, 5.10, 5.11
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
import os
import tempfile
import base64
from pathlib import Path

from .asset_manager import (
    AssetManager,
    to_posix_path,
    to_native_path,
    generate_unique_filename,
    get_extension,
    create_asset_manager,
)


# =============================================================================
# Strategies for generating test data
# =============================================================================

# Strategy for generating path segments (valid filename characters)
path_segment = st.text(
    min_size=1,
    max_size=20,
    alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd'),
        whitelist_characters='_-'
    )
)

# Strategy for generating file extensions
file_extension = st.sampled_from(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])

# Strategy for generating action IDs (UUID-like strings)
# Only use ASCII alphanumeric characters and hyphens to match what won't be sanitized
action_id_strategy = st.text(
    min_size=1,
    max_size=36,
    alphabet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'
)

# Strategy for generating paths with mixed separators
@st.composite
def mixed_separator_path(draw):
    """Generate a path with mixed forward and back slashes."""
    segments = draw(st.lists(path_segment, min_size=1, max_size=5))
    filename = draw(path_segment)
    ext = draw(file_extension)
    
    # Build path with random separators
    separators = draw(st.lists(
        st.sampled_from(['/', '\\\\']),
        min_size=len(segments),
        max_size=len(segments)
    ))
    
    path_parts = []
    for i, segment in enumerate(segments):
        path_parts.append(segment)
        if i < len(separators):
            path_parts.append(separators[i])
    
    path_parts.append(f"{filename}.{ext}")
    return ''.join(path_parts)


# Strategy for generating POSIX paths (forward slashes only)
@st.composite
def posix_path_strategy(draw):
    """Generate a valid POSIX path."""
    segments = draw(st.lists(path_segment, min_size=1, max_size=5))
    filename = draw(path_segment)
    ext = draw(file_extension)
    return '/'.join(segments) + f"/{filename}.{ext}"


# =============================================================================
# Property Tests for Path Normalization
# =============================================================================

# Feature: ai-vision-capture, Property 16: Asset Path Normalization (Cross-Platform)
@settings(max_examples=100)
@given(path=mixed_separator_path())
def test_to_posix_path_removes_backslashes(path):
    """
    Property 16: Asset Path Normalization (Cross-Platform)
    
    For any reference_image path stored in the script JSON, the path SHALL use 
    POSIX format (forward slashes `/`) regardless of the operating system.
    
    **Feature: ai-vision-capture, Property 16: Asset Path Normalization (Cross-Platform)**
    **Validates: Requirements 5.9, 5.10**
    """
    result = to_posix_path(path)
    
    # Property: Result should contain no backslashes
    assert '\\\\' not in result, f"Path still contains backslashes: {result}"
    
    # Property: All path segments should be preserved
    # (just with different separators)
    original_segments = [s for s in path.replace('\\\\', '/').split('/') if s]
    result_segments = [s for s in result.split('/') if s]
    assert original_segments == result_segments, "Path segments were modified"


@settings(max_examples=100)
@given(path=posix_path_strategy())
def test_to_posix_path_idempotent(path):
    """
    Property: to_posix_path should be idempotent.
    
    Applying to_posix_path multiple times should produce the same result.
    
    **Feature: ai-vision-capture, Property 16: Asset Path Normalization (Cross-Platform)**
    **Validates: Requirements 5.9**
    """
    result1 = to_posix_path(path)
    result2 = to_posix_path(result1)
    
    assert result1 == result2, "to_posix_path is not idempotent"


@settings(max_examples=100)
@given(path=posix_path_strategy())
def test_to_native_path_roundtrip(path):
    """
    Property: Converting to native and back to POSIX should preserve the path.
    
    **Feature: ai-vision-capture, Property 16: Asset Path Normalization (Cross-Platform)**
    **Validates: Requirements 5.9, 5.10**
    """
    native = to_native_path(path)
    back_to_posix = to_posix_path(native)
    
    assert back_to_posix == path, f"Round-trip failed: {path} -> {native} -> {back_to_posix}"


# =============================================================================
# Property Tests for Unique Filename Generation
# =============================================================================

# Feature: ai-vision-capture, Property 17: Asset File Naming Uniqueness
@settings(max_examples=100)
@given(
    action_id=action_id_strategy,
    extension=file_extension
)
def test_generate_unique_filename_format(action_id, extension):
    """
    Property 17: Asset File Naming Uniqueness
    
    For any reference image saved via paste or drag-drop, the Asset_Manager SHALL 
    generate a unique filename using the pattern `vision_{action_id}_{timestamp}.{ext}`.
    
    **Feature: ai-vision-capture, Property 17: Asset File Naming Uniqueness**
    **Validates: Requirements 5.11**
    """
    filename = generate_unique_filename(action_id, extension)
    
    # Property: Filename should start with "vision_"
    assert filename.startswith("vision_"), f"Filename doesn't start with 'vision_': {filename}"
    
    # Property: Filename should end with the extension
    assert filename.endswith(f".{extension.lower()}"), f"Filename doesn't end with extension: {filename}"
    
    # Property: Filename should contain the sanitized action_id
    sanitized_id = ''.join(c for c in action_id if c.isalnum() or c == '-')
    assert sanitized_id in filename, f"Sanitized action_id not in filename: {filename}"
    
    # Property: Filename should contain a timestamp (numeric part)
    parts = filename.split('_')
    assert len(parts) >= 3, f"Filename doesn't have expected format: {filename}"
    
    # The timestamp should be the last part before the extension
    timestamp_part = parts[-1].split('.')[0]
    assert timestamp_part.isdigit(), f"Timestamp part is not numeric: {timestamp_part}"


@settings(max_examples=50)
@given(
    action_id=action_id_strategy,
    extension=file_extension
)
def test_generate_unique_filename_uniqueness(action_id, extension):
    """
    Property: Multiple calls should generate unique filenames.
    
    **Feature: ai-vision-capture, Property 17: Asset File Naming Uniqueness**
    **Validates: Requirements 5.11**
    """
    import time
    
    filenames = set()
    for _ in range(5):
        filename = generate_unique_filename(action_id, extension)
        filenames.add(filename)
        time.sleep(0.002)  # Small delay to ensure different timestamps
    
    # All filenames should be unique
    assert len(filenames) == 5, f"Generated duplicate filenames: {filenames}"


@settings(max_examples=100)
@given(extension=st.sampled_from(['.png', 'png', '.PNG', 'PNG', '.jpg', 'jpeg']))
def test_generate_unique_filename_extension_normalization(extension):
    """
    Property: Extension should be normalized (lowercase, no leading dot).
    
    **Feature: ai-vision-capture, Property 17: Asset File Naming Uniqueness**
    **Validates: Requirements 5.11**
    """
    filename = generate_unique_filename("test-id", extension)
    
    # Property: Extension should be lowercase
    ext_part = filename.split('.')[-1]
    assert ext_part == ext_part.lower(), f"Extension not lowercase: {ext_part}"
    
    # Property: No double dots
    assert '..' not in filename, f"Double dots in filename: {filename}"


# =============================================================================
# Property Tests for get_extension
# =============================================================================

@settings(max_examples=100)
@given(mime_type=st.sampled_from([
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp'
]))
def test_get_extension_from_mime_type(mime_type):
    """
    Property: get_extension should correctly extract extension from MIME types.
    """
    ext = get_extension(mime_type)
    
    # Property: Result should be a valid extension
    assert ext in ['png', 'jpg', 'gif', 'webp', 'bmp'], f"Invalid extension: {ext}"
    
    # Property: Result should be lowercase
    assert ext == ext.lower(), f"Extension not lowercase: {ext}"


@settings(max_examples=100)
@given(
    filename=path_segment,
    extension=file_extension
)
def test_get_extension_from_filename(filename, extension):
    """
    Property: get_extension should correctly extract extension from filenames.
    """
    full_filename = f"{filename}.{extension}"
    ext = get_extension(full_filename)
    
    # Property: Result should match the original extension (lowercase)
    assert ext == extension.lower(), f"Extension mismatch: {ext} != {extension.lower()}"


# =============================================================================
# Integration Tests for AssetManager
# =============================================================================

class TestAssetManagerIntegration:
    """Integration tests for AssetManager class."""
    
    def test_save_and_load_reference_image(self):
        """Test saving and loading a reference image."""
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = os.path.join(tmpdir, "test_script.json")
            
            # Create a simple test image (1x1 red pixel PNG)
            # This is a minimal valid PNG file
            test_image_data = base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
            )
            
            manager = AssetManager(script_path)
            
            # Save the image
            relative_path, error = manager.save_reference_image(
                test_image_data,
                "test-action-123",
                "image/png"
            )
            
            assert error is None, f"Save failed: {error}"
            assert relative_path is not None
            assert relative_path.startswith("assets/")
            assert relative_path.endswith(".png")
            assert "test-action-123" in relative_path
            
            # Verify path is in POSIX format
            assert '\\\\' not in relative_path
            
            # Load the image back
            loaded_data, load_error = manager.load_reference_image(relative_path)
            
            assert load_error is None, f"Load failed: {load_error}"
            assert loaded_data is not None
            
            # Verify the data matches
            decoded = base64.b64decode(loaded_data)
            assert decoded == test_image_data
    
    def test_delete_reference_image(self):
        """Test deleting a reference image."""
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = os.path.join(tmpdir, "test_script.json")
            
            test_image_data = b"fake image data"
            
            manager = AssetManager(script_path)
            
            # Save the image
            relative_path, _ = manager.save_reference_image(
                test_image_data,
                "test-action-456",
                "image/png"
            )
            
            # Verify it exists
            assert manager.asset_exists(relative_path)
            
            # Delete it
            error = manager.delete_reference_image(relative_path)
            assert error is None
            
            # Verify it's gone
            assert not manager.asset_exists(relative_path)
    
    def test_save_base64_string(self):
        """Test saving a base64 encoded string."""
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = os.path.join(tmpdir, "test_script.json")
            
            # Base64 encoded test data
            original_data = b"test image content"
            base64_data = base64.b64encode(original_data).decode('utf-8')
            
            manager = AssetManager(script_path)
            
            # Save using base64 string
            relative_path, error = manager.save_reference_image(
                base64_data,
                "test-action-789",
                "image/png"
            )
            
            assert error is None
            
            # Load and verify
            loaded_data, _ = manager.load_reference_image(relative_path)
            decoded = base64.b64decode(loaded_data)
            assert decoded == original_data
    
    def test_save_data_url(self):
        """Test saving a data URL."""
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = os.path.join(tmpdir, "test_script.json")
            
            # Data URL format
            original_data = b"test image content"
            base64_data = base64.b64encode(original_data).decode('utf-8')
            data_url = f"data:image/png;base64,{base64_data}"
            
            manager = AssetManager(script_path)
            
            # Save using data URL
            relative_path, error = manager.save_reference_image(
                data_url,
                "test-action-data-url",
                "image/png"
            )
            
            assert error is None
            
            # Load and verify
            loaded_data, _ = manager.load_reference_image(relative_path)
            decoded = base64.b64decode(loaded_data)
            assert decoded == original_data
    
    def test_get_assets_dir(self):
        """Test getting the assets directory."""
        manager = AssetManager("/path/to/script.json")
        
        assert manager.get_assets_dir() == "assets/"
    
    def test_create_asset_manager_factory(self):
        """Test the factory function."""
        manager = create_asset_manager("/path/to/script.json")
        
        assert isinstance(manager, AssetManager)
        assert manager.script_path == "/path/to/script.json"
