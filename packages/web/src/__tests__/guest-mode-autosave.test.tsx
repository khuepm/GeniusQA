import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { GuestModeProvider, useGuestMode } from '../contexts/GuestModeContext';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
    set store(newStore: Record<string, string>) {
      store = newStore;
    }
  };
})();

// Mock scriptExecutor
vi.mock('../services/scriptExecutor', () => ({
  scriptExecutor: {
    executeScript: vi.fn().mockResolvedValue({ success: true })
  }
}));

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <GuestModeProvider>{children}</GuestModeProvider>
);

const STORAGE_KEY = 'geniusqa_guest_scripts';

describe('GuestModeContext Auto-Save Functionality', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('Script Auto-Save', () => {
    it('should automatically save scripts to localStorage when added', async () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      await act(async () => {
        result.current.addScript({
          name: 'Test Script',
          content: 'test content'
        });
      });

      await waitFor(() => {
        expect(result.current.scripts).toHaveLength(1);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('Test Script')
      );
      expect(result.current.scripts[0].name).toBe('Test Script');
    });

    it('should automatically save scripts to localStorage when updated', async () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      let scriptId: string;

      await act(async () => {
        result.current.addScript({
          name: 'Test Script',
          content: 'original content'
        });
      });

      await waitFor(() => {
        expect(result.current.scripts).toHaveLength(1);
        scriptId = result.current.scripts[0].id;
      });

      await act(async () => {
        result.current.updateScript(scriptId, {
          name: 'Updated Script',
          content: 'updated content'
        });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2); // Once for add, once for update
      expect(result.current.scripts[0].name).toBe('Updated Script');
      expect(result.current.scripts[0].content).toBe('updated content');
    });

    it('should automatically save scripts to localStorage when deleted', async () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      let scriptId: string;

      await act(async () => {
        result.current.addScript({
          name: 'Test Script',
          content: 'test content'
        });
      });

      await waitFor(() => {
        expect(result.current.scripts).toHaveLength(1);
        scriptId = result.current.scripts[0].id;
      });

      await act(async () => {
        result.current.deleteScript(scriptId);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2); // Once for add, once for delete
      expect(result.current.scripts).toHaveLength(0);
    });
  });

  describe('Script Restoration', () => {
    it('should restore scripts from localStorage on mount', () => {
      const savedScripts = [
        {
          id: 'guest_123_abc',
          name: 'Saved Script',
          content: 'saved content',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockLocalStorage.store = {
        [STORAGE_KEY]: JSON.stringify(savedScripts)
      };

      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      expect(result.current.scripts).toHaveLength(1);
      expect(result.current.scripts[0].name).toBe('Saved Script');
      expect(result.current.scripts[0].content).toBe('saved content');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.store = {
        [STORAGE_KEY]: 'invalid json'
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      expect(result.current.scripts).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load guest scripts:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Storage Usage Indicators', () => {
    it('should provide accurate script count and usage percentage', async () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      expect(result.current.scriptCount).toBe(0);
      expect(result.current.maxScripts).toBe(50);
      expect(result.current.storageUsagePercent).toBe(0);

      await act(async () => {
        // Add 5 scripts
        for (let i = 1; i <= 5; i++) {
          result.current.addScript({
            name: `Script ${i}`,
            content: `content ${i}`
          });
        }
      });

      await waitFor(() => {
        expect(result.current.scriptCount).toBe(5);
      });

      expect(result.current.storageUsagePercent).toBe(10); // 5/50 * 100 = 10%
      expect(result.current.canRecordMore).toBe(true);
    });

    it('should indicate when storage limit is reached', () => {
      // Pre-populate with 49 scripts
      const existingScripts = Array.from({ length: 49 }, (_, i) => ({
        id: `guest_${i}_test`,
        name: `Script ${i}`,
        content: `content ${i}`,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }));

      mockLocalStorage.store = {
        [STORAGE_KEY]: JSON.stringify(existingScripts)
      };

      // Re-render to load the scripts
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      expect(result.current.scriptCount).toBe(49);
      expect(result.current.storageUsagePercent).toBe(98); // 49/50 * 100 = 98%
      expect(result.current.canRecordMore).toBe(true);

      // Add one more script to reach the limit
      act(() => {
        result.current.addScript({
          name: 'Final Script',
          content: 'final content'
        });
      });

      expect(result.current.scriptCount).toBe(50);
      expect(result.current.storageUsagePercent).toBe(100);
      expect(result.current.canRecordMore).toBe(false);
    });
  });

  describe('Storage Error Handling', () => {
    it('should handle localStorage quota exceeded error', async () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // Mock localStorage.setItem to throw QuotaExceededError
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        const error = new Error('Storage quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      });

      await act(async () => {
        result.current.addScript({
          name: 'Large Script',
          content: 'very large content'
        });
      });

      expect(result.current.storageError).toBe(
        'Storage quota exceeded. Please delete some scripts or create an account for unlimited storage.'
      );
    });

    it('should handle generic localStorage errors', async () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // Mock localStorage.setItem to throw generic error
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Generic storage error');
      });

      await act(async () => {
        result.current.addScript({
          name: 'Test Script',
          content: 'test content'
        });
      });

      expect(result.current.storageError).toBe(
        'Failed to save scripts to local storage. Your changes may not persist.'
      );
    });

    it('should clear storage error when save succeeds after failure', async () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // First, cause an error
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      await act(async () => {
        result.current.addScript({
          name: 'Test Script 1',
          content: 'content 1'
        });
      });

      expect(result.current.storageError).toBeTruthy();

      // Then, let the next save succeed
      mockLocalStorage.setItem.mockImplementation((key, value) => {
        mockLocalStorage.store[key] = value;
      });

      await act(async () => {
        result.current.addScript({
          name: 'Test Script 2',
          content: 'content 2'
        });
      });

      expect(result.current.storageError).toBeNull();
    });

    it('should show error when trying to add script beyond limit', () => {
      // Pre-populate with 50 scripts (max limit)
      const existingScripts = Array.from({ length: 50 }, (_, i) => ({
        id: `guest_${i}_test`,
        name: `Script ${i}`,
        content: `content ${i}`,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }));

      mockLocalStorage.store = {
        [STORAGE_KEY]: JSON.stringify(existingScripts)
      };

      // Re-render to load the scripts
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      expect(result.current.scriptCount).toBe(50);

      // Try to add one more script
      act(() => {
        result.current.addScript({
          name: 'Overflow Script',
          content: 'overflow content'
        });
      });

      expect(result.current.scriptCount).toBe(50); // Should not increase
      expect(result.current.storageError).toBe(
        'Guest mode is limited to 50 scripts. Please create an account to save more scripts.'
      );
    });
  });

  describe('Script Management', () => {
    it('should generate unique IDs for new scripts', async () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      await act(async () => {
        result.current.addScript({
          name: 'Script 1',
          content: 'content 1'
        });
        result.current.addScript({
          name: 'Script 2',
          content: 'content 2'
        });
      });

      await waitFor(() => {
        expect(result.current.scripts).toHaveLength(2);
      });

      expect(result.current.scripts[0].id).not.toBe(result.current.scripts[1].id);
      expect(result.current.scripts[0].id).toMatch(/^guest_\d+_[a-z0-9]+$/);
      expect(result.current.scripts[1].id).toMatch(/^guest_\d+_[a-z0-9]+$/);
    });

    it('should set creation and update timestamps', async () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      const beforeAdd = Date.now();

      await act(async () => {
        result.current.addScript({
          name: 'Test Script',
          content: 'test content'
        });
      });

      await waitFor(() => {
        expect(result.current.scripts).toHaveLength(1);
      });

      const afterAdd = Date.now();
      const script = result.current.scripts[0];

      expect(new Date(script.createdAt).getTime()).toBeGreaterThanOrEqual(beforeAdd);
      expect(new Date(script.createdAt).getTime()).toBeLessThanOrEqual(afterAdd);
      expect(script.updatedAt).toBe(script.createdAt);

      const beforeUpdate = Date.now();

      await act(async () => {
        result.current.updateScript(script.id, {
          name: 'Updated Script'
        });
      });

      const afterUpdate = Date.now();
      const updatedScript = result.current.scripts[0];

      expect(new Date(updatedScript.updatedAt).getTime()).toBeGreaterThanOrEqual(beforeUpdate);
      expect(new Date(updatedScript.updatedAt).getTime()).toBeLessThanOrEqual(afterUpdate);
      expect(updatedScript.updatedAt).not.toBe(updatedScript.createdAt);
    });
  });
});
