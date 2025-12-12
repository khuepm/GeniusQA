/**
 * AI Chat Interface Component
 * 
 * Provides a chat interface for users to describe test scenarios
 * in natural language and receive AI-generated automation scripts.
 * Supports multiple AI providers with provider and model selection.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 5.1, 5.2, 5.3, 5.4, 6.2
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ChatMessage, ScriptData, ChatInterfaceProps, ActionSuggestion, ExamplePrompt } from '../types/aiScriptBuilder.types';
import { AIProvider, ProviderInfo, ProviderModel } from '../types/providerAdapter.types';
import { useChatState } from '../hooks/useChatState';
import { getSuggestions, getExamplePrompts } from '../utils/scriptSuggestions';
import { ProviderSelector } from './ProviderSelector';
import { ModelSelector } from './ModelSelector';
import './AIChatInterface.css';

/**
 * Format timestamp for display
 */
const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Message bubble component for individual chat messages
 */
interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div
      className={`chat-message ${isUser ? 'chat-message-user' : ''} ${isSystem ? 'chat-message-system' : ''}`}
      data-testid={`message-${message.id}`}
    >
      <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
        <div className="chat-message-content">{message.content}</div>
        <div className="chat-message-timestamp">{formatTimestamp(message.timestamp)}</div>
      </div>
    </div>
  );
};

/**
 * Loading indicator component shown during AI processing
 * Requirements: 2.3, 6.2
 */
interface LoadingIndicatorProps {
  providerName?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ providerName }) => (
  <div className="chat-loading" data-testid="chat-loading">
    <div className="chat-loading-dots">
      <span className="chat-loading-dot"></span>
      <span className="chat-loading-dot"></span>
      <span className="chat-loading-dot"></span>
    </div>
    <span className="chat-loading-text">
      {providerName ? `${providerName} đang xử lý...` : 'AI đang xử lý...'}
    </span>
  </div>
);

/**
 * Suggestion dropdown component
 * Requirements: 5.2
 */
interface SuggestionDropdownProps {
  suggestions: ActionSuggestion[];
  onSelect: (suggestion: ActionSuggestion) => void;
  visible: boolean;
}

const SuggestionDropdown: React.FC<SuggestionDropdownProps> = ({
  suggestions,
  onSelect,
  visible,
}) => {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="chat-suggestions-dropdown" data-testid="suggestions-dropdown">
      <div className="chat-suggestions-header">Gợi ý hành động:</div>
      {suggestions.map((suggestion, index) => (
        <button
          key={`${suggestion.actionType}-${index}`}
          className="chat-suggestion-item"
          onClick={() => onSelect(suggestion)}
          data-testid={`suggestion-${suggestion.actionType}`}
        >
          <span className="chat-suggestion-keyword">{suggestion.keyword}</span>
          <span className="chat-suggestion-description">{suggestion.description}</span>
        </button>
      ))}
    </div>
  );
};

/**
 * Example prompts panel component
 * Requirements: 5.1, 5.4
 */
interface ExamplePromptsPanelProps {
  examples: ExamplePrompt[];
  onSelect: (example: ExamplePrompt) => void;
}

