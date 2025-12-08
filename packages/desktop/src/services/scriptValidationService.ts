/**
 * Script Validation Service
 * 
 * Provides validation for AI-generated scripts to ensure compatibility
 * with rust-core format and playback engine.
 * 
 * Requirements: 3.3, 6.1, 6.2, 6.3, 6.4
 */

import {
  ScriptData,
  Action,
  ActionType,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  CompatibilityResult,
  AVAILABLE_ACTION_TYPES,
} from '../types/aiScriptBuilder.types';

/**
 * Valid mouse button values recognized by rust-core
 */
export const VALID_MOUSE_BUTTONS = ['left', 'right', 'middle'] as const;

/**
 * Valid platform values recognized by rust-core
 */
export const VALID_PLATFORMS = ['windows', 'macos', 'linux', 'darwin'] as const;

/**
 * Valid core type values
 */
export const VALID_CORE_TYPES = ['python', 'rust'] as const;

/**
 * Supported script versions
 */
export const SUPPORTED_VERSIONS = ['1.0'] as const;

/**
 * Default screen bounds for coordinate validation
 * These are reasonable defaults; actual bounds may vary by system
 */
export const DEFAULT_SCREEN_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 7680,  // 8K resolution width
  maxY: 4320,  // 8K resolution height
};

/**
 * Action types that require x,y coordinates
 */
const MOUSE_ACTIONS: ActionType[] = [
  'mouse_move',
  'mouse_click',
  'mouse_double_click',
  'mouse_drag',
  'mouse_scroll',
];

/**
 * Action types that require a button field
 */
const CLICK_ACTIONS: ActionType[] = [
  'mouse_click',
  'mouse_double_click',
];

/**
 * Action types that require a key field
 */
const KEY_ACTIONS: ActionType[] = [
  'key_press',
  'key_release',
];


/**
 * Validates a single action against rust-core schema
 * 
 * @param action - The action to validate
 * @param index - Optional index for error reporting
 * @returns ValidationResult with errors and warnings
 */
