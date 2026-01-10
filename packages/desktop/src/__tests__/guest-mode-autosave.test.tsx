import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-native';
import { GuestModeProvider, useGuestMode } from '../contexts/GuestModeContext';
import React from 'react';

// Mock localStorage for React Native environment
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] || null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store = {};
      return Promise.resolve();
    }),
    get store() {
      return store;
    },
    set store(newStore: Record<string, string>) {
      store = newStore;
    }
  };
})();

// Mock AsyncStorage for React Native
jest.mock('@react-native-async-storage/async-storage', () => mockLocalStorage);

// Mock localStorage for desktop environment
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage.store[key] || null,
    setItem: (key: string, value: string) => {
      mockLocalStorage.store[key] = value;
    },
    removeItem: (key: string) => {
      delete mockLocalStorage.store[key];
    },
    clear: () => {
      mockLocalStorage.store = {};
    }
  },
  writable: true
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <GuestModeProvider>{children}</GuestModeProvider>
);

describe('Desktop GuestModeContext Auto-Save Functionality', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('Script Auto-Save', () => {
    it('should automatically save scripts to localStorage when added', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      act(() => {
        result.current.addScript({
          name: 'Desktop Test Script',
          content: 'desktop test content'
        });
      });

      expect(mockLocalStorage.store['geniusqa_desktop_guest_scripts']).toContain('Desktop Test Script');
      expect(result.current.scripts).toHaveLength(1);
      expect(result.current.scripts[0].name).toBe('Desktop Test Script');
    });

    it('should use desktop-specific localStorage key', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      act(() => {
        result.current.addScript({
          name: 'Desktop Script',
          content: 'desktop content'
        });
      });

      // Should use desktop-specific key to avoid conflicts with web version
      expect(mockLocalStorage.store).toHaveProperty('geniusqa_desktop_guest_scripts');
      expect(mockLocalStorage.store).not.toHaveProperty('geniusqa_guest_scripts');
    });

    it('should restore scripts from localStorage on mount', () => {
      const savedScripts = [
        {
          id: 'guest_123_abc',
          name: 'Saved Desktop Script',
          content: 'saved desktop content',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockLocalStorage.store = {
        'geniusqa_desktop_guest_scripts': JSON.stringify(savedScripts)
      };

      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      expect(result.current.scripts).toHaveLength(1);
      expect(result.current.scripts[0].name).toBe('Saved Desktop Script');
      expect(result.current.scripts[0].content).toBe('saved desktop content');
    });
  });

  describe('Storage Usage Indicators', () => {
    it('should provide accurate storage usage metrics', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      expect(result.current.scriptCount).toBe(0);
      expect(result.current.maxScripts).toBe(50);
      expect(result.current.storageUsagePercent).toBe(0);

      act(() => {
        // Add 10 scripts
        for (let i = 1; i <= 10; i++) {
          result.current.addScript({
            name: `Desktop Script ${i}`,
            content: `desktop content ${i}`
          });
        }
      });

      expect(result.current.scriptCount).toBe(10);
      expect(result.current.storageUsagePercent).toBe(20); // 10/50 * 100 = 20%
      expect(result.current.canRecordMore).toBe(true);
    });
  });

  describe('Storage Error Handling', () => {
    it('should handle localStorage quota exceeded error gracefully', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // Mock localStorage to throw QuotaExceededError
      const originalSetItem = global.localStorage.setItem;
      global.localStorage.setItem = jest.fn(() => {
        const error = new Error('Storage quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      });

      act(() => {
        result.current.addScript({
          name: 'Large Desktop Script',
          content: 'very large desktop content'
        });
      });

      expect(result.current.storageError).toBe(
        'Storage quota exceeded. Please delete some scripts or create an account for unlimited storage.'
      );

      // Restore original implementation
      global.localStorage.setItem = originalSetItem;
    });

    it('should prevent adding scripts beyond the limit', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // Pre-populate with 50 scripts (max limit)
      const existingScripts = Array.from({ length: 50 }, (_, i) => ({
        id: `guest_${i}_desktop`,
        name: `Desktop Script ${i}`,
        content: `desktop content ${i}`,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }));

      mockLocalStorage.store = {
        'geniusqa_desktop_guest_scripts': JSON.stringify(existingScripts)
      };

      // Re-render to load the scripts
      const { result: newResult } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      expect(newResult.current.scriptCount).toBe(50);
      expect(newResult.current.canRecordMore).toBe(false);

      // Try to add one more script
      act(() => {
        newResult.current.addScript({
          name: 'Overflow Desktop Script',
          content: 'overflow desktop content'
        });
      });

      expect(newResult.current.scriptCount).toBe(50); // Should not increase
      expect(newResult.current.storageError).toBe(
        'Guest mode is limited to 50 scripts. Please create an account to save more scripts.'
      );
    });
  });

  describe('Export/Import Functionality', () => {
    it('should export single script in JSON format', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      act(() => {
        result.current.addScript({
          name: 'Export Test Script',
          content: 'export test content'
        });
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const alertSpy = jest.spyOn(global, 'alert').mockImplementation();

      act(() => {
        result.current.exportScript(result.current.scripts[0].id, 'json');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Exporting script:',
        'Export Test Script.json',
        expect.stringContaining('Export Test Script')
      );
      expect(alertSpy).toHaveBeenCalledWith('Script exported as Export Test Script.json');

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });

    it('should import valid script data', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      const scriptData = {
        name: 'Imported Script',
        content: 'imported content'
      };

      let importResult: boolean;
      act(() => {
        importResult = result.current.importScript(scriptData);
      });

      expect(importResult).toBe(true);
      expect(result.current.scripts).toHaveLength(1);
      expect(result.current.scripts[0].name).toBe('Imported Script');
      expect(result.current.scripts[0].content).toBe('imported content');
    });

    it('should handle invalid import data gracefully', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const alertSpy = jest.spyOn(global, 'alert').mockImplementation();

      let importResult: boolean;
      act(() => {
        importResult = result.current.importScript({ invalid: 'data' });
      });

      expect(importResult).toBe(false);
      expect(result.current.scripts).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith('Import failed:', expect.any(Error));
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Import failed:'));

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });
  });

  describe('Script Management', () => {
    it('should update script timestamps correctly', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      act(() => {
        result.current.addScript({
          name: 'Timestamp Test',
          content: 'original content'
        });
      });

      const originalScript = result.current.scripts[0];
      const originalUpdatedAt = originalScript.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        act(() => {
          result.current.updateScript(originalScript.id, {
            content: 'updated content'
          });
        });

        const updatedScript = result.current.scripts[0];
        expect(updatedScript.updatedAt).not.toBe(originalUpdatedAt);
        expect(updatedScript.createdAt).toBe(originalScript.createdAt);
      }, 10);
    });

    it('should delete scripts correctly', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      act(() => {
        result.current.addScript({
          name: 'Script to Delete',
          content: 'delete me'
        });
        result.current.addScript({
          name: 'Script to Keep',
          content: 'keep me'
        });
      });

      expect(result.current.scripts).toHaveLength(2);

      const scriptToDelete = result.current.scripts[0];

      act(() => {
        result.current.deleteScript(scriptToDelete.id);
      });

      expect(result.current.scripts).toHaveLength(1);
      expect(result.current.scripts[0].name).toBe('Script to Keep');
    });
  });
});
