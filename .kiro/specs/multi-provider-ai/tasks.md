# Implementation Plan

## 1. Extend Types and Interfaces

- [x] 1. Extend Types and Interfaces
- [x] 1.1 Create provider adapter types
  - Create `packages/desktop/src/types/providerAdapter.types.ts`
  - Define AIProviderAdapter interface
  - Define ProviderResponse, ResponseMetadata interfaces
  - Define ProviderError, ProviderErrorType types
  - _Requirements: 5.1, 5.2_

- [x] 1.2 Create provider configuration types
  - Define ProviderConfig, ProviderModel interfaces
  - Define ProviderStatus, SessionStatistics interfaces
  - Define UserProviderPreferences interface
  - Add PROVIDER_CONFIGS constant with all provider definitions
  - _Requirements: 3.1, 6.1_

## 2. Implement Provider Adapters

- [x] 2. Implement Provider Adapters
- [x] 2.1 Create base adapter utilities
  - Create `packages/desktop/src/services/providers/baseAdapter.ts`
  - Implement shared prompt template builder
  - Implement shared response parser for script extraction
  - _Requirements: 5.3, 5.4_

- [x] 2.2 Write property test for Unified Prompt Structure
  - **Property 14: Unified Prompt Structure**
  - **Validates: Requirements 5.3**

- [x] 2.3 Write property test for Unified Response Parsing
  - **Property 15: Unified Response Parsing**
  - **Validates: Requirements 5.4**

- [x] 2.4 Refactor Gemini adapter from existing service
  - Create `packages/desktop/src/services/providers/geminiAdapter.ts`
  - Implement AIProviderAdapter interface
  - Migrate existing geminiService logic
  - Add model selection support
  - _Requirements: 3.1, 3.2, 5.2_

- [x] 2.5 Implement OpenAI adapter
  - Create `packages/desktop/src/services/providers/openaiAdapter.ts`
  - Implement AIProviderAdapter interface
  - Implement OpenAI API integration with chat completions
  - Add GPT-4o, GPT-4o-mini, GPT-4-turbo model support
  - _Requirements: 3.1, 3.2, 5.2_

- [x] 2.6 Implement Anthropic adapter
  - Create `packages/desktop/src/services/providers/anthropicAdapter.ts`
  - Implement AIProviderAdapter interface
  - Implement Anthropic API integration with messages endpoint
  - Add Claude 3.5 Sonnet, Claude 3.5 Haiku model support
  - _Requirements: 3.1, 3.2, 5.2_

- [x] 2.7 Write property test for Unified Output Format
  - **Property 13: Unified Output Format**
  - **Validates: Requirements 5.2**

## 3. Implement Provider Manager

- [x] 3. Implement Provider Manager
- [x] 3.1 Create Provider Manager service
  - Create `packages/desktop/src/services/providerManager.ts`
  - Implement adapter registration and retrieval
  - Implement active provider selection
  - Implement provider status tracking
  - _Requirements: 2.2, 6.1_

- [x] 3.2 Write property test for Provider Selection Updates Active Provider
  - **Property 4: Provider Selection Updates Active Provider**
  - **Validates: Requirements 2.2**

- [x] 3.3 Write property test for Provider Status Accuracy
  - **Property 16: Provider Status Accuracy**
  - **Validates: Requirements 6.1**

- [x] 3.4 Implement session statistics tracking
  - Add request count per provider
  - Add success rate calculation
  - Add average response time tracking
  - _Requirements: 6.4_

- [x] 3.5 Write property test for Request Count Accuracy
  - **Property 18: Request Count Accuracy**
  - **Validates: Requirements 6.4**

## 4. Extend API Key Service for Multi-Provider

- [x] 4. Extend API Key Service for Multi-Provider
- [x] 4.1 Update API Key Service
  - Modify `packages/desktop/src/services/apiKeyService.ts`
  - Update Firebase document structure for multi-provider storage
  - Implement getConfiguredProviders function
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 4.2 Write property test for Multi-Provider API Key Storage Round-Trip
  - **Property 1: Multi-Provider API Key Storage Round-Trip**
  - **Validates: Requirements 1.2**

- [x] 4.3 Write property test for Configured Providers Accuracy
  - **Property 2: Configured Providers Accuracy**
  - **Validates: Requirements 1.3, 1.4**

