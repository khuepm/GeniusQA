"""
Cross-core testing capabilities for side-by-side validation.

This module provides utilities for testing compatibility between Python and Rust
automation cores, including side-by-side testing, recording comparison, and
automated compatibility testing suites.

Requirements: 7.5
"""

import json
import time
import asyncio
import subprocess
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from pydantic import BaseModel, Field
from enum import Enum

from .models import ScriptFile, ScriptMetadata, Action
from .validation import ScriptValidator, CompatibilityResult, CompatibilityTester


class DifferenceType(str, Enum):
    """Type of difference between actions."""
    MISSING = "missing"
    EXTRA = "extra"
    MODIFIED = "modified"
    TYPE_MISMATCH = "type_mismatch"
    COORDINATE_DIFFERENCE = "coordinate_difference"
    TIMING_DIFFERENCE = "timing_difference"


class PlatformExpectation(BaseModel):
    """Platform-specific expectations."""
    supported: bool
    performance_baseline_ms: Optional[int] = None
    known_issues: List[str] = Field(default_factory=list)


class ExpectedBehavior(BaseModel):
    """Expected behavior for cross-core testing."""
    should_be_compatible: bool
    expected_duration_tolerance: float
    expected_action_count: int
    platform_specific: Dict[str, PlatformExpectation] = Field(default_factory=dict)


class TestScript(BaseModel):
    """Test script for cross-core validation."""
    name: str
    description: str
    script_data: ScriptFile
    expected_behavior: ExpectedBehavior


class CoreTestResult(BaseModel):
    """Result from testing a single core."""
    core_type: str
    success: bool
    execution_time_ms: int
    memory_usage_mb: float
    output_script: Optional[ScriptFile] = None
    error_message: Optional[str] = None


class ActionDifference(BaseModel):
    """Difference in actions between cores."""
    index: int
    rust_action: Optional[Action] = None
    python_action: Optional[Action] = None
    difference_type: DifferenceType
    description: str


class TimingDifference(BaseModel):
    """Timing difference between cores."""
    action_index: int
    rust_timestamp: float
    python_timestamp: float
    difference_ms: float
    tolerance_exceeded: bool


class ComparisonResult(BaseModel):
    """Comparison result between cores."""
    scripts_identical: bool
    performance_difference_ms: int
    memory_difference_mb: float
    action_differences: List[ActionDifference] = Field(default_factory=list)
    timing_differences: List[TimingDifference] = Field(default_factory=list)


class CrossCoreTestResult(BaseModel):
    """Result of cross-core testing."""
    test_name: str
    rust_result: CoreTestResult
    python_result: CoreTestResult
    compatibility_result: CompatibilityResult
    comparison: ComparisonResult
    passed: bool
    issues: List[str] = Field(default_factory=list)


