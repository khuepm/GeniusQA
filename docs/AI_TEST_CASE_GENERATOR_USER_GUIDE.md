# AI Test Case Generator - User Guide

## Overview

The AI Test Case Generator is a powerful feature integrated into GeniusQA that leverages Google Gemini AI to automatically generate comprehensive test case documentation. It provides two primary workflows:

1. **Requirements to Test Cases**: Generate structured test cases from natural language requirements
2. **Action Logs to Documentation**: Convert recorded automation actions into human-readable test documentation

## Features

### Core Capabilities
- **Intelligent Test Case Generation**: Creates comprehensive test cases including happy path and edge cases
- **Action Log Documentation**: Transforms recorded automation into readable test documentation
- **Multiple Project Types**: Supports Web, Mobile, API, and Desktop application testing
- **Customizable Complexity**: Choose from Basic, Detailed, or Comprehensive test case generation
- **Security**: Secure API key storage using OS keyring
- **Performance Monitoring**: Track usage, costs, and performance metrics
- **Validation & Auto-repair**: Automatic JSON validation and repair for generated content

### Integration Benefits
- **Seamless GeniusQA Integration**: Works with existing test case management workflows
- **Desktop Recorder Integration**: Directly processes recorded automation actions
- **Real-time Generation**: Asynchronous processing keeps UI responsive
- **Concurrent Operations**: Handle multiple generation requests simultaneously

## Getting Started