## 5. Checkpoint - Ensure all service tests pass
- [x] 5. Checkpoint - Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

## 6. Implement Unified AI Service

- [x] 6. Implement Unified AI Service
- [x] 6.1 Create Unified AI Service
  - Create `packages/desktop/src/services/unifiedAIService.ts`
  - Implement provider initialization with API keys
  - Implement provider and model selection
  - Delegate generateScript and refineScript to active adapter
  - _Requirements: 2.2, 3.2, 5.2_

- [x] 6.2 Implement auto-selection logic
  - Auto-select when only one provider configured
  - Load user preferences for default provider
  - _Requirements: 2.3_

- [x] 6.3 Write property test for Single Provider Auto-Selection
  - **Property 5: Single Provider Auto-Selection**
  - **Validates: Requirements 2.3**

- [x] 6.4 Implement error handling and fallback suggestions
  - Detect error types (rate limit, auth, network)
  - Suggest alternative providers on failure
  - Log errors with provider and error type
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6.5 Write property test for Error Logging Completeness
  - **Property 11: Error Logging Completeness**
  - **Validates: Requirements 4.4**

- [x] 6.6 Write property test for Alternative Provider Suggestion on Failure
  - **Property 12: Alternative Provider Suggestion on Failure**
  - **Validates: Requirements 4.5**

- [x] 6.7 Implement response attribution
  - Include provider and model info in responses
  - _Requirements: 6.3_

- [x] 6.8 Write property test for Response Attribution
  - **Property 17: Response Attribution**
  - **Validates: Requirements 6.3**

## 7. Implement Provider Selector Component

- [x] 7. Implement Provider Selector Component
- [x] 7.1 Create Provider Selector UI
  - Create `packages/desktop/src/components/ProviderSelector.tsx`
  - Create `packages/desktop/src/components/ProviderSelector.css`
  - Display configured providers with status indicators
  - Implement provider selection dropdown
  - _Requirements: 2.1, 2.5, 6.1_

- [x] 7.2 Write property test for Provider Selector Shows Configured Providers
  - **Property 3: Provider Selector Shows Configured Providers**
  - **Validates: Requirements 2.1**

- [x] 7.3 Create Model Selector UI
  - Create `packages/desktop/src/components/ModelSelector.tsx`
  - Create `packages/desktop/src/components/ModelSelector.css`
  - Display available models for selected provider
  - Show model descriptions on hover
  - _Requirements: 3.1, 3.3, 3.4_

- [x] 7.4 Write property test for Model List Per Provider
  - **Property 7: Model List Per Provider**
  - **Validates: Requirements 3.1**

- [x] 7.5 Write property test for Default Model Pre-Selection
  - **Property 9: Default Model Pre-Selection**
  - **Validates: Requirements 3.3**

## 8. Implement Provider Settings Component

- [x] 8. Implement Provider Settings Component
- [x] 8.1 Create Provider Settings UI
  - Create `packages/desktop/src/components/ProviderSettings.tsx`
  - Create `packages/desktop/src/components/ProviderSettings.css`
  - Display list of all supported providers
  - Show configuration status for each provider
  - Implement API key input and save for each provider
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 8.2 Implement API key management UI
  - Add API key input fields per provider
  - Add delete API key functionality
  - Show validation feedback
  - _Requirements: 1.2, 1.4_

## 9. Update Chat Interface for Multi-Provider

- [x] 9. Update Chat Interface for Multi-Provider
- [x] 9.1 Integrate Provider Selector into Chat Interface
  - Update `packages/desktop/src/components/AIChatInterface.tsx`
  - Add provider selector to header
  - Add model selector next to provider
  - Display current provider/model in header
  - _Requirements: 2.1, 2.5, 3.1_

- [x] 9.2 Update chat state for provider switching
  - Preserve conversation history on provider switch
  - Update loading indicator to show provider name
  - _Requirements: 2.4, 6.2_

- [x] 9.3 Write property test for Conversation History Preservation on Provider Switch
  - **Property 6: Conversation History Preservation on Provider Switch**
  - **Validates: Requirements 2.4**

