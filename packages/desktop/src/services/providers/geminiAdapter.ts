/**
 * Gemini Provider Adapter
 * 
 * Implements the AIProviderAdapter interface for Google's Gemini API.
 * Migrated from the existing geminiService with model selection support.
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
  buildCorrectionPrompt,
  parseProviderResponse,
} from './baseAdapter';
import { validateScript, autoFixScript } from '../scriptValidationService';

// ============================================================================
// Gemini API Types
// ============================================================================

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface GeminiResponse {
  candidates?: {
    content: {
      parts: { text: string }[];
      role: string;
    };
    finishReason: string;
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// ============================================================================
// Gemini Adapter Implementation
// ============================================================================

/**
 * Gemini Provider Adapter
 * 
 * Implements AIProviderAdapter for Google's Gemini API.
 * Requirements: 3.1, 3.2, 5.2
 */
export class GeminiAdapter implements AIProviderAdapter {
  readonly providerId: AIProvider = 'gemini';
  readonly providerName: string = 'Google Gemini';
  
  private apiKey: string | null = null;
  private initialized: boolean = false;
  private currentModel: string;
  private readonly config = PROVIDER_CONFIGS.gemini;

  constructor() {
    // Set default model
    const defaultModel = this.config.models.find(m => m.isDefault);
    this.currentModel = defaultModel?.id || 'gemini-2.0-flash';
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
   * Get available models for Gemini
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
    return defaultModel?.id || 'gemini-2.0-flash';
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
        message: 'Gemini adapter not initialized. Please configure your API key.',
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
      const response = await this.callGeminiApi(fullPrompt);
      const processingTimeMs = Date.now() - startTime;

      if (!response.candidates || response.candidates.length === 0) {
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

      const responseText = response.candidates[0].content.parts
        .map(p => p.text)
        .join('');

      // Parse the response using unified parser
      const result = parseProviderResponse(
        responseText,
        this.providerId,
        this.currentModel,
        processingTimeMs
      );

      // Add token usage if available
      if (response.usageMetadata && result.metadata) {
        result.metadata.tokenUsage = {
          promptTokens: response.usageMetadata.promptTokenCount,
          completionTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount,
        };
      }

      // If validation failed, try to regenerate with corrections
      if (!result.success && result.message.includes('validation errors')) {
        return await this.regenerateWithCorrections(prompt, context, startTime);
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
        message: 'Gemini adapter not initialized. Please configure your API key.',
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
   * Regenerate script with corrections for validation errors
   */
  private async regenerateWithCorrections(
    originalPrompt: string,
    context: ConversationContext,
    startTime: number
  ): Promise<ProviderResponse> {
    const errors = [
      { field: 'script', message: 'Previous generation had validation errors' },
    ];
    
    const correctionPrompt = buildCorrectionPrompt(originalPrompt, errors);

    try {
      const response = await this.callGeminiApi(correctionPrompt);
      const processingTimeMs = Date.now() - startTime;

      if (!response.candidates || response.candidates.length === 0) {
        return {
          success: false,
          message: 'Failed to regenerate script with corrections.',
          metadata: {
            providerId: this.providerId,
            modelId: this.currentModel,
            processingTimeMs,
          },
        };
      }

      const responseText = response.candidates[0].content.parts
        .map(p => p.text)
        .join('');

      return parseProviderResponse(
        responseText,
        this.providerId,
        this.currentModel,
        processingTimeMs
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Failed to regenerate script: ${errorMessage}`,
        metadata: {
          providerId: this.providerId,
          modelId: this.currentModel,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Make a request to the Gemini API
   */
  private async callGeminiApi(prompt: string): Promise<GeminiResponse> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const url = `${this.config.apiBaseUrl}/models/${this.currentModel}:generateContent?key=${this.apiKey}`;

    const requestBody: GeminiRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: UNIFIED_SYSTEM_PROMPT }],
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I will generate automation scripts in the specified JSON format based on user descriptions. I will ensure all scripts are valid and compatible with the rust-core playback engine.' }],
        },
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
export const geminiAdapter = new GeminiAdapter();

export default geminiAdapter;