### Prerequisites
- GeniusQA Desktop Application installed
- Google Gemini API key (obtain from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Initial Setup

1. **Configure API Key**
   - Open GeniusQA Desktop Application
   - Navigate to AI Test Case Generator settings
   - Click "Configure API Key"
   - Enter your Gemini API key
   - Click "Save" (key will be securely stored in OS keyring)

2. **Verify Configuration**
   - Click "Validate API Key" to ensure proper setup
   - Green checkmark indicates successful configuration

## Usage Guide

### Generating Test Cases from Requirements

1. **Open Test Case Generator**
   - Click the "AI Test Case Generator" button in the main interface
   - Or use the keyboard shortcut (if configured)

2. **Enter Requirements**
   - In the requirements text area, describe your feature or functionality
   - Example: "User login functionality with email and password validation, including forgot password flow and account lockout after 3 failed attempts"

3. **Configure Generation Options**
   - **Project Type**: Select Web, Mobile, API, or Desktop
   - **Complexity Level**:
     - Basic: 3-5 test cases covering core functionality
     - Detailed: 5-10 test cases with edge cases
     - Comprehensive: 10-20 test cases with extensive coverage
   - **Include Edge Cases**: Toggle to include boundary condition testing
   - **Include Error Scenarios**: Toggle to include error handling tests
   - **Max Test Cases**: Set upper limit (optional)
   - **Custom Context**: Add project-specific context

4. **Generate Test Cases**
   - Click "Generate Test Cases"
   - Wait for AI processing (typically 10-30 seconds)
   - Review generated test cases in the preview panel

5. **Review and Select**
   - Each test case shows:
     - Title and description
     - Preconditions
     - Step-by-step actions
     - Expected results
     - Severity level
   - Use checkboxes to select desired test cases
   - Edit test cases inline if needed

6. **Add to Project**
   - Click "Add Selected Test Cases"
   - Test cases are integrated into your project with proper metadata

### Converting Action Logs to Documentation

1. **Record Actions**
   - Use GeniusQA's Desktop Recorder to capture automation actions
   - Perform the test scenario you want to document

2. **Generate Documentation**
   - After stopping recording, click "Generate Documentation"
   - Or access via the script editor's "AI Documentation" button

3. **Provide Context**
   - **Script Name**: Descriptive name for the test
   - **Project Type**: Select appropriate type
   - **Additional Context**: Describe the test purpose or business logic

4. **Review Generated Documentation**
   - AI generates:
     - Test case title
     - Comprehensive description
     - Step-by-step documentation
     - Expected outcomes
   - Edit content as needed

5. **Apply Documentation**
   - Click "Apply Documentation" to update script metadata
   - Documentation is saved with the automation script

## Advanced Features

### Custom Generation Preferences

Access via Settings → AI Test Case Generator:

- **Default Project Type**: Set your most common project type
- **Preferred Complexity**: Default complexity level
- **Test Type Filters**: Include/exclude specific test types:
  - Functional tests
  - Integration tests
  - Performance tests
  - Security tests
  - Accessibility tests
- **Custom Prompt Templates**: Define organization-specific generation patterns

### Cost Management

Monitor and control API usage:

- **Usage Dashboard**: View daily/monthly request counts
- **Cost Estimation**: Real-time cost calculations based on token usage
- **Quota Warnings**: Alerts when approaching usage limits
- **Rate Limiting**: Automatic handling of API rate limits

### Performance Monitoring

Track system performance:

- **Response Times**: Monitor AI generation speed
- **Success Rates**: Track successful vs. failed generations
- **Error Logging**: Detailed error information for troubleshooting
- **Token Usage**: Monitor prompt and completion token consumption

## Best Practices

### Writing Effective Requirements

1. **Be Specific**: Include concrete details about functionality
   - Good: "User registration with email validation, password strength requirements (8+ chars, special character), and email confirmation"
   - Poor: "User can register"

2. **Include Context**: Mention the application domain
   - "E-commerce checkout process with payment validation"
   - "Healthcare patient data entry with HIPAA compliance"

3. **Specify Edge Cases**: Mention boundary conditions
   - "File upload supporting files up to 10MB, with validation for allowed formats (PDF, DOC, JPG)"

4. **Include Error Scenarios**: Describe failure conditions
   - "API integration with timeout handling (30s) and retry logic (3 attempts)"

### Optimizing Generation Quality

1. **Choose Appropriate Complexity**:
   - Basic: For simple features or initial exploration
   - Detailed: For standard feature development
   - Comprehensive: For critical or complex functionality

2. **Use Project Type Context**:
   - Web: Generates browser-specific tests (cross-browser, responsive)
   - Mobile: Includes device-specific scenarios (orientation, touch)
   - API: Focuses on request/response validation
   - Desktop: Considers OS-specific behaviors

3. **Leverage Custom Context**:
   - Include business rules: "Banking application with regulatory compliance"
   - Mention integrations: "Integrates with Stripe payment processing"
   - Specify user types: "Multi-tenant SaaS with admin and user roles"

### Managing Costs

1. **Monitor Usage**: Regularly check the usage dashboard
2. **Set Budgets**: Use quota warnings to stay within limits
3. **Optimize Requests**: Use appropriate complexity levels
4. **Batch Operations**: Generate multiple test cases in single requests when possible

## Troubleshooting

### Common Issues

**API Key Issues**
- **Problem**: "API key not configured" error
- **Solution**: Verify API key is entered correctly and has proper permissions
- **Check**: Validate API key using the validation button

**Generation Failures**
- **Problem**: "Generation failed" or timeout errors
- **Solution**: 
  - Check internet connection
  - Verify API key has sufficient quota
  - Try reducing complexity level
  - Check requirements aren't too vague or too long

**Quality Issues**
- **Problem**: Generated test cases are too generic or irrelevant
- **Solution**:
  - Add more specific context in requirements
  - Use custom context field for domain-specific information
  - Select appropriate project type
  - Try different complexity levels

**Performance Issues**
- **Problem**: Slow generation times
- **Solution**:
  - Check network connection
  - Reduce max test cases limit
  - Use Basic complexity for faster results
  - Monitor API rate limits

### Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `API key not configured` | No API key stored | Configure API key in settings |
| `Invalid API key` | API key is incorrect or expired | Verify and update API key |
| `Rate limit exceeded` | Too many requests | Wait for rate limit reset |
| `Request timeout` | API call took too long | Check connection, try again |
| `Validation failed` | Generated content invalid | Report issue, try regenerating |
| `Insufficient quota` | API usage limit reached | Check quota, upgrade plan if needed |

### Getting Help

1. **Check Logs**: View detailed error logs in the monitoring dashboard
2. **Performance Metrics**: Review response times and success rates
3. **Documentation**: Refer to this guide and API documentation
4. **Support**: Contact GeniusQA support with specific error messages

## API Usage and Pricing

### Token Usage
- **Prompt Tokens**: Input text (requirements, context)
- **Completion Tokens**: Generated output (test cases, documentation)
- **Typical Usage**: 
  - Basic generation: 500-1,500 tokens
  - Detailed generation: 1,500-3,000 tokens
  - Comprehensive generation: 3,000-6,000 tokens

### Cost Optimization
- Use appropriate complexity levels
- Provide clear, concise requirements
- Leverage custom context instead of lengthy requirements
- Monitor usage patterns to optimize request timing

### Quota Management
- Set up quota warnings in preferences
- Monitor daily/monthly usage patterns
- Plan generation activities around quota limits
- Consider upgrading API plan for heavy usage

## Security and Privacy

### Data Handling
- **API Keys**: Stored securely in OS keyring, never logged or displayed
- **Requirements**: Sent to Google Gemini API for processing
- **Generated Content**: Processed and stored locally
- **No Persistent Storage**: Requirements not stored on external servers

### Best Practices
- Use generic examples in requirements when possible
- Avoid including sensitive business logic in requirements
- Regularly rotate API keys
- Monitor API usage for unexpected activity

## Integration with GeniusQA Workflows

### Test Case Management
- Generated test cases integrate with existing test management
- Proper metadata tagging for organization
- Version control compatibility
- Export capabilities to external tools

### Automation Integration
- Documentation generation from recorded actions
- Seamless script metadata population
- Integration with playback and validation workflows
- Support for existing script formats

### Reporting and Analytics
- Usage analytics integration
- Performance metrics in reports
- Cost tracking and budgeting
- Quality metrics and success rates

## Updates and Maintenance

### Keeping Current
- Regular updates through GeniusQA application updates
- API compatibility maintained automatically
- New features announced in release notes
- Backward compatibility for existing workflows

### Configuration Backup
- Export/import generation preferences
- API key management across devices
- Settings synchronization (if configured)
- Backup custom prompt templates

---

For additional support or feature requests, please contact the GeniusQA support team or refer to the comprehensive API documentation.
