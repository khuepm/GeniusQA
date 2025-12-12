/**
 * AI Vision Service for AI Vision Capture feature
 *
 * Provides integration with Google's Gemini Vision API for analyzing
 * screenshots and locating UI elements based on prompts and reference images.
 *
 * Requirements: 4.6, 4.8, 4.10
 */

import {
  AIVisionRequest,
  AIVisionResponse,
  VisionROI,
  VisionError,
  VisionErrorCode,
} from '../types/aiVisionCapture.types';

// ============================================================================
// Constants
// ============================================================================

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_VISION_MODEL = 'gemini-2.0-flash';
const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds (Requirement 4.10)

/**
 * System prompt for AI Vision analysis
 * Instructs the AI to locate UI elements and return coordinates
 */
const VISION_SYSTEM_PROMPT = `You are a UI element locator assistant. Your task is to analyze screenshots and find the exact pixel coordinates of UI elements described by the user.

## Your Role
- Analyze the provided screenshot image
- Find the UI element described in the user's prompt
- If reference images are provided, use them to identify similar visual elements
- Return the center coordinates (x, y) of the found element

## Response Format
You MUST respond with ONLY a JSON object in this exact format:
\`\`\`json
{
  "found": true,
  "x": <integer pixel x coordinate>,
  "y": <integer pixel y coordinate>,
  "confidence": <float between 0 and 1>,
  "description": "<brief description of what was found>"
}
\`\`\`

If the element cannot be found, respond with:
\`\`\`json
{
  "found": false,
  "error": "<reason why element was not found>",
  "confidence": 0
}
\`\`\`


## Important Rules
1. Coordinates must be integers representing pixel positions
2. X coordinate is horizontal (0 = left edge)
3. Y coordinate is vertical (0 = top edge)
4. Return the CENTER of the target element, not its corner
5. Confidence should reflect how certain you are (1.0 = very certain, 0.5 = uncertain)
6. If multiple matching elements exist, return the most prominent/visible one
7. ONLY output the JSON, no additional text`;

// ============================================================================
// Types
// ============================================================================

/**
 * Gemini Vision API request structure
 */
