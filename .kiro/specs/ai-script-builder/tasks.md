# Implementation Plan

## 1. Set up project structure and types
- [x] 1. Set up project structure and types
- [x] 1.1 Create AI Script Builder types and interfaces
  - Create `packages/desktop/src/types/aiScriptBuilder.types.ts`
  - Define ChatMessage, GenerationResult, ValidationResult interfaces
  - Define PromptTemplate and ConversationContext types
  - _Requirements: 2.1, 3.1, 3.2_

- [x] 1.2 Create script validation types
  - Add ValidationError, ValidationWarning interfaces
  - Add CompatibilityResult interface
  - _Requirements: 3.3, 6.1_

## 2. Implement Firebase API Key Service

- [x] 2. Implement Firebase API Key Service
- [x] 2.1 Create API Key Service
  - Create `packages/desktop/src/services/apiKeyService.ts`
  - Implement storeApiKey function with encryption
  - Implement getApiKey function with decryption
  - Implement hasApiKey and deleteApiKey functions
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 2.2 Write property test for API Key Storage Round-Trip
  - **Property 1: API Key Storage Round-Trip**
  - **Validates: Requirements 1.1, 1.2, 1.4**

- [x] 2.3 Write unit tests for API Key Service
  - Test encryption/decryption
  - Test Firebase operations
  - Test error handling for missing keys
  - _Requirements: 1.3, 1.5_

## 3. Implement Script Validation Service

- [x] 3. Implement Script Validation Service
- [x] 3.1 Create Script Validation Service
  - Create `packages/desktop/src/services/scriptValidationService.ts`
  - Implement validateScript function
  - Implement validateAction function
  - Implement checkCompatibility function
  - _Requirements: 3.3, 6.1, 6.2, 6.3, 6.4_

- [x] 3.2 Write property test for Generated Script Validity
  - **Property 5: Generated Script Validity**
  - **Validates: Requirements 3.3, 6.1, 6.2, 6.3, 6.4**

- [x] 3.3 Write property test for Script Modification Validation
  - **Property 6: Script Modification Validation**
  - **Validates: Requirements 4.2**

- [x] 3.4 Write property test for Script Serialization Round-Trip
  - **Property 7: Script Serialization Round-Trip**
  - **Validates: Requirements 4.3, 6.5**

## 4. Implement Gemini Service

- [x] 4. Implement Gemini Service
- [x] 4.1 Create Gemini Service
  - Create `packages/desktop/src/services/geminiService.ts`
  - Implement initialize function with API key
  - Implement generateScript function with prompt construction
  - Implement refineScript function for iterative improvements
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 4.2 Create prompt templates
  - Define SYSTEM_PROMPT with action schema
  - Create example scripts for few-shot learning
  - Implement context builder for conversation history
  - _Requirements: 3.1, 5.1_

- [x] 4.3 Write property test for Prompt Context Inclusion
  - **Property 3: Prompt Context Inclusion**
  - **Validates: Requirements 3.1**

- [x] 4.4 Write property test for Script Parsing Validity
  - **Property 4: Script Parsing Validity**
  - **Validates: Requirements 3.2**

## 5. Checkpoint - Ensure all service tests pass
- [x] 5. Checkpoint - Ensure all service tests pass
- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## 6. Implement Chat Interface Component
- [x] 6. Implement Chat Interface Component
- [x] 6.1 Create Chat Interface UI
  - Create `packages/desktop/src/components/AIChatInterface.tsx`
  - Create `packages/desktop/src/components/AIChatInterface.css`
  - Implement message list with user/assistant styling
  - Implement input field with send button
  - Implement loading indicator during AI processing
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6.2 Implement chat state management
  - Create useChatState hook for message management
  - Implement message history with chronological ordering
  - Handle scroll behavior for new messages
  - _Requirements: 2.2, 2.4, 2.5_

- [x] 6.3 Write property test for Message History Consistency
  - **Property 2: Message History Consistency**
  - **Validates: Requirements 2.2, 2.4, 2.5**

## 7. Implement Script Preview Component

- [x] 7. Implement Script Preview Component
- [x] 7.1 Create Script Preview Panel
  - Create `packages/desktop/src/components/ScriptPreview.tsx`
  - Create `packages/desktop/src/components/ScriptPreview.css`
  - Display script actions with human-readable descriptions
  - Show validation errors and warnings inline
  - _Requirements: 3.5, 4.1_

- [x] 7.2 Implement script editing functionality
  - Add inline editing for action parameters
  - Implement real-time validation on edit
  - Add save and discard buttons
  - _Requirements: 4.2, 4.3, 4.5_

- [x] 7.3 Write property test for Script Preview Completeness
  - **Property 10: Script Preview Completeness**
  - **Validates: Requirements 3.5, 4.4**

