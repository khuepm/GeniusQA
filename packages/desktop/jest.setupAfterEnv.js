// Enhanced test environment isolation setup for afterEnv
beforeEach(() => {
  // Clear DOM completely to prevent component duplication
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Reset document state
  document.title = '';

  // Clear any global state that might persist between tests
  if (global.gc) {
    global.gc();
  }

  // Clear all timers and intervals
  jest.clearAllTimers();
  jest.clearAllMocks();

  // Reset any React-specific state
  if (window.React) {
    // Clear any React DevTools state
    delete window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  }

  // Clear localStorage and sessionStorage
  if (window.localStorage) {
    window.localStorage.clear();
  }
  if (window.sessionStorage) {
    window.sessionStorage.clear();
  }

  // Reset window properties that might affect tests
  window.scrollTo = jest.fn();
  window.focus = jest.fn();
  window.blur = jest.fn();
});

afterEach(() => {
  // Comprehensive cleanup after each test

  // Clear DOM completely
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Clear all timers and intervals
  jest.clearAllTimers();

  // Clean up all event listeners
  const events = ['click', 'keydown', 'keyup', 'mousedown', 'mouseup', 'scroll', 'resize', 'focus', 'blur', 'load', 'unload'];
  events.forEach(event => {
    // Remove all listeners from document
    const listeners = document.getEventListeners ? document.getEventListeners(document) : {};
    if (listeners[event]) {
      listeners[event].forEach(listener => {
        document.removeEventListener(event, listener.listener, listener.useCapture);
      });
    }

    // Remove all listeners from window
    const windowListeners = window.getEventListeners ? window.getEventListeners(window) : {};
    if (windowListeners[event]) {
      windowListeners[event].forEach(listener => {
        window.removeEventListener(event, listener.listener, listener.useCapture);
      });
    }
  });

  // Clear any React portals or modals
  const portals = document.querySelectorAll('[data-react-portal]');
  portals.forEach(portal => portal.remove());

  // Clear any tooltips or overlays
  const overlays = document.querySelectorAll('.tooltip, .overlay, .modal, .popup');
  overlays.forEach(overlay => overlay.remove());

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});
