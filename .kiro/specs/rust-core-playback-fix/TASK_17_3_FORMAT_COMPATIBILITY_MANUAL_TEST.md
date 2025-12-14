# Task 17.3: Test Script Format Compatibility

## Overview
This document provides a manual testing guide for validating that both cores can read each other's script files, testing with scripts containing various action types, and verifying metadata is preserved across cores.

**Requirements:** 10.3, 10.4

## Prerequisites
- Desktop application running
- Both Python and Rust cores available
- Test environment with screen access
- Permissions granted for automation (macOS Accessibility, etc.)
- Access to script files directory

## Test Procedure

### Step 1: Test Basic Format Compatibility

#### Test 1.1: Python Script Format Read by Rust

1. **Create a Python-recorded script**
   - Switch to Python Core
   - Record a simple script with 3-5 actions
   - Save as `format_test_python_1`

2. **Inspect the JSON format**
   - Open the script file in a text editor
   - Note the structure:
     - Root object with `metadata` and `actions`
     - Metadata fields: `created_at`, `duration`, `action_count`, `platform`, `version`
     - Action fields: `type`, `timestamp`, `x`, `y`, `button`, `key`, etc.

3. **Load with Rust Core**
   - Switch to Rust Core
   - Open the script selector
   - Verify `format_test_python_1` appears in the list
   - Select the script
   - Verify script details display correctly
   - Verify action count matches
   - Verify duration matches

4. **Play back with Rust Core**
   - Click "Play"
   - Verify all actions execute correctly
   - Verify no format-related errors

#### Test 1.2: Rust Script Format Read by Python

1. **Create a Rust-recorded script**
   - Switch to Rust Core
   - Record a simple script with 3-5 actions
   - Save as `format_test_rust_1`

2. **Inspect the JSON format**
   - Open the script file in a text editor
   - Note the structure (should be similar to Python format)
   - Check for any Rust-specific fields

3. **Load with Python Core**
   - Switch to Python Core
   - Open the script selector
   - Verify `format_test_rust_1` appears in the list
   - Select the script
   - Verify script details display correctly
   - Verify action count matches
   - Verify duration matches

4. **Play back with Python Core**
   - Click "Play"
   - Verify all actions execute correctly
   - Verify no format-related errors

### Step 2: Test Various Action Types

#### Test 2.1: Mouse Actions

1. **Record with Python Core**
   - Mouse move to (100, 100)
   - Left click
   - Mouse move to (200, 200)
   - Right click
   - Mouse move to (300, 300)
   - Middle click
   - Save as `format_test_mouse`

2. **Verify JSON format**
   - Check action types: `mouse_move`, `mouse_click`
   - Check coordinates are present
   - Check button types are present

3. **Play back with Rust Core**
   - Switch to Rust Core
   - Load and play `format_test_mouse`
   - Verify all mouse actions execute correctly

4. **Record equivalent with Rust Core**
   - Record same actions
   - Save as `format_test_mouse_rust`

5. **Compare JSON formats**
   - Open both files side by side
   - Compare action structures
   - Note any differences in field names or values

6. **Play back Rust version with Python Core**
   - Switch to Python Core
   - Load and play `format_test_mouse_rust`
   - Verify all mouse actions execute correctly

#### Test 2.2: Keyboard Actions

1. **Record with Python Core**
   - Type "hello"
   - Press Tab
   - Type "world"
   - Press Enter
   - Press Escape
   - Save as `format_test_keyboard`

2. **Verify JSON format**
   - Check action types: `key_press`, `key_type`, `key_release`
   - Check key names are present
   - Check text content is present

3. **Play back with Rust Core**
   - Switch to Rust Core
   - Load and play `format_test_keyboard`
   - Verify all keyboard actions execute correctly

4. **Record equivalent with Rust Core**
   - Record same actions
   - Save as `format_test_keyboard_rust`

5. **Compare JSON formats**
   - Open both files side by side
   - Compare action structures
   - Note any differences in key naming conventions

6. **Play back Rust version with Python Core**
   - Switch to Python Core
   - Load and play `format_test_keyboard_rust`
   - Verify all keyboard actions execute correctly

