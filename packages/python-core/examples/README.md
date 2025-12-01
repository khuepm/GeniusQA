# Script Examples

This directory contains example script files demonstrating various features of the Desktop Recorder MVP.

## login_with_variables.json

A simple login automation script that demonstrates the variable substitution feature.

**Variables:**
- `username`: The username to enter (default: "admin")
- `password`: The password to enter (default: "admin123")

**Actions:**
1. Types the username
2. Presses Tab to move to password field
3. Types the password
4. Presses Enter to submit

**Usage:**

Play with default variables:
```bash
python -m src --command start_playback --script-path examples/login_with_variables.json
```

Play with custom variables via IPC:
```json
{
  "command": "start_playback",
  "params": {
    "scriptPath": "examples/login_with_variables.json",
    "variables": {
      "username": "testuser",
      "password": "testpass123"
    }
  }
}
```

**Testing Different Scenarios:**

1. Admin login:
```json
{
  "variables": {
    "username": "admin",
    "password": "admin123"
  }
}
```

2. Regular user login:
```json
{
  "variables": {
    "username": "user1",
    "password": "userpass"
  }
}
```

3. Test account login:
```json
{
  "variables": {
    "username": "test@example.com",
    "password": "Test123!"
  }
}
```

## Creating Your Own Scripts with Variables

1. Record a script normally or create one manually
2. Replace values you want to parameterize with `{{variable_name}}`
3. Add a `variables` section with default values
4. Test with defaults first, then with overrides

Example:
```json
{
  "metadata": { ... },
  "actions": [
    {
      "type": "key_press",
      "timestamp": 0.0,
      "key": "{{my_variable}}"
    }
  ],
  "variables": {
    "my_variable": "default_value"
  }
}
```

## See Also

- [VARIABLE_SUBSTITUTION.md](../VARIABLE_SUBSTITUTION.md) - Complete documentation
- [IPC_PROTOCOL.md](../IPC_PROTOCOL.md) - IPC communication details
