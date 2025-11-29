/**
 * Button state calculation utilities for RecorderScreen
 * 
 * This module implements the button state logic that determines which UI controls
 * should be enabled or disabled based on the current application state. This ensures
 * users can only perform valid operations at any given time.
 * 
 * Requirements: 1.5, 2.5, 4.3
 */

import { RecorderStatus, ButtonStates } from '../types/recorder.types';

/**
 * Calculate button enabled/disabled states based on current app state
 * 
 * Implements the button state consistency property (Property 6) which ensures
 * that button states always match the specification for any application state.
 * 
 * Button State Rules:
 * - Record button: enabled only when status is 'idle'
 *   - Prevents starting a new recording while one is active
 *   - Prevents recording during playback
 * 
 * - Start button: enabled only when status is 'idle' AND hasRecordings is true
 *   - Requires at least one recording to exist
 *   - Prevents playback during recording or active playback
 * 
 * - Stop button: enabled only when status is 'recording' OR 'playing'
 *   - Allows interrupting active recording
 *   - Allows interrupting active playback
 *   - Disabled when idle (nothing to stop)
 * 
 * @param {RecorderStatus} status - Current application state (idle/recording/playing)
 * @param {boolean} hasRecordings - Whether any recordings exist in storage
 * @returns {ButtonStates} Object with enabled state for each button
 * 
 * @example
 * // When idle with no recordings
 * calculateButtonStates('idle', false)
 * // Returns: { recordEnabled: true, startEnabled: false, stopEnabled: false }
 * 
 * @example
 * // When recording
 * calculateButtonStates('recording', true)
 * // Returns: { recordEnabled: false, startEnabled: false, stopEnabled: true }
 * 
 * @example
 * // When idle with recordings available
 * calculateButtonStates('idle', true)
 * // Returns: { recordEnabled: true, startEnabled: true, stopEnabled: false }
 * 
 * Requirements: 1.5, 2.5, 4.3
 * Validates: Property 6 (Button state consistency)
 */
export function calculateButtonStates(
  status: RecorderStatus,
  hasRecordings: boolean
): ButtonStates {
  return {
    recordEnabled: status === 'idle',
    startEnabled: status === 'idle' && hasRecordings,
    stopEnabled: status === 'recording' || status === 'playing',
  };
}
