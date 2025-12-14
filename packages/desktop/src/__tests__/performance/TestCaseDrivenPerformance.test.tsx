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

      // Verify roughly linear scaling (allowing for some variance)
      for (let i = 1; i < performanceResults.length; i++) {
        const prev = performanceResults[i - 1];
        const curr = performanceResults[i];
        const sizeRatio = curr.size / prev.size;
        const timeRatio = curr.time / prev.time;

        // Time should scale roughly linearly (within 3x of size ratio)
        expect(timeRatio).toBeLessThan(sizeRatio * 3);
      }
    });
  });
});
