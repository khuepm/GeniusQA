/**
 * Prompt Templates for AI Script Builder
 * 
 * Contains system prompts, example scripts, and context builders
 * for generating automation scripts with Gemini API.
 * 
 * Requirements: 3.1, 5.1
 */

import {
  ScriptData,
  ActionType,
  ChatMessage,
  ConversationContext,
  PromptTemplate,
  ExamplePrompt,
  AVAILABLE_ACTION_TYPES,
  ACTION_TYPE_DESCRIPTIONS,
} from '../types/aiScriptBuilder.types';

// ============================================================================
// System Prompt
// ============================================================================

/**
 * Builds the action schema documentation for the system prompt
 * Requirements: 3.1 - Include context about available script actions
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
 * Main system prompt for Gemini API
 * Requirements: 3.1 - Include context about available script actions and parameters
 */
export const SYSTEM_PROMPT = `You are an automation script generator for GeniusQA desktop application. Your task is to generate automation test scripts in JSON format based on user descriptions in natural language.

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

// ============================================================================
// Example Scripts for Few-Shot Learning
// ============================================================================

/**
 * Example script: Simple click and type
 * Requirements: 5.1 - Example prompts for common scenarios
 */
export const EXAMPLE_CLICK_AND_TYPE: ScriptData = {
  version: '1.0',
  metadata: {
    created_at: new Date().toISOString(),
    duration: 3.0,
    action_count: 5,
    core_type: 'rust',
    platform: 'macos',
  },
  actions: [
    { type: 'mouse_move', timestamp: 0, x: 500, y: 300 },
    { type: 'mouse_click', timestamp: 0.3, x: 500, y: 300, button: 'left' },
    { type: 'wait', timestamp: 0.8 },
    { type: 'key_type', timestamp: 1.0, text: 'Hello World' },
    { type: 'key_press', timestamp: 3.0, key: 'Enter' },
  ],
};

/**
 * Example script: Form filling
 */
export const EXAMPLE_FORM_FILL: ScriptData = {
  version: '1.0',
  metadata: {
    created_at: new Date().toISOString(),
    duration: 8.0,
    action_count: 12,
    core_type: 'rust',
    platform: 'macos',
  },
  actions: [
    // Click username field
    { type: 'mouse_click', timestamp: 0, x: 400, y: 200, button: 'left' },
    { type: 'key_type', timestamp: 0.5, text: 'testuser@example.com' },
    // Tab to password field
    { type: 'key_press', timestamp: 2.5, key: 'Tab' },
    { type: 'wait', timestamp: 2.8 },
    { type: 'key_type', timestamp: 3.0, text: 'SecurePassword123' },
    // Tab to submit button
    { type: 'key_press', timestamp: 5.0, key: 'Tab' },
    { type: 'wait', timestamp: 5.3 },
    // Click submit
    { type: 'mouse_click', timestamp: 5.5, x: 400, y: 350, button: 'left' },
    { type: 'wait', timestamp: 8.0 },
  ],
};

/**
 * Example script: Navigation with keyboard shortcuts
 */
export const EXAMPLE_KEYBOARD_NAV: ScriptData = {
  version: '1.0',
  metadata: {
    created_at: new Date().toISOString(),
    duration: 4.0,
    action_count: 8,
    core_type: 'rust',
    platform: 'macos',
  },
  actions: [
    // Cmd+T to open new tab
    { type: 'key_press', timestamp: 0, key: 'Meta', modifiers: [] },
    { type: 'key_press', timestamp: 0.1, key: 't', modifiers: ['Meta'] },
    { type: 'key_release', timestamp: 0.2, key: 't' },
    { type: 'key_release', timestamp: 0.3, key: 'Meta' },
    { type: 'wait', timestamp: 0.8 },
    // Type URL
    { type: 'key_type', timestamp: 1.0, text: 'https://example.com' },
    { type: 'key_press', timestamp: 3.5, key: 'Enter' },
    { type: 'wait', timestamp: 4.0 },
  ],
};

/**
 * All example scripts for few-shot learning
 */
export const EXAMPLE_SCRIPTS: ScriptData[] = [
  EXAMPLE_CLICK_AND_TYPE,
  EXAMPLE_FORM_FILL,
  EXAMPLE_KEYBOARD_NAV,
];


// ============================================================================
// Example Prompts for Users
// ============================================================================

/**
 * Example prompts for common test scenarios
 * Requirements: 5.1 - Display example prompts for common test scenarios
 */
export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: 'login-form',
    title: 'Login Form Test',
    description: 'Test a standard login form with username and password',
    promptText: 'Create a script to test a login form: click on the username field at position (400, 200), type "testuser@example.com", tab to password field, type "password123", then click the login button at (400, 350).',
  },
  {
    id: 'button-click',
    title: 'Simple Button Click',
    description: 'Click a button and wait for response',
    promptText: 'Create a script that clicks a button at position (500, 300) and waits 2 seconds for the page to load.',
  },
  {
    id: 'form-navigation',
    title: 'Form Navigation',
    description: 'Navigate through form fields using Tab key',
    promptText: 'Create a script that fills out a form by clicking the first field at (300, 150), typing "John Doe", pressing Tab, typing "john@example.com", pressing Tab again, and typing "Hello, this is a test message".',
  },
  {
    id: 'keyboard-shortcut',
    title: 'Keyboard Shortcuts',
    description: 'Test keyboard shortcuts like copy/paste',
    promptText: 'Create a script that selects all text with Ctrl+A, copies it with Ctrl+C, clicks at position (600, 400), and pastes with Ctrl+V.',
  },
  {
    id: 'scroll-and-click',
    title: 'Scroll and Click',
    description: 'Scroll down a page and click an element',
    promptText: 'Create a script that scrolls down at position (500, 400), waits 1 second, then clicks a button at (500, 350).',
  },
  {
    id: 'multi-step-workflow',
    title: 'Multi-Step Workflow',
    description: 'Complete a multi-step process',
    promptText: 'Create a script for a checkout process: click "Add to Cart" at (700, 300), wait 1 second, click "Checkout" at (800, 100), fill in email at (400, 200) with "buyer@example.com", and click "Complete Order" at (400, 400).',
  },
];

// ============================================================================
// Context Builder
// ============================================================================

/**
 * Builds a complete prompt template with all context
 * Requirements: 3.1 - Include context about available actions
 */
export function buildPromptTemplate(
  userContext: string = '',
  includeExamples: boolean = true
): PromptTemplate {
  let exampleSection = '';
  
  if (includeExamples) {
    exampleSection = '\n\n## Example Scripts\nHere are some example scripts for reference:\n\n';
    exampleSection += EXAMPLE_SCRIPTS.map((script, index) => 
      `### Example ${index + 1}\n\`\`\`json\n${JSON.stringify(script, null, 2)}\n\`\`\``
    ).join('\n\n');
  }

  return {
    systemPrompt: SYSTEM_PROMPT + exampleSection,
    actionSchema: buildActionSchemaDoc(),
    exampleScripts: EXAMPLE_SCRIPTS,
    userContext,
  };
}