## 8. Implement Suggestions and Examples
- [x] 8. Implement Suggestions and Examples
- [x] 8.1 Create suggestion system
  - Create `packages/desktop/src/utils/scriptSuggestions.ts`
  - Implement keyword-based action suggestions
  - Create example prompts for common scenarios
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 8.2 Integrate suggestions into Chat Interface
  - Add suggestion dropdown below input field
  - Implement example prompt selection
  - Show clarification questions from AI
  - _Requirements: 5.2, 5.3, 5.4_

- [x] 8.3 Write property test for Suggestion Relevance
  - **Property 8: Suggestion Relevance**
  - **Validates: Requirements 5.2**

- [x] 8.4 Write property test for Example Prompt Population
  - **Property 9: Example Prompt Population**
  - **Validates: Requirements 5.4**

## 9. Implement AI Script Builder Screen
- [x] 9. Implement AI Script Builder Screen

- [x] 9.1 Create AI Script Builder Screen
  - Create `packages/desktop/src/screens/AIScriptBuilderScreen.tsx`
  - Create `packages/desktop/src/screens/AIScriptBuilderScreen.css`
  - Integrate Chat Interface and Script Preview components
  - Add API key configuration prompt when not configured
  - _Requirements: 1.3, 2.1, 4.1_

- [x] 9.2 Add navigation and routing
  - Add route to AIScriptBuilderScreen in AppNavigator
  - Add navigation button from Dashboard
  - _Requirements: 2.1_

## 10. Implement Script Save Integration
- [x] 10. Implement Script Save Integration

- [x] 10.1 Integrate with existing script storage
  - Connect ScriptPreview save to IPC bridge
  - Implement script naming dialog
  - Save generated scripts to user's library
  - _Requirements: 4.3, 6.5_

- [x] 10.2 Write integration tests for save flow
  - Test generate → edit → save → load flow
  - Test script compatibility with rust-core playback
  - _Requirements: 4.3, 6.5_

## 11. Final Checkpoint - Ensure all tests pass
- [x] 11. Final Checkpoint - Ensure all tests pass

- [x] 11.1 Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

---

# Extended Features (v2)

## 12. Implement OS Selector Component

- [x] 12. Implement OS Selector Component

- [x] 12.1 Create OS Selector UI Component
  - Create `packages/desktop/src/components/OSSelector.tsx`
  - Create `packages/desktop/src/components/OSSelector.css`
  - Implement dropdown/button group with macOS, Windows, Universal options
  - Display current OS selection with appropriate icons
  - _Requirements: 8.1_

- [x] 12.2 Create OS key mappings utility
  - Create `packages/desktop/src/utils/osKeyMappings.ts`
  - Define key mappings for macOS (Cmd-based shortcuts)
  - Define key mappings for Windows (Ctrl-based shortcuts)
  - Define universal/cross-platform mappings
  - _Requirements: 8.3, 8.4, 8.5_

- [ ] 12.3 Write property test for OS Context in Prompt
  - **Property 14: OS Context in Prompt**
  - **Validates: Requirements 8.2**

- [ ] 12.4 Write property test for OS-Specific Key Code Validation
  - **Property 13: OS-Specific Key Code Validation**
  - **Validates: Requirements 8.3, 8.4, 8.5**

## 13. Update Gemini Service for OS-Specific Generation

- [ ] 13. Update Gemini Service for OS-Specific Generation

- [ ] 13.1 Update prompt templates with OS context
  - Modify `packages/desktop/src/services/promptTemplates.ts`
  - Add OS-specific system prompts
  - Include OS key mappings in prompt context
  - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [ ] 13.2 Update Gemini Service to accept target OS
  - Modify `packages/desktop/src/services/geminiService.ts`
  - Add targetOS parameter to generateScript function
  - Include OS context in API calls
  - _Requirements: 8.2_

## 14. Implement Save and Play Functionality

- [ ] 14. Implement Save and Play Functionality

- [ ] 14.1 Update Script Preview with Play button
  - Modify `packages/desktop/src/components/ScriptPreview.tsx`
  - Add Play button (visible after save)
  - Add playback progress indicator
  - Display playback errors with edit option
  - _Requirements: 7.1, 7.4, 7.5, 7.6_

- [ ] 14.2 Create Playback Service
  - Create `packages/desktop/src/services/playbackService.ts`
  - Implement startPlayback, stopPlayback, togglePause
  - Implement progress event subscription
  - Connect to IPC bridge for playback control
  - _Requirements: 7.5_

- [ ] 14.3 Update Script Storage Service for AI metadata
  - Modify `packages/desktop/src/services/scriptStorageService.ts`
  - Add source='ai_generated' to saved scripts
  - Add target_os to metadata
  - Add generated_at timestamp
  - _Requirements: 7.3, 8.6_

- [ ] 14.4 Write property test for Save and Play Button State
  - **Property 11: Save and Play Button State**
  - **Validates: Requirements 7.1, 7.4**

- [ ] 14.5 Write property test for AI Script Metadata Consistency
  - **Property 12: AI Script Metadata Consistency**
  - **Validates: Requirements 7.3, 8.6**

