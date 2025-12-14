"""
Script format validation and cross-core compatibility utilities.

This module provides comprehensive validation for script files to ensure
compatibility between Python and Rust automation cores. It includes JSON
schema validation, format migration utilities, and compatibility testing.

Requirements: 2.2, 3.5, 7.1, 7.2, 7.3
"""

import json
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from pydantic import BaseModel, Field, ValidationError

from .models import ScriptFile, ScriptMetadata, Action


class IssueSeverity(str, Enum):
    """Severity levels for compatibility issues."""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class CompatibilityIssue(BaseModel):
    """Compatibility issue details."""
    severity: IssueSeverity
    field: str
    message: str
    suggestion: Optional[str] = None


class CompatibilityResult(BaseModel):
    """Compatibility test result."""
    is_compatible: bool
    version: str
    core_type: str
    issues: List[CompatibilityIssue] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class ScriptSchema(BaseModel):
    """JSON schema for script file validation."""
    version: str = "1.0"
    required_fields: List[str] = Field(default_factory=lambda: [
        "metadata", "actions"
    ])
    action_types: List[str] = Field(default_factory=lambda: [
        "mouse_move", "mouse_click", "mouse_double_click", "mouse_drag",
        "mouse_scroll", "key_press", "key_release", "key_type",
        "screenshot", "wait", "custom"
    ])
    metadata_fields: List[str] = Field(default_factory=lambda: [
        "created_at", "duration", "action_count", "platform"
    ])


