/**
 * AI Script Builder Screen
 * 
 * Main screen for AI-powered automation script generation.
 * Integrates Chat Interface and Script Preview components.
 * Supports multiple AI providers through the Unified AI Service.
 * 
 * Requirements: 1.3, 1.5, 2.1, 2.2, 4.1, 4.2, 4.3, 4.5, 6.5
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AIChatInterface } from '../components/AIChatInterface';
import { ScriptPreview } from '../components/ScriptPreview';
import { ScriptNameDialog } from '../components/ScriptNameDialog';
import { ProviderSettings } from '../components/ProviderSettings';
import { UsageStatistics } from '../components/UsageStatistics';
import { unifiedAIService } from '../services/unifiedAIService';
import { providerManager } from '../services/providerManager';
import { validateScript } from '../services/scriptValidationService';
import { scriptStorageService } from '../services/scriptStorageService';
import { ScriptData, ValidationResult } from '../types/aiScriptBuilder.types';
import { AIProvider, ProviderInfo, ProviderModel, SessionStatistics } from '../types/providerAdapter.types';
import './AIScriptBuilderScreen.css';

/**
 * Provider error information for display
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */
interface ProviderErrorInfo {
  message: string;
  type: 'rate_limit' | 'network_error' | 'auth_error' | 'unknown';
  retryable: boolean;
  alternatives?: AIProvider[];
  waitTime?: number; // For rate limit errors
}

/**
 * Get user-friendly error message based on error type
 * Requirements: 4.1, 4.2, 4.3
 */
const getErrorMessage = (error: ProviderErrorInfo): string => {
  switch (error.type) {
    case 'rate_limit':
      return error.waitTime
        ? `Đã vượt quá giới hạn request. Vui lòng đợi ${error.waitTime} giây hoặc chuyển sang provider khác.`
        : 'Đã vượt quá giới hạn request. Vui lòng thử lại sau hoặc chuyển sang provider khác.';
    case 'network_error':
      return 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet và thử lại.';
    case 'auth_error':
      return 'API key không hợp lệ hoặc đã hết hạn. Vui lòng cập nhật API key trong Provider Settings.';
    default:
      return error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }
};

/**
 * Get error icon based on error type
 */
const getErrorIcon = (type: ProviderErrorInfo['type']): string => {
  switch (type) {
    case 'rate_limit':
      return '⏱️';
    case 'network_error':
      return '🌐';
    case 'auth_error':
      return '🔑';
    default:
      return '⚠️';
  }
};

/**
 * AI Script Builder Screen Component
 * 
 * Requirements: 1.3, 1.5, 2.1, 2.2, 4.1, 4.2, 4.3, 4.5
 */
const AIScriptBuilderScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State for provider configuration
  const [providersConfigured, setProvidersConfigured] = useState<boolean>(false);
  const [checkingProviders, setCheckingProviders] = useState<boolean>(true);
  const [showProviderSettings, setShowProviderSettings] = useState<boolean>(false);
  const [initialExpandedProvider, setInitialExpandedProvider] = useState<AIProvider | undefined>(undefined);

  // State for provider/model selection - Requirements: 2.1, 2.2
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([]);
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null);
  const [availableModels, setAvailableModels] = useState<ProviderModel[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState<boolean>(false);

  // State for error handling - Requirements: 4.1, 4.2, 4.3, 4.5
  const [providerError, setProviderError] = useState<ProviderErrorInfo | null>(null);

  // State for session statistics - Requirements: 6.4
  const [sessionStats, setSessionStats] = useState<SessionStatistics>({
    totalRequests: 0,
    requestsByProvider: new Map(),
    successRate: 0,
    averageResponseTime: 0,
  });

  // State for generated script
  const [generatedScript, setGeneratedScript] = useState<ScriptData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    valid: true,
    errors: [],
    warnings: [],
  });

  // State for script save dialog
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
  const [savingScript, setSavingScript] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Initialize unified AI service and check provider configuration
   * Requirements: 1.3, 2.1, 2.2, 2.3
   */
  useEffect(() => {
    const initializeService = async () => {
      if (!user?.uid) {
        setCheckingProviders(false);
        return;
      }

      try {
        // Initialize the unified AI service
        await unifiedAIService.initialize(user.uid);

        // Get available providers and their status
        const providers = unifiedAIService.getAvailableProviders();
        setAvailableProviders(providers);

        // Check if any providers are configured
        const configuredProviders = unifiedAIService.getConfiguredProviders();
        setProvidersConfigured(configuredProviders.length > 0);

        // Get active provider (may be auto-selected if only one configured)
        const currentProvider = unifiedAIService.getActiveProvider();
        setActiveProvider(currentProvider);

        // Get available models for active provider
        if (currentProvider) {
          const models = unifiedAIService.getAvailableModels();
          setAvailableModels(models);
          setActiveModel(unifiedAIService.getActiveModel());
        }
      } catch (error) {
        console.error('Failed to initialize AI service:', error);
        setProvidersConfigured(false);
      } finally {
        setCheckingProviders(false);
      }
    };

    initializeService();
  }, [user?.uid]);

  /**
   * Handle provider selection
   * Requirements: 2.2
   */
  const handleProviderSelect = useCallback(async (providerId: AIProvider) => {
    setProviderLoading(true);
    setProviderError(null);

    try {
      await unifiedAIService.selectProvider(providerId);
      setActiveProvider(providerId);

      // Update available models for the new provider
      const models = unifiedAIService.getAvailableModels();
      setAvailableModels(models);
      setActiveModel(unifiedAIService.getActiveModel());

      // Update providers list to reflect new active state
      setAvailableProviders(unifiedAIService.getAvailableProviders());
    } catch (error) {
      console.error('Failed to select provider:', error);
      setProviderError({
        message: error instanceof Error ? error.message : 'Failed to switch provider',
        type: 'unknown',
        retryable: true,
      });
    } finally {
      setProviderLoading(false);
    }
  }, []);

  /**
   * Handle model selection
   * Requirements: 3.2
   */
  const handleModelSelect = useCallback((modelId: string) => {
    try {
      unifiedAIService.selectModel(modelId);
      setActiveModel(modelId);
    } catch (error) {
      console.error('Failed to select model:', error);
    }
  }, []);

  /**
   * Handle opening provider settings
   * Requirements: 1.5
   */
  const handleConfigureProvider = useCallback((providerId?: AIProvider) => {
    setInitialExpandedProvider(providerId);
    setShowProviderSettings(true);
  }, []);

  /**
   * Handle provider configuration change
   * Requirements: 1.2, 1.4
   */
  const handleConfigurationChange = useCallback(async (configuredProviders: AIProvider[]) => {
    setProvidersConfigured(configuredProviders.length > 0);

    // Re-initialize the service to pick up new API keys
    if (user?.uid) {
      try {
        await unifiedAIService.initialize(user.uid);
        setAvailableProviders(unifiedAIService.getAvailableProviders());

        const currentProvider = unifiedAIService.getActiveProvider();
        setActiveProvider(currentProvider);

        if (currentProvider) {
          setAvailableModels(unifiedAIService.getAvailableModels());
          setActiveModel(unifiedAIService.getActiveModel());
        }
      } catch (error) {
        console.error('Failed to re-initialize service:', error);
      }
    }
  }, [user?.uid]);

  /**
   * Handle retry after error
   * Requirements: 4.2
   */
  const handleRetry = useCallback(() => {
    setProviderError(null);
  }, []);

  /**
   * Handle switching to alternative provider after error
   * Requirements: 4.5
   */
  const handleSwitchProvider = useCallback(async (providerId: AIProvider) => {
    setProviderError(null);
    await handleProviderSelect(providerId);
  }, [handleProviderSelect]);

  /**
   * Update session statistics from provider manager
   * Requirements: 6.4
   */
  const updateSessionStats = useCallback(() => {
    const stats = providerManager.getSessionStats();
    setSessionStats(stats);
  }, []);

  /**
   * Handle script generation from chat
   * Requirements: 4.1, 6.4
   */
  const handleScriptGenerated = useCallback((script: ScriptData) => {
    setGeneratedScript(script);
    const result = validateScript(script);
    setValidationResult(result);
    // Update statistics after each request
    updateSessionStats();
  }, [updateSessionStats]);

  /**
   * Handle script edit
   * Requirements: 4.2
   */
  const handleScriptEdit = useCallback((script: ScriptData) => {
    setGeneratedScript(script);
    const result = validateScript(script);
    setValidationResult(result);
  }, []);

  /**
   * Handle script save button click - opens the naming dialog
   * Requirements: 4.3
   */
  const handleScriptSave = useCallback(async (_script: ScriptData) => {
    // Open the script naming dialog
    setSaveError(null);
    setShowSaveDialog(true);
  }, []);

  /**
   * Handle actual script save with name
   * Requirements: 4.3, 6.5
   */
  const handleSaveWithName = useCallback(async (scriptName: string) => {
    if (!generatedScript) {
      setSaveError('No script to save');
      return;
    }

    setSavingScript(true);
    setSaveError(null);

    try {
      const result = await scriptStorageService.saveScript(generatedScript, scriptName);

      if (result.success) {
        console.log('[AIScriptBuilder] Script saved successfully:', result.scriptPath);
        setShowSaveDialog(false);

        // Clear the generated script after successful save
        setGeneratedScript(null);
        setValidationResult({
          valid: true,
          errors: [],
          warnings: [],
        });

        // Show success message
        alert(`Script "${scriptName}" đã được lưu thành công!\n\nĐường dẫn: ${result.scriptPath}`);
      } else {
        setSaveError(result.error || 'Failed to save script');
      }
    } catch (error) {
      console.error('[AIScriptBuilder] Failed to save script:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save script');
    } finally {
      setSavingScript(false);
    }
  }, [generatedScript]);

  /**
   * Handle script discard
   * Requirements: 4.5
   */
  const handleScriptDiscard = useCallback(() => {
    setGeneratedScript(null);
    setValidationResult({
      valid: true,
      errors: [],
      warnings: [],
    });
  }, []);

  /**
   * Navigate back to dashboard
   */
  const handleBack = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // Show loading while checking providers
  if (checkingProviders) {
    return (
      <div className="ai-script-builder-container">
        <div className="ai-script-builder-loading">
          <div className="loading-spinner"></div>
          <p>Đang kiểm tra cấu hình...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-script-builder-container" data-testid="ai-script-builder-screen">
      {/* Header */}
      <header className="ai-script-builder-header">
        <button
          className="ai-script-builder-back-button"
          onClick={handleBack}
          aria-label="Back to dashboard"
        >
          ← Quay lại
        </button>
        <h1 className="ai-script-builder-title">AI Script Builder</h1>
        <div className="ai-script-builder-header-actions">
          {/* Usage Statistics - Requirements: 6.4 */}
          <UsageStatistics
            statistics={sessionStats}
            variant="tooltip"
            className="ai-script-builder-stats"
          />
          <button
            className="ai-script-builder-settings-button"
            onClick={() => handleConfigureProvider()}
            title="Cấu hình AI Providers"
            data-testid="provider-settings-button"
          >
            ⚙️ Provider Settings
          </button>
        </div>
      </header>

      {/* Provider Error Banner - Requirements: 4.1, 4.2, 4.3, 4.5 */}
      {providerError && (
        <div
          className={`ai-script-builder-error-banner error-type-${providerError.type}`}
          data-testid="provider-error-banner"
        >
          <div className="error-banner-content">
            <span className="error-banner-icon">{getErrorIcon(providerError.type)}</span>
            <span className="error-banner-message">{getErrorMessage(providerError)}</span>
          </div>
          <div className="error-banner-actions">
            {/* Show update API key button for auth errors - Requirements: 4.3 */}
            {providerError.type === 'auth_error' && (
              <button
                className="error-banner-settings-button"
                onClick={() => handleConfigureProvider(activeProvider || undefined)}
                data-testid="error-update-key-button"
              >
                Cập nhật API Key
              </button>
            )}
            {/* Show retry button for retryable errors - Requirements: 4.2 */}
            {providerError.retryable && providerError.type !== 'auth_error' && (
              <button
                className="error-banner-retry-button"
                onClick={handleRetry}
                data-testid="error-retry-button"
              >
                Thử lại
              </button>
            )}
            {/* Show alternative providers - Requirements: 4.5 */}
            {providerError.alternatives && providerError.alternatives.length > 0 && (
              <div className="error-banner-alternatives">
                <span className="error-alternatives-label">Chuyển sang:</span>
                {providerError.alternatives.map((providerId) => (
                  <button
                    key={providerId}
                    className="error-alternative-button"
                    onClick={() => handleSwitchProvider(providerId)}
                    data-testid={`switch-to-${providerId}`}
                  >
                    {availableProviders.find(p => p.id === providerId)?.name || providerId}
                  </button>
                ))}
              </div>
            )}
            <button
              className="error-banner-dismiss-button"
              onClick={() => setProviderError(null)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="ai-script-builder-main">
        {/* Chat Interface Panel */}
        <div className="ai-script-builder-chat-panel">
          <AIChatInterface
            onScriptGenerated={handleScriptGenerated}
            apiKeyConfigured={providersConfigured}
            providers={availableProviders}
            activeProvider={activeProvider}
            onProviderSelect={handleProviderSelect}
            onConfigureProvider={handleConfigureProvider}
            models={availableModels}
            activeModel={activeModel}
            onModelSelect={handleModelSelect}
            providerLoading={providerLoading}
          />

          {/* Show configure button if no providers configured - Requirements: 1.5 */}
          {!providersConfigured && (
            <div className="ai-script-builder-configure-prompt" data-testid="no-providers-prompt">
              <div className="configure-prompt-content">
                <span className="configure-prompt-icon">🔑</span>
                <h3 className="configure-prompt-title">Cấu hình AI Provider</h3>
                <p className="configure-prompt-description">
                  Để sử dụng AI Script Builder, bạn cần cấu hình ít nhất một AI provider.
                </p>
                <button
                  className="ai-script-builder-configure-button"
                  onClick={() => handleConfigureProvider()}
                  data-testid="configure-provider-button"
                >
                  🔧 Cấu hình Provider
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Script Preview Panel */}
        <div className="ai-script-builder-preview-panel">
          <ScriptPreview
            script={generatedScript}
            onEdit={handleScriptEdit}
            onSave={handleScriptSave}
            onDiscard={handleScriptDiscard}
            validationResult={validationResult}
          />
        </div>
      </main>

      {/* Provider Settings Modal - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5 */}
      {showProviderSettings && user?.uid && (
        <ProviderSettings
          userId={user.uid}
          onConfigurationChange={handleConfigurationChange}
          initialExpandedProvider={initialExpandedProvider}
          isModal={true}
          onClose={() => {
            setShowProviderSettings(false);
            setInitialExpandedProvider(undefined);
          }}
        />
      )}

      {/* Script Name Dialog */}
      <ScriptNameDialog
        isOpen={showSaveDialog}
        onClose={() => {
          setShowSaveDialog(false);
          setSaveError(null);
        }}
        onSave={handleSaveWithName}
        isLoading={savingScript}
        error={saveError}
      />
    </div>
  );
};

export default AIScriptBuilderScreen;
