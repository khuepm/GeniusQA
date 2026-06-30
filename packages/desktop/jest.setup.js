// Polyfill for TextEncoder/TextDecoder
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock import.meta for Jest environment
global.importMeta = {
  env: {
    VITE_FIREBASE_API_KEY: 'test-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'test-auth-domain',
    VITE_FIREBASE_PROJECT_ID: 'test-project-id',
    VITE_FIREBASE_STORAGE_BUCKET: 'test-storage-bucket',
    VITE_FIREBASE_MESSAGING_SENDER_ID: 'test-sender-id',
    VITE_FIREBASE_APP_ID: 'test-app-id',
    VITE_GOOGLE_WEB_CLIENT_ID: 'test-google-client-id'
  }
};

// Mock import.meta.env for Jest
jest.mock('./src/utils/env', () => ({
  getEnvVar: jest.fn((key, fallback) => {
    const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
    const mockEnv = {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test-auth-domain',
      VITE_FIREBASE_PROJECT_ID: 'test-project-id',
      VITE_FIREBASE_STORAGE_BUCKET: 'test-storage-bucket',
      VITE_FIREBASE_MESSAGING_SENDER_ID: 'test-sender-id',
      VITE_FIREBASE_APP_ID: 'test-app-id',
      VITE_GOOGLE_WEB_CLIENT_ID: 'test-google-client-id'
    };
    return mockEnv[viteKey] || fallback || '';
  }),
  getRequiredEnvVar: jest.fn((key) => {
    const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
    const mockEnv = {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test-auth-domain',
      VITE_FIREBASE_PROJECT_ID: 'test-project-id',
      VITE_FIREBASE_STORAGE_BUCKET: 'test-storage-bucket',
      VITE_FIREBASE_MESSAGING_SENDER_ID: 'test-sender-id',
      VITE_FIREBASE_APP_ID: 'test-app-id',
      VITE_GOOGLE_WEB_CLIENT_ID: 'test-google-client-id'
    };
    const value = mockEnv[viteKey];
    if (!value) {
      throw new Error(`Required environment variable not found: ${viteKey}`);
    }
    return value;
  }),
  hasEnvVar: jest.fn((key) => {
    const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
    const mockEnv = {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test-auth-domain',
      VITE_FIREBASE_PROJECT_ID: 'test-project-id',
      VITE_FIREBASE_STORAGE_BUCKET: 'test-storage-bucket',
      VITE_FIREBASE_MESSAGING_SENDER_ID: 'test-sender-id',
      VITE_FIREBASE_APP_ID: 'test-app-id',
      VITE_GOOGLE_WEB_CLIENT_ID: 'test-google-client-id'
    };
    return !!mockEnv[viteKey];
  })
}));

// Mock Firebase for web
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'test-app' })),
}));

// firebase.config.ts initializes Firestore and Analytics at module load.
// Mock them so importing any component tree that pulls in the config does not
// hit the real Firebase SDK (which throws "getProvider" against a mock app).
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ type: 'firestore' })),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => ({})),
  Timestamp: { now: jest.fn(() => ({ toDate: () => new Date(0) })) },
}));

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({ type: 'analytics' })),
  isSupported: jest.fn().mockResolvedValue(false),
  logEvent: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn()
  })),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    credential: jest.fn()
  })),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn()
}));