- [x] 9.4 Implement model selection persistence
  - Save model preference per provider
  - Load saved preference on provider switch
  - _Requirements: 3.5_

- [x] 9.5 Write property test for Model Preference Persistence
  - **Property 10: Model Preference Persistence**
  - **Validates: Requirements 3.5**

## 10. Update AI Script Builder Screen

- [x] 10. Update AI Script Builder Screen
- [x] 10.1 Integrate Unified AI Service
  - Update `packages/desktop/src/screens/AIScriptBuilderScreen.tsx`
  - Replace geminiService with unifiedAIService
  - Add provider settings access
  - _Requirements: 2.1, 2.2_

- [x] 10.2 Add provider configuration prompt
  - Show prompt when no providers configured
  - Link to provider settings
  - _Requirements: 1.5_

- [x] 10.3 Add error handling UI
  - Display provider-specific error messages
  - Show retry and switch provider options
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

## 11. Implement Usage Statistics Display

- [x] 11. Implement Usage Statistics Display
- [x] 11.1 Create Usage Statistics Component
  - Create `packages/desktop/src/components/UsageStatistics.tsx`
  - Display request count per provider
  - Display success rate and average response time
  - _Requirements: 6.4_

- [x] 11.2 Integrate statistics into AI Script Builder
  - Add statistics panel or tooltip
  - Update statistics on each request
  - _Requirements: 6.4_

## 12. Final Checkpoint - Ensure all tests pass
- [x] 12. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## 13. Implement User Profile Service

- [x] 13. Implement User Profile Service
- [x] 13.1 Create User Profile Service
  - Create `packages/desktop/src/services/userProfileService.ts`
  - Implement storeUserProfile function to save user data to Firebase Firestore
  - Implement getUserProfile function to retrieve user data from Firebase
  - Implement updateUserProfile function for partial updates
  - Define UserProfile interface with uid, email, displayName, photoURL, timestamps
  - _Requirements: 7.1, 7.2, 7.3_

- [ ]* 13.2 Write property test for User Profile Storage Round-Trip
  - **Property 19: User Profile Storage Round-Trip**
  - **Validates: Requirements 7.1, 7.3**

- [ ]* 13.3 Write property test for User Profile Sync on Update
  - **Property 20: User Profile Sync on Update**
  - **Validates: Requirements 7.2**

- [x] 13.4 Integrate User Profile Service with AuthContext
  - Update `packages/desktop/src/contexts/AuthContext.tsx`
  - Call storeUserProfile on successful login
  - Call getUserProfile to load profile on app start
  - Clear local data on logout while preserving Firebase data
  - _Requirements: 7.1, 7.3, 7.4_

## 14. Implement User Preferences Service

- [x] 14. Implement User Preferences Service
- [x] 14.1 Create User Preferences Service
  - Create `packages/desktop/src/services/userPreferencesService.ts`
  - Implement storeUserPreferences function to save preferences to Firebase
  - Implement getUserPreferences function to retrieve preferences from Firebase
  - Implement setDefaultProvider function
  - Implement setModelPreference function
  - Define UserProviderPreferences interface
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ]* 14.2 Write property test for User Preferences Storage Round-Trip
  - **Property 21: User Preferences Storage Round-Trip**
  - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ]* 14.3 Write property test for User Preferences Sync on Change
  - **Property 22: User Preferences Sync on Change**
  - **Validates: Requirements 8.4**

- [x] 14.4 Integrate User Preferences with Unified AI Service
  - Update `packages/desktop/src/services/unifiedAIService.ts`
  - Load user preferences on initialization
  - Apply default provider from preferences
  - Apply model preferences per provider
  - _Requirements: 8.3, 8.5_

- [x] 14.5 Update Provider Selector to save preferences
  - Update `packages/desktop/src/components/ProviderSelector.tsx`
  - Save default provider preference when user selects provider
  - _Requirements: 8.1, 8.4_

- [x] 14.6 Update Model Selector to save preferences
  - Update `packages/desktop/src/components/ModelSelector.tsx`
  - Save model preference when user selects model
  - _Requirements: 8.2, 8.4_

## 15. Final Checkpoint - Ensure all new tests pass
- [x] 15. Final Checkpoint - Ensure all new tests pass
  - Ensure all tests pass, ask the user if questions arise.

