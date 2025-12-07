/**
 * Unified AI Service
 * 
 * Central service for managing AI providers and script generation.
 * Provides a unified interface for all AI providers, handles provider
 * initialization, selection, error handling, and response attribution.
 * 
 * Requirements: 2.2, 2.3, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 6.3
 */

import {
  ScriptData,
  ConversationContext,
  GenerationResult,
} from '../types/aiScriptBuilder.types';
import {
  AIProvider,
  ProviderModel,
  ProviderInfo,
  ProviderError,
  ProviderErrorType,
  UserProviderPreferences,
  PROVIDER_CONFIGS,
  SUPPORTED_PROVIDERS,
} from '../types/providerAdapter.types';
import { providerManager, IProviderManager } from './providerManager';
import { apiKeyService } from './apiKeyService';
import { userPreferencesService } from './userPreferencesService';
import { GeminiAdapter } from './providers/geminiAdapter';
import { OpenAIAdapter } from './providers/openaiAdapter';
import { AnthropicAdapter } from './providers/anthropicAdapter';

// ============================================================================
// Types
// ============================================================================

/**
 * Fallback action when a provider fails
 * Requirements: 4.5
 */
export interface FallbackAction {
  action: 'show_error' | 'suggest_alternative';
  error?: ProviderError;
  alternatives?: AIProvider[];
  originalError?: ProviderError;
}

/**
 * Error log entry for debugging
 * Requirements: 4.4
 */
export interface ErrorLogEntry {
  timestamp: Date;
  providerId: AIProvider;
  errorType: ProviderErrorType;
  message: string;
  context?: string;
}

/**
 * Extended generation result with provider attribution
 * Requirements: 6.3
 */
export interface UnifiedGenerationResult extends GenerationResult {
  providerId?: AIProvider;
  modelId?: string;
  processingTimeMs?: number;
  fallbackSuggestions?: AIProvider[];
}

// ============================================================================
// Unified AI Service Interface
// ============================================================================

export interface IUnifiedAIService {
  // Initialization
  initialize(userId: string): Promise<void>;
  isInitialized(): boolean;
  
  // Provider selection
  selectProvider(providerId: AIProvider): Promise<void>;
  selectModel(modelId: string): void;
  
  // Script generation (delegates to active provider)
  generateScript(
    prompt: string,
    context: ConversationContext
  ): Promise<UnifiedGenerationResult>;
  
  refineScript(
    currentScript: ScriptData,
    feedback: string
  ): Promise<UnifiedGenerationResult>;
  
  // Status
  getActiveProvider(): AIProvider | null;
  getActiveModel(): string | null;
  getAvailableProviders(): ProviderInfo[];
  getAvailableModels(): ProviderModel[];
  getConfiguredProviders(): AIProvider[];
  
  // Error handling
  getErrorLog(): ErrorLogEntry[];
  clearErrorLog(): void;
  
  // Preferences
  getUserPreferences(): UserProviderPreferences;
  setUserPreferences(preferences: Partial<UserProviderPreferences>): void;
}

// ============================================================================
// Unified AI Service Implementation
// ============================================================================

/**
 * Unified AI Service
 * 
 * Central service that manages all AI providers and provides a unified
 * interface for script generation.
 * 
 * Requirements: 2.2, 2.3, 3.2, 4.1-4.5, 5.2, 6.3
 */
/**
 * Storage key for model preferences persistence
 * Requirements: 3.5
 */
const MODEL_PREFERENCES_STORAGE_KEY = 'geniusqa_model_preferences';

export class UnifiedAIService implements IUnifiedAIService {
  private manager: IProviderManager;
  private userId: string | null = null;
  private initialized: boolean = false;
  private configuredProviders: AIProvider[] = [];
  private errorLog: ErrorLogEntry[] = [];
  private userPreferences: UserProviderPreferences = {
    defaultProvider: null,
    modelPreferences: {} as Record<AIProvider, string>,
    lastUsedProvider: null,
  };

  constructor(manager?: IProviderManager) {
    this.manager = manager || providerManager;
    // Load persisted preferences on construction
    this.loadPersistedPreferences();
  }

