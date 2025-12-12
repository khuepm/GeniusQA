/**
 * OpenAI Provider Adapter
 * 
 * Implements the AIProviderAdapter interface for OpenAI's API.
 * Supports GPT-4o, GPT-4o-mini, and GPT-4-turbo models.
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
// OpenAI API Types
// ============================================================================

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

// ============================================================================
// OpenAI Adapter Implementation
// ============================================================================

/**
 * OpenAI Provider Adapter
 * 
 * Implements AIProviderAdapter for OpenAI's Chat Completions API.
 * Requirements: 3.1, 3.2, 5.2
 */
export class OpenAIAdapter implements AIProviderAdapter {
  readonly providerId: AIProvider = 'openai';
  readonly providerName: string = 'OpenAI';
  
  private apiKey: string | null = null;
  private initialized: boolean = false;
  private currentModel: string;
  private readonly config = PROVIDER_CONFIGS.openai;

  constructor() {
    // Set default model
    const defaultModel = this.config.models.find(m => m.isDefault);
    this.currentModel = defaultModel?.id || 'gpt-4o';
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
   * Get available models for OpenAI
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
    return defaultModel?.id || 'gpt-4o';
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
        message: 'OpenAI adapter not initialized. Please configure your API key.',
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
      const response = await this.callOpenAIApi(fullPrompt);
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

      if (!response.choices || response.choices.length === 0) {
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

      const responseText = response.choices[0].message.content;

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
        message: 'OpenAI adapter not initialized. Please configure your API key.',
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
   * Make a request to the OpenAI API
   */
  private async callOpenAIApi(prompt: string): Promise<OpenAIResponse> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const url = `${this.config.apiBaseUrl}/chat/completions`;

    const requestBody: OpenAIRequest = {
      model: this.currentModel,
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
}

// Export singleton instance
export const openaiAdapter = new OpenAIAdapter();

export default openaiAdapter;
