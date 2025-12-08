/**
 * ScriptFilter Component
 * 
 * Provides filtering options for script lists including:
 * - Source type filter (All, Recorded, AI Generated)
 * - Target OS filter (for AI-generated scripts)
 * - Search query input
 * 
 * Requirements: 9.4
 */

import React, { useState, useCallback } from 'react';
import { ScriptFilter as ScriptFilterType, ScriptSource, TargetOS } from '../services/scriptStorageService';
import './ScriptFilter.css';

/**
 * Props for the ScriptFilter component
 */
export interface ScriptFilterProps {
  /** Current filter state */
  filter: ScriptFilterType;
  /** Callback when filter changes */
  onFilterChange: (filter: ScriptFilterType) => void;
  /** Total count of scripts (before filtering) */
  totalCount?: number;
  /** Filtered count of scripts */
  filteredCount?: number;
  /** Whether to show OS filter (only relevant when AI scripts exist) */
  showOSFilter?: boolean;
  /** Whether to show search input */
  showSearch?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

/**
 * Source filter option configuration
 */
interface SourceOption {
  value: ScriptSource | 'all';
  label: string;
  icon: string;
}

/**
 * OS filter option configuration
 */
interface OSOption {
  value: TargetOS | undefined;
  label: string;
  icon: string;
}

/**
 * Available source filter options
 */
const SOURCE_OPTIONS: SourceOption[] = [
  { value: 'all', label: 'All Scripts', icon: '📋' },
  { value: 'recorded', label: 'Recorded', icon: '🎬' },
  { value: 'ai_generated', label: 'AI Generated', icon: '🤖' },
];

/**
 * Available OS filter options
 */
const OS_OPTIONS: OSOption[] = [
  { value: undefined, label: 'Any OS', icon: '🌐' },
  { value: 'macos', label: 'macOS', icon: '🍎' },
  { value: 'windows', label: 'Windows', icon: '🪟' },
  { value: 'universal', label: 'Universal', icon: '🔄' },
];

/**
 * ScriptFilter Component
 * Provides UI for filtering scripts by source, OS, and search query
 */
export const ScriptFilter: React.FC<ScriptFilterProps> = ({
  filter,
  onFilterChange,
  totalCount,
  filteredCount,
  showOSFilter = true,
  showSearch = true,
  compact = false,
}) => {
  const [searchValue, setSearchValue] = useState(filter.searchQuery || '');

  /**
   * Handle source filter change
   */
  const handleSourceChange = useCallback((source: ScriptSource | 'all') => {
    onFilterChange({
      ...filter,
      source,
      // Clear OS filter when switching away from AI-generated
      targetOS: source === 'ai_generated' ? filter.targetOS : undefined,
    });
  }, [filter, onFilterChange]);

  /**
   * Handle OS filter change
   */
  const handleOSChange = useCallback((targetOS: TargetOS | undefined) => {
    onFilterChange({
      ...filter,
      targetOS,
    });
  }, [filter, onFilterChange]);

  /**
   * Handle search input change with debounce
   */
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    // Debounce the filter update
    const timeoutId = setTimeout(() => {
      onFilterChange({
        ...filter,
        searchQuery: value || undefined,
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filter, onFilterChange]);

  /**
   * Clear search input
   */
  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    onFilterChange({
      ...filter,
      searchQuery: undefined,
    });
  }, [filter, onFilterChange]);

  // Determine if OS filter should be shown
  const shouldShowOSFilter = showOSFilter && filter.source === 'ai_generated';

  return (
    <div className={`script-filter-container ${compact ? 'compact' : ''}`}>
      {/* Header */}
      <div className="script-filter-header">
        <span className="script-filter-label">Filter Scripts</span>
        {totalCount !== undefined && filteredCount !== undefined && (
          <span className="script-filter-count">
            {filteredCount === totalCount
              ? `${totalCount} scripts`
              : `${filteredCount} of ${totalCount}`
            }
          </span>
        )}
      </div>

      {/* Source Filter */}
      <div className="script-filter-section">
        <div className="script-filter-section-label">Source</div>
        <div className="script-filter-options">
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`filter-option ${filter.source === option.value || (!filter.source && option.value === 'all') ? 'selected' : ''}`}
              onClick={() => handleSourceChange(option.value)}
              type="button"
            >
              <span className="filter-option-icon">{option.icon}</span>
              <span className="filter-option-label">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* OS Filter (only for AI-generated scripts) */}
      {shouldShowOSFilter && (
        <div className="script-filter-section">
          <div className="script-filter-section-label">Target OS</div>
          <div className="os-filter-options">
            {OS_OPTIONS.map((option) => (
              <button
                key={option.value || 'any'}
                className={`os-filter-option ${filter.targetOS === option.value ? 'selected' : ''}`}
                onClick={() => handleOSChange(option.value)}
                type="button"
              >
                <span className="os-filter-option-icon">{option.icon}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      {showSearch && (
        <div className="script-filter-section">
          <div className="script-filter-section-label">Search</div>
          <div className="script-filter-search">
            <span className="script-filter-search-icon">🔍</span>
            <input
              type="text"
              className="script-filter-search-input"
              placeholder="Search by name..."
              value={searchValue}
              onChange={handleSearchChange}
            />
            {searchValue && (
              <button
                className="script-filter-search-clear"
                onClick={handleClearSearch}
                type="button"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptFilter;
