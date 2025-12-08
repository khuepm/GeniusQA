/**
 * Provider Manager Service
 * 
 * Manages AI provider adapters, handles provider selection,
 * tracks provider status, and maintains session statistics.
 * Supports custom models alongside pre-configured providers.
 * 
 * Requirements: 2.2, 6.1, 6.4, 11.5, 11.6
 */

import {
  AIProvider,
  AIProviderAdapter,
  ProviderStatus,
  ProviderError,
  SessionStatistics,
  SUPPORTED_PROVIDERS,
  CustomModelConfig,
  ProviderModel,
} from '../types/providerAdapter.types';

// ============================================================================
// Provider Manager Interface
// ============================================================================

/**
 * Interface for the Provider Manager
 * Requirements: 2.2, 6.1, 11.5, 11.6
 */
export interface IProviderManager {
  // Provider registration
  registerAdapter(adapter: AIProviderAdapter): void;
  getAdapter(providerId: AIProvider): AIProviderAdapter | null;
  
  // Active provider management
  setActiveProvider(providerId: AIProvider): void;
  getActiveProvider(): AIProvider | null;
  getActiveAdapter(): AIProviderAdapter | null;
  
  // Configuration status
  getConfiguredProviders(): AIProvider[];
  getProviderStatus(providerId: AIProvider): ProviderStatus;
  getAllProviderStatuses(): Map<AIProvider, ProviderStatus>;
  
  // Model management
  setActiveModel(modelId: string, isCustomModel?: boolean): void;
  getActiveModel(): string | null;
  
  // Custom model management
  setCustomModels(models: CustomModelConfig[]): void;
  getCustomModels(): CustomModelConfig[];
  getActiveCustomModel(): CustomModelConfig | null;
  isUsingCustomModel(): boolean;
  getAllAvailableModels(): ProviderModel[];
  
  // Statistics
  getSessionStats(): SessionStatistics;
  incrementRequestCount(providerId: AIProvider): void;
  recordRequestResult(providerId: AIProvider, success: boolean, responseTimeMs: number): void;
  
  // Error tracking
  setProviderError(providerId: AIProvider, error: ProviderError): void;
  clearProviderError(providerId: AIProvider): void;
  
  // Reset
  reset(): void;
}


// ============================================================================
// Provider Manager Implementation
// ============================================================================

/**
 * Provider Manager
 * 
 * Central service for managing AI provider adapters.
 * Handles registration, selection, status tracking, and statistics.
 * Supports custom models alongside pre-configured providers.
 * 
 * Requirements: 2.2, 6.1, 6.4, 11.5, 11.6
 */
export class ProviderManager implements IProviderManager {
  // Registered adapters
  private adapters: Map<AIProvider, AIProviderAdapter> = new Map();
  
  // Active provider tracking
  private activeProviderId: AIProvider | null = null;
  
  // Provider status tracking
  private providerStatuses: Map<AIProvider, ProviderStatus> = new Map();
  
  // Session statistics
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private totalResponseTime: number = 0;
  private requestsByProvider: Map<AIProvider, number> = new Map();

  // Custom model management
  private customModels: CustomModelConfig[] = [];
  private activeCustomModelId: string | null = null;
  private usingCustomModel: boolean = false;

  constructor() {
    // Initialize status for all supported providers
    this.initializeProviderStatuses();
  }

  /**
   * Initialize status tracking for all supported providers
   */
  private initializeProviderStatuses(): void {
    for (const providerId of SUPPORTED_PROVIDERS) {
      this.providerStatuses.set(providerId, {
        providerId,
        configured: false,
        active: false,
        requestCount: 0,
      });
      this.requestsByProvider.set(providerId, 0);
    }
  }

  // ============================================================================
  // Provider Registration
  // ============================================================================

  /**
   * Register a provider adapter
   * Requirements: 2.2
   */
  registerAdapter(adapter: AIProviderAdapter): void {
    if (!adapter || !adapter.providerId) {
      throw new Error('Invalid adapter: adapter must have a providerId');
    }

    this.adapters.set(adapter.providerId, adapter);
    
    // Update status to reflect registration
    const status = this.providerStatuses.get(adapter.providerId);
    if (status) {
      status.configured = adapter.isInitialized();
      this.providerStatuses.set(adapter.providerId, status);
    }
  }

  /**
   * Get a registered adapter by provider ID
   */
  getAdapter(providerId: AIProvider): AIProviderAdapter | null {
    return this.adapters.get(providerId) || null;
  }

