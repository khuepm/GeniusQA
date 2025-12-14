/**
 * Script Suggestions Utility
 * 
 * Provides keyword-based action suggestions and example prompts
 * for the AI Script Builder chat interface.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import {
  ActionType,
  ActionSuggestion,
  ExamplePrompt,
} from '../types/aiScriptBuilder.types';

// ============================================================================
// Action Suggestions
// ============================================================================

/**
 * Mapping of keywords to action suggestions
 * Used for keyword-based action suggestions (Requirements: 5.2)
 */
export const ACTION_SUGGESTIONS: ActionSuggestion[] = [
  // Mouse actions
  { keyword: 'click', actionType: 'mouse_click', description: 'Click chuột tại vị trí' },
  { keyword: 'nhấn', actionType: 'mouse_click', description: 'Click chuột tại vị trí' },
  { keyword: 'bấm', actionType: 'mouse_click', description: 'Click chuột tại vị trí' },
  { keyword: 'double click', actionType: 'mouse_double_click', description: 'Double click chuột' },
  { keyword: 'double-click', actionType: 'mouse_double_click', description: 'Double click chuột' },
  { keyword: 'nhấn đúp', actionType: 'mouse_double_click', description: 'Double click chuột' },
  { keyword: 'kéo', actionType: 'mouse_drag', description: 'Kéo thả chuột' },
  { keyword: 'drag', actionType: 'mouse_drag', description: 'Kéo thả chuột' },
  { keyword: 'thả', actionType: 'mouse_drag', description: 'Kéo thả chuột' },
  { keyword: 'drop', actionType: 'mouse_drag', description: 'Kéo thả chuột' },
  { keyword: 'di chuyển', actionType: 'mouse_move', description: 'Di chuyển chuột đến vị trí' },
  { keyword: 'move', actionType: 'mouse_move', description: 'Di chuyển chuột đến vị trí' },
  { keyword: 'cuộn', actionType: 'mouse_scroll', description: 'Cuộn chuột' },
  { keyword: 'scroll', actionType: 'mouse_scroll', description: 'Cuộn chuột' },
  { keyword: 'lăn', actionType: 'mouse_scroll', description: 'Cuộn chuột' },
  
  // Keyboard actions
  { keyword: 'gõ', actionType: 'key_type', description: 'Gõ văn bản' },
  { keyword: 'type', actionType: 'key_type', description: 'Gõ văn bản' },
  { keyword: 'nhập', actionType: 'key_type', description: 'Gõ văn bản' },
  { keyword: 'viết', actionType: 'key_type', description: 'Gõ văn bản' },
  { keyword: 'điền', actionType: 'key_type', description: 'Gõ văn bản' },
  { keyword: 'enter', actionType: 'key_press', description: 'Nhấn phím Enter' },
  { keyword: 'tab', actionType: 'key_press', description: 'Nhấn phím Tab' },
  { keyword: 'escape', actionType: 'key_press', description: 'Nhấn phím Escape' },
  { keyword: 'esc', actionType: 'key_press', description: 'Nhấn phím Escape' },
  { keyword: 'phím', actionType: 'key_press', description: 'Nhấn phím' },
  { keyword: 'key', actionType: 'key_press', description: 'Nhấn phím' },
  { keyword: 'press', actionType: 'key_press', description: 'Nhấn phím' },
  
  // Wait/timing actions
  { keyword: 'chờ', actionType: 'wait', description: 'Chờ đợi' },
  { keyword: 'wait', actionType: 'wait', description: 'Chờ đợi' },
  { keyword: 'đợi', actionType: 'wait', description: 'Chờ đợi' },
  { keyword: 'delay', actionType: 'wait', description: 'Chờ đợi' },
  { keyword: 'pause', actionType: 'wait', description: 'Tạm dừng' },
  { keyword: 'giây', actionType: 'wait', description: 'Chờ đợi (giây)' },
  { keyword: 'second', actionType: 'wait', description: 'Chờ đợi (giây)' },
  
  // Screenshot
  { keyword: 'chụp', actionType: 'screenshot', description: 'Chụp màn hình' },
  { keyword: 'screenshot', actionType: 'screenshot', description: 'Chụp màn hình' },
  { keyword: 'capture', actionType: 'screenshot', description: 'Chụp màn hình' },
  { keyword: 'ảnh', actionType: 'screenshot', description: 'Chụp màn hình' },
];

/**
 * Get suggestions based on user input text
 * Returns suggestions that match keywords in the input
 * Requirements: 5.2
 * 
 * @param input - User input text
 * @returns Array of matching action suggestions
 */
export function getSuggestions(input: string): ActionSuggestion[] {
  if (!input || input.trim().length === 0) {
    return [];
  }

  const normalizedInput = input.toLowerCase().trim();
  const matchedSuggestions: ActionSuggestion[] = [];
  const seenActionTypes = new Set<ActionType>();

  for (const suggestion of ACTION_SUGGESTIONS) {
    if (normalizedInput.includes(suggestion.keyword.toLowerCase())) {
      // Avoid duplicate action types
      if (!seenActionTypes.has(suggestion.actionType)) {
        matchedSuggestions.push(suggestion);
        seenActionTypes.add(suggestion.actionType);
      }
    }
  }

  return matchedSuggestions;
}

