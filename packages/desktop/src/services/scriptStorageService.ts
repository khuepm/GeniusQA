/**
 * Script Storage Service
 * 
 * Handles saving, loading, and managing AI-generated scripts
 * through the IPC bridge to the Tauri backend.
 * 
 * Requirements: 4.3, 5.5, 5.6, 6.5, 9.1, 9.4
 */

import { getIPCBridge } from './ipcBridgeService';
import { ScriptData, Action } from '../types/aiScriptBuilder.types';
import { 
  AIVisionCaptureAction, 
  InteractionType, 
  SearchScope,
} from '../types/aiVisionCapture.types';
import { toPosixPath } from './assetManager';
import { 
  TestScript, 
  TestStep, 
  ActionWithId, 
  EnhancedScriptMetadata,
  MigrationResult 
} from '../types/testCaseDriven.types';
import { TestScriptMigrationService } from './testScriptMigrationService';
import { 
  validateTestScript as validateTestScriptStructure, 
  repairTestScript, 
  createFallbackScript,
  formatStepErrors,
  canSafelyLoadScript,
  StepValidationResult,
  RecoveryResult,
} from '../utils/stepErrorHandling';

/**
 * Extended action type that includes AI Vision Capture actions
 * This union type allows scripts to contain both regular actions and vision capture actions
 */
export type ExtendedAction = Action | AIVisionCaptureAction;

/**
 * Extended script data that can contain AI Vision Capture actions
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export interface ExtendedScriptData extends Omit<ScriptData, 'actions'> {
  actions: ExtendedAction[];
}

/**
 * Union type for all supported script formats
 * Supports both legacy flat scripts and new step-based scripts
 * Requirements: 6.5, 8.1
 */
export type AnyScriptFormat = ExtendedScriptData | TestScript;

/**
 * Result of a script save operation
 */
export interface ScriptSaveResult {
  success: boolean;
  scriptPath?: string;
  error?: string;
}

/**
 * Script source type - indicates how the script was created
 * Requirements: 9.1, 9.2
 */
export type ScriptSource = 'recorded' | 'ai_generated' | 'unknown';

/**
 * Target OS for AI-generated scripts
 * Requirements: 8.6, 9.5
 */
export type TargetOS = 'macos' | 'windows' | 'universal';

/**
 * Filter options for listing scripts
 * Requirements: 9.4
 */
export interface ScriptFilter {
  source?: ScriptSource | 'all';
  targetOS?: TargetOS;
  searchQuery?: string;
}

/**
 * Script metadata from the storage
 * Extended to include source type and target OS
 * Requirements: 9.1, 9.2, 9.5
 */
export interface StoredScriptInfo {
  filename: string;
  path: string;
  createdAt: string;
  duration: number;
  actionCount: number;
  source: ScriptSource;
  targetOS?: TargetOS;
  scriptName?: string;
}

/**
 * Generates a script file path based on the script name
 * @param scriptName - The user-provided script name
 * @returns The full path for the script file
 */
export function generateScriptPath(scriptName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sanitizedName = scriptName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
  
  // Get home directory - this will be resolved by the backend
  const filename = `ai_script_${sanitizedName}_${timestamp}.json`;
  
  // Return just the filename - the backend will handle the full path
  return filename;
}

/**
 * Prepares script data for saving
 * Ensures all required fields are present and properly formatted
 * @param script - The script data to prepare
 * @param scriptName - The name for the script
 * @returns Prepared script data
 */
export function prepareScriptForSave(script: ScriptData, scriptName: string): ScriptData {
  const now = new Date().toISOString();
  
  return {
    ...script,
    version: script.version || '1.0',
    metadata: {
      ...script.metadata,
      created_at: script.metadata.created_at || now,
      core_type: script.metadata.core_type || 'ai_generated',
      platform: script.metadata.platform || getPlatform(),
      action_count: script.actions.length,
      additional_data: {
        ...script.metadata.additional_data,
        script_name: scriptName,
        generated_by: 'ai_script_builder',
        generated_at: now,
      },
    },
  };
}

/**
 * Gets the current platform
 */
function getPlatform(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('mac')) return 'macos';
  if (userAgent.includes('win')) return 'windows';
  if (userAgent.includes('linux')) return 'linux';
  return 'unknown';
}

/**
 * Script Storage Service class
 * 
 * Extended to support both legacy flat scripts and new step-based TestScript format.
 * Handles automatic migration, format detection, and maintains backward compatibility.
 * 
 * Requirements: 5.5, 5.6, 6.5, 8.1, 8.5
 */
class ScriptStorageService {
  private ipcBridge = getIPCBridge();

