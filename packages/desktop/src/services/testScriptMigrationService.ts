/**
 * Test Script Migration Service
 * 
 * Service for migrating legacy flat scripts to the new step-based format
 * and handling the integration between old and new script formats.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { TestScript, TestStep, ActionWithId, EnhancedScriptMetadata } from '../types/testCaseDriven.types';

interface LegacyAction {
  type: 'mouse_move' | 'mouse_click' | 'key_press' | 'key_release' | 'ai_vision_capture';
  timestamp: number;
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  key?: string;
  // AI Vision Capture specific fields
  id?: string;
  is_dynamic?: boolean;
  interaction?: string;
  static_data?: any;
  dynamic_config?: any;
  cache_data?: any;
}

interface LegacyScriptData {
  metadata: {
    version: string;
    created_at: string;
    duration: number;
    action_count: number;
    platform: string;
  };
  actions: LegacyAction[];
}

export class TestScriptMigrationService {
  /**
   * Check if a script is in legacy format
   */
  static isLegacyFormat(scriptData: any): boolean {
    return (
      scriptData &&
      scriptData.metadata &&
      scriptData.actions &&
      Array.isArray(scriptData.actions) &&
      !scriptData.steps &&
      !scriptData.action_pool
    );
  }

  /**
   * Check if a script is in new step-based format
   */
  static isStepBasedFormat(scriptData: any): boolean {
    return (
      scriptData &&
      scriptData.meta &&
      scriptData.steps &&
      Array.isArray(scriptData.steps) &&
      scriptData.action_pool &&
      typeof scriptData.action_pool === 'object'
    );
  }

  /**
   * Migrate legacy script to step-based format
   */
  static migrateLegacyScript(legacyScript: LegacyScriptData): TestScript {
    // Create enhanced metadata from legacy metadata
    const enhancedMeta: EnhancedScriptMetadata = {
      version: '2.0',
      created_at: legacyScript.metadata.created_at,
      duration: legacyScript.metadata.duration,
      action_count: legacyScript.metadata.action_count,
      platform: legacyScript.metadata.platform,
      title: 'Migrated Script',
      description: 'Automatically migrated from legacy format',
      pre_conditions: '',
      tags: ['migrated'],
    };

    // Create action pool from legacy actions
    const actionPool: Record<string, ActionWithId> = {};
    const actionIds: string[] = [];

    legacyScript.actions.forEach((legacyAction, index) => {
      const actionId = legacyAction.id || `migrated_action_${index}_${Date.now()}`;
      
      const action: ActionWithId = {
        id: actionId,
        type: legacyAction.type,
        timestamp: legacyAction.timestamp,
        x: legacyAction.x ?? null,
        y: legacyAction.y ?? null,
        button: legacyAction.button ?? null,
        key: legacyAction.key ?? null,
        screenshot: null,
        // AI Vision specific fields
        is_dynamic: legacyAction.is_dynamic,
        interaction: legacyAction.interaction as any,
        static_data: legacyAction.static_data,
        dynamic_config: legacyAction.dynamic_config,
        cache_data: legacyAction.cache_data,
      };

      actionPool[actionId] = action;
      actionIds.push(actionId);
    });

    // Create default step containing all legacy actions
    const defaultStep: TestStep = {
      id: `migrated_step_${Date.now()}`,
      order: 1,
      description: 'Legacy Import - Migrated Actions',
      expected_result: 'All actions execute successfully',
      action_ids: actionIds,
      continue_on_failure: false,
    };

    // Create the new test script
    const testScript: TestScript = {
      meta: enhancedMeta,
      steps: [defaultStep],
      action_pool: actionPool,
      variables: {},
    };

    return testScript;
  }

  /**
   * Convert step-based script back to legacy format for compatibility
   */
  static convertToLegacyFormat(testScript: TestScript): LegacyScriptData {
    // Extract all actions from the action pool in chronological order
    const allActions: LegacyAction[] = [];
    
    // Go through steps in order and collect their actions
    const sortedSteps = [...testScript.steps].sort((a, b) => a.order - b.order);
    
    for (const step of sortedSteps) {
      for (const actionId of step.action_ids) {
        const action = testScript.action_pool[actionId];
        if (action) {
          const legacyAction: LegacyAction = {
            type: action.type,
            timestamp: action.timestamp,
            ...(action.x !== null && { x: action.x }),
            ...(action.y !== null && { y: action.y }),
            ...(action.button && { button: action.button }),
            ...(action.key && { key: action.key }),
            // AI Vision specific fields
            ...(action.id && { id: action.id }),
            ...(action.is_dynamic !== undefined && { is_dynamic: action.is_dynamic }),
            ...(action.interaction && { interaction: action.interaction }),
            ...(action.static_data && { static_data: action.static_data }),
            ...(action.dynamic_config && { dynamic_config: action.dynamic_config }),
            ...(action.cache_data && { cache_data: action.cache_data }),
          };
          allActions.push(legacyAction);
        }
      }
    }

    // Sort actions by timestamp to maintain chronological order
    allActions.sort((a, b) => a.timestamp - b.timestamp);

    // Create legacy metadata
    const legacyMetadata = {
      version: testScript.meta.version,
      created_at: testScript.meta.created_at,
      duration: testScript.meta.duration,
      action_count: allActions.length,
      platform: testScript.meta.platform,
    };

    return {
      metadata: legacyMetadata,
      actions: allActions,
    };
  }

  /**
   * Validate migrated script integrity
   */
  static validateMigration(
    originalScript: LegacyScriptData,
    migratedScript: TestScript
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check that all original actions are preserved
    if (originalScript.actions.length !== Object.keys(migratedScript.action_pool).length) {
      errors.push('Action count mismatch after migration');
    }

    // Check that metadata is preserved
    if (originalScript.metadata.duration !== migratedScript.meta.duration) {
      errors.push('Duration not preserved during migration');
    }

    if (originalScript.metadata.platform !== migratedScript.meta.platform) {
      errors.push('Platform not preserved during migration');
    }

    // Check that at least one step exists
    if (migratedScript.steps.length === 0) {
      errors.push('No steps created during migration');
    }

    // Check that all actions are referenced by steps
    const referencedActionIds = new Set(
      migratedScript.steps.flatMap(step => step.action_ids)
    );
    const poolActionIds = new Set(Object.keys(migratedScript.action_pool));

    if (referencedActionIds.size !== poolActionIds.size) {
      errors.push('Not all actions are referenced by steps');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a new empty step-based script
   */
  static createNewStepBasedScript(title: string = 'New Test Script'): TestScript {
    const now = new Date().toISOString();

    const meta: EnhancedScriptMetadata = {
      version: '2.0',
      created_at: now,
      duration: 0,
      action_count: 0,
      platform: process.platform,
      title,
      description: '',
      pre_conditions: '',
      tags: [],
    };

    return {
      meta,
      steps: [],
      action_pool: {},
      variables: {},
    };
  }

  /**
   * Add a new step to a test script
   */
  static addStep(
    script: TestScript,
    description: string,
    expectedResult: string = '',
    continueOnFailure: boolean = false
  ): TestScript {
    const newStep: TestStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      order: script.steps.length + 1,
      description,
      expected_result: expectedResult,
      action_ids: [],
      continue_on_failure: continueOnFailure,
    };

    return {
      ...script,
      steps: [...script.steps, newStep],
    };
  }

  /**
   * Update script metadata
   */
  static updateMetadata(
    script: TestScript,
    updates: Partial<EnhancedScriptMetadata>
  ): TestScript {
    return {
      ...script,
      meta: {
        ...script.meta,
        ...updates,
      },
    };
  }
}
