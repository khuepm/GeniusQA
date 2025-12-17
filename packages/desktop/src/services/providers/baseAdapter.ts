/**
 * Base Adapter Utilities for AI Provider Adapters
 * 
 * Provides shared functionality for all AI provider adapters including:
 * - Unified prompt template builder
 * - Unified response parser for script extraction
 * 
 * Requirements: 5.3, 5.4
 */

import {
  ScriptData,
  Action,
  ActionType,
  ConversationContext,
  AVAILABLE_ACTION_TYPES,
  ACTION_TYPE_DESCRIPTIONS,
} from '../../types/aiScriptBuilder.types';
import {
  AIProvider,
  ProviderResponse,
  ResponseMetadata,
} from '../../types/providerAdapter.types';
import { validateScript, autoFixScript } from '../scriptValidationService';

// ============================================================================
// Prompt Template Builder
// ============================================================================

/**
 * Builds the action schema documentation for prompts
 * Requirements: 5.3 - Unified prompt structure
 */
export function buildActionSchemaDoc(): string {
  const actionDocs: string[] = [];

  for (const actionType of AVAILABLE_ACTION_TYPES) {
    const description = ACTION_TYPE_DESCRIPTIONS[actionType];
    let requiredFields = '';

    switch (actionType) {
      case 'mouse_move':
        requiredFields = 'x (integer), y (integer)';
        break;
      case 'mouse_click':
      case 'mouse_double_click':
        requiredFields = "x (integer), y (integer), button ('left'|'right'|'middle')";
        break;
      case 'mouse_drag':
      case 'mouse_scroll':
        requiredFields = 'x (integer), y (integer)';
        break;
      case 'key_press':
      case 'key_release':
        requiredFields = "key (string, e.g., 'a', 'Enter', 'Ctrl')";
        break;
      case 'key_type':
        requiredFields = 'text (string)';
        break;
      case 'wait':
      case 'screenshot':
        requiredFields = 'none (uses timestamp)';
        break;
      case 'custom':
        requiredFields = 'additional_data (object, optional)';
        break;
    }

    actionDocs.push(`- **${actionType}**: ${description}\n  Required: ${requiredFields}`);
  }

  return actionDocs.join('\n');
}

/**
 * System prompt for all AI providers
 * Requirements: 5.3 - Unified prompt template structure
 */
export const UNIFIED_SYSTEM_PROMPT = `You are an automation script generator for GeniusQA desktop application. Your task is to generate automation test scripts in JSON format based on user descriptions in natural language.

## Your Role
- Convert natural language descriptions into executable automation scripts
- Generate valid, well-structured scripts compatible with the rust-core playback engine
- Ask clarifying questions when the user's request is ambiguous
- Provide helpful suggestions for improving automation scenarios

## Available Action Types and Required Fields
${buildActionSchemaDoc()}

## Script JSON Schema
Every script must follow this exact structure:
\`\`\`json
{
  "version": "1.0",
  "metadata": {
    "created_at": "<ISO 8601 timestamp>",
    "duration": <total duration in seconds>,
    "action_count": <number of actions>,
    "core_type": "rust",
    "platform": "<windows|macos|linux>"
  },
  "actions": [
    {
      "type": "<action_type>",
      "timestamp": <time in seconds from start>,
      // ... action-specific fields
    }
  ]
}
\`\`\`

## Important Rules
1. **Timestamps**: Must be non-negative numbers in ascending order (seconds from script start)
2. **Coordinates**: Must be positive integers within screen bounds (typically 0-4096)
3. **Timing**: Include realistic delays between actions (0.1-0.5 seconds for human-like behavior)
4. **Buttons**: Mouse buttons must be 'left', 'right', or 'middle'
5. **Keys**: Use standard key names ('Enter', 'Tab', 'Escape', 'Ctrl', 'Alt', 'Shift', etc.)
6. **Output**: Always wrap JSON in \`\`\`json code blocks

## Response Guidelines
- If the request is clear, generate the script immediately
- If clarification is needed, ask specific questions
- Explain what the script does in plain language before the JSON
- Suggest improvements or alternatives when appropriate`;

/**
 * Builds conversation context string from previous messages
 * Requirements: 5.3 - Include context about available actions
 */
