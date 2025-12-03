"""
Tests for cross-core testing capabilities.

Requirements: 7.5
"""

import pytest
import asyncio
from datetime import datetime
from pathlib import Path
import tempfile
import json

from .models import ScriptFile, ScriptMetadata, Action
from .cross_core_testing import (
    CrossCoreTestSuite, TestScript, RecordingComparator,
    ExpectedBehavior, DifferenceType, create_default_test_scripts
)


class TestRecordingComparator:
    """Test recording comparison functionality."""
    
    def test_equivalent_actions(self):
        """Test comparison of equivalent actions."""
        action1 = Action(type="mouse_click", timestamp=0.5, x=100, y=200, button="left")
        action2 = Action(type="mouse_click", timestamp=0.5, x=100, y=200, button="left")
        
        comparator = RecordingComparator()
        assert comparator.are_actions_equivalent(action1, action2)
    
    def test_different_action_types(self):
        """Test comparison of actions with different types."""
        action1 = Action(type="mouse_click", timestamp=0.5, x=100, y=200, button="left")
        action2 = Action(type="mouse_move", timestamp=0.5, x=100, y=200)
        
        comparator = RecordingComparator()
        assert not comparator.are_actions_equivalent(action1, action2)
    
    def test_timing_tolerance(self):
        """Test timing tolerance in action comparison."""
        action1 = Action(type="mouse_click", timestamp=0.5, x=100, y=200, button="left")
        action2 = Action(type="mouse_click", timestamp=0.505, x=100, y=200, button="left")  # 5ms difference
        
        comparator = RecordingComparator(tolerance_ms=10.0)
        assert comparator.are_actions_equivalent(action1, action2)
        
        comparator_strict = RecordingComparator(tolerance_ms=1.0)
        assert not comparator_strict.are_actions_equivalent(action1, action2)
    
    def test_coordinate_tolerance(self):
        """Test coordinate tolerance in action comparison."""
        action1 = Action(type="mouse_click", timestamp=0.5, x=100, y=200, button="left")
        action2 = Action(type="mouse_click", timestamp=0.5, x=103, y=202, button="left")  # Small coordinate difference
        
        comparator = RecordingComparator(coordinate_tolerance=5)
        assert comparator.are_actions_equivalent(action1, action2)
        
        comparator_strict = RecordingComparator(coordinate_tolerance=1)
        assert not comparator_strict.are_actions_equivalent(action1, action2)
    
    def test_script_equivalence(self):
        """Test comparison of equivalent scripts."""
        metadata1 = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=2,
            platform="linux"
        )
        
        metadata2 = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=2,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left")
        ]
        
        script1 = ScriptFile(metadata=metadata1, actions=actions)
        script2 = ScriptFile(metadata=metadata2, actions=actions)
        
        comparator = RecordingComparator()
        assert comparator.are_scripts_equivalent(script1, script2)
    
    def test_action_differences(self):
        """Test identification of action differences."""
        actions1 = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left")
        ]
        
        actions2 = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=150, y=150, button="left"),  # Different coordinates
            Action(type="key_press", timestamp=1.0, key="a")  # Extra action
        ]
        
        comparator = RecordingComparator(coordinate_tolerance=1)
        differences = comparator.compare_actions(actions1, actions2)
        
        assert len(differences) == 2
        assert differences[0].difference_type == DifferenceType.COORDINATE_DIFFERENCE
        assert differences[1].difference_type == DifferenceType.MISSING
    
    def test_timing_differences(self):
        """Test identification of timing differences."""
        actions1 = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left")
        ]
        
        actions2 = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.52, x=100, y=100, button="left")  # 20ms difference
        ]
        
        comparator = RecordingComparator(tolerance_ms=10.0)
        timing_diffs = comparator.compare_timing(actions1, actions2)
        
        assert len(timing_diffs) == 1
        assert timing_diffs[0].tolerance_exceeded
        assert abs(timing_diffs[0].difference_ms - 20.0) < 0.001


