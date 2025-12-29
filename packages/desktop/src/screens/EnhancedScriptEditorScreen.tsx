/**
 * Enhanced Script Editor Screen Component
 * 
 * Enhanced version of the script editor with dual-pane layout for step-based editing.
 * Integrates TestStepPlanner (left pane) and ActionCanvas (right pane) components.
 * Maintains compatibility with existing script loading and saving workflows.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthButton } from '../components/AuthButton';
import { ScriptFilter } from '../components/ScriptFilter';
import { ScriptListItem } from '../components/ScriptListItem';
import { TestStepPlanner } from '../components/TestStepPlanner';
import { ActionCanvas } from '../components/ActionCanvas';
import { TestScriptMigrationService } from '../services/testScriptMigrationService';
import { scriptStorageService, StoredScriptInfo, ScriptFilter as ScriptFilterType } from '../services/scriptStorageService';
import { getIPCBridge } from '../services/ipcBridgeService';
import { AssetManager } from '../services/assetManager';
import { mergeTestSteps, validateStepMerging } from '../utils/stepMerging';
import { splitTestStep, StepSplitConfig } from '../utils/stepSplitting';
import {
  createCleanEditorState,
  createCleanScriptCopy,
  validateScriptPurity
} from '../utils/sessionStateIsolation';
import {
  TestScript,
  TestStep,
  ActionWithId,
  StepUIState,
  StepEditorState,
  StepOperationPayload,
  StepRecordingState
} from '../types/testCaseDriven.types';
import './EnhancedScriptEditorScreen.css';

export const EnhancedScriptEditorScreen: React.FC = () => {
  const [allScripts, setAllScripts] = useState<StoredScriptInfo[]>([]);
  const [filteredScripts, setFilteredScripts] = useState<StoredScriptInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScriptFilterType>({ source: 'all' });
  const [assetManager, setAssetManager] = useState<AssetManager | null>(null);

  // Step-based editor state
  const [editorState, setEditorState] = useState<StepEditorState>({
    script: null,
    step_ui_states: [],
    selected_step_id: null,
    recording_state: {
      current_active_step_id: null,
      recording_mode: 'inactive',
      pending_actions: [],
    },
    modified: false,
    error: null,
  });

  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedStoredScript, setSelectedStoredScript] = useState<StoredScriptInfo | null>(null);

  const navigate = useNavigate();
  const ipcBridge = getIPCBridge();

  /**
   * Initialize asset manager when script is selected
   */
  useEffect(() => {
    if (selectedStoredScript?.path) {
      setAssetManager(new AssetManager(selectedStoredScript.path));
    } else {
      setAssetManager(null);
    }
  }, [selectedStoredScript?.path]);

  /**
   * Load list of scripts on mount
   */
  useEffect(() => {
    loadScripts();
  }, []);

  /**
   * Generate step UI states from current script
   */
  const stepUIStates = useMemo((): StepUIState[] => {
    if (!editorState.script) return [];

    return editorState.script.steps.map(step => ({
      step,
      indicator: editorState.recording_state.current_active_step_id === step.id
        ? 'recording'
        : step.action_ids.length > 0
          ? 'mapped'
          : 'manual',
      selected: editorState.selected_step_id === step.id,
      expanded: false,
    }));
  }, [editorState.script, editorState.selected_step_id, editorState.recording_state.current_active_step_id]);

  /**
   * Get currently selected step
   */
  const selectedStep = useMemo((): TestStep | null => {
    if (!editorState.script || !editorState.selected_step_id) return null;
    return editorState.script.steps.find(step => step.id === editorState.selected_step_id) || null;
  }, [editorState.script, editorState.selected_step_id]);

  /**
   * Load all available scripts
   */
  const loadScripts = async () => {
    try {
      setLoading(true);
      setError(null);

      const enrichedScripts = await scriptStorageService.listScripts();
      setAllScripts(enrichedScripts);

      const filtered = await scriptStorageService.listScriptsBySource(filter);
      setFilteredScripts(filtered);
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
   * Load a script for editing
   */
  const loadStoredScript = async (script: StoredScriptInfo) => {
    try {
      setLoading(true);
      setError(null);

      const rawData = await ipcBridge.loadScript(script.path);
      let testScript: TestScript;

      // Check if script needs migration
      if (TestScriptMigrationService.isLegacyFormat(rawData)) {
        console.log('Migrating legacy script to step-based format');
        testScript = TestScriptMigrationService.migrateLegacyScript(rawData);

        // Validate migration
        const validation = TestScriptMigrationService.validateMigration(rawData, testScript);
        if (!validation.isValid) {
          console.warn('Migration validation warnings:', validation.errors);
        }
      } else if (TestScriptMigrationService.isStepBasedFormat(rawData)) {
        testScript = rawData as TestScript;
      } else {
        throw new Error('Unknown script format');
      }

      // Create clean editor state without runtime data
      const cleanEditorState = createCleanEditorState(testScript);
      setEditorState(cleanEditorState);

      setSelectedStoredScript(script);
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
   * Save the current script
   */
  const saveScript = async () => {
    if (!selectedStoredScript || !editorState.script) return;

    try {
      setLoading(true);
      setError(null);

      // Create clean copy of script without runtime data
      const cleanScript = createCleanScriptCopy(editorState.script);

      // Validate that script contains no runtime data
      const validation = validateScriptPurity(cleanScript);
      if (!validation.isPure) {
        console.warn('Script purity validation issues:', validation.issues);
        // Continue saving but log the issues for debugging
      }

      // Convert to legacy format for saving (maintaining compatibility)
      const legacyData = TestScriptMigrationService.convertToLegacyFormat(cleanScript);

      await ipcBridge.saveScript(selectedStoredScript.path, legacyData);

      setEditorState(prev => ({ ...prev, modified: false }));
      setEditMode(false);
      alert('Script saved successfully');
      await loadScripts();
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
        setEditorState({
          script: null,
          step_ui_states: [],
          selected_step_id: null,
          recording_state: {
            current_active_step_id: null,
            recording_mode: 'inactive',
            pending_actions: [],
          },
          modified: false,
          error: null,
        });
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
   * Handle step selection
   */
  const handleStepSelect = useCallback((stepId: string) => {
    setEditorState(prev => ({
      ...prev,
      selected_step_id: stepId,
    }));
  }, []);

  /**
   * Handle step operations (add, edit, delete, reorder)
   */
  const handleStepOperation = useCallback((payload: StepOperationPayload) => {
    if (!editorState.script) return;

    let updatedScript = { ...editorState.script };

    switch (payload.operation) {
      case 'add':
        if (payload.step_data) {
          const newStep: TestStep = {
            ...payload.step_data,
            id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            order: updatedScript.steps.length + 1,
          };
          updatedScript.steps = [...updatedScript.steps, newStep];
        }
        break;

      case 'edit':
        if (payload.step_id && payload.step_data) {
          updatedScript.steps = updatedScript.steps.map(step =>
            step.id === payload.step_id ? { ...payload.step_data, id: step.id } : step
          );
        }
        break;

      case 'delete':
        if (payload.step_id) {
          const stepToDelete = updatedScript.steps.find(s => s.id === payload.step_id);
          if (stepToDelete) {
            // Remove step
            updatedScript.steps = updatedScript.steps.filter(s => s.id !== payload.step_id);

            // Remove actions from pool if they're not referenced by other steps
            const remainingActionIds = new Set(
              updatedScript.steps.flatMap(s => s.action_ids)
            );

            for (const actionId of stepToDelete.action_ids) {
              if (!remainingActionIds.has(actionId)) {
                delete updatedScript.action_pool[actionId];
              }
            }

            // Reorder remaining steps
            updatedScript.steps = updatedScript.steps
              .sort((a, b) => a.order - b.order)
              .map((step, index) => ({ ...step, order: index + 1 }));
          }
        }
        break;

      case 'reorder':
        if (payload.step_id && payload.new_order) {
          // Implementation would use the stepReordering utility
          console.log('Reorder operation not yet implemented');
        }
        break;

      case 'merge':
        if (payload.merge_step_ids && payload.merge_step_ids.length >= 2) {
          try {
            // Validate merge operation
            const validation = validateStepMerging(updatedScript, payload.merge_step_ids);
            if (!validation.success) {
              setError(`Merge failed: ${validation.error}`);
              return;
            }

            // Extract custom description and expected result from step_data if provided
            const customDescription = payload.step_data?.description;
            const customExpectedResult = payload.step_data?.expected_result;

            // Perform merge operation
            updatedScript = mergeTestSteps(
              updatedScript,
              payload.merge_step_ids,
              customDescription,
              customExpectedResult
            );
          } catch (error) {
            setError(`Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
          }
        }
        break;

      case 'split':
        if (payload.step_id && payload.step_data?.splits) {
          try {
            const splitConfig: StepSplitConfig = {
              stepId: payload.step_id,
              splits: payload.step_data.splits,
            };

            const result = splitTestStep(updatedScript, splitConfig);
            if (!result.success) {
              setError(`Split failed: ${result.error}`);
              return;
            }

            if (result.script) {
              updatedScript = result.script;
            }
          } catch (error) {
            setError(`Split failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
          }
        }
        break;
    }

    setEditorState(prev => ({
      ...prev,
      script: updatedScript,
      modified: true,
    }));
  }, [editorState.script]);

  /**
   * Reset session state to clean state
   * 
   * Clears all runtime execution data while preserving the script.
   * Used after execution completes or when starting a fresh session.
   */
  const resetSessionState = useCallback(() => {
    if (!editorState.script) return;

    const cleanState = createCleanEditorState(editorState.script);
    setEditorState(cleanState);
  }, [editorState.script]);

  /**
   * Handle action updates
   */
  const handleActionUpdate = useCallback((actionId: string, updatedAction: ActionWithId) => {
    if (!editorState.script) return;

    const updatedScript = {
      ...editorState.script,
      action_pool: {
        ...editorState.script.action_pool,
        [actionId]: updatedAction,
      },
    };

    setEditorState(prev => ({
      ...prev,
      script: updatedScript,
      modified: true,
    }));
  }, [editorState.script]);

  /**
   * Handle action deletion
   */
  const handleActionDelete = useCallback((actionId: string) => {
    if (!editorState.script) return;

    // Remove action from pool
    const updatedActionPool = { ...editorState.script.action_pool };
    delete updatedActionPool[actionId];

    // Remove action references from all steps
    const updatedSteps = editorState.script.steps.map(step => ({
      ...step,
      action_ids: step.action_ids.filter(id => id !== actionId),
    }));

    const updatedScript = {
      ...editorState.script,
      steps: updatedSteps,
      action_pool: updatedActionPool,
    };

    setEditorState(prev => ({
      ...prev,
      script: updatedScript,
      modified: true,
    }));
  }, [editorState.script]);

  /**
   * Handle action insertion
   */
  const handleActionInsert = useCallback((stepId: string, position: number, action: ActionWithId) => {
    if (!editorState.script) return;

    // Add action to pool
    const updatedActionPool = {
      ...editorState.script.action_pool,
      [action.id]: action,
    };

    // Add action to step at specified position
    const updatedSteps = editorState.script.steps.map(step => {
      if (step.id === stepId) {
        const newActionIds = [...step.action_ids];
        newActionIds.splice(position, 0, action.id);
        return { ...step, action_ids: newActionIds };
      }
      return step;
    });

    const updatedScript = {
      ...editorState.script,
      steps: updatedSteps,
      action_pool: updatedActionPool,
    };

    setEditorState(prev => ({
      ...prev,
      script: updatedScript,
      modified: true,
    }));
  }, [editorState.script]);

  /**
   * Handle saving reference images
   */
  const handleSaveReferenceImage = useCallback(async (imageData: Blob, actionId: string): Promise<string> => {
    if (!assetManager) {
      throw new Error('Asset manager not initialized');
    }
    return await assetManager.saveReferenceImage(imageData, actionId);
  }, [assetManager]);

  /**
   * Check if any AI-generated scripts exist
   */
  const hasAIScripts = allScripts.some(s => s.source === 'ai_generated');

  return (
    <div className="enhanced-script-editor-container">
      {/* Header */}
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1 className="header-title">Enhanced Script Editor</h1>
        <button className="refresh-button" onClick={loadScripts}>
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
        {/* Left Panel - Script List */}
        <div className="left-panel">
          <div className="script-list">
            <h2 className="section-title">Available Scripts</h2>

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
        </div>

        {/* Right Panel - Dual-Pane Editor */}
        <div className="right-panel">
          {!editorState.script ? (
            <div className="editor-placeholder">
              <p className="placeholder-text">
                Select a script from the list to view or edit
              </p>
            </div>
          ) : (
            <>
              {/* Editor Header */}
              <div className="editor-header">
                <h2 className="editor-title">{editorState.script.meta.title}</h2>
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
                            if (selectedStoredScript) {
                              loadStoredScript(selectedStoredScript);
                            }
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

              {/* Dual-Pane Editor Content */}
              <div className="dual-pane-editor">
                {/* Left Pane - Test Step Planner */}
                <div className="step-planner-pane">
                  <TestStepPlanner
                    stepStates={stepUIStates}
                    selectedStepId={editorState.selected_step_id}
                    editMode={editMode}
                    onStepSelect={handleStepSelect}
                    onStepOperation={handleStepOperation}
                    recordingStepId={editorState.recording_state.current_active_step_id}
                  />
                </div>

                {/* Right Pane - Action Canvas */}
                <div className="action-canvas-pane">
                  <ActionCanvas
                    selectedStep={selectedStep}
                    actionPool={editorState.script.action_pool}
                    editMode={editMode}
                    onActionUpdate={handleActionUpdate}
                    onActionDelete={handleActionDelete}
                    onActionInsert={handleActionInsert}
                    assetsBasePath={assetManager?.getAssetsDir() || ''}
                    onSaveReferenceImage={handleSaveReferenceImage}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedScriptEditorScreen;
