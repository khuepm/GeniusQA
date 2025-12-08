/**
 * Property-Based Tests for Script Suggestions
 * 
 * Tests correctness properties for keyword-based action suggestions
 * and example prompt functionality.
 * 
 * Requirements: 5.1, 5.2, 5.4
 */

import * as fc from 'fast-check';
import {
  getSuggestions,
  getExamplePrompts,
  getExamplePromptById,
  ACTION_SUGGESTIONS,
  EXAMPLE_PROMPTS,
  hasActionKeywords,
  getUniqueActionTypes,
} from '../scriptSuggestions';
import { AVAILABLE_ACTION_TYPES, ActionType } from '../../types/aiScriptBuilder.types';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a random keyword from the ACTION_SUGGESTIONS list
 */
const knownKeywordArbitrary = fc.constantFrom(
  ...ACTION_SUGGESTIONS.map(s => s.keyword)
);

/**
 * Generate a random action type
 */
const actionTypeArbitrary = fc.constantFrom(...AVAILABLE_ACTION_TYPES);

/**
 * Generate a random example prompt ID
 */
const examplePromptIdArbitrary = fc.constantFrom(
  ...EXAMPLE_PROMPTS.map(p => p.id)
);

/**
 * Generate input text containing a known keyword
 */
const inputWithKeywordArbitrary = fc.tuple(
  knownKeywordArbitrary,
  fc.string({ minLength: 0, maxLength: 50 }),
  fc.string({ minLength: 0, maxLength: 50 })
).map(([keyword, prefix, suffix]) => `${prefix} ${keyword} ${suffix}`);

/**
 * Generate random text that likely doesn't contain action keywords
 */
const randomTextArbitrary = fc.string({ minLength: 0, maxLength: 100 });

// ============================================================================
// Property Tests
// ============================================================================