/**
 * Builds conversation context from chat history
 * Requirements: 3.1 - Include conversation history context
 */
export function buildConversationContext(
  messages: ChatMessage[],
  currentScript?: ScriptData
): ConversationContext {
  return {
    previousMessages: messages,
    currentScript,
    availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
  };
}

/**
 * Formats a chat message for inclusion in prompt
 */
export function formatMessageForPrompt(message: ChatMessage): string {
  const roleLabel = message.role === 'user' ? 'User' : 
                    message.role === 'assistant' ? 'Assistant' : 'System';
  
  // Truncate very long messages
  const maxLength = 500;
  const content = message.content.length > maxLength
    ? message.content.substring(0, maxLength) + '...'
    : message.content;

  return `[${roleLabel}]: ${content}`;
}

/**
 * Builds a context string from conversation history
 * Includes only relevant recent messages to stay within token limits
 */
export function buildHistoryContext(
  messages: ChatMessage[],
  maxMessages: number = 5
): string {
  if (messages.length === 0) {
    return '';
  }

  const recentMessages = messages.slice(-maxMessages);
  const formattedMessages = recentMessages.map(formatMessageForPrompt);

  return `## Recent Conversation\n${formattedMessages.join('\n\n')}`;
}

/**
 * Builds a refinement prompt for modifying existing scripts
 */
export function buildRefinementPrompt(
  currentScript: ScriptData,
  userFeedback: string
): string {
  return `## Current Script
\`\`\`json
${JSON.stringify(currentScript, null, 2)}
\`\`\`

## User Feedback
${userFeedback}

## Instructions
Please modify the script according to the user's feedback. Return the complete updated script in JSON format, wrapped in \`\`\`json code blocks.`;
}

/**
 * Builds an error correction prompt
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
// Action Suggestions
// ============================================================================

/**
 * Keywords that map to action types for suggestions
 * Requirements: 5.2 - Suggest relevant action keywords
 */
export const ACTION_KEYWORDS: Record<string, ActionType[]> = {
  'click': ['mouse_click', 'mouse_double_click'],
  'double click': ['mouse_double_click'],
  'right click': ['mouse_click'],
  'move': ['mouse_move', 'mouse_drag'],
  'drag': ['mouse_drag'],
  'scroll': ['mouse_scroll'],
  'type': ['key_type'],
  'enter': ['key_type', 'key_press'],
  'press': ['key_press'],
  'release': ['key_release'],
  'key': ['key_press', 'key_release'],
  'wait': ['wait'],
  'delay': ['wait'],
  'pause': ['wait'],
  'screenshot': ['screenshot'],
  'capture': ['screenshot'],
};

/**
 * Get suggested action types based on user input
 * Requirements: 5.2 - Suggest relevant action keywords
 */
export function getSuggestedActions(input: string): ActionType[] {
  const lowerInput = input.toLowerCase();
  const suggestions = new Set<ActionType>();

  for (const [keyword, actions] of Object.entries(ACTION_KEYWORDS)) {
    if (lowerInput.includes(keyword)) {
      actions.forEach(action => suggestions.add(action));
    }
  }

  return Array.from(suggestions);
}

export default {
  SYSTEM_PROMPT,
  EXAMPLE_SCRIPTS,
  EXAMPLE_PROMPTS,
  buildPromptTemplate,
  buildConversationContext,
  buildHistoryContext,
  buildRefinementPrompt,
  buildCorrectionPrompt,
  getSuggestedActions,
};
