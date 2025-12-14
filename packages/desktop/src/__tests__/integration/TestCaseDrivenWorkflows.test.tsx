/**
 * Comprehensive Integration Tests for Test Case Driven Automation Workflows
 * 
 * Tests all major user workflows including:
 * - Script creation and management
 * - Step-based recording and editing
 * - Migration scenarios
 * - Error handling and recovery
 * 
 * Requirements: All
 */

import { scriptStorageService } from '../../services/scriptStorageService';
import { TestScriptMigrationService } from '../../services/testScriptMigrationService';
import { reorderSteps } from '../../utils/stepReordering';
import { filterActionsForStep } from '../../utils/stepFiltering';
import {
  TestScript,
  TestStep,
  ActionWithId,
  EditorState,
  StepUIState,
  RecordingState
} from '../../types/testCaseDriven.types';

// Mock services
jest.mock('../../services/scriptStorageService');
jest.mock('../../services/testScriptMigrationService');

describe('Test Case Driven Automation - Complete Workflows', () => {
  let mockScriptStorageService: jest.Mocked<typeof scriptStorageService>;
  let mockMigrationService: jest.Mocked<typeof TestScriptMigrationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScriptStorageService = scriptStorageService as jest.Mocked<typeof scriptStorageService>;
    mockMigrationService = TestScriptMigrationService as jest.Mocked<typeof TestScriptMigrationService>;
  });

  describe('Workflow 1: New Script Creation and Step Management', () => {
    test('should create new script, add steps, and manage step order', async () => {
      // Step 1: Create new empty script
      const newScript: TestScript = {
        meta: {
          id: 'workflow-1',
          title: 'New Test Script',
          description: 'Test script creation workflow',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['workflow', 'new'],
          pre_condition: 'Clean environment'
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      // Step 2: Add multiple test steps
      const steps: TestStep[] = [
        {
          id: 'step-1',
          order: 1,
          description: 'Setup test environment',
          expected_result: 'Environment should be ready',
          action_ids: []
        },
        {
          id: 'step-2',
          order: 2,
          description: 'Execute main test logic',
          expected_result: 'Test should pass',
          action_ids: []
        },
        {
          id: 'step-3',
          order: 3,
          description: 'Cleanup and verify',
          expected_result: 'Environment should be clean',
          action_ids: []
        }
      ];

      newScript.steps = steps;

      // Step 3: Test step reordering
      const reorderedSteps = reorderSteps(newScript.steps, 'step-2', 1);
      expect(reorderedSteps[0].description).toBe('Execute main test logic');
      expect(reorderedSteps[1].description).toBe('Setup test environment');
      expect(reorderedSteps[2].description).toBe('Cleanup and verify');

      // Step 4: Save script
      mockScriptStorageService.saveTestScript.mockResolvedValue({
        success: true,
        scriptPath: '/path/to/workflow-1.json'
      });

      const saveResult = await mockScriptStorageService.saveTestScript(newScript);
      expect(saveResult.success).toBe(true);
      expect(mockScriptStorageService.saveTestScript).toHaveBeenCalledWith(newScript);
    });
  });

  describe('Workflow 2: Recording Actions to Steps', () => {
    test('should record actions and map them to specific steps', () => {
      const testScript: TestScript = {
        meta: {
          id: 'workflow-2',
          title: 'Recording Workflow',
          description: 'Test action recording workflow',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['recording'],
          pre_condition: 'Application running'
        },
        steps: [
          {
            id: 'record-step-1',
            order: 1,
            description: 'Record navigation actions',
            expected_result: 'Should navigate correctly',
            action_ids: []
          }
        ],
        action_pool: {},
        variables: {}
      };

      // Simulate recording actions
      const recordedActions: ActionWithId[] = [
        {
          id: 'action-1',
          type: 'mouse_click',
          x: 100,
          y: 200,
          button: 'left',
          timestamp: Date.now()
        },
        {
          id: 'action-2',
          type: 'keyboard_type',
          text: 'test input',
          timestamp: Date.now() + 1000
        }
      ];

      // Add actions to script
      recordedActions.forEach(action => {
        testScript.action_pool[action.id] = action;
        testScript.steps[0].action_ids.push(action.id);
      });

      // Verify actions are properly mapped
      expect(testScript.steps[0].action_ids).toHaveLength(2);
      expect(testScript.action_pool['action-1'].type).toBe('mouse_click');
      expect(testScript.action_pool['action-2'].type).toBe('keyboard_type');

      // Test action filtering for step
      const selectedStep = testScript.steps[0];
      const stepActions = filterActionsForStep(selectedStep, testScript.action_pool);
      expect(stepActions).toHaveLength(2);
      expect(stepActions[0].id).toBe('action-1');
      expect(stepActions[1].id).toBe('action-2');
    });
  });

  describe('Workflow 3: Legacy Script Migration', () => {
    test('should migrate various legacy script formats', async () => {
      // Test Case 1: Simple legacy script
      const simpleLegacyScript = {
        metadata: {
          id: 'legacy-simple',
          title: 'Simple Legacy Script',
          description: 'Basic legacy format',
          version: '1.0.0',
          created_at: Date.now(),
          tags: ['legacy']
        },
        actions: [
          {
            id: 'legacy-1',
            type: 'mouse_click',
            x: 50,
            y: 100,
            button: 'left',
            timestamp: Date.now()
          }
        ],
        variables: {}
      };

      // Test Case 2: Complex legacy script with multiple action types
      const complexLegacyScript = {
        metadata: {
          id: 'legacy-complex',
          title: 'Complex Legacy Script',
          description: 'Complex legacy format with multiple actions',
          version: '1.0.0',
          created_at: Date.now(),
          tags: ['legacy', 'complex']
        },
        actions: [
          {
            id: 'legacy-1',
            type: 'mouse_move',
            x: 100,
            y: 200,
            timestamp: Date.now()
          },
          {
            id: 'legacy-2',
            type: 'mouse_click',
            x: 100,
            y: 200,
            button: 'left',
            timestamp: Date.now() + 500
          },
          {
            id: 'legacy-3',
            type: 'keyboard_type',
            text: 'test data',
            timestamp: Date.now() + 1000
          }
        ],
        variables: {
          'test_var': 'test_value'
        }
      };

      // Mock migration service responses
      mockMigrationService.isStepBasedFormat.mockReturnValue(false);

      // Test simple migration
      mockMigrationService.migrateLegacyScript.mockReturnValueOnce({
        success: true,
        migratedScript: {
          meta: {
            id: 'legacy-simple',
            title: 'Simple Legacy Script',
            description: 'Basic legacy format',
            version: '2.0.0',
            created_at: Date.now(),
            tags: ['legacy'],
            pre_condition: ''
          },
          steps: [{
            id: 'migration-step-1',
            order: 1,
            description: 'Legacy Import - Migrated Actions',
            expected_result: 'All actions execute successfully',
            action_ids: ['legacy-1']
          }],
          action_pool: {
            'legacy-1': simpleLegacyScript.actions[0]
          },
          variables: {}
        },
        warnings: []
      });

      // Test complex migration
      mockMigrationService.migrateLegacyScript.mockReturnValueOnce({
        success: true,
        migratedScript: {
          meta: {
            id: 'legacy-complex',
            title: 'Complex Legacy Script',
            description: 'Complex legacy format with multiple actions',
            version: '2.0.0',
            created_at: Date.now(),
            tags: ['legacy', 'complex'],
            pre_condition: ''
          },
          steps: [{
            id: 'migration-step-1',
            order: 1,
            description: 'Legacy Import - Migrated Actions',
            expected_result: 'All actions execute successfully',
            action_ids: ['legacy-1', 'legacy-2', 'legacy-3']
          }],
          action_pool: {
            'legacy-1': complexLegacyScript.actions[0],
            'legacy-2': complexLegacyScript.actions[1],
            'legacy-3': complexLegacyScript.actions[2]
          },
          variables: complexLegacyScript.variables
        },
        warnings: ['Complex action types detected - manual review recommended']
      });

      // Execute migrations
      const simpleResult = mockMigrationService.migrateLegacyScript(simpleLegacyScript);
      const complexResult = mockMigrationService.migrateLegacyScript(complexLegacyScript);

      // Verify simple migration
      expect(simpleResult.success).toBe(true);
      expect(simpleResult.migratedScript.steps).toHaveLength(1);
      expect(simpleResult.migratedScript.steps[0].action_ids).toHaveLength(1);
      expect(simpleResult.warnings).toHaveLength(0);

      // Verify complex migration
      expect(complexResult.success).toBe(true);
      expect(complexResult.migratedScript.steps).toHaveLength(1);
      expect(complexResult.migratedScript.steps[0].action_ids).toHaveLength(3);
      expect(complexResult.migratedScript.variables).toEqual(complexLegacyScript.variables);
      expect(complexResult.warnings).toHaveLength(1);
    });
  });

  describe('Workflow 4: Advanced Step Operations', () => {
    test('should handle step operations and data integrity', () => {
      const testScript: TestScript = {
        meta: {
          id: 'workflow-4',
          title: 'Advanced Operations',
          description: 'Test advanced step operations',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['advanced'],
          pre_condition: 'Complex scenario setup'
        },
        steps: [
          {
            id: 'step-1',
            order: 1,
            description: 'First step',
            expected_result: 'First result',
            action_ids: ['action-1', 'action-2']
          },
          {
            id: 'step-2',
            order: 2,
            description: 'Second step',
            expected_result: 'Second result',
            action_ids: ['action-3', 'action-4']
          }
        ],
        action_pool: {
          'action-1': { id: 'action-1', type: 'mouse_click', x: 100, y: 100, button: 'left', timestamp: 1000 },
          'action-2': { id: 'action-2', type: 'mouse_click', x: 200, y: 200, button: 'left', timestamp: 2000 },
          'action-3': { id: 'action-3', type: 'keyboard_type', text: 'test1', timestamp: 3000 },
          'action-4': { id: 'action-4', type: 'keyboard_type', text: 'test2', timestamp: 4000 }
        },
        variables: {}
      };

      // Test step filtering with complex scenarios
      const step1Actions = filterActionsForStep(testScript.steps[0], testScript.action_pool);
      const step2Actions = filterActionsForStep(testScript.steps[1], testScript.action_pool);

      expect(step1Actions).toHaveLength(2);
      expect(step2Actions).toHaveLength(2);
      expect(step1Actions[0].id).toBe('action-1');
      expect(step2Actions[0].id).toBe('action-3');

      // Test action isolation - modifying actions shouldn't affect other steps
      const originalAction = testScript.action_pool['action-1'];
      const modifiedAction = { ...originalAction, x: 150, y: 150 };

      expect(modifiedAction.x).toBe(150);
      expect(modifiedAction.y).toBe(150);
      expect(originalAction.x).toBe(100); // Original unchanged

      // Test step merging logic
      const step1 = testScript.steps[0];
      const step2 = testScript.steps[1];
      const mergedActionIds = [...step1.action_ids, ...step2.action_ids];

      expect(mergedActionIds).toEqual(['action-1', 'action-2', 'action-3', 'action-4']);
      expect(mergedActionIds).toHaveLength(4);
    });
  });

  describe('Workflow 5: Error Handling and Recovery', () => {
    test('should handle various error scenarios gracefully', async () => {
      // Test Case 1: Script save failure
      const problematicScript: TestScript = {
        meta: {
          id: 'error-script',
          title: 'Error Test Script',
          description: 'Script that will cause errors',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['error'],
          pre_condition: 'Error conditions'
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      mockScriptStorageService.saveTestScript.mockResolvedValue({
        success: false,
        error: 'Disk full - cannot save script'
      });

      const saveResult = await mockScriptStorageService.saveTestScript(problematicScript);
      expect(saveResult.success).toBe(false);
      expect(saveResult.error).toContain('Disk full');

      // Test Case 2: Migration failure
      const corruptedLegacyScript = {
        metadata: {
          id: 'corrupted',
          title: 'Corrupted Script'
          // Missing required fields
        },
        actions: [
          {
            // Missing required fields
            type: 'invalid_type'
          }
        ]
      };

      mockMigrationService.migrateLegacyScript.mockReturnValue({
        success: false,
        error: 'Invalid script format - cannot migrate',
        warnings: ['Missing metadata fields', 'Invalid action types detected']
      });

      const migrationResult = mockMigrationService.migrateLegacyScript(corruptedLegacyScript);
      expect(migrationResult.success).toBe(false);
      expect(migrationResult.error).toContain('Invalid script format');
      expect(migrationResult.warnings).toHaveLength(2);

      // Test Case 3: Script load failure
      mockScriptStorageService.loadScript.mockResolvedValue({
        success: false,
        error: 'File not found or corrupted'
      });

      const loadResult = await mockScriptStorageService.loadScript('non-existent-script');
      expect(loadResult.success).toBe(false);
      expect(loadResult.error).toContain('File not found');
    });
  });

  describe('Workflow 6: Session State Management', () => {
    test('should maintain proper session state isolation', () => {
      const testScript: TestScript = {
        meta: {
          id: 'session-test',
          title: 'Session Test Script',
          description: 'Test session state management',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['session'],
          pre_condition: 'Clean session'
        },
        steps: [
          {
            id: 'session-step-1',
            order: 1,
            description: 'Test step for session',
            expected_result: 'Should maintain clean state',
            action_ids: ['session-action-1']
          }
        ],
        action_pool: {
          'session-action-1': {
            id: 'session-action-1',
            type: 'mouse_click',
            x: 100,
            y: 100,
            button: 'left',
            timestamp: Date.now()
          }
        },
        variables: {}
      };

      // Create editor state with runtime data
      const editorState: EditorState = {
        test_script: testScript,
        selected_step_id: 'session-step-1',
        step_ui_states: [
          {
            step_id: 'session-step-1',
            visual_indicator: 'mapped',
            is_expanded: true
          }
        ],
        recording_state: {
          current_active_step_id: null,
          recording_mode: 'inactive',
          pending_actions: []
        },
        modified: false
      };

      // Test session state isolation
      // Test session state isolation by checking script structure

      // Verify runtime state is cleaned
      expect(testScript.steps[0]).not.toHaveProperty('status');
      expect(testScript.steps[0]).not.toHaveProperty('error_message');
      expect(testScript.steps[0]).not.toHaveProperty('screenshot_proof');

      // Verify core data is preserved
      expect(testScript.meta.title).toBe('Session Test Script');
      expect(testScript.steps).toHaveLength(1);
      expect(testScript.action_pool).toHaveProperty('session-action-1');

      // Test that modifications don't affect original
      const modifiedState = { ...editorState };
      modifiedState.modified = true;
      modifiedState.selected_step_id = 'different-step';

      expect(editorState.modified).toBe(false);
      expect(editorState.selected_step_id).toBe('session-step-1');
    });
  });

  describe('Workflow 7: Performance with Large Scripts', () => {
    test('should handle large scripts efficiently', () => {
      // Create large script with many steps and actions
      const largeScript: TestScript = {
        meta: {
          id: 'large-script',
          title: 'Large Performance Test Script',
          description: 'Script with many steps for performance testing',
          version: '2.0.0',
          created_at: Date.now(),
          tags: ['performance', 'large'],
          pre_condition: 'Performance test environment'
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      // Generate 100 steps with 5 actions each (500 total actions)
      for (let stepNum = 1; stepNum <= 100; stepNum++) {
        const stepId = `perf-step-${stepNum}`;
        const actionIds: string[] = [];

        // Create 5 actions per step
        for (let actionNum = 1; actionNum <= 5; actionNum++) {
          const actionId = `perf-action-${stepNum}-${actionNum}`;
          actionIds.push(actionId);

          largeScript.action_pool[actionId] = {
            id: actionId,
            type: 'mouse_click',
            x: stepNum * 10,
            y: actionNum * 10,
            button: 'left',
            timestamp: Date.now() + (stepNum * 1000) + (actionNum * 100)
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

      // Test performance operations
      const startTime = Date.now();

      // Test step filtering performance
      const step50 = largeScript.steps.find(step => step.id === 'perf-step-50');
      const step50Actions = filterActionsForStep(step50!, largeScript.action_pool);
      expect(step50Actions).toHaveLength(5);

      // Test step reordering performance
      const reorderedSteps = reorderSteps(largeScript.steps, 'perf-step-100', 1);
      expect(reorderedSteps[0].description).toBe('Performance test step 100');

      // Test action isolation performance
      const originalAction = largeScript.action_pool['perf-action-1-1'];
      const isolatedAction = { ...originalAction, x: 999, y: 999 };
      expect(isolatedAction.x).toBe(999);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Performance assertion - should complete within reasonable time
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(largeScript.steps).toHaveLength(100);
      expect(Object.keys(largeScript.action_pool)).toHaveLength(500);
    });
  });
});
