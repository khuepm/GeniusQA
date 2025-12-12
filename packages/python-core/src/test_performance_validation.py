"""
Performance Validation Tests for Test Case Driven Automation (Python Core)

Tests performance with large scripts containing many steps and actions
Validates memory usage and execution performance
Ensures scalability for complex test scenarios

Requirements: 1.5, 4.2, 5.1
"""

import pytest
import time
import json
import tempfile
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, List

from storage.models import TestScript, TestStep, Action, EnhancedScriptMetadata
from storage.storage import Storage


class TestPerformanceValidation:
    """Performance validation tests for test case driven automation."""

    def setup_method(self):
        """Set up test environment before each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = Storage(base_dir=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up test environment after each test."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def create_large_test_script(self, step_count: int, actions_per_step: int) -> TestScript:
        """Create a large test script for performance testing."""
        metadata = EnhancedScriptMetadata(
            title=f"Performance Test - {step_count} Steps",
            description=f"Large script with {step_count} steps and {step_count * actions_per_step} actions",
            pre_conditions="Performance test environment",
            tags=["performance", "large"],
            created_at=datetime.now(),
            duration=float(step_count * 2),  # Simulate 2 seconds per step
            action_count=step_count * actions_per_step,
            platform="darwin"
        )

        steps = []
        action_pool = {}

        for step_num in range(1, step_count + 1):
            step_id = f"perf-step-{step_num}"
            action_ids = []

            # Create actions for this step
            for action_num in range(1, actions_per_step + 1):
                action_id = f"perf-action-{step_num}-{action_num}"
                action_ids.append(action_id)

                action_pool[action_id] = Action(
                    type="mouse_click",
                    x=step_num * 10,
                    y=action_num * 10,
                    button="left",
                    timestamp=float(step_num * 1000 + action_num * 100)
                )

            steps.append(TestStep(
                id=step_id,
                order=step_num,
                description=f"Performance test step {step_num}",
                expected_result=f"Step {step_num} should complete efficiently",
                action_ids=action_ids
            ))

        return TestScript(
            meta=metadata,
            steps=steps,
            action_pool=action_pool,
            variables={}
        )

    def test_large_script_creation_performance(self):
        """Test performance of creating large scripts."""
        script_sizes = [10, 50, 100, 500]
        performance_results = []

        for size in script_sizes:
            start_time = time.time()
            
            # Create large script
            large_script = self.create_large_test_script(size, 5)
            
            creation_time = time.time() - start_time
            performance_results.append({"size": size, "time": creation_time})

            # Verify script structure
            assert len(large_script.steps) == size
            assert len(large_script.action_pool) == size * 5
            assert large_script.meta.action_count == size * 5

            # Performance assertion
            assert creation_time < 1.0  # Should complete within 1 second

            print(f"Script size {size}: {creation_time:.3f}s")

        # Verify roughly linear scaling
        for i in range(1, len(performance_results)):
            prev = performance_results[i - 1]
            curr = performance_results[i]
            size_ratio = curr["size"] / prev["size"]
            time_ratio = curr["time"] / prev["time"]

            # Time should scale roughly linearly (within 3x of size ratio)
            assert time_ratio < size_ratio * 3

    def test_script_serialization_performance(self):
        """Test performance of script serialization and deserialization."""
        # Create medium-sized script for serialization testing
        test_script = self.create_large_test_script(100, 10)  # 100 steps, 1000 actions

        # Test serialization performance
        start_time = time.time()
        serialized = test_script.model_dump_json()
        serialization_time = time.time() - start_time

        # Test deserialization performance
        start_time = time.time()
        deserialized = TestScript.model_validate_json(serialized)
        deserialization_time = time.time() - start_time

        # Verify correctness
        assert deserialized.meta.title == test_script.meta.title
        assert len(deserialized.steps) == len(test_script.steps)
        assert len(deserialized.action_pool) == len(test_script.action_pool)

        # Performance assertions
        assert serialization_time < 0.5  # Should serialize within 500ms
        assert deserialization_time < 0.5  # Should deserialize within 500ms

        # Calculate serialized size
        serialized_size_kb = len(serialized) / 1024

        print(f"Serialization time: {serialization_time:.3f}s")
        print(f"Deserialization time: {deserialization_time:.3f}s")
        print(f"Serialized size: {serialized_size_kb:.2f} KB")

        # Size should be reasonable
        assert serialized_size_kb < 1000  # Should be under 1MB

    def test_step_filtering_performance(self):
        """Test performance of step filtering operations."""
        # Create large script
        large_script = self.create_large_test_script(1000, 5)

        # Test filtering performance for various steps
        filter_times = []
        
        for step_index in [0, 250, 500, 750, 999]:  # Test different positions
            step = large_script.steps[step_index]
            
            start_time = time.time()
            
            # Simulate step filtering operation
            step_actions = [
                large_script.action_pool[action_id] 
                for action_id in step.action_ids
            ]
            
            filter_time = time.time() - start_time
            filter_times.append(filter_time)

            # Verify correctness
            assert len(step_actions) == 5
            assert all(action.type == "mouse_click" for action in step_actions)

            # Performance assertion
            assert filter_time < 0.001  # Should complete within 1ms

        avg_filter_time = sum(filter_times) / len(filter_times)
        print(f"Average step filtering time: {avg_filter_time:.6f}s")

        # Average should be very fast
        assert avg_filter_time < 0.001

    def test_action_pool_lookup_performance(self):
        """Test performance of action pool lookups."""
        # Create script with large action pool
        large_script = self.create_large_test_script(500, 10)  # 5000 actions

        # Test random action lookups
        action_ids = list(large_script.action_pool.keys())
        lookup_times = []

        for _ in range(1000):  # 1000 random lookups
            import random
            random_action_id = random.choice(action_ids)
            
            start_time = time.time()
            action = large_script.action_pool[random_action_id]
            lookup_time = time.time() - start_time
            
            lookup_times.append(lookup_time)

            # Verify correctness
            assert action is not None
            assert action.type == "mouse_click"

        avg_lookup_time = sum(lookup_times) / len(lookup_times)
        max_lookup_time = max(lookup_times)

        print(f"Average action lookup time: {avg_lookup_time:.6f}s")
        print(f"Maximum action lookup time: {max_lookup_time:.6f}s")

        # Lookups should be very fast (dictionary access)
        assert avg_lookup_time < 0.0001  # Should be under 0.1ms on average
        assert max_lookup_time < 0.001   # Maximum should be under 1ms

    def test_step_execution_simulation_performance(self):
        """Test performance of simulated step execution."""
        # Create script for execution simulation
        test_script = self.create_large_test_script(200, 8)  # 200 steps, 1600 actions

        # Simulate step-by-step execution
        execution_times = []
        
        for step in test_script.steps:
            start_time = time.time()
            
            # Simulate step execution operations
            step_actions = [
                test_script.action_pool[action_id] 
                for action_id in step.action_ids
            ]
            
            # Simulate processing each action
            for action in step_actions:
                # Simulate action validation and preparation
                assert action.type in ["mouse_click", "mouse_move", "key_press", "key_release"]
                assert action.timestamp >= 0
                assert action.x is not None and action.y is not None
            
            # Simulate step completion
            step_result = {
                "step_id": step.id,
                "status": "passed",
                "action_count": len(step_actions),
                "execution_time": time.time() - start_time
            }
            
            execution_time = time.time() - start_time
            execution_times.append(execution_time)

            # Each step should execute quickly
            assert execution_time < 0.01  # Should complete within 10ms

        total_execution_time = sum(execution_times)
        avg_execution_time = total_execution_time / len(execution_times)

        print(f"Total simulated execution time: {total_execution_time:.3f}s")
        print(f"Average step execution time: {avg_execution_time:.6f}s")

        # Performance assertions
        assert total_execution_time < 2.0  # Should complete within 2 seconds
        assert avg_execution_time < 0.01   # Average step should be under 10ms

    def test_memory_usage_with_large_scripts(self):
        """Test memory usage patterns with large scripts."""
        import gc
        import sys

        # Get initial memory usage
        gc.collect()
        initial_objects = len(gc.get_objects())

        # Create and process multiple large scripts
        scripts = []
        for i in range(10):
            script = self.create_large_test_script(50, 5)  # 50 steps, 250 actions each
            scripts.append(script)

        # Process scripts (simulate typical operations)
        for script in scripts:
            # Simulate common operations
            for step in script.steps[:10]:  # Process first 10 steps
                step_actions = [
                    script.action_pool[action_id] 
                    for action_id in step.action_ids
                ]
                assert len(step_actions) == 5

        # Clear references and force garbage collection
        scripts.clear()
        gc.collect()

        # Check memory usage after cleanup
        final_objects = len(gc.get_objects())
        object_growth = final_objects - initial_objects

        print(f"Initial objects: {initial_objects}")
        print(f"Final objects: {final_objects}")
        print(f"Object growth: {object_growth}")

        # Memory growth should be reasonable
        assert object_growth < 10000  # Should not create excessive objects


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
