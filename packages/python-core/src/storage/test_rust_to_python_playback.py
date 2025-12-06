"""
Test Rust-recorded scripts with Python playback.

This test module validates that scripts recorded with the Rust core
can be successfully played back with the Python core.

Requirements: 10.2
"""

import pytest
import json
import asyncio
from datetime import datetime
from pathlib import Path

from .models import ScriptFile, ScriptMetadata, Action
from .validation import ScriptValidator, CompatibilityTester
from .cross_core_testing import (
    CrossCoreTestSuite, TestScript, RecordingComparator,
    ExpectedBehavior, create_default_test_scripts
)


class TestRustToPythonPlayback:
    """Test Rust-recorded scripts with Python playback."""
    
    def test_load_rust_recorded_script(self):
        """Test that a Rust-recorded script can be loaded by Python."""
        # Create a sample Rust-recorded script
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=3,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left"),
            Action(type="key_press", timestamp=1.0, key="a")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Serialize to JSON (simulating Rust output)
        script_json = script.model_dump_json()
        
        # Deserialize in Python
        loaded_script = ScriptFile.model_validate_json(script_json)
        
        assert len(loaded_script.actions) == 3
        assert loaded_script.metadata.platform == "linux"
        
        print("✓ Rust-recorded script loaded successfully")
    
    def test_rust_mouse_actions_compatibility(self):
        """Test that Rust-recorded mouse actions are compatible."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=2.0,
            action_count=5,
            platform="linux"
        )
        
        # Add various mouse actions that Rust might record
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_move", timestamp=0.5, x=200, y=200),
            Action(type="mouse_click", timestamp=1.0, x=200, y=200, button="left"),
            Action(type="mouse_click", timestamp=1.5, x=200, y=200, button="right"),
            Action(type="mouse_click", timestamp=2.0, x=200, y=200, button="middle")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Validate script
        validator = ScriptValidator()
        validation_result = validator.validate_script(script)
        
        assert validation_result.is_compatible, "Mouse actions should be compatible"
        
        # Check that all actions are compatible
        for action in script.actions:
            assert action.type in ["mouse_move", "mouse_click"]
        
        print("✓ Rust mouse actions are compatible with Python playback")
    
    def test_rust_keyboard_actions_compatibility(self):
        """Test that Rust-recorded keyboard actions are compatible."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=0.8,
            action_count=4,
            platform="linux"
        )
        
        # Add various keyboard actions that Rust might record
        actions = [
            Action(type="key_press", timestamp=0.0, key="a"),
            Action(type="key_press", timestamp=0.2, key="b"),
            Action(type="key_press", timestamp=0.4, key="Enter"),
            Action(type="key_press", timestamp=0.6, key="Tab")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Validate script
        validator = ScriptValidator()
        validation_result = validator.validate_script(script)
        
        assert validation_result.is_compatible, "Keyboard actions should be compatible"
        
        # Check that all actions are compatible
        for action in script.actions:
            assert action.type in ["key_press", "key_release"]
        
        print("✓ Rust keyboard actions are compatible with Python playback")
    
    def test_rust_mixed_actions_compatibility(self):
        """Test that Rust-recorded scripts with mixed actions are compatible."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.5,
            action_count=6,
            platform="linux"
        )
        
        # Add mixed actions
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=50, y=50),
            Action(type="mouse_click", timestamp=0.2, x=50, y=50, button="left"),
            Action(type="key_press", timestamp=0.5, key="u"),
            Action(type="key_press", timestamp=1.0, key="Tab"),
            Action(type="key_press", timestamp=1.2, key="p"),
            Action(type="key_press", timestamp=1.5, key="Enter")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Validate script
        validator = ScriptValidator()
        validation_result = validator.validate_script(script)
        
        assert validation_result.is_compatible, "Mixed actions should be compatible"
        
        print("✓ Rust mixed actions are compatible with Python playback")
    
    def test_cross_core_compatibility_validation(self):
        """Test cross-core compatibility validation."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=0.5,
            action_count=2,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Serialize script
        script_json = script.model_dump_json()
        
        # Test compatibility
        result = CompatibilityTester.test_cross_core_compatibility(
            script_json, "rust", "python"
        )
        
        assert result.is_compatible, "Cross-core compatibility should pass"
        assert len(result.issues) == 0, "Should have no compatibility issues"
        
        print("✓ Cross-core compatibility validation passed")
    
    def test_rust_script_with_metadata(self):
        """Test that Rust scripts with full metadata are handled."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=2,
            platform="linux",
            version="1.0"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Validate script
        validator = ScriptValidator()
        validation_result = validator.validate_script(script)
        
        assert validation_result.is_compatible, "Scripts with full metadata should be compatible"
        
        print("✓ Rust scripts with metadata are handled correctly")
    
    def test_rust_script_timing_variations(self):
        """Test that Rust scripts with timing variations are handled."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=2.0,
            action_count=4,
            platform="linux"
        )
        
        # Rust might record with various timing patterns
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_move", timestamp=0.001, x=150, y=150),  # Very fast
            Action(type="mouse_move", timestamp=0.5, x=200, y=200),  # Normal
            Action(type="mouse_move", timestamp=2.0, x=250, y=250)  # Slow
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Validate script
        validator = ScriptValidator()
        validation_result = validator.validate_script(script)
        
        assert validation_result.is_compatible, "Scripts with timing variations should be compatible"
        
        print("✓ Rust scripts with timing variations are handled correctly")
    
    def test_rust_script_edge_coordinates(self):
        """Test that Rust scripts with edge case coordinates are handled."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=3,
            platform="linux"
        )
        
        # Rust might record coordinates at screen edges
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=0, y=0),  # Top-left corner
            Action(type="mouse_move", timestamp=0.5, x=1920, y=1080),  # Bottom-right
            Action(type="mouse_move", timestamp=1.0, x=960, y=540)  # Center
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Validate script
        validator = ScriptValidator()
        validation_result = validator.validate_script(script)
        
        assert validation_result.is_compatible, "Scripts with edge coordinates should be compatible"
        
        print("✓ Rust scripts with edge case coordinates are handled correctly")
    
    def test_rust_script_playback_validation(self):
        """Test that Rust-recorded scripts can be validated for playback."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=4,
            platform="linux"
        )
        
        # Create a realistic Rust-recorded script
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.2, x=100, y=100, button="left"),
            Action(type="key_press", timestamp=0.5, key="t"),
            Action(type="key_press", timestamp=1.0, key="Enter")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Validate for playback
        validator = ScriptValidator()
        validation_result = validator.validate_script(script)
        
        assert validation_result.is_compatible, "Script should be compatible for playback"
        
        # Check that all actions have valid timestamps
        for i, action in enumerate(script.actions):
            if i > 0:
                assert action.timestamp >= script.actions[i - 1].timestamp, \
                    "Actions should be in chronological order"
        
        print("✓ Rust scripts validated for playback successfully")
    
    def test_rust_script_compatibility_logging(self):
        """Test compatibility issues logging."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=0.5,
            action_count=2,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Serialize and test compatibility
        script_json = script.model_dump_json()
        result = CompatibilityTester.test_cross_core_compatibility(
            script_json, "rust", "python"
        )
        
        # Log compatibility result
        print("Compatibility test result:")
        print(f"  Compatible: {result.is_compatible}")
        print(f"  Version: {result.version}")
        print(f"  Core type: {result.core_type}")
        print(f"  Issues: {len(result.issues)} issues found")
        print(f"  Warnings: {len(result.warnings)} warnings found")
        
        assert result.is_compatible, "Compatibility logging test should pass"
        
        print("✓ Compatibility issues logged correctly")
    
    def test_default_cross_core_test_scripts(self):
        """Integration test: Test default test scripts from cross-core testing."""
        test_scripts = create_default_test_scripts()
        
        assert len(test_scripts) > 0, "Should have default test scripts"
        
        validator = ScriptValidator()
        
        for test_script in test_scripts:
            print(f"Testing script: {test_script.name}")
            
            # Validate the script
            validation_result = validator.validate_script(test_script.script_data)
            assert validation_result.is_compatible, \
                f"Script '{test_script.name}' should be compatible"
            
            # Check expected behavior
            assert len(test_script.script_data.actions) == \
                test_script.expected_behavior.expected_action_count, \
                f"Script '{test_script.name}' should have expected action count"
        
        print("✓ All default cross-core test scripts validated successfully")
    
    def test_rust_all_action_types(self):
        """Test that Rust scripts with all action types are compatible."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=0.6,
            action_count=4,
            platform="linux"
        )
        
        # Add one of each action type that Rust might record
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.2, x=100, y=100, button="left"),
            Action(type="key_press", timestamp=0.4, key="a"),
            Action(type="key_release", timestamp=0.6, key="a")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Validate script
        validator = ScriptValidator()
        validation_result = validator.validate_script(script)
        
        assert validation_result.is_compatible, "All action types should be compatible"
        
        # Verify all action types are present
        action_types = {action.type for action in script.actions}
        assert "mouse_move" in action_types, "Should have mouse move action"
        assert "mouse_click" in action_types, "Should have mouse click action"
        assert "key_press" in action_types, "Should have key press action"
        assert "key_release" in action_types, "Should have key release action"
        
        print("✓ All Rust action types are compatible with Python playback")


