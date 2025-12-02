"""
Tests for script format validation and cross-core compatibility.

Requirements: 2.2, 3.5, 7.1, 7.2, 7.3
"""

import json
import pytest
from datetime import datetime
from typing import Dict, Any

from .models import ScriptFile, ScriptMetadata, Action
from .validation import (
    ScriptValidator, ScriptMigrator, CompatibilityTester,
    CompatibilityResult, CompatibilityIssue, IssueSeverity,
    validate_script_file, validate_script_json, migrate_script,
    cross_core_compatibility_test
)


class TestScriptValidator:
    """Test script validation functionality."""
    
    def test_valid_script_validation(self):
        """Test validation of a valid script."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=2.0,
            action_count=2,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.5, x=100, y=200),
            Action(type="mouse_click", timestamp=1.0, x=100, y=200, button="left")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        validator = ScriptValidator()
        result = validator.validate_script(script)
        
        assert result.is_compatible
        assert len(result.issues) == 0
        assert result.version == "1.0"
    
    def test_invalid_script_validation(self):
        """Test validation of an invalid script."""
        # Create script with valid Pydantic data but invalid for cross-core compatibility
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,  # Valid duration
            action_count=1,
            platform=""  # Invalid empty platform
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.5, x=100, y=200)  # Valid action
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        validator = ScriptValidator()
        result = validator.validate_script(script)
        
        assert not result.is_compatible
        assert len(result.issues) > 0
        
        # Check for specific issues
        issue_fields = [issue.field for issue in result.issues]
        assert "metadata.platform" in issue_fields
    
    def test_timestamp_ordering_validation(self):
        """Test validation of action timestamp ordering."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=2.0,
            action_count=2,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=1.0, x=100, y=200),
            Action(type="mouse_move", timestamp=0.5, x=150, y=250)  # Out of order
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        validator = ScriptValidator()
        result = validator.validate_script(script)
        
        assert not result.is_compatible
        timestamp_issues = [
            issue for issue in result.issues 
            if "timestamp" in issue.field and issue.severity == IssueSeverity.ERROR
        ]
        assert len(timestamp_issues) > 0
    
    def test_action_count_consistency(self):
        """Test validation of action count consistency."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=5,  # Incorrect count
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.5, x=100, y=200),
            Action(type="mouse_click", timestamp=1.0, x=100, y=200, button="left")
        ]  # Only 2 actions, not 5
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        validator = ScriptValidator()
        result = validator.validate_script(script)
        
        # Should be compatible but with warnings
        assert result.is_compatible
        count_issues = [
            issue for issue in result.issues 
            if "action_count" in issue.field and issue.severity == IssueSeverity.WARNING
        ]
        assert len(count_issues) > 0
    
    def test_json_validation(self):
        """Test validation of JSON data."""
        json_data = {
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": 1.0,
                "action_count": 1,
                "platform": "linux"
            },
            "actions": [
                {
                    "type": "mouse_click",
                    "timestamp": 0.5,
                    "x": 100,
                    "y": 200,
                    "button": "left"
                }
            ]
        }
        
        validator = ScriptValidator()
        result = validator.validate_json(json_data)
        
        assert result.is_compatible
        assert len(result.issues) == 0
    
    def test_invalid_json_validation(self):
        """Test validation of invalid JSON data."""
        invalid_json = '{"invalid": json}'
        
        validator = ScriptValidator()
        result = validator.validate_json(invalid_json)
        
        assert not result.is_compatible
        assert len(result.issues) > 0
        assert result.issues[0].severity == IssueSeverity.ERROR


class TestScriptMigrator:
    """Test script migration functionality."""
    
    def test_migration_0_9_to_1_0(self):
        """Test migration from version 0.9 to 1.0."""
        script_data = {
            "version": "0.9",
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": 1.0,
                "action_count": 2
                # Missing core_type and platform
            },
            "actions": [
                {
                    "type": "mousemove",  # Old format
                    "timestamp": 0.5,
                    "x": 100,
                    "y": 200
                },
                {
                    "type": "mouseclick",  # Old format
                    "timestamp": 1.0,
                    "x": 100,
                    "y": 200,
                    "button": "left"
                }
            ]
        }
        
        migrator = ScriptMigrator()
        new_version = migrator.migrate_to_latest(script_data)
        
        assert new_version == "1.0"
        assert script_data["version"] == "1.0"
        assert script_data["metadata"]["core_type"] == "python"
        assert script_data["metadata"]["platform"] == "unknown"
        assert script_data["actions"][0]["type"] == "mouse_move"
        assert script_data["actions"][1]["type"] == "mouse_click"
    
    def test_no_migration_needed(self):
        """Test when no migration is needed."""
        script_data = {
            "version": "1.0",
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": 1.0,
                "action_count": 1,
                "platform": "linux",
                "core_type": "python"
            },
            "actions": [
                {
                    "type": "mouse_click",
                    "timestamp": 0.5,
                    "x": 100,
                    "y": 200,
                    "button": "left"
                }
            ]
        }
        
        original_data = json.loads(json.dumps(script_data))  # Deep copy
        
        migrator = ScriptMigrator()
        new_version = migrator.migrate_to_latest(script_data)
        
        assert new_version == "1.0"
        assert script_data == original_data  # Should be unchanged


class TestCompatibilityTester:
    """Test cross-core compatibility testing."""
    
    def test_cross_core_compatibility_same_core(self):
        """Test compatibility when source and target cores are the same."""
        script_json = json.dumps({
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": 0.5,  # Match the last action timestamp
                "action_count": 1,
                "platform": "linux",
                "core_type": "python"
            },
            "actions": [
                {
                    "type": "mouse_click",
                    "timestamp": 0.5,
                    "x": 100,
                    "y": 200,
                    "button": "left"
                }
            ]
        })
        
        result = CompatibilityTester.test_cross_core_compatibility(
            script_json, "python", "python"
        )
        
        assert result.is_compatible
        # May have warnings about duration, but should be compatible
    
    def test_cross_core_compatibility_different_cores(self):
        """Test compatibility when source and target cores are different."""
        script_json = json.dumps({
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": 1.0,
                "action_count": 1,
                "platform": "linux",
                "core_type": "python"
            },
            "actions": [
                {
                    "type": "mouse_click",
                    "timestamp": 0.5,
                    "x": 100,
                    "y": 200,
                    "button": "left"
                }
            ]
        })
        
        result = CompatibilityTester.test_cross_core_compatibility(
            script_json, "python", "rust"
        )
        
        assert result.is_compatible
        assert len(result.warnings) > 0  # Should warn about core type mismatch
        assert any("python core" in warning and "rust core" in warning for warning in result.warnings)
    
    def test_generate_compatibility_report(self):
        """Test generation of compatibility report."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=1,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_click", timestamp=0.5, x=100, y=200, button="left")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        report = CompatibilityTester.generate_compatibility_report(script)
        
        assert "Script Compatibility Report" in report
        assert "Compatible: True" in report
        assert "Version: 1.0" in report


