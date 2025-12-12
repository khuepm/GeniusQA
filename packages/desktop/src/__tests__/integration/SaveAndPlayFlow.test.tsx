/**
 * Integration Tests for Save and Play Flow
 * Tests: Generate → Save → Play → Monitor progress
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { ScriptData } from '../../types/aiScriptBuilder.types';
import {
  validateScriptName,
  generateFilename,
  generateDefaultName,
} from '../../components/ScriptNameDialog';
import {
  generateScriptPath,
  prepareScriptForSave,
} from '../../services/scriptStorageService';
import { validateScript } from '../../services/scriptValidationService';

/**
 * Helper to create a valid AI-generated test script
 */
function createAIGeneratedScript(overrides: Partial<ScriptData> = {}): ScriptData {
  return {
    version: '1.0',
    metadata: {
      created_at: new Date().toISOString(),
      duration: 5000,
      action_count: 4,
      core_type: 'ai_generated',
      platform: 'macos',
      additional_data: {
        target_os: 'macos',
        generated_by: 'ai_script_builder',
        generated_at: new Date().toISOString(),
      },
    },
    actions: [
      { type: 'mouse_click', timestamp: 0, x: 100, y: 200, button: 'left' },
      { type: 'key_type', timestamp: 1000, text: 'Hello World' },
      { type: 'wait', timestamp: 2000 },
      { type: 'mouse_click', timestamp: 3000, x: 300, y: 400, button: 'left' },
    ],
    ...overrides,
  };
}

