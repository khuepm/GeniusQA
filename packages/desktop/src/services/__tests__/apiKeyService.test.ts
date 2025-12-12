/**
 * Unit tests for API Key Service
 * 
 * Tests encryption/decryption, Firebase operations, and error handling.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { encryptApiKey, decryptApiKey } from '../../utils/encryption';

describe('API Key Service Unit Tests', () => {
  describe('Encryption/Decryption', () => {
    it('should encrypt an API key', () => {
      const apiKey = 'test-api-key-12345';
      const encrypted = encryptApiKey(apiKey);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(apiKey);
    });

    it('should decrypt an encrypted API key', () => {
      const apiKey = 'test-api-key-12345';
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(apiKey);
    });

    it('should throw error when encrypting empty string', () => {
      expect(() => encryptApiKey('')).toThrow('API key cannot be empty');
    });

    it('should throw error when decrypting empty string', () => {
      expect(() => decryptApiKey('')).toThrow('Encrypted key cannot be empty');
    });

    it('should handle special characters in API key', () => {
      const apiKey = 'AIzaSyB-test_key!@#$%^&*()';
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(apiKey);
    });

    it('should handle long API keys', () => {
      const apiKey = 'a'.repeat(500);
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(apiKey);
    });

    it('should produce different encrypted values for different keys', () => {
      const key1 = 'api-key-1';
      const key2 = 'api-key-2';
      
      const encrypted1 = encryptApiKey(key1);
      const encrypted2 = encryptApiKey(key2);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce same encrypted value for same key (deterministic)', () => {
      const apiKey = 'consistent-api-key';
      
      const encrypted1 = encryptApiKey(apiKey);
      const encrypted2 = encryptApiKey(apiKey);
      
      expect(encrypted1).toBe(encrypted2);
    });

    it('should throw error for invalid base64 during decryption', () => {
      expect(() => decryptApiKey('not-valid-base64!!!')).toThrow();
    });
  });

  describe('Firebase Operations (Mocked)', () => {
    // Mock Firebase modules before importing the service
    const mockSetDoc = jest.fn();
    const mockGetDoc = jest.fn();
    const mockDeleteDoc = jest.fn();
    const mockDoc = jest.fn();
    const mockTimestampNow = jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 }));

    beforeAll(() => {
      jest.mock('firebase/firestore', () => ({
        getFirestore: jest.fn(() => ({})),
        doc: (...args: unknown[]) => mockDoc(...args),
        setDoc: (...args: unknown[]) => mockSetDoc(...args),
        getDoc: (...args: unknown[]) => mockGetDoc(...args),
        deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
        Timestamp: {
          now: () => mockTimestampNow(),
        },
      }));

      jest.mock('../../config/firebase.config', () => ({
        app: {},
      }));
    });

    beforeEach(() => {
      jest.clearAllMocks();
      mockDoc.mockReturnValue({ id: 'test-doc' });
    });

    afterAll(() => {
      jest.unmock('firebase/firestore');
      jest.unmock('../../config/firebase.config');
    });

    describe('storeApiKey', () => {
      it('should validate userId is required', async () => {
        // Import after mocks are set up
        const { apiKeyService } = await import('../apiKeyService');
        
        await expect(apiKeyService.storeApiKey('', 'gemini', 'test-api-key'))
          .rejects.toThrow('User ID is required');
      });

      it('should validate provider is required', async () => {
        const { apiKeyService } = await import('../apiKeyService');
        
        await expect(apiKeyService.storeApiKey('user123', '' as 'gemini', 'test-api-key'))
          .rejects.toThrow('Provider is required');
      });

      it('should validate apiKey is required', async () => {
        const { apiKeyService } = await import('../apiKeyService');
        
        await expect(apiKeyService.storeApiKey('user123', 'gemini', ''))
          .rejects.toThrow('API key is required');
      });
    });

    describe('getApiKey', () => {
      it('should validate userId is required', async () => {
        const { apiKeyService } = await import('../apiKeyService');
        
        await expect(apiKeyService.getApiKey('', 'gemini'))
          .rejects.toThrow('User ID is required');
      });

      it('should validate provider is required', async () => {
        const { apiKeyService } = await import('../apiKeyService');
        
        await expect(apiKeyService.getApiKey('user123', '' as 'gemini'))
          .rejects.toThrow('Provider is required');
      });
    });

    describe('hasApiKey', () => {
      it('should validate userId is required', async () => {
        const { apiKeyService } = await import('../apiKeyService');
        
        await expect(apiKeyService.hasApiKey('', 'gemini'))
          .rejects.toThrow('User ID is required');
      });

      it('should validate provider is required', async () => {
        const { apiKeyService } = await import('../apiKeyService');
        
        await expect(apiKeyService.hasApiKey('user123', '' as 'gemini'))
          .rejects.toThrow('Provider is required');
      });
    });

    describe('deleteApiKey', () => {
      it('should validate userId is required', async () => {
        const { apiKeyService } = await import('../apiKeyService');
        
        await expect(apiKeyService.deleteApiKey('', 'gemini'))
          .rejects.toThrow('User ID is required');
      });

      it('should validate provider is required', async () => {
        const { apiKeyService } = await import('../apiKeyService');
        
        await expect(apiKeyService.deleteApiKey('user123', '' as 'gemini'))
          .rejects.toThrow('Provider is required');
      });
    });
  });

  describe('Round-trip Integration', () => {
    it('should encrypt and decrypt typical Gemini API key format', () => {
      // Typical Gemini API key format
      const apiKey = 'AIzaSyB1234567890abcdefghijklmnopqrstuvwxyz';
      
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(apiKey);
    });

    it('should handle multiple encrypt/decrypt cycles', () => {
      const apiKey = 'test-api-key';
      
      // First cycle
      const encrypted1 = encryptApiKey(apiKey);
      const decrypted1 = decryptApiKey(encrypted1);
      
      // Second cycle with decrypted value
      const encrypted2 = encryptApiKey(decrypted1);
      const decrypted2 = decryptApiKey(encrypted2);
      
      expect(decrypted1).toBe(apiKey);
      expect(decrypted2).toBe(apiKey);
      expect(encrypted1).toBe(encrypted2); // Same input = same output
    });
  });
});