class TestCrossCoreTestSuite:
    """Test cross-core test suite functionality."""
    
    @pytest.fixture
    def test_suite(self):
        """Create a test suite for testing."""
        return CrossCoreTestSuite("/path/to/rust/core", "/path/to/python/core")
    
    @pytest.fixture
    def sample_test_script(self):
        """Create a sample test script."""
        metadata = ScriptMetadata(
            created_at=datetime.now(),
            duration=1.0,
            action_count=2,
            platform="linux"
        )
        
        actions = [
            Action(type="mouse_move", timestamp=0.0, x=100, y=100),
            Action(type="mouse_click", timestamp=0.5, x=100, y=100, button="left")
        ]
        
        script_data = ScriptFile(metadata=metadata, actions=actions)
        
        return TestScript(
            name="test_script",
            description="A test script for testing",
            script_data=script_data,
            expected_behavior=ExpectedBehavior(
                should_be_compatible=True,
                expected_duration_tolerance=0.1,
                expected_action_count=2,
                platform_specific={}
            )
        )
    
    def test_add_test_script(self, test_suite, sample_test_script):
        """Test adding a test script to the suite."""
        test_suite.add_test_script(sample_test_script)
        assert len(test_suite.test_scripts) == 1
        assert test_suite.test_scripts[0].name == "test_script"
    
    @pytest.mark.asyncio
    async def test_run_single_test(self, test_suite, sample_test_script):
        """Test running a single test."""
        result = await test_suite.run_single_test(sample_test_script)
        
        assert result.test_name == "test_script"
        assert result.rust_result.success
        assert result.python_result.success
        assert result.compatibility_result.is_compatible
        assert result.passed
    
    @pytest.mark.asyncio
    async def test_run_all_tests(self, test_suite, sample_test_script):
        """Test running all tests in the suite."""
        test_suite.add_test_script(sample_test_script)
        
        results = await test_suite.run_all_tests()
        
        assert len(results) == 1
        assert results[0].test_name == "test_script"
        assert results[0].passed
    
    @pytest.mark.asyncio
    async def test_load_test_scripts_from_dir(self, test_suite, sample_test_script):
        """Test loading test scripts from a directory."""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Create a test script file
            script_file = temp_path / "test_script.json"
            with open(script_file, 'w') as f:
                json.dump(sample_test_script.model_dump(mode='json'), f)
            
            await test_suite.load_test_scripts_from_dir(temp_path)
            
            assert len(test_suite.test_scripts) == 1
            assert test_suite.test_scripts[0].name == "test_script"
    
    def test_generate_test_report(self, test_suite, sample_test_script):
        """Test generation of test report."""
        # Create a mock result
        from .cross_core_testing import CrossCoreTestResult, CoreTestResult, ComparisonResult
        
        rust_result = CoreTestResult(
            core_type="rust",
            success=True,
            execution_time_ms=50,
            memory_usage_mb=15.5,
            output_script=sample_test_script.script_data,
            error_message=None
        )
        
        python_result = CoreTestResult(
            core_type="python",
            success=True,
            execution_time_ms=80,
            memory_usage_mb=25.8,
            output_script=sample_test_script.script_data,
            error_message=None
        )
        
        comparison = ComparisonResult(
            scripts_identical=True,
            performance_difference_ms=-30,
            memory_difference_mb=-10.3,
            action_differences=[],
            timing_differences=[]
        )
        
        from .validation import CompatibilityResult
        compatibility_result = CompatibilityResult(
            is_compatible=True,
            version="1.0",
            core_type="test",
            issues=[],
            warnings=[]
        )
        
        result = CrossCoreTestResult(
            test_name="test_script",
            rust_result=rust_result,
            python_result=python_result,
            compatibility_result=compatibility_result,
            comparison=comparison,
            passed=True,
            issues=[]
        )
        
        report = test_suite.generate_test_report([result])
        
        assert "Cross-Core Compatibility Test Report" in report
        assert "Total Tests: 1" in report
        assert "Passed: 1" in report
        assert "test_script" in report
        assert "PASSED" in report


class TestDefaultTestScripts:
    """Test default test script creation."""
    
    def test_create_default_test_scripts(self):
        """Test creation of default test scripts."""
        scripts = create_default_test_scripts()
        
        assert len(scripts) == 3
        assert any(script.name == "basic_mouse_movement" for script in scripts)
        assert any(script.name == "keyboard_input" for script in scripts)
        assert any(script.name == "mixed_interactions" for script in scripts)
        
        # Verify all scripts have valid structure
        for script in scripts:
            assert script.name
            assert script.description
            assert script.script_data
            assert script.expected_behavior
            assert len(script.script_data.actions) > 0


if __name__ == "__main__":
    pytest.main([__file__])
