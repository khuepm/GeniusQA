/**
 * Property-Based Test Utilities
 * 
 * Provides improved arbitraries and utilities for property-based testing
 * with better edge case handling and NaN prevention.
 */

import * as fc from 'fast-check';

/**
 * Safe number arbitrary that prevents NaN and Infinity
 */
export const safeNumberArbitrary = (options: { min?: number; max?: number } = {}) => {
  const { min = 0, max = 1000 } = options;
  return fc.float({ min, max, noNaN: true, noDefaultInfinity: true });
};

/**
 * Safe timestamp arbitrary for actions
 */
export const safeTimestampArbitrary = () => {
  return fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true });
};

/**
 * Safe coordinate arbitrary for mouse positions
 */
export const safeCoordinateArbitrary = () => {
  return fc.integer({ min: 0, max: 1920 });
};

/**
 * Safe duration arbitrary for delays and animations
 */
export const safeDurationArbitrary = () => {
  return fc.integer({ min: 10, max: 5000 });
};

/**
 * Improved action arbitrary with better edge case handling
 */
export const improvedActionArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  type: fc.constantFrom('mouse_click', 'mouse_move', 'key_press', 'key_release', 'delay'),
  timestamp: safeTimestampArbitrary(),
  data: fc.record({
    x: safeCoordinateArbitrary(),
    y: safeCoordinateArbitrary(),
    key: fc.constantFrom('a', 'b', 'Enter', 'Space', 'Escape', 'Tab', 'Shift'),
    duration: safeDurationArbitrary()
  })
});

/**
 * Improved recording session arbitrary with validation
 */
export const improvedRecordingSessionArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  isActive: fc.boolean(),
  actions: fc.array(improvedActionArbitrary, { minLength: 0, maxLength: 10 })
});

/**
 * Time formatting utility that handles edge cases
 */
export const formatTime = (timestamp: number): string => {
  if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp)) {
    return '0.00';
  }
  
  if (timestamp < 0) {
    return '0.00';
  }
  
  return timestamp.toFixed(2);
};

/**
 * Safe action description formatter
 */
export const formatActionDescription = (action: any): string => {
  if (!action || !action.type) {
    return 'Unknown action';
  }

  const { type, data = {} } = action;
  
  switch (type) {
    case 'mouse_click':
      const x = typeof data.x === 'number' && isFinite(data.x) ? Math.round(data.x) : 0;
      const y = typeof data.y === 'number' && isFinite(data.y) ? Math.round(data.y) : 0;
      return `Click at (${x}, ${y})`;
      
    case 'mouse_move':
      const moveX = typeof data.x === 'number' && isFinite(data.x) ? Math.round(data.x) : 0;
      const moveY = typeof data.y === 'number' && isFinite(data.y) ? Math.round(data.y) : 0;
      return `Move to (${moveX}, ${moveY})`;
      
    case 'key_press':
      const pressKey = data.key && typeof data.key === 'string' ? data.key : 'Unknown';
      return `Press key: ${pressKey}`;
      
    case 'key_release':
      const releaseKey = data.key && typeof data.key === 'string' ? data.key : 'Unknown';
      return `Release key: ${releaseKey}`;
      
    case 'delay':
      const duration = typeof data.duration === 'number' && isFinite(data.duration) ? Math.round(data.duration) : 0;
      return `Wait ${duration}ms`;
      
    default:
      return `${type} action`;
  }
};

/**
 * Async property test wrapper with better error handling
 */
export const asyncPropertyTest = async (
  property: fc.IProperty<any>,
  options: fc.Parameters<any> = {}
) => {
  const defaultOptions = {
    numRuns: 10,
    timeout: 5000,
    ...options
  };

  try {
    await fc.assert(property, defaultOptions);
  } catch (error) {
    // Enhanced error reporting for property test failures
    console.error('Property test failed:', error);
    throw error;
  }
};

/**
 * Test data validator to ensure data quality
 */
export const validateTestData = (data: any): boolean => {
  if (!data) return false;
  
  // Check for NaN values recursively
  const hasNaN = (obj: any): boolean => {
    if (typeof obj === 'number') {
      return isNaN(obj) || !isFinite(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.some(hasNaN);
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(hasNaN);
    }
    
    return false;
  };
  
  return !hasNaN(data);
};
