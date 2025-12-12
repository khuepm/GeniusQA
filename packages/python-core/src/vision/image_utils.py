"""
Image preprocessing utilities for AI Vision Capture.

Provides functions for cropping, scaling, and encoding images
for use with the AI Vision Service.

Requirements: 4.7
"""

import base64
import io
from typing import Tuple, Optional

from PIL import Image


def encode_image_base64(image_data: str) -> str:
    """
    Convert image data to base64 if needed.
    
    Handles:
    - Already base64 encoded strings (returns as-is)
    - Data URLs (extracts base64 part)
    - File paths (reads and encodes file)
    
    Args:
        image_data: Base64 string, data URL, or file path
        
    Returns:
        Base64 encoded image data (without data URL prefix)
        
    Raises:
        FileNotFoundError: If file path doesn't exist
        ValueError: If image data is invalid
    """
    if not image_data:
        raise ValueError("Image data is required")
    
    # If it's a data URL, extract the base64 part
    if image_data.startswith("data:"):
        parts = image_data.split(",", 1)
        if len(parts) == 2:
            return parts[1]
        raise ValueError("Invalid data URL format")
    
    # Check if it looks like a file path (contains path separators or file extension)
    if "/" in image_data or "\\" in image_data or "." in image_data:
        # Check if it's actually a valid base64 string first
        try:
            # Try to decode as base64 - if it works and is reasonably long, it's base64
            if len(image_data) > 100:
                decoded = base64.b64decode(image_data, validate=True)
                if len(decoded) > 0:
                    return image_data
        except Exception:
            pass
        
        # It's a file path - read and encode
        try:
            with open(image_data, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
        except FileNotFoundError:
            raise FileNotFoundError(f"Image file not found: {image_data}")
        except Exception as e:
            raise ValueError(f"Failed to read image file: {e}")
    
    # Assume it's already base64
    return image_data


def decode_image_base64(base64_data: str) -> Image.Image:
    """
    Decode a base64 encoded image to a PIL Image.
    
    Args:
        base64_data: Base64 encoded image data
        
    Returns:
        PIL Image object
        
    Raises:
        ValueError: If base64 data is invalid or not a valid image
    """
    if not base64_data:
        raise ValueError("Base64 data is required")
    
    try:
        # Remove data URL prefix if present
        if base64_data.startswith("data:"):
            parts = base64_data.split(",", 1)
            if len(parts) == 2:
                base64_data = parts[1]
        
        image_bytes = base64.b64decode(base64_data)
        return Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        raise ValueError(f"Failed to decode image: {e}")


def crop_to_roi(
    image_base64: str,
    x: int,
    y: int,
    width: int,
    height: int
) -> str:
    """
    Crop an image to the specified Region of Interest (ROI).
    
    Requirements: 4.7 - Handle ROI cropping for Regional Search
    
    Args:
        image_base64: Base64 encoded source image
        x: X coordinate of top-left corner of ROI
        y: Y coordinate of top-left corner of ROI
        width: Width of the ROI
        height: Height of the ROI
        
    Returns:
        Base64 encoded cropped image
        
    Raises:
        ValueError: If ROI is invalid or out of bounds
    """
    if width <= 0 or height <= 0:
        raise ValueError("ROI width and height must be positive")
    
    if x < 0 or y < 0:
        raise ValueError("ROI coordinates must be non-negative")
    
    # Decode the image
    image = decode_image_base64(image_base64)
    img_width, img_height = image.size
    
    # Validate ROI bounds
    if x >= img_width or y >= img_height:
        raise ValueError(f"ROI start position ({x}, {y}) is outside image bounds ({img_width}, {img_height})")
    
    # Clamp ROI to image bounds
    right = min(x + width, img_width)
    bottom = min(y + height, img_height)
    
    # Crop the image
    cropped = image.crop((x, y, right, bottom))
    
    # Encode back to base64
    buffer = io.BytesIO()
    cropped.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def scale_roi(
    roi_x: int,
    roi_y: int,
    roi_width: int,
    roi_height: int,
    original_dim: Tuple[int, int],
    current_dim: Tuple[int, int]
) -> Tuple[int, int, int, int]:
    """
    Scale ROI coordinates proportionally when resolution differs.
    
    Requirements: 4.7 - Scale vision_region proportionally to current resolution
    
    Args:
        roi_x: Original X coordinate of ROI
        roi_y: Original Y coordinate of ROI
        roi_width: Original width of ROI
        roi_height: Original height of ROI
        original_dim: Original screen dimensions (width, height)
        current_dim: Current screen dimensions (width, height)
        
    Returns:
        Tuple of (scaled_x, scaled_y, scaled_width, scaled_height)
        
    Raises:
        ValueError: If dimensions are invalid
    """
    orig_width, orig_height = original_dim
    curr_width, curr_height = current_dim
    
    if orig_width <= 0 or orig_height <= 0:
        raise ValueError("Original dimensions must be positive")
    
    if curr_width <= 0 or curr_height <= 0:
        raise ValueError("Current dimensions must be positive")
    
    # Calculate scale factors
    scale_x = curr_width / orig_width
    scale_y = curr_height / orig_height
    
    # Scale ROI coordinates and dimensions
    scaled_x = int(round(roi_x * scale_x))
    scaled_y = int(round(roi_y * scale_y))
    scaled_width = int(round(roi_width * scale_x))
    scaled_height = int(round(roi_height * scale_y))
    
    # Ensure minimum dimensions
    scaled_width = max(1, scaled_width)
    scaled_height = max(1, scaled_height)
    
    # Clamp to screen bounds
    scaled_x = max(0, min(scaled_x, curr_width - 1))
    scaled_y = max(0, min(scaled_y, curr_height - 1))
    
    # Ensure ROI doesn't exceed screen bounds
    if scaled_x + scaled_width > curr_width:
        scaled_width = curr_width - scaled_x
    if scaled_y + scaled_height > curr_height:
        scaled_height = curr_height - scaled_y
    
    return (scaled_x, scaled_y, scaled_width, scaled_height)


def scale_coordinates(
    x: int,
    y: int,
    original_dim: Tuple[int, int],
    current_dim: Tuple[int, int]
) -> Tuple[int, int]:
    """
    Scale coordinates proportionally when resolution differs.
    
    This is a utility function for scaling saved or cached coordinates
    to the current screen resolution.
    
    Args:
        x: Original X coordinate
        y: Original Y coordinate
        original_dim: Original screen dimensions (width, height)
        current_dim: Current screen dimensions (width, height)
        
    Returns:
        Tuple of (scaled_x, scaled_y)
        
    Raises:
        ValueError: If dimensions are invalid
    """
    orig_width, orig_height = original_dim
    curr_width, curr_height = current_dim
    
    if orig_width <= 0 or orig_height <= 0:
        raise ValueError("Original dimensions must be positive")
    
    if curr_width <= 0 or curr_height <= 0:
        raise ValueError("Current dimensions must be positive")
    
    # Calculate scale factors
    scale_x = curr_width / orig_width
    scale_y = curr_height / orig_height
    
    # Scale coordinates
    scaled_x = int(round(x * scale_x))
    scaled_y = int(round(y * scale_y))
    
    # Clamp to screen bounds
    scaled_x = max(0, min(scaled_x, curr_width - 1))
    scaled_y = max(0, min(scaled_y, curr_height - 1))
    
    return (scaled_x, scaled_y)


def get_image_dimensions(image_base64: str) -> Tuple[int, int]:
    """
    Get the dimensions of a base64 encoded image.
    
    Args:
        image_base64: Base64 encoded image data
        
    Returns:
        Tuple of (width, height)
        
    Raises:
        ValueError: If image data is invalid
    """
    image = decode_image_base64(image_base64)
    return image.size