export function buildContextString(context: ConversationContext): string {
  const parts: string[] = [];

  // Add available actions context
  parts.push('Available action types: ' + context.availableActions.join(', '));

  if (context.targetOS) {
    parts.push('Target OS (already selected): ' + context.targetOS);
  }

  // Add current script context if exists
  if (context.currentScript) {
    parts.push(`\nCurrent script has ${context.currentScript.actions.length} actions.`);
  }

  // Add relevant previous messages (last 5)
  const recentMessages = context.previousMessages.slice(-5);
  if (recentMessages.length > 0) {
    parts.push('\nRecent conversation:');
    for (const msg of recentMessages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      // Truncate long messages
      const content = msg.content.length > 200 
        ? msg.content.substring(0, 200) + '...' 
        : msg.content;
      parts.push(`${role}: ${content}`);
    }
  }

  return parts.join('\n');
}

/**
 * Builds a complete prompt for script generation
 * Requirements: 5.3 - Unified prompt structure
 */
export function buildGenerationPrompt(
  userPrompt: string,
  context: ConversationContext
): string {
  const contextString = buildContextString(context);
  return `${contextString}\n\nUser request: ${userPrompt}`;
}

/**
 * Builds a refinement prompt for modifying existing scripts
 * Requirements: 5.3 - Unified prompt structure
 */
export function buildRefinementPrompt(
  currentScript: ScriptData,
  feedback: string
): string {
  const scriptJson = JSON.stringify(currentScript, null, 2);
  return `Here is the current automation script:
\`\`\`json
${scriptJson}
\`\`\`

User feedback: ${feedback}

Please modify the script according to the feedback. Return the complete updated script in JSON format.`;
}

/**
 * Builds an error correction prompt
 * Requirements: 5.3 - Unified prompt structure
 */
export function buildCorrectionPrompt(
  originalRequest: string,
  errors: { field: string; message: string }[]
): string {
  const errorList = errors.map(e => `- ${e.field}: ${e.message}`).join('\n');

  return `## Previous Attempt Had Errors
${errorList}

## Original Request
${originalRequest}

## Instructions
Please regenerate the script, fixing the errors listed above. Ensure:
1. All action types are valid
2. All required fields are present for each action type
3. Timestamps are in ascending order
4. Coordinates are positive integers
5. The script follows the exact JSON schema specified`;
}

// ============================================================================
// Response Parser
// ============================================================================

/**
 * Extracts JSON script from AI response text
 * Handles both code-block wrapped and raw JSON
 * Requirements: 5.4 - Unified response parsing
 */