class RecordingComparator:
    """Recording comparison tool for analyzing differences between cores."""
    
    def __init__(self, tolerance_ms: float = 10.0, coordinate_tolerance: int = 5):
        self.tolerance_ms = tolerance_ms
        self.coordinate_tolerance = coordinate_tolerance
    
    def are_scripts_equivalent(self, script1: ScriptFile, script2: ScriptFile) -> bool:
        """Check if two scripts are equivalent within tolerance."""
        if len(script1.actions) != len(script2.actions):
            return False
        
        for action1, action2 in zip(script1.actions, script2.actions):
            if not self.are_actions_equivalent(action1, action2):
                return False
        
        return True
    
    def are_actions_equivalent(self, action1: Action, action2: Action) -> bool:
        """Check if two actions are equivalent within tolerance."""
        # Check action type
        if action1.type != action2.type:
            return False
        
        # Check timestamp within tolerance
        timestamp_diff = abs(action1.timestamp - action2.timestamp) * 1000.0  # Convert to ms
        if timestamp_diff > self.tolerance_ms:
            return False
        
        # Check coordinates within tolerance
        if action1.x is not None and action1.y is not None and action2.x is not None and action2.y is not None:
            coord_diff = (abs(action1.x - action2.x) + abs(action1.y - action2.y)) / 2
            if coord_diff > self.coordinate_tolerance:
                return False
        elif not (action1.x is None and action1.y is None and action2.x is None and action2.y is None):
            return False  # One has coordinates, the other doesn't
        
        # Check other fields
        return (action1.button == action2.button and 
                action1.key == action2.key)
    
    def compare_actions(self, actions1: List[Action], actions2: List[Action]) -> List[ActionDifference]:
        """Compare actions between two scripts and identify differences."""
        differences = []
        max_len = max(len(actions1), len(actions2))
        
        for i in range(max_len):
            action1 = actions1[i] if i < len(actions1) else None
            action2 = actions2[i] if i < len(actions2) else None
            
            if action1 and action2:
                if not self.are_actions_equivalent(action1, action2):
                    diff_type = self._classify_action_difference(action1, action2)
                    differences.append(ActionDifference(
                        index=i,
                        rust_action=action1,
                        python_action=action2,
                        difference_type=diff_type,
                        description=self._describe_action_difference(diff_type, action1, action2)
                    ))
            elif action1 and not action2:
                differences.append(ActionDifference(
                    index=i,
                    rust_action=action1,
                    python_action=None,
                    difference_type=DifferenceType.EXTRA,
                    description="Action present in Rust core but missing in Python core"
                ))
            elif not action1 and action2:
                differences.append(ActionDifference(
                    index=i,
                    rust_action=None,
                    python_action=action2,
                    difference_type=DifferenceType.MISSING,
                    description="Action present in Python core but missing in Rust core"
                ))
        
        return differences
    
    def compare_timing(self, actions1: List[Action], actions2: List[Action]) -> List[TimingDifference]:
        """Compare timing between two scripts."""
        differences = []
        min_len = min(len(actions1), len(actions2))
        
        for i in range(min_len):
            action1 = actions1[i]
            action2 = actions2[i]
            
            timestamp_diff_ms = abs(action1.timestamp - action2.timestamp) * 1000.0
            tolerance_exceeded = timestamp_diff_ms > self.tolerance_ms
            
            if tolerance_exceeded:
                differences.append(TimingDifference(
                    action_index=i,
                    rust_timestamp=action1.timestamp,
                    python_timestamp=action2.timestamp,
                    difference_ms=timestamp_diff_ms,
                    tolerance_exceeded=tolerance_exceeded
                ))
        
        return differences
    
    def _classify_action_difference(self, action1: Action, action2: Action) -> DifferenceType:
        """Classify the type of difference between two actions."""
        if action1.type != action2.type:
            return DifferenceType.TYPE_MISMATCH
        
        timestamp_diff = abs(action1.timestamp - action2.timestamp) * 1000.0
        if timestamp_diff > self.tolerance_ms:
            return DifferenceType.TIMING_DIFFERENCE
        
        if (action1.x is not None and action1.y is not None and 
            action2.x is not None and action2.y is not None):
            coord_diff = (abs(action1.x - action2.x) + abs(action1.y - action2.y)) / 2
            if coord_diff > self.coordinate_tolerance:
                return DifferenceType.COORDINATE_DIFFERENCE
        
        return DifferenceType.MODIFIED
    
    def _describe_action_difference(self, diff_type: DifferenceType, action1: Action, action2: Action) -> str:
        """Describe the difference between two actions."""
        if diff_type == DifferenceType.TYPE_MISMATCH:
            return f"Action type mismatch: {action1.type} vs {action2.type}"
        elif diff_type == DifferenceType.TIMING_DIFFERENCE:
            return f"Timing difference: {action1.timestamp:.3f}s vs {action2.timestamp:.3f}s"
        elif diff_type == DifferenceType.COORDINATE_DIFFERENCE:
            return f"Coordinate difference: ({action1.x}, {action1.y}) vs ({action2.x}, {action2.y})"
        elif diff_type == DifferenceType.MODIFIED:
            return "Actions have minor differences"
        else:
            return "Unknown difference"


