# Requirements Document

## Introduction

Tính năng Desktop Analytics Logging cho phép ghi lại và phân tích các sự kiện tương tác của người dùng trên desktop app (Tauri). Dữ liệu được gửi đến Firebase Analytics để theo dõi hành vi sử dụng, phát hiện lỗi, và cải thiện trải nghiệm người dùng.

## Glossary

- **Analytics_Service**: Service quản lý việc ghi log và gửi events đến Firebase Analytics
- **Event**: Một hành động hoặc sự kiện của người dùng được ghi lại (click, navigation, error, etc.)
- **User_Session**: Phiên làm việc của người dùng từ khi mở app đến khi đóng app
- **Event_Queue**: Hàng đợi lưu trữ events khi offline để gửi sau khi có kết nối
- **Firebase_Analytics**: Dịch vụ phân tích của Google Firebase để thu thập và phân tích dữ liệu

## Requirements

### Requirement 1: Khởi tạo Analytics Service

**User Story:** As a developer, I want to initialize Firebase Analytics when the app starts, so that I can track user interactions from the beginning of each session.

#### Acceptance Criteria

1. WHEN the desktop app starts, THE Analytics_Service SHALL initialize Firebase Analytics with the configured project credentials
2. WHEN Firebase initialization fails, THE Analytics_Service SHALL log the error locally and continue app operation without analytics
3. WHEN the app starts, THE Analytics_Service SHALL automatically log a session_start event with device info and app version
4. THE Analytics_Service SHALL generate a unique session ID for each app launch

### Requirement 2: Ghi log Feature Usage Events

**User Story:** As a product manager, I want to track which features users interact with most, so that I can prioritize development efforts.

#### Acceptance Criteria

1. WHEN a user clicks on a major feature (recorder, script editor, playback, AI chat), THE Analytics_Service SHALL log a feature_used event with feature name and timestamp
2. WHEN a user completes a recording session, THE Analytics_Service SHALL log recording_completed event with duration and action count
3. WHEN a user runs a script playback, THE Analytics_Service SHALL log playback_started and playback_completed events with script metadata
4. WHEN a user interacts with AI features, THE Analytics_Service SHALL log ai_interaction event with interaction type
5. THE Analytics_Service SHALL include user_id (anonymized) in all events for session correlation

### Requirement 3: Ghi log Navigation Events

**User Story:** As a UX designer, I want to understand user navigation patterns, so that I can optimize the app's information architecture.

#### Acceptance Criteria

1. WHEN a user navigates to a different screen, THE Analytics_Service SHALL log a screen_view event with screen name
2. WHEN a user opens a modal or dialog, THE Analytics_Service SHALL log a dialog_opened event with dialog type
3. WHEN a user uses keyboard shortcuts, THE Analytics_Service SHALL log shortcut_used event with shortcut key combination

### Requirement 4: Ghi log Error Events

**User Story:** As a developer, I want to track errors users encounter, so that I can identify and fix issues quickly.

#### Acceptance Criteria

1. WHEN an unhandled error occurs, THE Analytics_Service SHALL log an error_occurred event with error type, message, and stack trace
2. WHEN a Tauri command fails, THE Analytics_Service SHALL log a command_error event with command name and error details
3. WHEN a network request fails, THE Analytics_Service SHALL log a network_error event with endpoint and status code
4. IF an error occurs more than 3 times in a session, THEN THE Analytics_Service SHALL flag it as a critical_error event
5. WHEN recording fails to start (permission denied, device unavailable), THE Analytics_Service SHALL log recording_failed event with failure reason
6. WHEN recording stops unexpectedly, THE Analytics_Service SHALL log recording_interrupted event with last known state
7. WHEN playback fails to execute an action, THE Analytics_Service SHALL log playback_action_failed event with action type and error details
8. WHEN playback cannot find target element, THE Analytics_Service SHALL log element_not_found event with selector info
9. WHEN script loading fails, THE Analytics_Service SHALL log script_load_error event with file path and error message
10. WHEN Python core connection fails, THE Analytics_Service SHALL log core_connection_error event with connection details