// ============================================================================
// Example Prompts
// ============================================================================

/**
 * Example prompts for common test scenarios
 * Displayed when user opens AI Script Builder for the first time
 * Requirements: 5.1
 */
export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: 'login-flow',
    title: 'Đăng nhập cơ bản',
    description: 'Kịch bản đăng nhập với username và password',
    promptText: 'Click vào ô username, nhập "testuser", sau đó click vào ô password, nhập "password123", rồi nhấn nút Login',
  },
  {
    id: 'form-fill',
    title: 'Điền form đăng ký',
    description: 'Điền thông tin vào form đăng ký tài khoản',
    promptText: 'Điền form đăng ký với tên "Nguyễn Văn A", email "test@example.com", và số điện thoại "0123456789", sau đó nhấn nút Đăng ký',
  },
  {
    id: 'navigation',
    title: 'Điều hướng menu',
    description: 'Click qua các menu và submenu',
    promptText: 'Click vào menu Settings, chờ 1 giây, sau đó click vào submenu Account, rồi click vào nút Edit Profile',
  },
  {
    id: 'search',
    title: 'Tìm kiếm sản phẩm',
    description: 'Tìm kiếm và chọn sản phẩm',
    promptText: 'Click vào ô tìm kiếm, gõ "iPhone 15", nhấn Enter, chờ 2 giây để kết quả hiển thị, sau đó click vào sản phẩm đầu tiên',
  },
  {
    id: 'drag-drop',
    title: 'Kéo thả file',
    description: 'Kéo thả element từ vị trí này sang vị trí khác',
    promptText: 'Kéo file từ vị trí (100, 200) thả vào vị trí (500, 300)',
  },
  {
    id: 'scroll-page',
    title: 'Cuộn trang',
    description: 'Cuộn trang xuống để xem nội dung',
    promptText: 'Cuộn trang xuống 500 pixel, chờ 1 giây, sau đó click vào nút "Load More"',
  },
];

/**
 * Get all example prompts
 * Requirements: 5.1
 * 
 * @returns Array of all example prompts
 */
export function getExamplePrompts(): ExamplePrompt[] {
  return EXAMPLE_PROMPTS;
}

/**
 * Get example prompt by ID
 * 
 * @param id - Example prompt ID
 * @returns Example prompt or undefined if not found
 */
export function getExamplePromptById(id: string): ExamplePrompt | undefined {
  return EXAMPLE_PROMPTS.find(prompt => prompt.id === id);
}

// ============================================================================
// Clarification Questions
// ============================================================================

/**
 * Common clarification questions the AI might ask
 * Requirements: 5.3
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  suggestedAnswers: string[];
}

/**
 * Predefined clarification questions with suggested answers
 * Requirements: 5.3
 */
export const CLARIFICATION_QUESTIONS: ClarificationQuestion[] = [
  {
    id: 'position',
    question: 'Bạn muốn click vào vị trí nào trên màn hình?',
    suggestedAnswers: [
      'Góc trên bên trái',
      'Giữa màn hình',
      'Góc dưới bên phải',
      'Tọa độ cụ thể (x, y)',
    ],
  },
  {
    id: 'wait-time',
    question: 'Bạn muốn chờ bao lâu?',
    suggestedAnswers: [
      '1 giây',
      '2 giây',
      '5 giây',
      'Cho đến khi element xuất hiện',
    ],
  },
  {
    id: 'button-type',
    question: 'Bạn muốn click bằng nút chuột nào?',
    suggestedAnswers: [
      'Chuột trái',
      'Chuột phải',
      'Chuột giữa',
    ],
  },
  {
    id: 'text-input',
    question: 'Bạn muốn nhập nội dung gì?',
    suggestedAnswers: [
      'Nhập text cụ thể',
      'Nhập từ biến',
      'Nhập ngẫu nhiên',
    ],
  },
  {
    id: 'repeat',
    question: 'Bạn có muốn lặp lại hành động này không?',
    suggestedAnswers: [
      'Không lặp lại',
      'Lặp lại 3 lần',
      'Lặp lại 5 lần',
      'Lặp lại cho đến khi thành công',
    ],
  },
];

/**
 * Get clarification question by ID
 * 
 * @param id - Question ID
 * @returns Clarification question or undefined
 */
export function getClarificationQuestion(id: string): ClarificationQuestion | undefined {
  return CLARIFICATION_QUESTIONS.find(q => q.id === id);
}

/**
 * Get all clarification questions
 * 
 * @returns Array of all clarification questions
 */
export function getAllClarificationQuestions(): ClarificationQuestion[] {
  return CLARIFICATION_QUESTIONS;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if input contains any action keywords
 * 
 * @param input - User input text
 * @returns True if input contains action keywords
 */
export function hasActionKeywords(input: string): boolean {
  return getSuggestions(input).length > 0;
}

/**
 * Get unique action types from suggestions
 * 
 * @param suggestions - Array of action suggestions
 * @returns Array of unique action types
 */
export function getUniqueActionTypes(suggestions: ActionSuggestion[]): ActionType[] {
  return [...new Set(suggestions.map(s => s.actionType))];
}
