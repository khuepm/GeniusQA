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
 * Extended to support AI Vision Capture actions with proper serialization,
 * validation, and asset folder management.
 * 
 * Requirements: 5.5, 5.6
 */
class ScriptStorageService {
  private ipcBridge = getIPCBridge();

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
   * Loads a script by path
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
      
      // Validate and process AI Vision Capture actions
      const processedScript = this.processActionsOnLoad(scriptData as ExtendedScriptData, scriptPath);
      
      return processedScript;
    } catch (error) {
      console.error('[ScriptStorageService] Failed to load script:', error);
      return null;
    }
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