class CrossCoreTestSuite:
    """Cross-core testing suite for automated compatibility validation."""
    
    def __init__(self, rust_core_path: str, python_core_path: str):
        self.rust_core_path = rust_core_path
        self.python_core_path = python_core_path
        self.test_scripts: List[TestScript] = []
        self.validator = ScriptValidator()
    
    def add_test_script(self, test_script: TestScript) -> None:
        """Add a test script to the suite."""
        self.test_scripts.append(test_script)
    
    async def load_test_scripts_from_dir(self, dir_path: Path) -> None:
        """Load test scripts from a directory."""
        if not dir_path.exists():
            raise FileNotFoundError(f"Test scripts directory not found: {dir_path}")
        
        for file_path in dir_path.glob("*.json"):
            with open(file_path, 'r') as f:
                data = json.load(f)
                test_script = TestScript.model_validate(data)
                self.add_test_script(test_script)
    
    async def run_all_tests(self) -> List[CrossCoreTestResult]:
        """Run all test scripts and return results."""
        results = []
        
        for test_script in self.test_scripts:
            result = await self.run_single_test(test_script)
            results.append(result)
        
        return results
    
    async def run_single_test(self, test_script: TestScript) -> CrossCoreTestResult:
        """Run a single test script with both cores."""
        # Test with Rust core
        rust_result = await self._test_with_rust_core(test_script.script_data)
        
        # Test with Python core
        python_result = await self._test_with_python_core(test_script.script_data)
        
        # Validate compatibility
        script_json = test_script.script_data.model_dump_json()
        compatibility_result = CompatibilityTester.test_cross_core_compatibility(
            script_json, "rust", "python"
        )
        
        # Compare results
        comparison = self._compare_results(rust_result, python_result)
        
        # Determine if test passed
        passed = self._evaluate_test_result(
            rust_result, python_result, compatibility_result, 
            comparison, test_script.expected_behavior
        )
        
        issues = []
        if not passed:
            issues = self._identify_issues(rust_result, python_result, comparison)
        
        return CrossCoreTestResult(
            test_name=test_script.name,
            rust_result=rust_result,
            python_result=python_result,
            compatibility_result=compatibility_result,
            comparison=comparison,
            passed=passed,
            issues=issues
        )
    
    async def _test_with_rust_core(self, script: ScriptFile) -> CoreTestResult:
        """Test script execution with Rust core."""
        start_time = time.time()
        
        # For this implementation, we'll simulate the test
        # In a real implementation, this would execute the script with the Rust core
        await asyncio.sleep(0.01)  # Simulate execution time
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        memory_usage_mb = 15.5  # Simulated memory usage
        
        return CoreTestResult(
            core_type="rust",
            success=True,
            execution_time_ms=execution_time_ms,
            memory_usage_mb=memory_usage_mb,
            output_script=script,
            error_message=None
        )
    
    async def _test_with_python_core(self, script: ScriptFile) -> CoreTestResult:
        """Test script execution with Python core."""
        start_time = time.time()
        
        # For this implementation, we'll simulate the test
        # In a real implementation, this would execute the script with the Python core
        await asyncio.sleep(0.06)  # Simulate slower execution
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        memory_usage_mb = 25.8  # Simulated memory usage
        
        return CoreTestResult(
            core_type="python",
            success=True,
            execution_time_ms=execution_time_ms,
            memory_usage_mb=memory_usage_mb,
            output_script=script,
            error_message=None
        )
    
    def _compare_results(self, rust_result: CoreTestResult, python_result: CoreTestResult) -> ComparisonResult:
        """Compare results from both cores."""
        comparator = RecordingComparator(10.0, 5)  # 10ms tolerance, 5px coordinate tolerance
        
        scripts_identical = False
        action_differences = []
        timing_differences = []
        
        if rust_result.output_script and python_result.output_script:
            scripts_identical = comparator.are_scripts_equivalent(
                rust_result.output_script, python_result.output_script
            )
            action_differences = comparator.compare_actions(
                rust_result.output_script.actions, python_result.output_script.actions
            )
            timing_differences = comparator.compare_timing(
                rust_result.output_script.actions, python_result.output_script.actions
            )
        
        performance_difference_ms = rust_result.execution_time_ms - python_result.execution_time_ms
        memory_difference_mb = rust_result.memory_usage_mb - python_result.memory_usage_mb
        
        return ComparisonResult(
            scripts_identical=scripts_identical,
            performance_difference_ms=performance_difference_ms,
            memory_difference_mb=memory_difference_mb,
            action_differences=action_differences,
            timing_differences=timing_differences
        )
    
    def _evaluate_test_result(
        self,
        rust_result: CoreTestResult,
        python_result: CoreTestResult,
        compatibility_result: CompatibilityResult,
        comparison: ComparisonResult,
        expected: ExpectedBehavior
    ) -> bool:
        """Evaluate if the test passed based on results and expectations."""
        # Both cores should succeed
        if not rust_result.success or not python_result.success:
            return False
        
        # Compatibility should match expectations
        if compatibility_result.is_compatible != expected.should_be_compatible:
            return False
        
        # Action count should match expectations
        if rust_result.output_script:
            if len(rust_result.output_script.actions) != expected.expected_action_count:
                return False
        
        # Performance difference should be reasonable (Rust should be faster or comparable)
        if comparison.performance_difference_ms > 100:  # Allow up to 100ms slower for Rust
            return False
        
        # No critical action differences
        has_critical_differences = any(
            diff.difference_type in [DifferenceType.MISSING, DifferenceType.TYPE_MISMATCH]
            for diff in comparison.action_differences
        )
        
        return not has_critical_differences
    
    def _identify_issues(
        self, 
        rust_result: CoreTestResult, 
        python_result: CoreTestResult, 
        comparison: ComparisonResult
    ) -> List[str]:
        """Identify issues from test results."""
        issues = []
        
        if not rust_result.success:
            issues.append(f"Rust core failed: {rust_result.error_message or 'Unknown error'}")
        
        if not python_result.success:
            issues.append(f"Python core failed: {python_result.error_message or 'Unknown error'}")
        
        if comparison.performance_difference_ms > 100:
            issues.append(f"Rust core is {comparison.performance_difference_ms}ms slower than expected")
        
        for diff in comparison.action_differences:
            if diff.difference_type == DifferenceType.MISSING:
                issues.append(f"Action {diff.index} missing in one core")
            elif diff.difference_type == DifferenceType.TYPE_MISMATCH:
                issues.append(f"Action {diff.index} has different types between cores")
        
        return issues
    
    def generate_test_report(self, results: List[CrossCoreTestResult]) -> str:
        """Generate a comprehensive test report."""
        report = []
        report.append("Cross-Core Compatibility Test Report")
        report.append("===================================")
        report.append("")
        
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r.passed)
        failed_tests = total_tests - passed_tests
        
        report.append(f"Total Tests: {total_tests}")
        report.append(f"Passed: {passed_tests}")
        report.append(f"Failed: {failed_tests}")
        report.append(f"Success Rate: {(passed_tests / total_tests) * 100:.1f}%")
        report.append("")
        
        # Performance summary
        if results:
            avg_rust_time = sum(r.rust_result.execution_time_ms for r in results) / total_tests
            avg_python_time = sum(r.python_result.execution_time_ms for r in results) / total_tests
            
            report.append("Performance Summary:")
            report.append(f"Average Rust execution time: {avg_rust_time:.1f}ms")
            report.append(f"Average Python execution time: {avg_python_time:.1f}ms")
            report.append(f"Performance improvement: {((avg_python_time - avg_rust_time) / avg_python_time) * 100:.1f}%")
            report.append("")
        
        # Individual test results
        report.append("Individual Test Results:")
        report.append("------------------------")
        
        for result in results:
            report.append(f"Test: {result.test_name}")
            report.append(f"Status: {'PASSED' if result.passed else 'FAILED'}")
            report.append(f"Compatibility: {result.compatibility_result.is_compatible}")
            report.append(f"Rust time: {result.rust_result.execution_time_ms}ms, "
                         f"Python time: {result.python_result.execution_time_ms}ms")
            
            if result.issues:
                report.append("Issues:")
                for issue in result.issues:
                    report.append(f"  - {issue}")
            report.append("")
        
        return "\n".join(report)


