/**
 * Property-Based Tests for Gemini Service
 * 
 * Tests correctness properties for prompt construction and script parsing
 * to ensure proper integration with Gemini API.
 */

import * as fc from 'fast-check';
import {
  buildContextString,
  extractJsonFromResponse,
  parseScriptFromJson,
  SYSTEM_PROMPT,
  EXAMPLE_SCRIPTS,
} from '../geminiService';
import {
  buildActionSchemaDoc,
  buildPromptTemplate,
  buildConversationContext,
  buildHistoryContext,
  getSuggestedActions,
  EXAMPLE_PROMPTS,
  ACTION_KEYWORDS,
} from '../promptTemplates';
import {
  ScriptData,
  Action,
  ActionType,
  ChatMessage,
  ConversationContext,
  AVAILABLE_ACTION_TYPES,
} from '../../types/aiScriptBuilder.types';
import { validateScript } from '../scriptValidationService';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid action type
 */
const actionTypeArbitrary = fc.constantFrom(...AVAILABLE_ACTION_TYPES);

/**
 * Generate a valid chat role
 */
const chatRoleArbitrary = fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<'user' | 'assistant' | 'system'>;

/**
 * Generate a valid chat message
 */
const chatMessageArbitrary: fc.Arbitrary<ChatMessage> = fc.record({
  id: fc.uuid(),
  role: chatRoleArbitrary,
  content: fc.string({ minLength: 1, maxLength: 500 }),
  timestamp: fc.date(),
});

/**
 * Generate a valid timestamp (non-negative)
 */
const timestampArbitrary = fc.float({ min: 0, max: 10000, noNaN: true });

/**
 * Generate valid screen coordinates
 */
const validCoordinateArbitrary = fc.integer({ min: 0, max: 4096 });

/**
 * Generate a valid mouse button
 */
const mouseButtonArbitrary = fc.constantFrom('left', 'right', 'middle') as fc.Arbitrary<'left' | 'right' | 'middle'>;

/**
 * Generate a valid key string
 */
const keyChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const keyArbitrary = fc.array(
  fc.integer({ min: 0, max: keyChars.length - 1 }),
  { minLength: 1, maxLength: 10 }
).map(indices => indices.map(i => keyChars[i]).join(''));

/**
 * Generate a valid action
 */
const validActionArbitrary: fc.Arbitrary<Action> = fc.oneof(
  // mouse_move
  fc.record({
    type: fc.constant('mouse_move' as ActionType),
    timestamp: timestampArbitrary,
    x: validCoordinateArbitrary,
    y: validCoordinateArbitrary,
  }),
  // mouse_click
  fc.record({
    type: fc.constant('mouse_click' as ActionType),
    timestamp: timestampArbitrary,
    x: validCoordinateArbitrary,
    y: validCoordinateArbitrary,
    button: mouseButtonArbitrary,
  }),
  // key_press
  keyArbitrary.chain(key => fc.record({
    type: fc.constant('key_press' as ActionType),
    timestamp: timestampArbitrary,
    key: fc.constant(key),
  })),
  // key_type
  fc.record({
    type: fc.constant('key_type' as ActionType),
    timestamp: timestampArbitrary,
    text: fc.string({ minLength: 0, maxLength: 100 }),
  }),
  // wait
  fc.record({
    type: fc.constant('wait' as ActionType),
    timestamp: timestampArbitrary,
  })
);

/**
 * Generate a valid script with sorted timestamps
 */
const validScriptArbitrary: fc.Arbitrary<ScriptData> = fc
  .array(validActionArbitrary, { minLength: 1, maxLength: 10 })
  .map(actions => {
    // Sort and reassign timestamps
    let currentTime = 0;
    return actions.map(action => {
      const newAction = { ...action, timestamp: currentTime };
      currentTime += 0.1 + Math.random() * 0.5;
      return newAction;
    });
  })
  .chain(actions => {
    const duration = actions.length > 0 ? actions[actions.length - 1].timestamp : 0;
    return fc.record({
      version: fc.constant('1.0'),
      metadata: fc.record({
        created_at: fc.constant(new Date().toISOString()),
        duration: fc.constant(duration),
        action_count: fc.constant(actions.length),
        core_type: fc.constantFrom('rust', 'python'),
        platform: fc.constantFrom('windows', 'macos', 'linux'),
      }),
      actions: fc.constant(actions),
    });
  });

