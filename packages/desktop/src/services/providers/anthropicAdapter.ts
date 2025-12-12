/**
 * Anthropic Provider Adapter
 * 
 * Implements the AIProviderAdapter interface for Anthropic's Claude API.
 * Supports Claude 3.5 Sonnet and Claude 3.5 Haiku models.
 * 
 * Requirements: 3.1, 3.2, 5.2
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
  PROVIDER_CONFIGS,
} from '../../types/providerAdapter.types';
import {
  UNIFIED_SYSTEM_PROMPT,
  buildGenerationPrompt,
  buildRefinementPrompt,
  parseProviderResponse,
} from './baseAdapter';

// ============================================================================
// Anthropic API Types
// ============================================================================

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
  temperature?: number;
  top_p?: number;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: {
    type: string;
    text: string;
  }[];
  model: string;
  stop_reason: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: {
    type: string;
    message: string;
  };
}

// ============================================================================
// Anthropic Adapter Implementation
// ============================================================================

/**
 * Anthropic Provider Adapter
 * 
 * Implements AIProviderAdapter for Anthropic's Messages API.
 * Requirements: 3.1, 3.2, 5.2
 */
export class AnthropicAdapter implements AIProviderAdapter {
  readonly providerId: AIProvider = 'anthropic';
  readonly providerName: string = 'Anthropic';
  
  private apiKey: string | null = null;
  private initialized: boolean = false;
  private currentModel: string;
  private readonly config = PROVIDER_CONFIGS.anthropic;

  constructor() {
    // Set default model
    const defaultModel = this.config.models.find(m => m.isDefault);
    this.currentModel = defaultModel?.id || 'claude-3-5-sonnet-20241022';
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
   * Get available models for Anthropic
   * Requirements: 3.1
   */
  getAvailableModels(): ProviderModel[] {
    return this.config.models;
  }

  /**
   * Get the default model ID
   */
  getDefaultModel(): string {
    const defaultModel = this.config.models.find(m => m.isDefault);
    return defaultModel?.id || 'claude-3-5-sonnet-20241022';
  }

  /**
   * Set the current model
   * Requirements: 3.2
   */
  setModel(modelId: string): void {
    const model = this.config.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Invalid model ID: ${modelId}. Available models: ${this.config.models.map(m => m.id).join(', ')}`);
    }
    this.currentModel = modelId;
  }

  /**
   * Get the current model ID
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Generate a script from a user prompt
   * Requirements: 3.1, 3.2, 5.2
   */
  async generateScript(
    prompt: string,
    context: ConversationContext
  ): Promise<ProviderResponse> {
    if (!this.isInitialized()) {
      return {
        success: false,
        message: 'Anthropic adapter not initialized. Please configure your API key.',
        metadata: {
          providerId: this.providerId,
          modelId: this.currentModel,
          processingTimeMs: 0,
        },
      };
    }

    const startTime = Date.now();

    try {
      // Build the full prompt with context
      const fullPrompt = buildGenerationPrompt(prompt, context);

      // Make API request
      const response = await this.callAnthropicApi(fullPrompt);
      const processingTimeMs = Date.now() - startTime;

      if (response.error) {
        return {
          success: false,
          message: `API Error: ${response.error.message}`,
          metadata: {
            providerId: this.providerId,
            modelId: this.currentModel,
            processingTimeMs,
          },
        };
      }

      if (!response.content || response.content.length === 0) {
        return {
          success: false,
          message: 'No response generated. Please try again.',
          metadata: {
            providerId: this.providerId,
            modelId: this.currentModel,
            processingTimeMs,
          },
        };
      }

      // Extract text from content blocks
      const responseText = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      // Parse the response using unified parser
      const result = parseProviderResponse(
        responseText,
        this.providerId,
        this.currentModel,
        processingTimeMs
      );

      // Add token usage if available
      if (response.usage && result.metadata) {
        result.metadata.tokenUsage = {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
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
          modelId: this.currentModel,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Refine an existing script based on user feedback
   * Requirements: 3.2
   */
  async refineScript(
    currentScript: ScriptData,
    feedback: string
  ): Promise<ProviderResponse> {
    if (!this.isInitialized()) {
      return {
        success: false,
        message: 'Anthropic adapter not initialized. Please configure your API key.',
        metadata: {
          providerId: this.providerId,
          modelId: this.currentModel,
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
          modelId: this.currentModel,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Make a request to the Anthropic API
   */
  private async callAnthropicApi(prompt: string): Promise<AnthropicResponse> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const url = `${this.config.apiBaseUrl}/messages`;

    const requestBody: AnthropicRequest = {
      model: this.currentModel,
      max_tokens: 4096,
      system: UNIFIED_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      top_p: 0.95,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
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
}

// Export singleton instance
export const anthropicAdapter = new AnthropicAdapter();

export default anthropicAdapter;