  // ============================================================================
  // Active Provider Management
  // ============================================================================

  /**
   * Set the active provider for script generation
   * Requirements: 2.2
   */
  setActiveProvider(providerId: AIProvider): void {
    const adapter = this.adapters.get(providerId);
    
    if (!adapter) {
      throw new Error(`Provider '${providerId}' is not registered`);
    }

    if (!adapter.isInitialized()) {
      throw new Error(`Provider '${providerId}' is not initialized. Please configure the API key first.`);
    }

    // Deactivate previous provider
    if (this.activeProviderId) {
      const prevStatus = this.providerStatuses.get(this.activeProviderId);
      if (prevStatus) {
        prevStatus.active = false;
        this.providerStatuses.set(this.activeProviderId, prevStatus);
      }
    }

    // Activate new provider
    this.activeProviderId = providerId;
    
    const status = this.providerStatuses.get(providerId);
    if (status) {
      status.active = true;
      this.providerStatuses.set(providerId, status);
    }
  }

  /**
   * Get the currently active provider ID
   */
  getActiveProvider(): AIProvider | null {
    return this.activeProviderId;
  }

  /**
   * Get the currently active adapter
   */
  getActiveAdapter(): AIProviderAdapter | null {
    if (!this.activeProviderId) {
      return null;
    }
    return this.adapters.get(this.activeProviderId) || null;
  }

  // ============================================================================
  // Configuration Status
  // ============================================================================

  /**
   * Get list of configured (initialized) providers
   * Requirements: 6.1
   */
  getConfiguredProviders(): AIProvider[] {
    const configured: AIProvider[] = [];
    
    for (const [providerId, adapter] of this.adapters) {
      if (adapter.isInitialized()) {
        configured.push(providerId);
      }
    }
    
    return configured;
  }

  /**
   * Get status for a specific provider
   * Requirements: 6.1
   */
  getProviderStatus(providerId: AIProvider): ProviderStatus {
    const status = this.providerStatuses.get(providerId);
    
    if (!status) {
      return {
        providerId,
        configured: false,
        active: false,
        requestCount: 0,
      };
    }

    // Update configured status based on adapter state
    const adapter = this.adapters.get(providerId);
    if (adapter) {
      status.configured = adapter.isInitialized();
    }

    return { ...status };
  }

  /**
   * Get status for all providers
   * Requirements: 6.1
   */
  getAllProviderStatuses(): Map<AIProvider, ProviderStatus> {
    // Update all statuses before returning
    for (const providerId of SUPPORTED_PROVIDERS) {
      const adapter = this.adapters.get(providerId);
      const status = this.providerStatuses.get(providerId);
      
      if (status && adapter) {
        status.configured = adapter.isInitialized();
        this.providerStatuses.set(providerId, status);
      }
    }
    
    return new Map(this.providerStatuses);
  }


  // ============================================================================
  // Model Management
  // ============================================================================

  /**
   * Set the active model for the current provider
   * Supports both provider models and custom models
   * Requirements: 11.5, 11.6
   */
  setActiveModel(modelId: string, isCustomModel: boolean = false): void {
    if (isCustomModel) {
      // Find the custom model
      const customModel = this.customModels.find(m => m.id === modelId);
      if (!customModel) {
        throw new Error(`Custom model '${modelId}' not found`);
      }
      
      this.activeCustomModelId = modelId;
      this.usingCustomModel = true;
      return;
    }

    // Regular provider model
    const adapter = this.getActiveAdapter();
    
    if (!adapter) {
      throw new Error('No active provider. Please select a provider first.');
    }

    this.usingCustomModel = false;
    this.activeCustomModelId = null;
    adapter.setModel(modelId);
  }

  /**
   * Get the current model for the active provider
   */
  getActiveModel(): string | null {
    // If using custom model, return custom model ID
    if (this.usingCustomModel && this.activeCustomModelId) {
      return this.activeCustomModelId;
    }

    const adapter = this.getActiveAdapter();
    
    if (!adapter) {
      return null;
    }

    return adapter.getCurrentModel();
  }

  // ============================================================================
  // Custom Model Management
  // ============================================================================

  /**
   * Set the list of custom models
   * Requirements: 11.5
   */
  setCustomModels(models: CustomModelConfig[]): void {
    this.customModels = [...models];
    
    // If active custom model was removed, clear it
    if (this.activeCustomModelId && !models.find(m => m.id === this.activeCustomModelId)) {
      this.activeCustomModelId = null;
      this.usingCustomModel = false;
    }
  }

