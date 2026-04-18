/**
 * Property-Based Tests for OS Context in Prompt
 * 
 * Tests that when a user selects a target OS, the AI prompt includes
 * OS-specific context and key mappings.
 * 
 * **Feature: ai-script-builder, Property 14: OS Context in Prompt**
 * **Validates: Requirements 8.2**
 */

import * as fc from 'fast-check';
import {
    ActionType,
    AVAILABLE_ACTION_TYPES,
    ChatMessage,
    ConversationContext,
} from '../../../types/aiScriptBuilder.types';
import { getOSKeyMappings, TargetOS } from '../../../utils/osKeyMappings';
import { buildContextString, buildGenerationPrompt } from '../baseAdapter';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid target OS
 */
const targetOSArbitrary: fc.Arbitrary<TargetOS> = fc.constantFrom(
  'macos',
  'windows',
  'universal'
);

/**
 * Generate a valid chat message
 */
const chatMessageArbitrary: fc.Arbitrary<ChatMessage> = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('user' as const, 'assistant' as const, 'system' as const),
  content: fc.string({ minLength: 5, maxLength: 200 }),
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  scriptPreview: fc.constant(undefined),
  clarificationQuestions: fc.constant(undefined),
});

/**
 * Generate a conversation context with optional targetOS
 */
const conversationContextArbitrary: fc.Arbitrary<ConversationContext> = fc.record({
  previousMessages: fc.array(chatMessageArbitrary, { minLength: 0, maxLength: 10 }),
  currentScript: fc.constant(undefined),
  availableActions: fc.constant(AVAILABLE_ACTION_TYPES as ActionType[]),
  targetOS: fc.option(targetOSArbitrary, { nil: undefined }),
});

/**
 * Generate a conversation context with a specific targetOS
 */
const conversationContextWithOSArbitrary: fc.Arbitrary<ConversationContext & { targetOS: TargetOS }> = 
  fc.record({
    previousMessages: fc.array(chatMessageArbitrary, { minLength: 0, maxLength: 10 }),
    currentScript: fc.constant(undefined),
    availableActions: fc.constant(AVAILABLE_ACTION_TYPES as ActionType[]),
    targetOS: targetOSArbitrary,
  });

/**
 * Generate a user prompt
 */
const userPromptArbitrary = fc.string({ minLength: 10, maxLength: 200 })
  .filter(s => s.trim().length >= 10);

// ============================================================================
// Property Tests
// ============================================================================

