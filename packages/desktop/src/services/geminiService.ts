/**
 * Gemini Service for AI Script Builder
 * 
 * Provides integration with Google's Gemini API for generating
 * automation scripts from natural language descriptions.
 * 
 * Requirements: 3.1, 3.2, 3.4
 */

import {
  ScriptData,
  Action,
  ActionType,
  ConversationContext,
  GenerationResult,
  ChatMessage,
  AVAILABLE_ACTION_TYPES,
  ACTION_TYPE_DESCRIPTIONS,
} from '../types/aiScriptBuilder.types';
import { validateScript, autoFixScript } from './scriptValidationService';

// ============================================================================
// Constants and Prompt Templates
// ============================================================================

/**
 * System prompt that defines the AI's role and output format
 * Requirements: 3.1 - Include context about available script actions
 */
export const SYSTEM_PROMPT = `You are an automation script generator for GeniusQA. Your task is to generate automation test scripts in JSON format based on user descriptions.

## Available Action Types:
${AVAILABLE_ACTION_TYPES.map(type => `- ${type}: ${ACTION_TYPE_DESCRIPTIONS[type]}`).join('\n')}

## Action Schema:
Each action must have:
- type: One of the available action types
- timestamp: Time in seconds (must be in ascending order)

Additional fields by action type:
- mouse_move: requires x (integer), y (integer)
- mouse_click: requires x (integer), y (integer), button ('left', 'right', or 'middle')
- mouse_double_click: requires x (integer), y (integer), button ('left', 'right', or 'middle')
- mouse_drag: requires x (integer), y (integer)
- mouse_scroll: requires x (integer), y (integer)
- key_press: requires key (string, e.g., 'a', 'Enter', 'Ctrl')
- key_release: requires key (string)
- key_type: requires text (string to type)
- wait: no additional fields (uses timestamp delta)
- screenshot: no additional fields
- custom: optional additional_data object

## Output Format:
Always respond with a valid JSON script in this exact format:
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
      "timestamp": <time in seconds>,
      // ... action-specific fields
    }
  ]
}
\`\`\`

## Rules:
1. All timestamps must be non-negative and in ascending order
2. Mouse coordinates must be positive integers within typical screen bounds (0-4096)
3. Include appropriate wait times between actions (0.1-0.5 seconds typically)
4. Use realistic coordinates based on common screen resolutions
5. For text input, use key_type action with the text field
6. Always wrap the JSON in \`\`\`json code blocks

If you need clarification about the user's requirements, ask specific questions before generating the script.`;

/**
 * Example scripts for few-shot learning
 * Requirements: 5.1 - Example prompts for common scenarios
 */
export const EXAMPLE_SCRIPTS: ScriptData[] = [
  {
    version: '1.0',
    metadata: {
      created_at: new Date().toISOString(),
      duration: 2.5,
      action_count: 5,
      core_type: 'rust',
      platform: 'macos',
    },
    actions: [
      { type: 'mouse_move', timestamp: 0, x: 500, y: 300 },
      { type: 'mouse_click', timestamp: 0.5, x: 500, y: 300, button: 'left' },
      { type: 'wait', timestamp: 1.0 },
      { type: 'key_type', timestamp: 1.5, text: 'Hello World' },
      { type: 'key_press', timestamp: 2.5, key: 'Enter' },
    ],
  },
];


// ============================================================================
// Gemini API Configuration
// ============================================================================

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Gemini API request body structure
 */
interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/**
 * Gemini API response structure
 */