  /**
   * Get all custom models
   * Requirements: 11.5
   */
  getCustomModels(): CustomModelConfig[] {
    return [...this.customModels];
  }

  /**
   * Get the currently active custom model configuration
   * Requirements: 11.6
   */
  getActiveCustomModel(): CustomModelConfig | null {
    if (!this.usingCustomModel || !this.activeCustomModelId) {
      return null;
    }
    
    return this.customModels.find(m => m.id === this.activeCustomModelId) || null;
  }

  /**
   * Check if currently using a custom model
   * Requirements: 11.6
   */
  isUsingCustomModel(): boolean {
    return this.usingCustomModel;
  }

  /**
   * Get all available models (provider models + custom models)
   * Returns provider models from the active adapter combined with custom models
   * Requirements: 11.5
   */
  getAllAvailableModels(): ProviderModel[] {
    const providerModels: ProviderModel[] = [];
    
    // Get models from active adapter
    const adapter = this.getActiveAdapter();
    if (adapter) {
      providerModels.push(...adapter.getAvailableModels());
    }
    
    // Convert custom models to ProviderModel format
    const customProviderModels: ProviderModel[] = this.customModels.map(cm => ({
      id: cm.id,
      name: cm.name,
      description: cm.description || `Custom model: ${cm.modelId}`,
      capabilities: ['text-generation', 'code-generation'],
      pricingTier: 'standard' as const,
      isDefault: false,
    }));
    
    return [...providerModels, ...customProviderModels];
  }

  // ============================================================================
  // Session Statistics
  // ============================================================================

  /**
   * Get session statistics
   * Requirements: 6.4
   */
  getSessionStats(): SessionStatistics {
    const successRate = this.totalRequests > 0
      ? this.successfulRequests / this.totalRequests
      : 0;
    
    const averageResponseTime = this.totalRequests > 0
      ? this.totalResponseTime / this.totalRequests
      : 0;

    return {
      totalRequests: this.totalRequests,
      requestsByProvider: new Map(this.requestsByProvider),
      successRate,
      averageResponseTime,
    };
  }

  /**
   * Increment request count for a provider
   * Requirements: 6.4
   */
  incrementRequestCount(providerId: AIProvider): void {
    // Update total requests
    this.totalRequests++;
    
    // Update provider-specific count
    const currentCount = this.requestsByProvider.get(providerId) || 0;
    this.requestsByProvider.set(providerId, currentCount + 1);
    
    // Update provider status
    const status = this.providerStatuses.get(providerId);
    if (status) {
      status.requestCount = currentCount + 1;
      this.providerStatuses.set(providerId, status);
    }
  }

  /**
   * Record the result of a request for statistics
   * Requirements: 6.4
   */
  recordRequestResult(providerId: AIProvider, success: boolean, responseTimeMs: number): void {
    // Increment request count
    this.incrementRequestCount(providerId);
    
    // Track success
    if (success) {
      this.successfulRequests++;
    }
    
    // Track response time
    this.totalResponseTime += responseTimeMs;
  }

  // ============================================================================
  // Error Tracking
  // ============================================================================

  /**
   * Set an error for a provider
   * Requirements: 4.4
   */
  setProviderError(providerId: AIProvider, error: ProviderError): void {
    const status = this.providerStatuses.get(providerId);
    
    if (status) {
      status.lastError = error;
      this.providerStatuses.set(providerId, status);
    }
  }

  /**
   * Clear error for a provider
   */
  clearProviderError(providerId: AIProvider): void {
    const status = this.providerStatuses.get(providerId);
    
    if (status) {
      status.lastError = undefined;
      this.providerStatuses.set(providerId, status);
    }
  }

  // ============================================================================
  // Reset
  // ============================================================================

  /**
   * Reset the provider manager state
   */
  reset(): void {
    this.activeProviderId = null;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.totalResponseTime = 0;
    
    // Reset custom model state
    this.customModels = [];
    this.activeCustomModelId = null;
    this.usingCustomModel = false;
    
    // Reset all provider statuses
    this.initializeProviderStatuses();
    
    // Reset all adapters
    for (const adapter of this.adapters.values()) {
      adapter.reset();
    }
    
    this.adapters.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of the Provider Manager
 */
export const providerManager = new ProviderManager();

export default providerManager;
