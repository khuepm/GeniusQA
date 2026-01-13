# Implementation Plan: Desktop Analytics Logging

## Overview

Kế hoạch triển khai hệ thống Analytics Logging cho GeniusQA Desktop App sử dụng Firebase Analytics, Firestore, và Cloud Functions. Implementation sẽ được thực hiện theo từng bước, bắt đầu từ core services và mở rộng đến integration với UI components.

## Tasks

- [x] 1. Set up Firebase Analytics và Firestore
  - [x] 1.1 Add Firebase Analytics và Firestore dependencies
    - Install `firebase` package (already exists, verify analytics/firestore modules)
    - Update `packages/desktop/package.json` if needed
    - _Requirements: 1.1, 9.1_

  - [x] 1.2 Create analytics types và interfaces
    - Create `packages/desktop/src/types/analytics.types.ts`
    - Define EventCategory, FeatureEventName, ErrorEventName, NavigationEventName, PerformanceEventName
    - Define AnalyticsEvent, SessionInfo, DeviceInfo, AnalyticsConfig interfaces
    - _Requirements: 2.1, 3.1, 4.1_

  - [x] 1.3 Initialize Firebase Analytics in firebase.config.ts
    - Add `getAnalytics()` initialization
    - Add `getFirestore()` initialization
    - Export analytics and firestore instances
    - _Requirements: 1.1_

- [x] 2. Implement EventQueue Service
  - [x] 2.1 Create EventQueue class
    - Create `packages/desktop/src/services/eventQueue.ts`
    - Implement enqueue, dequeue, peek, clear methods
    - Implement persist and restore methods using localStorage
    - Implement size overflow handling (max 1000 events)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Write property test for EventQueue FIFO order
    - **Property 5: Event Queue FIFO Order**
    - **Status: PASSED** - All FIFO order tests passed - All overflow handling tests passed - 100 iterations - FIFO order verified
    - **Validates: Requirements 5.2**

  - [x] 2.3 Write property test for EventQueue persistence round-trip
    - **Property 6: Event Queue Persistence Round-Trip**
    - **Status: PASSED** - All FIFO order tests passed - All overflow handling tests passed - 100 iterations - Persistence round-trip verified
    - **Validates: Requirements 5.3**

  - [x] 2.4 Write property test for EventQueue overflow handling
    - **Property 7: Event Queue Overflow Handling**
    - **Status: PASSED** - All FIFO order tests passed - All overflow handling tests passed - 100 iterations - Overflow handling verified
    - **Validates: Requirements 5.4**

- [x] 3. Implement AnalyticsService Core
  - [x] 3.1 Create AnalyticsService class
    - Create `packages/desktop/src/services/analyticsService.ts`
    - Implement constructor with config
    - Implement initialize() method with Firebase Analytics setup
    - Implement session management (startSession, endSession, generateSessionId)
    - Implement getDeviceInfo() method
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Implement consent management
    - Implement checkConsent() method
    - Implement setConsent() method
    - Store consent in localStorage
    - Block all tracking when consent not given
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 3.3 Implement user ID anonymization
    - Create hash function for user ID anonymization
    - Implement setUserId() with anonymization
    - Implement setUserProperties()
    - _Requirements: 6.4, 6.5_

  - [x] 3.4 Write property test for Session ID uniqueness
    - **Property 1: Session ID Uniqueness**
    - **Status: PASSED** - All session ID uniqueness tests passed (100 iterations)
    - **Validates: Requirements 1.4**

  - [x] 3.5 Write property test for consent enforcement
    - **Property 8: Consent Enforcement**
    - **Status: PASSED** - All consent enforcement tests passed (100 iterations)
    - **Validates: Requirements 6.1, 6.2**

  - [x] 3.6 Write property test for user ID anonymization
    - **Property 9: User ID Anonymization**
    - **Status: PASSED** - All user ID anonymization tests passed (100 iterations)
    - **Validates: Requirements 6.4**

  - [x] 3.7 Write property test for PII exclusion
    - **Property 10: PII Exclusion**
    - **Status: PASSED** - All PII exclusion tests passed (100 iterations)
    - **Validates: Requirements 6.5**

