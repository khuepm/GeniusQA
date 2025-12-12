/**
 * Custom Model Provider Adapter
 * 
 * Implements the AIProviderAdapter interface for user-defined custom models.
 * Supports any OpenAI-compatible API endpoint, allowing users to add
 * custom models from various providers (local LLMs, custom deployments, etc.)
 * 
 * Requirements: 11.6
 */

import {
  ScriptData,
  ConversationContext,
  AVAILABLE_ACTION_TYPES,
  ActionType,
} from '../../types/aiScriptBuilder.types';
import {
  AIProvider,
  AIProviderAdapter,
  ProviderModel,
  ProviderResponse,
  CustomModelConfig,
} from '../../types/providerAdapter.types';
import {
  UNIFIED_SYSTEM_PROMPT,
  buildGenerationPrompt,
  buildRefinementPrompt,
  parseProviderResponse,
} from './baseAdapter';

// ============================================================================
// OpenAI-Compatible API Types
// ============================================================================

interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompatibleRequest {
  model: string;
  messages: OpenAICompatibleMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface OpenAICompatibleResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

// ============================================================================
// Custom Model Adapter Implementation
// ============================================================================

/**
 * Custom Model Provider Adapter
 * 
 * Implements AIProviderAdapter for user-defined OpenAI-compatible APIs.
 * This adapter is dynamically configured with custom model settings.
 * 
 * Requirements: 11.6
 */
export class CustomModelAdapter implements AIProviderAdapter {
  // Use 'custom' as a pseudo-provider ID for custom models
  // The actual provider identification is done via customModelId
  readonly providerId: AIProvider = 'openai'; // Use openai as base type for compatibility
  readonly providerName: string;
  
  private apiKey: string | null = null;
  private apiBaseUrl: string;
  private modelId: string;
  private customModelId: string;
  private initialized: boolean = false;
  private description: string;

  /**
   * Create a new CustomModelAdapter from a CustomModelConfig
   * 
   * @param config - The custom model configuration
   */
  constructor(config: CustomModelConfig) {
    this.customModelId = config.id;
    this.providerName = config.name;
    this.modelId = config.modelId;
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.description = config.description || '';
    
    // Initialize with the API key from config
    if (config.apiKey) {
      this.apiKey = config.apiKey;
      this.initialized = true;
    }
  }

  /**
   * Get the custom model ID (unique identifier)
   */
  getCustomModelId(): string {
    return this.customModelId;
  }

  /**
   * Initialize the adapter with an API key
   */
  async initialize(apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key is required');
    }
    
    this.apiKey = apiKey.trim();
    this.initialized = true;
  }

  /**
   * Check if the adapter is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.apiKey !== null;
  }

  /**
   * Reset the adapter (clear API key)
   */
  reset(): void {
    this.apiKey = null;
    this.initialized = false;
  }

  /**
   * Get available models for this custom adapter
   * Returns a single model representing the custom configuration
   */
  getAvailableModels(): ProviderModel[] {
    return [
      {
        id: this.modelId,
        name: this.providerName,
        description: this.description || `Custom model: ${this.modelId}`,
        capabilities: ['text-generation', 'code-generation'],
        pricingTier: 'standard',
        isDefault: true,
      },
    ];
  }

  /**
   * Get the default model ID
   */
  getDefaultModel(): string {
    return this.modelId;
  }

  /**
   * Set the current model (no-op for custom adapter as it has only one model)
   */
  setModel(modelId: string): void {
    // Custom adapters only have one model, so we just validate
    if (modelId !== this.modelId) {
      console.warn(`Custom model adapter only supports model: ${this.modelId}`);
    }
  }

  /**
   * Get the current model ID
   */
  getCurrentModel(): string {
    return this.modelId;
  }

  /**
   * Generate a script from a user prompt
   * Requirements: 11.6
   */
  async generateScript(
    prompt: string,
    context: ConversationContext
  ): Promise<ProviderResponse> {
    if (!this.isInitialized()) {
      return {
        success: false,
        message: `Custom model "${this.providerName}" not initialized. Please check your API key.`,
        metadata: {
          providerId: this.providerId,
          modelId: this.modelId,
          processingTimeMs: 0,
        },
      };
    }

    const startTime = Date.now();

    try {
      // Build the full prompt with context
      const fullPrompt = buildGenerationPrompt(prompt, context);

      // Make API request
      const response = await this.callCustomApi(fullPrompt);
      const processingTimeMs = Date.now() - startTime;

      if (response.error) {
        return {
          success: false,
          message: `API Error: ${response.error.message}`,
          metadata: {
            providerId: this.providerId,
            modelId: this.modelId,
            processingTimeMs,
          },
        };
      }

      if (!response.choices || response.choices.length === 0) {
        return {
          success: false,
          message: 'No response generated. Please try again.',
          metadata: {
            providerId: this.providerId,
            modelId: this.modelId,
            processingTimeMs,
          },
        };
      }

      const responseText = response.choices[0].message.content;

      // Parse the response using unified parser
      const result = parseProviderResponse(
        responseText,
        this.providerId,
        this.modelId,
        processingTimeMs
      );

      // Add token usage if available
      if (response.usage && result.metadata) {
        result.metadata.tokenUsage = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        };
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Failed to generate script: ${errorMessage}`,
        metadata: {
          providerId: this.providerId,
          modelId: this.modelId,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Refine an existing script based on user feedback
   * Requirements: 11.6
   */
  async refineScript(
    currentScript: ScriptData,
    feedback: string
  ): Promise<ProviderResponse> {
    if (!this.isInitialized()) {
      return {
        success: false,
        message: `Custom model "${this.providerName}" not initialized. Please check your API key.`,
        metadata: {
          providerId: this.providerId,
          modelId: this.modelId,
          processingTimeMs: 0,
        },
      };
    }

    const startTime = Date.now();

    try {
      const refinementPrompt = buildRefinementPrompt(currentScript, feedback);

      const context: ConversationContext = {
        previousMessages: [],
        currentScript,
        availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
      };

      return await this.generateScript(refinementPrompt, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Failed to refine script: ${errorMessage}`,
        metadata: {
          providerId: this.providerId,
          modelId: this.modelId,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Make a request to the custom OpenAI-compatible API
   */
  private async callCustomApi(prompt: string): Promise<OpenAICompatibleResponse> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const url = `${this.apiBaseUrl}/chat/completions`;

    const requestBody: OpenAICompatibleRequest = {
      model: this.modelId,
      messages: [
        {
          role: 'system',
          content: UNIFIED_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.95,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `API request failed with status ${response.status}`
      );
    }

    return response.json();
  }

  /**
   * Update the adapter configuration
   * Used when the custom model settings are modified
   */
  updateConfig(config: Partial<CustomModelConfig>): void {
    if (config.name) {
      (this as { providerName: string }).providerName = config.name;
    }
    if (config.modelId) {
      this.modelId = config.modelId;
    }
    if (config.apiBaseUrl) {
      this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, '');
    }
    if (config.apiKey) {
      this.apiKey = config.apiKey;
      this.initialized = true;
    }
    if (config.description !== undefined) {
      this.description = config.description || '';
    }
  }
}

/**
 * Factory function to create a CustomModelAdapter from config
 */
export function createCustomModelAdapter(config: CustomModelConfig): CustomModelAdapter {
  return new CustomModelAdapter(config);
}

export default CustomModelAdapter;
