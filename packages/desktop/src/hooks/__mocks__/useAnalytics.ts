/**
 * Manual Jest mock for the useAnalytics hook.
 *
 * The real hook throws if used outside an <AnalyticsProvider>. Many component
 * trees (UnifiedInterface → AIChatInterface, the recorder screens, etc.) call
 * it deep in the tree, so tests that render those trees would otherwise need to
 * wrap every render in an AnalyticsProvider. Opt into this no-op mock with:
 *
 *   jest.mock('../../hooks/useAnalytics');
 *
 * and the hook becomes a harmless stub returning enabled=false.
 */

export interface ErrorContext {
  [key: string]: unknown;
}

// Plain function (NOT jest.fn) so the `react` project's resetMocks:true cannot
// strip its implementation between tests, which would make it return undefined
// and crash components that destructure its result during render.
const noop = () => {};
export const useAnalytics = () => ({
  trackEvent: noop,
  trackScreenView: noop,
  trackFeatureUsed: noop,
  trackError: noop,
  isEnabled: false,
  setEnabled: noop,
  isInitialized: true,
});

export default useAnalytics;
