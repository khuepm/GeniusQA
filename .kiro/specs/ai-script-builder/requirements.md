# Requirements Document

## Introduction

Tính năng AI Script Builder cho phép người dùng tạo kịch bản automation test tự động thông qua giao diện chat với AI. Hệ thống sử dụng Gemini API để phân tích yêu cầu của người dùng và sinh ra các test case phù hợp với định dạng của rust-core. API key của Gemini được lưu trữ và quản lý thông qua Firebase.

Phiên bản mở rộng bổ sung các tính năng: lưu script sau khi generate, test playback trực tiếp, chọn target OS cho script, tích hợp AI scripts vào Desktop Recorder, và gộp giao diện Script Editor với AI Script Builder thành một unified interface.

## Glossary

- **AI Script Builder**: Module cho phép sinh kịch bản automation test tự động bằng AI
- **Gemini API**: Google's generative AI API được sử dụng để xử lý ngôn ngữ tự nhiên và sinh kịch bản
- **Test Script**: Kịch bản automation chứa các action (click, type, wait, etc.) theo định dạng JSON của rust-core
- **Chat Interface**: Giao diện hội thoại cho phép người dùng mô tả yêu cầu test bằng ngôn ngữ tự nhiên
- **Firebase**: Backend service lưu trữ và quản lý API key của người dùng
- **Script Action**: Một hành động đơn lẻ trong kịch bản (MouseClick, KeyPress, TypeText, Wait, etc.)
- **Target OS**: Hệ điều hành mục tiêu cho script (macOS, Windows, Universal)
- **AI-Generated Script**: Script được tạo bởi AI Script Builder, có metadata đánh dấu nguồn gốc
- **Unified Script Editor**: Giao diện kết hợp giữa Script Editor và AI Script Builder

## Requirements

### Requirement 1

**User Story:** As a user, I want to store and retrieve my Gemini API key securely, so that I can use AI features without exposing my credentials.

#### Acceptance Criteria

1. WHEN a user submits a Gemini API key THEN the System SHALL encrypt and store the key in Firebase under the user's account
2. WHEN a user requests to use AI features THEN the System SHALL retrieve the encrypted API key from Firebase and decrypt it for use
3. IF a user has not configured an API key THEN the System SHALL display a prompt requesting API key configuration
4. WHEN a user updates their API key THEN the System SHALL replace the existing key with the new encrypted value
5. IF the API key retrieval fails THEN the System SHALL display an error message and prevent AI feature access

### Requirement 2

**User Story:** As a user, I want to describe my test scenario in natural language through a chat interface, so that I can easily create automation scripts without technical knowledge.

#### Acceptance Criteria

1. WHEN a user opens the AI Script Builder THEN the System SHALL display a chat interface with an input field and message history
2. WHEN a user sends a message describing a test scenario THEN the System SHALL display the message in the chat history
3. WHEN the System receives a user message THEN the System SHALL show a loading indicator while processing
4. WHEN the AI generates a response THEN the System SHALL display the response in the chat history with clear formatting
5. WHEN a user scrolls through chat history THEN the System SHALL maintain message order from oldest to newest

### Requirement 3

**User Story:** As a user, I want the AI to generate valid automation scripts from my descriptions, so that I can execute them immediately without manual editing.

#### Acceptance Criteria

1. WHEN the System sends a user request to Gemini API THEN the System SHALL include context about available script actions and their parameters
2. WHEN Gemini returns a response THEN the System SHALL parse the response to extract script actions
3. WHEN a script is generated THEN the System SHALL validate the script against the rust-core schema before presenting it
4. IF the generated script contains invalid actions THEN the System SHALL request Gemini to regenerate with corrections
5. WHEN a valid script is generated THEN the System SHALL display a preview of the script with action descriptions

### Requirement 4

**User Story:** As a user, I want to review and edit the AI-generated script before saving, so that I can make adjustments to match my exact requirements.

#### Acceptance Criteria

1. WHEN a script is generated THEN the System SHALL display an editable preview panel alongside the chat
2. WHEN a user modifies a script action THEN the System SHALL validate the modification in real-time
3. WHEN a user confirms the script THEN the System SHALL save the script to the user's script library
4. WHEN a user requests changes via chat THEN the System SHALL update the script preview accordingly
5. IF a user discards the script THEN the System SHALL clear the preview panel and allow new generation