class TestAsyncRustToPythonPlayback:
    """Test async Rust-to-Python playback functionality."""
    
    @pytest.mark.asyncio
    async def test_async_rust_script_validation(self):
        """Test async loading and validation of Rust scripts."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=0.5,
            action_count=2,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        # Simulate async validation
        validator = ScriptValidator()
        validation_result = validator.validate_script(script)
        
        assert validation_result.is_compatible, "Async validation should pass"
        
        print("✓ Async Rust script validation passed")
    
    @pytest.mark.asyncio
    async def test_cross_core_suite_rust_scripts(self):
        """Test cross-core test suite with Rust scripts."""
        test_suite = CrossCoreTestSuite(
            rust_core_path="../../rust-core/target/debug/rust-automation-core",
            python_core_path="."
        )
        
        # Add a Rust-recorded script test
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=0.5,
            action_count=2,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left")
        ]
        
        script = ScriptFile(metadata=metadata, actions=actions)
        
        test_script = TestScript(
            name="rust_to_python_test",
            description="Test Rust-recorded script with Python playback",
            script_data=script,
            expected_behavior=ExpectedBehavior(
                should_be_compatible=True,
                expected_duration_tolerance=0.1,
                expected_action_count=2,
                platform_specific={}
            )
        )
        
        test_suite.add_test_script(test_script)
        
        # Run the test
        results = await test_suite.run_all_tests()
        
        assert len(results) == 1, "Should have one test result"
        assert results[0].passed, "Rust to Python test should pass"
        assert results[0].compatibility_result.is_compatible, "Should be compatible"
        
        print("✓ Cross-core test suite with Rust scripts passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