/**
 * Generate a conversation context
 */
const conversationContextArbitrary: fc.Arbitrary<ConversationContext> = fc.record({
  previousMessages: fc.array(chatMessageArbitrary, { minLength: 0, maxLength: 5 }),
  currentScript: fc.option(validScriptArbitrary, { nil: undefined }),
  availableActions: fc.constant(AVAILABLE_ACTION_TYPES as ActionType[]),
});


// ============================================================================
// Property Tests
// ============================================================================

describe('Gemini Service Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 3: Prompt Context Inclusion**
   * **Validates: Requirements 3.1**
   * 
   * For any user request sent to Gemini API, the prompt should contain
   * the complete list of available action types and their required parameters.
   */
  describe('Property 3: Prompt Context Inclusion', () => {
    it('system prompt contains all available action types', () => {
      fc.assert(
        fc.property(actionTypeArbitrary, (actionType: ActionType) => {
          // The system prompt should mention every action type
          return SYSTEM_PROMPT.includes(actionType);
        }),
        { numRuns: 100 }
      );
    });

    it('action schema documentation includes all action types', () => {
      fc.assert(
        fc.property(actionTypeArbitrary, (actionType: ActionType) => {
          const schemaDoc = buildActionSchemaDoc();
          return schemaDoc.includes(actionType);
        }),
        { numRuns: 100 }
      );
    });

    it('context string includes available actions list', () => {
      fc.assert(
        fc.property(conversationContextArbitrary, (context: ConversationContext) => {
          const contextString = buildContextString(context);
          
          // Should include mention of available actions
          const hasActionsMention = contextString.includes('Available action types');
          
          // Should include at least some action types
          const hasActionTypes = context.availableActions.some(
            action => contextString.includes(action)
          );
          
          return hasActionsMention && hasActionTypes;
        }),
        { numRuns: 100 }
      );
    });

    it('prompt template includes action schema', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.boolean(),
          (userContext: string, includeExamples: boolean) => {
            const template = buildPromptTemplate(userContext, includeExamples);
            
            // Template should have all required parts
            return (
              template.systemPrompt.length > 0 &&
              template.actionSchema.length > 0 &&
              Array.isArray(template.exampleScripts)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('conversation context preserves all available actions', () => {
      fc.assert(
        fc.property(
          fc.array(chatMessageArbitrary, { minLength: 0, maxLength: 10 }),
          fc.option(validScriptArbitrary, { nil: undefined }),
          (messages: ChatMessage[], script: ScriptData | undefined) => {
            const context = buildConversationContext(messages, script);
            
            // All available action types should be in the context
            return (
              context.availableActions.length === AVAILABLE_ACTION_TYPES.length &&
              AVAILABLE_ACTION_TYPES.every(action => 
                context.availableActions.includes(action)
              )
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('history context includes recent messages', () => {
      fc.assert(
        fc.property(
          fc.array(chatMessageArbitrary, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (messages: ChatMessage[], maxMessages: number) => {
            const historyContext = buildHistoryContext(messages, maxMessages);
            
            // Should include conversation header if messages exist
            if (messages.length > 0) {
              return historyContext.includes('Recent Conversation');
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ai-script-builder, Property 4: Script Parsing Validity**
   * **Validates: Requirements 3.2**
   * 
   * For any valid JSON script string returned by Gemini, parsing it should
   * produce a ScriptData object with all required fields populated.
   */
  describe('Property 4: Script Parsing Validity', () => {
    it('valid script JSON parses to ScriptData with all required fields', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const jsonString = JSON.stringify(script);
          const parsed = parseScriptFromJson(jsonString);
          
          if (!parsed) return false;
          
          // Check all required fields are present
          return (
            parsed.version !== undefined &&
            parsed.metadata !== undefined &&
            parsed.metadata.created_at !== undefined &&
            parsed.metadata.duration !== undefined &&
            parsed.metadata.action_count !== undefined &&
            parsed.metadata.core_type !== undefined &&
            parsed.metadata.platform !== undefined &&
            Array.isArray(parsed.actions)
          );
        }),
        { numRuns: 100 }
      );
    });

    it('parsed script preserves action count', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const jsonString = JSON.stringify(script);
          const parsed = parseScriptFromJson(jsonString);
          
          if (!parsed) return false;
          
          return parsed.actions.length === script.actions.length;
        }),
        { numRuns: 100 }
      );
    });

    it('parsed script preserves action types', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const jsonString = JSON.stringify(script);
          const parsed = parseScriptFromJson(jsonString);
          
          if (!parsed) return false;
          
          // Each action should have its type preserved
          for (let i = 0; i < script.actions.length; i++) {
            if (parsed.actions[i].type !== script.actions[i].type) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('extracts JSON from code block wrapped response', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const jsonString = JSON.stringify(script, null, 2);
          const wrappedResponse = `Here is your script:\n\n\`\`\`json\n${jsonString}\n\`\`\`\n\nThis script will perform the requested actions.`;
          
          const extracted = extractJsonFromResponse(wrappedResponse);
          
          if (!extracted) return false;
          
          // Should be able to parse the extracted JSON
          try {
            const parsed = JSON.parse(extracted);
            return parsed.version === script.version;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('extracts JSON from response without code blocks', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const jsonString = JSON.stringify(script);
          const rawResponse = `Here is the script: ${jsonString}`;
          
          const extracted = extractJsonFromResponse(rawResponse);
          
          if (!extracted) return false;
          
          try {
            const parsed = JSON.parse(extracted);
            return parsed.version === script.version;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('parsed valid script passes validation', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const jsonString = JSON.stringify(script);
          const parsed = parseScriptFromJson(jsonString);
          
          if (!parsed) return false;
          
          const validationResult = validateScript(parsed);
          
          // A well-formed script should pass validation
          // (may have warnings but no errors)
          return validationResult.valid;
        }),
        { numRuns: 100 }
      );
    });

    it('invalid JSON returns null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (invalidJson: string) => {
            // Skip if accidentally generated valid JSON
            try {
              const parsed = JSON.parse(invalidJson);
              if (parsed && parsed.version && parsed.metadata && parsed.actions) {
                return true; // Skip valid JSON
              }
            } catch {
              // Expected - invalid JSON
            }
            
            const result = parseScriptFromJson(invalidJson);
            return result === null;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('JSON missing required fields returns null', () => {
      fc.assert(
        fc.property(
          fc.record({
            version: fc.constant('1.0'),
            // Missing metadata and actions
          }),
          (incompleteScript) => {
            const jsonString = JSON.stringify(incompleteScript);
            const result = parseScriptFromJson(jsonString);
            return result === null;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Additional Tests for Prompt Templates
// ============================================================================

describe('Prompt Templates Property Tests', () => {
  it('example prompts have all required fields', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: EXAMPLE_PROMPTS.length - 1 }),
        (index: number) => {
          const prompt = EXAMPLE_PROMPTS[index];
          return (
            prompt.id.length > 0 &&
            prompt.title.length > 0 &&
            prompt.description.length > 0 &&
            prompt.promptText.length > 0
          );
        }
      ),
      { numRuns: EXAMPLE_PROMPTS.length }
    );
  });

  it('example scripts are valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: EXAMPLE_SCRIPTS.length - 1 }),
        (index: number) => {
          const script = EXAMPLE_SCRIPTS[index];
          const validationResult = validateScript(script);
          return validationResult.valid;
        }
      ),
      { numRuns: EXAMPLE_SCRIPTS.length }
    );
  });

  it('action keywords map to valid action types', () => {
    const keywords = Object.keys(ACTION_KEYWORDS);
    
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: keywords.length - 1 }),
        (index: number) => {
          const keyword = keywords[index];
          const actions = ACTION_KEYWORDS[keyword];
          
          // All mapped actions should be valid action types
          return actions.every(action => 
            AVAILABLE_ACTION_TYPES.includes(action)
          );
        }
      ),
      { numRuns: keywords.length }
    );
  });

  it('getSuggestedActions returns valid action types for known keywords', () => {
    const keywords = Object.keys(ACTION_KEYWORDS);
    
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: keywords.length - 1 }),
        (index: number) => {
          const keyword = keywords[index];
          const suggestions = getSuggestedActions(keyword);
          
          // All suggestions should be valid action types
          return suggestions.every(action => 
            AVAILABLE_ACTION_TYPES.includes(action)
          );
        }
      ),
      { numRuns: keywords.length }
    );
  });
});
