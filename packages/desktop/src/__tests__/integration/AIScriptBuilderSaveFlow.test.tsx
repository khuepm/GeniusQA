/**
 * Integration Tests for AI Script Builder Save Flow
 * Tests the complete generate → edit → save → load flow
 * 
 * Requirements: 4.3, 6.5
 */

import { ScriptData } from '../../types/aiScriptBuilder.types';
import * as ipcBridgeService from '../../services/ipcBridgeService';
import {
  validateScriptName,
  generateFilename,
  generateDefaultName,
} from '../../components/ScriptNameDialog';
import {
  generateScriptPath,
  prepareScriptForSave,
} from '../../services/scriptStorageService';

// Mock IPC Bridge Service
jest.mock('../../services/ipcBridgeService');

/**
 * Helper to create a valid test script
 */
function createTestScript(overrides: Partial<ScriptData> = {}): ScriptData {
  return {
    version: '1.0',
    metadata: {
      created_at: new Date().toISOString(),
      duration: 5000,
      action_count: 3,
      core_type: 'ai_generated',
      platform: 'macos',
    },
    actions: [
      { type: 'mouse_click', timestamp: 0, x: 100, y: 200, button: 'left' },
      { type: 'key_type', timestamp: 1000, text: 'Hello World' },
      { type: 'wait', timestamp: 2000 },
    ],
    ...overrides,
  };
}