export function validateAction(action: Action, index?: number): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const actionIndex = index;

  // Validate action type
  if (!AVAILABLE_ACTION_TYPES.includes(action.type)) {
    errors.push({
      field: 'type',
      message: `Invalid action type: ${action.type}. Valid types: ${AVAILABLE_ACTION_TYPES.join(', ')}`,
      actionIndex,
    });
  }

  // Validate timestamp
  if (typeof action.timestamp !== 'number' || action.timestamp < 0) {
    errors.push({
      field: 'timestamp',
      message: 'Timestamp must be a non-negative number',
      actionIndex,
    });
  }

  // Validate mouse actions require coordinates
  if (MOUSE_ACTIONS.includes(action.type)) {
    if (action.x === undefined || action.x === null) {
      errors.push({
        field: 'x',
        message: `Mouse action '${action.type}' requires x coordinate`,
        actionIndex,
      });
    } else if (typeof action.x !== 'number' || !Number.isInteger(action.x)) {
      errors.push({
        field: 'x',
        message: 'X coordinate must be an integer',
        actionIndex,
      });
    } else if (action.x < DEFAULT_SCREEN_BOUNDS.minX || action.x > DEFAULT_SCREEN_BOUNDS.maxX) {
      warnings.push({
        field: 'x',
        message: `X coordinate ${action.x} may be outside screen bounds`,
        actionIndex,
      });
    }

    if (action.y === undefined || action.y === null) {
      errors.push({
        field: 'y',
        message: `Mouse action '${action.type}' requires y coordinate`,
        actionIndex,
      });
    } else if (typeof action.y !== 'number' || !Number.isInteger(action.y)) {
      errors.push({
        field: 'y',
        message: 'Y coordinate must be an integer',
        actionIndex,
      });
    } else if (action.y < DEFAULT_SCREEN_BOUNDS.minY || action.y > DEFAULT_SCREEN_BOUNDS.maxY) {
      warnings.push({
        field: 'y',
        message: `Y coordinate ${action.y} may be outside screen bounds`,
        actionIndex,
      });
    }
  }

  // Validate click actions require button
  if (CLICK_ACTIONS.includes(action.type)) {
    if (!action.button) {
      errors.push({
        field: 'button',
        message: `Click action '${action.type}' requires button field`,
        actionIndex,
      });
    } else if (!VALID_MOUSE_BUTTONS.includes(action.button as typeof VALID_MOUSE_BUTTONS[number])) {
      errors.push({
        field: 'button',
        message: `Invalid button: ${action.button}. Valid buttons: ${VALID_MOUSE_BUTTONS.join(', ')}`,
        actionIndex,
      });
    }
  }

  // Validate keyboard actions require key
  if (KEY_ACTIONS.includes(action.type)) {
    if (!action.key) {
      errors.push({
        field: 'key',
        message: `Keyboard action '${action.type}' requires key field`,
        actionIndex,
      });
    } else if (typeof action.key !== 'string' || action.key.length === 0) {
      errors.push({
        field: 'key',
        message: 'Key must be a non-empty string',
        actionIndex,
      });
    }
  }

  // Validate key_type requires text
  if (action.type === 'key_type') {
    if (action.text === undefined || action.text === null) {
      errors.push({
        field: 'text',
        message: "Key type action requires text field",
        actionIndex,
      });
    } else if (typeof action.text !== 'string') {
      errors.push({
        field: 'text',
        message: 'Text must be a string',
        actionIndex,
      });
    }
  }

  // Validate modifiers if present
  if (action.modifiers !== undefined && action.modifiers !== null) {
    if (!Array.isArray(action.modifiers)) {
      errors.push({
        field: 'modifiers',
        message: 'Modifiers must be an array of strings',
        actionIndex,
      });
    } else if (!action.modifiers.every(m => typeof m === 'string')) {
      errors.push({
        field: 'modifiers',
        message: 'All modifiers must be strings',
        actionIndex,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}


/**
 * Validates an entire script against rust-core schema
 * 
 * @param script - The script to validate
 * @returns ValidationResult with all errors and warnings
 */
export function validateScript(script: ScriptData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate version
  if (!script.version) {
    errors.push({
      field: 'version',
      message: 'Script version is required',
    });
  } else if (!SUPPORTED_VERSIONS.includes(script.version as typeof SUPPORTED_VERSIONS[number])) {
    errors.push({
      field: 'version',
      message: `Unsupported script version: ${script.version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`,
    });
  }

  // Validate metadata
  if (!script.metadata) {
    errors.push({
      field: 'metadata',
      message: 'Script metadata is required',
    });
  } else {
    // Validate metadata fields
    if (!script.metadata.created_at) {
      errors.push({
        field: 'metadata.created_at',
        message: 'Created at timestamp is required',
      });
    }

    if (typeof script.metadata.duration !== 'number' || script.metadata.duration < 0) {
      errors.push({
        field: 'metadata.duration',
        message: 'Duration must be a non-negative number',
      });
    }

    if (typeof script.metadata.action_count !== 'number' || script.metadata.action_count < 0) {
      errors.push({
        field: 'metadata.action_count',
        message: 'Action count must be a non-negative number',
      });
    }

    if (!script.metadata.core_type) {
      errors.push({
        field: 'metadata.core_type',
        message: 'Core type is required',
      });
    } else if (!VALID_CORE_TYPES.includes(script.metadata.core_type as typeof VALID_CORE_TYPES[number])) {
      warnings.push({
        field: 'metadata.core_type',
        message: `Unknown core type: ${script.metadata.core_type}`,
      });
    }

    if (!script.metadata.platform) {
      errors.push({
        field: 'metadata.platform',
        message: 'Platform is required',
      });
    } else if (!VALID_PLATFORMS.includes(script.metadata.platform as typeof VALID_PLATFORMS[number])) {
      warnings.push({
        field: 'metadata.platform',
        message: `Unknown platform: ${script.metadata.platform}`,
      });
    }

    // Validate screen_resolution if present
    if (script.metadata.screen_resolution !== undefined && script.metadata.screen_resolution !== null) {
      if (!Array.isArray(script.metadata.screen_resolution) || script.metadata.screen_resolution.length !== 2) {
        errors.push({
          field: 'metadata.screen_resolution',
          message: 'Screen resolution must be a tuple of [width, height]',
        });
      } else {
        const [width, height] = script.metadata.screen_resolution;
        if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
          errors.push({
            field: 'metadata.screen_resolution',
            message: 'Screen resolution values must be positive numbers',
          });
        }
      }
    }

    // Check action count consistency
    if (script.actions && script.metadata.action_count !== script.actions.length) {
      warnings.push({
        field: 'metadata.action_count',
        message: `Action count (${script.metadata.action_count}) does not match actual actions (${script.actions.length})`,
      });
    }
  }

  // Validate actions array
  if (!script.actions) {
    errors.push({
      field: 'actions',
      message: 'Actions array is required',
    });
  } else if (!Array.isArray(script.actions)) {
    errors.push({
      field: 'actions',
      message: 'Actions must be an array',
    });
  } else {
    // Validate each action
    let lastTimestamp = -1;
    
    for (let i = 0; i < script.actions.length; i++) {
      const action = script.actions[i];
      const actionResult = validateAction(action, i);
      
      errors.push(...actionResult.errors);
      warnings.push(...actionResult.warnings);

      // Validate timestamp ordering
      if (typeof action.timestamp === 'number') {
        if (action.timestamp < lastTimestamp) {
          errors.push({
            field: 'timestamp',
            message: `Action timestamps must be in ascending order. Action ${i} timestamp (${action.timestamp}) is less than previous (${lastTimestamp})`,
            actionIndex: i,
          });
        }
        lastTimestamp = action.timestamp;
      }
    }

    // Check duration consistency with last action timestamp
    if (script.metadata && script.actions.length > 0) {
      const lastAction = script.actions[script.actions.length - 1];
      if (typeof lastAction.timestamp === 'number' && typeof script.metadata.duration === 'number') {
        if (Math.abs(script.metadata.duration - lastAction.timestamp) > 0.1) {
          warnings.push({
            field: 'metadata.duration',
            message: `Duration (${script.metadata.duration}) may not match last action timestamp (${lastAction.timestamp})`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}


/**
 * Checks if a script is compatible with rust-core playback engine
 * 
 * @param script - The script to check
 * @returns CompatibilityResult with compatibility status and issues
 */
export function checkCompatibility(script: ScriptData): CompatibilityResult {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // First run standard validation
  const validationResult = validateScript(script);
  
  // Convert validation errors to compatibility issues
  for (const error of validationResult.errors) {
    issues.push(`${error.field}: ${error.message}`);
  }

  // Add suggestions based on warnings
  for (const warning of validationResult.warnings) {
    suggestions.push(`${warning.field}: ${warning.message}`);
  }

  // Additional rust-core specific compatibility checks
  
  // Check for unsupported action types in rust-core
  if (script.actions) {
    for (let i = 0; i < script.actions.length; i++) {
      const action = script.actions[i];
      
      // Screenshot actions may not be supported during playback
      if (action.type === 'screenshot') {
        suggestions.push(`Action ${i}: Screenshot actions are captured but may not affect playback`);
      }

      // Custom actions require special handling
      if (action.type === 'custom') {
        suggestions.push(`Action ${i}: Custom actions require additional configuration for playback`);
      }

      // Check for negative coordinates (invalid for mouse actions)
      if (MOUSE_ACTIONS.includes(action.type)) {
        if (action.x !== undefined && action.x < 0) {
          issues.push(`Action ${i}: Negative x coordinate (${action.x}) is not valid for mouse actions`);
        }
        if (action.y !== undefined && action.y < 0) {
          issues.push(`Action ${i}: Negative y coordinate (${action.y}) is not valid for mouse actions`);
        }
      }
    }
  }

  // Check metadata compatibility
  if (script.metadata) {
    // Warn if core_type is not rust
    if (script.metadata.core_type && script.metadata.core_type !== 'rust') {
      suggestions.push(`Script was created with ${script.metadata.core_type} core. Some features may behave differently in rust-core`);
    }
  }

  return {
    compatible: issues.length === 0,
    issues,
    suggestions,
  };
}

/**
 * Serializes a ScriptData object to JSON string
 * 
 * @param script - The script to serialize
 * @returns JSON string representation
 */
export function serializeScript(script: ScriptData): string {
  return JSON.stringify(script, null, 2);
}

/**
 * Deserializes a JSON string to ScriptData object
 * 
 * @param json - The JSON string to parse
 * @returns Parsed ScriptData object
 * @throws Error if JSON is invalid or doesn't match schema
 */
export function deserializeScript(json: string): ScriptData {
  const parsed = JSON.parse(json);
  
  // Basic structure validation
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid script JSON: must be an object');
  }
  
  if (!parsed.version) {
    throw new Error('Invalid script JSON: missing version field');
  }
  
  if (!parsed.metadata) {
    throw new Error('Invalid script JSON: missing metadata field');
  }
  
  if (!parsed.actions || !Array.isArray(parsed.actions)) {
    throw new Error('Invalid script JSON: missing or invalid actions field');
  }

  return parsed as ScriptData;
}

/**
 * Creates a valid empty script with default metadata
 * 
 * @param coreType - The core type (default: 'rust')
 * @param platform - The platform (default: current platform)
 * @returns A valid empty ScriptData object
 */
export function createEmptyScript(
  coreType: string = 'rust',
  platform?: string
): ScriptData {
  const detectedPlatform = platform || detectPlatform();
  
  return {
    version: '1.0',
    metadata: {
      created_at: new Date().toISOString(),
      duration: 0,
      action_count: 0,
      core_type: coreType,
      platform: detectedPlatform,
    },
    actions: [],
  };
}

/**
 * Detects the current platform
 */
function detectPlatform(): string {
  if (typeof navigator !== 'undefined') {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('win')) return 'windows';
    if (platform.includes('linux')) return 'linux';
  }
  return 'unknown';
}

/**
 * Validates and fixes common issues in a script
 * Returns a new script with fixes applied
 * 
 * @param script - The script to fix
 * @returns Fixed script and list of applied fixes
 */
export function autoFixScript(script: ScriptData): { script: ScriptData; fixes: string[] } {
  const fixes: string[] = [];
  const fixedScript: ScriptData = JSON.parse(JSON.stringify(script)); // Deep clone

  // Fix action count
  if (fixedScript.metadata && fixedScript.actions) {
    if (fixedScript.metadata.action_count !== fixedScript.actions.length) {
      fixedScript.metadata.action_count = fixedScript.actions.length;
      fixes.push(`Updated action_count from ${script.metadata.action_count} to ${fixedScript.actions.length}`);
    }
  }

  // Fix duration based on last action
  if (fixedScript.metadata && fixedScript.actions && fixedScript.actions.length > 0) {
    const lastTimestamp = fixedScript.actions[fixedScript.actions.length - 1].timestamp;
    if (typeof lastTimestamp === 'number' && fixedScript.metadata.duration !== lastTimestamp) {
      fixedScript.metadata.duration = lastTimestamp;
      fixes.push(`Updated duration to match last action timestamp: ${lastTimestamp}`);
    }
  }

  // Sort actions by timestamp if out of order
  if (fixedScript.actions && fixedScript.actions.length > 1) {
    let needsSort = false;
    for (let i = 1; i < fixedScript.actions.length; i++) {
      if (fixedScript.actions[i].timestamp < fixedScript.actions[i - 1].timestamp) {
        needsSort = true;
        break;
      }
    }
    if (needsSort) {
      fixedScript.actions.sort((a, b) => a.timestamp - b.timestamp);
      fixes.push('Sorted actions by timestamp');
    }
  }

  return { script: fixedScript, fixes };
}
