/**
 * useConsentDialog Hook
 *
 * Custom hook for managing the analytics consent dialog state.
 * Checks if consent has been given on first app launch and
 * provides methods to show/hide the dialog and handle user choices.
 *
 * Requirements: 6.1, 6.2
 */

import { useCallback, useEffect, useState } from 'react';
import { useAnalytics } from './useAnalytics';

/**
 * Storage key for tracking if consent dialog has been shown
 */
const CONSENT_SHOWN_KEY = 'analytics_consent_shown';

/**
 * Return type for the useConsentDialog hook
 */
export interface UseConsentDialogReturn {
  /** Whether the consent dialog should be shown */
  showDialog: boolean;
  /** Whether the dialog is currently processing a user action */
  isProcessing: boolean;
  /** Handle user accepting analytics */
  handleAccept: () => Promise<void>;
  /** Handle user declining analytics */
  handleDecline: () => Promise<void>;
  /** Manually show the consent dialog */
  openDialog: () => void;
  /** Manually close the consent dialog */
  closeDialog: () => void;
}

/**
 * Check if consent dialog has been shown before
 */
function hasConsentBeenShown(): boolean {
  try {
    return localStorage.getItem(CONSENT_SHOWN_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark consent dialog as shown
 */
function markConsentAsShown(): void {
  try {
    localStorage.setItem(CONSENT_SHOWN_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * useConsentDialog Hook
 *
 * Manages the analytics consent dialog lifecycle.
 * Shows the dialog on first app launch if consent hasn't been given.
 *
 * @requirements 6.1 - Check for user consent before collecting data
 * @requirements 6.2 - Do not send events without consent
 *
 * @example
 * ```tsx
 * function App() {
 *   const { showDialog, handleAccept, handleDecline } = useConsentDialog();
 *
 *   return (
 *     <>
 *       <ConsentDialog
 *         isOpen={showDialog}
 *         onAccept={handleAccept}
 *         onDecline={handleDecline}
 *       />
 *       <MainContent />
 *     </>
 *   );
 * }
 * ```
 */
export function useConsentDialog(): UseConsentDialogReturn {
  const { setEnabled, isInitialized } = useAnalytics();
  const [showDialog, setShowDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Check if we need to show the consent dialog on mount
   * Only show if:
   * 1. Analytics service is initialized
   * 2. Consent dialog hasn't been shown before
   */
  useEffect(() => {
    if (isInitialized && !hasConsentBeenShown()) {
      setShowDialog(true);
    }
  }, [isInitialized]);

  /**
   * Handle user accepting analytics
   */
  const handleAccept = useCallback(async () => {
    setIsProcessing(true);
    try {
      await setEnabled(true);
      markConsentAsShown();
      setShowDialog(false);
    } finally {
      setIsProcessing(false);
    }
  }, [setEnabled]);

  /**
   * Handle user declining analytics
   */
  const handleDecline = useCallback(async () => {
    setIsProcessing(true);
    try {
      await setEnabled(false);
      markConsentAsShown();
      setShowDialog(false);
    } finally {
      setIsProcessing(false);
    }
  }, [setEnabled]);

  /**
   * Manually open the consent dialog
   */
  const openDialog = useCallback(() => {
    setShowDialog(true);
  }, []);

  /**
   * Manually close the consent dialog
   */
  const closeDialog = useCallback(() => {
    setShowDialog(false);
  }, []);

  return {
    showDialog,
    isProcessing,
    handleAccept,
    handleDecline,
    openDialog,
    closeDialog,
  };
}

export default useConsentDialog;