  /**
   * Saves a step-based test script to the user's library
   * Handles validation, serialization, and asset management for TestScript format
   * 
   * @param testScript - The test script to save
   * @param scriptName - The name for the script (optional, uses title from metadata)
   * @returns Result of the save operation
   * 
   * Requirements: 8.1, 8.5
   */
  async saveTestScript(testScript: TestScript, scriptName?: string): Promise<ScriptSaveResult> {
    try {
      // Use script title if no name provided
      const finalScriptName = scriptName || testScript.meta.title || 'Untitled Test Script';
      
      // Validate the test script structure
      const validationResult = this.validateTestScript(testScript);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Invalid test script: ${validationResult.errors.join(', ')}`,
        };
      }

      // Generate the filename
      const filename = generateScriptPath(finalScriptName);
      
      // Get the recordings directory path
      const homeDir = await this.getHomeDirectory();
      const scriptPath = `${homeDir}/GeniusQA/recordings/${filename}`;
      
      // Process actions for save (handle AI Vision Capture actions)
      const processedScript = this.processTestScriptForSave(testScript);
      
      // Check if script contains AI Vision Capture actions
      const hasVisionActions = Object.values(processedScript.action_pool).some(
        action => isAIVisionCaptureAction(action)
      );
      
      console.log('[ScriptStorageService] Saving test script:', {
        scriptName: finalScriptName,
        scriptPath,
        stepCount: processedScript.steps.length,
        actionCount: Object.keys(processedScript.action_pool).length,
        hasVisionActions,
      });

      // Ensure assets folder exists if there are vision actions
      if (hasVisionActions) {
        const assetsDir = getAssetsDirectoryPath(scriptPath);
        await this.ensureAssetsFolderExists(assetsDir);
      }

      // Save via IPC bridge
      await this.ipcBridge.saveScript(scriptPath, processedScript);

      console.log('[ScriptStorageService] Test script saved successfully:', scriptPath);

      return {
        success: true,
        scriptPath,
      };
    } catch (error) {
      console.error('[ScriptStorageService] Failed to save test script:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save test script',
      };
    }
  }

  /**
   * Saves an AI-generated script to the user's library
   * Handles AI Vision Capture action serialization and ensures assets folder exists
   * 
   * @param script - The script data to save
   * @param scriptName - The name for the script
   * @returns Result of the save operation
   * 
   * Requirements: 5.5
   */
  async saveScript(script: ScriptData, scriptName: string): Promise<ScriptSaveResult> {
    try {
      // Prepare the script data
      const preparedScript = prepareScriptForSave(script, scriptName);
      
      // Generate the filename
      const filename = generateScriptPath(scriptName);
      
      // Get the recordings directory path
      // The backend expects a full path, so we need to construct it
      const homeDir = await this.getHomeDirectory();
      const scriptPath = `${homeDir}/GeniusQA/recordings/${filename}`;
      
      // Process AI Vision Capture actions - serialize with normalized paths
      const processedScript = this.processActionsForSave(preparedScript);
      
      // Check if script contains AI Vision Capture actions
      const hasVisionActions = processedScript.actions.some(
        action => isAIVisionCaptureAction(action)
      );
      
      console.log('[ScriptStorageService] Saving script:', {
        scriptName,
        scriptPath,
        actionCount: processedScript.actions.length,
        hasVisionActions,
      });

      // Ensure assets folder exists if there are vision actions
      if (hasVisionActions) {
        const assetsDir = getAssetsDirectoryPath(scriptPath);
        await this.ensureAssetsFolderExists(assetsDir);
      }

      // Save via IPC bridge
      await this.ipcBridge.saveScript(scriptPath, processedScript);

      console.log('[ScriptStorageService] Script saved successfully:', scriptPath);

      return {
        success: true,
        scriptPath,
      };
    } catch (error) {
      console.error('[ScriptStorageService] Failed to save script:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save script',
      };
    }
  }

  /**
   * Validates a TestScript structure
   * Requirements: 8.1, 8.5
   * 
   * @param testScript - The test script to validate
   * @returns Validation result with errors
   */
  private validateTestScript(testScript: TestScript): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate metadata
    if (!testScript.meta) {
      errors.push('Missing metadata');
    } else {
      if (!testScript.meta.title || testScript.meta.title.trim() === '') {
        errors.push('Script title is required');
      }
      if (!testScript.meta.version) {
        errors.push('Script version is required');
      }
      if (!testScript.meta.created_at) {
        errors.push('Creation timestamp is required');
      }
    }

    // Validate steps array
    if (!Array.isArray(testScript.steps)) {
      errors.push('Steps must be an array');
    } else {
      const stepIds = new Set<string>();
      const stepOrders = new Set<number>();

      for (let i = 0; i < testScript.steps.length; i++) {
        const step = testScript.steps[i];
        
        if (!step.id || step.id.trim() === '') {
          errors.push(`Step ${i} missing ID`);
        } else if (stepIds.has(step.id)) {
          errors.push(`Duplicate step ID: ${step.id}`);
        } else {
          stepIds.add(step.id);
        }

        if (typeof step.order !== 'number' || step.order < 1) {
          errors.push(`Step ${i} order must be a positive number`);
        } else if (stepOrders.has(step.order)) {
          errors.push(`Duplicate step order: ${step.order}`);
        } else {
          stepOrders.add(step.order);
        }

        if (!step.description || step.description.trim() === '') {
          errors.push(`Step ${i} missing description`);
        }

        if (!Array.isArray(step.action_ids)) {
          errors.push(`Step ${i} action_ids must be an array`);
        }
      }
    }

    // Validate action pool
    if (!testScript.action_pool || typeof testScript.action_pool !== 'object') {
      errors.push('Action pool must be an object');
    } else {
      // Check that all referenced actions exist in the pool
      const poolActionIds = new Set(Object.keys(testScript.action_pool));
      const referencedActionIds = new Set(
        testScript.steps.flatMap(step => step.action_ids)
      );

      for (const actionId of referencedActionIds) {
        if (!poolActionIds.has(actionId)) {
          errors.push(`Referenced action not found in pool: ${actionId}`);
        }
      }

      // Validate individual actions
      for (const [actionId, action] of Object.entries(testScript.action_pool)) {
        if (!action.id || action.id !== actionId) {
          errors.push(`Action ID mismatch: pool key ${actionId} vs action.id ${action.id}`);
        }
        if (typeof action.timestamp !== 'number') {
          errors.push(`Action ${actionId} missing valid timestamp`);
        }
      }
    }

    // Validate variables (optional)
    if (testScript.variables && typeof testScript.variables !== 'object') {
      errors.push('Variables must be an object');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Processes a TestScript for saving - serializes AI Vision Capture actions
   * Requirements: 8.1, 5.5, 5.9
   * 
   * @param testScript - The test script to process
   * @returns Test script with processed actions
   */
  private processTestScriptForSave(testScript: TestScript): TestScript {
    const processedActionPool: Record<string, ActionWithId> = {};

    for (const [actionId, action] of Object.entries(testScript.action_pool)) {
      if (isAIVisionCaptureAction(action)) {
        processedActionPool[actionId] = serializeAIVisionCaptureAction(action) as ActionWithId;
      } else {
        processedActionPool[actionId] = action;
      }
    }

    return {
      ...testScript,
      action_pool: processedActionPool,
    };
  }

  /**
   * Processes actions for saving - serializes AI Vision Capture actions
   * Requirements: 5.5, 5.9
   * 
   * @param script - The script to process
   * @returns Script with processed actions
   */
  private processActionsForSave(script: ScriptData | ExtendedScriptData): ExtendedScriptData {
    const processedActions = script.actions.map((action: ExtendedAction) => {
      if (isAIVisionCaptureAction(action)) {
        return serializeAIVisionCaptureAction(action);
      }
      return action;
    });

    return {
      ...script,
      actions: processedActions,
    };
  }

  /**
   * Ensures the assets folder exists for a script
   * Creates the folder if it doesn't exist
   * 
   * Requirements: 5.5
   * 
   * @param assetsDir - Path to the assets directory
   */
  private async ensureAssetsFolderExists(assetsDir: string): Promise<void> {
    try {
      // Try to save a placeholder file to ensure directory exists
      // The IPC bridge's saveAsset will create parent directories
      console.log('[ScriptStorageService] Ensuring assets folder exists:', assetsDir);
      
      // We don't actually need to create a file - the saveAsset command
      // in the backend will create directories as needed when saving assets
      // This is just a placeholder for future implementation if needed
    } catch (error) {
      console.warn('[ScriptStorageService] Could not ensure assets folder:', error);
      // Non-fatal - the folder will be created when assets are saved
    }
  }

  /**
   * Gets the home directory path
   * Uses Tauri API or fallback to platform-specific default
   */
  private async getHomeDirectory(): Promise<string> {
    // Try to get home directory from Tauri API
    try {
      const tauri = window.__TAURI__ as Record<string, unknown> | undefined;
      const pathModule = tauri?.path as Record<string, unknown> | undefined;
      if (pathModule?.homeDir) {
        const homeDir = pathModule.homeDir as () => Promise<string>;
        return await homeDir();
      }
    } catch {
      // Fallback if Tauri API not available
    }
    
    // Platform-specific fallback
    const platform = getPlatform();
    if (platform === 'windows') {
      return 'C:/Users/Default';
    }
    
    // macOS and Linux
    return '/tmp';
  }

  /**
   * Lists all available scripts with source type information
   * @returns Array of script information with source metadata
   * Requirements: 9.1, 9.2
   */
  async listScripts(): Promise<StoredScriptInfo[]> {
    try {
      const scripts = await this.ipcBridge.listScripts();
      const enrichedScripts: StoredScriptInfo[] = [];

      for (const script of scripts) {
        const scriptInfo = await this.enrichScriptInfo(script);
        enrichedScripts.push(scriptInfo);
      }

      return enrichedScripts;
    } catch (error) {
      console.error('[ScriptStorageService] Failed to list scripts:', error);
      return [];
    }
  }

  /**
   * Lists scripts filtered by source type and/or target OS
   * @param filter - Filter options for scripts
   * @returns Array of filtered script information
   * Requirements: 9.1, 9.4
   */
  async listScriptsBySource(filter: ScriptFilter): Promise<StoredScriptInfo[]> {
    try {
      const allScripts = await this.listScripts();
      
      return allScripts.filter(script => {
        // Filter by source
        if (filter.source && filter.source !== 'all') {
          if (script.source !== filter.source) {
            return false;
          }
        }

        // Filter by target OS (only applicable for AI-generated scripts)
        if (filter.targetOS) {
          if (script.source === 'ai_generated' && script.targetOS !== filter.targetOS) {
            return false;
          }
        }

        // Filter by search query
        if (filter.searchQuery) {
          const query = filter.searchQuery.toLowerCase();
          const filename = script.filename.toLowerCase();
          const scriptName = (script.scriptName || '').toLowerCase();
          if (!filename.includes(query) && !scriptName.includes(query)) {
            return false;
          }
        }

        return true;
      });
    } catch (error) {
      console.error('[ScriptStorageService] Failed to list scripts by source:', error);
      return [];
    }
  }

  /**
   * Enriches script info with source type and target OS by loading metadata
   * @param script - Basic script info from IPC
   * @returns Enriched script info with source metadata
   */
  private async enrichScriptInfo(script: any): Promise<StoredScriptInfo> {
    const basicInfo: StoredScriptInfo = {
      filename: script.filename || script.name,
      path: script.path || script.scriptPath,
      createdAt: script.created_at || script.createdAt,
      duration: script.duration || 0,
      actionCount: script.action_count || script.actionCount || 0,
      source: 'unknown',
    };

    // Try to determine source from filename pattern
    const source = this.determineSourceFromFilename(basicInfo.filename);
    basicInfo.source = source;

    // For AI-generated scripts, try to load additional metadata
    if (source === 'ai_generated') {
      try {
        const scriptData = await this.loadScript(basicInfo.path);
        if (scriptData?.metadata?.additional_data) {
          const additionalData = scriptData.metadata.additional_data;
          basicInfo.targetOS = additionalData.target_os as TargetOS;
          basicInfo.scriptName = additionalData.script_name as string;
        }
      } catch {
        // If we can't load the script, just use the basic info
        console.warn('[ScriptStorageService] Could not load metadata for:', basicInfo.path);
      }
    }

    return basicInfo;
  }

  /**
   * Determines script source from filename pattern
   * AI-generated scripts have 'ai_script_' prefix
   * @param filename - The script filename
   * @returns The determined source type
   */
  private determineSourceFromFilename(filename: string): ScriptSource {
    if (filename.startsWith('ai_script_')) {
      return 'ai_generated';
    }
    // Scripts from recorder typically have 'recording_' prefix or timestamp pattern
    if (filename.startsWith('recording_') || /^\d{4}-\d{2}-\d{2}/.test(filename)) {
      return 'recorded';
    }
    // Default to recorded for legacy scripts
    return 'recorded';
  }

  /**
   * Loads any script format and returns it in the appropriate format
   * Automatically detects format and handles migration if needed
   * 
   * @param scriptPath - The path to the script file
   * @returns The script data in its native format or null if not found
   * 
   * Requirements: 6.5, 8.1
   */
  async loadAnyScript(scriptPath: string): Promise<AnyScriptFormat | null> {
    try {
      const rawScriptData = await this.ipcBridge.loadScript(scriptPath);
      
      if (!rawScriptData) {
        return null;
      }

      // Detect format and process accordingly
      if (TestScriptMigrationService.isStepBasedFormat(rawScriptData)) {
        // It's already a TestScript format
        return this.processTestScriptOnLoad(rawScriptData as TestScript, scriptPath);
      } else if (TestScriptMigrationService.isLegacyFormat(rawScriptData)) {
        // It's a legacy format - return as ExtendedScriptData
        return this.processActionsOnLoad(rawScriptData as ExtendedScriptData, scriptPath);
      } else {
        console.warn('[ScriptStorageService] Unknown script format:', scriptPath);
        return null;
      }
    } catch (error) {
      console.error('[ScriptStorageService] Failed to load script:', error);
      return null;
    }
  }

  /**
   * Loads a script and migrates it to TestScript format if needed
   * 
   * @param scriptPath - The path to the script file
   * @returns Migration result with TestScript or error
   * 
   * Requirements: 6.5, 8.1
   */
  async loadScriptAsTestScript(scriptPath: string): Promise<MigrationResult> {
    try {
      const rawScriptData = await this.ipcBridge.loadScript(scriptPath);
      
      if (!rawScriptData) {
        return {
          success: false,
          error: 'Script file not found',
          was_legacy: false,
        };
      }

      // Check if it's already in TestScript format
      if (TestScriptMigrationService.isStepBasedFormat(rawScriptData)) {
        const processedScript = this.processTestScriptOnLoad(rawScriptData as TestScript, scriptPath);
        return {
          success: true,
          migrated_script: processedScript,
          was_legacy: false,
        };
      }

      // Check if it's a legacy format that can be migrated
      if (TestScriptMigrationService.isLegacyFormat(rawScriptData)) {
        console.log('[ScriptStorageService] Migrating legacy script:', scriptPath);
        
        const migratedScript = TestScriptMigrationService.migrateLegacyScript(rawScriptData);
        const processedScript = this.processTestScriptOnLoad(migratedScript, scriptPath);
        
        // Validate the migration
        const validationResult = TestScriptMigrationService.validateMigration(rawScriptData, migratedScript);
        if (!validationResult.isValid) {
          return {
            success: false,
            error: `Migration validation failed: ${validationResult.errors.join(', ')}`,
            was_legacy: true,
          };
        }

        return {
          success: true,
          migrated_script: processedScript,
          was_legacy: true,
        };
      }

      return {
        success: false,
        error: 'Unknown script format',
        was_legacy: false,
      };
    } catch (error) {
      console.error('[ScriptStorageService] Failed to load and migrate script:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load script',
        was_legacy: false,
      };
    }
  }

  /**
   * Loads a script by path (legacy method for backward compatibility)
   * Validates AI Vision Capture actions on load
   * 
   * @param scriptPath - The path to the script file
   * @returns The script data or null if not found
   * 
   * Requirements: 5.6
   */
  async loadScript(scriptPath: string): Promise<ExtendedScriptData | null> {
    try {
      const scriptData = await this.ipcBridge.loadScript(scriptPath);
      
      if (!scriptData) {
        return null;
      }
      
      // Only handle legacy format scripts in this method
      if (TestScriptMigrationService.isLegacyFormat(scriptData)) {
        return this.processActionsOnLoad(scriptData as ExtendedScriptData, scriptPath);
      }
      
      // For TestScript format, convert back to legacy format for compatibility
      if (TestScriptMigrationService.isStepBasedFormat(scriptData)) {
        const testScript = scriptData as TestScript;
        const legacyScript = TestScriptMigrationService.convertToLegacyFormat(testScript);
        return this.processActionsOnLoad(legacyScript as unknown as ExtendedScriptData, scriptPath);
      }
      
      console.warn('[ScriptStorageService] Unknown script format in loadScript:', scriptPath);
      return null;
    } catch (error) {
      console.error('[ScriptStorageService] Failed to load script:', error);
      return null;
    }
  }

  /**
   * Processes a TestScript on load - validates AI Vision Capture actions
   * Requirements: 8.1, 5.6
   * 
   * @param testScript - The loaded test script data
   * @param scriptPath - Path to the script file (for logging)
   * @returns Test script with validated actions
   */
  private processTestScriptOnLoad(testScript: TestScript, scriptPath: string): TestScript {
    const processedActionPool: Record<string, ActionWithId> = {};
    const validationWarnings: string[] = [];
    
    for (const [actionId, action] of Object.entries(testScript.action_pool)) {
      if (isAIVisionCaptureAction(action)) {
        try {
          // Validate the AI Vision Capture action
          const validatedAction = deserializeAIVisionCaptureAction(action) as ActionWithId;
          processedActionPool[actionId] = validatedAction;
        } catch (error) {
          // Log validation error but don't fail the entire load
          const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
          validationWarnings.push(`Action ${actionId}: ${errorMessage}`);
          
          // Still include the action but log the warning
          processedActionPool[actionId] = action;
        }
      } else {
        processedActionPool[actionId] = action;
      }
    }
    
    // Log any validation warnings
    if (validationWarnings.length > 0) {
      console.warn('[ScriptStorageService] AI Vision Capture validation warnings for', scriptPath, ':', validationWarnings);
    }
    
    return {
      ...testScript,
      action_pool: processedActionPool,
    };
  }

  /**
   * Processes actions on load - validates AI Vision Capture actions
   * Requirements: 5.6
   * 
   * @param script - The loaded script data
   * @param scriptPath - Path to the script file (for logging)
   * @returns Script with validated actions
   */
  private processActionsOnLoad(script: ExtendedScriptData, scriptPath: string): ExtendedScriptData {
    const processedActions: ExtendedAction[] = [];
    const validationWarnings: string[] = [];
    
    for (let i = 0; i < script.actions.length; i++) {
      const action = script.actions[i];
      
      if (isAIVisionCaptureAction(action)) {
        try {
          // Validate the AI Vision Capture action
          const validatedAction = deserializeAIVisionCaptureAction(action);
          processedActions.push(validatedAction);
        } catch (error) {
          // Log validation error but don't fail the entire load
          const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
          validationWarnings.push(`Action ${i} (${(action as AIVisionCaptureAction).id}): ${errorMessage}`);
          
          // Still include the action but log the warning
          processedActions.push(action);
        }
      } else {
        processedActions.push(action);
      }
    }
    
    // Log any validation warnings
    if (validationWarnings.length > 0) {
      console.warn('[ScriptStorageService] AI Vision Capture validation warnings for', scriptPath, ':', validationWarnings);
    }
    
    return {
      ...script,
      actions: processedActions,
    };
  }

  /**
   * Deletes a script by path
   * @param scriptPath - The path to the script file
   * @returns True if deleted successfully
   */
  async deleteScript(scriptPath: string): Promise<boolean> {
    try {
      await this.ipcBridge.deleteScript(scriptPath);
      return true;
    } catch (error) {
      console.error('[ScriptStorageService] Failed to delete script:', error);
      return false;
    }
  }

  /**
   * Checks if any scripts exist
   * @returns True if at least one script exists
   */
  async hasScripts(): Promise<boolean> {
    try {
      return await this.ipcBridge.checkForRecordings();
    } catch (error) {
      console.error('[ScriptStorageService] Failed to check for scripts:', error);
      return false;
    }
  }

  /**
   * Attempts to recover a corrupted script file
   * Requirements: 8.4
   * 
   * @param scriptPath - Path to the corrupted script
   * @returns Recovery result with repaired script or error
   */
  async recoverCorruptedScript(scriptPath: string): Promise<MigrationResult> {
    try {
      console.log('[ScriptStorageService] Attempting to recover corrupted script:', scriptPath);
      
      // Try to load the raw file content
      const rawContent = await this.ipcBridge.loadScript(scriptPath);
      
      if (!rawContent) {
        return {
          success: false,
          error: 'Could not read script file',
          was_legacy: false,
        };
      }

      // Try to repair common JSON issues
      const repairedContent = this.repairJsonStructure(rawContent);
      
      // Attempt to parse and validate the repaired content
      if (TestScriptMigrationService.isStepBasedFormat(repairedContent)) {
        const testScript = repairedContent as TestScript;
        
        // Validate and repair the test script structure
        const repairedScript = this.repairTestScriptStructure(testScript);
        
        return {
          success: true,
          migrated_script: repairedScript,
          was_legacy: false,
        };
      } else if (TestScriptMigrationService.isLegacyFormat(repairedContent)) {
        // Try to migrate the legacy script
        const migratedScript = TestScriptMigrationService.migrateLegacyScript(repairedContent);
        
        return {
          success: true,
          migrated_script: migratedScript,
          was_legacy: true,
        };
      }

      return {
        success: false,
        error: 'Could not determine script format after repair attempts',
        was_legacy: false,
      };
    } catch (error) {
      console.error('[ScriptStorageService] Failed to recover corrupted script:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Recovery failed',
        was_legacy: false,
      };
    }
  }

  /**
   * Repairs common JSON structure issues
   * Requirements: 8.4
   * 
   * @param rawContent - Raw script content
   * @returns Repaired content
   */
  private repairJsonStructure(rawContent: any): any {
    // If it's already a valid object, return as-is
    if (typeof rawContent === 'object' && rawContent !== null) {
      return rawContent;
    }

    // If it's a string, try to parse it
    if (typeof rawContent === 'string') {
      try {
        return JSON.parse(rawContent);
      } catch {
        // Try to repair common JSON issues
        let repairedJson = rawContent
          .replace(/,\s*}/g, '}') // Remove trailing commas in objects
          .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
          .replace(/'/g, '"') // Replace single quotes with double quotes
          .replace(/(\w+):/g, '"$1":'); // Quote unquoted keys

        try {
          return JSON.parse(repairedJson);
        } catch {
          throw new Error('Could not repair JSON structure');
        }
      }
    }

    throw new Error('Invalid script content type');
  }

  /**
   * Repairs TestScript structure issues
   * Requirements: 8.4
   * 
   * @param testScript - Potentially corrupted test script
   * @returns Repaired test script
   */
  private repairTestScriptStructure(testScript: TestScript): TestScript {
    const repaired: TestScript = {
      meta: {
        version: testScript.meta?.version || '2.0',
        created_at: testScript.meta?.created_at || new Date().toISOString(),
        duration: testScript.meta?.duration || 0,
        action_count: testScript.meta?.action_count || 0,
        platform: testScript.meta?.platform || 'unknown',
        title: testScript.meta?.title || 'Recovered Script',
        description: testScript.meta?.description || 'Automatically recovered script',
        pre_conditions: testScript.meta?.pre_conditions || '',
        tags: testScript.meta?.tags || ['recovered'],
      },
      steps: [],
      action_pool: {},
      variables: testScript.variables || {},
    };

    // Repair steps array
    if (Array.isArray(testScript.steps)) {
      const validSteps: TestStep[] = [];
      const usedOrders = new Set<number>();
      let nextOrder = 1;

      for (const step of testScript.steps) {
        if (step && typeof step === 'object') {
          // Ensure step has required fields
          const repairedStep: TestStep = {
            id: step.id || `recovered_step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            order: step.order && !usedOrders.has(step.order) ? step.order : nextOrder,
            description: step.description || 'Recovered step',
            expected_result: step.expected_result || '',
            action_ids: Array.isArray(step.action_ids) ? step.action_ids : [],
            continue_on_failure: Boolean(step.continue_on_failure),
          };

          usedOrders.add(repairedStep.order);
          nextOrder = Math.max(nextOrder, repairedStep.order) + 1;
          validSteps.push(repairedStep);
        }
      }

      repaired.steps = validSteps;
    }

    // Repair action pool
    if (testScript.action_pool && typeof testScript.action_pool === 'object') {
      const validActions: Record<string, ActionWithId> = {};

      for (const [actionId, action] of Object.entries(testScript.action_pool)) {
        if (action && typeof action === 'object') {
          // Ensure action has required fields
          const repairedAction: ActionWithId = {
            id: action.id || actionId,
            type: action.type || 'mouse_click',
            timestamp: typeof action.timestamp === 'number' ? action.timestamp : Date.now(),
            x: typeof action.x === 'number' ? action.x : null,
            y: typeof action.y === 'number' ? action.y : null,
            button: action.button || null,
            key: action.key || null,
            screenshot: action.screenshot || null,
            // Preserve AI Vision fields if present
            ...(action.is_dynamic !== undefined && { is_dynamic: action.is_dynamic }),
            ...(action.interaction && { interaction: action.interaction }),
            ...(action.static_data && { static_data: action.static_data }),
            ...(action.dynamic_config && { dynamic_config: action.dynamic_config }),
            ...(action.cache_data && { cache_data: action.cache_data }),
            ...(action.is_assertion !== undefined && { is_assertion: action.is_assertion }),
          };

          validActions[actionId] = repairedAction;
        }
      }

      repaired.action_pool = validActions;
    }

    // Update action count in metadata
    repaired.meta.action_count = Object.keys(repaired.action_pool).length;

    return repaired;
  }

  /**
   * Performs comprehensive validation and repair of a test script
   * Uses the stepErrorHandling utilities for thorough validation
   * Requirements: 6.4, 8.4
   * 
   * @param scriptPath - Path to the script to validate and repair
   * @returns Validation and repair result
   */
  async validateAndRepairScript(scriptPath: string): Promise<{
    validation: StepValidationResult;
    recovery?: RecoveryResult;
    repairedScript?: TestScript;
  }> {
    try {
      // Load the raw script data
      const rawScriptData = await this.ipcBridge.loadScript(scriptPath);
      
      if (!rawScriptData) {
        return {
          validation: {
            isValid: false,
            errors: [{
              type: 'CORRUPTED_STEP_DATA' as any,
              message: 'Script file not found or empty',
              recoverable: false,
            }],
            warnings: [],
            repairableIssues: [],
          },
        };
      }

      // Check if it can be safely loaded
      const safetyCheck = canSafelyLoadScript(rawScriptData);
      if (!safetyCheck.safe) {
        console.warn('[ScriptStorageService] Script safety check failed:', safetyCheck.reason);
      }

      // Perform comprehensive validation
      const validation = validateTestScriptStructure(rawScriptData);
      
      // If validation passed, return success
      if (validation.isValid) {
        return { validation };
      }

      // If there are repairable issues, attempt repair
      if (validation.repairableIssues.length > 0) {
        console.log('[ScriptStorageService] Attempting to repair script:', scriptPath);
        console.log('[ScriptStorageService] Repairable issues:', validation.repairableIssues);
        
        const recovery = repairTestScript(rawScriptData);
        
        if (recovery.success && recovery.repairedScript) {
          console.log('[ScriptStorageService] Script repaired successfully');
          console.log('[ScriptStorageService] Repairs applied:', recovery.repairsApplied);
          
          return {
            validation,
            recovery,
            repairedScript: recovery.repairedScript,
          };
        } else {
          console.error('[ScriptStorageService] Script repair failed:', recovery.unresolvedIssues);
          return {
            validation,
            recovery,
          };
        }
      }

      // Return validation result without repair
      return { validation };
    } catch (error) {
      console.error('[ScriptStorageService] Validation and repair failed:', error);
      return {
        validation: {
          isValid: false,
          errors: [{
            type: 'UNKNOWN_ERROR' as any,
            message: error instanceof Error ? error.message : 'Unknown error during validation',
            recoverable: false,
          }],
          warnings: [],
          repairableIssues: [],
        },
      };
    }
  }

  /**
   * Loads a script with automatic recovery for corrupted data
   * Requirements: 6.4, 8.4
   * 
   * @param scriptPath - Path to the script to load
   * @param autoRepair - Whether to automatically repair corrupted scripts
   * @returns The loaded script or a fallback script if recovery fails
   */
  async loadScriptWithRecovery(
    scriptPath: string, 
    autoRepair: boolean = true
  ): Promise<{
    script: TestScript;
    wasRepaired: boolean;
    repairsApplied: string[];
    warnings: string[];
  }> {
    try {
      // First try normal loading
      const migrationResult = await this.loadScriptAsTestScript(scriptPath);
      
      if (migrationResult.success && migrationResult.migrated_script) {
        return {
          script: migrationResult.migrated_script,
          wasRepaired: false,
          repairsApplied: [],
          warnings: migrationResult.was_legacy ? ['Script was migrated from legacy format'] : [],
        };
      }

      // If normal loading failed and autoRepair is enabled, try repair
      if (autoRepair) {
        console.log('[ScriptStorageService] Normal loading failed, attempting recovery:', scriptPath);
        
        const validationResult = await this.validateAndRepairScript(scriptPath);
        
        if (validationResult.repairedScript) {
          return {
            script: validationResult.repairedScript,
            wasRepaired: true,
            repairsApplied: validationResult.recovery?.repairsApplied || [],
            warnings: [
              'Script was automatically repaired',
              ...validationResult.validation.warnings,
            ],
          };
        }

        // If repair failed, create a fallback script
        console.warn('[ScriptStorageService] Repair failed, creating fallback script');
        const fallbackScript = createFallbackScript(scriptPath);
        
        return {
          script: fallbackScript,
          wasRepaired: true,
          repairsApplied: ['Created fallback script due to unrecoverable corruption'],
          warnings: [
            'Original script could not be recovered',
            formatStepErrors(validationResult.validation.errors),
          ],
        };
      }

      // If autoRepair is disabled, throw an error
      throw new Error(migrationResult.error || 'Failed to load script');
    } catch (error) {
      console.error('[ScriptStorageService] Load with recovery failed:', error);
      
      // Return a fallback script as last resort
      const fallbackScript = createFallbackScript(scriptPath);
      return {
        script: fallbackScript,
        wasRepaired: true,
        repairsApplied: ['Created fallback script due to load failure'],
        warnings: [
          `Load failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  /**
   * Creates a backup of a script before performing risky operations
   * Requirements: 8.4
   * 
   * @param scriptPath - Path to the script to backup
   * @returns Path to the backup file or null if failed
   */
  async createScriptBackup(scriptPath: string): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = scriptPath.replace(/\.json$/, `_backup_${timestamp}.json`);
      
      const scriptData = await this.ipcBridge.loadScript(scriptPath);
      if (scriptData) {
        await this.ipcBridge.saveScript(backupPath, scriptData);
        console.log('[ScriptStorageService] Created backup:', backupPath);
        return backupPath;
      }
      
      return null;
    } catch (error) {
      console.error('[ScriptStorageService] Failed to create backup:', error);
      return null;
    }
  }

  /**
   * Validates script configuration and reports issues
   * Requirements: 8.4
   * 
   * @param scriptPath - Path to the script to validate
   * @returns Validation report with errors and warnings
   */
  async validateScriptConfiguration(scriptPath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    canRecover: boolean;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let canRecover = false;

    try {
      const migrationResult = await this.loadScriptAsTestScript(scriptPath);
      
      if (!migrationResult.success) {
        errors.push(migrationResult.error || 'Failed to load script');
        canRecover = true; // We can try recovery
        return { valid: false, errors, warnings, canRecover };
      }

      const testScript = migrationResult.migrated_script!;
      
      // Validate script structure
      const structureValidation = this.validateTestScript(testScript);
      if (!structureValidation.valid) {
        errors.push(...structureValidation.errors);
      }

      // Check for orphaned actions (actions not referenced by any step)
      const referencedActionIds = new Set(
        testScript.steps.flatMap(step => step.action_ids)
      );
      const poolActionIds = new Set(Object.keys(testScript.action_pool));
      const orphanedActions = Array.from(poolActionIds).filter(
        id => !referencedActionIds.has(id)
      );

      if (orphanedActions.length > 0) {
        warnings.push(`Found ${orphanedActions.length} orphaned actions not referenced by any step`);
      }

      // Check for missing actions (referenced but not in pool)
      const missingActions = Array.from(referencedActionIds).filter(
        id => !poolActionIds.has(id)
      );

      if (missingActions.length > 0) {
        errors.push(`Found ${missingActions.length} missing actions referenced by steps`);
      }

      // Check for duplicate step orders
      const stepOrders = testScript.steps.map(step => step.order);
      const uniqueOrders = new Set(stepOrders);
      if (stepOrders.length !== uniqueOrders.size) {
        warnings.push('Found duplicate step orders');
      }

      // Validate AI Vision Capture actions
      for (const [actionId, action] of Object.entries(testScript.action_pool)) {
        if (isAIVisionCaptureAction(action)) {
          const visionValidation = validateAIVisionCaptureAction(action);
          if (!visionValidation.valid) {
            errors.push(`AI Vision action ${actionId}: ${visionValidation.errors.join(', ')}`);
          }
          if (visionValidation.warnings.length > 0) {
            warnings.push(`AI Vision action ${actionId}: ${visionValidation.warnings.join(', ')}`);
          }
        }
      }

      canRecover = errors.length > 0; // Can attempt recovery if there are errors

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        canRecover,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Validation failed');
      canRecover = true;
      
      return {
        valid: false,
        errors,
        warnings,
        canRecover,
      };
    }
  }
}

// ============================================================================
// AI Vision Capture Validation and Serialization
// Requirements: 5.5, 5.6
// ============================================================================

/**
 * Validation result for AI Vision Capture actions
 */
export interface AIVisionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Type guard to check if an action is an AI Vision Capture action
 * @param action - The action to check
 * @returns True if the action is an AI Vision Capture action
 */
export function isAIVisionCaptureAction(action: unknown): action is AIVisionCaptureAction {
  if (!action || typeof action !== 'object') {
    return false;
  }
  const obj = action as Record<string, unknown>;
  return obj.type === 'ai_vision_capture';
}

/**
 * Validates a VisionROI object
 * @param roi - The ROI to validate
 * @returns Validation result
 */
function validateVisionROI(roi: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (roi === null) {
    return { valid: true, errors: [] };
  }
  
  if (typeof roi !== 'object') {
    return { valid: false, errors: ['ROI must be an object or null'] };
  }
  
  const roiObj = roi as Record<string, unknown>;
  
  if (typeof roiObj.x !== 'number' || roiObj.x < 0) {
    errors.push('ROI x must be a non-negative number');
  }
  if (typeof roiObj.y !== 'number' || roiObj.y < 0) {
    errors.push('ROI y must be a non-negative number');
  }
  if (typeof roiObj.width !== 'number' || roiObj.width <= 0) {
    errors.push('ROI width must be a positive number');
  }
  if (typeof roiObj.height !== 'number' || roiObj.height <= 0) {
    errors.push('ROI height must be a positive number');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates screen dimensions tuple
 * @param dim - The dimensions to validate
 * @returns Validation result
 */
function validateScreenDimensions(dim: unknown, fieldName: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (dim === null) {
    return { valid: true, errors: [] };
  }
  
  if (!Array.isArray(dim) || dim.length !== 2) {
    return { valid: false, errors: [`${fieldName} must be a [width, height] tuple or null`] };
  }
  
  if (typeof dim[0] !== 'number' || dim[0] <= 0) {
    errors.push(`${fieldName}[0] (width) must be a positive number`);
  }
  if (typeof dim[1] !== 'number' || dim[1] <= 0) {
    errors.push(`${fieldName}[1] (height) must be a positive number`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an AI Vision Capture action
 * Requirements: 5.6
 * 
 * @param action - The action to validate
 * @returns Validation result with errors and warnings
 */
export function validateAIVisionCaptureAction(action: unknown): AIVisionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!action || typeof action !== 'object') {
    return { valid: false, errors: ['Action must be an object'], warnings: [] };
  }
  
  const obj = action as Record<string, unknown>;
  
  // Validate required fields
  if (obj.type !== 'ai_vision_capture') {
    errors.push('Action type must be "ai_vision_capture"');
  }
  
  if (typeof obj.id !== 'string' || obj.id.trim() === '') {
    errors.push('Action id must be a non-empty string');
  }
  
  if (typeof obj.timestamp !== 'number' || obj.timestamp < 0) {
    errors.push('Action timestamp must be a non-negative number');
  }
  
  if (typeof obj.is_dynamic !== 'boolean') {
    errors.push('Action is_dynamic must be a boolean');
  }
  
  // Validate interaction type
  const validInteractions: InteractionType[] = ['click', 'dblclick', 'rclick', 'hover'];
  if (!validInteractions.includes(obj.interaction as InteractionType)) {
    errors.push(`Action interaction must be one of: ${validInteractions.join(', ')}`);
  }
  
  // Validate static_data
  if (!obj.static_data || typeof obj.static_data !== 'object') {
    errors.push('Action must have static_data object');
  } else {
    const staticData = obj.static_data as Record<string, unknown>;
    
    if (typeof staticData.original_screenshot !== 'string') {
      errors.push('static_data.original_screenshot must be a string');
    }
    
    if (staticData.saved_x !== null && typeof staticData.saved_x !== 'number') {
      errors.push('static_data.saved_x must be a number or null');
    }
    
    if (staticData.saved_y !== null && typeof staticData.saved_y !== 'number') {
      errors.push('static_data.saved_y must be a number or null');
    }
    
    const screenDimResult = validateScreenDimensions(staticData.screen_dim, 'static_data.screen_dim');
    if (!screenDimResult.valid) {
      errors.push(...screenDimResult.errors);
    }
  }
  
  // Validate dynamic_config
  if (!obj.dynamic_config || typeof obj.dynamic_config !== 'object') {
    errors.push('Action must have dynamic_config object');
  } else {
    const dynamicConfig = obj.dynamic_config as Record<string, unknown>;
    
    if (typeof dynamicConfig.prompt !== 'string') {
      errors.push('dynamic_config.prompt must be a string');
    }
    
    if (!Array.isArray(dynamicConfig.reference_images)) {
      errors.push('dynamic_config.reference_images must be an array');
    } else {
      for (let i = 0; i < dynamicConfig.reference_images.length; i++) {
        if (typeof dynamicConfig.reference_images[i] !== 'string') {
          errors.push(`dynamic_config.reference_images[${i}] must be a string`);
        }
      }
    }
    
    const roiResult = validateVisionROI(dynamicConfig.roi);
    if (!roiResult.valid) {
      errors.push(...roiResult.errors);
    }
    
    const validScopes: SearchScope[] = ['global', 'regional'];
    if (!validScopes.includes(dynamicConfig.search_scope as SearchScope)) {
      errors.push(`dynamic_config.search_scope must be one of: ${validScopes.join(', ')}`);
    }
  }
  
  // Validate cache_data
  if (!obj.cache_data || typeof obj.cache_data !== 'object') {
    errors.push('Action must have cache_data object');
  } else {
    const cacheData = obj.cache_data as Record<string, unknown>;
    
    if (cacheData.cached_x !== null && typeof cacheData.cached_x !== 'number') {
      errors.push('cache_data.cached_x must be a number or null');
    }
    
    if (cacheData.cached_y !== null && typeof cacheData.cached_y !== 'number') {
      errors.push('cache_data.cached_y must be a number or null');
    }
    
    const cacheDimResult = validateScreenDimensions(cacheData.cache_dim, 'cache_data.cache_dim');
    if (!cacheDimResult.valid) {
      errors.push(...cacheDimResult.errors);
    }
  }
  
  // Add warnings for potential issues
  if (obj.is_dynamic === false) {
    const staticData = obj.static_data as Record<string, unknown> | undefined;
    if (staticData && staticData.saved_x === null && staticData.saved_y === null) {
      warnings.push('Static mode action has no saved coordinates - will be skipped during playback');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Normalizes reference image paths to POSIX format
 * Requirements: 5.9
 * 
 * @param action - The AI Vision Capture action to normalize
 * @returns Action with normalized paths
 */
export function normalizeAIVisionCapturePaths(action: AIVisionCaptureAction): AIVisionCaptureAction {
  return {
    ...action,
    static_data: {
      ...action.static_data,
      original_screenshot: toPosixPath(action.static_data.original_screenshot),
    },
    dynamic_config: {
      ...action.dynamic_config,
      reference_images: action.dynamic_config.reference_images.map(path => toPosixPath(path)),
    },
  };
}

/**
 * Serializes an AI Vision Capture action for storage
 * Ensures all paths are in POSIX format
 * Requirements: 5.5, 5.9
 * 
 * @param action - The action to serialize
 * @returns Serialized action object
 */
export function serializeAIVisionCaptureAction(action: AIVisionCaptureAction): AIVisionCaptureAction {
  return normalizeAIVisionCapturePaths(action);
}

/**
 * Deserializes an AI Vision Capture action from storage
 * Validates the action structure
 * Requirements: 5.6
 * 
 * @param data - The raw action data from storage
 * @returns Deserialized and validated action
 * @throws Error if validation fails
 */
export function deserializeAIVisionCaptureAction(data: unknown): AIVisionCaptureAction {
  const validationResult = validateAIVisionCaptureAction(data);
  
  if (!validationResult.valid) {
    throw new Error(`Invalid AI Vision Capture action: ${validationResult.errors.join(', ')}`);
  }
  
  // Log warnings if any
  if (validationResult.warnings.length > 0) {
    console.warn('[ScriptStorageService] AI Vision Capture action warnings:', validationResult.warnings);
  }
  
  return data as AIVisionCaptureAction;
}

/**
 * Gets the assets directory path for a script
 * @param scriptPath - Path to the script file
 * @returns Path to the assets directory
 */
export function getAssetsDirectoryPath(scriptPath: string): string {
  const posixPath = toPosixPath(scriptPath);
  const lastSlash = posixPath.lastIndexOf('/');
  const scriptDir = lastSlash >= 0 ? posixPath.substring(0, lastSlash) : '.';
  return `${scriptDir}/assets`;
}

/**
 * Collects all asset paths from AI Vision Capture actions in a script
 * @param actions - Array of actions from the script
 * @returns Array of unique asset paths
 */
export function collectAssetPaths(actions: ExtendedAction[]): string[] {
  const assetPaths = new Set<string>();
  
  for (const action of actions) {
    if (isAIVisionCaptureAction(action)) {
      // Add original screenshot path
      if (action.static_data.original_screenshot) {
        assetPaths.add(action.static_data.original_screenshot);
      }
      
      // Add reference image paths
      for (const refImage of action.dynamic_config.reference_images) {
        assetPaths.add(refImage);
      }
    }
  }
  
  return Array.from(assetPaths);
}

// Export singleton instance
export const scriptStorageService = new ScriptStorageService();

export default scriptStorageService;

// Export additional utility functions for external use
export {
  TestScriptMigrationService,
};