interface GeminiResponse {
  candidates?: {
    content: {
      parts: { text: string }[];
      role: string;
    };
    finishReason: string;
  }[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds conversation context string from previous messages
 * Requirements: 3.1 - Include context about available actions
 */
export function buildContextString(context: ConversationContext): string {
  const parts: string[] = [];

  // Add available actions context
  parts.push('Available action types: ' + context.availableActions.join(', '));

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
 * Extracts JSON script from Gemini response text
 * Handles both code-block wrapped and raw JSON
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
 * Parses and validates a script from JSON string
 * Requirements: 3.2 - Parse response to extract script actions
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
 * Checks if response indicates need for clarification
 */
function checkForClarificationNeeds(responseText: string): { 
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


// ============================================================================
// Gemini Service Class
// ============================================================================

/**
 * Service for interacting with Google's Gemini API
 * Requirements: 3.1, 3.2, 3.4
 */
class GeminiService {
  private apiKey: string | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the service with an API key
   * @param apiKey - The Gemini API key
   */
  async initialize(apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key is required');
    }
    
    this.apiKey = apiKey.trim();
    this.initialized = true;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.apiKey !== null;
  }

  /**
   * Reset the service (clear API key)
   */
  reset(): void {
    this.apiKey = null;
    this.initialized = false;
  }

  /**
   * Generate a script from a user prompt
   * Requirements: 3.1, 3.2
   * 
   * @param prompt - The user's natural language description
   * @param context - Conversation context including history
   * @returns GenerationResult with script or error message
   */
  async generateScript(
    prompt: string,
    context: ConversationContext
  ): Promise<GenerationResult> {
    if (!this.isInitialized()) {
      return {
        success: false,
        message: 'Gemini service not initialized. Please configure your API key.',
      };
    }

    try {
      // Build the full prompt with context
      const contextString = buildContextString(context);
      const fullPrompt = `${contextString}\n\nUser request: ${prompt}`;

      // Make API request
      const response = await this.callGeminiApi(fullPrompt);

      if (!response.candidates || response.candidates.length === 0) {
        if (response.error) {
          return {
            success: false,
            message: `API Error: ${response.error.message}`,
          };
        }
        return {
          success: false,
          message: 'No response generated. Please try again.',
        };
      }

      const responseText = response.candidates[0].content.parts
        .map(p => p.text)
        .join('');

      // Check if clarification is needed
      const { needsClarification, questions } = checkForClarificationNeeds(responseText);
      if (needsClarification && questions.length > 0) {
        return {
          success: true,
          message: responseText,
          needsClarification: true,
          clarificationQuestions: questions,
        };
      }

      // Try to extract and parse JSON script
      const jsonString = extractJsonFromResponse(responseText);
      if (!jsonString) {
        return {
          success: true,
          message: responseText,
          needsClarification: true,
          clarificationQuestions: ['Could not extract a script from the response. Please provide more details about your automation scenario.'],
        };
      }

      const script = parseScriptFromJson(jsonString);
      if (!script) {
        return {
          success: false,
          message: 'Failed to parse the generated script. The AI response was not in the expected format.',
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
          };
        }

        // If still invalid, request regeneration (Requirements: 3.4)
        return await this.regenerateWithCorrections(prompt, context, validationResult.errors);
      }

      return {
        success: true,
        script,
        message: 'Script generated successfully.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Failed to generate script: ${errorMessage}`,
      };
    }
  }

  /**
   * Refine an existing script based on user feedback
   * Requirements: 3.4 - Iterative improvements
   * 
   * @param currentScript - The current script to refine
   * @param feedback - User's feedback or modification request
   * @returns GenerationResult with refined script
   */
  async refineScript(
    currentScript: ScriptData,
    feedback: string
  ): Promise<GenerationResult> {
    if (!this.isInitialized()) {
      return {
        success: false,
        message: 'Gemini service not initialized. Please configure your API key.',
      };
    }

    try {
      const scriptJson = JSON.stringify(currentScript, null, 2);
      const refinementPrompt = `Here is the current automation script:
\`\`\`json
${scriptJson}
\`\`\`

User feedback: ${feedback}

Please modify the script according to the feedback. Return the complete updated script in JSON format.`;

      const context: ConversationContext = {
        previousMessages: [],
        currentScript,
        availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
      };

      return await this.generateScript(refinementPrompt, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Failed to refine script: ${errorMessage}`,
      };
    }
  }

  /**
   * Regenerate script with corrections for validation errors
   * Requirements: 3.4 - Request regeneration with corrections
   */
  private async regenerateWithCorrections(
    originalPrompt: string,
    context: ConversationContext,
    errors: { field: string; message: string }[]
  ): Promise<GenerationResult> {
    const errorSummary = errors.map(e => `- ${e.field}: ${e.message}`).join('\n');
    
    const correctionPrompt = `The previous script had validation errors:
${errorSummary}

Please regenerate the script for: "${originalPrompt}"

Make sure to:
1. Use valid action types only
2. Include all required fields for each action type
3. Use ascending timestamps
4. Use valid coordinates (positive integers)`;

    try {
      const response = await this.callGeminiApi(correctionPrompt);

      if (!response.candidates || response.candidates.length === 0) {
        return {
          success: false,
          message: 'Failed to regenerate script with corrections.',
        };
      }

      const responseText = response.candidates[0].content.parts
        .map(p => p.text)
        .join('');

      const jsonString = extractJsonFromResponse(responseText);
      if (!jsonString) {
        return {
          success: false,
          message: 'Could not extract corrected script from response.',
        };
      }

      const script = parseScriptFromJson(jsonString);
      if (!script) {
        return {
          success: false,
          message: 'Failed to parse corrected script.',
        };
      }

      const validationResult = validateScript(script);
      if (!validationResult.valid) {
        return {
          success: false,
          message: `Script still has validation errors after correction attempt: ${validationResult.errors.map(e => e.message).join(', ')}`,
        };
      }

      return {
        success: true,
        script,
        message: 'Script regenerated with corrections.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Failed to regenerate script: ${errorMessage}`,
      };
    }
  }

  /**
   * Make a request to the Gemini API
   */
  private async callGeminiApi(prompt: string): Promise<GeminiResponse> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const url = `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

    const requestBody: GeminiRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: SYSTEM_PROMPT }],
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I will generate automation scripts in the specified JSON format based on user descriptions. I will ensure all scripts are valid and compatible with the rust-core playback engine.' }],
        },
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `API request failed with status ${response.status}`
      );
    }

    return response.json();
  }
}

// Export singleton instance
export const geminiService = new GeminiService();

// Export class for testing
export { GeminiService };

export default geminiService;
