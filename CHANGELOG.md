# Changelog

All notable changes to GeniusQA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-16

### Added

#### Desktop Analytics & Logging System
- Firebase Analytics integration with event tracking
- Firestore logging for persistent event storage
- EventQueue service with FIFO ordering and offline support (max 1000 events)
- AnalyticsService with session management and device info tracking
- ErrorTracker service with severity detection (low/medium/high/critical)
- PerformanceTracker service for app startup and operation timing
- UserReportService with user segmentation (new/casual/regular/power)
- useAnalytics hook and AnalyticsProvider context for React integration
- ConsentDialog component for GDPR-compliant analytics consent
- AnalyticsSettings component for user privacy controls
- Cloud Functions for email alerts on critical errors
- Rate limiting for email alerts (max 10/hour per error type)
- Summary alerts when >5 users affected in 1 hour

#### Privacy & Security
- User ID anonymization using SHA-256 hashing
- PII exclusion from all tracked events
- Consent enforcement - no tracking without user consent
- Opt-out capability in Settings

#### Event Tracking
- Session events: session_start, session_end
- Screen view tracking with screen_name parameter
- Feature usage: recording, playback, script editor, AI chat
- Error events with context preservation
- Performance metrics for all major operations

#### Recorder & Playback Improvements
- Fixed Start Playback IPC flow (React → Tauri → Python/Rust cores)
- Added ESC key to stop playback from UI
- Reveal in Finder/Explorer button for scripts

#### AI Builder Enhancements
- Target OS propagation to AI prompt context
- Record button for coordinate questions with screenshot click-pick
- Screenshot capture fallback on macOS using `screencapture`

### Fixed
- Playback not working issue (IPC chain verification)
- ESC key listener for stopping playback
- Rust core ESC listener disabled on macOS (crash prevention)

### Known Issues
- Rust core crashes on macOS when pressing Cmd+Tab during recording/playback

## [1.0.0] - Initial Release

### Added
- Web Platform with React 18 + TypeScript + Vite
- Desktop App with Tauri + React
- Python Core backend with FastAPI
- Rust Core for native automation
- Multi-provider AI support
- Test case driven automation
- Visual regression testing
- Script recording and playback
- AI Script Builder
- User authentication via Firebase
