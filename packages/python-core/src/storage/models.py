"""
Data models for script files and actions.

This module defines the Pydantic models used for recording, storing, and validating
user interaction data. These models ensure type safety and data integrity throughout
the recording and playback pipeline.

The models implement the JSON schema defined in the design document and provide
automatic validation, serialization, and deserialization.

Requirements: 3.1, 3.2, 3.3, 3.5, 5.1, 5.2, 5.3, 5.4
"""

from datetime import datetime
from typing import Literal, Optional, Union, Tuple, List
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# AI Vision Capture Models (Requirements: 5.1, 5.2, 5.3, 5.4)
# =============================================================================

class VisionROI(BaseModel):
    """
    Region of Interest for AI Vision Capture.
    
    Defines a rectangular region on the screenshot where the AI should focus
    its search. Used for Regional Search mode to optimize accuracy and performance.
    
    Attributes:
        x: X coordinate of the top-left corner (non-negative)
        y: Y coordinate of the top-left corner (non-negative)
        width: Width of the region (positive)
        height: Height of the region (positive)
    
    Requirements: 5.3
    """
    x: int = Field(ge=0, description="X coordinate of top-left corner")
    y: int = Field(ge=0, description="Y coordinate of top-left corner")
    width: int = Field(gt=0, description="Width of the region")
    height: int = Field(gt=0, description="Height of the region")


class StaticData(BaseModel):
    """
    Static data for AI Vision Capture action.
    
    Contains the original screenshot captured during recording and the
    saved coordinates determined during editing (Static Mode).
    
    Attributes:
        original_screenshot: Path to the screenshot file
        saved_x: X coordinate saved during editing (nullable)
        saved_y: Y coordinate saved during editing (nullable)
        screen_dim: Screen dimensions [width, height] at capture time
    
    Requirements: 5.2
    """
    original_screenshot: str = Field(description="Path to the original screenshot")
    saved_x: Optional[int] = Field(None, description="Saved X coordinate from Static Mode")
    saved_y: Optional[int] = Field(None, description="Saved Y coordinate from Static Mode")
    screen_dim: Tuple[int, int] = Field(description="Screen dimensions [width, height]")


class DynamicConfig(BaseModel):
    """
    Dynamic configuration for AI Vision Capture action.
    
    Contains the prompt, reference images, ROI, and search scope settings
    used when calling the AI service in Dynamic Mode.
    
    Attributes:
        prompt: User-provided description of the target element
        reference_images: List of paths to reference images
        roi: Region of Interest for Regional Search (nullable)
        search_scope: Search scope - 'global' or 'regional'
    
    Requirements: 5.3
    """
    prompt: str = Field(default="", description="User prompt describing the target")
    reference_images: List[str] = Field(default_factory=list, description="Paths to reference images")
    roi: Optional[VisionROI] = Field(None, description="Region of Interest for Regional Search")
    search_scope: Literal['global', 'regional'] = Field(default='global', description="Search scope")


class CacheData(BaseModel):
    """
    Cache data for AI Vision Capture action.
    
    Stores the coordinates returned by a successful Dynamic Mode AI call,
    along with the screen dimensions at cache time. This allows subsequent
    playback runs to use cached coordinates without calling AI (0 token cost).
    
    Attributes:
        cached_x: Cached X coordinate from successful AI call (nullable)
        cached_y: Cached Y coordinate from successful AI call (nullable)
        cache_dim: Screen dimensions when cache was created (nullable)
    
    Requirements: 5.4
    """
    cached_x: Optional[int] = Field(None, description="Cached X coordinate from AI")
    cached_y: Optional[int] = Field(None, description="Cached Y coordinate from AI")
    cache_dim: Optional[Tuple[int, int]] = Field(None, description="Screen dimensions at cache time")


