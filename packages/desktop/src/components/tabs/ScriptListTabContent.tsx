/**
 * ScriptListTabContent Component
 * 
 * Displays the script list interface within the tab system.
 * Integrates ScriptFilter and ScriptListItem components.
 * Handles script selection to switch to Editor tab.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React, { useMemo } from 'react';
import { ScriptFilter, ScriptFilterProps } from '../ScriptFilter';
import { ScriptListItem } from '../ScriptListItem';
import {
  StoredScriptInfo,
  ScriptFilter as ScriptFilterType
} from '../../services/scriptStorageService';
import './ScriptListTabContent.css';

/**
 * Props for ScriptListTabContent component
 */
export interface ScriptListTabContentProps {
  /** List of all scripts */
  scripts: StoredScriptInfo[];
  /** Current filter configuration */
  filter: ScriptFilterType;
  /** Callback when filter changes */
  onFilterChange: (filter: ScriptFilterType) => void;
  /** Callback when a script is selected (switches to Editor tab) */
  onScriptSelect: (script: StoredScriptInfo) => void;
  /** Callback when a script is deleted */
  onScriptDelete: (script: StoredScriptInfo) => void;
  /** Callback to reveal script in Finder */
  onScriptReveal?: (script: StoredScriptInfo) => void;
  /** Whether scripts are loading */
  loading: boolean;
  /** Currently selected script path */
  selectedScriptPath?: string | null;
}

/**
 * Filters scripts based on filter criteria
 * Requirements: 3.2
 */
function filterScripts(
  scripts: StoredScriptInfo[],
  filter: ScriptFilterType
): StoredScriptInfo[] {
  return scripts.filter((script) => {
    // Filter by source
    if (filter.source && filter.source !== 'all') {
      if (script.source !== filter.source) {
        return false;
      }
    }

    // Filter by target OS (only for AI-generated scripts)
    if (filter.targetOS && script.source === 'ai_generated') {
      if (script.targetOS !== filter.targetOS) {
        return false;
      }
    }

    // Filter by search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const filename = script.filename.toLowerCase();
      const scriptName = script.scriptName?.toLowerCase() || '';

      if (!filename.includes(query) && !scriptName.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * ScriptListTabContent Component
 * 
 * Main component for the Script List tab content area.
 * Displays filter controls and list of scripts.
 */
export const ScriptListTabContent: React.FC<ScriptListTabContentProps> = ({
  scripts,
  filter,
  onFilterChange,
  onScriptSelect,
  onScriptDelete,
  onScriptReveal,
  loading,
  selectedScriptPath,
}) => {
  // Filter scripts based on current filter - Requirements: 3.2
  const filteredScripts = useMemo(
    () => filterScripts(scripts, filter),
    [scripts, filter]
  );

  const hasScripts = scripts.length > 0;
  const hasFilteredScripts = filteredScripts.length > 0;

  return (
    <div className="script-list-tab-content" data-testid="script-list-tab-content">
      {/* Filter section - Requirements: 3.2, 3.3 */}
      <div className="script-list-filter-section">
        <ScriptFilter
          filter={filter}
          onFilterChange={onFilterChange}
          totalCount={scripts.length}
          filteredCount={filteredScripts.length}
          showOSFilter={true}
          showSearch={true}
          compact={false}
        />
      </div>

      {/* Scripts list section */}
      <div className="script-list-body">
        {loading ? (
          /* Loading state */
          <div className="script-list-loading" data-testid="script-list-loading">
            <div className="loading-spinner"></div>
            <p>Loading scripts...</p>
          </div>
        ) : !hasScripts ? (
          /* Empty state - no scripts at all */
          <div className="script-list-empty" data-testid="script-list-empty">
            <div className="script-list-empty-icon">📋</div>
            <p className="script-list-empty-text">No Scripts Yet</p>
            <p className="script-list-empty-hint">
              Record actions or use AI Builder to create your first script.
            </p>
          </div>
        ) : !hasFilteredScripts ? (
          /* No results for current filter */
          <div className="script-list-no-results" data-testid="script-list-no-results">
            <div className="script-list-empty-icon">🔍</div>
            <p className="script-list-empty-text">No Matching Scripts</p>
            <p className="script-list-empty-hint">
              Try adjusting your filter criteria.
            </p>
          </div>
        ) : (
          /* Scripts list - Requirements: 3.4, 3.5 */
          <div className="script-list-scroll" data-testid="script-list-items">
            {filteredScripts.map((script) => (
              <ScriptListItem
                key={script.path}
                script={script}
                selected={selectedScriptPath === script.path}
                onClick={onScriptSelect}
                onDelete={onScriptDelete}
                onReveal={onScriptReveal}
                showReveal={!!onScriptReveal}
                showDelete={true}
                compact={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScriptListTabContent;
