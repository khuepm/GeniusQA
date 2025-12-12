"""
Property-based tests for AI Vision Service.

Tests the AI Vision Service timeout enforcement and request handling
using hypothesis for property-based testing.

Requirements: 4.10, 4.11
"""

import asyncio
import base64
import io
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from hypothesis import given, strategies as st, settings, assume
from PIL import Image

from .ai_vision_service import (
    AIVisionService,
    AIVisionRequest,
    AIVisionResponse,
    VisionROI,
    extract_json_from_response,
    parse_vision_result,
    DEFAULT_TIMEOUT_SECONDS,
)
from .image_utils import (
    crop_to_roi,
    scale_roi,
    encode_image_base64,
    decode_image_base64,
    scale_coordinates,
)


# ============================================================================
# Test Helpers
# ============================================================================

def create_test_image(width: int = 100, height: int = 100, color: str = "red") -> str:
    """Create a test image and return as base64."""
    image = Image.new("RGB", (width, height), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# ============================================================================
# Property Tests for AI Timeout Enforcement
# ============================================================================

class TestAITimeoutEnforcement:
    """
    **Property 11: AI Timeout Enforcement**
    **Validates: Requirements 4.10, 4.11**
    
    For any Dynamic Mode AI call, if the response is not received within
    the configured timeout, the system SHALL treat it as an error and
    not block indefinitely.
    """
    
    @pytest.mark.asyncio
    @given(
        timeout_seconds=st.floats(min_value=0.1, max_value=5.0),
    )
    @settings(max_examples=20, deadline=None)
    async def test_timeout_enforcement_property(
        self,
        timeout_seconds: float,
    ):
        """
        **Feature: ai-vision-capture, Property 11: AI Timeout Enforcement**
        **Validates: Requirements 4.10, 4.11**
        
        Property: For any configured timeout T, when a TimeoutError occurs,
        the service SHALL return a timeout error message and not block indefinitely.
        """
        service = AIVisionService()
        await service.initialize("test-api-key")
        service.set_timeout(timeout_seconds)
        
        # Create a mock that simulates timeout by patching the internal method
        original_method = service._call_gemini_vision_api
        
        async def mock_api_call(*args, **kwargs):
            raise asyncio.TimeoutError("Request timed out")
        
        service._call_gemini_vision_api = mock_api_call
        
        try:
            request = AIVisionRequest(
                screenshot=create_test_image(),
                prompt="Find the button"
            )
            
            # Measure actual execution time
            start_time = asyncio.get_event_loop().time()
            response = await service.analyze(request)
            elapsed_time = asyncio.get_event_loop().time() - start_time
            
            # Property assertions:
            # 1. Response should indicate failure
            assert response.success is False, "Timeout should result in failure"
            
            # 2. Error message should mention timeout
            assert response.error is not None, "Error message should be present"
            assert "timed out" in response.error.lower() or "timeout" in response.error.lower(), \
                f"Error should mention timeout, got: {response.error}"
            
            # 3. Should not block indefinitely (should return quickly since we mock)
            assert elapsed_time < 2.0, \
                f"Should not block indefinitely, elapsed: {elapsed_time}s"
        finally:
            # Restore original
            service._call_gemini_vision_api = original_method
    
    @pytest.mark.asyncio
    @given(timeout_seconds=st.floats(min_value=0.1, max_value=10.0))
    @settings(max_examples=10, deadline=None)
    async def test_timeout_configuration_property(self, timeout_seconds: float):
        """
        **Feature: ai-vision-capture, Property 11: AI Timeout Enforcement**
        **Validates: Requirements 4.10**
        
        Property: For any positive timeout value T, the service SHALL
        accept and store the configuration correctly.
        """
        service = AIVisionService()
        
        # Set timeout
        service.set_timeout(timeout_seconds)
        
        # Property: get_timeout should return the configured value
        assert service.get_timeout() == timeout_seconds, \
            f"Timeout should be {timeout_seconds}, got {service.get_timeout()}"
    
    @pytest.mark.asyncio
    @given(timeout_seconds=st.floats(max_value=0.0))
    @settings(max_examples=10, deadline=None)
    async def test_invalid_timeout_rejected_property(self, timeout_seconds: float):
        """
        **Feature: ai-vision-capture, Property 11: AI Timeout Enforcement**
        **Validates: Requirements 4.10**
        
        Property: For any non-positive timeout value, the service SHALL
        reject the configuration with a ValueError.
        """
        service = AIVisionService()
        
        with pytest.raises(ValueError) as exc_info:
            service.set_timeout(timeout_seconds)
        
        assert "positive" in str(exc_info.value).lower(), \
            "Error should mention that timeout must be positive"
    
    @pytest.mark.asyncio
    async def test_default_timeout_value(self):
        """
        **Feature: ai-vision-capture, Property 11: AI Timeout Enforcement**
        **Validates: Requirements 4.10**
        
        The default timeout should be 15 seconds as per requirements.
        """
        service = AIVisionService()
        
        assert service.get_timeout() == DEFAULT_TIMEOUT_SECONDS, \
            f"Default timeout should be {DEFAULT_TIMEOUT_SECONDS}s"
        assert DEFAULT_TIMEOUT_SECONDS == 15, \
            "Default timeout constant should be 15 seconds"


# ============================================================================
# Property Tests for Image Utilities
# ============================================================================

class TestImageUtilities:
    """Tests for image preprocessing utilities."""
    
    @given(
        width=st.integers(min_value=10, max_value=500),
        height=st.integers(min_value=10, max_value=500)
    )
    @settings(max_examples=20, deadline=None)
    def test_encode_decode_roundtrip(self, width: int, height: int):
        """
        Property: Encoding and decoding an image should preserve dimensions.
        """
        # Create test image
        original = Image.new("RGB", (width, height), "blue")
        buffer = io.BytesIO()
        original.save(buffer, format="PNG")
        base64_data = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
        # Decode
        decoded = decode_image_base64(base64_data)
        
        # Property: dimensions should be preserved
        assert decoded.size == (width, height), \
            f"Dimensions should be preserved: expected ({width}, {height}), got {decoded.size}"
    
    @given(
        img_width=st.integers(min_value=100, max_value=500),
        img_height=st.integers(min_value=100, max_value=500),
        roi_x=st.integers(min_value=0, max_value=50),
        roi_y=st.integers(min_value=0, max_value=50),
        roi_width=st.integers(min_value=10, max_value=50),
        roi_height=st.integers(min_value=10, max_value=50)
    )
    @settings(max_examples=30, deadline=None)
    def test_crop_to_roi_bounds(
        self,
        img_width: int,
        img_height: int,
        roi_x: int,
        roi_y: int,
        roi_width: int,
        roi_height: int
    ):
        """
        Property: Cropping to ROI should produce an image with correct dimensions.
        """
        # Ensure ROI is within image bounds
        assume(roi_x + roi_width <= img_width)
        assume(roi_y + roi_height <= img_height)
        
        # Create test image
        base64_data = create_test_image(img_width, img_height)
        
        # Crop
        cropped_base64 = crop_to_roi(base64_data, roi_x, roi_y, roi_width, roi_height)
        
        # Decode and check dimensions
        cropped = decode_image_base64(cropped_base64)
        
        # Property: cropped dimensions should match ROI
        assert cropped.size == (roi_width, roi_height), \
            f"Cropped size should be ({roi_width}, {roi_height}), got {cropped.size}"
    
    @given(
        roi_x=st.integers(min_value=0, max_value=1000),
        roi_y=st.integers(min_value=0, max_value=1000),
        roi_width=st.integers(min_value=1, max_value=500),
        roi_height=st.integers(min_value=1, max_value=500),
        orig_width=st.integers(min_value=100, max_value=4096),
        orig_height=st.integers(min_value=100, max_value=4096),
        curr_width=st.integers(min_value=100, max_value=4096),
        curr_height=st.integers(min_value=100, max_value=4096)
    )
    @settings(max_examples=50, deadline=None)
    def test_scale_roi_proportionality(
        self,
        roi_x: int,
        roi_y: int,
        roi_width: int,
        roi_height: int,
        orig_width: int,
        orig_height: int,
        curr_width: int,
        curr_height: int
    ):
        """
        **Feature: ai-vision-capture, Property 3: Coordinate Scaling Proportionality**
        **Validates: Requirements 4.3, 4.5**
        
        Property: Scaled ROI coordinates should be proportional to the
        resolution change.
        """
        # Ensure ROI is within original bounds
        assume(roi_x < orig_width)
        assume(roi_y < orig_height)
        
        scaled_x, scaled_y, scaled_w, scaled_h = scale_roi(
            roi_x, roi_y, roi_width, roi_height,
            (orig_width, orig_height),
            (curr_width, curr_height)
        )
        
        # Property: scaled coordinates should be proportional
        scale_x = curr_width / orig_width
        scale_y = curr_height / orig_height
        
        expected_x = int(round(roi_x * scale_x))
        expected_y = int(round(roi_y * scale_y))
        
        # Allow small rounding differences
        assert abs(scaled_x - expected_x) <= 1, \
            f"X should be proportional: expected ~{expected_x}, got {scaled_x}"
        assert abs(scaled_y - expected_y) <= 1, \
            f"Y should be proportional: expected ~{expected_y}, got {scaled_y}"
        
        # Property: scaled coordinates should be within current bounds
        assert 0 <= scaled_x < curr_width, \
            f"Scaled X should be within bounds [0, {curr_width}), got {scaled_x}"
        assert 0 <= scaled_y < curr_height, \
            f"Scaled Y should be within bounds [0, {curr_height}), got {scaled_y}"
        
        # Property: scaled dimensions should be positive
        assert scaled_w > 0, "Scaled width should be positive"
        assert scaled_h > 0, "Scaled height should be positive"
    
    @st.composite
    def _valid_coordinate_scaling_inputs(draw):
        """Generate valid inputs for coordinate scaling test."""
        orig_width = draw(st.integers(min_value=100, max_value=4096))
        orig_height = draw(st.integers(min_value=100, max_value=4096))
        # Generate coordinates within original bounds
        x = draw(st.integers(min_value=0, max_value=orig_width - 1))
        y = draw(st.integers(min_value=0, max_value=orig_height - 1))
        curr_width = draw(st.integers(min_value=100, max_value=4096))
        curr_height = draw(st.integers(min_value=100, max_value=4096))
        return x, y, orig_width, orig_height, curr_width, curr_height
    
    @given(inputs=_valid_coordinate_scaling_inputs())
    @settings(max_examples=50, deadline=None)
    def test_scale_coordinates_proportionality(self, inputs):
        """
        **Feature: ai-vision-capture, Property 3: Coordinate Scaling Proportionality**
        **Validates: Requirements 4.3, 4.5**
        
        Property: For any saved coordinates (x, y) and screen dimensions,
        the scaled coordinates SHALL be proportional.
        """
        x, y, orig_width, orig_height, curr_width, curr_height = inputs
        
        scaled_x, scaled_y = scale_coordinates(
            x, y,
            (orig_width, orig_height),
            (curr_width, curr_height)
        )
        
        # Property: scaled coordinates should be proportional
        scale_factor_x = curr_width / orig_width
        scale_factor_y = curr_height / orig_height
        
        expected_x = int(round(x * scale_factor_x))
        expected_y = int(round(y * scale_factor_y))
        
        # Clamp expected values to bounds
        expected_x = max(0, min(expected_x, curr_width - 1))
        expected_y = max(0, min(expected_y, curr_height - 1))
        
        # Allow small rounding differences
        assert abs(scaled_x - expected_x) <= 1, \
            f"X should be proportional: expected ~{expected_x}, got {scaled_x}"
        assert abs(scaled_y - expected_y) <= 1, \
            f"Y should be proportional: expected ~{expected_y}, got {scaled_y}"
        
        # Property: scaled coordinates should be within current bounds
        assert 0 <= scaled_x < curr_width, \
            f"Scaled X should be within bounds [0, {curr_width}), got {scaled_x}"
        assert 0 <= scaled_y < curr_height, \
            f"Scaled Y should be within bounds [0, {curr_height}), got {scaled_y}"


# ============================================================================
# Property Tests for Response Parsing
# ============================================================================

class TestResponseParsing:
    """Tests for AI response parsing."""
    
    @given(
        x=st.integers(min_value=0, max_value=4096),
        y=st.integers(min_value=0, max_value=4096),
        confidence=st.floats(min_value=0.0, max_value=1.0)
    )
    @settings(max_examples=30, deadline=None)
    def test_parse_successful_response(self, x: int, y: int, confidence: float):
        """
        Property: Valid JSON responses with found=true should parse correctly.
        """
        response_text = f'''```json
{{
  "found": true,
  "x": {x},
  "y": {y},
  "confidence": {confidence},
  "description": "Found element"
}}
```'''
        
        result = parse_vision_result(response_text)
        
        assert result is not None, "Should parse valid response"
        assert result["found"] is True
        assert result["x"] == x
        assert result["y"] == y
        assert abs(result["confidence"] - confidence) < 0.001
    
    @given(error_message=st.text(
        alphabet=st.characters(
            whitelist_categories=('L', 'N', 'P', 'S', 'Z'),  # Letters, numbers, punctuation, symbols, separators
            blacklist_characters='"\\',  # Exclude characters that break JSON
        ),
        min_size=1,
        max_size=100
    ))
    @settings(max_examples=20, deadline=None)
    def test_parse_not_found_response(self, error_message: str):
        """
        Property: Valid JSON responses with found=false should parse correctly.
        """
        # Use json.dumps to properly escape the message
        import json as json_module
        escaped_message = json_module.dumps(error_message)[1:-1]  # Remove surrounding quotes
        
        response_text = f'''{{
  "found": false,
  "error": "{escaped_message}",
  "confidence": 0
}}'''
        
        result = parse_vision_result(response_text)
        
        assert result is not None, "Should parse valid not-found response"
        assert result["found"] is False
        assert result["confidence"] == 0
    
    def test_parse_invalid_json(self):
        """Invalid JSON should return None."""
        result = parse_vision_result("not valid json")
        assert result is None
    
    def test_parse_missing_found_field(self):
        """JSON without 'found' field should return None."""
        result = parse_vision_result('{"x": 100, "y": 200}')
        assert result is None


# ============================================================================
# Unit Tests for Service Initialization
# ============================================================================

class TestServiceInitialization:
    """Tests for service initialization."""
    
    @pytest.mark.asyncio
    async def test_initialize_with_valid_key(self):
        """Service should initialize with valid API key."""
        service = AIVisionService()
        await service.initialize("valid-api-key")
        
        assert service.is_initialized() is True
    
    @pytest.mark.asyncio
    async def test_initialize_with_empty_key(self):
        """Service should reject empty API key."""
        service = AIVisionService()
        
        with pytest.raises(ValueError):
            await service.initialize("")
    
    @pytest.mark.asyncio
    async def test_initialize_with_whitespace_key(self):
        """Service should reject whitespace-only API key."""
        service = AIVisionService()
        
        with pytest.raises(ValueError):
            await service.initialize("   ")
    
    @pytest.mark.asyncio
    async def test_reset_clears_state(self):
        """Reset should clear initialization state."""
        service = AIVisionService()
        await service.initialize("test-key")
        
        service.reset()
        
        assert service.is_initialized() is False
        assert service.get_timeout() == DEFAULT_TIMEOUT_SECONDS
    
    @pytest.mark.asyncio
    async def test_analyze_without_initialization(self):
        """Analyze should fail if not initialized."""
        service = AIVisionService()
        
        request = AIVisionRequest(
            screenshot=create_test_image(),
            prompt="Find button"
        )
        
        response = await service.analyze(request)
        
        assert response.success is False
        assert "not initialized" in response.error.lower()
    
    @pytest.mark.asyncio
    async def test_analyze_without_screenshot(self):
        """Analyze should fail without screenshot."""
        service = AIVisionService()
        await service.initialize("test-key")
        
        request = AIVisionRequest(
            screenshot="",
            prompt="Find button"
        )
        
        response = await service.analyze(request)
        
        assert response.success is False
        assert "screenshot" in response.error.lower()
    
    @pytest.mark.asyncio
    async def test_analyze_without_prompt(self):
        """Analyze should fail without prompt."""
        service = AIVisionService()
        await service.initialize("test-key")
        
        request = AIVisionRequest(
            screenshot=create_test_image(),
            prompt=""
        )
        
        response = await service.analyze(request)
        
        assert response.success is False
        assert "prompt" in response.error.lower()
