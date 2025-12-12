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
import uuid
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
    
    Assertion Mode:
    When is_assertion is True, the action performs element detection only
    without any mouse/keyboard interactions. Used for test step validation.
    
    Attributes:
        type: Action type identifier ('ai_vision_capture')
        id: Unique identifier (UUID)
        timestamp: Time in seconds since recording started
        is_dynamic: Whether to use Dynamic Mode (default: False)
        is_assertion: Whether this is an assertion-only action (default: False)
        interaction: Type of interaction to perform at found coordinates
        static_data: Static mode data (screenshot, saved coordinates)
        dynamic_config: Dynamic mode configuration (prompt, references, ROI)
        cache_data: Cached coordinates from successful Dynamic AI calls
    
    Requirements: 3.1, 3.5, 5.1, 5.2, 5.3, 5.4
    Validates: Property 2 (Round-trip Serialization Consistency)
    """
    type: Literal['ai_vision_capture'] = Field(default='ai_vision_capture', description="Action type")
    id: str = Field(description="Unique action identifier (UUID)")
    timestamp: float = Field(ge=0, description="Seconds since recording start")
    is_dynamic: bool = Field(default=False, description="Enable Dynamic Mode")
    is_assertion: bool = Field(default=False, description="Assertion-only mode (no interactions)")
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
# Test Case Driven Automation Models (Requirements: 1.1, 1.2, 1.5, 8.1, 8.5)
# =============================================================================

class TestStep(BaseModel):
    """
    Individual step in a test case with description, expected result, and action references.
    
    A TestStep represents a logical grouping of actions that accomplish a specific
    test objective. Steps contain human-readable descriptions and reference actions
    by ID rather than embedding them directly.
    
    Attributes:
        id: Unique step identifier (UUID)
        order: Execution order (1-based, positive integer)
        description: Human-readable step description (required, non-empty)
        expected_result: Expected outcome description (optional)
        action_ids: List of action IDs referencing the action pool
        continue_on_failure: Whether to continue execution if step fails
        execution_condition: Optional condition for conditional execution
    
    Examples:
        >>> TestStep(
        ...     id="step-001",
        ...     order=1,
        ...     description="Navigate to login page",
        ...     expected_result="Login form is displayed",
        ...     action_ids=["action-001", "action-002"]
        ... )
    
    Requirements: 1.1, 1.2, 1.5, 7.5, 8.1
    Validates: Property 1 (Test Script Structure Validation), Property 14 (Conditional Execution)
    """
    
    id: str = Field(description="Unique step identifier (UUID)")
    order: int = Field(ge=1, description="Execution order (1-based)")
    description: str = Field(min_length=1, description="Human-readable step description")
    expected_result: str = Field(default="", description="Expected outcome description")
    action_ids: List[str] = Field(default_factory=list, description="References to actions in pool")
    continue_on_failure: bool = Field(default=False, description="Continue execution if step fails")
    execution_condition: Optional[str] = Field(default=None, description="Condition for conditional execution")
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        """
        Validate that step description is non-empty after stripping whitespace.
        
        Step descriptions must contain meaningful content to provide business value.
        Empty or whitespace-only descriptions are not allowed.
        
        Args:
            v: The description value being validated
        
        Returns:
            The validated description value
        
        Raises:
            ValueError: If description is empty or contains only whitespace
        """
        if not v or not v.strip():
            raise ValueError("Step description cannot be empty or whitespace-only")
        return v.strip()


class TestScript(BaseModel):
    """
    Enhanced script file with hierarchical test step structure.
    
    TestScript extends the flat action list approach with a structured hierarchy:
    - Metadata: Script information (title, description, pre-conditions, tags)
    - Steps: Ordered list of test steps with descriptions and action references
    - Action Pool: Flat repository of all actions referenced by ID
    - Variables: Optional variable definitions for substitution
    
    This structure enables business-readable test organization while maintaining
    full technical functionality and backward compatibility.
    
    Attributes:
        meta: Enhanced metadata including title, description, pre-conditions, tags
        steps: Ordered list of test steps
        action_pool: Dictionary of actions keyed by ID
        variables: Optional variable definitions for substitution
    
    Examples:
        >>> TestScript(
        ...     meta=EnhancedScriptMetadata(...),
        ...     steps=[TestStep(...), TestStep(...)],
        ...     action_pool={"action-001": Action(...), "action-002": Action(...)}
        ... )
    
    Requirements: 1.1, 1.2, 1.5, 8.1, 8.5
    Validates: Property 1 (Test Script Structure Validation)
    """
    
    meta: 'EnhancedScriptMetadata'
    steps: List[TestStep] = Field(default_factory=list, description="Ordered list of test steps")
    action_pool: dict[str, Union[Action, AIVisionCaptureAction]] = Field(default_factory=dict, description="Actions keyed by ID")
    variables: dict[str, str] = Field(default_factory=dict, description="Variable definitions")
    
    @field_validator('steps')
    @classmethod
    def validate_step_order(cls, v):
        """
        Validate that test steps have unique IDs and sequential order numbers.
        
        Ensures data integrity by checking that:
        - All step IDs are unique within the script
        - Order numbers start at 1 and are sequential
        - No duplicate order numbers exist
        
        Args:
            v: List of test steps being validated
        
        Returns:
            The validated list of test steps
        
        Raises:
            ValueError: If step IDs are not unique or order is not sequential
        """
        if not v:
            return v
        
        # Check unique step IDs
        step_ids = [step.id for step in v]
        if len(step_ids) != len(set(step_ids)):
            raise ValueError("All step IDs must be unique within the script")
        
        # Check sequential order starting from 1
        expected_orders = list(range(1, len(v) + 1))
        actual_orders = sorted([step.order for step in v])
        if actual_orders != expected_orders:
            raise ValueError(f"Step orders must be sequential starting from 1, got: {actual_orders}")
        
        return v
    
    @field_validator('action_pool')
    @classmethod
    def validate_action_pool(cls, v):
        """
        Validate that action pool contains valid actions with unique IDs.
        
        Ensures that all actions in the pool are properly formed and have
        unique identifiers for referencing from test steps.
        
        Args:
            v: Dictionary of actions being validated
        
        Returns:
            The validated action pool dictionary
        
        Raises:
            ValueError: If action pool contains invalid data
        """
        if not isinstance(v, dict):
            raise ValueError("Action pool must be a dictionary")
        
        # Validate that all keys are non-empty strings
        for action_id in v.keys():
            if not isinstance(action_id, str) or not action_id.strip():
                raise ValueError("All action IDs must be non-empty strings")
        
        return v


class EnhancedScriptMetadata(BaseModel):
    """
    Enhanced metadata for test scripts with business context.
    
    Extends the basic ScriptMetadata with additional fields needed for
    test case driven automation including title, description, pre-conditions,
    and tags for organization and searchability.
    
    Attributes:
        version: Script format version (currently "2.0" for step-based)
        created_at: ISO 8601 timestamp of when script was created
        duration: Total recording time in seconds (non-negative)
        action_count: Number of actions in the action pool (non-negative)
        platform: Operating system identifier (windows, darwin, linux)
        title: Human-readable script title (required)
        description: Detailed script description (optional)
        pre_conditions: Prerequisites for running the script (optional)
        tags: List of tags for organization and filtering
    
    Examples:
        >>> EnhancedScriptMetadata(
        ...     title="User Login Test",
        ...     description="Validates user authentication flow",
        ...     pre_conditions="Application must be running on localhost:3000",
        ...     tags=["authentication", "smoke-test"],
        ...     created_at=datetime.now(),
        ...     duration=45.5,
        ...     action_count=127,
        ...     platform='darwin'
        ... )
    
    Requirements: 1.1, 1.2, 8.1
    Validates: Property 1 (Test Script Structure Validation)
    """
    
    version: str = Field(default="2.0", description="Script format version")
    created_at: datetime = Field(description="Script creation timestamp")
    duration: float = Field(ge=0, description="Total recording duration in seconds")
    action_count: int = Field(ge=0, description="Number of actions in the action pool")
    platform: str = Field(description="Platform where recording was made")
    title: str = Field(min_length=1, description="Human-readable script title")
    description: str = Field(default="", description="Detailed script description")
    pre_conditions: str = Field(default="", description="Prerequisites for running the script")
    tags: List[str] = Field(default_factory=list, description="Tags for organization")
    
    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        """
        Validate that script title is non-empty after stripping whitespace.
        
        Script titles must contain meaningful content for identification.
        Empty or whitespace-only titles are not allowed.
        
        Args:
            v: The title value being validated
        
        Returns:
            The validated title value
        
        Raises:
            ValueError: If title is empty or contains only whitespace
        """
        if not v or not v.strip():
            raise ValueError("Script title cannot be empty or whitespace-only")
        return v.strip()
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        """
        Validate that all tags are non-empty strings.
        
        Tags must be meaningful identifiers for filtering and organization.
        Empty or whitespace-only tags are filtered out.
        
        Args:
            v: List of tags being validated
        
        Returns:
            The validated list of tags with empty ones removed
        """
        if not v:
            return v
        
        # Filter out empty or whitespace-only tags
        valid_tags = [tag.strip() for tag in v if tag and tag.strip()]
        return valid_tags


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

# =============================================================================
# Migration Logic (Requirements: 6.1, 6.2, 6.3, 6.4)
# =============================================================================


def migrate_legacy_script(legacy_script: ScriptFile) -> Tuple[TestScript, bool]:
    """
    Migrate a legacy flat script to the new step-based format.
    
    Converts existing ScriptFile format to TestScript format by:
    1. Creating enhanced metadata with default title and description
    2. Placing all legacy actions in a default "Step 1: Legacy Import" step
    3. Building action pool with generated UUIDs for all actions
    4. Preserving all original action data and metadata
    
    Args:
        legacy_script: The original ScriptFile to migrate
    
    Returns:
        Tuple of (migrated_test_script, success_flag)
        - migrated_test_script: The new TestScript format
        - success_flag: True if migration succeeded, False if it failed
    
    Examples:
        >>> legacy = ScriptFile(metadata=..., actions=[...])
        >>> migrated, success = migrate_legacy_script(legacy)
        >>> if success:
        ...     # Use migrated TestScript
        ...     pass
    
    Requirements: 6.1, 6.2, 6.3, 6.4
    Validates: Property 16 (Legacy Migration Correctness)
    """
    try:
        # Generate UUIDs for all actions
        action_ids = [str(uuid.uuid4()) for _ in legacy_script.actions]
        
        # Build action pool with generated IDs
        action_pool = {
            action_id: action 
            for action_id, action in zip(action_ids, legacy_script.actions)
        }
        
        # Create default step for all legacy actions
        default_step = TestStep(
            id=str(uuid.uuid4()),
            order=1,
            description="Legacy Import - Migrated Actions",
            expected_result="All actions execute successfully",
            action_ids=action_ids,
            continue_on_failure=False
        )
        
        # Create enhanced metadata from legacy metadata
        enhanced_meta = EnhancedScriptMetadata(
            version="2.0",
            created_at=legacy_script.metadata.created_at,
            duration=legacy_script.metadata.duration,
            action_count=legacy_script.metadata.action_count,
            platform=legacy_script.metadata.platform,
            title="Migrated Script",
            description="Automatically migrated from legacy format",
            pre_conditions="",
            tags=["migrated", "legacy"]
        )
        
        # Create new TestScript
        migrated_script = TestScript(
            meta=enhanced_meta,
            steps=[default_step],
            action_pool=action_pool,
            variables=legacy_script.variables or {}
        )
        
        return migrated_script, True
        
    except Exception as e:
        # Migration failed - return empty TestScript and failure flag
        # The caller should preserve the original script and log the error
        empty_meta = EnhancedScriptMetadata(
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform="unknown",
            title="Migration Failed"
        )
        
        empty_script = TestScript(
            meta=empty_meta,
            steps=[],
            action_pool={},
            variables={}
        )
        
        return empty_script, False


def is_legacy_format(script_data: dict) -> bool:
    """
    Determine if a script file is in legacy format.
    
    Checks the structure of loaded JSON data to determine if it's the old
    flat format (ScriptFile) or new step-based format (TestScript).
    
    Args:
        script_data: Dictionary loaded from JSON script file
    
    Returns:
        True if the script is in legacy format, False if it's new format
    
    Examples:
        >>> legacy_data = {"metadata": {...}, "actions": [...]}
        >>> is_legacy_format(legacy_data)  # True
        >>> new_data = {"meta": {...}, "steps": [...], "action_pool": {...}}
        >>> is_legacy_format(new_data)  # False
    
    Requirements: 6.1, 6.5
    """
    # Legacy format has "metadata" and "actions" fields
    # New format has "meta", "steps", and "action_pool" fields
    has_legacy_fields = "metadata" in script_data and "actions" in script_data
    has_new_fields = "meta" in script_data and "steps" in script_data and "action_pool" in script_data
    
    # If it has legacy fields but not new fields, it's legacy format
    if has_legacy_fields and not has_new_fields:
        return True
    
    # If it has new fields, it's new format
    if has_new_fields:
        return False
    
    # If it has neither set of fields clearly, assume legacy for safety
    return True


def load_script_with_migration(script_data: dict) -> Tuple[TestScript, bool, bool]:
    """
    Load a script file with automatic migration support.
    
    Handles both legacy and new format script files:
    1. Detects the format using is_legacy_format()
    2. If legacy, migrates to new format using migrate_legacy_script()
    3. If new, loads directly as TestScript
    4. Returns the loaded script with migration status
    
    Args:
        script_data: Dictionary loaded from JSON script file
    
    Returns:
        Tuple of (test_script, was_migrated, success)
        - test_script: The loaded TestScript (migrated if necessary)
        - was_migrated: True if migration was performed
        - success: True if loading/migration succeeded
    
    Examples:
        >>> with open("script.json") as f:
        ...     data = json.load(f)
        >>> script, migrated, success = load_script_with_migration(data)
        >>> if success:
        ...     if migrated:
        ...         print("Script was migrated from legacy format")
        ...     # Use script normally
    
    Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
    Validates: Property 16 (Legacy Migration Correctness), Property 17 (Format Compatibility)
    """
    try:
        if is_legacy_format(script_data):
            # Load as legacy format first
            legacy_script = ScriptFile.model_validate(script_data)
            
            # Migrate to new format
            migrated_script, migration_success = migrate_legacy_script(legacy_script)
            
            return migrated_script, True, migration_success
        else:
            # Load directly as new format
            test_script = TestScript.model_validate(script_data)
            return test_script, False, True
            
    except Exception as e:
        # Loading failed - return empty script
        empty_meta = EnhancedScriptMetadata(
            created_at=datetime.now(),
            duration=0.0,
            action_count=0,
            platform="unknown",
            title="Loading Failed"
        )
        
        empty_script = TestScript(
            meta=empty_meta,
            steps=[],
            action_pool={},
            variables={}
        )
        
        return empty_script, False, False
