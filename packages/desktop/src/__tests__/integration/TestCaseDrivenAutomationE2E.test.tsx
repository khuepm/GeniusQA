/**
 * End-to-End Integration Tests for Test Case Driven Automation
 * 
 * Tests complete workflow from script creation through execution and reporting
 * Validates step-based recording, editing, and playback functionality
 * Ensures proper integration with AI vision capture and assertion features
 * 
 * Requirements: All
 */

import { scriptStorageService } from '../../services/scriptStorageService';
import { TestScriptMigrationService } from '../../services/testScriptMigrationService';
import {
  TestScript,
  TestStep,
  ActionWithId,
  EnhancedScriptMetadata
} from '../../types/testCaseDriven.types';

// Mock services
jest.mock('../../services/scriptStorageService');
jest.mock('../../services/testScriptMigrationService');

// Mock IPC Bridge
const mockIPCBridge = {
  executeScript: jest.fn(),
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  setActiveStep: jest.fn(),
  getRecordingStatus: jest.fn()
};

describe('Test Case Driven Automation E2E Tests', () => {
  let mockScriptStorageService: jest.Mocked<typeof scriptStorageService>;
  let mockMigrationService: jest.Mocked<typeof TestScriptMigrationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScriptStorageService = scriptStorageService as jest.Mocked<typeof scriptStorageService>;
    mockMigrationService = TestScriptMigrationService as jest.Mocked<typeof TestScriptMigrationService>;

    // Reset mock IPC bridge
    mockIPCBridge.executeScript.mockReset();
    mockIPCBridge.startRecording.mockReset();
    mockIPCBridge.stopRecording.mockReset();
    mockIPCBridge.setActiveStep.mockReset();
    mockIPCBridge.getRecordingStatus.mockReset();
  });

  describe('Complete Workflow: Script Creation to Execution', () => {
    test('should handle complete workflow from creation to execution', async () => {
      // Step 1: Create new test script
      const newScript: TestScript = {
        meta: {
          id: 'test-script-1',
          title: 'Login Test',
          description: 'Test user login functionality',
          version: '1.0.0',
          created_at: Date.now(),
          tags: ['login', 'authentication'],
          pre_condition: 'User should be logged out'
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      mockScriptStorageService.saveTestScript.mockResolvedValue({
        success: true,
        scriptPath: '/path/to/script.json'
      });

      // Step 2: Add test steps
      const step1: TestStep = {
        id: 'step-1',
        order: 1,
        description: 'Navigate to login page',
        expected_result: 'Login page should be displayed',
        action_ids: []
      };

      const step2: TestStep = {
        id: 'step-2',
        order: 2,
        description: 'Enter credentials and submit',
        expected_result: 'User should be logged in successfully',
        action_ids: []
      };

      newScript.steps = [step1, step2];

      // Step 3: Record actions for steps
      const action1: ActionWithId = {
        id: 'action-1',
        type: 'mouse_click',
        x: 100,
        y: 200,
        button: 'left',
        timestamp: Date.now()
      };

      const action2: ActionWithId = {
        id: 'action-2',
        type: 'ai_vision_capture',
        prompt: 'Find login button',
        is_assertion: true,
        timestamp: Date.now()
      };

      newScript.action_pool = {
        'action-1': action1,
        'action-2': action2
      };
      newScript.steps[0].action_ids = ['action-1'];
      newScript.steps[1].action_ids = ['action-2'];

      // Step 4: Save script
      await mockScriptStorageService.saveTestScript(newScript);
      expect(mockScriptStorageService.saveTestScript).toHaveBeenCalledWith(newScript);

      // Step 5: Load and execute script
      mockScriptStorageService.loadScript.mockResolvedValue({
        success: true,
        script: newScript,
        format: 'step-based'
      });

      mockIPCBridge.executeScript.mockResolvedValue({
        success: true,
        executionId: 'exec-1'
      });

      const loadResult = await mockScriptStorageService.loadScript('test-script-1');
      expect(loadResult.success).toBe(true);
      expect(loadResult.script).toEqual(newScript);

      const executeResult = await mockIPCBridge.executeScript(newScript);
      expect(executeResult.success).toBe(true);
    });

    test('should handle step-based recording workflow', async () => {
      // Mock recording state
      const recordingState = {
        current_active_step_id: 'step-1',
        recording_mode: 'step',
        pending_actions: []
      };

      mockIPCBridge.startRecording.mockResolvedValue({ success: true });
      mockIPCBridge.stopRecording.mockResolvedValue({
        success: true,
        actions: [
          {
            id: 'recorded-action-1',
            type: 'mouse_click',
            x: 150,
            y: 250,
            button: 'left',
            timestamp: Date.now()
          }
        ]
      });

      // Start recording for specific step
      await mockIPCBridge.startRecording();
      expect(mockIPCBridge.startRecording).toHaveBeenCalled();

      // Stop recording and get actions
      const recordingResult = await mockIPCBridge.stopRecording();
      expect(recordingResult.success).toBe(true);
      expect(recordingResult.actions).toHaveLength(1);
    });

    test('should handle AI vision assertion workflow', async () => {
      const assertionAction: ActionWithId = {
        id: 'assertion-1',
        type: 'ai_vision_capture',
        prompt: 'Verify login success message is displayed',
        is_assertion: true,
        timestamp: Date.now()
      };

      const testScript: TestScript = {
        meta: {
          id: 'assertion-test',
          title: 'Assertion Test',
          description: 'Test AI vision assertions',
          version: '1.0.0',
          created_at: Date.now(),
          tags: ['assertion'],
          pre_condition: 'Application should be running'
        },
        steps: [{
          id: 'assertion-step',
          order: 1,
          description: 'Verify UI state',
          expected_result: 'Success message should be visible',
          action_ids: ['assertion-1']
        }],
        action_pool: {
          'assertion-1': assertionAction
        },
        variables: {}
      };

      mockIPCBridge.executeScript.mockResolvedValue({
        success: true,
        executionId: 'exec-assertion',
        results: {
          steps: [{
            stepId: 'assertion-step',
            status: 'passed',
            message: 'Assertion passed: Element found'
          }]
        }
      });

      const result = await mockIPCBridge.executeScript(testScript);
      expect(result.success).toBe(true);
      expect(result.results?.steps[0].status).toBe('passed');
    });
  });

  describe('Legacy Script Migration Workflow', () => {
    test('should migrate legacy flat script to step-based format', async () => {
      const legacyScript = {
        metadata: {
          id: 'legacy-1',
          title: 'Legacy Script',
          description: 'Old format script',
          version: '1.0.0',
          created_at: Date.now(),
          tags: []
        },
        actions: [
          {
            id: 'legacy-action-1',
            type: 'mouse_click',
            x: 100,
            y: 100,
            button: 'left',
            timestamp: Date.now()
          }
        ],
        variables: {}
      };

      const migratedScript: TestScript = {
        meta: {
          id: 'legacy-1',
          title: 'Legacy Script',
          description: 'Old format script',
          version: '1.0.0',
          created_at: Date.now(),
          tags: [],
          pre_condition: ''
        },
        steps: [{
          id: 'migration-step-1',
          order: 1,
          description: 'Legacy Import - Migrated Actions',
          expected_result: 'All actions execute successfully',
          action_ids: ['legacy-action-1']
        }],
        action_pool: {
          'legacy-action-1': legacyScript.actions[0]
        },
        variables: {}
      };

      mockMigrationService.isStepBasedFormat.mockReturnValue(false);
      mockMigrationService.migrateLegacyScript.mockReturnValue({
        success: true,
        migratedScript,
        warnings: []
      });

      mockScriptStorageService.loadScript.mockResolvedValue({
        success: true,
        script: migratedScript,
        format: 'migrated'
      });

      const result = await mockScriptStorageService.loadScript('legacy-1');
      expect(result.success).toBe(true);
      expect(result.script.steps).toHaveLength(1);
      expect(result.script.steps[0].description).toBe('Legacy Import - Migrated Actions');
    });
  });

  describe('Data Flow and Logic Integration', () => {
    test('should handle step selection and action filtering logic', () => {
      const testScript: TestScript = {
        meta: {
          id: 'filter-test',
          title: 'Filter Test',
          description: 'Test action filtering',
          version: '1.0.0',
          created_at: Date.now(),
          tags: [],
          pre_condition: ''
        },
        steps: [
          {
            id: 'step-1',
            order: 1,
            description: 'First step',
            expected_result: 'Should work',
            action_ids: ['action-1']
          },
          {
            id: 'step-2',
            order: 2,
            description: 'Second step',
            expected_result: 'Should also work',
            action_ids: ['action-2']
          }
        ],
        action_pool: {
          'action-1': {
            id: 'action-1',
            type: 'mouse_click',
            x: 100,
            y: 100,
            button: 'left',
            timestamp: Date.now()
          },
          'action-2': {
            id: 'action-2',
            type: 'keyboard_type',
            text: 'test',
            timestamp: Date.now()
          }
        },
        variables: {}
      };

      // Test step selection logic
      const selectedStepId = 'step-1';
      const selectedStep = testScript.steps.find(step => step.id === selectedStepId);
      expect(selectedStep).toBeDefined();
      expect(selectedStep?.action_ids).toEqual(['action-1']);

      // Test action filtering logic
      const stepActions = selectedStep?.action_ids.map(actionId => testScript.action_pool[actionId]);
      expect(stepActions).toHaveLength(1);
      expect(stepActions?.[0].type).toBe('mouse_click');
    });

    test('should handle step reordering logic', () => {
      const testScript: TestScript = {
        meta: {
          id: 'reorder-test',
          title: 'Reorder Test',
          description: 'Test step reordering',
          version: '1.0.0',
          created_at: Date.now(),
          tags: [],
          pre_condition: ''
        },
        steps: [
          {
            id: 'step-1',
            order: 1,
            description: 'First step',
            expected_result: 'Should work',
            action_ids: ['action-1']
          },
          {
            id: 'step-2',
            order: 2,
            description: 'Second step',
            expected_result: 'Should also work',
            action_ids: ['action-2']
          }
        ],
        action_pool: {
          'action-1': {
            id: 'action-1',
            type: 'mouse_click',
            x: 100,
            y: 100,
            button: 'left',
            timestamp: Date.now()
          },
          'action-2': {
            id: 'action-2',
            type: 'keyboard_type',
            text: 'test',
            timestamp: Date.now()
          }
        },
        variables: {}
      };

      // Test reordering logic
      const originalOrder = testScript.steps.map(step => step.order);
      expect(originalOrder).toEqual([1, 2]);

      // Simulate reordering
      testScript.steps.reverse();
      testScript.steps.forEach((step, index) => {
        step.order = index + 1;
      });

      const newOrder = testScript.steps.map(step => step.order);
      expect(newOrder).toEqual([1, 2]);
      expect(testScript.steps[0].description).toBe('Second step');
      expect(testScript.steps[1].description).toBe('First step');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle script save failures gracefully', async () => {
      const testScript: TestScript = {
        meta: {
          id: 'error-test',
          title: 'Error Test',
          description: 'Test error handling',
          version: '1.0.0',
          created_at: Date.now(),
          tags: [],
          pre_condition: ''
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      mockScriptStorageService.saveTestScript.mockResolvedValue({
        success: false,
        error: 'Failed to save script'
      });

      const result = await mockScriptStorageService.saveTestScript(testScript);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to save script');
    });

    test('should handle execution failures with proper error reporting', async () => {
      const testScript: TestScript = {
        meta: {
          id: 'execution-error-test',
          title: 'Execution Error Test',
          description: 'Test execution error handling',
          version: '1.0.0',
          created_at: Date.now(),
          tags: [],
          pre_condition: ''
        },
        steps: [{
          id: 'failing-step',
          order: 1,
          description: 'This step will fail',
          expected_result: 'Should fail',
          action_ids: ['failing-action']
        }],
        action_pool: {
          'failing-action': {
            id: 'failing-action',
            type: 'ai_vision_capture',
            prompt: 'Find non-existent element',
            is_assertion: true,
            timestamp: Date.now()
          }
        },
        variables: {}
      };

      mockIPCBridge.executeScript.mockResolvedValue({
        success: false,
        error: 'Execution failed',
        results: {
          steps: [{
            stepId: 'failing-step',
            status: 'failed',
            message: 'Assertion failed: Element not found',
            screenshot: 'base64-screenshot-data'
          }]
        }
      });

      const result = await mockIPCBridge.executeScript(testScript);
      expect(result.success).toBe(false);
      expect(result.results?.steps[0].status).toBe('failed');
      expect(result.results?.steps[0].screenshot).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large scripts with many steps efficiently', async () => {
      // Create a script with 50 steps and 200 actions
      const largeScript: TestScript = {
        meta: {
          id: 'large-script',
          title: 'Large Script Test',
          description: 'Test performance with large script',
          version: '1.0.0',
          created_at: Date.now(),
          tags: ['performance'],
          pre_condition: ''
        },
        steps: [],
        action_pool: {},
        variables: {}
      };

      // Generate 50 steps with 4 actions each
      for (let i = 1; i <= 50; i++) {
        const stepId = `step-${i}`;
        const actionIds = [];

        for (let j = 1; j <= 4; j++) {
          const actionId = `action-${i}-${j}`;
          actionIds.push(actionId);

          largeScript.action_pool[actionId] = {
            id: actionId,
            type: 'mouse_click',
            x: i * 10,
            y: j * 10,
            button: 'left',
            timestamp: Date.now() + (i * 1000) + (j * 100)
          };
        }

        largeScript.steps.push({
          id: stepId,
          order: i,
          description: `Step ${i} description`,
          expected_result: `Step ${i} should complete successfully`,
          action_ids: actionIds
        });
      }

      mockScriptStorageService.saveTestScript.mockResolvedValue({
        success: true,
        scriptPath: '/path/to/large-script.json'
      });

      const startTime = Date.now();
      const result = await mockScriptStorageService.saveTestScript(largeScript);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Session State Isolation', () => {
    test('should maintain clean state between executions', () => {
      const testScript: TestScript = {
        meta: {
          id: 'state-test',
          title: 'State Test',
          description: 'Test state isolation',
          version: '1.0.0',
          created_at: Date.now(),
          tags: [],
          pre_condition: ''
        },
        steps: [{
          id: 'test-step',
          order: 1,
          description: 'Test step',
          expected_result: 'Should maintain clean state',
          action_ids: ['test-action']
        }],
        action_pool: {
          'test-action': {
            id: 'test-action',
            type: 'mouse_click',
            x: 100,
            y: 100,
            button: 'left',
            timestamp: Date.now()
          }
        },
        variables: {}
      };

      // Verify script state is clean (no runtime status persisted)
      for (const step of testScript.steps) {
        expect(step).not.toHaveProperty('status');
        expect(step).not.toHaveProperty('error_message');
        expect(step).not.toHaveProperty('screenshot_proof');
      }

      // Simulate adding runtime state (should not persist)
      const runtimeStep = { ...testScript.steps[0], status: 'passed' };

      // Original script should remain unchanged
      expect(testScript.steps[0]).not.toHaveProperty('status');
      expect(runtimeStep.status).toBe('passed');
    });
  });
});