class ScriptValidator:
    """Script format validator for cross-core compatibility."""
    
    def __init__(self):
        self.schema = ScriptSchema()
        self.supported_versions = ["1.0"]
    
    def validate_script(self, script: ScriptFile) -> CompatibilityResult:
        """Validate a script file for cross-core compatibility."""
        issues = []
        warnings = []
        
        # Validate version
        version = getattr(script.metadata, 'version', '1.0')
        if version not in self.supported_versions:
            issues.append(CompatibilityIssue(
                severity=IssueSeverity.ERROR,
                field="metadata.version",
                message=f"Unsupported script version: {version}",
                suggestion=f"Supported versions: {self.supported_versions}"
            ))
        
        # Validate metadata
        self._validate_metadata(script.metadata, issues, warnings)
        
        # Validate actions
        self._validate_actions(script.actions, issues, warnings)
        
        # Check action count consistency
        if script.metadata.action_count != len(script.actions):
            issues.append(CompatibilityIssue(
                severity=IssueSeverity.WARNING,
                field="metadata.action_count",
                message="Action count in metadata doesn't match actual actions",
                suggestion="Update metadata.action_count to match len(actions)"
            ))
        
        # Check duration consistency
        if script.actions:
            last_timestamp = script.actions[-1].timestamp
            if abs(script.metadata.duration - last_timestamp) > 0.1:
                warnings.append("Duration in metadata may not match last action timestamp")
        
        is_compatible = all(
            issue.severity != IssueSeverity.ERROR for issue in issues
        )
        
        return CompatibilityResult(
            is_compatible=is_compatible,
            version=version,
            core_type=getattr(script.metadata, 'core_type', 'python'),
            issues=issues,
            warnings=warnings
        )
    
    def _validate_metadata(
        self, 
        metadata: ScriptMetadata, 
        issues: List[CompatibilityIssue], 
        warnings: List[str]
    ) -> None:
        """Validate script metadata."""
        # Check platform
        if not metadata.platform:
            issues.append(CompatibilityIssue(
                severity=IssueSeverity.ERROR,
                field="metadata.platform",
                message="Platform cannot be empty",
                suggestion="Set platform to 'windows', 'macos', or 'linux'"
            ))
        elif metadata.platform not in ["windows", "macos", "linux", "darwin"]:
            warnings.append(f"Unknown platform: {metadata.platform}")
        
        # Validate duration
        if metadata.duration < 0.0:
            issues.append(CompatibilityIssue(
                severity=IssueSeverity.ERROR,
                field="metadata.duration",
                message="Duration cannot be negative",
                suggestion="Set duration to a non-negative value"
            ))
        
        # Check core type if present
        core_type = getattr(metadata, 'core_type', None)
        if core_type and core_type not in ["python", "rust"]:
            warnings.append(f"Unknown core type: {core_type}")
    
    def _validate_actions(
        self, 
        actions: List[Action], 
        issues: List[CompatibilityIssue], 
        warnings: List[str]
    ) -> None:
        """Validate script actions."""
        last_timestamp = 0.0
        
        for index, action in enumerate(actions):
            # Validate timestamp ordering
            if action.timestamp < last_timestamp:
                issues.append(CompatibilityIssue(
                    severity=IssueSeverity.ERROR,
                    field=f"actions[{index}].timestamp",
                    message="Action timestamps must be in chronological order",
                    suggestion="Sort actions by timestamp"
                ))
            last_timestamp = action.timestamp
            
            # Validate action type
            if action.type not in self.schema.action_types:
                warnings.append(f"Unknown action type: {action.type}")
            
            # Validate action-specific fields
            self._validate_action_fields(action, index, issues)
    
    def _validate_action_fields(
        self, 
        action: Action, 
        index: int, 
        issues: List[CompatibilityIssue]
    ) -> None:
        """Validate action-specific required fields."""
        if action.type in ["mouse_move", "mouse_click", "mouse_double_click", "mouse_drag"]:
            if action.x is None or action.y is None:
                issues.append(CompatibilityIssue(
                    severity=IssueSeverity.ERROR,
                    field=f"actions[{index}]",
                    message="Mouse actions require x and y coordinates",
                    suggestion="Add x and y fields to the action"
                ))
        
        if action.type in ["mouse_click", "mouse_double_click"]:
            if action.button is None:
                issues.append(CompatibilityIssue(
                    severity=IssueSeverity.ERROR,
                    field=f"actions[{index}].button",
                    message="Click actions require a button field",
                    suggestion="Add button field ('left', 'right', or 'middle')"
                ))
        
        if action.type in ["key_press", "key_release"]:
            if action.key is None:
                issues.append(CompatibilityIssue(
                    severity=IssueSeverity.ERROR,
                    field=f"actions[{index}].key",
                    message="Keyboard actions require a key field",
                    suggestion="Add key field with the key identifier"
                ))
    
    def validate_json(self, json_data: Union[str, Dict[str, Any]]) -> CompatibilityResult:
        """Validate a JSON value against the script schema."""
        try:
            if isinstance(json_data, str):
                data = json.loads(json_data)
            else:
                data = json_data
            
            # Parse JSON into ScriptFile
            script = ScriptFile.model_validate(data)
            return self.validate_script(script)
            
        except (json.JSONDecodeError, ValidationError) as e:
            return CompatibilityResult(
                is_compatible=False,
                version="unknown",
                core_type="unknown",
                issues=[CompatibilityIssue(
                    severity=IssueSeverity.ERROR,
                    field="root",
                    message=f"Failed to parse script JSON: {e}",
                    suggestion="Check JSON syntax and structure"
                )]
            )
    
    def is_compatible_with_core(self, script: ScriptFile, core_type: str) -> bool:
        """Check if a script is compatible with a specific core type."""
        result = self.validate_script(script)
        
        # Check for core-specific compatibility issues
        has_core_issues = any(
            issue.field.startswith("core_type") and issue.severity == IssueSeverity.ERROR
            for issue in result.issues
        )
        
        return result.is_compatible and not has_core_issues


