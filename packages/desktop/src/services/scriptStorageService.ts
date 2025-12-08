/**
 * Script Storage Service
 * 
 * Handles saving, loading, and managing AI-generated scripts
 * through the IPC bridge to the Tauri backend.
 * 
 * Requirements: 4.3, 6.5, 9.1, 9.4
 */

import { getIPCBridge } from './ipcBridgeService';
import { ScriptData } from '../types/aiScriptBuilder.types';

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
 */
class ScriptStorageService {
  private ipcBridge = getIPCBridge();

  /**
   * Saves an AI-generated script to the user's library
   * @param script - The script data to save
   * @param scriptName - The name for the script
   * @returns Result of the save operation
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
      
      console.log('[ScriptStorageService] Saving script:', {
        scriptName,
        scriptPath,
        actionCount: preparedScript.actions.length,
      });

      // Save via IPC bridge
      await this.ipcBridge.saveScript(scriptPath, preparedScript);

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
   * @param scriptPath - The path to the script file
   * @returns The script data or null if not found
   */
  async loadScript(scriptPath: string): Promise<ScriptData | null> {
    try {
      const scriptData = await this.ipcBridge.loadScript(scriptPath);
      return scriptData as ScriptData;
    } catch (error) {
      console.error('[ScriptStorageService] Failed to load script:', error);
      return null;
    }
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

// Export singleton instance
export const scriptStorageService = new ScriptStorageService();

export default scriptStorageService;
