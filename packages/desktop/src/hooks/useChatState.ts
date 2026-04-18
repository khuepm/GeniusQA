/**
 * useChatState Hook
 * 
 * Custom hook for managing chat state in the AI Script Builder.
 * Handles message history, input state, loading state, and AI interactions.
 * Supports multi-provider AI with conversation history preservation on provider switch.
 * 
 * Requirements: 2.2, 2.4, 2.5, 6.2
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChatMessage,
  ScriptData,
  ConversationContext,
  AVAILABLE_ACTION_TYPES,
  ActionType,
} from '../types/aiScriptBuilder.types';
import { AIProvider } from '../types/providerAdapter.types';
import { geminiService } from '../services/geminiService';
import { unifiedAIService } from '../services/unifiedAIService';
import { apiKeyService } from '../services/apiKeyService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Generate a unique ID for messages
 */
const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Props for useChatState hook
 * Requirements: 2.4
 */
interface UseChatStateProps {
  onScriptGenerated: (script: ScriptData) => void;
  /** Current active provider for tracking provider switches */
  activeProvider?: AIProvider | null;
  targetOS?: 'macos' | 'windows' | 'universal';
}

/**
 * Return type for useChatState hook
 * Requirements: 2.4, 2.5
 */
interface UseChatStateReturn {
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  error: string | null;
  currentScript: ScriptData | null;
  setInputValue: (value: string) => void;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
  clearMessages: () => void;
  addSystemMessage: (content: string) => void;
  /** Get the current conversation history (for preservation on provider switch) */
  getConversationHistory: () => ChatMessage[];
}

/**
 * Custom hook for managing chat state
 * Requirements: 2.2, 2.4, 2.5, 6.2
 * 
 * @param props - Hook configuration
 * @returns Chat state and actions
 */
export function useChatState({ onScriptGenerated, activeProvider, targetOS }: UseChatStateProps): UseChatStateReturn {
  const { user } = useAuth();
  
  // Message history - maintained in chronological order (Requirements: 2.5)
  // Conversation history is preserved across provider switches (Requirements: 2.4)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Input field value
  const [inputValue, setInputValue] = useState<string>('');
  
  // Loading state for AI processing (Requirements: 2.3)
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Current generated script
  const [currentScript, setCurrentScript] = useState<ScriptData | null>(null);
  
  // Track previous provider for detecting provider switches (Requirements: 2.4)
  const previousProviderRef = useRef<AIProvider | null | undefined>(activeProvider);

  /**
   * Initialize geminiService with API key from Firebase
   * This ensures the service is ready before any API calls
   */
  useEffect(() => {
    const initializeGeminiService = async () => {
      if (!user?.uid) return;
      
      try {
        // Check if already initialized
        if (geminiService.isInitialized()) return;
        
        // Get Gemini API key from Firebase and initialize
        const apiKey = await apiKeyService.getApiKey(user.uid, 'gemini');
        if (apiKey) {
          await geminiService.initialize(apiKey);
        }
      } catch (err) {
        console.error('Failed to initialize Gemini service:', err);
      }
    };

    initializeGeminiService();
  }, [user?.uid]);

  /**
   * Handle provider switch - preserve conversation history
   * Requirements: 2.4
   * 
   * When the active provider changes, we preserve the conversation history
   * and optionally add a system message to indicate the switch.
   */
  useEffect(() => {
    if (previousProviderRef.current !== activeProvider && 
        previousProviderRef.current !== undefined && 
        activeProvider !== undefined) {
      // Provider has changed - conversation history is automatically preserved
      // since we don't clear messages on provider switch
      
      // Update the previous provider reference
      previousProviderRef.current = activeProvider;
    }
  }, [activeProvider]);

  /**
   * Add a message to the history
   * Messages are always added at the end to maintain chronological order
   * Requirements: 2.2, 2.5
   */
  const addMessage = useCallback((
    role: ChatMessage['role'],
    content: string,
    scriptPreview?: ScriptData,
    clarificationQuestions?: string[]
  ): ChatMessage => {
    const message: ChatMessage = {
      id: generateMessageId(),
      role,
      content,
      timestamp: new Date(),
      scriptPreview,
      clarificationQuestions,
    };

    setMessages(prev => [...prev, message]);
    return message;
  }, []);

  /**
   * Add a system message (for notifications, errors, etc.)
   */
  const addSystemMessage = useCallback((content: string) => {
    addMessage('system', content);
  }, [addMessage]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentScript(null);
  }, []);

  /**
   * Get the current conversation history
   * Requirements: 2.4
   * 
   * Returns a copy of the current messages array.
   * This is useful for preserving conversation history when switching providers.
   */
  const getConversationHistory = useCallback((): ChatMessage[] => {
    return [...messages];
  }, [messages]);

  /**
   * Send a message and get AI response
   * Requirements: 2.2, 2.3, 2.4
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Clear input immediately
    setInputValue('');
    clearError();

    // Add user message to history (Requirements: 2.2)
    const userMessage = addMessage('user', content);

    // Set loading state (Requirements: 2.3)
    setIsLoading(true);

    try {
      // Build conversation context
      const context: ConversationContext = {
        previousMessages: [...messages, userMessage],
        currentScript: currentScript || undefined,
        availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
        targetOS,
      };

      // Ensure unified AI service is initialized (API keys loaded) before calling
      if (user?.uid && !unifiedAIService.isInitialized()) {
        await unifiedAIService.initialize(user.uid);
      }

      // Call unified AI service (respects selected provider/model and loaded API keys)
      const result = await unifiedAIService.generateScript(content, context);

      if (result.success) {
        // Add AI response to history (Requirements: 2.4)
        addMessage('assistant', result.message, result.script, result.clarificationQuestions);

        // If a script was generated, update state and notify parent
        if (result.script) {
          setCurrentScript(result.script);
          onScriptGenerated(result.script);
        }

        // Handle clarification questions
        if (result.needsClarification && result.clarificationQuestions) {
          // Questions are already included in the message
        }
      } else {
        // Add error message from AI
        addMessage('assistant', result.message);
        setError(result.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn.';
      
      setError(errorMessage);
      addMessage('assistant', `Lỗi: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [messages, currentScript, addMessage, clearError, onScriptGenerated, user?.uid, targetOS]);

  return {
    messages,
    inputValue,
    isLoading,
    error,
    currentScript,
    setInputValue,
    sendMessage,
    clearError,
    clearMessages,
    addSystemMessage,
    getConversationHistory,
  };
}

export default useChatState;
