/**
 * AI Script Builder Types and Interfaces
 * 
 * Defines all types used in the AI Script Builder feature for generating
 * automation scripts through natural language chat with Gemini AI.
 * 
 * Requirements: 2.1, 3.1, 3.2, 3.3, 6.1
 */

// ============================================================================
// Script Data Types (rust-core compatible)
// ============================================================================

/**
 * Types of actions that can be recorded and played back
 * Must match rust-core ActionType enum
 */
export type ActionType =
  | 'mouse_move'
  | 'mouse_click'
  | 'mouse_double_click'
  | 'mouse_drag'
  | 'mouse_scroll'
  | 'key_press'
  | 'key_release'
  | 'key_type'
  | 'screenshot'
  | 'wait'
  | 'custom';

/**
 * Mouse button types for click actions
 */
export type MouseButton = 'left' | 'right' | 'middle';

/**
 * Individual action within a script
 * Compatible with rust-core Action struct
 */
export interface Action {
  type: ActionType;
  timestamp: number;
  x?: number;
  y?: number;
  button?: MouseButton;
  key?: string;
  text?: string;
  modifiers?: string[];
  additional_data?: Record<string, unknown>;
}

/**
 * Metadata about the script
 * Compatible with rust-core ScriptMetadata struct
 */
export interface ScriptMetadata {
  created_at: string; // ISO 8601 format
  duration: number;
  action_count: number;
  core_type: string;
  platform: string;
  screen_resolution?: [number, number];
  additional_data?: Record<string, unknown>;
}


/**
 * Complete script data structure
 * Compatible with rust-core ScriptData struct
 */
export interface ScriptData {
  version: string;
  metadata: ScriptMetadata;
  actions: Action[];
}

// ============================================================================
// Chat Interface Types
// ============================================================================

/**
 * Role of a message in the chat conversation
 */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * Chat message in the conversation history
 * Requirements: 2.1, 2.2
 */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  scriptPreview?: ScriptData;
  clarificationQuestions?: string[];
}

/**
 * State for the chat interface component
 */
export interface ChatInterfaceState {
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Props for the chat interface component
 * Requirements: 2.1, 2.5, 3.1
 */
export interface ChatInterfaceProps {
  onScriptGenerated: (script: ScriptData) => void;
  apiKeyConfigured: boolean;
  targetOS?: 'macos' | 'windows' | 'universal';
  /** List of available providers with their status */
  providers?: import('./providerAdapter.types').ProviderInfo[];
  /** Currently active provider */
  activeProvider?: import('./providerAdapter.types').AIProvider | null;
  /** Callback when a provider is selected */
  onProviderSelect?: (providerId: import('./providerAdapter.types').AIProvider) => void;
  /** Callback to configure a provider */
  onConfigureProvider?: (providerId: import('./providerAdapter.types').AIProvider) => void;
  /** Available models for the active provider */
  models?: import('./providerAdapter.types').ProviderModel[];
  /** Currently active model */
  activeModel?: string | null;
  /** Callback when a model is selected */
  onModelSelect?: (modelId: string) => void;
  /** Whether provider switching is in progress */
  providerLoading?: boolean;
}

// ============================================================================
// Gemini Service Types
// ============================================================================

/**
 * Context for conversation with Gemini API
 * Requirements: 3.1
 */
export interface ConversationContext {
  previousMessages: ChatMessage[];
  currentScript?: ScriptData;
  availableActions: ActionType[];
  targetOS?: 'macos' | 'windows' | 'universal';
}

/**
 * Result from Gemini script generation
 * Requirements: 3.2
 */
export interface GenerationResult {
  success: boolean;
  script?: ScriptData;
  message: string;
  needsClarification?: boolean;
  clarificationQuestions?: string[];
}

/**
 * Prompt template for Gemini API
 */
export interface PromptTemplate {
  systemPrompt: string;
  actionSchema: string;
  exampleScripts: ScriptData[];
  userContext: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error for script or action
 * Requirements: 3.3, 6.1
 */
export interface ValidationError {
  field: string;
  message: string;
  actionIndex?: number;
}

/**
 * Validation warning (non-blocking issue)
 */
export interface ValidationWarning {
  field: string;
  message: string;
  actionIndex?: number;
}

/**
 * Result of script validation
 * Requirements: 3.3
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Result of rust-core compatibility check
 * Requirements: 6.1
 */
export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
  suggestions: string[];
}

// ============================================================================
// API Key Service Types
// ============================================================================

/**
 * Stored API key data in Firebase
 */
export interface StoredApiKey {
  userId: string;
  encryptedKey: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Script Preview Types
// ============================================================================

/**
 * Props for the script preview component
 */
export interface ScriptPreviewProps {
  script: ScriptData | null;
  onEdit: (script: ScriptData) => void;
  onSave: (script: ScriptData) => void;
  onDiscard: () => void;
  validationResult: ValidationResult;
}

// ============================================================================
// Suggestion Types
// ============================================================================

/**
 * Action suggestion for user input
 */
export interface ActionSuggestion {
  keyword: string;
  actionType: ActionType;
  description: string;
}

/**
 * Example prompt for common scenarios
 */
export interface ExamplePrompt {
  id: string;
  title: string;
  description: string;
  promptText: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * All available action types for script generation
 */
export const AVAILABLE_ACTION_TYPES: ActionType[] = [
  'mouse_move',
  'mouse_click',
  'mouse_double_click',
  'mouse_drag',
  'mouse_scroll',
  'key_press',
  'key_release',
  'key_type',
  'screenshot',
  'wait',
  'custom',
];

/**
 * Human-readable descriptions for action types
 */
export const ACTION_TYPE_DESCRIPTIONS: Record<ActionType, string> = {
  mouse_move: 'Di chuyển chuột đến vị trí',
  mouse_click: 'Click chuột tại vị trí',
  mouse_double_click: 'Double click chuột',
  mouse_drag: 'Kéo thả chuột',
  mouse_scroll: 'Cuộn chuột',
  key_press: 'Nhấn phím',
  key_release: 'Thả phím',
  key_type: 'Gõ văn bản',
  screenshot: 'Chụp màn hình',
  wait: 'Chờ đợi',
  custom: 'Hành động tùy chỉnh',
};
