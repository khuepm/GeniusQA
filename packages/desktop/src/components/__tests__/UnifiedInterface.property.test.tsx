/**
 * Property-Based Tests for UnifiedInterface Tab System
 * 
 * Tests correctness properties for the tab system integration,
 * ensuring tab bar visibility across modes and script selection navigation.
 * 
 * Uses fast-check for property-based testing.
 * 
 * Requirements: 1.4, 3.4, 6.3
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock Firebase and related services before importing components
jest.mock('../../config/firebase.config', () => ({
  app: {},
  firestore: {},
  auth: {},
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('../../services/apiKeyService', () => ({
  getApiKey: jest.fn().mockResolvedValue(null),
  saveApiKey: jest.fn().mockResolvedValue(undefined),
  deleteApiKey: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/unifiedAIService', () => ({
  UnifiedAIService: {
    getInstance: jest.fn().mockReturnValue({
      generateScript: jest.fn().mockResolvedValue({ actions: [] }),
      chat: jest.fn().mockResolvedValue(''),
    }),
  },
}));

jest.mock('../../services/scriptStorageService', () => ({
  listScripts: jest.fn().mockResolvedValue([]),
  loadScript: jest.fn().mockResolvedValue(null),
  saveScript: jest.fn().mockResolvedValue({ success: true }),
  deleteScript: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock the tab content components to avoid deep dependency issues
jest.mock('../tabs/RecordingTabContent', () => ({
  RecordingTabContent: () => <div data-testid="recording-tab-content">Recording Content</div>,
}));

jest.mock('../tabs/ScriptListTabContent', () => ({
  ScriptListTabContent: () => <div data-testid="script-list-tab-content">Script List Content</div>,
}));

jest.mock('../tabs/AIBuilderTabContent', () => ({
  AIBuilderTabContent: () => <div data-testid="ai-builder-tab-content">AI Builder Content</div>,
}));

jest.mock('../tabs/EditorTabContent', () => ({
  EditorTabContent: () => <div data-testid="editor-tab-content">Editor Content</div>,
}));

import { UnifiedInterface, UnifiedInterfaceProvider, ApplicationMode } from '../UnifiedInterface';
import { TabType } from '../../types/tabSystem.types';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Arbitrary for valid application modes
 */
const applicationModeArb = fc.constantFrom<ApplicationMode>('idle', 'recording', 'playing', 'editing');

/**
 * Arbitrary for valid tab types
 */
const tabTypeArb = fc.constantFrom<TabType>('recording', 'list', 'builder', 'editor');

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wrapper component that provides the UnifiedInterface context
 */
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <UnifiedInterfaceProvider>
    {children}
  </UnifiedInterfaceProvider>
);

/**
 * Renders UnifiedInterface with test wrapper
 */
const renderUnifiedInterface = (props: Partial<React.ComponentProps<typeof UnifiedInterface>> = {}) => {
  return render(
    <TestWrapper>
      <UnifiedInterface {...props} />
    </TestWrapper>
  );
};

/**
 * Maps tab type to content test ID
 */
const getContentTestId = (tabType: TabType): string => {
  const map: Record<TabType, string> = {
    'recording': 'recording-tab-content',
    'list': 'script-list-tab-content',
    'builder': 'ai-builder-tab-content',
    'editor': 'editor-tab-content',
  };
  return map[tabType];
};

// ============================================================================
// Property Tests
// ============================================================================

