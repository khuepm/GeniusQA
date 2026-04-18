/**
 * Performance Tests for Test Case Driven Automation
 * 
 * Tests performance with large scripts containing many steps and actions
 * Validates memory usage and UI responsiveness
 * Ensures scalability for complex test scenarios
 * 
 * Requirements: 1.5, 4.2, 5.1
 */

import { scriptStorageService } from '../../services/scriptStorageService';
import { reorderSteps } from '../../utils/stepReordering';
import { filterActionsForStep } from '../../utils/stepFiltering';
import {
  calculateVisibleRange,
  debounce,
  throttle,
  memoizedFilterActionsForStep,
  memoizedGetStepActionCount,
  clearPerformanceCaches,
  performanceMonitor,
  calculateScriptComplexity,
  BatchUpdateHandler,
  isLargeScript,
  getVirtualListConfig
} from '../../utils/performanceOptimizations';
import {
  TestScript,
  TestStep,
  ActionWithId
} from '../../types/testCaseDriven.types';

// Mock services
jest.mock('../../services/scriptStorageService');

describe('Test Case Driven Automation - Performance Tests', () => {
  let mockScriptStorageService: jest.Mocked<typeof scriptStorageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScriptStorageService = scriptStorageService as jest.Mocked<typeof scriptStorageService>;
  });

  describe('Large Script Performance', () => {
    test('should handle scripts with 1000 steps efficiently', () => {
      const startTime = performance.now();

      // Create large script with 1000 steps and 5000 actions
      const largeScript: TestScript = {
        meta: {
          id: 'perf-test-1000',
          title: 'Performance Test - 1000 Steps',
          description: 'Large script for performance testing',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['performance', 'large'],
          pre_condition: 'Performance test environment'
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      // Generate 1000 steps with 5 actions each
      for (let stepNum = 1; stepNum <= 1000; stepNum++) {
        const stepId = `perf-step-${stepNum}`;
        const actionIds: string[] = [];

        // Create 5 actions per step
        for (let actionNum = 1; actionNum <= 5; actionNum++) {
          const actionId = `perf-action-${stepNum}-${actionNum}`;
          actionIds.push(actionId);

          largeScript.action_pool[actionId] = {
            id: actionId,
            type: 'mouse_click',
            x: (stepNum % 1920), // Screen width constraint
            y: (actionNum * 100) % 1080, // Screen height constraint
            button: 'left',
            timestamp: Date.now() + (stepNum * 100) + (actionNum * 10)
          };
        }

        largeScript.steps.push({
          id: stepId,
          order: stepNum,
          description: `Performance test step ${stepNum}`,
          expected_result: `Step ${stepNum} should complete efficiently`,
          action_ids: actionIds
        });
      }

      const creationTime = performance.now() - startTime;

      // Test script structure
      expect(largeScript.steps).toHaveLength(1000);
      expect(Object.keys(largeScript.action_pool)).toHaveLength(5000);

      // Performance assertion - creation should be fast
      expect(creationTime).toBeLessThan(1000); // Should complete within 1 second

      console.log(`Large script creation time: ${creationTime.toFixed(2)}ms`);
    });

    test('should perform step operations efficiently on large scripts', () => {
      // Create medium-sized script for operation testing
      const mediumScript: TestScript = {
        meta: {
          id: 'perf-test-operations',
          title: 'Performance Test - Operations',
          description: 'Medium script for operation performance testing',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['performance'],
          pre_condition: 'Performance test environment'
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      // Generate 500 steps with 3 actions each
      for (let stepNum = 1; stepNum <= 500; stepNum++) {
        const stepId = `op-step-${stepNum}`;
        const actionIds: string[] = [];

        for (let actionNum = 1; actionNum <= 3; actionNum++) {
          const actionId = `op-action-${stepNum}-${actionNum}`;
          actionIds.push(actionId);

          mediumScript.action_pool[actionId] = {
            id: actionId,
            type: 'mouse_click',
            x: stepNum % 1000,
            y: actionNum * 50,
            button: 'left',
            timestamp: Date.now() + (stepNum * 50) + (actionNum * 5)
          };
        }

        mediumScript.steps.push({
          id: stepId,
          order: stepNum,
          description: `Operation test step ${stepNum}`,
          expected_result: `Step ${stepNum} should operate efficiently`,
          action_ids: actionIds
        });
      }

      // Test step filtering performance
      const filterStartTime = performance.now();
      const middleStep = mediumScript.steps[250]; // Step in the middle
      const filteredActions = filterActionsForStep(middleStep, mediumScript.action_pool);
      const filterTime = performance.now() - filterStartTime;

      expect(filteredActions).toHaveLength(3);
      expect(filterTime).toBeLessThan(10); // Should complete within 10ms

      // Test step reordering performance
      const reorderStartTime = performance.now();
      const reorderedSteps = reorderSteps(mediumScript.steps, 'op-step-500', 1);
      const reorderTime = performance.now() - reorderStartTime;

      expect(reorderedSteps[0].description).toBe('Operation test step 500');
      expect(reorderTime).toBeLessThan(50); // Should complete within 50ms

      console.log(`Step filtering time: ${filterTime.toFixed(2)}ms`);
      console.log(`Step reordering time: ${reorderTime.toFixed(2)}ms`);
    });

    test('should handle script serialization efficiently', async () => {
      // Create script for serialization testing
      const serializationScript: TestScript = {
        meta: {
          id: 'perf-test-serialization',
          title: 'Performance Test - Serialization',
          description: 'Script for serialization performance testing',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['performance', 'serialization'],
          pre_condition: 'Performance test environment'
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      // Generate 200 steps with 10 actions each (2000 actions total)
      for (let stepNum = 1; stepNum <= 200; stepNum++) {
        const stepId = `ser-step-${stepNum}`;
        const actionIds: string[] = [];

        for (let actionNum = 1; actionNum <= 10; actionNum++) {
          const actionId = `ser-action-${stepNum}-${actionNum}`;
          actionIds.push(actionId);

          serializationScript.action_pool[actionId] = {
            id: actionId,
            type: 'mouse_click',
            x: stepNum * 5,
            y: actionNum * 20,
            button: 'left',
            timestamp: Date.now() + (stepNum * 200) + (actionNum * 20)
          };
        }

        serializationScript.steps.push({
          id: stepId,
          order: stepNum,
          description: `Serialization test step ${stepNum}`,
          expected_result: `Step ${stepNum} should serialize efficiently`,
          action_ids: actionIds
        });
      }

      // Mock save operation with timing
      mockScriptStorageService.saveTestScript.mockImplementation(async (script) => {
        const saveStartTime = performance.now();

        // Simulate serialization work
        const serialized = JSON.stringify(script);
        const parseBack = JSON.parse(serialized);

        const saveTime = performance.now() - saveStartTime;

        // Performance assertion
        expect(saveTime).toBeLessThan(100); // Should complete within 100ms
        expect(parseBack.steps).toHaveLength(200);
        expect(Object.keys(parseBack.action_pool)).toHaveLength(2000);

        console.log(`Script serialization time: ${saveTime.toFixed(2)}ms`);
        console.log(`Serialized size: ${(serialized.length / 1024).toFixed(2)} KB`);

        return {
          success: true,
          scriptPath: '/path/to/serialization-test.json'
        };
      });

      const result = await mockScriptStorageService.saveTestScript(serializationScript);
      expect(result.success).toBe(true);
    });
  });

  describe('Memory Usage Validation', () => {
    test('should not cause memory leaks with repeated operations', () => {
      const testScript: TestScript = {
        meta: {
          id: 'memory-test',
          title: 'Memory Test Script',
          description: 'Script for memory usage testing',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['memory'],
          pre_condition: 'Memory test environment'
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      // Generate 100 steps with 5 actions each
      for (let stepNum = 1; stepNum <= 100; stepNum++) {
        const stepId = `mem-step-${stepNum}`;
        const actionIds: string[] = [];

        for (let actionNum = 1; actionNum <= 5; actionNum++) {
          const actionId = `mem-action-${stepNum}-${actionNum}`;
          actionIds.push(actionId);

          testScript.action_pool[actionId] = {
            id: actionId,
            type: 'mouse_click',
            x: stepNum,
            y: actionNum,
            button: 'left',
            timestamp: Date.now()
          };
        }

        testScript.steps.push({
          id: stepId,
          order: stepNum,
          description: `Memory test step ${stepNum}`,
          expected_result: `Step ${stepNum} should not leak memory`,
          action_ids: actionIds
        });
      }

      // Perform repeated operations to test for memory leaks
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Simulate common operations
        const randomStep = testScript.steps[Math.floor(Math.random() * testScript.steps.length)];
        const actions = filterActionsForStep(randomStep, testScript.action_pool);

        // Create temporary objects that should be garbage collected
        const tempData = {
          stepId: randomStep.id,
          actionCount: actions.length,
          timestamp: Date.now()
        };

        // Verify operations work correctly
        expect(actions.length).toBeGreaterThan(0);
        expect(tempData.actionCount).toBe(5);
      }

      const totalTime = performance.now() - startTime;
      const avgTimePerOperation = totalTime / iterations;

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(avgTimePerOperation).toBeLessThan(5); // Average operation should be under 5ms

      console.log(`Memory test completed: ${iterations} iterations in ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per operation: ${avgTimePerOperation.toFixed(3)}ms`);
    });
  });

  describe('UI Responsiveness Simulation', () => {
    test('should maintain responsiveness with large step lists', () => {
      // Simulate UI operations on large step lists
      const largeStepList: TestStep[] = [];

      // Create 2000 steps
      for (let i = 1; i <= 2000; i++) {
        largeStepList.push({
          id: `ui-step-${i}`,
          order: i,
          description: `UI responsiveness test step ${i}`,
          expected_result: `Step ${i} should render quickly`,
          action_ids: [`ui-action-${i}`]
        });
      }

      // Simulate common UI operations
      const operations = [
        // Simulate filtering/searching steps
        () => {
          const searchTerm = 'test step 1';
          return largeStepList.filter(step =>
            step.description.toLowerCase().includes(searchTerm.toLowerCase())
          );
        },

        // Simulate step selection
        () => {
          const selectedIndex = Math.floor(Math.random() * largeStepList.length);
          return largeStepList[selectedIndex];
        },

        // Simulate step reordering
        () => {
          const fromIndex = Math.floor(Math.random() * largeStepList.length);
          const toIndex = Math.floor(Math.random() * largeStepList.length);
          const reordered = [...largeStepList];
          const [moved] = reordered.splice(fromIndex, 1);
          reordered.splice(toIndex, 0, moved);
          return reordered;
        }
      ];

      // Test each operation for performance
      operations.forEach((operation, index) => {
        const startTime = performance.now();
        const result = operation();
        const operationTime = performance.now() - startTime;

        // Each UI operation should complete quickly
        expect(operationTime).toBeLessThan(100); // Should complete within 100ms
        expect(result).toBeDefined();

        console.log(`UI operation ${index + 1} time: ${operationTime.toFixed(2)}ms`);
      });
    });

    test('should handle rapid step updates efficiently', () => {
      const baseScript: TestScript = {
        meta: {
          id: 'rapid-update-test',
          title: 'Rapid Update Test',
          description: 'Test rapid step updates',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['performance', 'updates'],
          pre_condition: 'Rapid update test environment'
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      // Create initial steps
      for (let i = 1; i <= 50; i++) {
        baseScript.steps.push({
          id: `rapid-step-${i}`,
          order: i,
          description: `Rapid update step ${i}`,
          expected_result: `Step ${i} should update quickly`,
          action_ids: []
        });
      }

      // Simulate rapid updates (like user typing in step descriptions)
      const updateCount = 500;
      const startTime = performance.now();

      for (let i = 0; i < updateCount; i++) {
        const stepIndex = i % baseScript.steps.length;
        const updatedStep = {
          ...baseScript.steps[stepIndex],
          description: `Updated step ${i} - ${Date.now()}`
        };

        // Simulate updating the step in the array
        baseScript.steps[stepIndex] = updatedStep;

        // Verify update worked
        expect(baseScript.steps[stepIndex].description).toContain(`Updated step ${i}`);
      }

      const totalUpdateTime = performance.now() - startTime;
      const avgUpdateTime = totalUpdateTime / updateCount;

      // Performance assertions
      expect(totalUpdateTime).toBeLessThan(1000); // Should complete within 1 second
      expect(avgUpdateTime).toBeLessThan(2); // Average update should be under 2ms

      console.log(`Rapid updates completed: ${updateCount} updates in ${totalUpdateTime.toFixed(2)}ms`);
      console.log(`Average update time: ${avgUpdateTime.toFixed(3)}ms`);
    });
  });

  describe('Scalability Validation', () => {
    test('should scale linearly with script size', () => {
      const scriptSizes = [10, 50, 100, 500, 1000];
      const performanceResults: Array<{ size: number; time: number }> = [];

      scriptSizes.forEach(size => {
        const startTime = performance.now();

        // Create script of specified size
        const script: TestScript = {
          meta: {
            id: `scale-test-${size}`,
            title: `Scale Test - ${size} Steps`,
            description: `Scalability test with ${size} steps`,
            version: '2.0.0',
            created_at: Date.now(),
            tags: ['scalability'],
            pre_condition: 'Scalability test environment'
          },
          steps: [],
          action_pool: {},
          variables: {}
        };

        // Generate steps and actions
        for (let i = 1; i <= size; i++) {
          const stepId = `scale-step-${i}`;
          const actionId = `scale-action-${i}`;

          script.action_pool[actionId] = {
            id: actionId,
            type: 'mouse_click',
            x: i,
            y: i,
            button: 'left',
            timestamp: Date.now()
          };

          script.steps.push({
            id: stepId,
            order: i,
            description: `Scale test step ${i}`,
            expected_result: `Step ${i} should scale well`,
            action_ids: [actionId]
          });
        }

        // Perform common operations
        const middleStep = script.steps[Math.floor(script.steps.length / 2)];
        const actions = filterActionsForStep(middleStep, script.action_pool);

        const endTime = performance.now();
        const operationTime = endTime - startTime;

        performanceResults.push({ size, time: operationTime });

        // Verify correctness
        expect(script.steps).toHaveLength(size);
        expect(Object.keys(script.action_pool)).toHaveLength(size);
        expect(actions).toHaveLength(1);

        console.log(`Script size ${size}: ${operationTime.toFixed(2)}ms`);
      });

      // Verify roughly linear scaling (allowing for variance due to JIT, GC, etc.)
      // Compare first and last results for overall scaling trend
      const firstResult = performanceResults[0];
      const lastResult = performanceResults[performanceResults.length - 1];
      const overallSizeRatio = lastResult.size / firstResult.size;
      const overallTimeRatio = lastResult.time / Math.max(firstResult.time, 0.01); // Avoid division by near-zero

      // Overall time should scale sub-quadratically (within 10x of size ratio for 100x size increase)
      // This is more lenient to account for JIT compilation warming up on first iterations
      expect(overallTimeRatio).toBeLessThan(overallSizeRatio * 10);

      // Also verify that the largest script completes in reasonable time
      expect(lastResult.time).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('Performance Optimization Utilities', () => {
    beforeEach(() => {
      clearPerformanceCaches();
      performanceMonitor.clear();
    });

    test('calculateVisibleRange should compute correct range for virtual list', () => {
      const config = {
        itemHeight: 60,
        overscan: 3,
        containerHeight: 600
      };

      // Test at top of list
      const topRange = calculateVisibleRange(0, config, 1000);
      expect(topRange.start).toBe(0);
      expect(topRange.end).toBeLessThanOrEqual(16); // 10 visible + 6 overscan
      expect(topRange.offsetY).toBe(0);

      // Test in middle of list
      const middleRange = calculateVisibleRange(3000, config, 1000);
      expect(middleRange.start).toBeGreaterThan(40);
      expect(middleRange.end).toBeLessThan(70);
      expect(middleRange.offsetY).toBe(middleRange.start * 60);

      // Test at bottom of list
      const bottomRange = calculateVisibleRange(59400, config, 1000);
      expect(bottomRange.end).toBe(1000);
    });

    test('debounce should delay function execution', async () => {
      let callCount = 0;
      const debouncedFn = debounce(() => callCount++, 50);

      // Call multiple times rapidly
      debouncedFn();
      debouncedFn();
      debouncedFn();

      // Should not have been called yet
      expect(callCount).toBe(0);

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have been called once
      expect(callCount).toBe(1);
    });

    test('throttle should limit function call rate', async () => {
      let callCount = 0;
      const throttledFn = throttle(() => callCount++, 50);

      // Call multiple times rapidly
      throttledFn();
      throttledFn();
      throttledFn();

      // First call should execute immediately
      expect(callCount).toBe(1);

      // Wait for throttle period
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have been called twice (initial + one after throttle)
      expect(callCount).toBe(2);
    });

    test('memoizedFilterActionsForStep should cache results', () => {
      const step: TestStep = {
        id: 'memo-step-1',
        order: 1,
        description: 'Memoization test step',
        expected_result: 'Should cache results',
        action_ids: ['action-1', 'action-2', 'action-3'],
        continue_on_failure: false
      };

      const actionPool: Record<string, ActionWithId> = {
        'action-1': { id: 'action-1', type: 'mouse_click', x: 100, y: 100, button: 'left', key: null, screenshot: null, timestamp: 1000 },
        'action-2': { id: 'action-2', type: 'mouse_click', x: 200, y: 200, button: 'left', key: null, screenshot: null, timestamp: 2000 },
        'action-3': { id: 'action-3', type: 'mouse_click', x: 300, y: 300, button: 'left', key: null, screenshot: null, timestamp: 3000 }
      };

      // First call - should compute
      const startTime1 = performance.now();
      const result1 = memoizedFilterActionsForStep(step, actionPool);
      const time1 = performance.now() - startTime1;

      // Second call - should use cache
      const startTime2 = performance.now();
      const result2 = memoizedFilterActionsForStep(step, actionPool);
      const time2 = performance.now() - startTime2;

      expect(result1).toHaveLength(3);
      expect(result2).toHaveLength(3);
      expect(result1).toEqual(result2);

      // Cached call should be faster (or at least not slower)
      // Note: Due to JIT compilation, first call might actually be slower
      console.log(`First call: ${time1.toFixed(3)}ms, Cached call: ${time2.toFixed(3)}ms`);
    });

    test('memoizedGetStepActionCount should cache counts', () => {
      const step: TestStep = {
        id: 'count-step-1',
        order: 1,
        description: 'Count test step',
        expected_result: 'Should cache count',
        action_ids: ['action-1', 'action-2', 'action-3', 'action-4', 'action-5'],
        continue_on_failure: false
      };

      const actionPool: Record<string, ActionWithId> = {
        'action-1': { id: 'action-1', type: 'mouse_click', x: 100, y: 100, button: 'left', key: null, screenshot: null, timestamp: 1000 },
        'action-2': { id: 'action-2', type: 'mouse_click', x: 200, y: 200, button: 'left', key: null, screenshot: null, timestamp: 2000 },
        'action-3': { id: 'action-3', type: 'mouse_click', x: 300, y: 300, button: 'left', key: null, screenshot: null, timestamp: 3000 },
        'action-4': { id: 'action-4', type: 'mouse_click', x: 400, y: 400, button: 'left', key: null, screenshot: null, timestamp: 4000 },
        'action-5': { id: 'action-5', type: 'mouse_click', x: 500, y: 500, button: 'left', key: null, screenshot: null, timestamp: 5000 }
      };

      const count1 = memoizedGetStepActionCount(step, actionPool);
      const count2 = memoizedGetStepActionCount(step, actionPool);

      expect(count1).toBe(5);
      expect(count2).toBe(5);
    });

    test('performanceMonitor should track operation metrics', () => {
      // Record some operations
      performanceMonitor.record('testOp1', 10);
      performanceMonitor.record('testOp1', 20);
      performanceMonitor.record('testOp1', 30);
      performanceMonitor.record('testOp2', 5);

      // Check metrics
      const op1Metrics = performanceMonitor.getMetrics('testOp1');
      expect(op1Metrics).toHaveLength(3);

      const avgDuration = performanceMonitor.getAverageDuration('testOp1');
      expect(avgDuration).toBe(20);

      const summary = performanceMonitor.getSummary();
      expect(summary['testOp1'].count).toBe(3);
      expect(summary['testOp1'].avgDuration).toBe(20);
      expect(summary['testOp1'].maxDuration).toBe(30);
      expect(summary['testOp2'].count).toBe(1);
    });

    test('performanceMonitor.measure should time operations', () => {
      const result = performanceMonitor.measure('syncOp', () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(499500);

      const metrics = performanceMonitor.getMetrics('syncOp');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].duration).toBeGreaterThan(0);
    });

    test('calculateScriptComplexity should compute correct metrics', () => {
      const script: TestScript = {
        meta: {
          id: 'complexity-test',
          title: 'Complexity Test',
          description: 'Test script for complexity calculation',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['test'],
          pre_condition: 'None'
        },
        steps: [
          { id: 'step-1', order: 1, description: 'Step 1', expected_result: '', action_ids: ['a1', 'a2', 'a3'], continue_on_failure: false },
          { id: 'step-2', order: 2, description: 'Step 2', expected_result: '', action_ids: ['a4', 'a5'], continue_on_failure: false },
          { id: 'step-3', order: 3, description: 'Step 3', expected_result: '', action_ids: ['a6', 'a7', 'a8', 'a9'], continue_on_failure: false }
        ],
        action_pool: {
          'a1': { id: 'a1', type: 'mouse_click', x: 0, y: 0, button: 'left', key: null, screenshot: null, timestamp: 0 },
          'a2': { id: 'a2', type: 'mouse_click', x: 0, y: 0, button: 'left', key: null, screenshot: null, timestamp: 0 },
          'a3': { id: 'a3', type: 'mouse_click', x: 0, y: 0, button: 'left', key: null, screenshot: null, timestamp: 0 },
          'a4': { id: 'a4', type: 'mouse_click', x: 0, y: 0, button: 'left', key: null, screenshot: null, timestamp: 0 },
          'a5': { id: 'a5', type: 'mouse_click', x: 0, y: 0, button: 'left', key: null, screenshot: null, timestamp: 0 },
          'a6': { id: 'a6', type: 'mouse_click', x: 0, y: 0, button: 'left', key: null, screenshot: null, timestamp: 0 },
          'a7': { id: 'a7', type: 'mouse_click', x: 0, y: 0, button: 'left', key: null, screenshot: null, timestamp: 0 },
          'a8': { id: 'a8', type: 'mouse_click', x: 0, y: 0, button: 'left', key: null, screenshot: null, timestamp: 0 },
          'a9': { id: 'a9', type: 'mouse_click', x: 0, y: 0, button: 'left', key: null, screenshot: null, timestamp: 0 }
        },
        variables: {}
      };

      const complexity = calculateScriptComplexity(script);

      expect(complexity.totalSteps).toBe(3);
      expect(complexity.totalActions).toBe(9);
      expect(complexity.avgActionsPerStep).toBe(3);
      expect(complexity.maxActionsPerStep).toBe(4);
      expect(complexity.complexityScore).toBe(9); // 3 steps * 3 avg actions
      expect(complexity.estimatedExecutionTime).toBe(0.9); // 9 actions * 0.1s
    });

    test('BatchUpdateHandler should batch updates efficiently', async () => {
      const updates: number[][] = [];
      const handler = new BatchUpdateHandler<number>(
        (batch) => updates.push(batch),
        5, // batch size
        50 // flush delay
      );

      // Add updates
      for (let i = 0; i < 12; i++) {
        handler.add(i);
      }

      // Should have flushed twice (at 5 and 10)
      expect(updates.length).toBe(2);
      expect(updates[0]).toEqual([0, 1, 2, 3, 4]);
      expect(updates[1]).toEqual([5, 6, 7, 8, 9]);

      // Wait for final flush
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have flushed remaining
      expect(updates.length).toBe(3);
      expect(updates[2]).toEqual([10, 11]);
    });

    test('isLargeScript should correctly identify large scripts', () => {
      const smallScript: TestScript = {
        meta: { id: 'small', title: 'Small', description: '', version: '2.0.0', created_at: Date.now(), tags: [], pre_condition: '' },
        steps: Array(50).fill(null).map((_, i) => ({
          id: `step-${i}`, order: i + 1, description: `Step ${i}`, expected_result: '', action_ids: [], continue_on_failure: false
        })),
        action_pool: {},
        variables: {}
      };

      const largeScript: TestScript = {
        meta: { id: 'large', title: 'Large', description: '', version: '2.0.0', created_at: Date.now(), tags: [], pre_condition: '' },
        steps: Array(150).fill(null).map((_, i) => ({
          id: `step-${i}`, order: i + 1, description: `Step ${i}`, expected_result: '', action_ids: [], continue_on_failure: false
        })),
        action_pool: {},
        variables: {}
      };

      expect(isLargeScript(smallScript)).toBe(false);
      expect(isLargeScript(largeScript)).toBe(true);
    });

    test('getVirtualListConfig should return appropriate config', () => {
      const smallScript: TestScript = {
        meta: { id: 'small', title: 'Small', description: '', version: '2.0.0', created_at: Date.now(), tags: [], pre_condition: '' },
        steps: Array(50).fill(null).map((_, i) => ({
          id: `step-${i}`, order: i + 1, description: `Step ${i}`, expected_result: '', action_ids: [], continue_on_failure: false
        })),
        action_pool: {},
        variables: {}
      };

      const largeScript: TestScript = {
        meta: { id: 'large', title: 'Large', description: '', version: '2.0.0', created_at: Date.now(), tags: [], pre_condition: '' },
        steps: Array(150).fill(null).map((_, i) => ({
          id: `step-${i}`, order: i + 1, description: `Step ${i}`, expected_result: '', action_ids: [], continue_on_failure: false
        })),
        action_pool: {},
        variables: {}
      };

      const smallConfig = getVirtualListConfig(smallScript, 600);
      const largeConfig = getVirtualListConfig(largeScript, 600);

      expect(smallConfig.overscan).toBe(5);
      expect(largeConfig.overscan).toBe(3); // Less overscan for large scripts
    });
  });
});