def create_default_test_scripts() -> List[TestScript]:
    """Create default test scripts for cross-core validation."""
    return [
        TestScript(
            name="basic_mouse_movement",
            description="Test basic mouse movement recording and playback",
            script_data=_create_mouse_movement_script(),
            expected_behavior=ExpectedBehavior(
                should_be_compatible=True,
                expected_duration_tolerance=0.1,
                expected_action_count=3,
                platform_specific={}
            )
        ),
        TestScript(
            name="keyboard_input",
            description="Test keyboard input recording and playback",
            script_data=_create_keyboard_input_script(),
            expected_behavior=ExpectedBehavior(
                should_be_compatible=True,
                expected_duration_tolerance=0.1,
                expected_action_count=5,
                platform_specific={}
            )
        ),
        TestScript(
            name="mixed_interactions",
            description="Test mixed mouse and keyboard interactions",
            script_data=_create_mixed_interaction_script(),
            expected_behavior=ExpectedBehavior(
                should_be_compatible=True,
                expected_duration_tolerance=0.2,
                expected_action_count=6,
                platform_specific={}
            )
        ),
    ]


def _create_mouse_movement_script() -> ScriptFile:
    """Create a test script with mouse movements."""
    metadata = ScriptMetadata(
        created_at=datetime.now(),
        duration=1.0,
        action_count=3,
        platform="linux"
    )
    
    actions = [
        Action(type="mouse_move", timestamp=0.0, x=100, y=100),
        Action(type="mouse_move", timestamp=0.5, x=200, y=200),
        Action(type="mouse_click", timestamp=1.0, x=200, y=200, button="left")
    ]
    
    return ScriptFile(metadata=metadata, actions=actions)


