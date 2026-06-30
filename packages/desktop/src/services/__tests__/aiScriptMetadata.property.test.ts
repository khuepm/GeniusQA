/**
 * Property-Based Tests for AI Script Metadata Consistency
 * 
 * Tests that AI-generated scripts are saved with the correct metadata fields.
 * For any saved AI-generated script, the metadata should contain:
 * - source='ai_generated'
 * - generated_at timestamp
 * - script_name
 * - target_os
 * 
 * **Feature: ai-script-builder, Property 12: AI Script Metadata Consistency**
 * **Validates: Requirements 7.3, 8.6**
 */

import * as fc from 'fast-check';
import {
    Action,
    ActionType,
    ScriptData,
    ScriptMetadata,
} from '../../types/aiScriptBuilder.types';
import { prepareScriptForSave, TargetOS } from '../scriptStorageService';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid target OS
 */
const targetOSArbitrary: fc.Arbitrary<TargetOS> = fc.constantFrom(
  'macos',
  'windows',
  'universal'
);

/**
 * Generate a valid action type
 */
const actionTypeArbitrary: fc.Arbitrary<ActionType> = fc.constantFrom(
  'mouse_move',
  'mouse_click',
  'mouse_double_click',
  'mouse_drag',
  'mouse_scroll',
  'key_press',
  'key_release',
  'key_type',
  'screenshot',
  'wait',
  'custom'
);

/**
 * Generate a valid action
 */
