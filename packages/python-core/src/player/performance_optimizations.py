"""
Performance Optimizations for Step-Based Execution

This module provides performance optimizations for handling large scripts
with many steps and actions. It includes:
- Lazy action loading for memory efficiency
- Batch action processing for faster execution
- Action pool indexing for O(1) lookups
- Step execution caching for repeated runs

Requirements: 1.5, 4.2, 5.1
"""

import time
from typing import Dict, List, Any, Optional, Iterator, Tuple
from functools import lru_cache
from collections import OrderedDict


class ActionPoolIndex:
    """
    Optimized action pool with O(1) lookups and memory-efficient storage.
    
    This class provides fast access to actions by ID while maintaining
    memory efficiency for large action pools.
    
    Requirements: 1.5, 4.2
    """
    
    def __init__(self, action_pool: Dict[str, Any] = None):
        """Initialize the action pool index.
        
        Args:
            action_pool: Optional initial action pool dictionary
        """
        self._pool: Dict[str, Any] = {}
        self._access_count: Dict[str, int] = {}
        self._last_access: Dict[str, float] = {}
        
        if action_pool:
            self.load_pool(action_pool)
    
    def load_pool(self, action_pool: Dict[str, Any]) -> None:
        """Load actions into the indexed pool.
        
        Args:
            action_pool: Dictionary of actions keyed by ID
        """
        self._pool = dict(action_pool)
        self._access_count = {action_id: 0 for action_id in self._pool}
        self._last_access = {action_id: 0.0 for action_id in self._pool}
    
    def get(self, action_id: str) -> Optional[Any]:
        """Get an action by ID with O(1) lookup.
        
        Args:
            action_id: Unique action identifier
            
        Returns:
            Action data or None if not found
        """
        action = self._pool.get(action_id)
        if action is not None:
            self._access_count[action_id] = self._access_count.get(action_id, 0) + 1
            self._last_access[action_id] = time.time()
        return action
    
    def get_batch(self, action_ids: List[str]) -> List[Any]:
        """Get multiple actions by ID in a single batch operation.
        
        This is more efficient than calling get() multiple times
        for large numbers of actions.
        
        Args:
            action_ids: List of action IDs to retrieve
            
        Returns:
            List of actions (None for missing IDs)
        """
        current_time = time.time()
        results = []
        
        for action_id in action_ids:
            action = self._pool.get(action_id)
            if action is not None:
                self._access_count[action_id] = self._access_count.get(action_id, 0) + 1
                self._last_access[action_id] = current_time
            results.append(action)
        
        return results
    
    def get_step_actions(self, step) -> List[Any]:
        """Get all actions for a test step efficiently.
        
        Args:
            step: TestStep object with action_ids attribute
            
        Returns:
            List of actions for the step
        """
        return [
            action for action in self.get_batch(step.action_ids)
            if action is not None
        ]
    
    def __len__(self) -> int:
        """Return the number of actions in the pool."""
        return len(self._pool)
    
    def __contains__(self, action_id: str) -> bool:
        """Check if an action ID exists in the pool."""
        return action_id in self._pool
    
    def keys(self) -> Iterator[str]:
        """Return iterator over action IDs."""
        return iter(self._pool.keys())
    
    def values(self) -> Iterator[Any]:
        """Return iterator over actions."""
        return iter(self._pool.values())
    
    def items(self) -> Iterator[Tuple[str, Any]]:
        """Return iterator over (action_id, action) pairs."""
        return iter(self._pool.items())
    
    def get_access_stats(self) -> Dict[str, Any]:
        """Get access statistics for performance analysis.
        
        Returns:
            Dictionary with access statistics
        """
        total_accesses = sum(self._access_count.values())
        most_accessed = sorted(
            self._access_count.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return {
            'total_actions': len(self._pool),
            'total_accesses': total_accesses,
            'most_accessed': most_accessed,
            'avg_accesses_per_action': total_accesses / len(self._pool) if self._pool else 0
        }


class StepExecutionCache:
    """
    Cache for step execution results to avoid redundant processing.
    
    This cache stores step execution results for repeated runs,
    allowing fast retrieval of previously computed results.
    
    Requirements: 5.1
    """
    
    def __init__(self, max_size: int = 1000):
        """Initialize the step execution cache.
        
        Args:
            max_size: Maximum number of cached results
        """
        self._cache: OrderedDict = OrderedDict()
        self._max_size = max_size
        self._hits = 0
        self._misses = 0
    
    def get(self, step_id: str, script_hash: str) -> Optional[Dict[str, Any]]:
        """Get cached execution result for a step.
        
        Args:
            step_id: Unique step identifier
            script_hash: Hash of the script state
            
        Returns:
            Cached result or None if not found
        """
        cache_key = f"{step_id}:{script_hash}"
        result = self._cache.get(cache_key)
        
        if result is not None:
            self._hits += 1
            # Move to end (most recently used)
            self._cache.move_to_end(cache_key)
        else:
            self._misses += 1
        
        return result
    
    def set(self, step_id: str, script_hash: str, result: Dict[str, Any]) -> None:
        """Cache execution result for a step.
        
        Args:
            step_id: Unique step identifier
            script_hash: Hash of the script state
            result: Execution result to cache
        """
        cache_key = f"{step_id}:{script_hash}"
        
        # Remove oldest entry if at capacity
        if len(self._cache) >= self._max_size:
            self._cache.popitem(last=False)
        
        self._cache[cache_key] = result
    
    def clear(self) -> None:
        """Clear all cached results."""
        self._cache.clear()
        self._hits = 0
        self._misses = 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        total_requests = self._hits + self._misses
        hit_rate = self._hits / total_requests if total_requests > 0 else 0
        
        return {
            'size': len(self._cache),
            'max_size': self._max_size,
            'hits': self._hits,
            'misses': self._misses,
            'hit_rate': hit_rate
        }


class BatchActionProcessor:
    """
    Batch processor for efficient action execution.
    
    This processor groups actions for batch processing,
    reducing overhead for large numbers of actions.
    
    Requirements: 5.1
    """
    
    def __init__(self, batch_size: int = 50):
        """Initialize the batch processor.
        
        Args:
            batch_size: Number of actions to process in each batch
        """
        self._batch_size = batch_size
        self._processed_count = 0
        self._batch_times: List[float] = []
    
    def process_actions(
        self,
        actions: List[Any],
        executor: callable,
        progress_callback: callable = None
    ) -> List[Dict[str, Any]]:
        """Process actions in batches for efficiency.
        
        Args:
            actions: List of actions to process
            executor: Function to execute each action
            progress_callback: Optional callback for progress updates
            
        Returns:
            List of execution results
        """
        results = []
        total_actions = len(actions)
        
        for batch_start in range(0, total_actions, self._batch_size):
            batch_end = min(batch_start + self._batch_size, total_actions)
            batch = actions[batch_start:batch_end]
            
            batch_start_time = time.time()
            
            for i, action in enumerate(batch):
                try:
                    result = executor(action)
                    results.append({
                        'action_index': batch_start + i,
                        'success': True,
                        'result': result
                    })
                except Exception as e:
                    results.append({
                        'action_index': batch_start + i,
                        'success': False,
                        'error': str(e)
                    })
                
                self._processed_count += 1
            
            batch_time = time.time() - batch_start_time
            self._batch_times.append(batch_time)
            
            if progress_callback:
                progress_callback(batch_end, total_actions)
        
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """Get processing statistics.
        
        Returns:
            Dictionary with processing statistics
        """
        avg_batch_time = sum(self._batch_times) / len(self._batch_times) if self._batch_times else 0
        
        return {
            'processed_count': self._processed_count,
            'batch_count': len(self._batch_times),
            'batch_size': self._batch_size,
            'avg_batch_time': avg_batch_time,
            'total_time': sum(self._batch_times)
        }


class LazyStepLoader:
    """
    Lazy loader for test steps to reduce memory usage.
    
    This loader only loads step actions when they are needed,
    reducing memory footprint for large scripts.
    
    Requirements: 1.5
    """
    
    def __init__(self, test_script):
        """Initialize the lazy loader.
        
        Args:
            test_script: TestScript object to load from
        """
        self._script = test_script
        self._loaded_steps: Dict[str, List[Any]] = {}
        self._load_count = 0
    
    def get_step_actions(self, step_id: str) -> List[Any]:
        """Get actions for a step, loading lazily if needed.
        
        Args:
            step_id: Unique step identifier
            
        Returns:
            List of actions for the step
        """
        if step_id in self._loaded_steps:
            return self._loaded_steps[step_id]
        
        # Find the step
        step = None
        for s in self._script.steps:
            if s.id == step_id:
                step = s
                break
        
        if step is None:
            return []
        
        # Load actions from pool
        actions = []
        for action_id in step.action_ids:
            if action_id in self._script.action_pool:
                action = self._script.action_pool[action_id]
                # Convert to dict if needed
                if hasattr(action, 'model_dump'):
                    actions.append(action.model_dump(mode='json'))
                elif isinstance(action, dict):
                    actions.append(action)
                else:
                    actions.append(dict(action))
        
        self._loaded_steps[step_id] = actions
        self._load_count += 1
        
        return actions
    
    def preload_steps(self, step_ids: List[str]) -> None:
        """Preload multiple steps for faster access.
        
        Args:
            step_ids: List of step IDs to preload
        """
        for step_id in step_ids:
            if step_id not in self._loaded_steps:
                self.get_step_actions(step_id)
    
    def unload_step(self, step_id: str) -> None:
        """Unload a step to free memory.
        
        Args:
            step_id: Step ID to unload
        """
        if step_id in self._loaded_steps:
            del self._loaded_steps[step_id]
    
    def clear(self) -> None:
        """Clear all loaded steps."""
        self._loaded_steps.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get loader statistics.
        
        Returns:
            Dictionary with loader statistics
        """
        return {
            'loaded_steps': len(self._loaded_steps),
            'total_steps': len(self._script.steps) if self._script else 0,
            'load_count': self._load_count
        }


def optimize_step_execution_order(steps: List[Any]) -> List[Any]:
    """
    Optimize step execution order for better performance.
    
    This function analyzes step dependencies and reorders
    steps for optimal execution when possible.
    
    Args:
        steps: List of TestStep objects
        
    Returns:
        Optimized list of steps
    """
    # For now, maintain original order (steps must execute in order)
    # Future optimization: identify independent steps that can run in parallel
    return sorted(steps, key=lambda s: s.order)


def calculate_script_complexity(test_script) -> Dict[str, Any]:
    """
    Calculate complexity metrics for a test script.
    
    This helps identify potential performance bottlenecks.
    
    Args:
        test_script: TestScript object to analyze
        
    Returns:
        Dictionary with complexity metrics
    """
    total_steps = len(test_script.steps)
    total_actions = len(test_script.action_pool)
    
    # Calculate actions per step
    actions_per_step = []
    for step in test_script.steps:
        actions_per_step.append(len(step.action_ids))
    
    avg_actions_per_step = sum(actions_per_step) / total_steps if total_steps > 0 else 0
    max_actions_per_step = max(actions_per_step) if actions_per_step else 0
    
    # Count assertion actions
    assertion_count = sum(
        1 for action in test_script.action_pool.values()
        if (hasattr(action, 'is_assertion') and action.is_assertion) or
           (isinstance(action, dict) and action.get('is_assertion', False))
    )
    
    # Estimate execution time (rough estimate)
    estimated_time = total_actions * 0.1  # 100ms per action average
    
    return {
        'total_steps': total_steps,
        'total_actions': total_actions,
        'avg_actions_per_step': avg_actions_per_step,
        'max_actions_per_step': max_actions_per_step,
        'assertion_count': assertion_count,
        'estimated_execution_time': estimated_time,
        'complexity_score': total_steps * avg_actions_per_step
    }