#### Test 2.3: Mixed Actions

1. **Record with Python Core**
   - Mouse move to (50, 50)
   - Left click
   - Type "username"
   - Press Tab
   - Type "password"
   - Press Enter
   - Save as `format_test_mixed`

2. **Verify JSON format**
   - Check all action types are present
   - Check timestamps are in order
   - Check all required fields are present

3. **Play back with Rust Core**
   - Switch to Rust Core
   - Load and play `format_test_mixed`
   - Verify all actions execute in correct order

4. **Record equivalent with Rust Core**
   - Record same actions
   - Save as `format_test_mixed_rust`

5. **Compare JSON formats**
   - Open both files side by side
   - Compare overall structure
   - Note any differences

6. **Play back Rust version with Python Core**
   - Switch to Python Core
   - Load and play `format_test_mixed_rust`
   - Verify all actions execute in correct order

### Step 3: Test Metadata Preservation

#### Test 3.1: Basic Metadata

1. **Record with Python Core**
   - Record a simple script
   - Save as `metadata_test_python`

2. **Check metadata fields**
   - Open JSON file
   - Verify presence of:
     - `created_at` (timestamp)
     - `duration` (float)
     - `action_count` (integer)
     - `platform` (string: "windows", "macos", or "linux")
     - `version` (string)

3. **Load with Rust Core**
   - Switch to Rust Core
   - Load `metadata_test_python`
   - Verify all metadata displays correctly in UI

4. **Record with Rust Core**
   - Record a simple script
   - Save as `metadata_test_rust`

5. **Check metadata fields**
   - Open JSON file
   - Verify same fields are present
   - Compare format with Python version

6. **Load with Python Core**
   - Switch to Python Core
   - Load `metadata_test_rust`
   - Verify all metadata displays correctly in UI

#### Test 3.2: Extended Metadata

1. **Manually add custom metadata to Python script**
   - Open `metadata_test_python` in editor
   - Add custom field: `"description": "Test script"`
   - Save file

2. **Load with Rust Core**
   - Switch to Rust Core
   - Load the modified script
   - Verify script still loads without errors
   - Verify custom field is preserved (if possible to check)

3. **Manually add custom metadata to Rust script**
   - Open `metadata_test_rust` in editor
   - Add custom field: `"description": "Test script"`
   - Save file

4. **Load with Python Core**
   - Switch to Python Core
   - Load the modified script
   - Verify script still loads without errors
   - Verify custom field is preserved (if possible to check)

### Step 4: Test Format Differences Handling

#### Test 4.1: Missing Optional Fields

1. **Create script with minimal fields**
   - Copy a Python-recorded script
   - Remove optional fields (e.g., `version`)
   - Save as `format_test_minimal`

2. **Load with Rust Core**
   - Switch to Rust Core
   - Load `format_test_minimal`
   - Verify script loads with warnings (if any)
   - Verify playback works correctly

3. **Load with Python Core**
   - Switch to Python Core
   - Load `format_test_minimal`
   - Verify script loads with warnings (if any)
   - Verify playback works correctly

#### Test 4.2: Extra Fields

1. **Create script with extra fields**
   - Copy a Rust-recorded script
   - Add extra fields: `"custom_field": "value"`
   - Save as `format_test_extra`

2. **Load with Python Core**
   - Switch to Python Core
   - Load `format_test_extra`
   - Verify script loads without errors
   - Verify extra fields don't break playback

3. **Load with Rust Core**
   - Switch to Rust Core
   - Load `format_test_extra`
   - Verify script loads without errors
   - Verify extra fields don't break playback

#### Test 4.3: Different Timestamp Formats

1. **Check timestamp format in Python script**
   - Open a Python-recorded script
   - Note timestamp format (e.g., ISO 8601)

2. **Check timestamp format in Rust script**
   - Open a Rust-recorded script
   - Note timestamp format
   - Compare with Python format

3. **Test cross-core loading**
   - Verify both cores can parse each other's timestamp formats
   - Verify no date/time conversion errors

### Step 5: Test Format Validation

#### Test 5.1: Invalid JSON

