/**
 * ScriptEditorScreen Component
 * UI for viewing and editing recorded scripts
 * 
 * This screen allows users to:
 * - View a list of all recorded scripts
 * - Select a script to view/edit
 * - Edit script metadata and actions
 * - Save changes to the script file
 * - Delete scripts
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthButton } from '../components/AuthButton';
import { getIPCBridge } from '../services/ipcBridgeService';
import './ScriptEditorScreen.css';

interface ScriptInfo {
  path: string;
  filename: string;
  created_at: string;
  duration: number;
  action_count: number;
}

interface Action {
  type: 'mouse_move' | 'mouse_click' | 'key_press' | 'key_release';
  timestamp: number;
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  key?: string;
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
  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);

  const navigate = useNavigate();
  const ipcBridge = getIPCBridge();

  /**
   * Load list of scripts on mount
   */
  useEffect(() => {
    loadScripts();
  }, []);

  /**
   * Load all available scripts
   */
  const loadScripts = async () => {
    try {
      setLoading(true);
      setError(null);
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
   * Render script list
   */
  const renderScriptList = () => (
    <div className="script-list">
      <h2 className="section-title">Available Scripts</h2>
      {scripts.length === 0 ? (
        <p className="empty-text">No scripts found. Record a session first.</p>
      ) : (
        scripts.map((script, index) => (
          <div
            key={index}
            className={`script-item ${selectedScript?.path === script.path ? 'selected' : ''}`}
            onClick={() => loadScript(script)}
          >
            <div className="script-item-header">
              <span className="script-filename">{script.filename}</span>
              <button
                className="delete-button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteScript(script);
                }}
              >
                Delete
              </button>
            </div>
            <p className="script-info">
              Created: {new Date(script.created_at).toLocaleString()}
            </p>
            <p className="script-info">
              Duration: {script.duration.toFixed(2)}s | Actions: {script.action_count}
            </p>
          </div>
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
              <div key={index} className="action-item">
                <div className="action-header">
                  <span className="action-index">#{index + 1}</span>
                  <span className="action-type">{action.type}</span>
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
                </div>
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
