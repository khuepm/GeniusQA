"""
AI Vision module for AI Vision Capture feature.

This module provides AI-powered visual element detection using Google's Gemini Vision API.
It supports analyzing screenshots to locate UI elements based on prompts and reference images.

Requirements: 4.6, 4.8, 4.10
"""

from .ai_vision_service import (
    AIVisionService,
    AIVisionRequest,
    AIVisionResponse,
    ai_vision_service,
)
from .image_utils import (
    crop_to_roi,
    scale_roi,
    encode_image_base64,
    decode_image_base64,
)

__all__ = [
    'AIVisionService',
    'AIVisionRequest',
    'AIVisionResponse',
    'ai_vision_service',
    'crop_to_roi',
    'scale_roi',
    'encode_image_base64',
    'decode_image_base64',
]