1. **Create invalid JSON file**
   - Copy a valid script
   - Introduce JSON syntax error (missing comma, bracket, etc.)
   - Save as `format_test_invalid`

2. **Try to load with Rust Core**
   - Switch to Rust Core
   - Try to load `format_test_invalid`
   - Verify clear error message is displayed
   - Verify error indicates JSON parsing failure

3. **Try to load with Python Core**
   - Switch to Python Core
   - Try to load `format_test_invalid`
   - Verify clear error message is displayed
   - Verify error indicates JSON parsing failure

#### Test 5.2: Missing Required Fields

1. **Create script missing required field**
   - Copy a valid script
   - Remove required field (e.g., `actions` array)
   - Save as `format_test_missing_field`

2. **Try to load with Rust Core**
   - Switch to Rust Core
   - Try to load `format_test_missing_field`
   - Verify error message indicates missing field

3. **Try to load with Python Core**
   - Switch to Python Core
   - Try to load `format_test_missing_field`
   - Verify error message indicates missing field

#### Test 5.3: Invalid Field Types

1. **Create script with wrong field types**
   - Copy a valid script
   - Change field type (e.g., `action_count` from number to string)
   - Save as `format_test_wrong_type`

2. **Try to load with Rust Core**
   - Switch to Rust Core
   - Try to load `format_test_wrong_type`
   - Verify error message indicates type mismatch

3. **Try to load with Python Core**
   - Switch to Python Core
   - Try to load `format_test_wrong_type`
   - Verify error message indicates type mismatch

## Expected Results

### Format Compatibility
- ✅ Both cores can read each other's script files
- ✅ JSON structure is compatible between cores
- ✅ All action types are supported by both cores
- ✅ Field names are consistent between cores

### Metadata Preservation
- ✅ All standard metadata fields are preserved
- ✅ Custom metadata fields don't break loading
- ✅ Timestamps are correctly parsed by both cores
- ✅ Platform information is preserved

### Format Differences
- ✅ Missing optional fields are handled gracefully
- ✅ Extra fields don't break loading
- ✅ Format warnings are logged when appropriate
- ✅ Essential data is always preserved

### Validation
- ✅ Invalid JSON is detected and reported
- ✅ Missing required fields are detected
- ✅ Invalid field types are detected
- ✅ Error messages are clear and helpful

## Validation Checklist

- [ ] Python scripts load in Rust core
- [ ] Rust scripts load in Python core
- [ ] All action types work cross-core
- [ ] Metadata is preserved across cores
- [ ] Timestamps are correctly parsed
- [ ] Platform information is preserved
- [ ] Missing optional fields handled gracefully
- [ ] Extra fields don't break loading
- [ ] Invalid JSON is detected
- [ ] Missing required fields are detected
- [ ] Invalid field types are detected
- [ ] Error messages are clear
- [ ] No data loss during cross-core operations

## Known Format Differences

Document any format differences discovered during testing:

1. **Timestamp Format:**
   - Python: _________________
   - Rust: _________________

2. **Action Type Names:**
   - Differences: _________________

3. **Metadata Fields:**
   - Python-specific: _________________
   - Rust-specific: _________________

4. **Other Differences:**
   _________________________________________________________________

## Test Results

**Date:** _________________

**Tester:** _________________

**Platform:** _________________

**Test Status:** ⬜ Pass ⬜ Fail ⬜ Partial

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Issues Found:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

## Automated Test Coverage

The following automated tests also validate format compatibility:

**Rust Tests:**
- `packages/rust-core/tests/script_format_differences_test.rs`
  - `test_python_script_format_compatibility`
  - `test_rust_script_format_compatibility`
  - `test_metadata_preservation`
  - And more...

**Python Tests:**
- `packages/python-core/src/storage/test_validation.py`
  - Tests for script validation and format checking

Run automated tests:
```bash
# Rust tests
cd packages/rust-core
cargo test script_format_differences

# Python tests
cd packages/python-core
pytest src/storage/test_validation.py -v
```

## Conclusion

This manual testing procedure validates that both cores can read each other's script files, all action types are compatible, and metadata is preserved across cores, ensuring format compatibility as specified in Requirements 10.3 and 10.4.
