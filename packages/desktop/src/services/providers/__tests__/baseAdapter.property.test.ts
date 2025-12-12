/**
 * Property-Based Tests for Base Adapter Utilities
 * 
 * Tests correctness properties for unified prompt structure and response parsing
 * to ensure consistent behavior across all AI providers.
 * 
 * Requirements: 5.3, 5.4
 */

import * as fc from 'fast-check';
import {
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
  AVAILABLE_ACTION_TYPES,
} from '../baseAdapter';
import {
  ScriptData,
  Action,
  ActionType,
  ChatMessage,
  ConversationContext,
} from '../../../types/aiScriptBuilder.types';
import { AIProvider } from '../../../types/providerAdapter.types';

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
 * Generate a valid AI provider
 */
const providerArbitrary = fc.constantFrom('gemini', 'openai', 'anthropic', 'azure') as fc.Arbitrary<AIProvider>;

/**
 * Generate safe text without question marks (to avoid triggering clarification detection)
 */
const safeChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!-_';
const safeTextArbitrary = fc.array(
  fc.integer({ min: 0, max: safeChars.length - 1 }),
  { minLength: 0, maxLength: 100 }
).map(indices => indices.map(i => safeChars[i]).join(''));

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
  // key_type - use safe text without question marks
  fc.record({
    type: fc.constant('key_type' as ActionType),
    timestamp: timestampArbitrary,
    text: safeTextArbitrary,
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

describe('Base Adapter Property Tests', () => {
  /**
   * **Feature: multi-provider-ai, Property 14: Unified Prompt Structure**
   * **Validates: Requirements 5.3**
   * 
   * For any provider receiving a prompt, the prompt should contain
   * the complete list of available action types and their parameters.
   */
  describe('Property 14: Unified Prompt Structure', () => {
    it('unified system prompt contains all available action types', () => {
      fc.assert(
        fc.property(actionTypeArbitrary, (actionType: ActionType) => {
          // The unified system prompt should mention every action type
          return UNIFIED_SYSTEM_PROMPT.includes(actionType);
        }),
        { numRuns: 100 }
      );
    });

    it('action schema documentation includes all action types with descriptions', () => {
      fc.assert(
        fc.property(actionTypeArbitrary, (actionType: ActionType) => {
          const schemaDoc = buildActionSchemaDoc();
          // Should include the action type
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

    it('generation prompt includes user request and context', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          conversationContextArbitrary,
          (userPrompt: string, context: ConversationContext) => {
            const fullPrompt = buildGenerationPrompt(userPrompt, context);
            
            // Should include the user's request
            const hasUserRequest = fullPrompt.includes(userPrompt);
            
            // Should include context about available actions
            const hasContext = fullPrompt.includes('Available action types');
            
            return hasUserRequest && hasContext;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('refinement prompt includes current script and feedback', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          fc.string({ minLength: 1, maxLength: 200 }),
          (script: ScriptData, feedback: string) => {
            const prompt = buildRefinementPrompt(script, feedback);
            
            // Should include the feedback
            const hasFeedback = prompt.includes(feedback);
            
            // Should include the script version
            const hasScript = prompt.includes(script.version);
            
            return hasFeedback && hasScript;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('correction prompt includes errors and original request', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.array(
            fc.record({
              field: fc.string({ minLength: 1, maxLength: 50 }),
              message: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (originalRequest: string, errors: { field: string; message: string }[]) => {
            const prompt = buildCorrectionPrompt(originalRequest, errors);
            
            // Should include the original request
            const hasRequest = prompt.includes(originalRequest);
            
            // Should include at least one error message
            const hasErrors = errors.some(e => prompt.includes(e.message));
            
            return hasRequest && hasErrors;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unified system prompt includes JSON schema structure', () => {
      // The prompt should include the expected JSON structure
      expect(UNIFIED_SYSTEM_PROMPT).toContain('"version"');
      expect(UNIFIED_SYSTEM_PROMPT).toContain('"metadata"');
      expect(UNIFIED_SYSTEM_PROMPT).toContain('"actions"');
      expect(UNIFIED_SYSTEM_PROMPT).toContain('core_type');
      expect(UNIFIED_SYSTEM_PROMPT).toContain('platform');
    });
  });

  /**
   * **Feature: multi-provider-ai, Property 15: Unified Response Parsing**
   * **Validates: Requirements 5.4**
   * 
   * For any valid response from any provider, parsing should produce
   * a valid ScriptData object or appropriate error.
   */
  describe('Property 15: Unified Response Parsing', () => {
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

    it('invalid JSON returns null from parseScriptFromJson', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (invalidJson: string) => {
            // Skip if accidentally generated valid JSON with script structure
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

    it('parseProviderResponse returns success with valid script', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          providerArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 100, max: 5000 }),
          (script: ScriptData, providerId: AIProvider, modelId: string, processingTime: number) => {
            const jsonString = JSON.stringify(script, null, 2);
            const responseText = `Here is your script:\n\n\`\`\`json\n${jsonString}\n\`\`\``;
            
            const response = parseProviderResponse(responseText, providerId, modelId, processingTime);
            
            // Should be successful with a script
            return (
              response.success === true &&
              response.script !== undefined &&
              response.metadata.providerId === providerId &&
              response.metadata.modelId === modelId &&
              response.metadata.processingTimeMs === processingTime
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('parseProviderResponse detects clarification needs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          providerArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }),
          (question: string, providerId: AIProvider, modelId: string) => {
            // Create a response that asks for clarification
            const responseText = `Could you please clarify what you mean? ${question}?`;
            
            const response = parseProviderResponse(responseText, providerId, modelId, 100);
            
            // Should detect clarification need
            return (
              response.needsClarification === true &&
              response.clarificationQuestions !== undefined &&
              response.clarificationQuestions.length > 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('checkForClarificationNeeds detects questions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (content: string) => {
            const responseWithQuestion = `${content}? What do you want?`;
            const result = checkForClarificationNeeds(responseWithQuestion);
            
            // Should detect questions
            return result.questions.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-provider-ai, Property 13: Unified Output Format**
   * **Validates: Requirements 5.2**
   * 
   * For any provider generating a script, the output should be valid
   * rust-core compatible format with all required fields.
   */
  describe('Property 13: Unified Output Format', () => {
    it('valid scripts pass rust-core compatibility check', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          return isValidRustCoreScript(script);
        }),
        { numRuns: 100 }
      );
    });

    it('scripts missing version fail rust-core compatibility', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const invalidScript = { ...script, version: undefined } as unknown as ScriptData;
          return !isValidRustCoreScript(invalidScript);
        }),
        { numRuns: 100 }
      );
    });

    it('scripts missing metadata fail rust-core compatibility', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const invalidScript = { ...script, metadata: undefined } as unknown as ScriptData;
          return !isValidRustCoreScript(invalidScript);
        }),
        { numRuns: 100 }
      );
    });

    it('scripts missing actions fail rust-core compatibility', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const invalidScript = { ...script, actions: undefined } as unknown as ScriptData;
          return !isValidRustCoreScript(invalidScript);
        }),
        { numRuns: 100 }
      );
    });

    it('parsed and re-serialized scripts maintain rust-core compatibility', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          // Serialize
          const jsonString = JSON.stringify(script);
          
          // Parse
          const parsed = parseScriptFromJson(jsonString);
          if (!parsed) return false;
          
          // Check compatibility
          return isValidRustCoreScript(parsed);
        }),
        { numRuns: 100 }
      );
    });

    it('provider response scripts are rust-core compatible', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          providerArbitrary,
          (script: ScriptData, providerId: AIProvider) => {
            const jsonString = JSON.stringify(script, null, 2);
            const responseText = `\`\`\`json\n${jsonString}\n\`\`\``;
            
            const response = parseProviderResponse(responseText, providerId, 'test-model', 100);
            
            if (!response.success || !response.script) {
              return false;
            }
            
            return isValidRustCoreScript(response.script);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
