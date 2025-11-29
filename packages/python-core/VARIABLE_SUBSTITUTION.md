# Variable Substitution Feature

## Overview

The variable substitution feature allows you to create reusable scripts with placeholders that can be replaced with different values during playback. This is useful for scenarios where you want to run the same script with different inputs, such as testing with different usernames, passwords, or other data.

## How It Works

### Variable Syntax

Variables are defined using double curly braces: `{{variable_name}}`

Example:
```
{{username}}
{{password}}
{{email}}
```

### Script File Format

Scripts can include a `variables` section that defines default values:

```json
{
  "metadata": {
    "version": "1.0",
    "created_at": "2024-01-01T12:00:00Z",
    "duration": 10.0,
    "action_count": 4,
    "platform": "darwin"
  },
  "actions": [
    {
      "type": "key_press",
      "timestamp": 0.0,
      "key": "{{username}}"
    },
    {
      "type": "key_release",
      "timestamp": 0.1,
      "key": "{{username}}"
    },
    {
      "type": "key_press",
      "timestamp": 0.2,
      "key": "{{password}}"
    },
    {
      "type": "key_release",
      "timestamp": 0.3,
      "key": "{{password}}"
    }
  ],
  "variables": {
    "username": "admin",
    "password": "default123"
  }
}
```

## Usage

### 1. Creating Scripts with Variables

When manually creating or editing a script file, add variable placeholders in the `key` field of keyboard actions:

```json
{
  "type": "key_press",
  "timestamp": 0.0,
  "key": "{{username}}"
}
```

Define default values in the `variables` section:

```json
"variables": {
  "username": "default_user",
  "password": "default_pass"
}
```

### 2. Playing Scripts with Default Variables

When you play a script without specifying variable overrides, the default values from the script file will be used:

```python
# Via IPC
{
  "command": "start_playback",
  "params": {
    "scriptPath": "/path/to/script.json"
  }
}
```

### 3. Playing Scripts with Variable Overrides

You can override default variables by passing a `variables` parameter:

```python
# Via IPC
{
  "command": "start_playback",
  "params": {
    "scriptPath": "/path/to/script.json",
    "variables": {
      "username": "testuser",
      "password": "testpass123"
    }
  }
}
```

The override values will be merged with the default values, with overrides taking precedence.

## Supported Actions

Variable substitution currently works with:
- **key_press** actions: The `key` field can contain variable placeholders
- **key_release** actions: The `key` field can contain variable placeholders

Mouse actions (mouse_move, mouse_click) do not support variable substitution as they use numeric coordinates.

## Examples

### Example 1: Login Script

```json
{
  "metadata": {
    "version": "1.0",
    "created_at": "2024-01-01T12:00:00Z",
    "duration": 5.0,
    "action_count": 8,
    "platform": "darwin"
  },
  "actions": [
    {"type": "key_press", "timestamp": 0.0, "key": "{{username}}"},
    {"type": "key_release", "timestamp": 0.1, "key": "{{username}}"},
    {"type": "key_press", "timestamp": 0.2, "key": "tab"},
    {"type": "key_release", "timestamp": 0.3, "key": "tab"},
    {"type": "key_press", "timestamp": 0.4, "key": "{{password}}"},
    {"type": "key_release", "timestamp": 0.5, "key": "{{password}}"},
    {"type": "key_press", "timestamp": 0.6, "key": "enter"},
    {"type": "key_release", "timestamp": 0.7, "key": "enter"}
  ],
  "variables": {
    "username": "admin",
    "password": "admin123"
  }
}
```

Play with different credentials:
```python
# Test with user account
{
  "command": "start_playback",
  "params": {
    "scriptPath": "/path/to/login.json",
    "variables": {
      "username": "user1",
      "password": "userpass"
    }
  }
}

# Test with admin account
{
  "command": "start_playback",
  "params": {
    "scriptPath": "/path/to/login.json",
    "variables": {
      "username": "admin",
      "password": "adminpass"
    }
  }
}
```

### Example 2: Form Filling Script

```json
{
  "metadata": {
    "version": "1.0",
    "created_at": "2024-01-01T12:00:00Z",
    "duration": 10.0,
    "action_count": 12,
    "platform": "darwin"
  },
  "actions": [
    {"type": "key_press", "timestamp": 0.0, "key": "{{name}}"},
    {"type": "key_release", "timestamp": 0.1, "key": "{{name}}"},
    {"type": "key_press", "timestamp": 0.2, "key": "tab"},
    {"type": "key_release", "timestamp": 0.3, "key": "tab"},
    {"type": "key_press", "timestamp": 0.4, "key": "{{email}}"},
    {"type": "key_release", "timestamp": 0.5, "key": "{{email}}"},
    {"type": "key_press", "timestamp": 0.6, "key": "tab"},
    {"type": "key_release", "timestamp": 0.7, "key": "tab"},
    {"type": "key_press", "timestamp": 0.8, "key": "{{phone}}"},
    {"type": "key_release", "timestamp": 0.9, "key": "{{phone}}"}
  ],
  "variables": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234"
  }
}
```

## Best Practices

1. **Use Descriptive Variable Names**: Choose clear, meaningful names like `username`, `password`, `email` rather than `var1`, `var2`.

2. **Provide Default Values**: Always include default values in the script file so it can be played without overrides.

3. **Document Variables**: Add comments in your script documentation explaining what each variable represents.

4. **Test with Defaults First**: Verify your script works with default values before testing with overrides.

5. **Avoid Sensitive Data**: Don't store sensitive passwords or credentials in script files. Use variable overrides to provide them at runtime.

## Limitations

- Variable substitution only works for keyboard actions (`key_press` and `key_release`)
- Mouse coordinates cannot use variables (they must be numeric values)
- Variables are simple string replacements (no expressions or transformations)
- Undefined variables remain as placeholders (e.g., `{{undefined}}` stays as-is)

## Technical Details

### Implementation

Variable substitution is implemented in the `Player` class:

```python
def _substitute_variables(self, text: str) -> str:
    """Substitute variables in text using {{variable_name}} syntax."""
    if not text or not self.variables:
        return text
    
    result = text
    for var_name, var_value in self.variables.items():
        placeholder = f"{{{{{var_name}}}}}"
        result = result.replace(placeholder, var_value)
    
    return result
```

### Variable Merging

When playing a script with variable overrides:
1. Default variables are loaded from the script file
2. Override variables are provided in the playback command
3. Variables are merged with overrides taking precedence
4. The merged variables are passed to the Player

```python
# Merge variables
variables = dict(script_file.variables) if script_file.variables else {}
variable_overrides = params.get('variables', {})
variables.update(variable_overrides)

# Create player with merged variables
player = Player(script_file.actions, variables=variables)
```

## Testing

The variable substitution feature includes comprehensive tests:

- **Unit Tests**: Test the substitution logic in isolation
- **Property-Based Tests**: Test with randomly generated variable names and values
- **Integration Tests**: Test the complete workflow from script creation to playback
- **IPC Tests**: Test variable passing through the IPC layer

Run tests:
```bash
cd packages/python-core
python -m pytest src/player/test_variable_substitution.py -v
python -m pytest src/test_variable_substitution_integration.py -v
```

## Future Enhancements

Potential future improvements:
- Variable substitution for mouse coordinates (e.g., `{{x_position}}`, `{{y_position}}`)
- Variable expressions (e.g., `{{username}}_{{timestamp}}`)
- Environment variable support (e.g., `{{env:HOME}}`)
- Variable validation and type checking
- UI for managing variables in the desktop app
