# Playback Speed Control - Manual Testing Guide

## Prerequisites

1. Desktop application is running
2. At least one recording exists in the system
3. Python Core is properly configured with all dependencies

## Test Cases

### Test 1: UI Elements Display

**Steps:**
1. Navigate to the Recorder screen
2. Verify you have at least one recording

**Expected Results:**
- Speed control section appears below script selection
- Label shows "Playback Speed: 1.0x" (default)
- Four speed buttons are visible: 0.5x, 1x, 1.5x, 2x
- 1x button is highlighted (active state)

**Status:** ☐ Pass ☐ Fail

---

### Test 2: Speed Selection

**Steps:**
1. Click on the 0.5x button
2. Observe the UI changes
3. Click on the 2x button
4. Observe the UI changes

**Expected Results:**
- Clicked button becomes highlighted with blue styling
- Label updates to show selected speed (e.g., "Playback Speed: 0.5x")
- Previously selected button returns to normal styling
- Speed can be changed multiple times

**Status:** ☐ Pass ☐ Fail

---

### Test 3: Normal Speed Playback (1.0x)

**Steps:**
1. Select 1x speed
2. Click "Start Playback"
3. Observe the playback

**Expected Results:**
- Script plays at normal speed
- Actions execute with original timing
- Playback completes successfully

**Status:** ☐ Pass ☐ Fail

---

### Test 4: Slow Speed Playback (0.5x)

**Steps:**
1. Select 0.5x speed
2. Click "Start Playback"
3. Observe the playback timing

**Expected Results:**
- Script plays at half speed
- Delays between actions are doubled
- Actions are easier to observe
- Playback takes approximately 2x longer than normal

**Status:** ☐ Pass ☐ Fail

---

### Test 5: Fast Speed Playback (2.0x)

**Steps:**
1. Select 2x speed
2. Click "Start Playback"
3. Observe the playback timing

**Expected Results:**
- Script plays at double speed
- Delays between actions are halved
- Actions execute more quickly
- Playback takes approximately half the time of normal speed

**Status:** ☐ Pass ☐ Fail

---

### Test 6: Speed Control During Recording

**Steps:**
1. Click "Record" to start recording
2. Try to change the speed

**Expected Results:**
- Speed buttons are disabled during recording
- Cannot change speed while recording is active
- Speed selection remains at previously selected value

**Status:** ☐ Pass ☐ Fail

---

### Test 7: Speed Control During Playback

**Steps:**
1. Select a speed (e.g., 1x)
2. Click "Start Playback"
3. While playback is running, try to change the speed

**Expected Results:**
- Speed buttons are disabled during playback
- Cannot change speed while playback is active
- Playback continues at the originally selected speed

**Status:** ☐ Pass ☐ Fail

---

### Test 8: Speed Persistence

**Steps:**
1. Select 2x speed
2. Click "Start Playback"
3. Wait for playback to complete
4. Observe the speed selection

**Expected Results:**
- After playback completes, 2x button remains selected
- Speed selection persists for next playback
- Can start another playback at the same speed without reselecting

**Status:** ☐ Pass ☐ Fail

---

### Test 9: Speed with Different Scripts

**Steps:**
1. Select 1.5x speed
2. Play one script
3. Select a different script from the script selector
4. Observe the speed selection
5. Play the second script

**Expected Results:**
- Speed selection remains at 1.5x when changing scripts
- Second script plays at 1.5x speed
- Speed is independent of script selection

**Status:** ☐ Pass ☐ Fail

---

### Test 10: Visual Preview with Speed

**Steps:**
1. Select 2x speed
2. Click "Start Playback"
3. Observe the visual preview card

**Expected Results:**
- Visual preview appears and updates during playback
- Preview shows actions executing at 2x speed
- Progress bar advances faster than normal
- Action details are still readable despite faster speed

**Status:** ☐ Pass ☐ Fail

---

## Performance Testing

### Test 11: Very Slow Speed (0.5x)

**Steps:**
1. Create or use a recording with multiple actions
2. Select 0.5x speed
3. Play the recording
4. Monitor system performance

**Expected Results:**
- Playback is smooth and stable
- No lag or stuttering
- System remains responsive
- Can stop playback at any time

**Status:** ☐ Pass ☐ Fail

---

### Test 12: Very Fast Speed (2.0x)

**Steps:**
1. Create or use a recording with many actions
2. Select 2.0x speed
3. Play the recording
4. Monitor system performance

**Expected Results:**
- Playback is smooth despite faster speed
- All actions execute correctly
- No actions are skipped
- System remains responsive

**Status:** ☐ Pass ☐ Fail

---

## Edge Cases

### Test 13: Speed with Long Delays

**Steps:**
1. Create a recording with long delays (>5 seconds) between actions
2. Select 2x speed
3. Play the recording

**Expected Results:**
- Long delays are still capped at 5 seconds before speed adjustment
- With 2x speed, max delay becomes 2.5 seconds
- Playback completes successfully

**Status:** ☐ Pass ☐ Fail

---

### Test 14: Speed with No Recordings

**Steps:**
1. Delete all recordings or use a fresh installation
2. Navigate to Recorder screen

**Expected Results:**
- Speed control section does not appear
- Only appears when hasRecordings is true
- UI remains clean and uncluttered

**Status:** ☐ Pass ☐ Fail

---

## Cross-Platform Testing

### Test 15: macOS

**Platform:** macOS

**Steps:**
1. Run all tests above on macOS
2. Note any platform-specific issues

**Expected Results:**
- All features work as expected on macOS
- No platform-specific bugs

**Status:** ☐ Pass ☐ Fail

**Notes:**

---

### Test 16: Windows

**Platform:** Windows

**Steps:**
1. Run all tests above on Windows
2. Note any platform-specific issues

**Expected Results:**
- All features work as expected on Windows
- No platform-specific bugs

**Status:** ☐ Pass ☐ Fail

**Notes:**

---

### Test 17: Linux

**Platform:** Linux

**Steps:**
1. Run all tests above on Linux
2. Note any platform-specific issues

**Expected Results:**
- All features work as expected on Linux
- No platform-specific bugs

**Status:** ☐ Pass ☐ Fail

**Notes:**

---

## Test Summary

**Total Tests:** 17
**Passed:** ___
**Failed:** ___
**Blocked:** ___

**Overall Status:** ☐ Pass ☐ Fail

**Tester Name:** _______________
**Date:** _______________
**Build Version:** _______________

## Issues Found

| Test # | Issue Description | Severity | Status |
|--------|------------------|----------|--------|
|        |                  |          |        |
|        |                  |          |        |
|        |                  |          |        |

## Notes

(Add any additional observations or comments here)