class ScriptMigrator:
    """Migration utility for script format upgrades."""
    
    def __init__(self):
        self.migrations = {
            "0.9:1.0": self._migrate_0_9_to_1_0
        }
    
    def migrate_to_latest(self, script_data: Dict[str, Any]) -> str:
        """Migrate a script to the latest supported version."""
        current_version = script_data.get("version", "0.9")
        target_version = "1.0"
        
        if current_version == target_version:
            return target_version
        
        # Apply migrations in sequence
        migration_key = f"{current_version}:{target_version}"
        if migration_key in self.migrations:
            self.migrations[migration_key](script_data)
            script_data["version"] = target_version
        
        return target_version
    
    def _migrate_0_9_to_1_0(self, script_data: Dict[str, Any]) -> None:
        """Migration from version 0.9 to 1.0."""
        # Add missing metadata fields if they don't exist
        metadata = script_data.setdefault("metadata", {})
        
        # Add core_type if missing
        if "core_type" not in metadata:
            metadata["core_type"] = "python"
        
        # Add platform if missing
        if "platform" not in metadata:
            metadata["platform"] = "unknown"
        
        # Ensure action_count matches actions length
        actions = script_data.get("actions", [])
        metadata["action_count"] = len(actions)
        
        # Normalize action types to snake_case
        for action in actions:
            if "type" in action:
                action["type"] = self._normalize_action_type(action["type"])
    
    def _normalize_action_type(self, action_type: str) -> str:
        """Normalize action type to snake_case format."""
        type_mapping = {
            "mousemove": "mouse_move",
            "mouseclick": "mouse_click",
            "mousedoubleclick": "mouse_double_click",
            "mousedrag": "mouse_drag",
            "mousescroll": "mouse_scroll",
            "keypress": "key_press",
            "keyrelease": "key_release",
            "keytype": "key_type",
        }
        
        return type_mapping.get(action_type.lower(), action_type)


class CompatibilityTester:
    """Utility functions for cross-core compatibility testing."""
    
    @staticmethod
    def test_cross_core_compatibility(
        script_json: str, 
        source_core: str, 
        target_core: str
    ) -> CompatibilityResult:
        """Test if a script created by one core can be read by another."""
        validator = ScriptValidator()
        
        # Validate the script
        result = validator.validate_json(script_json)
        
        # Add cross-core specific checks
        if source_core != target_core:
            try:
                data = json.loads(script_json)
                metadata = data.get("metadata", {})
                core_type = metadata.get("core_type")
                
                if core_type and core_type != target_core:
                    result.warnings.append(
                        f"Script was created with {core_type} core but will be played with {target_core} core"
                    )
            except json.JSONDecodeError:
                pass  # Already handled in validation
        
        return result
    
    @staticmethod
    def generate_compatibility_report(script: ScriptFile) -> str:
        """Generate a compatibility report for a script."""
        validator = ScriptValidator()
        result = validator.validate_script(script)
        
        report = []
        report.append("Script Compatibility Report")
        report.append("==========================")
        report.append("")
        report.append(f"Version: {result.version}")
        report.append(f"Core Type: {result.core_type}")
        report.append(f"Compatible: {result.is_compatible}")
        report.append("")
        
        if result.issues:
            report.append("Issues:")
            for issue in result.issues:
                report.append(f"  [{issue.severity.value.upper()}] {issue.field}: {issue.message}")
                if issue.suggestion:
                    report.append(f"    Suggestion: {issue.suggestion}")
            report.append("")
        
        if result.warnings:
            report.append("Warnings:")
            for warning in result.warnings:
                report.append(f"  - {warning}")
        
        return "\n".join(report)


# Utility functions for easy access
def validate_script_file(script: ScriptFile) -> CompatibilityResult:
    """Validate a script file for compatibility."""
    validator = ScriptValidator()
    return validator.validate_script(script)


def validate_script_json(json_data: Union[str, Dict[str, Any]]) -> CompatibilityResult:
    """Validate script JSON data for compatibility."""
    validator = ScriptValidator()
    return validator.validate_json(json_data)


def migrate_script(script_data: Dict[str, Any]) -> str:
    """Migrate a script to the latest version."""
    migrator = ScriptMigrator()
    return migrator.migrate_to_latest(script_data)


def cross_core_compatibility_test(
    script_json: str, 
    source_core: str, 
    target_core: str
) -> CompatibilityResult:
    """Test cross-core compatibility."""
    return CompatibilityTester.test_cross_core_compatibility(
        script_json, source_core, target_core
    )