describe('OS Context in Prompt Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 14: OS Context in Prompt**
   * **Validates: Requirements 8.2**
   * 
   * For any selected target OS, the AI prompt SHALL include the OS context
   * in the generated prompt string.
   */
  describe('Property 14: OS Context in Prompt', () => {
    it('context string includes target OS when specified', () => {
      fc.assert(
        fc.property(
          conversationContextWithOSArbitrary,
          (context) => {
            const contextString = buildContextString(context);
            
            // The context string must mention the target OS
            const lowerContext = contextString.toLowerCase();
            const targetOS = context.targetOS.toLowerCase();
            
            return lowerContext.includes(targetOS) || 
                   lowerContext.includes('target os');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generation prompt includes target OS when specified', () => {
      fc.assert(
        fc.property(
          userPromptArbitrary,
          conversationContextWithOSArbitrary,
          (userPrompt, context) => {
            const fullPrompt = buildGenerationPrompt(userPrompt, context);
            
            // The full prompt must include the target OS
            const lowerPrompt = fullPrompt.toLowerCase();
            const targetOS = context.targetOS.toLowerCase();
            
            return lowerPrompt.includes(targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('context string does not include OS when not specified', () => {
      fc.assert(
        fc.property(
          conversationContextArbitrary.filter(ctx => !ctx.targetOS),
          (context) => {
            const contextString = buildContextString(context);
            
            // Should not mention target OS if not specified
            const lowerContext = contextString.toLowerCase();
            
            // Should not contain OS-specific mentions
            return !lowerContext.includes('target os (already selected)');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('each target OS produces different context strings', () => {
      fc.assert(
        fc.property(
          fc.array(chatMessageArbitrary, { minLength: 0, maxLength: 5 }),
          (messages) => {
            const macosContext: ConversationContext = {
              previousMessages: messages,
              availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
              targetOS: 'macos',
            };

            const windowsContext: ConversationContext = {
              previousMessages: messages,
              availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
              targetOS: 'windows',
            };

            const universalContext: ConversationContext = {
              previousMessages: messages,
              availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
              targetOS: 'universal',
            };

            const macosString = buildContextString(macosContext);
            const windowsString = buildContextString(windowsContext);
            const universalString = buildContextString(universalContext);

            // Each OS should produce a different context string
            return (
              macosString !== windowsString &&
              windowsString !== universalString &&
              macosString !== universalString
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('prompt includes OS context for all valid OS types', () => {
      fc.assert(
        fc.property(
          userPromptArbitrary,
          targetOSArbitrary,
          fc.array(chatMessageArbitrary, { minLength: 0, maxLength: 5 }),
          (userPrompt, targetOS, messages) => {
            const context: ConversationContext = {
              previousMessages: messages,
              availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
              targetOS,
            };

            const fullPrompt = buildGenerationPrompt(userPrompt, context);
            
            // Verify the prompt contains the OS name
            const lowerPrompt = fullPrompt.toLowerCase();
            return lowerPrompt.includes(targetOS.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('OS context appears before user request in prompt', () => {
      fc.assert(
        fc.property(
          userPromptArbitrary,
          conversationContextWithOSArbitrary,
          (userPrompt, context) => {
            const fullPrompt = buildGenerationPrompt(userPrompt, context);
            
            // Find positions of OS mention and user request
            const osPosition = fullPrompt.toLowerCase().indexOf(context.targetOS.toLowerCase());
            const userRequestPosition = fullPrompt.indexOf(userPrompt);
            
            // OS context should appear before user request
            return osPosition >= 0 && 
                   userRequestPosition >= 0 && 
                   osPosition < userRequestPosition;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('context string is deterministic for same inputs', () => {
      fc.assert(
        fc.property(
          conversationContextWithOSArbitrary,
          (context) => {
            const contextString1 = buildContextString(context);
            const contextString2 = buildContextString(context);
            
            // Same context should produce identical strings
            return contextString1 === contextString2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generation prompt is deterministic for same inputs', () => {
      fc.assert(
        fc.property(
          userPromptArbitrary,
          conversationContextWithOSArbitrary,
          (userPrompt, context) => {
            const prompt1 = buildGenerationPrompt(userPrompt, context);
            const prompt2 = buildGenerationPrompt(userPrompt, context);
            
            // Same inputs should produce identical prompts
            return prompt1 === prompt2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('context includes available actions regardless of OS', () => {
      fc.assert(
        fc.property(
          conversationContextWithOSArbitrary,
          (context) => {
            const contextString = buildContextString(context);
            
            // Should always include available actions
            return contextString.includes('Available action types');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('OS key mappings are available for all target OS types', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          (targetOS) => {
            const keyMappings = getOSKeyMappings(targetOS);
            
            // Key mappings should exist and not be empty
            return keyMappings !== null && 
                   keyMappings !== undefined &&
                   Object.keys(keyMappings).length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different OS types have different key mappings', () => {
      const macosKeys = getOSKeyMappings('macos');
      const windowsKeys = getOSKeyMappings('windows');
      const universalKeys = getOSKeyMappings('universal');

      // Check that at least some mappings differ between OS types
      // For example, copy shortcut should be different
      expect(macosKeys.copy.keys).not.toBe(windowsKeys.copy.keys);
      
      // macOS uses Cmd, Windows uses Ctrl
      expect(macosKeys.copy.keys).toContain('Cmd');
      expect(windowsKeys.copy.keys).toContain('Ctrl');
    });

    it('prompt preserves user request content', () => {
      fc.assert(
        fc.property(
          userPromptArbitrary,
          conversationContextWithOSArbitrary,
          (userPrompt, context) => {
            const fullPrompt = buildGenerationPrompt(userPrompt, context);
            
            // User prompt should be included in full prompt
            return fullPrompt.includes(userPrompt);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('context with many messages is truncated appropriately', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          fc.array(chatMessageArbitrary, { minLength: 10, maxLength: 20 }),
          (targetOS, messages) => {
            const context: ConversationContext = {
              previousMessages: messages,
              availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
              targetOS,
            };

            const contextString = buildContextString(context);
            
            // Context should still be generated and include OS
            return contextString.length > 0 && 
                   contextString.toLowerCase().includes(targetOS.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
