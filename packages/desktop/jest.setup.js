// Polyfill for TextEncoder/TextDecoder
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock React Native modules
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({
  default: {
    API: jest.fn(),
  },
}));

// Mock React Native core modules
jest.mock('react-native', () => {
  const React = require('react');

  const mockAnimatedValue = (value) => ({
    setValue: jest.fn(),
    interpolate: jest.fn(() => mockAnimatedValue(value)),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    stopAnimation: jest.fn(),
    resetAnimation: jest.fn(),
    _value: value,
  });

  // Create mock components that work with React Native Testing Library
  const View = (props) => React.createElement('View', props, props.children);
  const Text = (props) => React.createElement('Text', props, props.children);
  const TextInput = (props) => React.createElement('TextInput', props);
  const TouchableOpacity = (props) => React.createElement('TouchableOpacity', props, props.children);
  const ActivityIndicator = (props) => React.createElement('ActivityIndicator', props);
  const ScrollView = (props) => React.createElement('ScrollView', props, props.children);

  return {
    Platform: {
      OS: 'ios',
      select: jest.fn((obj) => obj.ios || obj.default),
    },
    StyleSheet: {
      create: jest.fn((styles) => styles),
    },
    Animated: {
      Value: jest.fn((value) => mockAnimatedValue(value)),
      timing: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback()),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      spring: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback()),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      decay: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback()),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      sequence: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback()),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      parallel: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback()),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      stagger: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback()),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      loop: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback()),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      event: jest.fn(() => jest.fn()),
      createAnimatedComponent: jest.fn((component) => component),
      View: (props) => React.createElement('Animated.View', props, props.children),
      Text: (props) => React.createElement('Animated.Text', props, props.children),
      ScrollView: (props) => React.createElement('Animated.ScrollView', props, props.children),
      add: jest.fn((a, b) => mockAnimatedValue(0)),
      subtract: jest.fn((a, b) => mockAnimatedValue(0)),
      multiply: jest.fn((a, b) => mockAnimatedValue(0)),
      divide: jest.fn((a, b) => mockAnimatedValue(0)),
      modulo: jest.fn((a, b) => mockAnimatedValue(0)),
      diffClamp: jest.fn((a, min, max) => mockAnimatedValue(0)),
    },
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Alert: {
      alert: jest.fn(),
    },
    NativeModules: {},
    NativeEventEmitter: jest.fn(),
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase
jest.mock('@react-native-firebase/app', () => ({
  firebase: {
    apps: [],
  },
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    currentUser: null,
  })),
}));

// Mock Google Sign In
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ idToken: 'mock-token' })),
    signOut: jest.fn(() => Promise.resolve()),
    isSignedIn: jest.fn(() => Promise.resolve(false)),
  },
}));
