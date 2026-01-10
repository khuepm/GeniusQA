import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock alert
global.alert = vi.fn();

describe('Import Validation Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('JSON Import Validation', () => {
    it('should validate single script import with required fields', () => {
      // Test data
      const validScript = {
        name: 'Test Script',
        content: 'console.log("test");'
      };

      const invalidScript1 = {
        content: 'console.log("test");'
        // Missing name
      };

      const invalidScript2 = {
        name: '',
        content: 'console.log("test");'
        // Empty name
      };

      const invalidScript3 = {
        name: 123,
        content: 'console.log("test");'
        // Invalid name type
      };

      // Test validation logic directly
      expect(validateScriptData(validScript)).toBe(true);
      expect(validateScriptData(invalidScript1)).toBe(false);
      expect(validateScriptData(invalidScript2)).toBe(false);
      expect(validateScriptData(invalidScript3)).toBe(false);
    });

    it('should validate multiple scripts import', () => {
      const validScripts = [
        { name: 'Script 1', content: 'console.log("1");' },
        { name: 'Script 2', content: 'console.log("2");' }
      ];

      const invalidScripts = [
        { name: 'Script 1', content: 'console.log("1");' },
        { content: 'console.log("2");' } // Missing name
      ];

      expect(validateScriptArray(validScripts)).toBe(true);
      expect(validateScriptArray(invalidScripts)).toBe(false);
    });

    it('should reject empty or null data', () => {
      expect(validateScriptData(null)).toBe(false);
      expect(validateScriptData(undefined)).toBe(false);
      expect(validateScriptData({})).toBe(false);
      expect(validateScriptArray([])).toBe(false);
    });

    it('should validate script name length limits', () => {
      const longName = 'a'.repeat(101); // 101 characters
      const validName = 'a'.repeat(100); // 100 characters

      expect(validateScriptData({ name: longName, content: 'test' })).toBe(false);
      expect(validateScriptData({ name: validName, content: 'test' })).toBe(true);
    });

    it('should validate content field type', () => {
      expect(validateScriptData({ name: 'Test', content: 'string content' })).toBe(true);
      expect(validateScriptData({ name: 'Test', content: '' })).toBe(true); // Empty string is valid
      expect(validateScriptData({ name: 'Test' })).toBe(true); // Missing content is valid
      expect(validateScriptData({ name: 'Test', content: 123 })).toBe(false); // Invalid type
      expect(validateScriptData({ name: 'Test', content: {} })).toBe(false); // Invalid type
    });
  });

  describe('File Format Validation', () => {
    it('should validate supported file extensions', () => {
      const supportedExtensions = ['json', 'js', 'javascript', 'py', 'python'];
      const unsupportedExtensions = ['txt', 'doc', 'pdf', 'exe'];

      supportedExtensions.forEach(ext => {
        expect(isValidFileExtension(ext)).toBe(true);
      });

      unsupportedExtensions.forEach(ext => {
        expect(isValidFileExtension(ext)).toBe(false);
      });
    });

    it('should validate file size limits', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      expect(isValidFileSize(maxSize - 1)).toBe(true);
      expect(isValidFileSize(maxSize)).toBe(true);
      expect(isValidFileSize(maxSize + 1)).toBe(false);
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error messages for validation failures', () => {
      const errors = getValidationErrors({ name: '', content: 123 });
      
      expect(errors).toContain('name field cannot be empty');
      expect(errors).toContain('content field must be a string');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should provide specific error messages for array validation', () => {
      const scripts = [
        { name: 'Valid Script', content: 'test' },
        { name: '', content: 'test' }, // Invalid
        { content: 'test' } // Missing name
      ];

      const errors = getArrayValidationErrors(scripts);
      
      expect(errors).toContain('Script 2: name field cannot be empty');
      expect(errors).toContain('Script 3: Missing required \'name\' field');
    });
  });
});

// Helper validation functions (these would be part of the actual implementation)
function validateScriptData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!data.name || typeof data.name !== 'string') return false;
  if (data.name.trim().length === 0) return false;
  if (data.name.length > 100) return false;
  if (data.content !== undefined && typeof data.content !== 'string') return false;
  return true;
}

function validateScriptArray(scripts: any[]): boolean {
  if (!Array.isArray(scripts) || scripts.length === 0) return false;
  return scripts.every(script => validateScriptData(script));
}

function isValidFileExtension(ext: string): boolean {
  const supportedExtensions = ['json', 'js', 'javascript', 'py', 'python'];
  return supportedExtensions.includes(ext.toLowerCase());
}

function isValidFileSize(size: number): boolean {
  const maxSize = 5 * 1024 * 1024; // 5MB
  return size <= maxSize;
}

function getValidationErrors(data: any): string[] {
  const errors: string[] = [];
  
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Missing required \'name\' field');
  } else if (data.name.trim().length === 0) {
    errors.push('name field cannot be empty');
  } else if (data.name.length > 100) {
    errors.push('name field is too long (maximum 100 characters)');
  }
  
  if (data.content !== undefined && typeof data.content !== 'string') {
    errors.push('content field must be a string if provided');
  }
  
  return errors;
}

function getArrayValidationErrors(scripts: any[]): string[] {
  const errors: string[] = [];
  
  scripts.forEach((script, index) => {
    const scriptErrors = getValidationErrors(script);
    scriptErrors.forEach(error => {
      errors.push(`Script ${index + 1}: ${error}`);
    });
  });
  
  return errors;
}