interface GeminiVisionRequest {
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
  parts: GeminiPart[];
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

/**
 * Gemini Vision API response structure
 */
interface GeminiVisionResponse {
  candidates?: {
    content: {
      parts: { text: string }[];
      role: string;
    };
    finishReason: string;
  }[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Parsed AI response for element location
 */
interface ParsedVisionResult {
  found: boolean;
  x?: number;
  y?: number;
  confidence: number;
  description?: string;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts JSON from AI response text
 * Handles both code-block wrapped and raw JSON
 */
export function extractJsonFromResponse(responseText: string): string | null {
  // Try to extract from code block first
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = responseText.match(/\{[\s\S]*"found"[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}

/**
 * Parses the AI response into a structured result
 */
export function parseVisionResult(responseText: string): ParsedVisionResult | null {
  const jsonString = extractJsonFromResponse(responseText);
  if (!jsonString) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonString);

    // Validate required fields
    if (typeof parsed.found !== 'boolean') {
      return null;
    }

    if (parsed.found) {
      // Validate coordinates for successful find
      if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
        return null;
      }

      return {
        found: true,
        x: Math.round(parsed.x),
        y: Math.round(parsed.y),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        description: parsed.description,
      };
    } else {
      return {
        found: false,
        confidence: 0,
        error: parsed.error || 'Element not found',
      };
    }
  } catch {
    return null;
  }
}

/**
 * Converts image data to base64 if needed
 * Handles both base64 strings and file paths
 */
export async function toBase64(imageData: string): Promise<string> {
  // If already base64 (no file path indicators), return as-is
  if (!imageData.includes('/') && !imageData.includes('\\') && !imageData.includes('.')) {
    // Remove data URL prefix if present
    if (imageData.startsWith('data:')) {
      const base64Match = imageData.match(/base64,(.+)/);
      return base64Match ? base64Match[1] : imageData;
    }
    return imageData;
  }

  // If it's a data URL, extract the base64 part
  if (imageData.startsWith('data:')) {
    const base64Match = imageData.match(/base64,(.+)/);
    return base64Match ? base64Match[1] : imageData;
  }

  // For file paths, we need to read the file
  // In a browser/Tauri context, this would use the file system API
  // For now, assume the caller provides base64 data
  return imageData;
}


/**
 * Crops an image to the specified ROI
 * Returns base64 encoded cropped image
 *
 * @param imageBase64 - Base64 encoded source image
 * @param roi - Region of interest to crop to
 * @returns Base64 encoded cropped image
 */
export async function cropImageToROI(
  imageBase64: string,
  roi: VisionROI
): Promise<string> {
  // Create an offscreen canvas for cropping
  if (typeof document === 'undefined') {
    // Server-side or non-browser environment - return original
    return imageBase64;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = roi.width;
        canvas.height = roi.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw the cropped region
        ctx.drawImage(
          img,
          roi.x,
          roi.y,
          roi.width,
          roi.height,
          0,
          0,
          roi.width,
          roi.height
        );

        // Convert to base64 (remove data URL prefix)
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        resolve(base64);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for cropping'));
    };

    // Load the image from base64
    img.src = `data:image/png;base64,${imageBase64}`;
  });
}

/**
 * Creates a VisionError object
 */
export function createVisionError(
  code: VisionErrorCode,
  message: string,
  recoverable: boolean = false,
  suggestion?: string
): VisionError {
  return {
    code,
    message,
    recoverable,
    suggestion,
  };
}

// ============================================================================
// AI Vision Service Class
// ============================================================================

/**
 * Service for AI-powered visual element detection
 * Requirements: 4.6, 4.8, 4.10
 */
export class AIVisionService {
  private apiKey: string | null = null;
  private initialized: boolean = false;
  private timeoutMs: number = DEFAULT_TIMEOUT_MS;

  /**
   * Initialize the service with an API key
   * @param apiKey - The Gemini API key
   */
  async initialize(apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key is required');
    }

    this.apiKey = apiKey.trim();
    this.initialized = true;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.apiKey !== null;
  }

  /**
   * Reset the service (clear API key)
   */
  reset(): void {
    this.apiKey = null;
    this.initialized = false;
    this.timeoutMs = DEFAULT_TIMEOUT_MS;
  }

  /**
   * Set the timeout for AI requests
   * Requirements: 4.10
   *
   * @param ms - Timeout in milliseconds (default: 15000)
   */
  setTimeout(ms: number): void {
    if (ms <= 0) {
      throw new Error('Timeout must be a positive number');
    }
    this.timeoutMs = ms;
  }

  /**
   * Get the current timeout setting
   */
  getTimeout(): number {
    return this.timeoutMs;
  }


  /**
   * Analyze a screenshot to find a UI element
   * Requirements: 4.6, 4.8, 4.10
   *
   * @param request - The vision analysis request
   * @returns AIVisionResponse with coordinates or error
   */
  async analyze(request: AIVisionRequest): Promise<AIVisionResponse> {
    if (!this.isInitialized()) {
      return {
        success: false,
        error: 'AI Vision service not initialized. Please configure your API key.',
      };
    }

    // Validate request
    if (!request.screenshot) {
      return {
        success: false,
        error: 'Screenshot is required for analysis.',
      };
    }

    if (!request.prompt || request.prompt.trim().length === 0) {
      return {
        success: false,
        error: 'Prompt is required for analysis.',
      };
    }

    try {
      // Prepare the screenshot (crop to ROI if specified)
      let screenshotBase64 = await toBase64(request.screenshot);

      // Handle ROI cropping (Requirement: Handle ROI cropping before sending to AI)
      if (request.roi) {
        try {
          screenshotBase64 = await cropImageToROI(screenshotBase64, request.roi);
        } catch (cropError) {
          console.warn('Failed to crop image to ROI, using full image:', cropError);
          // Continue with full image if cropping fails
        }
      }

      // Prepare reference images
      const referenceImagesBase64: string[] = [];
      for (const refImage of request.reference_images) {
        try {
          const base64 = await toBase64(refImage);
          referenceImagesBase64.push(base64);
        } catch {
          console.warn('Failed to process reference image, skipping');
        }
      }

      // Make API request with timeout
      const response = await this.callGeminiVisionApi(
        screenshotBase64,
        request.prompt,
        referenceImagesBase64,
        request.roi
      );

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Check for timeout error
      if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        return {
          success: false,
          error: `AI analysis timed out after ${this.timeoutMs / 1000} seconds. Please try again.`,
        };
      }

      return {
        success: false,
        error: `AI analysis failed: ${errorMessage}`,
      };
    }
  }


