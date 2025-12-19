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
from player.performance_optimizations import (
    ActionPoolIndex,
    StepExecutionCache,
    BatchActionProcessor,
    LazyStepLoader,
    calculate_script_complexity
)


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

        # Verify roughly linear scaling by comparing smallest to largest
        # This avoids issues with very small time measurements causing large ratios
        smallest = performance_results[0]
        largest = performance_results[-1]
        
        size_ratio = largest["size"] / smallest["size"]  # 500/10 = 50
        time_ratio = largest["time"] / max(smallest["time"], 0.0001)  # Avoid division by zero
        
        # Time should scale roughly linearly (within 5x of size ratio for overall comparison)
        # This is more lenient because small time measurements have high variance
        assert time_ratio < size_ratio * 5, f"Time ratio {time_ratio:.2f} exceeds {size_ratio * 5}"
        
        # Also verify absolute performance: largest script should complete quickly
        assert largest["time"] < 2.0, f"Largest script took {largest['time']:.3f}s, expected < 2.0s"

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


class TestPerformanceOptimizations:
    """Tests for performance optimization utilities."""

    def setup_method(self):
        """Set up test environment before each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = Storage(base_dir=Path(self.temp_dir))

    def teardown_method(self):
        """Clean up test environment after each test."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def create_test_script(self, step_count: int, actions_per_step: int) -> TestScript:
        """Create a test script for performance testing."""
        metadata = EnhancedScriptMetadata(
            title=f"Optimization Test - {step_count} Steps",
            description=f"Script with {step_count} steps and {step_count * actions_per_step} actions",
            pre_conditions="Optimization test environment",
            tags=["optimization", "performance"],
            created_at=datetime.now(),
            duration=float(step_count * 2),
            action_count=step_count * actions_per_step,
            platform="darwin"
        )

        steps = []
        action_pool = {}

        for step_num in range(1, step_count + 1):
            step_id = f"opt-step-{step_num}"
            action_ids = []

            for action_num in range(1, actions_per_step + 1):
                action_id = f"opt-action-{step_num}-{action_num}"
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
                description=f"Optimization test step {step_num}",
                expected_result=f"Step {step_num} should complete efficiently",
                action_ids=action_ids
            ))

        return TestScript(
            meta=metadata,
            steps=steps,
            action_pool=action_pool,
            variables={}
        )

    def test_action_pool_index_performance(self):
        """Test ActionPoolIndex provides O(1) lookups."""
        # Create large action pool
        test_script = self.create_test_script(500, 10)  # 5000 actions
        
        # Convert action pool to dict format
        action_pool_dict = {}
        for action_id, action in test_script.action_pool.items():
            if hasattr(action, 'model_dump'):
                action_pool_dict[action_id] = action.model_dump(mode='json')
            else:
                action_pool_dict[action_id] = dict(action)
        
        # Create indexed pool
        start_time = time.time()
        indexed_pool = ActionPoolIndex(action_pool_dict)
        index_creation_time = time.time() - start_time
        
        # Test single lookups
        action_ids = list(action_pool_dict.keys())
        lookup_times = []
        
        for _ in range(1000):
            import random
            action_id = random.choice(action_ids)
            
            start_time = time.time()
            action = indexed_pool.get(action_id)
            lookup_time = time.time() - start_time
            
            lookup_times.append(lookup_time)
            assert action is not None
        
        avg_lookup_time = sum(lookup_times) / len(lookup_times)
        
        # Test batch lookups
        batch_ids = random.sample(action_ids, min(100, len(action_ids)))
        
        start_time = time.time()
        batch_results = indexed_pool.get_batch(batch_ids)
        batch_time = time.time() - start_time
        
        assert len(batch_results) == len(batch_ids)
        assert all(r is not None for r in batch_results)
        
        # Performance assertions
        assert index_creation_time < 0.5  # Index creation under 500ms
        assert avg_lookup_time < 0.0001  # Average lookup under 0.1ms
        assert batch_time < 0.01  # Batch lookup under 10ms
        
        print(f"Index creation time: {index_creation_time:.3f}s")
        print(f"Average lookup time: {avg_lookup_time:.6f}s")
        print(f"Batch lookup time: {batch_time:.6f}s")

    def test_step_execution_cache_performance(self):
        """Test StepExecutionCache provides fast result retrieval."""
        cache = StepExecutionCache(max_size=500)
        
        # Populate cache
        start_time = time.time()
        for i in range(500):
            step_id = f"step-{i}"
            script_hash = f"hash-{i % 10}"  # 10 different script versions
            result = {
                'step_id': step_id,
                'status': 'passed',
                'execution_time': 0.1 * i
            }
            cache.set(step_id, script_hash, result)
        
        populate_time = time.time() - start_time
        
        # Test cache hits
        hit_times = []
        for i in range(1000):
            step_id = f"step-{i % 500}"
            script_hash = f"hash-{i % 10}"
            
            start_time = time.time()
            result = cache.get(step_id, script_hash)
            hit_time = time.time() - start_time
            
            hit_times.append(hit_time)
        
        avg_hit_time = sum(hit_times) / len(hit_times)
        
        # Get cache stats
        stats = cache.get_stats()
        
        # Performance assertions
        assert populate_time < 0.1  # Population under 100ms
        assert avg_hit_time < 0.0001  # Average hit under 0.1ms
        assert stats['hit_rate'] > 0.5  # At least 50% hit rate
        
        print(f"Cache populate time: {populate_time:.3f}s")
        print(f"Average hit time: {avg_hit_time:.6f}s")
        print(f"Cache hit rate: {stats['hit_rate']:.2%}")

    def test_batch_action_processor_performance(self):
        """Test BatchActionProcessor handles large action sets efficiently."""
        # Create large action list
        actions = []
        for i in range(1000):
            actions.append({
                'id': f'action-{i}',
                'type': 'mouse_click',
                'x': i % 1920,
                'y': i % 1080,
                'timestamp': float(i * 100)
            })
        
        # Simple executor that simulates action processing
        def mock_executor(action):
            # Simulate minimal processing
            return {'processed': action['id']}
        
        processor = BatchActionProcessor(batch_size=50)
        
        start_time = time.time()
        results = processor.process_actions(actions, mock_executor)
        total_time = time.time() - start_time
        
        # Get processor stats
        stats = processor.get_stats()
        
        # Verify results
        assert len(results) == len(actions)
        assert all(r['success'] for r in results)
        
        # Performance assertions
        assert total_time < 1.0  # Should complete within 1 second
        assert stats['batch_count'] == 20  # 1000 actions / 50 batch size
        
        print(f"Batch processing time: {total_time:.3f}s")
        print(f"Batches processed: {stats['batch_count']}")
        print(f"Average batch time: {stats['avg_batch_time']:.6f}s")

    def test_lazy_step_loader_performance(self):
        """Test LazyStepLoader reduces memory usage."""
        # Create large script
        test_script = self.create_test_script(200, 10)  # 2000 actions
        
        loader = LazyStepLoader(test_script)
        
        # Initially no steps loaded
        initial_stats = loader.get_stats()
        assert initial_stats['loaded_steps'] == 0
        
        # Load first 10 steps
        start_time = time.time()
        for i in range(10):
            step_id = f"opt-step-{i + 1}"
            actions = loader.get_step_actions(step_id)
            assert len(actions) == 10
        
        load_time = time.time() - start_time
        
        # Check stats after loading
        after_load_stats = loader.get_stats()
        assert after_load_stats['loaded_steps'] == 10
        
        # Accessing same steps should be instant (cached)
        start_time = time.time()
        for i in range(10):
            step_id = f"opt-step-{i + 1}"
            actions = loader.get_step_actions(step_id)
            assert len(actions) == 10
        
        cached_access_time = time.time() - start_time
        
        # Unload steps to free memory
        for i in range(5):
            step_id = f"opt-step-{i + 1}"
            loader.unload_step(step_id)
        
        after_unload_stats = loader.get_stats()
        assert after_unload_stats['loaded_steps'] == 5
        
        # Performance assertions
        assert load_time < 0.1  # Initial load under 100ms
        assert cached_access_time < 0.01  # Cached access under 10ms
        
        print(f"Initial load time: {load_time:.3f}s")
        print(f"Cached access time: {cached_access_time:.6f}s")

    def test_script_complexity_calculation(self):
        """Test script complexity calculation for performance analysis."""
        # Create scripts of varying complexity
        small_script = self.create_test_script(10, 5)  # 50 actions
        medium_script = self.create_test_script(100, 10)  # 1000 actions
        large_script = self.create_test_script(500, 20)  # 10000 actions
        
        # Calculate complexity
        start_time = time.time()
        small_complexity = calculate_script_complexity(small_script)
        medium_complexity = calculate_script_complexity(medium_script)
        large_complexity = calculate_script_complexity(large_script)
        calc_time = time.time() - start_time
        
        # Verify complexity metrics
        assert small_complexity['total_steps'] == 10
        assert small_complexity['total_actions'] == 50
        assert small_complexity['avg_actions_per_step'] == 5.0
        
        assert medium_complexity['total_steps'] == 100
        assert medium_complexity['total_actions'] == 1000
        assert medium_complexity['avg_actions_per_step'] == 10.0
        
        assert large_complexity['total_steps'] == 500
        assert large_complexity['total_actions'] == 10000
        assert large_complexity['avg_actions_per_step'] == 20.0
        
        # Complexity score should scale with script size
        assert small_complexity['complexity_score'] < medium_complexity['complexity_score']
        assert medium_complexity['complexity_score'] < large_complexity['complexity_score']
        
        # Performance assertion
        assert calc_time < 0.5  # All calculations under 500ms
        
        print(f"Small script complexity: {small_complexity['complexity_score']:.0f}")
        print(f"Medium script complexity: {medium_complexity['complexity_score']:.0f}")
        print(f"Large script complexity: {large_complexity['complexity_score']:.0f}")
        print(f"Calculation time: {calc_time:.3f}s")

    def test_extreme_scale_performance(self):
        """Test performance with extremely large scripts."""
        # Create very large script
        start_time = time.time()
        large_script = self.create_test_script(2000, 5)  # 10000 actions
        creation_time = time.time() - start_time
        
        # Test step iteration performance
        start_time = time.time()
        step_count = 0
        for step in large_script.steps:
            step_count += 1
            # Simulate accessing step data
            _ = step.description
            _ = step.action_ids
        
        iteration_time = time.time() - start_time
        
        # Test action pool access performance
        start_time = time.time()
        action_count = 0
        for action_id, action in large_script.action_pool.items():
            action_count += 1
            # Simulate accessing action data
            _ = action.type
            _ = action.x
        
        pool_access_time = time.time() - start_time
        
        # Verify counts
        assert step_count == 2000
        assert action_count == 10000
        
        # Performance assertions
        assert creation_time < 5.0  # Creation under 5 seconds
        assert iteration_time < 0.5  # Step iteration under 500ms
        assert pool_access_time < 1.0  # Pool access under 1 second
        
        print(f"Large script creation time: {creation_time:.3f}s")
        print(f"Step iteration time: {iteration_time:.3f}s")
        print(f"Action pool access time: {pool_access_time:.3f}s")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
