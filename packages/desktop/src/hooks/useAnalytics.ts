/**
 * useAnalytics Hook
 * 
 * Custom React hook for accessing analytics functionality in components.
 * Provides methods for tracking events, screen views, feature usage, and errors.
 * Also exposes consent management for privacy controls.
 * 
 * @module hooks/useAnalytics
 * @requirements 2.1, 3.1, 4.1, 6.1
 */

import { useCallback, useContext } from 'react';
import { AnalyticsContext, type AnalyticsContextValue } from '../contexts/AnalyticsContext';
import type { ErrorContext } from '../types/analytics.types';

/**
 * Return type for the useAnalytics hook
 */
export interface UseAnalyticsReturn {
  /** Track a custom analytics event */
  trackEvent: (name: string, params?: Record<string, unknown>) => void;
  /** Track a screen view event */
  trackScreenView: (screenName: string) => void;
  /** Track feature usage with optional metadata */
  trackFeatureUsed: (featureName: string, metadata?: Record<string, unknown>) => void;
  /** Track an error with optional context */
  trackError: (error: Error, context?: ErrorContext) => void;
  /** Whether analytics is currently enabled */
  isEnabled: boolean;
  /** Enable or disable analytics (consent management) */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Custom hook for accessing analytics functionality
 * 
 * Provides a convenient interface for components to track events,
 * screen views, feature usage, and errors. Also exposes consent
 * management for privacy controls.
 * 
 * @returns Analytics methods and state
 * @throws Error if used outside of AnalyticsProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { trackEvent, trackScreenView, isEnabled } = useAnalytics();
 *   
 *   useEffect(() => {
 *     trackScreenView('MyComponent');
 *   }, [trackScreenView]);
 *   
 *   const handleClick = () => {
 *     trackEvent('button_clicked', { buttonId: 'submit' });
 *   };
 *   
 *   return <button onClick={handleClick}>Submit</button>;
 * }
 * ```
 */
export function useAnalytics(): UseAnalyticsReturn {
  const context = useContext(AnalyticsContext);

  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }

  const { analyticsService, errorTracker, isEnabled, setEnabled } = context;

  /**
   * Track a custom analytics event
   * @requirements 2.1
   */
  const trackEvent = useCallback(
    (name: string, params?: Record<string, unknown>) => {
      analyticsService.trackEvent(name, params);
    },
    [analyticsService]
  );

  /**
   * Track a screen view event
   * @requirements 3.1
   */
  const trackScreenView = useCallback(
    (screenName: string) => {
      analyticsService.trackScreenView(screenName);
    },
    [analyticsService]
  );

  /**
   * Track feature usage with optional metadata
   * @requirements 2.1
   */
  const trackFeatureUsed = useCallback(
    (featureName: string, metadata?: Record<string, unknown>) => {
      analyticsService.trackFeatureUsed(featureName, metadata);
    },
    [analyticsService]
  );

  /**
   * Track an error with optional context
   * @requirements 4.1
   */
  const trackError = useCallback(
    (error: Error, context?: ErrorContext) => {
      errorTracker.trackError(error, context);
    },
    [errorTracker]
  );

  return {
    trackEvent,
    trackScreenView,
    trackFeatureUsed,
    trackError,
    isEnabled,
    setEnabled,
  };
}

export default useAnalytics;
