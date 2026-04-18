/**
 * Type definitions for Tab System
 * 
 * This module defines all TypeScript interfaces and types used in the tab system
 * for the Unified Recording Screen. It provides type safety for tab navigation,
 * state management, and UI components.
 * 
 * Requirements: 1.1, 1.2
 */

import { ApplicationMode } from '../components/UnifiedInterface';

/**
 * Tab type identifiers
 * 
 * @typedef {'list' | 'builder' | 'editor'} TabType
 * - list: Tab showing the script list from UnifiedScriptManager
 * - builder: Default tab showing the AI Builder interface
 * - editor: Tab showing the script editor
 */
export type TabType = 'list' | 'builder' | 'editor';

/**
 * Tab configuration
 * 
 * Defines the static configuration for each tab including display properties
 * and keyboard shortcuts.
 * 
 * @interface TabConfig
 * @property {TabType} id - Unique identifier for the tab
 * @property {string} label - Display label for the tab
 * @property {string} icon - Icon emoji or identifier for the tab
 * @property {string} shortcut - Keyboard shortcut display text (e.g., "⌘1" or "Ctrl+1")
 */
export interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  shortcut: string;
}

/**
 * TabBar component props
 * 
 * Props for the main TabBar component that renders the tab navigation.
 * 
 * @interface TabBarProps
 * @property {TabType} activeTab - Currently selected tab
 * @property {(tab: TabType) => void} onTabChange - Callback when tab is clicked
 * @property {boolean} [disabled] - Whether all tabs are disabled (e.g., during playback)
 * @property {ApplicationMode} applicationMode - Current application mode for visual indicators
 */
export interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  disabled?: boolean;
  applicationMode: ApplicationMode;
}

/**
 * TabButton component props
 * 
 * Props for individual tab button components within the TabBar.
 * 
 * @interface TabButtonProps
 * @property {TabConfig} tab - Configuration for this tab
 * @property {boolean} isActive - Whether this tab is currently selected
 * @property {() => void} onClick - Click handler for the tab
 * @property {boolean} [disabled] - Whether this tab is disabled
 */
export interface TabButtonProps {
  tab: TabConfig;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Default tab configurations
 * 
 * Static configuration array for all tabs in the system.
 * Order determines display order in the TabBar.
 */
export const TAB_CONFIGS: TabConfig[] = [
  { id: 'builder', label: 'AI Builder', icon: '🤖', shortcut: '⌘1' },
  { id: 'list', label: 'Script List', icon: '📋', shortcut: '⌘2' },
  { id: 'editor', label: 'Editor', icon: '✏️', shortcut: '⌘3' },
];

/**
 * Get tab configuration by ID
 * 
 * @param {TabType} tabId - Tab identifier
 * @returns {TabConfig | undefined} Tab configuration or undefined if not found
 */
export const getTabConfig = (tabId: TabType): TabConfig | undefined => {
  return TAB_CONFIGS.find(tab => tab.id === tabId);
};

/**
 * Validate tab type
 * 
 * @param {string} tabId - Tab identifier to validate
 * @returns {boolean} True if valid tab type
 */
export const isValidTabType = (tabId: string): tabId is TabType => {
  return ['list', 'builder', 'editor'].includes(tabId);
};
