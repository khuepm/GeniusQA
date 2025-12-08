/**
 * Property-Based Tests for useChatState Hook
 * 
 * Tests correctness properties for chat state management
 * to ensure message history consistency and proper ordering.
 * 
 * **Feature: ai-script-builder, Property 2: Message History Consistency**
 * **Feature: multi-provider-ai, Property 6: Conversation History Preservation on Provider Switch**
 * **Validates: Requirements 2.2, 2.4, 2.5**
 */

import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { useChatState } from '../useChatState';
import { ChatMessage, ScriptData } from '../../types/aiScriptBuilder.types';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Mock the env module to avoid import.meta issues
 */
jest.mock('../../utils/env', () => ({
  getEnvVar: jest.fn().mockReturnValue('mock-value'),
}));

/**
 * Mock Firebase config
 */
jest.mock('../../config/firebase.config', () => ({
  app: {},
}));

/**
 * Mock Firebase auth
 */
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  GoogleAuthProvider: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  }),
  signInWithPopup: jest.fn(),
}));

/**
 * Mock AuthContext
 */
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { uid: 'test-user-id' },
    loading: false,
    error: null,
  })),
}));

/**
 * Mock the apiKeyService to avoid Firebase calls
 */
jest.mock('../../services/apiKeyService', () => ({
  apiKeyService: {
    getApiKey: jest.fn().mockResolvedValue('mock-api-key'),
    storeApiKey: jest.fn().mockResolvedValue(undefined),
    hasApiKey: jest.fn().mockResolvedValue(true),
    deleteApiKey: jest.fn().mockResolvedValue(undefined),
    getConfiguredProviders: jest.fn().mockResolvedValue(['gemini']),
  },
}));

/**
 * Mock the geminiService to avoid actual API calls
 */
jest.mock('../../services/geminiService', () => ({
  geminiService: {
    generateScript: jest.fn().mockResolvedValue({
      success: true,
      message: 'Test response',
      script: undefined,
    }),
    isInitialized: jest.fn().mockReturnValue(true),
  },
}));

/**
 * Helper to create a mock onScriptGenerated callback
 */
const createMockCallback = () => jest.fn<void, [ScriptData]>();

/**
 * Helper to wait for async operations
 */
const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid message content (non-empty string)
 */
const messageContentArbitrary = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0);

/**
 * Generate a sequence of message contents
 */
const messageSequenceArbitrary = fc.array(messageContentArbitrary, { 
  minLength: 1, 
  maxLength: 10 
});

/**
 * Generate a chat role
 */
const chatRoleArbitrary = fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<'user' | 'assistant' | 'system'>;

/**
 * Generate a mock chat message for testing
 */
const mockChatMessageArbitrary: fc.Arbitrary<Omit<ChatMessage, 'id' | 'timestamp'>> = fc.record({
  role: chatRoleArbitrary,
  content: messageContentArbitrary,
});

// ============================================================================
// Property Tests
// ============================================================================