const ExamplePromptsPanel: React.FC<ExamplePromptsPanelProps> = ({
  examples,
  onSelect,
}) => {
  return (
    <div className="chat-examples-panel" data-testid="examples-panel">
      <div className="chat-examples-header">
        <span className="chat-examples-icon">💡</span>
        <span>Ví dụ kịch bản test</span>
      </div>
      <div className="chat-examples-grid">
        {examples.map((example) => (
          <button
            key={example.id}
            className="chat-example-card"
            onClick={() => onSelect(example)}
            data-testid={`example-${example.id}`}
          >
            <div className="chat-example-title">{example.title}</div>
            <div className="chat-example-description">{example.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Clarification questions component
 * Requirements: 5.3
 */
interface ClarificationQuestionsProps {
  questions: string[];
  onAnswerSelect: (answer: string) => void;
}

const ClarificationQuestions: React.FC<ClarificationQuestionsProps> = ({
  questions,
  onAnswerSelect,
}) => {
  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <div className="chat-clarification" data-testid="clarification-questions">
      <div className="chat-clarification-header">AI cần thêm thông tin:</div>
      {questions.map((question, index) => (
        <button
          key={index}
          className="chat-clarification-item"
          onClick={() => onAnswerSelect(question)}
          data-testid={`clarification-${index}`}
        >
          {question}
        </button>
      ))}
    </div>
  );
};


/**
 * API Key Configuration Prompt
 * Requirements: 1.3 - Display prompt when API key not configured
 */
interface ApiKeyPromptProps {
  onConfigureKey: () => void;
}

const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({ onConfigureKey }) => (
  <div className="chat-api-key-prompt" data-testid="api-key-prompt">
    <div className="chat-api-key-icon">🔑</div>
    <h3 className="chat-api-key-title">Cấu hình API Key</h3>
    <p className="chat-api-key-description">
      Để sử dụng tính năng AI Script Builder, bạn cần cấu hình Gemini API key.
    </p>
    <button
      className="chat-api-key-button"
      onClick={onConfigureKey}
      data-testid="configure-api-key-button"
    >
      Cấu hình API Key
    </button>
  </div>
);

/**
 * Main AI Chat Interface Component
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 5.1, 5.2, 5.3, 5.4, 6.2
 */
export const AIChatInterface: React.FC<ChatInterfaceProps> = ({
  onScriptGenerated,
  apiKeyConfigured,
  providers = [],
  activeProvider = null,
  onProviderSelect,
  onConfigureProvider,
  models = [],
  activeModel = null,
  onModelSelect,
  providerLoading = false,
}) => {
  const {
    messages,
    inputValue,
    isLoading,
    error,
    setInputValue,
    sendMessage,
    clearError,
  } = useChatState({ onScriptGenerated });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // State for suggestions dropdown visibility
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get example prompts (Requirements: 5.1)
  const examplePrompts = useMemo(() => getExamplePrompts(), []);

  // Get suggestions based on current input (Requirements: 5.2)
  const suggestions = useMemo(() => getSuggestions(inputValue), [inputValue]);

  // Get clarification questions from the last AI message (Requirements: 5.3)
  const clarificationQuestions = useMemo(() => {
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMessage?.scriptPreview === undefined) {
      // Check if the message contains clarification questions pattern
      const content = lastAssistantMessage?.content || '';
      const questionMatch = content.match(/\?[\s]*$/);
      if (questionMatch) {
        // Extract potential questions from the message
        return [];
      }
    }
    return [];
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  // Requirements: 2.5 - Maintain message order
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (apiKeyConfigured) {
      inputRef.current?.focus();
    }
  }, [apiKeyConfigured]);

  // Show suggestions when input has content
  useEffect(() => {
    setShowSuggestions(inputValue.length > 0 && suggestions.length > 0);
  }, [inputValue, suggestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      setShowSuggestions(false);
      await sendMessage(inputValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    // Close suggestions on Escape
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleConfigureApiKey = () => {
    // This will be handled by parent component
    // For now, we'll just show an alert
    alert('Vui lòng cấu hình API key trong phần Settings');
  };

  /**
   * Handle suggestion selection
   * Requirements: 5.2
   */
  const handleSuggestionSelect = (suggestion: ActionSuggestion) => {
    // Append the action description to the input
    const newValue = inputValue.trim() + ' ' + suggestion.description;
    setInputValue(newValue);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  /**
   * Handle example prompt selection
   * Requirements: 5.4
   */
  const handleExampleSelect = (example: ExamplePrompt) => {
    setInputValue(example.promptText);
    inputRef.current?.focus();
  };

  /**
   * Handle clarification answer selection
   * Requirements: 5.3
   */
  const handleClarificationSelect = (answer: string) => {
    setInputValue(answer);
    inputRef.current?.focus();
  };

  // Show API key prompt if not configured
  if (!apiKeyConfigured) {
    return (
      <div className="chat-container" data-testid="chat-interface">
        <ApiKeyPrompt onConfigureKey={handleConfigureApiKey} />
      </div>
    );
  }

  /**
   * Get the active provider name for display
   * Requirements: 2.5, 6.2
   */
  const activeProviderInfo = providers.find(p => p.id === activeProvider);
  const activeProviderName = activeProviderInfo?.name || null;

  /**
   * Handle provider selection
   * Requirements: 2.2
   */
  const handleProviderSelect = (providerId: AIProvider) => {
    if (onProviderSelect) {
      onProviderSelect(providerId);
    }
  };

  /**
   * Handle provider configuration
   * Requirements: 1.5
   */
  const handleConfigureProvider = (providerId: AIProvider) => {
    if (onConfigureProvider) {
      onConfigureProvider(providerId);
    }
  };

  /**
   * Handle model selection
   * Requirements: 3.2
   */
  const handleModelSelect = (modelId: string) => {
    if (onModelSelect) {
      onModelSelect(modelId);
    }
  };

  return (
    <div className="chat-container" data-testid="chat-interface">
      {/* Chat Header with Provider/Model Selectors */}
      <div className="chat-header">
        <div className="chat-header-top">
          <div className="chat-header-title">
            <h2 className="chat-title">AI Script Builder</h2>
            <p className="chat-subtitle">Mô tả kịch bản test của bạn bằng ngôn ngữ tự nhiên</p>
          </div>

          {/* Provider and Model Selectors - Requirements: 2.1, 2.5, 3.1 */}
          {providers.length > 0 && (
            <div className="chat-header-selectors" data-testid="chat-header-selectors">
              <ProviderSelector
                providers={providers}
                activeProvider={activeProvider}
                onProviderSelect={handleProviderSelect}
                onConfigureProvider={handleConfigureProvider}
                disabled={isLoading}
                loading={providerLoading}
              />
              {activeProvider && models.length > 0 && (
                <ModelSelector
                  models={models}
                  activeModel={activeModel}
                  onModelSelect={handleModelSelect}
                  disabled={isLoading || providerLoading}
                />
              )}
            </div>
          )}
        </div>

        {/* Current Provider/Model Display - Requirements: 2.5 */}
        {activeProviderName && activeModel && (
          <div className="chat-header-status" data-testid="chat-header-status">
            <span className="chat-status-provider">{activeProviderName}</span>
            <span className="chat-status-separator">•</span>
            <span className="chat-status-model">
              {models.find(m => m.id === activeModel)?.name || activeModel}
            </span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="chat-error" data-testid="chat-error">
          <span className="chat-error-message">{error}</span>
          <button
            className="chat-error-dismiss"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Messages List */}
      <div className="chat-messages" data-testid="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">💬</div>
            <p className="chat-empty-text">
              Bắt đầu bằng cách mô tả kịch bản automation test bạn muốn tạo.
            </p>
            <p className="chat-empty-hint">
              Ví dụ: "Click vào nút Login, nhập username và password, sau đó nhấn Enter"
            </p>

            {/* Example prompts panel (Requirements: 5.1) */}
            <ExamplePromptsPanel
              examples={examplePrompts}
              onSelect={handleExampleSelect}
            />
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Clarification questions (Requirements: 5.3) */}
            <ClarificationQuestions
              questions={clarificationQuestions}
              onAnswerSelect={handleClarificationSelect}
            />
          </>
        )}

        {/* Loading indicator - Requirements: 6.2 */}
        {isLoading && <LoadingIndicator providerName={activeProviderName || undefined} />}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area with Suggestions */}
      <div className="chat-input-wrapper">
        {/* Suggestion dropdown (Requirements: 5.2) */}
        <SuggestionDropdown
          suggestions={suggestions}
          onSelect={handleSuggestionSelect}
          visible={showSuggestions}
        />

        <form className="chat-input-area" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Mô tả kịch bản test của bạn..."
            disabled={isLoading}
            rows={1}
            data-testid="chat-input"
          />
          <button
            type="submit"
            className="chat-send-button"
            disabled={!inputValue.trim() || isLoading}
            data-testid="chat-send-button"
          >
            <span className="chat-send-icon">➤</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChatInterface;