const actionArbitrary = (timestamp: number): fc.Arbitrary<Action> => {
  return fc.oneof(
    // Mouse actions
    fc.record({
      type: fc.constantFrom('mouse_move' as const, 'mouse_click' as const),
      timestamp: fc.constant(timestamp),
      x: fc.integer({ min: 0, max: 1920 }),
      y: fc.integer({ min: 0, max: 1080 }),
      button: fc.option(fc.constantFrom('left' as const, 'right' as const, 'middle' as const), { nil: undefined }),
    }),
    // Keyboard actions
    fc.record({
      type: fc.constantFrom('key_press' as const, 'key_release' as const),
      timestamp: fc.constant(timestamp),
      key: fc.constantFrom('a', 'b', 'c', 'enter', 'escape', 'tab'),
      modifiers: fc.option(fc.array(fc.constantFrom('ctrl', 'shift', 'alt', 'meta'), { maxLength: 2 }), { nil: undefined }),
    }),
    // Key type action
    fc.record({
      type: fc.constant('key_type' as const),
      timestamp: fc.constant(timestamp),
      text: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    // Wait action
    fc.record({
      type: fc.constant('wait' as const),
      timestamp: fc.constant(timestamp),
    })
  );
};

/**
 * Generate basic script metadata (without AI-specific fields)
 */
const basicScriptMetadataArbitrary = (actionCount: number, duration: number): fc.Arbitrary<ScriptMetadata> => {
  return fc.record({
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(d => d.toISOString()),
    duration: fc.constant(duration),
    action_count: fc.constant(actionCount),
    core_type: fc.constantFrom('rust', 'ai_generated', 'recorded'),
    platform: fc.constantFrom('macos', 'windows', 'linux', 'universal'),
    screen_resolution: fc.option(
      fc.tuple(
        fc.integer({ min: 800, max: 3840 }),
        fc.integer({ min: 600, max: 2160 })
      ) as fc.Arbitrary<[number, number]>,
      { nil: undefined }
    ),
    additional_data: fc.option(
      fc.dictionary(fc.string(), fc.anything()),
      { nil: undefined }
    ),
  });
};

/**
 * Generate a valid script with basic metadata (before AI processing)
 */
const basicScriptArbitrary: fc.Arbitrary<ScriptData> = fc
  .integer({ min: 1, max: 20 })
  .chain(actionCount => {
    // Generate timestamps in ascending order
    const timestamps = Array.from({ length: actionCount }, (_, i) => i * 500);

    // Generate actions with those timestamps
    const actionsArb = fc.array(
      fc.integer({ min: 0, max: actionCount - 1 }).chain(idx =>
        actionArbitrary(timestamps[idx])
      ),
      { minLength: actionCount, maxLength: actionCount }
    );

    return actionsArb.map(actions => {
      // Sort by timestamp to ensure order
      actions.sort((a, b) => a.timestamp - b.timestamp);
      const duration = actions.length > 0 ? actions[actions.length - 1].timestamp : 0;

      return {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration,
          action_count: actions.length,
          core_type: 'rust',
          platform: 'macos',
        },
        actions,
      };
    });
  });

/**
 * Generate a valid script name
 */
const scriptNameArbitrary: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 5, maxLength: 50 })
    .filter(s => s.trim().length >= 5)
    .map(s => s.replace(/[^a-zA-Z0-9_\-\s]/g, '')),
  fc.constantFrom(
    'Login Test',
    'Navigation Flow',
    'Form Submission',
    'Data Entry Script',
    'UI Automation Test'
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if metadata contains all required AI-generated script fields
 */
function hasRequiredAIMetadata(
  metadata: ScriptMetadata,
  expectedScriptName: string,
  expectedTargetOS?: TargetOS
): boolean {
  const additionalData = metadata.additional_data;
  
  if (!additionalData) {
    return false;
  }

  // Check for source='ai_generated'
  if (additionalData.source !== 'ai_generated') {
    return false;
  }

  // Check for generated_at timestamp
  if (!additionalData.generated_at || typeof additionalData.generated_at !== 'string') {
    return false;
  }

  // Validate generated_at is a valid ISO 8601 timestamp
  const generatedAt = new Date(additionalData.generated_at as string);
  if (isNaN(generatedAt.getTime())) {
    return false;
  }

  // Check for script_name
  if (!additionalData.script_name || additionalData.script_name !== expectedScriptName) {
    return false;
  }

  // Check for target_os if provided
  if (expectedTargetOS !== undefined) {
    if (!additionalData.target_os || additionalData.target_os !== expectedTargetOS) {
      return false;
    }
  }

  return true;
}

/**
 * Extract AI metadata fields from script metadata
 */
function extractAIMetadata(metadata: ScriptMetadata): {
  source?: string;
  generated_at?: string;
  script_name?: string;
  target_os?: string;
} {
  const additionalData = metadata.additional_data || {};
  
  return {
    source: additionalData.source as string | undefined,
    generated_at: additionalData.generated_at as string | undefined,
    script_name: additionalData.script_name as string | undefined,
    target_os: additionalData.target_os as string | undefined,
  };
}

/**
 * Check if a timestamp is recent (within last 5 seconds)
 */
function isRecentTimestamp(timestamp: string): boolean {
  const now = new Date();
  const ts = new Date(timestamp);
  const diffMs = now.getTime() - ts.getTime();
  return diffMs >= 0 && diffMs <= 5000; // Within 5 seconds
}

// ============================================================================
// Property Tests
// ============================================================================

describe('AI Script Metadata Consistency Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 12: AI Script Metadata Consistency**
   * **Validates: Requirements 7.3, 8.6**
   * 
   * For any saved AI-generated script, the metadata SHALL contain:
   * - source='ai_generated'
   * - generated_at timestamp
   * - script_name
   * - target_os (when specified)
   */
  describe('Property 12: AI Script Metadata Consistency', () => {
    it('prepareScriptForSave adds all required AI metadata fields', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          targetOSArbitrary,
          (script, scriptName, targetOS) => {
            const preparedScript = prepareScriptForSave(script, scriptName, targetOS);
            
            return hasRequiredAIMetadata(preparedScript.metadata, scriptName, targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave sets source to ai_generated', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            const preparedScript = prepareScriptForSave(script, scriptName);
            const aiMetadata = extractAIMetadata(preparedScript.metadata);
            
            return aiMetadata.source === 'ai_generated';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave adds generated_at timestamp', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            const preparedScript = prepareScriptForSave(script, scriptName);
            const aiMetadata = extractAIMetadata(preparedScript.metadata);
            
            // Should have generated_at field
            if (!aiMetadata.generated_at) {
              return false;
            }

            // Should be a valid ISO 8601 timestamp
            const timestamp = new Date(aiMetadata.generated_at);
            if (isNaN(timestamp.getTime())) {
              return false;
            }

            // Should be a recent timestamp (within last 5 seconds)
            return isRecentTimestamp(aiMetadata.generated_at);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave preserves script_name', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            const preparedScript = prepareScriptForSave(script, scriptName);
            const aiMetadata = extractAIMetadata(preparedScript.metadata);
            
            return aiMetadata.script_name === scriptName;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave includes target_os when provided', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          targetOSArbitrary,
          (script, scriptName, targetOS) => {
            const preparedScript = prepareScriptForSave(script, scriptName, targetOS);
            const aiMetadata = extractAIMetadata(preparedScript.metadata);
            
            return aiMetadata.target_os === targetOS;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave does not include target_os when not provided', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            const preparedScript = prepareScriptForSave(script, scriptName, undefined);
            const aiMetadata = extractAIMetadata(preparedScript.metadata);
            
            // target_os should not be present when not provided
            return aiMetadata.target_os === undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave preserves existing metadata fields', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            const originalCreatedAt = script.metadata.created_at;
            const originalPlatform = script.metadata.platform;
            
            const preparedScript = prepareScriptForSave(script, scriptName);
            
            // Original fields should be preserved
            return preparedScript.metadata.created_at === originalCreatedAt &&
                   preparedScript.metadata.platform === originalPlatform;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave updates action_count to match actual actions', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            const preparedScript = prepareScriptForSave(script, scriptName);
            
            return preparedScript.metadata.action_count === preparedScript.actions.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave sets version to 1.0 if not present', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            // Remove version
            const scriptWithoutVersion = { ...script, version: undefined as any };
            
            const preparedScript = prepareScriptForSave(scriptWithoutVersion, scriptName);
            
            return preparedScript.version === '1.0';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave preserves existing version', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          fc.constantFrom('1.0', '1.1', '2.0'),
          (script, scriptName, version) => {
            const scriptWithVersion = { ...script, version };
            
            const preparedScript = prepareScriptForSave(scriptWithVersion, scriptName);
            
            return preparedScript.version === version;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave adds generated_by field', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            const preparedScript = prepareScriptForSave(script, scriptName);
            const additionalData = preparedScript.metadata.additional_data;
            
            return additionalData?.generated_by === 'ai_script_builder';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave preserves existing additional_data fields', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.string({ minLength: 5, maxLength: 20 }),
          (script, scriptName, customKey, customValue) => {
            // Add custom field to additional_data
            const scriptWithCustomData = {
              ...script,
              metadata: {
                ...script.metadata,
                additional_data: {
                  [customKey]: customValue,
                },
              },
            };
            
            const preparedScript = prepareScriptForSave(scriptWithCustomData, scriptName);
            const additionalData = preparedScript.metadata.additional_data;
            
            // Custom field should be preserved
            return additionalData?.[customKey] === customValue;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('metadata is consistent across multiple preparations of same script', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          targetOSArbitrary,
          (script, scriptName, targetOS) => {
            const prepared1 = prepareScriptForSave(script, scriptName, targetOS);
            const prepared2 = prepareScriptForSave(script, scriptName, targetOS);
            
            const meta1 = extractAIMetadata(prepared1.metadata);
            const meta2 = extractAIMetadata(prepared2.metadata);
            
            // Core fields should be consistent
            return meta1.source === meta2.source &&
                   meta1.script_name === meta2.script_name &&
                   meta1.target_os === meta2.target_os;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different script names produce different metadata', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          scriptNameArbitrary,
          (script, scriptName1, scriptName2) => {
            // Ensure names are different
            if (scriptName1 === scriptName2) {
              return true; // Skip this case
            }
            
            const prepared1 = prepareScriptForSave(script, scriptName1);
            const prepared2 = prepareScriptForSave(script, scriptName2);
            
            const meta1 = extractAIMetadata(prepared1.metadata);
            const meta2 = extractAIMetadata(prepared2.metadata);
            
            return meta1.script_name !== meta2.script_name;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different target OS values produce different metadata', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            const preparedMacOS = prepareScriptForSave(script, scriptName, 'macos');
            const preparedWindows = prepareScriptForSave(script, scriptName, 'windows');
            const preparedUniversal = prepareScriptForSave(script, scriptName, 'universal');
            
            const metaMacOS = extractAIMetadata(preparedMacOS.metadata);
            const metaWindows = extractAIMetadata(preparedWindows.metadata);
            const metaUniversal = extractAIMetadata(preparedUniversal.metadata);
            
            return metaMacOS.target_os === 'macos' &&
                   metaWindows.target_os === 'windows' &&
                   metaUniversal.target_os === 'universal' &&
                   metaMacOS.target_os !== metaWindows.target_os &&
                   metaWindows.target_os !== metaUniversal.target_os;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave handles scripts with no actions', () => {
      fc.assert(
        fc.property(
          scriptNameArbitrary,
          targetOSArbitrary,
          (scriptName, targetOS) => {
            const emptyScript: ScriptData = {
              version: '1.0',
              metadata: {
                created_at: new Date().toISOString(),
                duration: 0,
                action_count: 0,
                core_type: 'rust',
                platform: 'macos',
              },
              actions: [],
            };
            
            const preparedScript = prepareScriptForSave(emptyScript, scriptName, targetOS);
            
            return hasRequiredAIMetadata(preparedScript.metadata, scriptName, targetOS) &&
                   preparedScript.metadata.action_count === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave handles scripts with many actions', () => {
      fc.assert(
        fc.property(
          scriptNameArbitrary,
          targetOSArbitrary,
          fc.integer({ min: 50, max: 100 }),
          (scriptName, targetOS, actionCount) => {
            const actions: Action[] = Array.from({ length: actionCount }, (_, i) => ({
              type: 'mouse_click' as const,
              timestamp: i * 100,
              x: 100 + i,
              y: 100 + i,
              button: 'left' as const,
            }));

            const largeScript: ScriptData = {
              version: '1.0',
              metadata: {
                created_at: new Date().toISOString(),
                duration: actions[actions.length - 1].timestamp,
                action_count: actions.length,
                core_type: 'rust',
                platform: 'macos',
              },
              actions,
            };
            
            const preparedScript = prepareScriptForSave(largeScript, scriptName, targetOS);
            
            return hasRequiredAIMetadata(preparedScript.metadata, scriptName, targetOS) &&
                   preparedScript.metadata.action_count === actionCount;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('prepareScriptForSave handles special characters in script names', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          fc.constantFrom(
            'Test-Script_123',
            'My Script (v2)',
            'Script #1',
            'Test & Verify',
            'Script [Final]'
          ),
          (script, scriptName) => {
            const preparedScript = prepareScriptForSave(script, scriptName);
            const aiMetadata = extractAIMetadata(preparedScript.metadata);
            
            return aiMetadata.script_name === scriptName;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generated_at timestamp is always in ISO 8601 format', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          (script, scriptName) => {
            const preparedScript = prepareScriptForSave(script, scriptName);
            const aiMetadata = extractAIMetadata(preparedScript.metadata);
            
            if (!aiMetadata.generated_at) {
              return false;
            }

            // Check ISO 8601 format (basic validation)
            const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
            return iso8601Regex.test(aiMetadata.generated_at);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prepareScriptForSave is idempotent for AI metadata', () => {
      fc.assert(
        fc.property(
          basicScriptArbitrary,
          scriptNameArbitrary,
          targetOSArbitrary,
          (script, scriptName, targetOS) => {
            const prepared1 = prepareScriptForSave(script, scriptName, targetOS);
            const prepared2 = prepareScriptForSave(prepared1, scriptName, targetOS);
            
            const meta1 = extractAIMetadata(prepared1.metadata);
            const meta2 = extractAIMetadata(prepared2.metadata);
            
            // Core fields should remain the same (except generated_at which updates)
            return meta1.source === meta2.source &&
                   meta1.script_name === meta2.script_name &&
                   meta1.target_os === meta2.target_os;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Edge cases and boundary conditions
   */
  describe('Edge Cases and Boundary Conditions', () => {
    it('handles empty script name', () => {
      const script: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 0,
          action_count: 1,
          core_type: 'rust',
          platform: 'macos',
        },
        actions: [{
          type: 'wait',
          timestamp: 0,
        }],
      };

      const preparedScript = prepareScriptForSave(script, '');
      const aiMetadata = extractAIMetadata(preparedScript.metadata);
      
      expect(aiMetadata.script_name).toBe('');
      expect(aiMetadata.source).toBe('ai_generated');
    });

    it('handles very long script names', () => {
      const longName = 'A'.repeat(500);
      const script: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 0,
          action_count: 1,
          core_type: 'rust',
          platform: 'macos',
        },
        actions: [{
          type: 'wait',
          timestamp: 0,
        }],
      };

      const preparedScript = prepareScriptForSave(script, longName);
      const aiMetadata = extractAIMetadata(preparedScript.metadata);
      
      expect(aiMetadata.script_name).toBe(longName);
    });

    it('handles script with undefined metadata fields', () => {
      const script: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 0,
          action_count: 1,
          core_type: 'rust',
          platform: 'macos',
          additional_data: undefined,
        },
        actions: [{
          type: 'wait',
          timestamp: 0,
        }],
      };

      const preparedScript = prepareScriptForSave(script, 'Test Script', 'macos');
      
      expect(hasRequiredAIMetadata(preparedScript.metadata, 'Test Script', 'macos')).toBe(true);
    });

    it('handles all valid target OS values', () => {
      const script: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 0,
          action_count: 1,
          core_type: 'rust',
          platform: 'macos',
        },
        actions: [{
          type: 'wait',
          timestamp: 0,
        }],
      };

      const targetOSValues: TargetOS[] = ['macos', 'windows', 'universal'];
      
      for (const targetOS of targetOSValues) {
        const preparedScript = prepareScriptForSave(script, 'Test', targetOS);
        const aiMetadata = extractAIMetadata(preparedScript.metadata);
        
        expect(aiMetadata.target_os).toBe(targetOS);
      }
    });
  });
});