### Requirement 5: Offline Event Queuing

**User Story:** As a user, I want my usage data to be recorded even when offline, so that analytics are complete and accurate.

#### Acceptance Criteria

1. WHEN the app is offline, THE Event_Queue SHALL store events locally with timestamps
2. WHEN the app regains network connectivity, THE Event_Queue SHALL send all queued events to Firebase in order
3. THE Event_Queue SHALL persist events to local storage to survive app restarts
4. IF the queue exceeds 1000 events, THEN THE Event_Queue SHALL remove the oldest events to prevent storage overflow

### Requirement 6: Privacy và User Consent

**User Story:** As a user, I want control over my data collection, so that my privacy is respected.

#### Acceptance Criteria

1. WHEN the app first launches, THE Analytics_Service SHALL check for user consent before collecting data
2. WHERE user has not given consent, THE Analytics_Service SHALL not send any events to Firebase
3. WHEN a user opts out of analytics, THE Analytics_Service SHALL stop collecting and delete any queued events
4. THE Analytics_Service SHALL anonymize user identifiers before sending to Firebase
5. THE Analytics_Service SHALL not collect any personally identifiable information (PII)

### Requirement 7: Performance Monitoring

**User Story:** As a developer, I want to track app performance metrics, so that I can identify and fix performance issues.

#### Acceptance Criteria

1. WHEN the app starts, THE Analytics_Service SHALL log app_startup_time with duration in milliseconds
2. WHEN a major operation completes (recording, playback, script load), THE Analytics_Service SHALL log operation_performance with duration
3. THE Analytics_Service SHALL batch events and send them periodically (every 30 seconds) to minimize network overhead
4. THE Analytics_Service SHALL not impact app performance by more than 1% CPU usage



### Requirement 8: User Report Generation

**User Story:** As a product manager, I want to generate usage reports per user, so that I can understand individual user behavior and provide better support.

#### Acceptance Criteria

1. THE Analytics_Service SHALL aggregate events by user_id to create user-specific reports
2. WHEN requested, THE Analytics_Service SHALL generate a usage summary report including: total sessions, features used, errors encountered, and session durations
3. THE Analytics_Service SHALL calculate feature usage frequency per user (daily, weekly, monthly)
4. THE Analytics_Service SHALL identify user segments based on usage patterns (power users, casual users, new users)
5. WHEN a user reports an issue, THE Analytics_Service SHALL provide recent activity log for that user to support team

### Requirement 9: Firestore Log Storage

**User Story:** As a developer, I want to store detailed logs in Firestore, so that I can query and analyze historical data for debugging and insights.

#### Acceptance Criteria

1. THE Analytics_Service SHALL send detailed event logs to Firestore in addition to Firebase Analytics
2. THE Analytics_Service SHALL organize Firestore data in collections: users/{userId}/events, errors/{date}, sessions/{sessionId}
3. WHEN storing to Firestore, THE Analytics_Service SHALL include full event payload with metadata
4. THE Analytics_Service SHALL implement Firestore batch writes to optimize write operations
5. THE Analytics_Service SHALL set TTL (time-to-live) of 90 days for event logs to manage storage costs
6. WHEN an error is logged, THE Analytics_Service SHALL store additional context (device info, app state, recent actions) in Firestore

### Requirement 10: Email Alert System

**User Story:** As a developer, I want to receive email alerts for critical errors, so that I can respond quickly to production issues.

#### Acceptance Criteria

1. WHEN a critical_error event is detected, THE Analytics_Service SHALL trigger an email alert to configured recipients
2. THE Analytics_Service SHALL use Firebase Cloud Functions to send email notifications
3. THE Analytics_Service SHALL include error details, user context, and stack trace in alert emails
4. THE Analytics_Service SHALL implement rate limiting (max 10 emails per hour per error type) to prevent alert fatigue
5. WHEN error rate exceeds threshold (more than 5 users affected in 1 hour), THE Analytics_Service SHALL send a summary alert email
6. THE Analytics_Service SHALL allow configuration of alert recipients and severity thresholds via environment variables