describe('useChatState Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: ai-script-builder, Property 2: Message History Consistency**
   * **Validates: Requirements 2.2, 2.4, 2.5**
   * 
   * For any sequence of chat messages (user or AI), all messages should appear
   * in the chat history in chronological order, and the total count should equal
   * the number of messages sent plus received.
   */
  describe('Property 2: Message History Consistency', () => {
    it('messages are added in chronological order', async () => {
      await fc.assert(
        fc.asyncProperty(
          messageSequenceArbitrary,
          async (messageContents: string[]) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            // Send messages sequentially
            for (const content of messageContents) {
              await act(async () => {
                await result.current.sendMessage(content);
                await waitForAsync();
              });
            }

            const messages = result.current.messages;

            // Verify chronological order by checking timestamps
            for (let i = 1; i < messages.length; i++) {
              const prevTime = messages[i - 1].timestamp.getTime();
              const currTime = messages[i].timestamp.getTime();
              
              // Each message should have a timestamp >= previous message
              if (currTime < prevTime) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 50 } // Reduced runs due to async nature
      );
    });

    it('user messages appear in history after sending', async () => {
      await fc.assert(
        fc.asyncProperty(
          messageContentArbitrary,
          async (content: string) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            await act(async () => {
              await result.current.sendMessage(content);
              await waitForAsync();
            });

            const messages = result.current.messages;
            
            // Should have at least the user message
            if (messages.length === 0) {
              return false;
            }

            // First message should be from user with the sent content
            const userMessage = messages.find(m => m.role === 'user');
            return userMessage !== undefined && userMessage.content === content;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('message count equals sent messages plus responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageContentArbitrary, { minLength: 1, maxLength: 5 }),
          async (messageContents: string[]) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            // Send all messages
            for (const content of messageContents) {
              await act(async () => {
                await result.current.sendMessage(content);
                await waitForAsync();
              });
            }

            const messages = result.current.messages;
            const userMessages = messages.filter(m => m.role === 'user');
            const assistantMessages = messages.filter(m => m.role === 'assistant');

            // Each user message should have a corresponding response
            // Total should be user messages + assistant responses
            return (
              userMessages.length === messageContents.length &&
              messages.length === userMessages.length + assistantMessages.length
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('all messages have unique IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageContentArbitrary, { minLength: 2, maxLength: 5 }),
          async (messageContents: string[]) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            for (const content of messageContents) {
              await act(async () => {
                await result.current.sendMessage(content);
                await waitForAsync();
              });
            }

            const messages = result.current.messages;
            const ids = messages.map(m => m.id);
            const uniqueIds = new Set(ids);

            // All IDs should be unique
            return ids.length === uniqueIds.size;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('messages maintain order after multiple sends', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageContentArbitrary, { minLength: 2, maxLength: 5 }),
          async (messageContents: string[]) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            for (const content of messageContents) {
              await act(async () => {
                await result.current.sendMessage(content);
                await waitForAsync();
              });
            }

            const messages = result.current.messages;
            const userMessages = messages.filter(m => m.role === 'user');

            // User messages should appear in the same order they were sent
            for (let i = 0; i < messageContents.length; i++) {
              if (userMessages[i]?.content !== messageContents[i]) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('clearMessages removes all messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageContentArbitrary, { minLength: 1, maxLength: 5 }),
          async (messageContents: string[]) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            // Add some messages
            for (const content of messageContents) {
              await act(async () => {
                await result.current.sendMessage(content);
                await waitForAsync();
              });
            }

            // Clear messages
            act(() => {
              result.current.clearMessages();
            });

            // Should have no messages
            return result.current.messages.length === 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('system messages are added correctly', () => {
      fc.assert(
        fc.property(
          messageContentArbitrary,
          (content: string) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            act(() => {
              result.current.addSystemMessage(content);
            });

            const messages = result.current.messages;
            
            // Should have exactly one system message
            const systemMessages = messages.filter(m => m.role === 'system');
            return (
              systemMessages.length === 1 &&
              systemMessages[0].content === content
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('input value is cleared after sending', async () => {
      await fc.assert(
        fc.asyncProperty(
          messageContentArbitrary,
          async (content: string) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            // Set input value
            act(() => {
              result.current.setInputValue(content);
            });

            // Send message
            await act(async () => {
              await result.current.sendMessage(content);
              await waitForAsync();
            });

            // Input should be cleared
            return result.current.inputValue === '';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty messages are not added to history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', '   ', '\t', '\n'),
          async (emptyContent: string) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            await act(async () => {
              await result.current.sendMessage(emptyContent);
              await waitForAsync();
            });

            // Should have no messages for empty content
            return result.current.messages.length === 0;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: multi-provider-ai, Property 6: Conversation History Preservation on Provider Switch**
   * **Validates: Requirements 2.4**
   * 
   * For any conversation history and provider switch operation, the conversation
   * history should remain unchanged after the switch.
   */
  describe('Property 6: Conversation History Preservation on Provider Switch', () => {
    /**
     * Generate a valid AI provider
     */
    const providerArbitrary = fc.constantFrom('gemini', 'openai', 'anthropic', 'azure') as fc.Arbitrary<'gemini' | 'openai' | 'anthropic' | 'azure'>;

    it('conversation history is preserved when provider changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageContentArbitrary, { minLength: 1, maxLength: 5 }),
          providerArbitrary,
          providerArbitrary,
          async (messageContents: string[], initialProvider, newProvider) => {
            const mockCallback = createMockCallback();
            
            // Start with initial provider
            const { result, rerender } = renderHook(
              ({ activeProvider }) => useChatState({ onScriptGenerated: mockCallback, activeProvider }),
              { initialProps: { activeProvider: initialProvider } }
            );

            // Send messages
            for (const content of messageContents) {
              await act(async () => {
                await result.current.sendMessage(content);
                await waitForAsync();
              });
            }

            // Capture message history before provider switch
            const messagesBeforeSwitch = result.current.getConversationHistory();
            const messageCountBefore = messagesBeforeSwitch.length;

            // Switch provider
            rerender({ activeProvider: newProvider });

            // Get messages after provider switch
            const messagesAfterSwitch = result.current.messages;

            // Verify conversation history is preserved
            // 1. Message count should be the same
            if (messagesAfterSwitch.length !== messageCountBefore) {
              return false;
            }

            // 2. All messages should have the same content and order
            for (let i = 0; i < messageCountBefore; i++) {
              if (messagesBeforeSwitch[i].content !== messagesAfterSwitch[i].content ||
                  messagesBeforeSwitch[i].role !== messagesAfterSwitch[i].role ||
                  messagesBeforeSwitch[i].id !== messagesAfterSwitch[i].id) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('getConversationHistory returns a copy of messages', () => {
      fc.assert(
        fc.property(
          messageContentArbitrary,
          (content: string) => {
            const mockCallback = createMockCallback();
            const { result } = renderHook(() => useChatState({ onScriptGenerated: mockCallback }));

            // Add a system message
            act(() => {
              result.current.addSystemMessage(content);
            });

            // Get conversation history
            const history = result.current.getConversationHistory();
            
            // Modifying the returned array should not affect the original
            history.push({
              id: 'test-id',
              role: 'user',
              content: 'modified',
              timestamp: new Date(),
            });

            // Original messages should be unchanged
            return result.current.messages.length === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple provider switches preserve history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageContentArbitrary, { minLength: 1, maxLength: 3 }),
          fc.array(providerArbitrary, { minLength: 2, maxLength: 5 }),
          async (messageContents: string[], providerSequence) => {
            const mockCallback = createMockCallback();
            
            const { result, rerender } = renderHook(
              ({ activeProvider }) => useChatState({ onScriptGenerated: mockCallback, activeProvider }),
              { initialProps: { activeProvider: providerSequence[0] } }
            );

            // Send messages
            for (const content of messageContents) {
              await act(async () => {
                await result.current.sendMessage(content);
                await waitForAsync();
              });
            }

            // Capture initial message count
            const initialMessageCount = result.current.messages.length;

            // Switch through multiple providers
            for (let i = 1; i < providerSequence.length; i++) {
              rerender({ activeProvider: providerSequence[i] });
            }

            // Message count should remain the same after all switches
            return result.current.messages.length === initialMessageCount;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('user messages content is preserved exactly after provider switch', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageContentArbitrary, { minLength: 1, maxLength: 5 }),
          providerArbitrary,
          providerArbitrary.filter(p => p !== 'gemini'), // Ensure different provider
          async (messageContents: string[], initialProvider, newProvider) => {
            const mockCallback = createMockCallback();
            
            const { result, rerender } = renderHook(
              ({ activeProvider }) => useChatState({ onScriptGenerated: mockCallback, activeProvider }),
              { initialProps: { activeProvider: initialProvider } }
            );

            // Send messages
            for (const content of messageContents) {
              await act(async () => {
                await result.current.sendMessage(content);
                await waitForAsync();
              });
            }

            // Get user messages before switch
            const userMessagesBefore = result.current.messages
              .filter(m => m.role === 'user')
              .map(m => m.content);

            // Switch provider
            rerender({ activeProvider: newProvider });

            // Get user messages after switch
            const userMessagesAfter = result.current.messages
              .filter(m => m.role === 'user')
              .map(m => m.content);

            // User message contents should be exactly the same
            if (userMessagesBefore.length !== userMessagesAfter.length) {
              return false;
            }

            for (let i = 0; i < userMessagesBefore.length; i++) {
              if (userMessagesBefore[i] !== userMessagesAfter[i]) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
