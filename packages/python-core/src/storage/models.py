"""Data models for script files and actions."""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class Action(BaseModel):
    """Represents a single recorded user action."""
    
    type: Literal['mouse_move', 'mouse_click', 'key_press', 'key_release']
    timestamp: float = Field(ge=0, description="Seconds since recording start")
    x: Optional[int] = Field(None, description="X coordinate for mouse actions")
    y: Optional[int] = Field(None, description="Y coordinate for mouse actions")
    button: Optional[Literal['left', 'right', 'middle']] = Field(None, description="Mouse button for click actions")
    key: Optional[str] = Field(None, description="Key identifier for keyboard actions")
    
    @field_validator('x', 'y')
    @classmethod
    def validate_mouse_coordinates(cls, v, info):
        """Validate that mouse coordinates are present for mouse actions."""
        action_type = info.data.get('type')
        if action_type in ['mouse_move', 'mouse_click'] and v is None:
            raise ValueError(f"Coordinate {info.field_name} is required for {action_type}")
        return v
    
    @field_validator('button')
    @classmethod
    def validate_button(cls, v, info):
        """Validate that button is present for mouse_click actions."""
        action_type = info.data.get('type')
        if action_type == 'mouse_click' and v is None:
            raise ValueError("Button is required for mouse_click actions")
        return v
    
    @field_validator('key')
    @classmethod
    def validate_key(cls, v, info):
        """Validate that key is present for keyboard actions."""
        action_type = info.data.get('type')
        if action_type in ['key_press', 'key_release'] and v is None:
            raise ValueError(f"Key is required for {action_type} actions")
        return v


class ScriptMetadata(BaseModel):
    """Metadata for a recorded script."""
    
    version: str = "1.0"
    created_at: datetime
    duration: float = Field(ge=0, description="Total recording duration in seconds")
    action_count: int = Field(ge=0, description="Number of actions in the script")
    platform: str = Field(description="Platform where recording was made (windows, darwin, linux)")


class ScriptFile(BaseModel):
    """Complete script file with metadata and actions."""
    
    metadata: ScriptMetadata
    actions: list[Action]
