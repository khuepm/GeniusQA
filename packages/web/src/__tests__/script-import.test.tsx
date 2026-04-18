import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <GuestModeProvider>{children}</GuestModeProvider>
);

describe('Script Import Functionality', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('JSON Import', () => {
    it('should import a single script from JSON format', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      const scriptData = {
        name: 'Test Script',
        content: 'test content'
      };

      act(() => {
        const success = result.current.importScript(scriptData);
        expect(success).toBe(true);
      });

      expect(result.current.scripts).toHaveLength(1);
      expect(result.current.scripts[0].name).toBe('Test Script');
      expect(result.current.scripts[0].content).toBe('test content');
    });

    it('should import multiple scripts from JSON array', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      const scriptsData = [
        { name: 'Script 1', content: 'content 1' },
        { name: 'Script 2', content: 'content 2' }
      ];

      act(() => {
        const success = result.current.importScript(scriptsData);
        expect(success).toBe(true);
      });

      expect(result.current.scripts).toHaveLength(2);
      expect(result.current.scripts[0].name).toBe('Script 1');
      expect(result.current.scripts[1].name).toBe('Script 2');
    });

    it('should validate JSON structure and reject invalid data', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // Test invalid data without name
      act(() => {
        const success = result.current.importScript({ content: 'test' });
        expect(success).toBe(false);
      });

      // Test invalid data without content
      act(() => {
        const success = result.current.importScript({ name: 'Test' });
        expect(success).toBe(false);
      });

      // Test completely invalid data
      act(() => {
        const success = result.current.importScript('invalid string');
        expect(success).toBe(false);
      });

      expect(result.current.scripts).toHaveLength(0);
    });
  });

  describe('Export Functionality', () => {
    it('should export a single script', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // Add a script first
      act(() => {
        result.current.addScript({
          name: 'Test Script',
          content: 'test content'
        });
      });

      // Mock URL.createObjectURL and document methods
      const mockCreateObjectURL = vi.fn(() => 'mock-url');
      const mockRevokeObjectURL = vi.fn();
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();
      const mockClick = vi.fn();

      Object.defineProperty(URL, 'createObjectURL', {
        value: mockCreateObjectURL,
        writable: true
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: mockRevokeObjectURL,
        writable: true
      });

      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

      const scriptId = result.current.scripts[0].id;

      act(() => {
        result.current.exportScript(scriptId, 'json');
      });

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('should export all scripts', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // Add multiple scripts
      act(() => {
        result.current.addScript({ name: 'Script 1', content: 'content 1' });
        result.current.addScript({ name: 'Script 2', content: 'content 2' });
      });

      // Mock URL and document methods
      const mockCreateObjectURL = vi.fn(() => 'mock-url');
      const mockRevokeObjectURL = vi.fn();
      const mockClick = vi.fn();

      Object.defineProperty(URL, 'createObjectURL', {
        value: mockCreateObjectURL,
        writable: true
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: mockRevokeObjectURL,
        writable: true
      });

      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
      vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());

      act(() => {
        result.current.exportAllScripts('json');
      });

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('Import Validation', () => {
    it('should handle script limit during import', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // Pre-populate with 49 scripts (near limit)
      const existingScripts = Array.from({ length: 49 }, (_, i) => ({
        id: `guest_${i}_test`,
        name: `Script ${i}`,
        content: `content ${i}`,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }));

      mockLocalStorage.store = {
        'geniusqa_guest_scripts': JSON.stringify(existingScripts)
      };

      // Re-render to load the scripts
      const { result: newResult } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      expect(newResult.current.scripts).toHaveLength(49);

      // Try to import multiple scripts that would exceed limit
      const scriptsToImport = [
        { name: 'Import 1', content: 'content 1' },
        { name: 'Import 2', content: 'content 2' },
        { name: 'Import 3', content: 'content 3' }
      ];

      act(() => {
        const success = newResult.current.importScript(scriptsToImport);
        expect(success).toBe(true); // Should succeed but only import 1 script
      });

      expect(newResult.current.scripts).toHaveLength(50); // Should be at limit
    });

    it('should handle empty import data gracefully', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      act(() => {
        const success = result.current.importScript([]);
        expect(success).toBe(false);
      });

      act(() => {
        const success = result.current.importScript(null);
        expect(success).toBe(false);
      });

      act(() => {
        const success = result.current.importScript(undefined);
        expect(success).toBe(false);
      });

      expect(result.current.scripts).toHaveLength(0);
    });
  });

  describe('Format Support', () => {
    it('should support different export formats', () => {
      const { result } = renderHook(() => useGuestMode(), {
        wrapper: TestWrapper
      });

      // Add a script
      act(() => {
        result.current.addScript({
          name: 'Test Script',
          content: 'test content'
        });
      });

      // Mock URL and document methods
      const mockCreateObjectURL = vi.fn(() => 'mock-url');
      Object.defineProperty(URL, 'createObjectURL', {
        value: mockCreateObjectURL,
        writable: true
      });

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn()
      };

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
      vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());

      const scriptId = result.current.scripts[0].id;

      // Test JSON export
      act(() => {
        result.current.exportScript(scriptId, 'json');
      });
      expect(mockAnchor.download).toContain('.json');

      // Test JavaScript export
      act(() => {
        result.current.exportScript(scriptId, 'javascript');
      });
      expect(mockAnchor.download).toContain('.js');

      // Test Python export
      act(() => {
        result.current.exportScript(scriptId, 'python');
      });
      expect(mockAnchor.download).toContain('.py');
    });
  });
});
