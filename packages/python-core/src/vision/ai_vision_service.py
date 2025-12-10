"""
AI Vision Service for AI Vision Capture feature.

Provides integration with Google's Gemini Vision API for analyzing
screenshots and locating UI elements based on prompts and reference images.

Requirements: 4.6, 4.8, 4.10
"""

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Optional, List
import aiohttp

from .image_utils import crop_to_roi, encode_image_base64


# ============================================================================
# Constants
# ============================================================================

GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_VISION_MODEL = "gemini-2.0-flash"
DEFAULT_TIMEOUT_SECONDS = 15  # Requirement 4.10

# System prompt for AI Vision analysis
VISION_SYSTEM_PROMPT = """You are a UI element locator assistant. Your task is to analyze screenshots and find the exact pixel coordinates of UI elements described by the user.

## Your Role
- Analyze the provided screenshot image
- Find the UI element described in the user's prompt
- If reference images are provided, use them to identify similar visual elements
- Return the center coordinates (x, y) of the found element

## Response Format
You MUST respond with ONLY a JSON object in this exact format:
```json
{
  "found": true,
  "x": <integer pixel x coordinate>,
  "y": <integer pixel y coordinate>,
  "confidence": <float between 0 and 1>,
  "description": "<brief description of what was found>"
}
```

If the element cannot be found, respond with:
```json
{
  "found": false,
  "error": "<reason why element was not found>",
  "confidence": 0
}
```

## Important Rules
1. Coordinates must be integers representing pixel positions
2. X coordinate is horizontal (0 = left edge)
3. Y coordinate is vertical (0 = top edge)
4. Return the CENTER of the target element, not its corner
5. Confidence should reflect how certain you are (1.0 = very certain, 0.5 = uncertain)
6. If multiple matching elements exist, return the most prominent/visible one
7. ONLY output the JSON, no additional text"""


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class VisionROI:
    """Region of Interest for cropping screenshots."""
    x: int
    y: int
    width: int
    height: int


@dataclass
class AIVisionRequest:
    """
    Request structure for AI Vision analysis.
    
    Attributes:
        screenshot: Base64 encoded screenshot or file path
        prompt: User-provided description of the target element
        reference_images: List of base64 encoded reference images
        roi: Optional Region of Interest for Regional Search
    
    Requirements: 4.6, 4.8
    """
    screenshot: str
    prompt: str
    reference_images: List[str] = field(default_factory=list)
    roi: Optional[VisionROI] = None


@dataclass
class AIVisionResponse:
    """
    Response structure from AI Vision analysis.
    
    Attributes:
        success: Whether the analysis was successful
        x: X coordinate of found element (if successful)
        y: Y coordinate of found element (if successful)
        confidence: Confidence score (0.0 to 1.0)
        error: Error message (if unsuccessful)
    
    Requirements: 4.6
    """
    success: bool
    x: Optional[int] = None
    y: Optional[int] = None
    confidence: Optional[float] = None
    error: Optional[str] = None


# ============================================================================
# Helper Functions
# ============================================================================

def extract_json_from_response(response_text: str) -> Optional[str]:
    """
    Extract JSON from AI response text.
    Handles both code-block wrapped and raw JSON.
    
    Args:
        response_text: Raw text response from AI
        
    Returns:
        Extracted JSON string or None if not found
    """
    # Try to extract from code block first
    code_block_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response_text)
    if code_block_match:
        return code_block_match.group(1).strip()
    
    # Try to find raw JSON object
    json_match = re.search(r'\{[\s\S]*"found"[\s\S]*\}', response_text)
    if json_match:
        return json_match.group(0)
    
    return None


def parse_vision_result(response_text: str) -> Optional[dict]:
    """
    Parse the AI response into a structured result.
    
    Args:
        response_text: Raw text response from AI
        
    Returns:
        Parsed result dict or None if parsing fails
    """
    json_string = extract_json_from_response(response_text)
    if not json_string:
        return None
    
    try:
        parsed = json.loads(json_string)
        
        # Validate required fields
        if not isinstance(parsed.get('found'), bool):
            return None
        
        if parsed['found']:
            # Validate coordinates for successful find
            if not isinstance(parsed.get('x'), (int, float)) or \
               not isinstance(parsed.get('y'), (int, float)):
                return None
            
            return {
                'found': True,
                'x': round(parsed['x']),
                'y': round(parsed['y']),
                'confidence': parsed.get('confidence', 0.5),
                'description': parsed.get('description'),
            }
        else:
            return {
                'found': False,
                'confidence': 0,
                'error': parsed.get('error', 'Element not found'),
            }
    except (json.JSONDecodeError, KeyError, TypeError):
        return None