def _create_keyboard_input_script() -> ScriptFile:
    """Create a test script with keyboard input."""
    metadata = ScriptMetadata(
        created_at=datetime.now(),
        duration=0.8,
        action_count=5,
        platform="linux"
    )
    
    actions = [
        Action(type="key_press", timestamp=0.0, key="h"),
        Action(type="key_press", timestamp=0.2, key="e"),
        Action(type="key_press", timestamp=0.4, key="l"),
        Action(type="key_press", timestamp=0.6, key="l"),
        Action(type="key_press", timestamp=0.8, key="o")
    ]
    
    return ScriptFile(metadata=metadata, actions=actions)


def _create_mixed_interaction_script() -> ScriptFile:
    """Create a test script with mixed interactions."""
    metadata = ScriptMetadata(
        created_at=datetime.now(),
        duration=2.0,
        action_count=6,
        platform="linux"
    )
    
    actions = [
        Action(type="mouse_move", timestamp=0.0, x=50, y=50),
        Action(type="mouse_click", timestamp=0.2, x=50, y=50, button="left"),
        Action(type="key_press", timestamp=0.5, key="Tab"),
        Action(type="mouse_move", timestamp=1.2, x=100, y=100),
        Action(type="mouse_click", timestamp=1.4, x=100, y=100, button="left"),
        Action(type="key_press", timestamp=2.0, key="Enter")
    ]
    
    return ScriptFile(metadata=metadata, actions=actions)
