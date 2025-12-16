/**
 * Type definitions for AI Test Case Generator
 * 
 * This module defines all TypeScript interfaces and types used in the AI Test Case Generator
 * feature. It provides type safety for test case generation, validation, and UI components.
 * 
 * Requirements: 5.1, 5.2, 6.1, 6.2, 6.3, 9.1, 9.2
 */

/**
 * Test case severity levels
 */
export type TestSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

/**
 * Test case types
 */
export type TestType = 'Functional' | 'Integration' | 'EdgeCase' | 'ErrorHandling' | 'Performance' | 'Security' | 'Accessibility';

/**
 * Project types for context-aware generation
 */
export type ProjectType = 'Web' | 'Mobile' | 'Api' | 'Desktop';

/**
 * Source type for test case generation
 */
export type SourceType = 'Requirements' | 'RecordedActions' | 'Manual';

/**
 * Complexity levels for test case generation
 */
export type ComplexityLevel = 'Basic' | 'Detailed' | 'Comprehensive';

/**
 * Individual test step within a test case
 */
export interface TestStep {
  order: number;
  action: string;
  expected_outcome?: string;
  notes?: string;
}

/**
 * Test case metadata
 */
export interface TestCaseMetadata {
  created_at: string; // ISO 8601 timestamp
  generated_by: string; // "ai-gemini"
  source_type: SourceType;
  project_type: ProjectType;
  generation_version: string;
}

/**
 * Core test case structure
 */
export interface TestCase {
  id: string;
  title: string;
  description: string;
  preconditions?: string;
  steps: TestStep[];
  expected_result: string;
  severity: TestSeverity;
  test_type: TestType;
  metadata: TestCaseMetadata;
}

/**
 * Generation options for AI test case creation
 */
export interface GenerationOptions {
  project_type: ProjectType;
  complexity_level: ComplexityLevel;
  include_edge_cases: boolean;
  include_error_scenarios: boolean;
  max_test_cases?: number;
  custom_context?: string;
}

/**
 * Token usage information from API
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Response metadata for generation requests
 */
export interface ResponseMetadata {
  processing_time_ms: number;
  token_usage?: TokenUsage;
  api_version: string;
  generation_id: string;
}

/**
 * Generation response from AI service
 */
export interface GenerationResponse {
  success: boolean;
  test_cases: TestCase[];
  message: string;
  metadata: ResponseMetadata;
}

/**
 * Documentation context for action log conversion
 */
export interface DocumentationContext {
  project_type: ProjectType;
  script_title?: string;
  existing_description?: string;
}

/**
 * Test case documentation generated from action logs
 */
export interface TestCaseDocumentation {
  title: string;
  description: string;
  preconditions: string;
  steps: TestStep[];
  expected_result: string;
  metadata: TestCaseMetadata;
}

/**
 * Documentation response from AI service
 */
export interface DocumentationResponse {
  success: boolean;
  documentation: TestCaseDocumentation;
  message: string;
  metadata: ResponseMetadata;
}

/**
 * Configuration response for API key management
 */
export interface ConfigurationResponse {
  success: boolean;
  message: string;
  is_configured: boolean;
}

/**
 * Generation preferences for customization
 */
export interface GenerationPreferences {
  default_complexity: ComplexityLevel;
  default_project_type: ProjectType;
  include_edge_cases_by_default: boolean;
  include_error_scenarios_by_default: boolean;
  max_test_cases_default: number;
  custom_prompt_template?: string;
  preferred_test_types: TestType[];
}

/**
 * Validation result for test case data
 */
export interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * UI state for test case generator modal
 */
export interface TestCaseGeneratorState {
  isOpen: boolean;
  requirements: string;
  options: GenerationOptions;
  isGenerating: boolean;
  generatedTestCases: TestCase[];
  selectedTestCases: Set<string>;
  error?: string;
}

/**
 * UI state for test case preview component
 */
export interface TestCasePreviewState {
  testCase: TestCase;
  isExpanded: boolean;
  isSelected: boolean;
  isEditing: boolean;
}

/**
 * UI state for test case editor
 */
export interface TestCaseEditorState {
  testCase: TestCase;
  isModified: boolean;
  validationResult?: ValidationResult;
}

/**
 * Configuration UI state
 */
export interface ConfigurationUIState {
  isOpen: boolean;
  apiKey: string;
  preferences: GenerationPreferences;
  isValidating: boolean;
  isSaving: boolean;
  error?: string;
}

/**
 * Recorded action data for documentation generation
 */
export interface RecordedAction {
  id: string;
  type: string;
  timestamp: number;
  x?: number;
  y?: number;
  button?: string;
  key?: string;
  text?: string;
  screenshot?: string;
}

/**
 * Markdown content with rendering metadata
 */
export interface MarkdownContent {
  raw: string;
  rendered: string;
  has_formatting: boolean;
  formatting_types: MarkdownFormattingType[];
}

/**
 * Types of markdown formatting detected
 */
export type MarkdownFormattingType = 'bold' | 'italic' | 'code' | 'code_block' | 'list' | 'link' | 'header';

/**
 * Props for TestCaseGeneratorModal component
 */
export interface TestCaseGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCasesGenerated: (testCases: TestCase[]) => void;
  initialRequirements?: string;
  initialOptions?: Partial<GenerationOptions>;
}

/**
 * Props for TestCasePreview component
 */
export interface TestCasePreviewProps {
  testCase: TestCase;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelection: (testCaseId: string) => void;
  onToggleExpansion: (testCaseId: string) => void;
  onEdit: (testCase: TestCase) => void;
}

/**
 * Props for TestCaseEditor component
 */
export interface TestCaseEditorProps {
  testCase: TestCase;
  onSave: (testCase: TestCase) => void;
  onCancel: () => void;
  onValidate: (testCase: TestCase) => ValidationResult;
}

/**
 * Props for Configuration UI component
 */
export interface ConfigurationUIProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, preferences: GenerationPreferences) => void;
}