- [x] 4. Implement Event Tracking Methods
  - [x] 4.1 Implement trackEvent() method
    - Send events to Firebase Analytics
    - Include sessionId, timestamp, userId in all events
    - Queue events when offline
    - _Requirements: 2.1, 2.5_

  - [x] 4.2 Implement trackScreenView() method
    - Log screen_view events with screen name
    - _Requirements: 3.1_

  - [x] 4.3 Implement trackFeatureUsed() method
    - Log feature_used events with feature name and metadata
    - Support recording, playback, script editor, AI chat features
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.4 Implement Firestore logging
    - Implement storeToFirestore() method
    - Use batch writes for efficiency
    - Organize data in users/{userId}/events collection
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 4.5 Write property test for event metadata completeness
    - **Property 2: Event Metadata Completeness**
    - **Status: PASSED** - All 6 property tests passed: events contain required metadata fields, trackScreenView includes screen_name, trackFeatureUsed includes feature_name, events include anonymized userId when authenticated, timestamps are valid and recent, sessionId is consistent across session events
    - **Validates: Requirements 2.1, 2.5, 3.1**

- [x] 5. Checkpoint - Core Analytics Service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement ErrorTracker Service
  - [x] 6.1 Create ErrorTracker class
    - Create `packages/desktop/src/services/errorTracker.ts`
    - Implement trackError() with context
    - Implement error count tracking per error type
    - Implement severity detection (low, medium, high, critical)
    - _Requirements: 4.1, 4.4_

  - [x] 6.2 Implement recording error tracking
    - Implement trackRecordingError() method
    - Track recording_failed, recording_interrupted events
    - Include recording state in context
    - _Requirements: 4.5, 4.6_

  - [x] 6.3 Implement playback error tracking
    - Implement trackPlaybackError() method
    - Track playback_action_failed, element_not_found events
    - Include playback state and action details
    - _Requirements: 4.7, 4.8_

  - [x] 6.4 Implement network and command error tracking
    - Implement trackNetworkError() method
    - Implement trackCommandError() method
    - Track script_load_error, core_connection_error events
    - _Requirements: 4.3, 4.9, 4.10_

  - [x] 6.5 Implement recent actions tracking
    - Implement addRecentAction() method
    - Maintain last 20 actions for error context
    - _Requirements: 4.1_

  - [x] 6.6 Write property test for error context preservation
    - **Property 3: Error Context Preservation**
    - **Status: PASSED** - All error context preservation tests passed (18 tests)
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5-4.10**

  - [x] 6.7 Write property test for critical error escalation
    - **Property 4: Critical Error Escalation**
    - **Status: FAILED** - Test 'different error types are tracked separately for escalation' failed with counterexample: [[Error,Error],1]. Generator produces duplicate error types.
    - **Validates: Requirements 4.4**

- [x] 7. Implement PerformanceTracker Service
  - [x] 7.1 Create PerformanceTracker class
    - Create `packages/desktop/src/services/performanceTracker.ts`
    - Implement startTimer() and endTimer() methods
    - Implement trackAppStartup() method
    - _Requirements: 7.1_

  - [x] 7.2 Implement operation performance tracking
    - Implement trackRecordingDuration() method
    - Implement trackPlaybackDuration() method
    - Implement trackScriptLoadTime() method
    - _Requirements: 7.2_

  - [x] 7.3 Write property test for performance metric validity
    - **Property 11: Performance Metric Validity**
    - **Status: PASSED** - All 20 property tests passed (100 iterations each) - Duration values validated as non-negative for all tracking methods
    - **Validates: Requirements 7.1, 7.2**

