/**
 * Asset Manager Service
 *
 * Manages storage and retrieval of reference images for AI Vision Capture.
 * Handles cross-platform path normalization and unique filename generation.
 *
 * Requirements: 5.5, 5.9, 5.10, 5.11, 2.6
 */

import { getIPCBridge } from './ipcBridgeService';

/**
 * Result of an asset save operation
 */
export interface AssetSaveResult {
  success: boolean;
  /** Relative path in POSIX format (e.g., "assets/vision_abc123_1702123456789.png") */
  relativePath?: string;
  error?: string;
}

/**
 * Result of an asset load operation
 */
export interface AssetLoadResult {
  success: boolean;
  /** Base64 encoded image data */
  data?: string;
  error?: string;
}

/**
 * Result of an asset delete operation
 */
export interface AssetDeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Converts any path to POSIX format (forward slashes).
 * Used for storing paths in script JSON regardless of OS.
 *
 * Requirements: 5.9
 *
 * @param path - Path with any separator style
 * @returns Path with forward slashes only
 */
export function toPosixPath(path: string): string {
  // Replace all backslashes with forward slashes
  return path.replace(/\\/g, '/');
}

/**
 * Converts POSIX path to OS-native format.
 * Used when loading paths from script JSON for file operations.
 *
 * Requirements: 5.10
 *
 * @param posixPath - Path with forward slashes
 * @returns Path with OS-native separators
 */
export function toNativePath(posixPath: string): string {
  // Detect OS and convert accordingly
  const isWindows = typeof navigator !== 'undefined' 
    ? navigator.userAgent.toLowerCase().includes('win')
    : process.platform === 'win32';
  
  if (isWindows) {
    return posixPath.replace(/\//g, '\\');
  }
  return posixPath;
}

/**
 * Generates a unique filename for reference images.
 * Pattern: vision_{actionId}_{timestamp}.{extension}
 *
 * Requirements: 5.11
 *
 * @param actionId - UUID of the action
 * @param extension - File extension (e.g., 'png', 'jpg')
 * @returns Unique filename
 */
export function generateUniqueFilename(actionId: string, extension: string): string {
  const timestamp = Date.now();
  // Sanitize actionId to remove any invalid characters
  const sanitizedId = actionId.replace(/[^a-zA-Z0-9-]/g, '');
  // Sanitize extension to remove leading dot if present
  const sanitizedExt = extension.replace(/^\./, '').toLowerCase();
  return `vision_${sanitizedId}_${timestamp}.${sanitizedExt}`;
}

/**
 * Extracts file extension from a filename or MIME type.
 *
 * @param input - Filename, path, or MIME type
 * @returns File extension without dot (e.g., 'png')
 */
export function getExtension(input: string): string {
  // Check if it's a MIME type
  if (input.includes('/')) {
    const mimeMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
    };
    return mimeMap[input.toLowerCase()] || 'png';
  }
  
  // Extract from filename/path
  const match = input.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : 'png';
}

/**
 * Asset Manager class for managing reference images.
 *
 * Requirements: 5.5, 2.6
 */
export class AssetManager {
  private scriptPath: string;
  private ipcBridge = getIPCBridge();

  /**
   * Creates an AssetManager instance.
   *
   * @param scriptPath - Path to the script file (used to determine assets directory)
   */
  constructor(scriptPath: string) {
    this.scriptPath = scriptPath;
  }

  /**
   * Gets the assets directory path relative to the script file.
   * Always returns POSIX format path.
   *
   * @returns Relative path to assets directory (e.g., "assets/")
   */
  getAssetsDir(): string {
    return 'assets/';
  }

  /**
   * Gets the absolute path to the assets directory.
   *
   * @returns Absolute path to assets directory
   */
  getAbsoluteAssetsDir(): string {
    const scriptDir = this.getScriptDirectory();
    return toPosixPath(`${scriptDir}/${this.getAssetsDir()}`);
  }