# ============================================================================
# AI Vision Service Class
# ============================================================================

class AIVisionService:
    """
    Service for AI-powered visual element detection.
    
    Provides integration with Google's Gemini Vision API for analyzing
    screenshots and locating UI elements based on prompts and reference images.
    
    Requirements: 4.6, 4.8, 4.10
    
    Example:
        >>> service = AIVisionService()
        >>> await service.initialize("your-api-key")
        >>> request = AIVisionRequest(
        ...     screenshot="base64_encoded_image",
        ...     prompt="Find the Submit button"
        ... )
        >>> response = await service.analyze(request)
        >>> if response.success:
        ...     print(f"Found at ({response.x}, {response.y})")
    """
    
    def __init__(self):
        """Initialize the AI Vision Service."""
        self._api_key: Optional[str] = None
        self._initialized: bool = False
        self._timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    
    async def initialize(self, api_key: str) -> None:
        """
        Initialize the service with an API key.
        
        Args:
            api_key: The Gemini API key
            
        Raises:
            ValueError: If API key is empty or invalid
        """
        if not api_key or not api_key.strip():
            raise ValueError("API key is required")
        
        self._api_key = api_key.strip()
        self._initialized = True
    
    def is_initialized(self) -> bool:
        """Check if the service is initialized."""
        return self._initialized and self._api_key is not None
    
    def reset(self) -> None:
        """Reset the service (clear API key)."""
        self._api_key = None
        self._initialized = False
        self._timeout_seconds = DEFAULT_TIMEOUT_SECONDS
    
    def set_timeout(self, seconds: float) -> None:
        """
        Set the timeout for AI requests.
        
        Requirements: 4.10
        
        Args:
            seconds: Timeout in seconds (default: 15)
            
        Raises:
            ValueError: If timeout is not positive
        """
        if seconds <= 0:
            raise ValueError("Timeout must be a positive number")
        self._timeout_seconds = seconds
    
    def get_timeout(self) -> float:
        """Get the current timeout setting in seconds."""
        return self._timeout_seconds
    
    async def analyze(self, request: AIVisionRequest) -> AIVisionResponse:
        """
        Analyze a screenshot to find a UI element.
        
        Requirements: 4.6, 4.8, 4.10
        
        Args:
            request: The vision analysis request containing screenshot, prompt,
                    and optional reference images and ROI
                    
        Returns:
            AIVisionResponse with coordinates or error
        """
        if not self.is_initialized():
            return AIVisionResponse(
                success=False,
                error="AI Vision service not initialized. Please configure your API key."
            )
        
        # Validate request
        if not request.screenshot:
            return AIVisionResponse(
                success=False,
                error="Screenshot is required for analysis."
            )
        
        if not request.prompt or not request.prompt.strip():
            return AIVisionResponse(
                success=False,
                error="Prompt is required for analysis."
            )
        
        try:
            # Prepare the screenshot (crop to ROI if specified)
            screenshot_base64 = encode_image_base64(request.screenshot)
            roi_offset_x = 0
            roi_offset_y = 0
            
            # Handle ROI cropping (Requirement 4.7)
            if request.roi:
                try:
                    screenshot_base64 = crop_to_roi(
                        screenshot_base64,
                        request.roi.x,
                        request.roi.y,
                        request.roi.width,
                        request.roi.height
                    )
                    roi_offset_x = request.roi.x
                    roi_offset_y = request.roi.y
                except Exception as crop_error:
                    # Continue with full image if cropping fails
                    print(f"Warning: Failed to crop image to ROI: {crop_error}")
            
            # Prepare reference images
            reference_images_base64: List[str] = []
            for ref_image in request.reference_images:
                try:
                    base64_data = encode_image_base64(ref_image)
                    reference_images_base64.append(base64_data)
                except Exception:
                    print("Warning: Failed to process reference image, skipping")
            
            # Make API request with timeout
            response = await self._call_gemini_vision_api(
                screenshot_base64,
                request.prompt,
                reference_images_base64,
                request.roi
            )
            
            # Adjust coordinates if ROI was used
            if response.success and response.x is not None and response.y is not None:
                response.x += roi_offset_x
                response.y += roi_offset_y
            
            return response
            
        except asyncio.TimeoutError:
            return AIVisionResponse(
                success=False,
                error=f"AI analysis timed out after {self._timeout_seconds} seconds. Please try again."
            )
        except Exception as error:
            error_message = str(error)
            
            # Check for timeout error
            if "timeout" in error_message.lower() or "aborted" in error_message.lower():
                return AIVisionResponse(
                    success=False,
                    error=f"AI analysis timed out after {self._timeout_seconds} seconds. Please try again."
                )
            
            return AIVisionResponse(
                success=False,
                error=f"AI analysis failed: {error_message}"
            )
    
    async def _call_gemini_vision_api(
        self,
        screenshot_base64: str,
        prompt: str,
        reference_images: List[str],
        roi: Optional[VisionROI] = None
    ) -> AIVisionResponse:
        """
        Make a request to the Gemini Vision API with timeout.
        
        Requirements: 4.6, 4.8, 4.10
        
        Args:
            screenshot_base64: Base64 encoded screenshot
            prompt: User prompt describing the target
            reference_images: List of base64 encoded reference images
            roi: Optional ROI (for context in prompt)
            
        Returns:
            AIVisionResponse with coordinates or error
        """
        if not self._api_key:
            raise ValueError("API key not configured")
        
        url = f"{GEMINI_API_BASE_URL}/models/{GEMINI_VISION_MODEL}:generateContent?key={self._api_key}"
        
        # Build the user message parts
        user_parts = []
        
        # Add the main screenshot
        user_parts.append({
            "inline_data": {
                "mime_type": "image/png",
                "data": screenshot_base64
            }
        })
        
        # Add reference images if provided (Requirement 4.8)
        for ref_image in reference_images:
            user_parts.append({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": ref_image
                }
            })
        
        # Build the prompt text
        prompt_text = f"Find the UI element described below in the screenshot.\n\nTarget: {prompt}"
        
        if reference_images:
            prompt_text += f"\n\nI have also provided {len(reference_images)} reference image(s) showing what the target element looks like. Use these to help identify the element."
        
        if roi:
            prompt_text += "\n\nNote: The screenshot has been cropped to a specific region. The coordinates you return should be relative to this cropped image (top-left is 0,0)."
        
        user_parts.append({"text": prompt_text})
        
        request_body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": VISION_SYSTEM_PROMPT}]
                },
                {
                    "role": "model",
                    "parts": [{
                        "text": "I understand. I will analyze screenshots to find UI elements and return their coordinates in the specified JSON format."
                    }]
                },
                {
                    "role": "user",
                    "parts": user_parts
                }
            ],
            "generationConfig": {
                "temperature": 0.1,  # Low temperature for deterministic results
                "topK": 1,
                "topP": 0.95,
                "maxOutputTokens": 256  # Small response needed
            }
        }
        
        # Create timeout for the request (Requirement 4.10)
        timeout = aiohttp.ClientTimeout(total=self._timeout_seconds)
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                url,
                json=request_body,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status != 200:
                    error_data = await response.json()
                    error_message = error_data.get("error", {}).get("message", f"API request failed with status {response.status}")
                    raise Exception(error_message)
                
                data = await response.json()
        
        if "error" in data:
            raise Exception(data["error"].get("message", "Unknown API error"))
        
        candidates = data.get("candidates", [])
        if not candidates:
            return AIVisionResponse(
                success=False,
                error="No response generated by AI. Please try again."
            )
        
        response_text = "".join(
            part.get("text", "") 
            for part in candidates[0].get("content", {}).get("parts", [])
        )
        
        # Parse the AI response
        result = parse_vision_result(response_text)
        
        if not result:
            return AIVisionResponse(
                success=False,
                error="Failed to parse AI response. The response was not in the expected format."
            )
        
        if not result["found"]:
            return AIVisionResponse(
                success=False,
                error=result.get("error", "Element not found in screenshot.")
            )
        
        return AIVisionResponse(
            success=True,
            x=result["x"],
            y=result["y"],
            confidence=result.get("confidence", 0.5)
        )


# Export singleton instance
ai_vision_service = AIVisionService()