class TestUtilityFunctions:
    """Test utility functions."""
    
    def test_validate_script_file(self):
        """Test validate_script_file utility function."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=1,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_click", timestamp=0.5, x=100, y=200, button="left")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        result = validate_script_file(script)
        
        assert result.is_compatible
        assert len(result.issues) == 0
    
    def test_validate_script_json(self):
        """Test validate_script_json utility function."""
        json_data = {
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": 1.0,
                "action_count": 1,
                "platform": "linux"
            },
            "actions": [
                {
                    "type": "mouse_click",
                    "timestamp": 0.5,
                    "x": 100,
                    "y": 200,
                    "button": "left"
                }
            ]
        }
        
        result = validate_script_json(json_data)
        
        assert result.is_compatible
        assert len(result.issues) == 0
    
    def test_migrate_script(self):
        """Test migrate_script utility function."""
        script_data = {
            "version": "0.9",
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": 1.0,
                "action_count": 1
            },
            "actions": [
                {
                    "type": "mouseclick",
                    "timestamp": 0.5,
                    "x": 100,
                    "y": 200,
                    "button": "left"
                }
            ]
        }
        
        new_version = migrate_script(script_data)
        
        assert new_version == "1.0"
        assert script_data["version"] == "1.0"
        assert script_data["metadata"]["core_type"] == "python"
    
    def test_test_cross_core_compatibility(self):
        """Test test_cross_core_compatibility utility function."""
        script_json = json.dumps({
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": 1.0,
                "action_count": 1,
                "platform": "linux",
                "core_type": "python"
            },
            "actions": [
                {
                    "type": "mouse_click",
                    "timestamp": 0.5,
                    "x": 100,
                    "y": 200,
                    "button": "left"
                }
            ]
        })
        
        result = cross_core_compatibility_test(script_json, "python", "rust")
        
        assert result.is_compatible
        assert len(result.warnings) > 0


if __name__ == "__main__":
    pytest.main([__file__])
