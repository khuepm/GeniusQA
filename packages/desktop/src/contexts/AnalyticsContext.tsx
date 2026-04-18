/**
 * AnalyticsContext
 * 
 * React context provider for analytics functionality.
 * Initializes AnalyticsService on app start and provides analytics context to all components.
 * 
 * @module contexts/AnalyticsContext
 * @requirements 1.1, 1.3
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type ReactElement,
} from 'react';
import { AnalyticsService, analyticsService } from '../services/analyticsService';
import { ErrorTracker } from '../services/errorTracker';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Analytics context value interface
 */
export interface AnalyticsContextValue {
  /** The analytics service instance */
  analyticsService: AnalyticsService;
  /** The error tracker instance */
  errorTracker: ErrorTracker;
  /** Whether analytics is currently enabled */
  isEnabled: boolean;
  /** Enable or disable analytics (consent management) */
  setEnabled: (enabled: boolean) => void;
  /** Whether the analytics service has been initialized */
  isInitialized: boolean;
}

/**
 * Props for the AnalyticsProvider component
 */
export interface AnalyticsProviderProps {
  /** Child components to wrap with analytics context */
  children: ReactNode;
  /** Optional custom analytics service instance (for testing) */
  analyticsServiceInstance?: AnalyticsService;
  /** Optional initial enabled state */
  initialEnabled?: boolean;
}

// ============================================================================
// Context Creation
// ============================================================================

/**
 * Analytics context for providing analytics functionality to components
 */
export const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

AnalyticsContext.displayName = 'AnalyticsContext';

// ============================================================================
// Provider Component
// ============================================================================

/**
 * AnalyticsProvider component
 * 
 * Initializes the AnalyticsService on app start and provides analytics
 * context to all child components. Handles consent management and
 * service lifecycle.
 * 
 * @requirements 1.1 - Initialize Firebase Analytics when app starts
 * @requirements 1.3 - Automatically log session_start event with device info
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AnalyticsProvider>
 *       <MainContent />
 *     </AnalyticsProvider>
 *   );
 * }
 * ```
 */
export function AnalyticsProvider({
  children,
  analyticsServiceInstance,
  initialEnabled,
}: AnalyticsProviderProps): ReactElement {
  // Use provided instance or default singleton
  const service = useMemo(
    () => analyticsServiceInstance || analyticsService,
    [analyticsServiceInstance]
  );

  // Create error tracker instance
  const errorTracker = useMemo(
    () => new ErrorTracker(service),
    [service]
  );

  // State for tracking initialization and enabled status
  const [isInitialized, setIsInitialized] = useState(false);
  const [isEnabled, setIsEnabledState] = useState(initialEnabled ?? false);

  /**
   * Initialize analytics service on mount
   * @requirements 1.1, 1.3
   */
  useEffect(() => {
    let mounted = true;

    async function initializeAnalytics() {
      try {
        // Check initial consent status
        const hasConsent = await service.checkConsent();

        if (mounted) {
          setIsEnabledState(hasConsent);
        }

        // Initialize the service (will start session if consent given)
        await service.initialize();

        if (mounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('AnalyticsProvider: Failed to initialize analytics', error);
        if (mounted) {
          setIsInitialized(true); // Mark as initialized even on error
        }
      }
    }

    initializeAnalytics();

    // Cleanup on unmount
    return () => {
      mounted = false;
      service.destroy();
    };
  }, [service]);

  /**
   * Handle enabling/disabling analytics (consent management)
   * @requirements 6.1
   */
  const setEnabled = useCallback(
    async (enabled: boolean) => {
      await service.setConsent(enabled);
      setIsEnabledState(enabled);

      // If enabling and not yet initialized with a session, start one
      if (enabled && isInitialized) {
        const sessionId = service.getSessionId();
        if (!sessionId) {
          service.startSession();
        }
      }
    },
    [service, isInitialized]
  );

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AnalyticsContextValue>(
    () => ({
      analyticsService: service,
      errorTracker,
      isEnabled,
      setEnabled,
      isInitialized,
    }),
    [service, errorTracker, isEnabled, setEnabled, isInitialized]
  );

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export default AnalyticsProvider;