  /**
   * Gets the directory containing the script file.
   *
   * @returns Directory path in POSIX format
   */
  private getScriptDirectory(): string {
    const posixPath = toPosixPath(this.scriptPath);
    const lastSlash = posixPath.lastIndexOf('/');
    return lastSlash >= 0 ? posixPath.substring(0, lastSlash) : '.';
  }

  /**
   * Saves a reference image with auto-generated unique filename.
   *
   * Requirements: 5.5, 5.11, 2.6
   *
   * @param imageData - Blob, base64 string, or data URL
   * @param actionId - UUID of the action (for unique naming)
   * @param mimeType - Optional MIME type (defaults to 'image/png')
   * @returns Result with relative path in POSIX format
   */
  async saveReferenceImage(
    imageData: Blob | string,
    actionId: string,
    mimeType: string = 'image/png'
  ): Promise<AssetSaveResult> {
    try {
      // Determine extension from MIME type
      const extension = getExtension(mimeType);
      
      // Generate unique filename
      const filename = generateUniqueFilename(actionId, extension);
      
      // Relative path in POSIX format
      const relativePath = `${this.getAssetsDir()}${filename}`;
      
      // Absolute path for file operations
      const absolutePath = `${this.getScriptDirectory()}/${relativePath}`;
      
      // Convert image data to base64 if needed
      let base64Data: string;
      if (imageData instanceof Blob) {
        base64Data = await this.blobToBase64(imageData);
      } else if (imageData.startsWith('data:')) {
        // Extract base64 from data URL
        base64Data = imageData.split(',')[1] || imageData;
      } else {
        // Assume it's already base64
        base64Data = imageData;
      }

      // Save via IPC bridge
      await this.ipcBridge.saveAsset(toNativePath(absolutePath), base64Data);

      console.log('[AssetManager] Saved reference image:', relativePath);

      return {
        success: true,
        relativePath: toPosixPath(relativePath),
      };
    } catch (error) {
      console.error('[AssetManager] Failed to save reference image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save reference image',
      };
    }
  }

  /**
   * Loads a reference image by relative path.
   *
   * Requirements: 5.10
   *
   * @param relativePath - Path in POSIX format from script JSON
   * @returns Result with base64 encoded image data
   */
  async loadReferenceImage(relativePath: string): Promise<AssetLoadResult> {
    try {
      // Convert to absolute path
      const absolutePath = `${this.getScriptDirectory()}/${relativePath}`;
      
      // Load via IPC bridge (convert to native path for file operations)
      const base64Data = await this.ipcBridge.loadAsset(toNativePath(absolutePath));

      return {
        success: true,
        data: base64Data,
      };
    } catch (error) {
      console.error('[AssetManager] Failed to load reference image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load reference image',
      };
    }
  }

  /**
   * Deletes a reference image by relative path.
   *
   * @param relativePath - Path in POSIX format from script JSON
   * @returns Result indicating success or failure
   */
  async deleteReferenceImage(relativePath: string): Promise<AssetDeleteResult> {
    try {
      // Convert to absolute path
      const absolutePath = `${this.getScriptDirectory()}/${relativePath}`;
      
      // Delete via IPC bridge (convert to native path for file operations)
      await this.ipcBridge.deleteAsset(toNativePath(absolutePath));

      console.log('[AssetManager] Deleted reference image:', relativePath);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[AssetManager] Failed to delete reference image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete reference image',
      };
    }
  }

  /**
   * Converts a Blob to base64 string.
   *
   * @param blob - Blob to convert
   * @returns Base64 encoded string
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Extract base64 from data URL
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Checks if an asset exists at the given relative path.
   *
   * @param relativePath - Path in POSIX format
   * @returns True if asset exists
   */
  async assetExists(relativePath: string): Promise<boolean> {
    try {
      const result = await this.loadReferenceImage(relativePath);
      return result.success;
    } catch {
      return false;
    }
  }
}

/**
 * Creates an AssetManager instance for a script.
 *
 * @param scriptPath - Path to the script file
 * @returns AssetManager instance
 */
export function createAssetManager(scriptPath: string): AssetManager {
  return new AssetManager(scriptPath);
}

export default AssetManager;