export function extractJsonFromResponse(responseText: string): string | null {
  // Try to extract from code block first
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = responseText.match(/\{[\s\S]*"version"[\s\S]*"actions"[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
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
  return 'macos'; // Default for desktop app
}

/**
 * Parses and validates a script from JSON string
 * Requirements: 5.4 - Unified response parsing
 */
export function parseScriptFromJson(jsonString: string): ScriptData | null {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Basic structure validation
    if (!parsed.version || !parsed.metadata || !Array.isArray(parsed.actions)) {
      return null;
    }

    // Ensure all required metadata fields
    const script: ScriptData = {
      version: parsed.version || '1.0',
      metadata: {
        created_at: parsed.metadata.created_at || new Date().toISOString(),
        duration: parsed.metadata.duration || 0,
        action_count: parsed.metadata.action_count || parsed.actions.length,
        core_type: parsed.metadata.core_type || 'rust',
        platform: parsed.metadata.platform || detectPlatform(),
        screen_resolution: parsed.metadata.screen_resolution,
        additional_data: parsed.metadata.additional_data,
      },
      actions: parsed.actions.map((action: Partial<Action>, index: number) => ({
        type: action.type || 'wait',
        timestamp: action.timestamp ?? index * 0.5,
        x: action.x,
        y: action.y,
        button: action.button,
        key: action.key,
        text: action.text,
        modifiers: action.modifiers,
        additional_data: action.additional_data,
      })),
    };

    return script;
  } catch {
    return null;
  }
}

/**
 * Checks if response indicates need for clarification
 * Requirements: 5.4 - Unified response parsing
 */
export function checkForClarificationNeeds(responseText: string): { 
  needsClarification: boolean; 
  questions: string[] 
} {
  const clarificationPatterns = [
    /could you (?:please )?(?:clarify|specify|tell me|provide)/i,
    /what (?:exactly|specifically)/i,
    /which (?:button|key|position|coordinates)/i,
    /where (?:exactly|specifically)/i,
    /I need (?:more information|clarification)/i,
    /\?/g, // Questions in response
  ];

  const questions: string[] = [];
  const lines = responseText.split('\n');
  
  for (const line of lines) {
    if (line.includes('?') && !line.startsWith('```')) {
      questions.push(line.trim());
    }
  }

  const needsClarification = clarificationPatterns.some(pattern => 
    pattern.test(responseText)
  ) && questions.length > 0;

  return { needsClarification, questions };
}

/**
 * Parses AI response and extracts script with validation
 * Requirements: 5.4 - Unified response parsing
 * 
 * @param responseText - Raw response text from AI provider
 * @param providerId - The provider that generated the response
 * @param modelId - The model that generated the response
 * @param processingTimeMs - Time taken to process the request
 * @returns ProviderResponse with parsed script or error
 */
export function parseProviderResponse(
  responseText: string,
  providerId: AIProvider,
  modelId: string,
  processingTimeMs: number
): ProviderResponse {
  const metadata: ResponseMetadata = {
    providerId,
    modelId,
    processingTimeMs,
  };

  // Check if clarification is needed
  const { needsClarification, questions } = checkForClarificationNeeds(responseText);
  if (needsClarification && questions.length > 0) {
    return {
      success: true,
      message: responseText,
      needsClarification: true,
      clarificationQuestions: questions,
      rawResponse: responseText,
      metadata,
    };
  }

  // Try to extract and parse JSON script
  const jsonString = extractJsonFromResponse(responseText);
  if (!jsonString) {
    return {
      success: true,
      message: responseText,
      needsClarification: true,
      clarificationQuestions: [
        'Could not extract a script from the response. Please provide more details about your automation scenario.',
      ],
      rawResponse: responseText,
      metadata,
    };
  }

  const script = parseScriptFromJson(jsonString);
  if (!script) {
    return {
      success: false,
      message: 'Failed to parse the generated script. The AI response was not in the expected format.',
      rawResponse: responseText,
      metadata,
    };
  }

  // Validate the script
  const validationResult = validateScript(script);
  
  if (!validationResult.valid) {
    // Try to auto-fix common issues
    const { script: fixedScript, fixes } = autoFixScript(script);
    const revalidation = validateScript(fixedScript);
    
    if (revalidation.valid) {
      return {
        success: true,
        script: fixedScript,
        message: `Script generated successfully. Applied fixes: ${fixes.join(', ')}`,
        rawResponse: responseText,
        metadata,
      };
    }

    // Return with validation errors
    return {
      success: false,
      message: `Script has validation errors: ${validationResult.errors.map(e => e.message).join(', ')}`,
      rawResponse: responseText,
      metadata,
    };
  }

  return {
    success: true,
    script,
    message: 'Script generated successfully.',
    rawResponse: responseText,
    metadata,
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that a script has all required fields for rust-core compatibility
 * Requirements: 5.2 - Unified output format
 */
export function isValidRustCoreScript(script: ScriptData): boolean {
  // Check required top-level fields
  if (!script.version || !script.metadata || !Array.isArray(script.actions)) {
    return false;
  }

  // Check required metadata fields
  const { metadata } = script;
  if (
    !metadata.created_at ||
    typeof metadata.duration !== 'number' ||
    typeof metadata.action_count !== 'number' ||
    !metadata.core_type ||
    !metadata.platform
  ) {
    return false;
  }

  // Check each action has required fields
  for (const action of script.actions) {
    if (!action.type || typeof action.timestamp !== 'number') {
      return false;
    }
    
    // Validate action-specific required fields
    if (!isValidAction(action)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates that an action has all required fields for its type
 */
function isValidAction(action: Action): boolean {
  const mouseActions: ActionType[] = [
    'mouse_move', 'mouse_click', 'mouse_double_click', 'mouse_drag', 'mouse_scroll'
  ];
  const clickActions: ActionType[] = ['mouse_click', 'mouse_double_click'];
  const keyActions: ActionType[] = ['key_press', 'key_release'];

  // Mouse actions require x, y
  if (mouseActions.includes(action.type)) {
    if (typeof action.x !== 'number' || typeof action.y !== 'number') {
      return false;
    }
  }

  // Click actions require button
  if (clickActions.includes(action.type)) {
    if (!action.button || !['left', 'right', 'middle'].includes(action.button)) {
      return false;
    }
  }

  // Key actions require key
  if (keyActions.includes(action.type)) {
    if (!action.key || typeof action.key !== 'string') {
      return false;
    }
  }

  // key_type requires text
  if (action.type === 'key_type') {
    if (action.text === undefined || action.text === null) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Exports
// ============================================================================

export {
  AVAILABLE_ACTION_TYPES,
  ACTION_TYPE_DESCRIPTIONS,
};

export default {
  UNIFIED_SYSTEM_PROMPT,
  buildActionSchemaDoc,
  buildContextString,
  buildGenerationPrompt,
  buildRefinementPrompt,
  buildCorrectionPrompt,
  extractJsonFromResponse,
  parseScriptFromJson,
  checkForClarificationNeeds,
  parseProviderResponse,
  isValidRustCoreScript,
};
