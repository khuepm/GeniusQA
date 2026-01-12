/**
 * Test Isolation Utilities Tests
 * 
 * Tests for the test isolation utilities to ensure they work correctly.
 */

import { formatTime, formatActionDescription, validateTestData } from './propertyTestUtils';

describe('Test Isolation Utilities', () => {
  describe('formatTime', () => {
    test('should format valid timestamps correctly', () => {
      expect(formatTime(0)).toBe('0.00');
      expect(formatTime(1.234)).toBe('1.23');
      expect(formatTime(10.567)).toBe('10.57');
    });

    test('should handle NaN and invalid values', () => {
      expect(formatTime(NaN)).toBe('0.00');
      expect(formatTime(Infinity)).toBe('0.00');
      expect(formatTime(-Infinity)).toBe('0.00');
      expect(formatTime(-1)).toBe('0.00');
    });

    test('should handle non-number inputs', () => {
      expect(formatTime(undefined as any)).toBe('0.00');
      expect(formatTime(null as any)).toBe('0.00');
      expect(formatTime('invalid' as any)).toBe('0.00');
    });
  });

  describe('formatActionDescription', () => {
    test('should format mouse click actions', () => {
      const action = {
        type: 'mouse_click',
        data: { x: 100, y: 200 }
      };
      expect(formatActionDescription(action)).toBe('Click at (100, 200)');
    });

    test('should format key press actions', () => {
      const action = {
        type: 'key_press',
        data: { key: 'Enter' }
      };
      expect(formatActionDescription(action)).toBe('Press key: Enter');
    });

    test('should handle invalid actions', () => {
      expect(formatActionDescription(null)).toBe('Unknown action');
      expect(formatActionDescription({})).toBe('Unknown action');
      expect(formatActionDescription({ type: 'invalid', data: {} })).toBe('invalid action');
    });

    test('should handle NaN coordinates', () => {
      const action = {
        type: 'mouse_click',
        data: { x: NaN, y: NaN }
      };
      expect(formatActionDescription(action)).toBe('Click at (0, 0)');
    });
  });

  describe('validateTestData', () => {
    test('should validate clean data', () => {
      const cleanData = {
        id: 'test',
        timestamp: 1.23,
        actions: [{ x: 100, y: 200 }]
      };
      expect(validateTestData(cleanData)).toBe(true);
    });

    test('should reject data with NaN values', () => {
      const dirtyData = {
        id: 'test',
        timestamp: NaN,
        actions: [{ x: 100, y: 200 }]
      };
      expect(validateTestData(dirtyData)).toBe(false);
    });

    test('should reject data with Infinity values', () => {
      const dirtyData = {
        id: 'test',
        timestamp: 1.23,
        actions: [{ x: Infinity, y: 200 }]
      };
      expect(validateTestData(dirtyData)).toBe(false);
    });

    test('should handle null and undefined', () => {
      expect(validateTestData(null)).toBe(false);
      expect(validateTestData(undefined)).toBe(false);
    });
  });
});