### Requirement 5

**User Story:** As a user, I want to see examples and suggestions while chatting, so that I can better describe my test scenarios.

#### Acceptance Criteria

1. WHEN a user opens the AI Script Builder for the first time THEN the System SHALL display example prompts for common test scenarios
2. WHEN a user types in the input field THEN the System SHALL suggest relevant action keywords
3. WHEN the AI needs clarification THEN the System SHALL ask specific questions with suggested answers
4. WHEN a user selects an example prompt THEN the System SHALL populate the input field with the example text

### Requirement 6

**User Story:** As a developer, I want the generated scripts to be compatible with rust-core format, so that they can be executed by the existing playback engine.

#### Acceptance Criteria

1. WHEN a script is generated THEN the System SHALL format it according to the rust-core Script JSON schema
2. WHEN a script contains mouse actions THEN the System SHALL include valid coordinate values within screen bounds
3. WHEN a script contains keyboard actions THEN the System SHALL use valid key codes recognized by rust-core
4. WHEN a script contains timing THEN the System SHALL include delay values in milliseconds
5. WHEN a script is saved THEN the System SHALL serialize it to JSON format compatible with rust-core storage

### Requirement 7

**User Story:** As a user, I want to save AI-generated scripts and test them immediately, so that I can verify the script works correctly before using it in production.

#### Acceptance Criteria

1. WHEN a valid script is generated THEN the System SHALL display a Save button in the script preview panel
2. WHEN a user clicks Save THEN the System SHALL prompt for a script name and save the script to the user's library
3. WHEN a script is saved THEN the System SHALL add metadata marking it as AI-generated with timestamp
4. WHEN a script is saved successfully THEN the System SHALL display a Play button to test the script
5. WHEN a user clicks Play THEN the System SHALL execute the script using the playback engine and display progress
6. IF playback encounters an error THEN the System SHALL display the error message and allow the user to edit the script

### Requirement 8

**User Story:** As a user, I want to specify the target operating system for my script, so that the AI generates platform-appropriate actions.

#### Acceptance Criteria

1. WHEN a user opens the AI Script Builder THEN the System SHALL display an OS selector with options: macOS, Windows, Universal
2. WHEN a user selects a target OS THEN the System SHALL include the OS context in the AI prompt
3. WHEN generating a script for macOS THEN the System SHALL use macOS-specific key codes and shortcuts
4. WHEN generating a script for Windows THEN the System SHALL use Windows-specific key codes and shortcuts
5. WHEN generating a Universal script THEN the System SHALL use cross-platform compatible actions only
6. WHEN a script is saved THEN the System SHALL store the target OS in the script metadata

### Requirement 9

**User Story:** As a user, I want to access AI-generated scripts from the Desktop Recorder, so that I can playback them alongside recorded scripts.

#### Acceptance Criteria

1. WHEN a user opens the script selector in Desktop Recorder THEN the System SHALL display both recorded and AI-generated scripts
2. WHEN displaying scripts THEN the System SHALL visually distinguish AI-generated scripts from recorded scripts
3. WHEN a user selects an AI-generated script THEN the System SHALL load it for playback with the same controls as recorded scripts
4. WHEN filtering scripts THEN the System SHALL allow filtering by script source (recorded, AI-generated, all)
5. WHEN an AI-generated script is selected THEN the System SHALL display its target OS in the script info

### Requirement 10

**User Story:** As a user, I want a unified interface for both editing recorded scripts and building AI scripts, so that I have a consistent experience managing all my scripts.

#### Acceptance Criteria

1. WHEN a user navigates to script management THEN the System SHALL display a unified interface with tabs for Script List, AI Builder, and Editor
2. WHEN viewing the Script List tab THEN the System SHALL show all scripts with source type indicators
3. WHEN a user selects a script THEN the System SHALL open it in the Editor tab with full editing capabilities
4. WHEN a user wants to create a new AI script THEN the System SHALL switch to the AI Builder tab with chat interface
5. WHEN an AI script is generated THEN the System SHALL allow seamless transition to the Editor tab for refinement
6. WHEN editing any script THEN the System SHALL provide the same editing tools regardless of script source