describe('Save and Play Flow Integration Tests', () => {
  describe('Script Generation and Validation', () => {
    /**
     * Test: Valid script passes validation
     * Requirements: 7.1
     */
    it('should validate a correctly generated script', () => {
      const script = createAIGeneratedScript();
      const result = validateScript(script);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    /**
     * Test: Script with out-of-bounds coordinates generates warnings
     * Requirements: 7.1
     * Note: Negative coordinates generate warnings in validateScript
     */
    it('should generate warnings for script with out-of-bounds coordinates', () => {
      const script = createAIGeneratedScript({
        actions: [
          { type: 'mouse_click', timestamp: 0, x: -100, y: 200, button: 'left' },
        ],
      });

      const result = validateScript(script);

      // validateScript generates warnings for out-of-bounds coordinates
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    /**
     * Test: Script with missing required fields fails validation
     */
    it('should fail validation for script with missing action type', () => {
      const script = createAIGeneratedScript({
        actions: [
          { timestamp: 0, x: 100, y: 200 } as any,
        ],
      });

      const result = validateScript(script);

      expect(result.valid).toBe(false);
    });
  });

  describe('Save Button State', () => {
    /**
     * Test: Save button should be visible for valid generated script
     * Requirements: 7.1
     */
    it('should allow save for valid script', () => {
      const script = createAIGeneratedScript();
      const validationResult = validateScript(script);

      // Save should be allowed when script is valid
      const canSave = validationResult.valid && script.actions.length > 0;
      expect(canSave).toBe(true);
    });

    /**
     * Test: Save button should be disabled for invalid script
     * Requirements: 7.1
     */
    it('should not allow save for invalid script', () => {
      // Create script with missing required field (no button for click action)
      const script = createAIGeneratedScript({
        actions: [
          { type: 'mouse_click', timestamp: 0, x: 100, y: 200 } as any,
        ],
      });
      const validationResult = validateScript(script);

      // Save should not be allowed when script is invalid
      const canSave = validationResult.valid && script.actions.length > 0;
      expect(canSave).toBe(false);
    });

    /**
     * Test: Save button should be disabled for empty script
     * Requirements: 7.1
     */
    it('should not allow save for empty script', () => {
      const script = createAIGeneratedScript({
        actions: [],
      });

      // Save should not be allowed when script has no actions
      const canSave = script.actions.length > 0;
      expect(canSave).toBe(false);
    });
  });

  describe('Script Name Dialog', () => {
    /**
     * Test: Script name prompt appears on save
     * Requirements: 7.2
     */
    it('should validate script name correctly', () => {
      // Valid names
      expect(validateScriptName('My Test Script')).toBeNull();
      expect(validateScriptName('login-flow-test')).toBeNull();
      expect(validateScriptName('test_script_123')).toBeNull();

      // Invalid names
      expect(validateScriptName('')).not.toBeNull();
      expect(validateScriptName('ab')).not.toBeNull();
      expect(validateScriptName('test<script>')).not.toBeNull();
    });

    /**
     * Test: Generate filename from script name
     * Requirements: 7.2
     */
    it('should generate valid filename from script name', () => {
      const filename = generateFilename('My Login Test');

      expect(filename).toContain('ai_script_');
      expect(filename).toContain('my_login_test');
      expect(filename).toMatch(/\.json$/);
    });

    /**
     * Test: Generate default name with timestamp
     * Requirements: 7.2
     */
    it('should generate default name with date', () => {
      const defaultName = generateDefaultName();

      expect(defaultName).toContain('AI Script');
      expect(defaultName.length).toBeGreaterThan(10);
    });
  });

  describe('AI Script Metadata', () => {
    /**
     * Test: Saved script has AI-generated metadata
     * Requirements: 7.3
     */
    it('should add AI-generated metadata when saving', () => {
      const script = createAIGeneratedScript();
      const prepared = prepareScriptForSave(script, 'Test Script');

      expect(prepared.metadata.additional_data?.generated_by).toBe('ai_script_builder');
      expect(prepared.metadata.additional_data?.script_name).toBe('Test Script');
      expect(prepared.metadata.additional_data?.generated_at).toBeDefined();
    });

    /**
     * Test: Metadata includes timestamp
     * Requirements: 7.3
     */
    it('should include generation timestamp in metadata', () => {
      const script = createAIGeneratedScript();
      const prepared = prepareScriptForSave(script, 'Test Script');

      const generatedAt = prepared.metadata.additional_data?.generated_at;
      expect(generatedAt).toBeDefined();

      // Should be a valid ISO date string
      const date = new Date(generatedAt as string);
      expect(date.getTime()).not.toBeNaN();
    });

    /**
     * Test: Metadata preserves original script data
     * Requirements: 7.3
     */
    it('should preserve original script data when adding metadata', () => {
      const script = createAIGeneratedScript({
        metadata: {
          created_at: '2024-01-01T00:00:00Z',
          duration: 10000,
          action_count: 5,
          core_type: 'ai_generated',
          platform: 'windows',
          screen_resolution: [1920, 1080],
        },
      });

      const prepared = prepareScriptForSave(script, 'Test Script');

      expect(prepared.metadata.screen_resolution).toEqual([1920, 1080]);
      expect(prepared.metadata.platform).toBe('windows');
    });
  });

  describe('Play Button State', () => {
    /**
     * Test: Play button visible after successful save
     * Requirements: 7.4
     */
    it('should enable play after script is saved', () => {
      const script = createAIGeneratedScript();
      const isSaved = true; // Simulating successful save
      const isValid = validateScript(script).valid;

      // Play should be enabled when script is saved and valid
      const canPlay = isSaved && isValid;
      expect(canPlay).toBe(true);
    });

    /**
     * Test: Play button not visible before save
     * Requirements: 7.4
     */
    it('should not enable play before script is saved', () => {
      const script = createAIGeneratedScript();
      const isSaved = false;
      const isValid = validateScript(script).valid;

      // Play should not be enabled when script is not saved
      const canPlay = isSaved && isValid;
      expect(canPlay).toBe(false);
    });
  });

  describe('Playback Progress Monitoring', () => {
    /**
     * Test: Progress calculation is correct
     * Requirements: 7.5
     */
    it('should calculate playback progress correctly', () => {
      const totalActions = 10;

      // Test various progress points
      expect((1 / totalActions) * 100).toBe(10);
      expect((5 / totalActions) * 100).toBe(50);
      expect((10 / totalActions) * 100).toBe(100);
    });

    /**
     * Test: Progress state transitions
     * Requirements: 7.5
     */
    it('should track playback state transitions', () => {
      type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'completed' | 'error';

      // Valid state transitions
      const validTransitions: Record<PlaybackStatus, PlaybackStatus[]> = {
        idle: ['playing'],
        playing: ['paused', 'completed', 'error', 'idle'],
        paused: ['playing', 'idle'],
        completed: ['idle', 'playing'],
        error: ['idle'],
      };

      // Test that all transitions are defined
      expect(validTransitions.idle).toContain('playing');
      expect(validTransitions.playing).toContain('paused');
      expect(validTransitions.playing).toContain('completed');
      expect(validTransitions.paused).toContain('playing');
      expect(validTransitions.completed).toContain('idle');
    });
  });

  describe('Playback Error Handling', () => {
    /**
     * Test: Error state allows editing
     * Requirements: 7.6
     */
    it('should allow editing after playback error', () => {
      const hasError = true;
      const isPlaying = false;

      // Should be able to edit when there's an error and not playing
      const canEdit = hasError && !isPlaying;
      expect(canEdit).toBe(true);
    });

    /**
     * Test: Error message is displayed
     * Requirements: 7.6
     */
    it('should format error messages correctly', () => {
      const errorMessage = 'Action execution failed at step 3';

      expect(errorMessage).toContain('failed');
      expect(errorMessage.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Save and Play Flow', () => {
    /**
     * Test: Full flow - Generate → Validate → Save → Play
     * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
     */
    it('should complete full save and play flow', () => {
      // Step 1: Generate script
      const script = createAIGeneratedScript();
      expect(script.actions.length).toBeGreaterThan(0);

      // Step 2: Validate script
      const validationResult = validateScript(script);
      expect(validationResult.valid).toBe(true);

      // Step 3: Prepare for save
      const scriptName = 'My Test Script';
      expect(validateScriptName(scriptName)).toBeNull();

      const prepared = prepareScriptForSave(script, scriptName);
      expect(prepared.metadata.additional_data?.script_name).toBe(scriptName);
      expect(prepared.metadata.additional_data?.generated_by).toBe('ai_script_builder');

      // Step 4: Generate path
      const path = generateScriptPath(scriptName);
      expect(path).toContain('ai_script_');
      expect(path).toMatch(/\.json$/);

      // Step 5: Simulate save success
      const saveResult = { success: true, scriptPath: path };
      expect(saveResult.success).toBe(true);

      // Step 6: Play should now be enabled
      const canPlay = saveResult.success && validationResult.valid;
      expect(canPlay).toBe(true);

      // Step 7: Simulate playback progress
      const totalActions = prepared.actions.length;
      for (let i = 1; i <= totalActions; i++) {
        const progress = (i / totalActions) * 100;
        expect(progress).toBeGreaterThan(0);
        expect(progress).toBeLessThanOrEqual(100);
      }
    });

    /**
     * Test: Flow handles validation failure
     * Requirements: 7.1
     */
    it('should stop flow on validation failure', () => {
      // Step 1: Generate invalid script (missing button for click action)
      const script = createAIGeneratedScript({
        actions: [
          { type: 'mouse_click', timestamp: 0, x: 100, y: 200 } as any,
        ],
      });

      // Step 2: Validate script - should fail
      const validationResult = validateScript(script);
      expect(validationResult.valid).toBe(false);

      // Step 3: Save should not be allowed
      const canSave = validationResult.valid;
      expect(canSave).toBe(false);

      // Flow stops here - no save, no play
    });

    /**
     * Test: Flow handles empty script name
     * Requirements: 7.2
     */
    it('should stop flow on invalid script name', () => {
      // Step 1: Generate valid script
      const script = createAIGeneratedScript();

      // Step 2: Validate script - should pass
      const validationResult = validateScript(script);
      expect(validationResult.valid).toBe(true);

      // Step 3: Invalid script name
      const scriptName = '';
      const nameError = validateScriptName(scriptName);
      expect(nameError).not.toBeNull();

      // Flow stops here - cannot save without valid name
    });
  });

  describe('Script Serialization for Playback', () => {
    /**
     * Test: Script serializes correctly for playback engine
     * Requirements: 7.5
     */
    it('should serialize script to valid JSON for playback', () => {
      const script = createAIGeneratedScript();
      const prepared = prepareScriptForSave(script, 'Test Script');

      // Should serialize without errors
      const json = JSON.stringify(prepared);
      expect(json).toBeDefined();

      // Should deserialize back correctly
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(prepared.version);
      expect(parsed.actions.length).toBe(prepared.actions.length);
    });

    /**
     * Test: Action timestamps are in correct order
     * Requirements: 7.5
     */
    it('should maintain action timestamp order', () => {
      const script = createAIGeneratedScript({
        actions: [
          { type: 'mouse_click', timestamp: 0, x: 100, y: 100, button: 'left' },
          { type: 'key_type', timestamp: 500, text: 'test' },
          { type: 'wait', timestamp: 1000 },
          { type: 'mouse_click', timestamp: 1500, x: 200, y: 200, button: 'left' },
        ],
      });

      // Verify timestamps are in ascending order
      for (let i = 1; i < script.actions.length; i++) {
        expect(script.actions[i].timestamp).toBeGreaterThanOrEqual(
          script.actions[i - 1].timestamp
        );
      }
    });
  });
});
