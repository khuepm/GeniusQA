/**
 * AI Chat Interface Component
 * 
 * Provides a chat interface for users to describe test scenarios
 * in natural language and receive AI-generated automation scripts.
 * Supports multiple AI providers with provider and model selection.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 5.1, 5.2, 5.3, 5.4, 6.2
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ChatMessage, ScriptData, ChatInterfaceProps, ActionSuggestion, ExamplePrompt } from '../types/aiScriptBuilder.types';
import { AIProvider, ProviderInfo, ProviderModel } from '../types/providerAdapter.types';
import { useChatState } from '../hooks/useChatState';
import { getSuggestions, getExamplePrompts } from '../utils/scriptSuggestions';
import { ProviderSelector } from './ProviderSelector';
import { ModelSelector } from './ModelSelector';
import { getIPCBridge } from '../services/ipcBridgeService';
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
  onRecordCoordinate: (question: string) => void;
}

const ClarificationQuestions: React.FC<ClarificationQuestionsProps> = ({
  questions,
  onAnswerSelect,
  onRecordCoordinate,
}) => {
  if (!questions || questions.length === 0) {
    return null;
  }

  const filteredQuestions = questions.filter((q) => {
    const lower = q.toLowerCase();
    return !(
      lower.includes('operating system') ||
      lower.includes('are you running this on') ||
      (lower.includes('windows') && lower.includes('mac') && lower.includes('linux'))
    );
  });

  if (filteredQuestions.length === 0) {
    return null;
  }

  const isCoordinateQuestion = (q: string) => {
    const lower = q.toLowerCase();
    const mentionsXY =
      (lower.includes('x') && lower.includes('y')) ||
      lower.includes('(x') ||
      lower.includes('x,') ||
      lower.includes('x=') ||
      lower.includes('y=');

    const coordinateKeywords = [
      'coordinate',
      'coordinates',
      'position',
      'location',
      'where',
      'tọa độ',
      'toạ độ',
      'toa do',
      'vị trí',
      'vi tri',
      'ở đâu',
      'o dau',
      'chỗ nào',
      'cho nao',
      'điểm',
      'diem',
      'point',
    ];

    const targetElementKeywords = [
      'username',
      'password',
      'login',
      'sign in',
      'email',
      'user name',
      'nút',
      'nut',
      'ô',
      'o ',
      'textbox',
      'field',
      'button',
    ];

    const hasCoordinateKeyword = coordinateKeywords.some((k) => lower.includes(k));
    const hasTargetElement = targetElementKeywords.some((k) => lower.includes(k));

    return mentionsXY || hasCoordinateKeyword || (hasTargetElement && (lower.includes('tọa') || lower.includes('vị trí') || lower.includes('where')));
  };

  return (
    <div className="chat-clarification" data-testid="clarification-questions">
      <div className="chat-clarification-header">AI cần thêm thông tin:</div>
      {filteredQuestions.map((question, index) => (
        <div key={index} className="chat-clarification-row">
          <button
            className="chat-clarification-item"
            onClick={() => onAnswerSelect(question)}
            data-testid={`clarification-${index}`}
          >
            {question}
          </button>
          {isCoordinateQuestion(question) && (
            <button
              type="button"
              className="chat-clarification-record"
              onClick={() => onRecordCoordinate(question)}
              data-testid={`clarification-record-${index}`}
            >
              Record
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

type CoordinatePickState =
  | { open: false }
  | { open: true; question: string; screenshot: string; loading: boolean; error: string | null };


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
  targetOS,
  providers = [],
  activeProvider = null,
  onProviderSelect,
  onConfigureProvider,
  models = [],
  activeModel = null,
  onModelSelect,
  providerLoading = false,
}) => {
  const ipcBridge = getIPCBridge();
  const {
    messages,
    inputValue,
    isLoading,
    error,
    setInputValue,
    sendMessage,
    clearError,
  } = useChatState({ onScriptGenerated, activeProvider, targetOS });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // State for suggestions dropdown visibility
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [coordinatePick, setCoordinatePick] = useState<CoordinatePickState>({ open: false });

  // Get example prompts (Requirements: 5.1)
  const examplePrompts = useMemo(() => getExamplePrompts(), []);

  // Get suggestions based on current input (Requirements: 5.2)
  const suggestions = useMemo(() => getSuggestions(inputValue), [inputValue]);

  const extractQuestionsFromText = (text: string): string[] => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const qLines = lines.filter((l) => l.includes('?'));
    if (qLines.length > 0) return qLines;

    const numbered = lines.filter((l) => /^\d+\./.test(l));
    if (numbered.length > 0) return numbered;

    const dashed = lines.filter((l) => /^[-*]\s+/.test(l));
    if (dashed.length > 0) return dashed;

    const sentenceMatches = text.match(/[^?]+\?/g);
    if (sentenceMatches && sentenceMatches.length > 0) {
      return sentenceMatches.map((s) => s.trim()).filter(Boolean);
    }

    const lower = text.toLowerCase();
    const fallbackKeywords = [
      'tọa độ',
      'toạ độ',
      'toa do',
      'vị trí',
      'vi tri',
      'ở đâu',
      'o dau',
      'chỗ nào',
      'cho nao',
      'coordinate',
      'coordinates',
      'position',
      'location',
      '(x',
      'x=',
      'y=',
      'username',
      'password',
      'login',
      'sign in',
      'email',
      'button',
      'field',
      'textbox',
      'nút',
      'nut',
    ];

    if (fallbackKeywords.some((k) => lower.includes(k))) {
      const roughSentences = text
        .split(/[\n.!]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const candidates = roughSentences.filter((s) =>
        fallbackKeywords.some((k) => s.toLowerCase().includes(k))
      );
      return candidates.length > 0 ? candidates : [text.trim()];
    }

    return [];
  };

  const clarificationQuestions = useMemo(() => {
    const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistantMessage) return [];
    if (lastAssistantMessage.clarificationQuestions && lastAssistantMessage.clarificationQuestions.length > 0) {
      return lastAssistantMessage.clarificationQuestions;
    }
    return extractQuestionsFromText(lastAssistantMessage.content);
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

  const normalizeScreenshotSrc = (raw: string) => {
    if (!raw) return '';
    if (raw.startsWith('data:image')) return raw;
    return `data:image/png;base64,${raw}`;
  };

  const handleRecordCoordinate = useCallback(async (question: string) => {
    try {
      setCoordinatePick({ open: true, question, screenshot: '', loading: true, error: null });
      const screenshot = await ipcBridge.captureScreenshot();
      setCoordinatePick({
        open: true,
        question,
        screenshot,
        loading: false,
        error: null,
      });
    } catch (e) {
      setCoordinatePick({
        open: true,
        question,
        screenshot: '',
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to capture screenshot',
      });
    }
  }, [ipcBridge]);

  const closeCoordinatePick = () => setCoordinatePick({ open: false });

  const handleCoordinateClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!coordinatePick.open || coordinatePick.loading) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const naturalWidth = img.naturalWidth || rect.width;
    const naturalHeight = img.naturalHeight || rect.height;
    const scaleX = naturalWidth / rect.width;
    const scaleY = naturalHeight / rect.height;

    const x = Math.round(clickX * scaleX);
    const y = Math.round(clickY * scaleY);

    const q = coordinatePick.question;
    closeCoordinatePick();

    const lower = q.toLowerCase();
    let label = 'Coordinates';
    if (lower.includes('username')) label = 'Username field';
    else if (lower.includes('password')) label = 'Password field';
    else if (lower.includes('login')) label = 'Login button';

    await sendMessage(`${label}: x=${x}, y=${y}`);
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
              onRecordCoordinate={handleRecordCoordinate}
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

      {coordinatePick.open && (
        <div className="coordinate-picker-overlay" onClick={closeCoordinatePick}>
          <div className="coordinate-picker-content" onClick={(ev) => ev.stopPropagation()}>
            <div className="coordinate-picker-header">
              <div className="coordinate-picker-title">Pick coordinates</div>
              <button className="coordinate-picker-close" onClick={closeCoordinatePick} aria-label="Close">
                ×
              </button>
            </div>
            <div className="coordinate-picker-body">
              <div className="coordinate-picker-question">{coordinatePick.question}</div>
              {coordinatePick.error && (
                <div className="coordinate-picker-error">{coordinatePick.error}</div>
              )}
              {coordinatePick.loading ? (
                <div className="coordinate-picker-loading">Capturing screenshot…</div>
              ) : coordinatePick.screenshot ? (
                <img
                  className="coordinate-picker-image"
                  src={normalizeScreenshotSrc(coordinatePick.screenshot)}
                  onClick={handleCoordinateClick}
                  alt="Screenshot"
                />
              ) : (
                <div className="coordinate-picker-loading">No screenshot</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatInterface;