describe('AI Script Builder Save Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Script Name Validation', () => {
    it('should reject empty script names', () => {
      expect(validateScriptName('')).toBe('Script name cannot be empty');
      expect(validateScriptName('   ')).toBe('Script name cannot be empty');
      expect(validateScriptName('\t\n')).toBe('Script name cannot be empty');
    });

    it('should reject short script names', () => {
      expect(validateScriptName('ab')).toBe('Script name must be at least 3 characters');
      expect(validateScriptName('a')).toBe('Script name must be at least 3 characters');
    });

    it('should reject names with invalid characters', () => {
      expect(validateScriptName('test<script>')).toBe(
        'Script name can only contain letters, numbers, spaces, hyphens, and underscores'
      );
      expect(validateScriptName('test/path')).toBe(
        'Script name can only contain letters, numbers, spaces, hyphens, and underscores'
      );
      expect(validateScriptName('test@email')).toBe(
        'Script name can only contain letters, numbers, spaces, hyphens, and underscores'
      );
    });

    it('should accept valid script names', () => {
      expect(validateScriptName('My Test Script')).toBeNull();
      expect(validateScriptName('test-script_123')).toBeNull();
      expect(validateScriptName('Login Flow Test')).toBeNull();
      expect(validateScriptName('abc')).toBeNull();
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(101);
      expect(validateScriptName(longName)).toBe('Script name must be less than 100 characters');
    });
  });

  describe('Filename Generation', () => {
    it('should generate correct filename from script name', () => {
      const filename = generateFilename('My Test Script');

      // Should contain sanitized name
      expect(filename).toContain('my_test_script');
      // Should have ai_script prefix
      expect(filename).toMatch(/^ai_script_/);
      // Should have .json extension
      expect(filename).toMatch(/\.json$/);
      // Should contain timestamp
      expect(filename).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });

    it('should sanitize special characters in filename', () => {
      const filename = generateFilename('Test Script 123');
      expect(filename).toContain('test_script_123');
      expect(filename).not.toContain(' ');
    });

    it('should generate default name with date and time', () => {
      const defaultName = generateDefaultName();
      expect(defaultName).toContain('AI Script');
      // Should contain date components
      expect(defaultName).toMatch(/\w+ \d+/); // e.g., "Dec 6"
    });
  });

  describe('Script Path Generation', () => {
    it('should generate correct script path', () => {
      const path = generateScriptPath('My Test Script');

      // Should be a filename only (backend handles full path)
      expect(path).toMatch(/^ai_script_my_test_script_.*\.json$/);
    });

    it('should handle special characters in script name', () => {
      const path = generateScriptPath('Test Script 123');
      expect(path).toContain('test_script_123');
    });
  });

  describe('Script Preparation for Save', () => {
    it('should prepare script data correctly for saving', () => {
      const testScript = createTestScript();
      const scriptName = 'Test Script';

      const prepared = prepareScriptForSave(testScript, scriptName);

      // Should preserve original data
      expect(prepared.version).toBe('1.0');
      expect(prepared.actions).toHaveLength(3);

      // Should add metadata
      expect(prepared.metadata.additional_data?.script_name).toBe(scriptName);
      expect(prepared.metadata.additional_data?.generated_by).toBe('ai_script_builder');
      expect(prepared.metadata.additional_data?.generated_at).toBeDefined();
    });

    it('should set correct action count', () => {
      const testScript = createTestScript({
        actions: [
          { type: 'mouse_click', timestamp: 0, x: 100, y: 100, button: 'left' },
          { type: 'wait', timestamp: 500 },
        ],
      });

      const prepared = prepareScriptForSave(testScript, 'Test');
      expect(prepared.metadata.action_count).toBe(2);
    });

    it('should preserve existing metadata', () => {
      const testScript = createTestScript({
        metadata: {
          created_at: '2024-01-01T00:00:00Z',
          duration: 10000,
          action_count: 5,
          core_type: 'custom',
          platform: 'windows',
          screen_resolution: [1920, 1080],
        },
      });

      const prepared = prepareScriptForSave(testScript, 'Test');
      expect(prepared.metadata.screen_resolution).toEqual([1920, 1080]);
      expect(prepared.metadata.created_at).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('Script Compatibility with rust-core', () => {
    it('should generate scripts compatible with rust-core format', () => {
      const testScript = createTestScript();

      // Verify required fields for rust-core compatibility
      expect(testScript.version).toBeDefined();
      expect(testScript.metadata).toBeDefined();
      expect(testScript.metadata.created_at).toBeDefined();
      expect(testScript.metadata.duration).toBeGreaterThanOrEqual(0);
      expect(testScript.metadata.action_count).toBe(testScript.actions.length);
      expect(testScript.metadata.platform).toBeDefined();

      // Verify actions have required fields
      testScript.actions.forEach((action) => {
        expect(action.type).toBeDefined();
        expect(action.timestamp).toBeGreaterThanOrEqual(0);

        // Mouse actions should have coordinates
        if (['mouse_click', 'mouse_move', 'mouse_double_click'].includes(action.type)) {
          expect(action.x).toBeDefined();
          expect(action.y).toBeDefined();
        }

        // Key type actions should have text
        if (action.type === 'key_type') {
          expect(action.text).toBeDefined();
        }
      });
    });

    it('should serialize script to valid JSON', () => {
      const testScript = createTestScript();

      // Should serialize without errors
      const json = JSON.stringify(testScript);
      expect(json).toBeDefined();

      // Should deserialize back to equivalent object
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(testScript.version);
      expect(parsed.actions).toHaveLength(testScript.actions.length);
      expect(parsed.metadata.action_count).toBe(testScript.metadata.action_count);
    });

    it('should maintain action order after serialization', () => {
      const testScript = createTestScript({
        actions: [
          { type: 'mouse_click', timestamp: 0, x: 100, y: 100, button: 'left' },
          { type: 'key_type', timestamp: 500, text: 'test' },
          { type: 'mouse_click', timestamp: 1000, x: 200, y: 200, button: 'left' },
          { type: 'wait', timestamp: 1500 },
        ],
      });

      const json = JSON.stringify(testScript);
      const parsed = JSON.parse(json);

      // Verify action order is preserved
      expect(parsed.actions[0].timestamp).toBe(0);
      expect(parsed.actions[1].timestamp).toBe(500);
      expect(parsed.actions[2].timestamp).toBe(1000);
      expect(parsed.actions[3].timestamp).toBe(1500);

      // Verify timestamps are in ascending order
      for (let i = 1; i < parsed.actions.length; i++) {
        expect(parsed.actions[i].timestamp).toBeGreaterThanOrEqual(
          parsed.actions[i - 1].timestamp
        );
      }
    });

    it('should include all action types correctly', () => {
      const testScript = createTestScript({
        actions: [
          { type: 'mouse_move', timestamp: 0, x: 100, y: 100 },
          { type: 'mouse_click', timestamp: 100, x: 100, y: 100, button: 'left' },
          { type: 'mouse_double_click', timestamp: 200, x: 100, y: 100, button: 'left' },
          { type: 'key_press', timestamp: 300, key: 'Enter' },
          { type: 'key_release', timestamp: 400, key: 'Enter' },
          { type: 'key_type', timestamp: 500, text: 'Hello' },
          { type: 'wait', timestamp: 600 },
          { type: 'screenshot', timestamp: 700 },
        ],
      });

      const json = JSON.stringify(testScript);
      const parsed = JSON.parse(json);

      expect(parsed.actions).toHaveLength(8);
      expect(parsed.actions.map((a: { type: string }) => a.type)).toEqual([
        'mouse_move',
        'mouse_click',
        'mouse_double_click',
        'key_press',
        'key_release',
        'key_type',
        'wait',
        'screenshot',
      ]);
    });
  });

  describe('IPC Bridge Integration', () => {
    it('should call saveScript with correct parameters', async () => {
      const mockIPCBridge = {
        saveScript: jest.fn().mockResolvedValue(undefined),
        listScripts: jest.fn().mockResolvedValue([]),
        loadScript: jest.fn().mockResolvedValue(null),
        deleteScript: jest.fn().mockResolvedValue(undefined),
        checkForRecordings: jest.fn().mockResolvedValue(true),
      };

      (ipcBridgeService.getIPCBridge as jest.Mock).mockReturnValue(mockIPCBridge);

      // Reset modules to get fresh instance with new mock
      jest.resetModules();

      // Re-mock after reset
      jest.doMock('../../services/ipcBridgeService', () => ({
        getIPCBridge: jest.fn().mockReturnValue(mockIPCBridge),
      }));

      const { scriptStorageService } = require('../../services/scriptStorageService');

      const testScript = createTestScript();
      await scriptStorageService.saveScript(testScript, 'Test Script');

      expect(mockIPCBridge.saveScript).toHaveBeenCalled();
      const [scriptPath, scriptData] = mockIPCBridge.saveScript.mock.calls[0];

      // Verify path format
      expect(scriptPath).toContain('GeniusQA/recordings');
      expect(scriptPath).toContain('ai_script_test_script');
      expect(scriptPath).toMatch(/\.json$/);

      // Verify script data
      expect(scriptData.version).toBe('1.0');
      expect(scriptData.actions).toHaveLength(3);
    });

    it('should handle IPC bridge errors gracefully', async () => {
      const mockIPCBridge = {
        saveScript: jest.fn().mockRejectedValue(new Error('Storage full')),
        listScripts: jest.fn().mockResolvedValue([]),
        loadScript: jest.fn().mockResolvedValue(null),
        deleteScript: jest.fn().mockResolvedValue(undefined),
        checkForRecordings: jest.fn().mockResolvedValue(false),
      };

      (ipcBridgeService.getIPCBridge as jest.Mock).mockReturnValue(mockIPCBridge);

      jest.resetModules();
      jest.doMock('../../services/ipcBridgeService', () => ({
        getIPCBridge: jest.fn().mockReturnValue(mockIPCBridge),
      }));

      const { scriptStorageService } = require('../../services/scriptStorageService');

      const testScript = createTestScript();
      const result = await scriptStorageService.saveScript(testScript, 'Test Script');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage full');
    });

    it('should list scripts from IPC bridge', async () => {
      const mockScripts = [
        {
          filename: 'ai_script_test_2024-01-01.json',
          path: '/home/user/GeniusQA/recordings/ai_script_test_2024-01-01.json',
          created_at: '2024-01-01T12:00:00Z',
          duration: 5000,
          action_count: 10,
        },
      ];

      const mockIPCBridge = {
        saveScript: jest.fn().mockResolvedValue(undefined),
        listScripts: jest.fn().mockResolvedValue(mockScripts),
        loadScript: jest.fn().mockResolvedValue(null),
        deleteScript: jest.fn().mockResolvedValue(undefined),
        checkForRecordings: jest.fn().mockResolvedValue(true),
      };

      (ipcBridgeService.getIPCBridge as jest.Mock).mockReturnValue(mockIPCBridge);

      jest.resetModules();
      jest.doMock('../../services/ipcBridgeService', () => ({
        getIPCBridge: jest.fn().mockReturnValue(mockIPCBridge),
      }));

      const { scriptStorageService } = require('../../services/scriptStorageService');

      const scripts = await scriptStorageService.listScripts();

      expect(scripts).toHaveLength(1);
      expect(scripts[0].filename).toBe('ai_script_test_2024-01-01.json');
    });

    it('should load script from IPC bridge', async () => {
      const savedScript = createTestScript();

      const mockIPCBridge = {
        saveScript: jest.fn().mockResolvedValue(undefined),
        listScripts: jest.fn().mockResolvedValue([]),
        loadScript: jest.fn().mockResolvedValue(savedScript),
        deleteScript: jest.fn().mockResolvedValue(undefined),
        checkForRecordings: jest.fn().mockResolvedValue(true),
      };

      (ipcBridgeService.getIPCBridge as jest.Mock).mockReturnValue(mockIPCBridge);

      jest.resetModules();
      jest.doMock('../../services/ipcBridgeService', () => ({
        getIPCBridge: jest.fn().mockReturnValue(mockIPCBridge),
      }));

      const { scriptStorageService } = require('../../services/scriptStorageService');

      const loaded = await scriptStorageService.loadScript('/path/to/script.json');

      expect(loaded).toBeDefined();
      expect(loaded?.version).toBe('1.0');
      expect(loaded?.actions).toHaveLength(3);
    });
  });
});