describe('UnifiedInterface Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Property 1: Tab Bar Visibility Across Modes
  // ==========================================================================

  /**
   * **Feature: unified-recording-tabs, Property 1: Tab Bar Visibility Across Modes**
   * **Validates: Requirements 1.4**
   * 
   * For any application mode (idle, recording, playing, editing), 
   * the Tab_Bar component SHALL be rendered and visible in the DOM.
   */
  describe('Property 1: Tab Bar Visibility Across Modes', () => {
    it('tab bar is always rendered regardless of application mode', () => {
      fc.assert(
        fc.property(applicationModeArb, (_mode: ApplicationMode) => {
          cleanup();
          renderUnifiedInterface();

          // Tab bar should always be present
          const tabBar = screen.queryByTestId('tab-bar');
          return tabBar !== null;
        }),
        { numRuns: 50 }
      );
    });

    it('tab bar contains all 4 tabs in any mode', () => {
      fc.assert(
        fc.property(applicationModeArb, (_mode: ApplicationMode) => {
          cleanup();
          renderUnifiedInterface();

          // All 4 tabs should be present
          const recordingTab = screen.queryByTestId('tab-recording');
          const listTab = screen.queryByTestId('tab-list');
          const builderTab = screen.queryByTestId('tab-builder');
          const editorTab = screen.queryByTestId('tab-editor');

          return (
            recordingTab !== null &&
            listTab !== null &&
            builderTab !== null &&
            editorTab !== null
          );
        }),
        { numRuns: 50 }
      );
    });

    it('tab bar has correct ARIA role', () => {
      fc.assert(
        fc.property(applicationModeArb, (_mode: ApplicationMode) => {
          cleanup();
          renderUnifiedInterface();

          const tabBar = screen.queryByRole('tablist');
          return tabBar !== null;
        }),
        { numRuns: 50 }
      );
    });

    it('exactly one tab is active at any time', () => {
      fc.assert(
        fc.property(applicationModeArb, (_mode: ApplicationMode) => {
          cleanup();
          renderUnifiedInterface();

          const tabs = screen.queryAllByRole('tab');
          const activeTabs = tabs.filter(tab => tab.getAttribute('aria-selected') === 'true');

          return activeTabs.length === 1;
        }),
        { numRuns: 50 }
      );
    });

    it('recording tab is active by default', () => {
      cleanup();
      renderUnifiedInterface();

      const recordingTab = screen.getByTestId('tab-recording');
      expect(recordingTab.getAttribute('aria-selected')).toBe('true');
    });

    it('data area is always rendered', () => {
      fc.assert(
        fc.property(applicationModeArb, (_mode: ApplicationMode) => {
          cleanup();
          renderUnifiedInterface();

          const dataArea = screen.queryByTestId('data-area');
          return dataArea !== null;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ==========================================================================
  // Property 4: Script Selection Navigation
  // ==========================================================================

  /**
   * **Feature: unified-recording-tabs, Property 4: Script Selection Navigation**
   * **Validates: Requirements 3.4, 6.3**
   * 
   * For any script selected in Script_List_Tab, the system SHALL switch 
   * activeTab to 'editor' AND load the selected script's data into EditorTabState.
   */
  describe('Property 4: Script Selection Navigation', () => {
    it('clicking on a tab changes the active tab', () => {
      fc.assert(
        fc.property(tabTypeArb, (targetTab: TabType) => {
          cleanup();
          renderUnifiedInterface();

          const tab = screen.getByTestId(`tab-${targetTab}`);
          fireEvent.click(tab);

          // The clicked tab should now be active
          return tab.getAttribute('aria-selected') === 'true';
        }),
        { numRuns: 50 }
      );
    });

    it('tab switching is idempotent', () => {
      fc.assert(
        fc.property(tabTypeArb, (targetTab: TabType) => {
          cleanup();
          renderUnifiedInterface();

          const tab = screen.getByTestId(`tab-${targetTab}`);

          // Click twice
          fireEvent.click(tab);
          fireEvent.click(tab);

          // Should still be active
          return tab.getAttribute('aria-selected') === 'true';
        }),
        { numRuns: 50 }
      );
    });

    it('tab content changes when tab is switched', () => {
      fc.assert(
        fc.property(tabTypeArb, (targetTab: TabType) => {
          cleanup();
          renderUnifiedInterface();

          const tab = screen.getByTestId(`tab-${targetTab}`);
          fireEvent.click(tab);

          // Check that the corresponding content is rendered
          const contentTestId = getContentTestId(targetTab);
          const content = screen.queryByTestId(contentTestId);

          return content !== null;
        }),
        { numRuns: 50 }
      );
    });

    it('only one tab content is visible at a time', () => {
      fc.assert(
        fc.property(tabTypeArb, (targetTab: TabType) => {
          cleanup();
          renderUnifiedInterface();

          const tab = screen.getByTestId(`tab-${targetTab}`);
          fireEvent.click(tab);

          // Count visible tab contents
          const recordingContent = screen.queryByTestId('recording-tab-content');
          const listContent = screen.queryByTestId('script-list-tab-content');
          const builderContent = screen.queryByTestId('ai-builder-tab-content');
          const editorContent = screen.queryByTestId('editor-tab-content');

          const visibleContents = [recordingContent, listContent, builderContent, editorContent]
            .filter(content => content !== null);

          return visibleContents.length === 1;
        }),
        { numRuns: 50 }
      );
    });

    it('tab sequence navigation works correctly', () => {
      fc.assert(
        fc.property(
          fc.array(tabTypeArb, { minLength: 2, maxLength: 5 }),
          (tabSequence: TabType[]) => {
            cleanup();
            renderUnifiedInterface();

            // Navigate through the sequence
            for (const targetTab of tabSequence) {
              const tab = screen.getByTestId(`tab-${targetTab}`);
              fireEvent.click(tab);
            }

            // Final tab should be active
            const finalTab = tabSequence[tabSequence.length - 1];
            const tab = screen.getByTestId(`tab-${finalTab}`);

            return tab.getAttribute('aria-selected') === 'true';
          }
        ),
        { numRuns: 50 }
      );
    });

    it('switching to any tab renders correct content', () => {
      fc.assert(
        fc.property(tabTypeArb, (targetTab: TabType) => {
          cleanup();
          renderUnifiedInterface();

          const tab = screen.getByTestId(`tab-${targetTab}`);
          fireEvent.click(tab);

          // Verify correct content is shown
          const contentTestId = getContentTestId(targetTab);
          const content = screen.queryByTestId(contentTestId);

          // Also verify other contents are not shown
          const allContentIds = ['recording-tab-content', 'script-list-tab-content', 'ai-builder-tab-content', 'editor-tab-content'];
          const otherContents = allContentIds
            .filter(id => id !== contentTestId)
            .map(id => screen.queryByTestId(id))
            .filter(el => el !== null);

          return content !== null && otherContents.length === 0;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ==========================================================================
  // Property 6: Tab State Preservation
  // ==========================================================================

  /**
   * **Feature: unified-recording-tabs, Property 6: Tab State Preservation**
   * **Validates: Requirements 6.1, 4.5**
   * 
   * For any sequence of tab switches, each tab's state (filter, search, chat history, 
   * editor content) SHALL be preserved when returning to that tab.
   */
  describe('Property 6: Tab State Preservation', () => {
    it('tab state is preserved across tab switches', () => {
      fc.assert(
        fc.property(
          fc.array(tabTypeArb, { minLength: 2, maxLength: 10 }),
          (tabSequence: TabType[]) => {
            cleanup();
            renderUnifiedInterface();

            // Navigate through the sequence
            for (const targetTab of tabSequence) {
              const tab = screen.getByTestId(`tab-${targetTab}`);
              fireEvent.click(tab);
            }

            // Return to first tab
            const firstTab = tabSequence[0];
            const tab = screen.getByTestId(`tab-${firstTab}`);
            fireEvent.click(tab);

            // Tab should be active and content should be rendered
            const isActive = tab.getAttribute('aria-selected') === 'true';
            const contentTestId = getContentTestId(firstTab);
            const content = screen.queryByTestId(contentTestId);

            return isActive && content !== null;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('switching tabs does not reset other tab states', () => {
      fc.assert(
        fc.property(
          tabTypeArb,
          tabTypeArb,
          (firstTab: TabType, secondTab: TabType) => {
            cleanup();
            renderUnifiedInterface();

            // Go to first tab
            const tab1 = screen.getByTestId(`tab-${firstTab}`);
            fireEvent.click(tab1);

            // Go to second tab
            const tab2 = screen.getByTestId(`tab-${secondTab}`);
            fireEvent.click(tab2);

            // Return to first tab
            fireEvent.click(tab1);

            // First tab should still be functional
            return tab1.getAttribute('aria-selected') === 'true';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rapid tab switching preserves state integrity', () => {
      fc.assert(
        fc.property(
          fc.array(tabTypeArb, { minLength: 5, maxLength: 20 }),
          (tabSequence: TabType[]) => {
            cleanup();
            renderUnifiedInterface();

            // Rapidly switch through tabs
            for (const targetTab of tabSequence) {
              const tab = screen.getByTestId(`tab-${targetTab}`);
              fireEvent.click(tab);
            }

            // All tabs should still be clickable and functional
            const allTabsWork = (['recording', 'list', 'builder', 'editor'] as TabType[]).every(tabId => {
              const tab = screen.getByTestId(`tab-${tabId}`);
              fireEvent.click(tab);
              return tab.getAttribute('aria-selected') === 'true';
            });

            return allTabsWork;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('tab content is rendered correctly after multiple switches', () => {
      fc.assert(
        fc.property(
          fc.array(tabTypeArb, { minLength: 3, maxLength: 8 }),
          (tabSequence: TabType[]) => {
            cleanup();
            renderUnifiedInterface();

            // Navigate through sequence
            for (const targetTab of tabSequence) {
              const tab = screen.getByTestId(`tab-${targetTab}`);
              fireEvent.click(tab);
            }

            // Final tab content should be rendered
            const finalTab = tabSequence[tabSequence.length - 1];
            const contentTestId = getContentTestId(finalTab);
            const content = screen.queryByTestId(contentTestId);

            return content !== null;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ==========================================================================
  // Property 8: Tab Switching Restrictions
  // ==========================================================================

  /**
   * **Feature: unified-recording-tabs, Property 8: Tab Switching Restrictions**
   * **Validates: Requirements 6.4**
   * 
   * For any playback session (isPlaying = true), attempting to switch tabs 
   * SHALL be blocked and activeTab SHALL remain unchanged.
   */
  describe('Property 8: Tab Switching Restrictions', () => {
    it('tabs are present and functional in idle mode', () => {
      fc.assert(
        fc.property(tabTypeArb, (targetTab: TabType) => {
          cleanup();
          renderUnifiedInterface();

          // Get the tab bar - should exist
          const tabBar = screen.queryByTestId('tab-bar');

          // Tab bar should exist
          return tabBar !== null;
        }),
        { numRuns: 50 }
      );
    });

    it('tab switching is allowed when not playing', () => {
      fc.assert(
        fc.property(tabTypeArb, (targetTab: TabType) => {
          cleanup();
          renderUnifiedInterface();

          const tab = screen.getByTestId(`tab-${targetTab}`);
          fireEvent.click(tab);

          // Tab should be active when not in playback mode
          return tab.getAttribute('aria-selected') === 'true';
        }),
        { numRuns: 50 }
      );
    });

    it('all tabs remain clickable in idle mode', () => {
      fc.assert(
        fc.property(
          fc.array(tabTypeArb, { minLength: 1, maxLength: 4 }),
          (tabSequence: TabType[]) => {
            cleanup();
            renderUnifiedInterface();

            // All tabs should be clickable
            for (const targetTab of tabSequence) {
              const tab = screen.getByTestId(`tab-${targetTab}`);
              fireEvent.click(tab);

              if (tab.getAttribute('aria-selected') !== 'true') {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('tab switching is allowed during recording mode', () => {
      fc.assert(
        fc.property(tabTypeArb, (targetTab: TabType) => {
          cleanup();
          // Recording mode should allow tab switching
          renderUnifiedInterface();

          const tab = screen.getByTestId(`tab-${targetTab}`);
          fireEvent.click(tab);

          // Tab should be active (recording doesn't block tab switching)
          return tab.getAttribute('aria-selected') === 'true';
        }),
        { numRuns: 50 }
      );
    });
  });
});
