/**
 * ScriptEditorScreen Component
 * UI for viewing and editing recorded scripts
 * 
 * This screen allows users to:
 * - View a list of all recorded scripts with source filtering
 * - Filter scripts by source (Recorded, AI Generated, All)
 * - Select a script to view/edit
 * - Edit script metadata and actions
 * - Save changes to the script file
 * - Delete scripts
 * - Edit AI Vision Capture actions with VisionEditor
 * 
 * Requirements: 9.1, 9.2, 9.4, 9.5, 2.1
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthButton } from '../components/AuthButton';
import { ScriptFilter } from '../components/ScriptFilter';
import { ScriptListItem } from '../components/ScriptListItem';
import { VisionEditor } from '../components/VisionEditor';
import { ReferenceImageManager } from '../components/ReferenceImageManager';
import { scriptStorageService, StoredScriptInfo, ScriptFilter as ScriptFilterType } from '../services/scriptStorageService';
import { getIPCBridge } from '../services/ipcBridgeService';
import { aiVisionService } from '../services/aiVisionService';
import { AssetManager } from '../services/assetManager';
import { AIVisionCaptureAction } from '../types/aiVisionCapture.types';
import './ScriptEditorScreen.css';

interface ScriptInfo {
  path: string;
  filename: string;
  created_at: string;
  duration: number;
  action_count: number;
}

interface Action {
  type: 'mouse_move' | 'mouse_click' | 'key_press' | 'key_release' | 'ai_vision_capture';
  timestamp: number;
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  key?: string;
  // AI Vision Capture specific fields
  id?: string;
  is_dynamic?: boolean;
  interaction?: string;
  static_data?: {
    original_screenshot: string;
    saved_x: number | null;
    saved_y: number | null;
    screen_dim: [number, number];
  };
  dynamic_config?: {
    prompt: string;
    reference_images: string[];
    roi: { x: number; y: number; width: number; height: number } | null;
    search_scope: 'global' | 'regional';
  };
  cache_data?: {
    cached_x: number | null;
    cached_y: number | null;
    cache_dim: [number, number] | null;
  };
}

interface ScriptData {
  metadata: {
    version: string;
    created_at: string;
    duration: number;
    action_count: number;
    platform: string;
  };
  actions: Action[];
}

const ScriptEditorScreen: React.FC = () => {
  const [allScripts, setAllScripts] = useState<StoredScriptInfo[]>([]);
  const [filteredScripts, setFilteredScripts] = useState<StoredScriptInfo[]>([]);
  const [scripts, setScripts] = useState<ScriptInfo[]>([]); // Legacy for compatibility
  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);
  const [selectedStoredScript, setSelectedStoredScript] = useState<StoredScriptInfo | null>(null);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [filter, setFilter] = useState<ScriptFilterType>({ source: 'all' });
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);
  const [assetManager, setAssetManager] = useState<AssetManager | null>(null);

  const navigate = useNavigate();
  const ipcBridge = getIPCBridge();

  /**
   * Initialize asset manager when script is selected
   */
  useEffect(() => {
    if (selectedScript?.path) {
      setAssetManager(new AssetManager(selectedScript.path));
    } else {
      setAssetManager(null);
    }
  }, [selectedScript?.path]);

  /**
   * Load list of scripts on mount
   */
  useEffect(() => {
    loadScripts();
  }, []);

  /**
   * Load all available scripts with source metadata
   * Requirements: 9.1
   */
  const loadScripts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load scripts with enriched metadata using the storage service
      const enrichedScripts = await scriptStorageService.listScripts();
      setAllScripts(enrichedScripts);

      // Apply current filter
      const filtered = await scriptStorageService.listScriptsBySource(filter);
      setFilteredScripts(filtered);

      // Also load legacy format for compatibility
      const scriptList = await ipcBridge.listScripts();
      setScripts(scriptList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scripts';
      setError(errorMessage);
      console.error('Load scripts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const revealStoredScript = async (script: StoredScriptInfo) => {
    try {
      await ipcBridge.revealInFinder(script.path);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reveal script in Finder';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
      console.error('Reveal script error:', err);
    }
  };

  /**
   * Handle filter change
   * Requirements: 9.4
   */
  const handleFilterChange = useCallback(async (newFilter: ScriptFilterType) => {
    setFilter(newFilter);
    try {
      const filtered = await scriptStorageService.listScriptsBySource(newFilter);
      setFilteredScripts(filtered);
    } catch (err) {
      console.error('Filter scripts error:', err);
    }
  }, []);

  /**
   * Load a specific script for viewing/editing
   */
  const loadScript = async (script: ScriptInfo) => {
    try {
      setLoading(true);
      setError(null);
      const data = await ipcBridge.loadScript(script.path);
      setScriptData(data);
      setSelectedScript(script);
      setEditMode(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load script';
      setError(errorMessage);
      console.error('Load script error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load a specific script from StoredScriptInfo
   * Requirements: 9.3
   */
  const loadStoredScript = async (script: StoredScriptInfo) => {
    try {
      setLoading(true);
      setError(null);
      const data = await ipcBridge.loadScript(script.path);
      setScriptData(data);
      setSelectedStoredScript(script);
      // Also set legacy selectedScript for compatibility
      setSelectedScript({
        path: script.path,
        filename: script.filename,
        created_at: script.createdAt,
        duration: script.duration,
        action_count: script.actionCount,
      });
      setEditMode(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load script';
      setError(errorMessage);
      console.error('Load script error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save changes to the script
   */
  const saveScript = async () => {
    if (!selectedScript || !scriptData) return;

    try {
      setLoading(true);
      setError(null);
      await ipcBridge.saveScript(selectedScript.path, scriptData);
      setEditMode(false);
      alert('Script saved successfully');
      await loadScripts(); // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save script';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
      console.error('Save script error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete a script
   */
  const deleteScript = async (script: ScriptInfo) => {
    if (!confirm(`Are you sure you want to delete ${script.filename}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await ipcBridge.deleteScript(script.path);
      if (selectedScript?.path === script.path) {
        setSelectedScript(null);
        setScriptData(null);
      }
      await loadScripts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete script';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
      console.error('Delete script error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete a script from StoredScriptInfo
   */
  const deleteStoredScript = async (script: StoredScriptInfo) => {
    if (!confirm(`Are you sure you want to delete ${script.filename}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await ipcBridge.deleteScript(script.path);
      if (selectedStoredScript?.path === script.path) {
        setSelectedStoredScript(null);
        setSelectedScript(null);
        setScriptData(null);
      }
      await loadScripts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete script';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
      console.error('Delete script error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update action in the script
   */
  const updateAction = (index: number, field: string, value: any) => {
    if (!scriptData) return;

    const updatedActions = [...scriptData.actions];
    updatedActions[index] = {
      ...updatedActions[index],
      [field]: value,
    };

    setScriptData({
      ...scriptData,
      actions: updatedActions,
      metadata: {
        ...scriptData.metadata,
        action_count: updatedActions.length,
      },
    });
  };

  /**
   * Update AI Vision Capture action
   * Requirements: 2.1
   */
  const updateVisionAction = useCallback((index: number, updatedAction: AIVisionCaptureAction) => {
    if (!scriptData) return;

    const updatedActions = [...scriptData.actions];
    updatedActions[index] = updatedAction as unknown as Action;

    setScriptData({
      ...scriptData,
      actions: updatedActions,
    });
  }, [scriptData]);

  /**
   * Handle AI Vision analysis for an action
   * Requirements: 3.3
   */
  const handleVisionAnalyze = useCallback(async (index: number) => {
    if (!scriptData) return;

    const action = scriptData.actions[index];
    if (action.type !== 'ai_vision_capture') return;

    // The VisionEditor component handles the actual analysis
    // This callback is for any additional processing needed at the screen level
    console.log('Vision analysis triggered for action at index:', index);
  }, [scriptData]);

  /**
   * Handle saving reference image for AI Vision Capture
   * Requirements: 2.6
   */
  const handleSaveReferenceImage = useCallback(async (imageData: Blob, actionId: string): Promise<string> => {
    if (!assetManager) {
      throw new Error('Asset manager not initialized');
    }
    return await assetManager.saveReferenceImage(imageData, actionId);
  }, [assetManager]);

  /**
   * Check if an action is an AI Vision Capture action
   */
  const isVisionCaptureAction = (action: Action): action is Action & { type: 'ai_vision_capture' } => {
    return action.type === 'ai_vision_capture';
  };

  /**
   * Convert Action to AIVisionCaptureAction for VisionEditor
   */
  const toVisionCaptureAction = (action: Action): AIVisionCaptureAction | null => {
    if (!isVisionCaptureAction(action)) return null;

    return {
      type: 'ai_vision_capture',
      id: action.id || '',
      timestamp: action.timestamp,
      is_dynamic: action.is_dynamic || false,
      interaction: (action.interaction as 'click' | 'dblclick' | 'rclick' | 'hover') || 'click',
      static_data: action.static_data || {
        original_screenshot: '',
        saved_x: null,
        saved_y: null,
        screen_dim: [1920, 1080],
      },
      dynamic_config: action.dynamic_config || {
        prompt: '',
        reference_images: [],
        roi: null,
        search_scope: 'global',
      },
      cache_data: action.cache_data || {
        cached_x: null,
        cached_y: null,
        cache_dim: null,
      },
    };
  };

  /**
   * Delete an action from the script
   */
  const deleteAction = (index: number) => {
    if (!scriptData) return;

    const updatedActions = scriptData.actions.filter((_, i) => i !== index);
    setScriptData({
      ...scriptData,
      actions: updatedActions,
      metadata: {
        ...scriptData.metadata,
        action_count: updatedActions.length,
      },
    });
  };

  /**
   * Check if any AI-generated scripts exist (for showing OS filter)
   */
  const hasAIScripts = allScripts.some(s => s.source === 'ai_generated');

  /**
   * Render script list with filtering
   * Requirements: 9.1, 9.2, 9.4, 9.5
   */
  const renderScriptList = () => (
    <div className="script-list">
      <h2 className="section-title">Available Scripts</h2>

      {/* Script Filter Component */}
      <ScriptFilter
        filter={filter}
        onFilterChange={handleFilterChange}
        totalCount={allScripts.length}
        filteredCount={filteredScripts.length}
        showOSFilter={hasAIScripts}
        showSearch={true}
      />

      {filteredScripts.length === 0 ? (
        <p className="empty-text">
          {allScripts.length === 0
            ? 'No scripts found. Record a session or create an AI script first.'
            : 'No scripts match the current filter.'}
        </p>
      ) : (
        filteredScripts.map((script) => (
          <ScriptListItem
            key={script.path}
            script={script}
            selected={selectedStoredScript?.path === script.path}
            onClick={loadStoredScript}
            onReveal={revealStoredScript}
            onDelete={deleteStoredScript}
            showDelete={true}
          />
        ))
      )}
    </div>
  );

  /**
   * Render script editor
   */
  const renderScriptEditor = () => {
    if (!selectedScript || !scriptData) {
      return (
        <div className="editor-placeholder">
          <p className="placeholder-text">
            Select a script from the list to view or edit
          </p>
        </div>
      );
    }

    return (
      <div className="editor">
        <div className="editor-header">
          <h2 className="editor-title">{selectedScript.filename}</h2>
          <div className="editor-actions">
            {editMode ? (
              <>
                <div className="action-button">
                  <AuthButton
                    title="Save"
                    onPress={saveScript}
                    loading={loading}
                    variant="primary"
                  />
                </div>
                <div className="action-button">
                  <AuthButton
                    title="Cancel"
                    onPress={() => {
                      setEditMode(false);
                      loadScript(selectedScript);
                    }}
                    variant="secondary"
                  />
                </div>
              </>
            ) : (
              <div className="action-button">
                <AuthButton
                  title="Edit"
                  onPress={() => setEditMode(true)}
                  variant="primary"
                />
              </div>
            )}
          </div>
        </div>

        <div className="editor-content">
          {/* Metadata Section */}
          <div className="metadata-section">
            <h3 className="subsection-title">Metadata</h3>
            <div className="metadata-grid">
              <span className="metadata-label">Version:</span>
              <span className="metadata-value">{scriptData.metadata.version}</span>

              <span className="metadata-label">Created:</span>
              <span className="metadata-value">
                {new Date(scriptData.metadata.created_at).toLocaleString()}
              </span>

              <span className="metadata-label">Duration:</span>
              <span className="metadata-value">
                {scriptData.metadata.duration.toFixed(2)}s
              </span>

              <span className="metadata-label">Actions:</span>
              <span className="metadata-value">{scriptData.metadata.action_count}</span>

              <span className="metadata-label">Platform:</span>
              <span className="metadata-value">{scriptData.metadata.platform}</span>
            </div>
          </div>

          {/* Actions Section */}
          <div className="actions-section">
            <h3 className="subsection-title">
              Actions ({scriptData.actions.length})
            </h3>
            {scriptData.actions.map((action, index) => (
              <div key={index} className={`action-item ${selectedActionIndex === index ? 'selected' : ''}`}>
                <div className="action-header">
                  <span className="action-index">#{index + 1}</span>
                  <span className={`action-type ${action.type === 'ai_vision_capture' ? 'vision-action' : ''}`}>
                    {action.type === 'ai_vision_capture' ? '🔍 AI Vision Capture' : action.type}
                  </span>
                  {action.type === 'ai_vision_capture' && (
                    <button
                      className="action-expand-button"
                      onClick={() => setSelectedActionIndex(selectedActionIndex === index ? null : index)}
                      title={selectedActionIndex === index ? 'Collapse' : 'Expand'}
                    >
                      {selectedActionIndex === index ? '▼' : '▶'}
                    </button>
                  )}
                  {editMode && (
                    <button
                      className="action-delete-button"
                      onClick={() => deleteAction(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="action-details">
                  <span className="action-detail">
                    Time: {action.timestamp.toFixed(3)}s
                  </span>
                  {action.x !== undefined && (
                    <span className="action-detail">X: {action.x}</span>
                  )}
                  {action.y !== undefined && (
                    <span className="action-detail">Y: {action.y}</span>
                  )}
                  {action.button && (
                    <span className="action-detail">Button: {action.button}</span>
                  )}
                  {action.key && (
                    <span className="action-detail">Key: {action.key}</span>
                  )}
                  {/* AI Vision Capture specific details */}
                  {action.type === 'ai_vision_capture' && (
                    <>
                      <span className="action-detail">
                        Mode: {action.is_dynamic ? 'Dynamic' : 'Static'}
                      </span>
                      <span className="action-detail">
                        Interaction: {action.interaction || 'click'}
                      </span>
                      {action.static_data?.saved_x !== null && action.static_data?.saved_y !== null && (
                        <span className="action-detail">
                          Coords: ({action.static_data.saved_x}, {action.static_data.saved_y})
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* VisionEditor for AI Vision Capture actions (Requirement: 2.1) */}
                {action.type === 'ai_vision_capture' && selectedActionIndex === index && (
                  <div className="vision-editor-container">
                    {(() => {
                      const visionAction = toVisionCaptureAction(action);
                      if (!visionAction) return null;

                      return (
                        <>
                          <VisionEditor
                            action={visionAction}
                            onUpdate={(updatedAction) => updateVisionAction(index, updatedAction)}
                            onAnalyze={() => handleVisionAnalyze(index)}
                            assetsBasePath={assetManager?.getAssetsDir() || ''}
                          />

                          {/* Reference Image Manager */}
                          <div className="reference-images-section">
                            <ReferenceImageManager
                              images={visionAction.dynamic_config.reference_images}
                              onImagesChange={(images) => {
                                const updated: AIVisionCaptureAction = {
                                  ...visionAction,
                                  dynamic_config: {
                                    ...visionAction.dynamic_config,
                                    reference_images: images,
                                  },
                                };
                                updateVisionAction(index, updated);
                              }}
                              assetsBasePath={assetManager?.getAssetsDir() || ''}
                              onSaveImage={handleSaveReferenceImage}
                              actionId={visionAction.id}
                              disabled={!editMode}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="script-editor-container">
      {/* Header */}
      <div className="header">
        <button
          className="back-button"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
        <h1 className="header-title">Script Editor</h1>
        <button
          className="refresh-button"
          onClick={loadScripts}
        >
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-container">
          <p className="error-text">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="content">
        <div className="left-panel">
          {renderScriptList()}
        </div>
        <div className="right-panel">
          {renderScriptEditor()}
        </div>
      </div>
    </div>
  );
};

export default ScriptEditorScreen;