  /**
   * Make a request to the Gemini Vision API with timeout
   * Requirements: 4.6, 4.8, 4.10
   */
  private async callGeminiVisionApi(
    screenshotBase64: string,
    prompt: string,
    referenceImages: string[],
    roi?: VisionROI
  ): Promise<AIVisionResponse> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const url = `${GEMINI_API_BASE_URL}/models/${GEMINI_VISION_MODEL}:generateContent?key=${this.apiKey}`;

    // Build the user message parts
    const userParts: GeminiPart[] = [];

    // Add the main screenshot
    userParts.push({
      inline_data: {
        mime_type: 'image/png',
        data: screenshotBase64,
      },
    });

    // Add reference images if provided (Requirement 4.8)
    for (const refImage of referenceImages) {
      userParts.push({
        inline_data: {
          mime_type: 'image/png',
          data: refImage,
        },
      });
    }

    // Build the prompt text
    let promptText = `Find the UI element described below in the screenshot.\n\nTarget: ${prompt}`;

    if (referenceImages.length > 0) {
      promptText += `\n\nI have also provided ${referenceImages.length} reference image(s) showing what the target element looks like. Use these to help identify the element.`;
    }

    if (roi) {
      promptText += `\n\nNote: The screenshot has been cropped to a specific region. The coordinates you return should be relative to this cropped image (top-left is 0,0).`;
    }

    userParts.push({ text: promptText });

    const requestBody: GeminiVisionRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: VISION_SYSTEM_PROMPT }],
        },
        {
          role: 'model',
          parts: [
            {
              text: 'I understand. I will analyze screenshots to find UI elements and return their coordinates in the specified JSON format.',
            },
          ],
        },
        {
          role: 'user',
          parts: userParts,
        },
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for more deterministic results
        topK: 1,
        topP: 0.95,
        maxOutputTokens: 256, // We only need a small JSON response
      },
    };

    // Create abort controller for timeout (Requirement 4.10)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(
          errorData.error?.message || `API request failed with status ${response.status}`
        );
      }

      const data: GeminiVisionResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      if (!data.candidates || data.candidates.length === 0) {
        return {
          success: false,
          error: 'No response generated by AI. Please try again.',
        };
      }

      const responseText = data.candidates[0].content.parts.map((p) => p.text).join('');

      // Parse the AI response
      const result = parseVisionResult(responseText);

      if (!result) {
        return {
          success: false,
          error: 'Failed to parse AI response. The response was not in the expected format.',
        };
      }

      if (!result.found) {
        return {
          success: false,
          error: result.error || 'Element not found in screenshot.',
        };
      }

      // Adjust coordinates if ROI was used
      let finalX = result.x!;
      let finalY = result.y!;

      if (roi) {
        // Add ROI offset to get absolute coordinates
        finalX += roi.x;
        finalY += roi.y;
      }

      return {
        success: true,
        x: finalX,
        y: finalY,
        confidence: result.confidence,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeoutMs}ms`);
      }

      throw error;
    }
  }
}

// Export singleton instance
export const aiVisionService = new AIVisionService();

export default aiVisionService;