class AIVisionCaptureAction(BaseModel):
    """
    AI Vision Capture action for intelligent element detection.
    
    This action type allows users to capture visual markers during recording
    and use AI to locate elements during playback. Supports two modes:
    
    - Static Mode (default): AI analyzes during editing, saves coordinates,
      playback uses saved coordinates (0 token cost)
    - Dynamic Mode: AI analyzes during playback to find elements on current
      screen, with intelligent caching to minimize token costs
    
    Attributes:
        type: Action type identifier ('ai_vision_capture')
        id: Unique identifier (UUID)
        timestamp: Time in seconds since recording started
        is_dynamic: Whether to use Dynamic Mode (default: False)
        interaction: Type of interaction to perform at found coordinates
        static_data: Static mode data (screenshot, saved coordinates)
        dynamic_config: Dynamic mode configuration (prompt, references, ROI)
        cache_data: Cached coordinates from successful Dynamic AI calls
    
    Requirements: 5.1, 5.2, 5.3, 5.4
    Validates: Property 2 (Round-trip Serialization Consistency)
    """
    type: Literal['ai_vision_capture'] = Field(default='ai_vision_capture', description="Action type")
    id: str = Field(description="Unique action identifier (UUID)")
    timestamp: float = Field(ge=0, description="Seconds since recording start")
    is_dynamic: bool = Field(default=False, description="Enable Dynamic Mode")
    interaction: Literal['click', 'dblclick', 'rclick', 'hover'] = Field(
        default='click', 
        description="Interaction type to perform"
    )
    static_data: StaticData = Field(description="Static mode data")
    dynamic_config: DynamicConfig = Field(default_factory=DynamicConfig, description="Dynamic mode config")
    cache_data: CacheData = Field(default_factory=CacheData, description="Cached AI results")


class Action(BaseModel):
    """
    Represents a single recorded user action.
    
    An Action captures a discrete user interaction such as moving the mouse,
    clicking a button, or pressing a key. Each action includes a timestamp
    relative to the recording start time and type-specific data.
    
    Action Types:
        - mouse_move: Mouse cursor movement (requires x, y)
        - mouse_click: Mouse button click (requires x, y, button)
        - key_press: Keyboard key pressed down (requires key)
        - key_release: Keyboard key released (requires key)
    
    Attributes:
        type: The type of action performed
        timestamp: Time in seconds since recording started (non-negative)
        x: X screen coordinate for mouse actions (None for keyboard)
        y: Y screen coordinate for mouse actions (None for keyboard)
        button: Mouse button identifier for clicks (None for other actions)
        key: Key identifier for keyboard actions (None for mouse actions)
        screenshot: Optional filename of screenshot captured with this action
    
    Examples:
        >>> Action(type='mouse_move', timestamp=0.5, x=100, y=200)
        >>> Action(type='mouse_click', timestamp=1.0, x=100, y=200, button='left')
        >>> Action(type='key_press', timestamp=1.5, key='a')
    
    Requirements: 3.3
    Validates: Property 2 (Script file format round-trip consistency)
    """
    
    type: Literal['mouse_move', 'mouse_click', 'key_press', 'key_release']
    timestamp: float = Field(ge=0, description="Seconds since recording start")
    x: Optional[int] = Field(None, description="X coordinate for mouse actions")
    y: Optional[int] = Field(None, description="Y coordinate for mouse actions")
    button: Optional[Literal['left', 'right', 'middle']] = Field(None, description="Mouse button for click actions")
    key: Optional[str] = Field(None, description="Key identifier for keyboard actions")
    screenshot: Optional[str] = Field(None, description="Filename of screenshot captured with this action")
    
    @field_validator('x', 'y', mode='before')
    @classmethod
    def validate_mouse_coordinates(cls, v, info):
        """
        Validate that mouse coordinates are present for mouse actions.
        
        Mouse actions (mouse_move, mouse_click) require both x and y coordinates
        to specify the screen position. This validator ensures data integrity.
        Converts float coordinates to integers.
        
        Args:
            v: The coordinate value being validated
            info: Validation context containing field name and other data
        
        Returns:
            The validated coordinate value as integer
        
        Raises:
            ValueError: If coordinate is None for a mouse action
        """
        # Convert float to int if needed
        if v is not None and isinstance(v, float):
            v = int(v)
        
        action_type = info.data.get('type')
        if action_type in ['mouse_move', 'mouse_click'] and v is None:
            raise ValueError(f"Coordinate {info.field_name} is required for {action_type}")
        return v
    
    @field_validator('button')
    @classmethod
    def validate_button(cls, v, info):
        """
        Validate that button is present for mouse_click actions.
        
        Click actions must specify which mouse button was pressed (left, right, middle).
        
        Args:
            v: The button value being validated
            info: Validation context containing other action data
        
        Returns:
            The validated button value
        
        Raises:
            ValueError: If button is None for a mouse_click action
        """
        action_type = info.data.get('type')
        if action_type == 'mouse_click' and v is None:
            raise ValueError("Button is required for mouse_click actions")
        return v
    
    @field_validator('key')
    @classmethod
    def validate_key(cls, v, info):
        """
        Validate that key is present for keyboard actions.
        
        Keyboard actions (key_press, key_release) must specify which key was
        pressed or released.
        
        Args:
            v: The key value being validated
            info: Validation context containing other action data
        
        Returns:
            The validated key value
        
        Raises:
            ValueError: If key is None for a keyboard action
        """
        action_type = info.data.get('type')
        if action_type in ['key_press', 'key_release'] and v is None:
            raise ValueError(f"Key is required for {action_type} actions")
        return v


