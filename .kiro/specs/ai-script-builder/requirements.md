# Requirements Document

## Introduction

Tính năng AI Script Builder cho phép người dùng tạo kịch bản automation test tự động thông qua giao diện chat với AI. Hệ thống sử dụng Gemini API để phân tích yêu cầu của người dùng và sinh ra các test case phù hợp với định dạng của rust-core. API key của Gemini được lưu trữ và quản lý thông qua Firebase.

## Glossary

- **AI Script Builder**: Module cho phép sinh kịch bản automation test tự động bằng AI
- **Gemini API**: Google's generative AI API được sử dụng để xử lý ngôn ngữ tự nhiên và sinh kịch bản
- **Test Script**: Kịch bản automation chứa các action (click, type, wait, etc.) theo định dạng JSON của rust-core
- **Chat Interface**: Giao diện hội thoại cho phép người dùng mô tả yêu cầu test bằng ngôn ngữ tự nhiên
- **Firebase**: Backend service lưu trữ và quản lý API key của người dùng
- **Script Action**: Một hành động đơn lẻ trong kịch bản (MouseClick, KeyPress, TypeText, Wait, etc.)

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