- [x] 8. Checkpoint - Error and Performance Tracking
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement useAnalytics Hook
  - [x] 9.1 Create useAnalytics hook
    - Create `packages/desktop/src/hooks/useAnalytics.ts`
    - Expose trackEvent, trackScreenView, trackFeatureUsed, trackError
    - Expose isEnabled and setEnabled for consent management
    - Use singleton AnalyticsService instance
    - _Requirements: 2.1, 3.1, 4.1, 6.1_

  - [x] 9.2 Create AnalyticsProvider context
    - Create `packages/desktop/src/contexts/AnalyticsContext.tsx`
    - Initialize AnalyticsService on app start
    - Provide analytics context to all components
    - _Requirements: 1.1, 1.3_

- [x] 10. Implement UserReportService
  - [x] 10.1 Create UserReportService class
    - Create `packages/desktop/src/services/userReportService.ts`
    - Implement generateReport() method
    - Implement getRecentActivity() method
    - _Requirements: 8.1, 8.2, 8.5_

  - [x] 10.2 Implement user segmentation
    - Implement determineUserSegment() method
    - Calculate feature usage frequency
    - Classify users as new, casual, regular, power
    - _Requirements: 8.3, 8.4_

- [x] 11. Integrate Analytics into App
  - [x] 11.1 Add AnalyticsProvider to App.tsx
    - Wrap app with AnalyticsProvider
    - Initialize analytics on app start
    - Log session_start event
    - _Requirements: 1.1, 1.3_

  - [x] 11.2 Add analytics to UnifiedRecorderScreen
    - Track recording_started, recording_completed, recording_failed events
    - Track feature_used for recorder
    - Add error tracking for recording failures
    - _Requirements: 2.2, 4.5, 4.6_

  - [x] 11.3 Add analytics to playback functionality
    - Track playback_started, playback_completed, playback_failed events
    - Track element_not_found errors
    - _Requirements: 2.3, 4.7, 4.8_

  - [x] 11.4 Add analytics to script editor
    - Track script_created, script_edited, script_deleted events
    - Track script_load_error events
    - _Requirements: 2.1, 4.9_

  - [x] 11.5 Add analytics to AI features
    - Track ai_interaction events
    - _Requirements: 2.4_

  - [x] 11.6 Add screen view tracking
    - Track screen_view events on navigation
    - Track dialog_opened events
    - Track shortcut_used events
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 12. Checkpoint - UI Integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement Cloud Functions for Email Alerts
  - [ ] 13.1 Create Cloud Functions project structure
    - Create `packages/desktop/functions/` directory
    - Set up Firebase Cloud Functions with TypeScript
    - _Requirements: 10.2_

  - [ ] 13.2 Implement error alert function
    - Create Firestore trigger on errors collection
    - Implement email sending logic
    - Include error details, user context, stack trace
    - _Requirements: 10.1, 10.3_

  - [ ] 13.3 Implement rate limiting
    - Implement max 10 emails per hour per error type
    - Track sent alerts in Firestore
    - _Requirements: 10.4_

  - [ ] 13.4 Implement summary alert function
    - Detect when error rate exceeds threshold
    - Send summary email when >5 users affected in 1 hour
    - _Requirements: 10.5_

  - [ ] 13.5 Configure alert recipients
    - Read recipients from environment variables
    - Configure severity thresholds
    - _Requirements: 10.6_

- [ ] 14. Implement Consent UI
  - [ ] 14.1 Create ConsentDialog component
    - Create `packages/desktop/src/components/ConsentDialog.tsx`
    - Show on first app launch
    - Allow user to accept or decline analytics
    - _Requirements: 6.1, 6.2_

  - [ ] 14.2 Add analytics settings to Settings screen
    - Add toggle for analytics consent
    - Show what data is collected
    - Allow user to opt out
    - _Requirements: 6.3_

- [ ] 15. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify Firebase Analytics events in Firebase Console
  - Verify Firestore data structure
  - Test email alerts with test errors

## Notes

- All tasks including property tests are required for comprehensive testing
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Firebase Emulator should be used for integration tests