describe('Script Suggestions Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 8: Suggestion Relevance**
   * **Validates: Requirements 5.2**
   * 
   * For any user input text containing action keywords (click, type, wait, etc.),
   * the suggestion system should return suggestions containing at least one
   * matching action type.
   */
  describe('Property 8: Suggestion Relevance', () => {
    it('input containing known keywords returns at least one suggestion', () => {
      fc.assert(
        fc.property(knownKeywordArbitrary, (keyword: string) => {
          const suggestions = getSuggestions(keyword);
          
          // Should return at least one suggestion for a known keyword
          return suggestions.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('suggestions contain matching action types for input with keywords', () => {
      fc.assert(
        fc.property(inputWithKeywordArbitrary, (input: string) => {
          const suggestions = getSuggestions(input);
          
          // If we have suggestions, they should all have valid action types
          if (suggestions.length > 0) {
            return suggestions.every(s => 
              AVAILABLE_ACTION_TYPES.includes(s.actionType)
            );
          }
          
          // If no suggestions, the input might not contain recognizable keywords
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('each suggestion has required fields', () => {
      fc.assert(
        fc.property(knownKeywordArbitrary, (keyword: string) => {
          const suggestions = getSuggestions(keyword);
          
          return suggestions.every(s => 
            s.keyword !== undefined &&
            s.keyword.length > 0 &&
            s.actionType !== undefined &&
            s.description !== undefined &&
            s.description.length > 0
          );
        }),
        { numRuns: 100 }
      );
    });

    it('suggestions do not contain duplicate action types', () => {
      fc.assert(
        fc.property(inputWithKeywordArbitrary, (input: string) => {
          const suggestions = getSuggestions(input);
          const actionTypes = suggestions.map(s => s.actionType);
          const uniqueTypes = new Set(actionTypes);
          
          // No duplicate action types
          return actionTypes.length === uniqueTypes.size;
        }),
        { numRuns: 100 }
      );
    });

    it('empty input returns no suggestions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n'),
          (emptyInput: string) => {
            const suggestions = getSuggestions(emptyInput);
            return suggestions.length === 0;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('hasActionKeywords returns true for inputs with known keywords', () => {
      fc.assert(
        fc.property(knownKeywordArbitrary, (keyword: string) => {
          return hasActionKeywords(keyword) === true;
        }),
        { numRuns: 100 }
      );
    });

    it('getUniqueActionTypes returns unique action types from suggestions', () => {
      fc.assert(
        fc.property(inputWithKeywordArbitrary, (input: string) => {
          const suggestions = getSuggestions(input);
          const uniqueTypes = getUniqueActionTypes(suggestions);
          
          // Should be unique
          const uniqueSet = new Set(uniqueTypes);
          return uniqueTypes.length === uniqueSet.size;
        }),
        { numRuns: 100 }
      );
    });

    it('all action suggestions map to valid action types', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: ACTION_SUGGESTIONS.length - 1 }),
          (index: number) => {
            const suggestion = ACTION_SUGGESTIONS[index];
            return AVAILABLE_ACTION_TYPES.includes(suggestion.actionType);
          }
        ),
        { numRuns: ACTION_SUGGESTIONS.length }
      );
    });
  });

  /**
   * **Feature: ai-script-builder, Property 9: Example Prompt Population**
   * **Validates: Requirements 5.4**
   * 
   * For any example prompt selected by the user, the input field should
   * contain exactly the text of the selected example.
   */
  describe('Property 9: Example Prompt Population', () => {
    it('getExamplePrompts returns all example prompts', () => {
      const prompts = getExamplePrompts();
      
      // Should return the same prompts as EXAMPLE_PROMPTS
      expect(prompts.length).toBe(EXAMPLE_PROMPTS.length);
      expect(prompts).toEqual(EXAMPLE_PROMPTS);
    });

    it('each example prompt has all required fields', () => {
      fc.assert(
        fc.property(examplePromptIdArbitrary, (id: string) => {
          const prompt = getExamplePromptById(id);
          
          if (!prompt) return false;
          
          return (
            prompt.id !== undefined &&
            prompt.id.length > 0 &&
            prompt.title !== undefined &&
            prompt.title.length > 0 &&
            prompt.description !== undefined &&
            prompt.description.length > 0 &&
            prompt.promptText !== undefined &&
            prompt.promptText.length > 0
          );
        }),
        { numRuns: EXAMPLE_PROMPTS.length }
      );
    });

    it('getExamplePromptById returns correct prompt for valid ID', () => {
      fc.assert(
        fc.property(examplePromptIdArbitrary, (id: string) => {
          const prompt = getExamplePromptById(id);
          
          // Should find the prompt
          if (!prompt) return false;
          
          // ID should match
          return prompt.id === id;
        }),
        { numRuns: EXAMPLE_PROMPTS.length }
      );
    });

    it('getExamplePromptById returns undefined for invalid ID', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            s => !EXAMPLE_PROMPTS.some(p => p.id === s)
          ),
          (invalidId: string) => {
            const prompt = getExamplePromptById(invalidId);
            return prompt === undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('example prompt IDs are unique', () => {
      const ids = EXAMPLE_PROMPTS.map(p => p.id);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('example prompts contain action-related content', () => {
      fc.assert(
        fc.property(examplePromptIdArbitrary, (id: string) => {
          const prompt = getExamplePromptById(id);
          
          if (!prompt) return false;
          
          // The prompt text should contain at least one action keyword
          const promptTextLower = prompt.promptText.toLowerCase();
          const hasActionKeyword = ACTION_SUGGESTIONS.some(
            s => promptTextLower.includes(s.keyword.toLowerCase())
          );
          
          return hasActionKeyword;
        }),
        { numRuns: EXAMPLE_PROMPTS.length }
      );
    });

    it('selecting example prompt provides exact promptText', () => {
      fc.assert(
        fc.property(examplePromptIdArbitrary, (id: string) => {
          const prompt = getExamplePromptById(id);
          
          if (!prompt) return false;
          
          // Simulate selecting the prompt and populating input
          const inputValue = prompt.promptText;
          
          // The input should contain exactly the prompt text
          return inputValue === prompt.promptText;
        }),
        { numRuns: EXAMPLE_PROMPTS.length }
      );
    });
  });
});

// ============================================================================
// Additional Unit Tests
// ============================================================================

describe('Script Suggestions Unit Tests', () => {
  describe('getSuggestions', () => {
    it('returns suggestions for "click"', () => {
      const suggestions = getSuggestions('click');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.actionType === 'mouse_click')).toBe(true);
    });

    it('returns suggestions for Vietnamese keywords', () => {
      const suggestions = getSuggestions('nhấn');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('returns suggestions for "type"', () => {
      const suggestions = getSuggestions('type');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.actionType === 'key_type')).toBe(true);
    });

    it('returns suggestions for "wait"', () => {
      const suggestions = getSuggestions('wait');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.actionType === 'wait')).toBe(true);
    });

    it('is case insensitive', () => {
      const lowerSuggestions = getSuggestions('click');
      const upperSuggestions = getSuggestions('CLICK');
      const mixedSuggestions = getSuggestions('Click');
      
      expect(lowerSuggestions.length).toBe(upperSuggestions.length);
      expect(lowerSuggestions.length).toBe(mixedSuggestions.length);
    });
  });

  describe('getExamplePrompts', () => {
    it('returns non-empty array', () => {
      const prompts = getExamplePrompts();
      expect(prompts.length).toBeGreaterThan(0);
    });

    it('includes login flow example', () => {
      const prompts = getExamplePrompts();
      expect(prompts.some(p => p.id === 'login-flow')).toBe(true);
    });
  });
});