  /**
   * Load persisted model preferences from localStorage (fallback)
   * Requirements: 3.5
   */
  private loadPersistedPreferences(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(MODEL_PREFERENCES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            this.userPreferences = {
              ...this.userPreferences,
              ...parsed,
              modelPreferences: {
                ...this.userPreferences.modelPreferences,
                ...(parsed.modelPreferences || {}),
              },
            };
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted model preferences:', error);
    }
  }

  /**
   * Load user preferences from Firebase
   * Requirements: 8.3
   */
  private async loadFirebasePreferences(): Promise<void> {
    if (!this.userId) return;

    try {
      const firebasePrefs = await userPreferencesService.getUserPreferences(this.userId);
      if (firebasePrefs) {
        this.userPreferences = {
          defaultProvider: firebasePrefs.defaultProvider,
          modelPreferences: (firebasePrefs.modelPreferences || {}) as Record<AIProvider, string>,
          lastUsedProvider: firebasePrefs.lastUsedProvider,
        };
        // Also update localStorage as cache
        this.persistPreferencesToLocalStorage();
      }
    } catch (error) {
      console.warn('Failed to load preferences from Firebase, using local cache:', error);
    }
  }

  /**
   * Persist model preferences to localStorage (local cache)
   * Requirements: 3.5
   */
  private persistPreferencesToLocalStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          MODEL_PREFERENCES_STORAGE_KEY,
          JSON.stringify(this.userPreferences)
        );
      }
    } catch (error) {
      console.warn('Failed to persist model preferences to localStorage:', error);
    }
  }

  /**
   * Persist model preferences to both localStorage and Firebase
   * Requirements: 3.5, 8.4
   */
  private persistPreferences(): void {
    // Always persist to localStorage for quick access
    this.persistPreferencesToLocalStorage();
    
    // Also persist to Firebase if user is logged in
    if (this.userId) {
      userPreferencesService.storeUserPreferences(this.userId, {
        defaultProvider: this.userPreferences.defaultProvider,
        modelPreferences: this.userPreferences.modelPreferences,
        lastUsedProvider: this.userPreferences.lastUsedProvider,
      }).catch(error => {
        console.warn('Failed to persist preferences to Firebase:', error);
      });
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the service with user's API keys
   * Requirements: 2.2, 2.3, 8.3
   */
  async initialize(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    this.userId = userId;
    
    // Reset manager state
    this.manager.reset();
    
    // Register all adapters
    this.registerAdapters();
    
    // Load user preferences from Firebase (overrides localStorage cache)
    await this.loadFirebasePreferences();
    
    // Load API keys and initialize adapters
    await this.loadApiKeys();
    
    // Auto-select provider if only one is configured
    this.autoSelectProvider();
    
    this.initialized = true;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Register all provider adapters with the manager
   */
  private registerAdapters(): void {
    this.manager.registerAdapter(new GeminiAdapter());
    this.manager.registerAdapter(new OpenAIAdapter());
    this.manager.registerAdapter(new AnthropicAdapter());
    // Azure adapter would be registered here when implemented
  }

  /**
   * Load API keys from Firebase and initialize adapters
   */
  private async loadApiKeys(): Promise<void> {
    if (!this.userId) return;

    this.configuredProviders = [];

    for (const providerId of SUPPORTED_PROVIDERS) {
      try {
        const apiKey = await apiKeyService.getApiKey(this.userId, providerId);
        
        if (apiKey) {
          const adapter = this.manager.getAdapter(providerId);
          if (adapter) {
            await adapter.initialize(apiKey);
            this.configuredProviders.push(providerId);
            
            // Apply saved model preference if exists
            const preferredModel = this.userPreferences.modelPreferences[providerId];
            if (preferredModel) {
              try {
                adapter.setModel(preferredModel);
              } catch {
                // Use default model if preferred model is invalid
              }
            }
          }
        }
      } catch (error) {
        this.logError(providerId, 'auth_error', `Failed to load API key: ${error}`);
      }
    }
  }

  /**
   * Auto-select provider when only one is configured
   * Requirements: 2.3
   */
  private autoSelectProvider(): void {
    if (this.configuredProviders.length === 1) {
      // Auto-select the only configured provider
      try {
        this.manager.setActiveProvider(this.configuredProviders[0]);
      } catch {
        // Ignore errors during auto-selection
      }
    } else if (this.configuredProviders.length > 1) {
      // Try to use user's default or last used provider
      const preferredProvider = 
        this.userPreferences.defaultProvider || 
        this.userPreferences.lastUsedProvider;
      
      if (preferredProvider && this.configuredProviders.includes(preferredProvider)) {
        try {
          this.manager.setActiveProvider(preferredProvider);
        } catch {
          // Ignore errors, user will need to select manually
        }
      }
    }
  }

  // ============================================================================
  // Provider Selection
  // ============================================================================

  /**
   * Select a provider for script generation
   * Requirements: 2.2, 3.5
   */
  async selectProvider(providerId: AIProvider): Promise<void> {
    if (!this.initialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    if (!this.configuredProviders.includes(providerId)) {
      throw new Error(`Provider '${providerId}' is not configured. Please add an API key first.`);
    }

    this.manager.setActiveProvider(providerId);
    
    // Update last used provider and persist
    this.userPreferences.lastUsedProvider = providerId;
    this.persistPreferences();
    
    // Load saved model preference for this provider
    // Requirements: 3.5
    const savedModel = this.userPreferences.modelPreferences[providerId];
    if (savedModel) {
      try {
        this.manager.setActiveModel(savedModel);
      } catch {
        // If saved model is invalid, use default model
        const adapter = this.manager.getAdapter(providerId);
        if (adapter) {
          const defaultModel = adapter.getDefaultModel();
          this.manager.setActiveModel(defaultModel);
        }
      }
    }
  }

  /**
   * Select a model for the active provider
   * Requirements: 3.2
   */
  selectModel(modelId: string): void {
    if (!this.initialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const activeProvider = this.manager.getActiveProvider();
    if (!activeProvider) {
      throw new Error('No active provider. Please select a provider first.');
    }

    this.manager.setActiveModel(modelId);
    
    // Save model preference and persist to storage
    // Requirements: 3.5
    this.userPreferences.modelPreferences[activeProvider] = modelId;
    this.persistPreferences();
  }

  // ============================================================================
  // Script Generation
  // ============================================================================

  /**
   * Generate a script from a user prompt
   * Requirements: 2.2, 3.2, 5.2, 6.3
   */
  async generateScript(
    prompt: string,
    context: ConversationContext
  ): Promise<UnifiedGenerationResult> {
    if (!this.initialized) {
      return {
        success: false,
        message: 'Service not initialized. Please initialize with a user ID first.',
      };
    }

    const adapter = this.manager.getActiveAdapter();
    if (!adapter) {
      return {
        success: false,
        message: 'No active provider. Please select a provider first.',
        fallbackSuggestions: this.configuredProviders,
      };
    }

    const startTime = Date.now();

    try {
      // Increment request count before making the request
      this.manager.incrementRequestCount(adapter.providerId);

      const response = await adapter.generateScript(prompt, context);
      const processingTimeMs = Date.now() - startTime;

      // Record result for statistics
      this.manager.recordRequestResult(
        adapter.providerId,
        response.success,
        processingTimeMs
      );

      if (!response.success) {
        // Handle error and suggest alternatives
        const error = this.createProviderError(adapter.providerId, response.message);
        this.logError(adapter.providerId, error.type, response.message);
        
        const fallback = this.handleProviderFailure(error);
        
        return {
          success: false,
          message: response.message,
          providerId: adapter.providerId,
          modelId: adapter.getCurrentModel(),
          processingTimeMs,
          fallbackSuggestions: fallback.alternatives,
        };
      }

      // Return successful result with attribution
      return {
        success: true,
        script: response.script,
        message: response.message,
        needsClarification: response.needsClarification,
        clarificationQuestions: response.clarificationQuestions,
        providerId: response.metadata.providerId,
        modelId: response.metadata.modelId,
        processingTimeMs: response.metadata.processingTimeMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const providerError = this.createProviderError(adapter.providerId, errorMessage);
      
      this.logError(adapter.providerId, providerError.type, errorMessage);
      this.manager.setProviderError(adapter.providerId, providerError);

      const fallback = this.handleProviderFailure(providerError);

      return {
        success: false,
        message: errorMessage,
        providerId: adapter.providerId,
        modelId: adapter.getCurrentModel(),
        processingTimeMs: Date.now() - startTime,
        fallbackSuggestions: fallback.alternatives,
      };
    }
  }

  /**
   * Refine an existing script based on user feedback
   * Requirements: 3.2, 5.2, 6.3
   */
  async refineScript(
    currentScript: ScriptData,
    feedback: string
  ): Promise<UnifiedGenerationResult> {
    if (!this.initialized) {
      return {
        success: false,
        message: 'Service not initialized. Please initialize with a user ID first.',
      };
    }

    const adapter = this.manager.getActiveAdapter();
    if (!adapter) {
      return {
        success: false,
        message: 'No active provider. Please select a provider first.',
        fallbackSuggestions: this.configuredProviders,
      };
    }

    const startTime = Date.now();

    try {
      this.manager.incrementRequestCount(adapter.providerId);

      const response = await adapter.refineScript(currentScript, feedback);
      const processingTimeMs = Date.now() - startTime;

      this.manager.recordRequestResult(
        adapter.providerId,
        response.success,
        processingTimeMs
      );

      if (!response.success) {
        const error = this.createProviderError(adapter.providerId, response.message);
        this.logError(adapter.providerId, error.type, response.message);
        
        const fallback = this.handleProviderFailure(error);
        
        return {
          success: false,
          message: response.message,
          providerId: adapter.providerId,
          modelId: adapter.getCurrentModel(),
          processingTimeMs,
          fallbackSuggestions: fallback.alternatives,
        };
      }

      return {
        success: true,
        script: response.script,
        message: response.message,
        needsClarification: response.needsClarification,
        clarificationQuestions: response.clarificationQuestions,
        providerId: response.metadata.providerId,
        modelId: response.metadata.modelId,
        processingTimeMs: response.metadata.processingTimeMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const providerError = this.createProviderError(adapter.providerId, errorMessage);
      
      this.logError(adapter.providerId, providerError.type, errorMessage);
      this.manager.setProviderError(adapter.providerId, providerError);

      const fallback = this.handleProviderFailure(providerError);

      return {
        success: false,
        message: errorMessage,
        providerId: adapter.providerId,
        modelId: adapter.getCurrentModel(),
        processingTimeMs: Date.now() - startTime,
        fallbackSuggestions: fallback.alternatives,
      };
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  /**
   * Create a ProviderError from an error message
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  private createProviderError(providerId: AIProvider, message: string): ProviderError {
    const errorType = this.detectErrorType(message);
    
    return {
      type: errorType,
      message,
      providerId,
      timestamp: new Date(),
      retryable: this.isRetryableError(errorType),
      suggestAlternative: this.shouldSuggestAlternative(errorType),
    };
  }

  /**
   * Detect error type from error message
   * Requirements: 4.1, 4.2, 4.3
   */
  private detectErrorType(message: string): ProviderErrorType {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('429') || lowerMessage.includes('too many requests')) {
      return 'rate_limit';
    }
    
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection') || lowerMessage.includes('timeout')) {
      return 'network_error';
    }
    
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('401') || lowerMessage.includes('invalid api key') || lowerMessage.includes('authentication')) {
      return 'auth_error';
    }
    
    if (lowerMessage.includes('content') && (lowerMessage.includes('filter') || lowerMessage.includes('blocked') || lowerMessage.includes('safety'))) {
      return 'content_filtered';
    }
    
    if (lowerMessage.includes('quota') || lowerMessage.includes('exceeded') || lowerMessage.includes('limit reached')) {
      return 'quota_exceeded';
    }
    
    if (lowerMessage.includes('invalid') || lowerMessage.includes('parse') || lowerMessage.includes('format')) {
      return 'invalid_response';
    }
    
    return 'unknown';
  }

  /**
   * Check if an error type is retryable
   */
  private isRetryableError(errorType: ProviderErrorType): boolean {
    return ['rate_limit', 'network_error', 'invalid_response'].includes(errorType);
  }

  /**
   * Check if we should suggest alternative providers
   */
  private shouldSuggestAlternative(errorType: ProviderErrorType): boolean {
    return ['rate_limit', 'auth_error', 'quota_exceeded', 'network_error'].includes(errorType);
  }

  /**
   * Handle provider failure and suggest alternatives
   * Requirements: 4.5
   */
  handleProviderFailure(error: ProviderError): FallbackAction {
    if (!error.suggestAlternative || this.configuredProviders.length <= 1) {
      return { action: 'show_error', error };
    }

    const alternatives = this.configuredProviders.filter(
      p => p !== error.providerId
    );

    if (alternatives.length === 0) {
      return { action: 'show_error', error };
    }

    return {
      action: 'suggest_alternative',
      alternatives,
      originalError: error,
    };
  }

  /**
   * Log an error for debugging
   * Requirements: 4.4
   */
  logError(providerId: AIProvider, errorType: ProviderErrorType, message: string, context?: string): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      providerId,
      errorType,
      message,
      context,
    };
    
    this.errorLog.push(entry);
    
    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }
    
    // Also log to console for debugging
    console.error(`[UnifiedAIService] Error from ${providerId}: [${errorType}] ${message}`);
  }

  /**
   * Get the error log
   */
  getErrorLog(): ErrorLogEntry[] {
    return [...this.errorLog];
  }

  /**
   * Clear the error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  // ============================================================================
  // Status Methods
  // ============================================================================

  /**
   * Get the currently active provider
   */
  getActiveProvider(): AIProvider | null {
    return this.manager.getActiveProvider();
  }

  /**
   * Get the currently active model
   */
  getActiveModel(): string | null {
    return this.manager.getActiveModel();
  }

  /**
   * Get list of configured providers
   */
  getConfiguredProviders(): AIProvider[] {
    return [...this.configuredProviders];
  }

  /**
   * Get information about all available providers
   * Requirements: 2.1
   */
  getAvailableProviders(): ProviderInfo[] {
    return SUPPORTED_PROVIDERS.map(providerId => {
      const config = PROVIDER_CONFIGS[providerId];
      const status = this.manager.getProviderStatus(providerId);
      const isConfigured = this.configuredProviders.includes(providerId);
      
      let providerStatus: 'ready' | 'error' | 'unconfigured' = 'unconfigured';
      if (isConfigured) {
        providerStatus = status.lastError ? 'error' : 'ready';
      }

      return {
        id: providerId,
        name: config.name,
        description: config.description,
        configured: isConfigured,
        status: providerStatus,
        models: config.models,
      };
    });
  }

  /**
   * Get available models for the active provider
   * Requirements: 3.1
   */
  getAvailableModels(): ProviderModel[] {
    const adapter = this.manager.getActiveAdapter();
    if (!adapter) {
      return [];
    }
    return adapter.getAvailableModels();
  }

  // ============================================================================
  // Preferences
  // ============================================================================

  /**
   * Get user preferences
   */
  getUserPreferences(): UserProviderPreferences {
    return { ...this.userPreferences };
  }

  /**
   * Set user preferences
   * Requirements: 3.5
   */
  setUserPreferences(preferences: Partial<UserProviderPreferences>): void {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences,
    };
    // Persist preferences to storage
    this.persistPreferences();
  }

  // ============================================================================
  // Reset
  // ============================================================================

  /**
   * Reset the service state
   */
  reset(): void {
    this.manager.reset();
    this.userId = null;
    this.initialized = false;
    this.configuredProviders = [];
    this.errorLog = [];
    this.userPreferences = {
      defaultProvider: null,
      modelPreferences: {} as Record<AIProvider, string>,
      lastUsedProvider: null,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of the Unified AI Service
 */
export const unifiedAIService = new UnifiedAIService();

export default unifiedAIService;
