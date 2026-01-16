/**
 * TabBar Component
 * Bottom navigation bar with 4 tabs for the Unified Recording Screen
 * Requirements: 1.1, 1.2, 7.1, 7.2
 */

import React from 'react';
import { TabBarProps, TabButtonProps, TAB_CONFIGS } from '../types/tabSystem.types';
import './TabBar.css';

/**
 * TabButton Component
 * Individual tab button within the TabBar
 */
const TabButton: React.FC<TabButtonProps> = React.memo(({ tab, isActive, onClick, disabled }) => {
  const handleClick = () => {
    if (!disabled) {
      onClick();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <button
      className={`tab-button ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      data-testid={`tab-${tab.id}`}
    >
      <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
      <span className="tab-label">{tab.label}</span>
      <span className="tab-shortcut" aria-hidden="true">{tab.shortcut}</span>
    </button>
  );
});

TabButton.displayName = 'TabButton';

/**
 * TabBar Component
 * Main tab bar container that renders all tabs
 */
export const TabBar: React.FC<TabBarProps> = React.memo(({
  activeTab,
  onTabChange,
  disabled = false,
  applicationMode
}) => {
  const handleTabClick = (tabId: typeof activeTab) => {
    if (!disabled && tabId !== activeTab) {
      onTabChange(tabId);
    }
  };

  return (
    <nav
      className={`tab-bar mode-${applicationMode}`}
      role="tablist"
      aria-label="Main navigation tabs"
      data-testid="tab-bar"
    >
      {TAB_CONFIGS.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onClick={() => handleTabClick(tab.id)}
          disabled={disabled}
        />
      ))}
    </nav>
  );
});

TabBar.displayName = 'TabBar';

export default TabBar;
