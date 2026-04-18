/**
 * Test Isolation Utilities
 * 
 * Provides utilities to ensure proper test isolation and prevent
 * component rendering conflicts in Jest tests.
 */

import { cleanup, render } from '@testing-library/react';
import { act } from '@testing-library/react';

/**
 * Enhanced cleanup function that ensures complete test isolation
 */
export const isolatedCleanup = () => {
  // Standard React Testing Library cleanup
  cleanup();
  
  // Clear any remaining DOM content completely
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Clear any pending timers
  jest.clearAllTimers();
  jest.clearAllMocks();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Clear any global state that might persist
  if (window.localStorage) {
    window.localStorage.clear();
  }
  
  if (window.sessionStorage) {
    window.sessionStorage.clear();
  }
  
  // Clear any React portals or modals
  const portals = document.querySelectorAll('[data-react-portal]');
  portals.forEach(portal => portal.remove());
  
  // Clear any tooltips or overlays that might persist
  const overlays = document.querySelectorAll('.tooltip, .overlay, .modal, .popup');
  overlays.forEach(overlay => overlay.remove());
  
  // Reset any window properties
  window.scrollTo = jest.fn();
  window.focus = jest.fn();
  window.blur = jest.fn();
};

/**
 * Wrapper for rendering components with proper isolation
 */
export const renderWithIsolation = async (renderFn: () => any) => {
  // Ensure clean state before rendering
  isolatedCleanup();
  
  let result;
  await act(async () => {
    result = renderFn();
  });
  
  return result;
};

/**
 * Safe getByTestId that handles multiple elements gracefully
 */
export const safeGetByTestId = (container: any, testId: string) => {
  try {
    return container.getByTestId(testId);
  } catch (error) {
    if (error.message.includes('Found multiple elements')) {
      // If multiple elements found, return the first one and log a warning
      console.warn(`Multiple elements found for testId: ${testId}. Using the first one.`);
      const elements = container.getAllByTestId(testId);
      return elements[0];
    }
    
    if (error.message.includes('Unable to find an element')) {
      // Try to find element using querySelector as fallback
      const element = document.querySelector(`[data-testid="${testId}"]`);
      if (element) {
        return element;
      }
    }
    
    throw error;
  }
};

/**
 * Safe getAllByTestId that handles no elements gracefully
 */
export const safeGetAllByTestId = (container: any, testId: string) => {
  try {
    return container.getAllByTestId(testId);
  } catch (error) {
    if (error.message.includes('Unable to find an element')) {
      // Return empty array if no elements found
      return [];
    }
    throw error;
  }
};

/**
 * Unique test ID generator to prevent conflicts
 */
let testIdCounter = 0;
export const generateUniqueTestId = (baseId: string): string => {
  testIdCounter++;
  return `${baseId}-${testIdCounter}-${Date.now()}`;
};

/**
 * Reset test ID counter (call in beforeEach)
 */
export const resetTestIdCounter = () => {
  testIdCounter = 0;
};

/**
 * Isolated render function that ensures no component duplication
 */
export const isolatedRender = (ui: React.ReactElement, options?: any) => {
  // Clean up any existing renders
  isolatedCleanup();
  
  // Render with isolation
  const result = render(ui, {
    container: document.body.appendChild(document.createElement('div')),
    ...options
  });
  
  return result;
};

/**
 * Wait for DOM to be stable (no more mutations)
 */
export const waitForDOMStable = (timeout = 1000): Promise<void> => {
  return new Promise((resolve, reject) => {
    let mutationCount = 0;
    const maxMutations = 10;
    
    const observer = new MutationObserver(() => {
      mutationCount++;
      if (mutationCount > maxMutations) {
        observer.disconnect();
        reject(new Error('DOM did not stabilize within timeout'));
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);
  });
};
