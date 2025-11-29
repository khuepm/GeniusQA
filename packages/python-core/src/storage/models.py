"""
Data models for script files and actions.

This module defines the Pydantic models used for recording, storing, and validating
user interaction data. These models ensure type safety and data integrity throughout
the recording and playback pipeline.

The models implement the JSON schema defined in the design document and provide
automatic validation, serialization, and deserialization.

Requirements: 3.1, 3.2, 3.3, 3.5
"""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


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
    
    @field_validator('x', 'y')
    @classmethod
    def validate_mouse_coordinates(cls, v, info):
        """
        Validate that mouse coordinates are present for mouse actions.
        
        Mouse actions (mouse_move, mouse_click) require both x and y coordinates
        to specify the screen position. This validator ensures data integrity.
        
        Args:
            v: The coordinate value being validated
            info: Validation context containing field name and other data
        
        Returns:
            The validated coordinate value
        
        Raises:
            ValueError: If coordinate is None for a mouse action
        """
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


class ScriptFile(BaseModel):
    """
    Complete script file with metadata and actions.
    
    Represents the full structure of a saved recording file. Combines metadata
    about the recording session with the list of captured actions. This model
    is used for both serialization (saving) and deserialization (loading) of
    script files.
    
    The JSON representation of this model matches the script file format defined
    in the design document, making it compatible with AI systems and manual editing.
    
    Attributes:
        metadata: Recording session metadata
        actions: List of captured user actions in chronological order
        variables: Optional dictionary of variable names to default values for substitution
    
    Examples:
        >>> script = ScriptFile(
        ...     metadata=ScriptMetadata(...),
        ...     actions=[Action(...), Action(...)]
        ... )
        >>> json_str = script.model_dump_json()  # Serialize to JSON
        >>> loaded = ScriptFile.model_validate_json(json_str)  # Deserialize
    
    Requirements: 3.1, 3.2, 3.3
    Validates: Property 2 (Script file format round-trip consistency)
    """
    
    metadata: ScriptMetadata
    actions: list[Action]
    variables: Optional[dict[str, str]] = Field(default_factory=dict, description="Variable definitions for substitution")