## 15. Checkpoint - Ensure playback tests pass
- [x] 15. Checkpoint - Ensure playback tests pass
  - Ensure all tests pass, ask the user if questions arise.

## 16. Implement Script List with Source Filtering

- [x] 16. Implement Script List with Source Filtering

- [x] 16.1 Update Script Storage Service for source filtering
  - Modify `packages/desktop/src/services/scriptStorageService.ts`
  - Add listScriptsBySource function
  - Parse script metadata to determine source type
  - _Requirements: 9.1, 9.4_

- [x] 16.2 Create Script Filter Component
  - Create `packages/desktop/src/components/ScriptFilter.tsx`
  - Create `packages/desktop/src/components/ScriptFilter.css`
  - Implement filter buttons: All, Recorded, AI Generated
  - Add target OS filter option
  - _Requirements: 9.4_

- [x] 16.3 Update Script List to show source indicators
  - Create visual badges for recorded vs AI-generated scripts
  - Display target OS for AI scripts
  - _Requirements: 9.2, 9.5_

- [ ]* 16.4 Write property test for Script List Completeness
  - **Property 15: Script List Completeness**
  - **Validates: Requirements 9.1, 9.2, 10.2**

- [ ]* 16.5 Write property test for Script Filter Correctness
  - **Property 16: Script Filter Correctness**
  - **Validates: Requirements 9.4**

## 17. Update Desktop Recorder for AI Scripts

- [x] 17. Update Desktop Recorder for AI Scripts

- [x] 17.1 Update Recorder script selector
  - Modify `packages/desktop/src/screens/RecorderScreen.tsx`
  - Include AI-generated scripts in script list
  - Add source type badges to script items
  - Display target OS info for AI scripts
  - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [x] 17.2 Ensure AI script playback compatibility
  - Verify AI scripts load correctly in Recorder
  - Test playback controls work with AI scripts
  - _Requirements: 9.3_

- [ ]* 17.3 Write property test for AI Script Playback Compatibility
  - **Property 17: AI Script Playback Compatibility**
  - **Validates: Requirements 9.3**

## 18. Implement Unified Script Manager

- [x] 18. Implement Unified Script Manager

- [x] 18.1 Create Unified Script Manager Component
  - Create `packages/desktop/src/screens/UnifiedScriptManager.tsx`
  - Create `packages/desktop/src/screens/UnifiedScriptManager.css`
  - Implement tab navigation: Script List, AI Builder, Editor
  - Manage shared state between tabs
  - _Requirements: 10.1_

- [x] 18.2 Integrate Script List Tab
  - Move script list functionality to tab
  - Connect to filter component
  - Handle script selection to open in Editor
  - _Requirements: 10.2, 10.3_

- [x] 18.3 Integrate AI Builder Tab
  - Move AI Script Builder functionality to tab
  - Add OS selector to AI Builder
  - Connect generated script to Editor tab
  - _Requirements: 10.4, 10.5_

- [x] 18.4 Integrate Editor Tab
  - Move Script Editor functionality to tab
  - Ensure same editing tools for all script types
  - Handle save and update script list
  - _Requirements: 10.3, 10.6_

- [ ]* 18.5 Write property test for Unified Editor Consistency
  - **Property 18: Unified Editor Consistency**
  - **Validates: Requirements 10.3, 10.6**

- [ ]* 18.6 Write property test for Tab Navigation Workflow
  - **Property 19: Tab Navigation Workflow**
  - **Validates: Requirements 10.5**

## 19. Update Navigation and Routing

- [x] 19. Update Navigation and Routing

- [x] 19.1 Update AppNavigator for Unified Manager
  - Modify `packages/desktop/src/navigation/AppNavigator.tsx`
  - Replace separate Script Editor route with Unified Manager
  - Update AI Script Builder route to use Unified Manager
  - _Requirements: 10.1_

- [x] 19.2 Update Dashboard navigation
  - Modify `packages/desktop/src/screens/DashboardScreen.tsx`
  - Update navigation buttons to point to Unified Manager
  - Add quick access to specific tabs
  - _Requirements: 10.1_

## 20. Integration Testing

- [x] 20. Integration Testing

- [x] 20.1 Write integration tests for OS selection flow
  - Test: Select OS → Generate → Verify OS-specific actions
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 20.2 Write integration tests for save and play flow
  - Test: Generate → Save → Play → Monitor progress
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 20.3 Write integration tests for unified interface
  - Test: List → Select → Edit → Save workflow
  - Test: AI Builder → Editor transition
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 20.4 Write integration tests for recorder integration
  - Test: Load AI script in Recorder → Playback
  - _Requirements: 9.1, 9.2, 9.3_

## 21. Final Checkpoint - Ensure all extended tests pass

- [x] 21. Final Checkpoint - Ensure all extended tests pass
  - Ensure all tests pass, ask the user if questions arise.

