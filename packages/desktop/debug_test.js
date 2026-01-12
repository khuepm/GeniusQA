const { render } = require('@testing-library/react');
const React = require('react');

// Mock the components
jest.mock('./src/components/TopToolbar.css', () => ({}));
jest.mock('./src/components/UnifiedInterface.css', () => ({}));
jest.mock('./src/services/ipcBridgeService', () => ({
  getIPCBridge: () => ({
    checkForRecordings: jest.fn().mockResolvedValue(false),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }),
}));

const { TopToolbar } = require('./src/components/TopToolbar');
const { UnifiedInterface, UnifiedInterfaceProvider } = require('./src/components/UnifiedInterface');

test('debug toolbar rendering', () => {
  const { container } = render(
    React.createElement(UnifiedInterfaceProvider, {},
      React.createElement(UnifiedInterface, {},
        React.createElement(TopToolbar, { hasRecordings: false })
      )
    )
  );
  
  console.log('Container HTML:', container.innerHTML);
  console.log('Toolbar element:', container.querySelector('.top-toolbar'));
  console.log('All elements with class:', container.querySelectorAll('[class*="toolbar"]'));
});
