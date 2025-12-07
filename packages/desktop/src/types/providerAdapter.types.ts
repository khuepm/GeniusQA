/**
 * Provider Adapter Types and Interfaces
 * 
 * Defines the unified interface for all AI provider adapters,
 * enabling consistent interaction with different AI services
 * (Gemini, OpenAI, Anthropic, Azure OpenAI).
 * 
 * Requirements: 5.1, 5.2
 */

import { ScriptData, ConversationContext } from './aiScriptBuilder.types';

// ============================================================================
// Provider Identification
// ============================================================================

/**
 * Supported AI provider identifiers
 */
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'azure';

// ============================================================================
// Response Types
// ============================================================================

/**
 * Token usage information from provider response
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Metadata about the provider response
 * Requirements: 6.3
 */
export interface ResponseMetadata {
  providerId: AIProvider;
  modelId: string;
  processingTimeMs: number;
  tokenUsage?: TokenUsage;
}

/**
 * Standardized response from any provider
 * Requirements: 5.2
 */
export interface ProviderResponse {
  success: boolean;
  script?: ScriptData;
  message: string;
  rawResponse?: string;
  needsClarification?: boolean;
  clarificationQuestions?: string[];
  metadata: ResponseMetadata;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Types of errors that can occur with providers
 * Requirements: 4.1, 4.2, 4.3
 */
export type ProviderErrorType =
  | 'rate_limit'
  | 'network_error'
  | 'auth_error'
  | 'invalid_response'
  | 'content_filtered'
  | 'quota_exceeded'
  | 'unknown';

/**
 * Provider-specific error information
 * Requirements: 4.4
 */
export interface ProviderError {
  type: ProviderErrorType;
  message: string;
  providerId: AIProvider;
  timestamp: Date;
  retryable: boolean;
  suggestAlternative: boolean;
}

// ============================================================================
// Provider Adapter Interface
// ============================================================================

/**
 * Model information for a provider
 */
export interface ProviderModel {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  pricingTier: 'free' | 'standard' | 'premium';
  isDefault: boolean;
}

/**
 * Base interface that all provider adapters must implement
 * Requirements: 5.1
 */
export interface AIProviderAdapter {
  // Provider identification
  readonly providerId: AIProvider;
  readonly providerName: string;
  
  // Initialization
  initialize(apiKey: string): Promise<void>;
  isInitialized(): boolean;
  reset(): void;
  
  // Model management
  getAvailableModels(): ProviderModel[];
  getDefaultModel(): string;
  setModel(modelId: string): void;
  getCurrentModel(): string;
  
  // Script generation
  generateScript(
    prompt: string,
    context: ConversationContext
  ): Promise<ProviderResponse>;
  
  // Refinement
  refineScript(
    currentScript: ScriptData,
    feedback: string
  ): Promise<ProviderResponse>;
}


// ============================================================================
// Provider Configuration Types
// ============================================================================

/**
 * Configuration for a specific AI provider
 * Requirements: 3.1, 6.1
 */
export interface ProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  apiBaseUrl: string;
  models: ProviderModel[];
}

/**
 * Status of a provider
 * Requirements: 6.1
 */
export interface ProviderStatus {
  providerId: AIProvider;
  configured: boolean;
  active: boolean;
  lastError?: ProviderError;
  requestCount: number;
}

/**
 * Session statistics for provider usage
 * Requirements: 6.4
 */
export interface SessionStatistics {
  totalRequests: number;
  requestsByProvider: Map<AIProvider, number>;
  successRate: number;
  averageResponseTime: number;
}

/**
 * User preferences for providers
 * Requirements: 3.5
 */
export interface UserProviderPreferences {
  defaultProvider: AIProvider | null;
  modelPreferences: Record<AIProvider, string>; // provider -> preferred model
  lastUsedProvider: AIProvider | null;
}

// ============================================================================
// Provider Configurations
// ============================================================================

/**
 * Pre-defined configurations for all supported providers
 * Requirements: 3.1
 */
export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google AI Studio API',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Fast and efficient model for quick responses',
        capabilities: ['text-generation', 'code-generation'],
        pricingTier: 'free',
        isDefault: true,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Advanced model with larger context window',
        capabilities: ['text-generation', 'code-generation', 'reasoning'],
        pricingTier: 'standard',
        isDefault: false,
      },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5, etc.',
    apiBaseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most capable GPT-4 model with vision',
        capabilities: ['text-generation', 'code-generation', 'vision', 'reasoning'],
        pricingTier: 'premium',
        isDefault: true,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Smaller, faster, and more affordable GPT-4o',
        capabilities: ['text-generation', 'code-generation'],
        pricingTier: 'standard',
        isDefault: false,
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'GPT-4 with improved speed and lower cost',
        capabilities: ['text-generation', 'code-generation', 'reasoning'],
        pricingTier: 'premium',
        isDefault: false,
      },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI',
    apiBaseUrl: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most intelligent Claude model, best for complex tasks',
        capabilities: ['text-generation', 'code-generation', 'reasoning', 'analysis'],
        pricingTier: 'premium',
        isDefault: true,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fast and efficient for simpler tasks',
        capabilities: ['text-generation', 'code-generation'],
        pricingTier: 'standard',
        isDefault: false,
      },
    ],
  },
  azure: {
    id: 'azure',
    name: 'Azure OpenAI',
    description: 'Microsoft Azure OpenAI Service',
    apiBaseUrl: '', // User-configured endpoint
    models: [], // User-configured deployments
  },
};

// ============================================================================
// Provider Info Types (for UI)
// ============================================================================

/**
 * Provider information for display in UI
 * Requirements: 2.1
 */
export interface ProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  configured: boolean;
  status: 'ready' | 'error' | 'unconfigured';
  models: ProviderModel[];
}

// ============================================================================
// Helper Constants
// ============================================================================

/**
 * List of all supported providers
 */
export const SUPPORTED_PROVIDERS: AIProvider[] = ['gemini', 'openai', 'anthropic', 'azure'];

/**
 * Human-readable names for providers
 */
export const PROVIDER_DISPLAY_NAMES: Record<AIProvider, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  azure: 'Azure OpenAI',
};