class ScriptMetadata(BaseModel):
    """
    Metadata for a recorded script.
    
    Contains information about the recording session including when it was created,
    how long it lasted, how many actions were captured, and on which platform.
    This metadata is useful for debugging, AI processing, and user information.
    
    Attributes:
        version: Script format version (currently "1.0")
        created_at: ISO 8601 timestamp of when recording was created
        duration: Total recording time in seconds (non-negative)
        action_count: Number of actions in the script (non-negative)
        platform: Operating system identifier (windows, darwin, linux)
    
    Examples:
        >>> ScriptMetadata(
        ...     created_at=datetime.now(),
        ...     duration=45.5,
        ...     action_count=127,
        ...     platform='darwin'
        ... )
    
    Requirements: 3.1, 3.2
    """
    
    version: str = "1.0"
    created_at: datetime
    duration: float = Field(ge=0, description="Total recording duration in seconds")
    action_count: int = Field(ge=0, description="Number of actions in the script")
    platform: str = Field(description="Platform where recording was made (windows, darwin, linux)")


# =============================================================================
# Union type for all action types
# =============================================================================

# Type alias for any action type (existing + AI Vision Capture)
AnyAction = Union[Action, AIVisionCaptureAction]


class ScriptFile(BaseModel):
    """
    Complete script file with metadata and actions.
    
    Represents the full structure of a saved recording file. Combines metadata
    about the recording session with the list of captured actions. This model
    is used for both serialization (saving) and deserialization (loading) of
    script files.
    
    The JSON representation of this model matches the script file format defined
    in the design document, making it compatible with AI systems and manual editing.
    
    Supports both traditional actions (mouse_move, mouse_click, key_press, key_release)
    and AI Vision Capture actions for intelligent element detection.
    
    Attributes:
        metadata: Recording session metadata
        actions: List of captured user actions in chronological order (supports both Action and AIVisionCaptureAction)
        variables: Optional dictionary of variable names to default values for substitution
    
    Examples:
        >>> script = ScriptFile(
        ...     metadata=ScriptMetadata(...),
        ...     actions=[Action(...), Action(...)]
        ... )
        >>> json_str = script.model_dump_json()  # Serialize to JSON
        >>> loaded = ScriptFile.model_validate_json(json_str)  # Deserialize
    
    Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 5.4
    Validates: Property 2 (Script file format round-trip consistency)
    """
    
    metadata: ScriptMetadata
    actions: List[AnyAction]
    variables: Optional[dict[str, str]] = Field(default_factory=dict, description="Variable definitions for substitution")
