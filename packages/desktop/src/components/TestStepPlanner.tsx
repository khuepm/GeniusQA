/**
 * TestStepPlanner Component
 * 
 * Left pane of the dual-pane editor interface for managing test steps.
 * Provides step list with drag-and-drop reordering, visual indicators,
 * and step management controls.
 * 
 * Requirements: 1.3, 4.1, 4.3, 4.5
 */

import React, { useState, useCallback, useRef } from 'react';
import { TestStep, StepUIState, StepIndicator, StepOperation, StepOperationPayload } from '../types/testCaseDriven.types';
import './TestStepPlanner.css';

interface TestStepPlannerProps {
  /** Array of step UI states to display */
  stepStates: StepUIState[];
  /** ID of currently selected step */
  selectedStepId: string | null;
  /** Whether the editor is in edit mode */
  editMode: boolean;
  /** Callback for step selection */
  onStepSelect: (stepId: string) => void;
  /** Callback for step operations (add, edit, delete, reorder) */
  onStepOperation: (payload: StepOperationPayload) => void;
  /** ID of step currently active for recording */
  recordingStepId: string | null;
}

interface DragState {
  isDragging: boolean;
  draggedStepId: string | null;
  dragOverStepId: string | null;
  dragStartY: number;
}

export const TestStepPlanner: React.FC<TestStepPlannerProps> = ({
  stepStates,
  selectedStepId,
  editMode,
  onStepSelect,
  onStepOperation,
  recordingStepId,
}) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedStepId: null,
    dragOverStepId: null,
    dragStartY: 0,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [newStepData, setNewStepData] = useState({
    description: '',
    expected_result: '',
    continue_on_failure: false,
  });

  // Merge functionality state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeFormData, setMergeFormData] = useState({
    description: '',
    expected_result: '',
  });

  // Split functionality state
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitStepId, setSplitStepId] = useState<string | null>(null);
  const [splitDefinitions, setSplitDefinitions] = useState<Array<{
    description: string;
    expected_result: string;
    action_ids: string[];
    continue_on_failure: boolean;
  }>>([]);

  const dragRef = useRef<HTMLDivElement>(null);

  /**
   * Get visual indicator for a step based on its state
   */
  const getStepIndicator = useCallback((stepState: StepUIState): StepIndicator => {
    if (recordingStepId === stepState.step.id) {
      return 'recording';
    }
    if (stepState.step.action_ids.length > 0) {
      return 'mapped';
    }
    return 'manual';
  }, [recordingStepId]);

  /**
   * Get indicator emoji for display
   */
  const getIndicatorEmoji = useCallback((indicator: StepIndicator): string => {
    switch (indicator) {
      case 'manual': return '⚪';
      case 'mapped': return '🟢';
      case 'recording': return '🔴';
      default: return '⚪';
    }
  }, []);

  /**
   * Handle step selection
   */
  const handleStepSelect = useCallback((stepId: string) => {
    onStepSelect(stepId);
  }, [onStepSelect]);

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback((e: React.DragEvent, stepId: string) => {
    if (!editMode) {
      e.preventDefault();
      return;
    }

    setDragState({
      isDragging: true,
      draggedStepId: stepId,
      dragOverStepId: null,
      dragStartY: e.clientY,
    });

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stepId);
  }, [editMode]);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent, stepId: string) => {
    if (!dragState.isDragging || dragState.draggedStepId === stepId) {
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    setDragState(prev => ({
      ...prev,
      dragOverStepId: stepId,
    }));
  }, [dragState.isDragging, dragState.draggedStepId]);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear drag over if we're leaving the entire step item
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragState(prev => ({
        ...prev,
        dragOverStepId: null,
      }));
    }
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();

    const draggedStepId = dragState.draggedStepId;
    if (!draggedStepId || draggedStepId === targetStepId) {
      setDragState({
        isDragging: false,
        draggedStepId: null,
        dragOverStepId: null,
        dragStartY: 0,
      });
      return;
    }

    // Find the orders of the dragged and target steps
    const draggedStep = stepStates.find(s => s.step.id === draggedStepId);
    const targetStep = stepStates.find(s => s.step.id === targetStepId);

    if (!draggedStep || !targetStep) {
      setDragState({
        isDragging: false,
        draggedStepId: null,
        dragOverStepId: null,
        dragStartY: 0,
      });
      return;
    }

    // Calculate new order based on drop position
    const newOrder = targetStep.step.order;

    // Trigger reorder operation
    onStepOperation({
      operation: 'reorder',
      step_id: draggedStepId,
      new_order: newOrder,
    });

    setDragState({
      isDragging: false,
      draggedStepId: null,
      dragOverStepId: null,
      dragStartY: 0,
    });
  }, [dragState.draggedStepId, stepStates, onStepOperation]);

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedStepId: null,
      dragOverStepId: null,
      dragStartY: 0,
    });
  }, []);

  /**
   * Handle add new step
   */
  const handleAddStep = useCallback(() => {
    if (!editMode) return;
    setShowAddForm(true);
    setNewStepData({
      description: '',
      expected_result: '',
      continue_on_failure: false,
    });
  }, [editMode]);

  /**
   * Handle save new step
   */
  const handleSaveNewStep = useCallback(() => {
    if (!newStepData.description.trim()) {
      alert('Step description is required');
      return;
    }

    const newStep: Partial<TestStep> = {
      description: newStepData.description.trim(),
      expected_result: newStepData.expected_result.trim(),
      continue_on_failure: newStepData.continue_on_failure,
      action_ids: [],
      order: stepStates.length + 1,
    };

    onStepOperation({
      operation: 'add',
      step_data: newStep as TestStep,
    });

    setShowAddForm(false);
    setNewStepData({
      description: '',
      expected_result: '',
      continue_on_failure: false,
    });
  }, [newStepData, stepStates.length, onStepOperation]);

  /**
   * Handle cancel add step
   */
  const handleCancelAddStep = useCallback(() => {
    setShowAddForm(false);
    setNewStepData({
      description: '',
      expected_result: '',
      continue_on_failure: false,
    });
  }, []);

  /**
   * Handle edit step
   */
  const handleEditStep = useCallback((stepId: string) => {
    if (!editMode) return;
    setEditingStepId(stepId);

    const step = stepStates.find(s => s.step.id === stepId)?.step;
    if (step) {
      setNewStepData({
        description: step.description,
        expected_result: step.expected_result,
        continue_on_failure: step.continue_on_failure,
      });
    }
  }, [editMode, stepStates]);

  /**
   * Handle save edited step
   */
  const handleSaveEditedStep = useCallback(() => {
    if (!editingStepId || !newStepData.description.trim()) {
      alert('Step description is required');
      return;
    }

    const originalStep = stepStates.find(s => s.step.id === editingStepId)?.step;
    if (!originalStep) return;

    const updatedStep: TestStep = {
      ...originalStep,
      description: newStepData.description.trim(),
      expected_result: newStepData.expected_result.trim(),
      continue_on_failure: newStepData.continue_on_failure,
    };

    onStepOperation({
      operation: 'edit',
      step_id: editingStepId,
      step_data: updatedStep,
    });

    setEditingStepId(null);
    setNewStepData({
      description: '',
      expected_result: '',
      continue_on_failure: false,
    });
  }, [editingStepId, newStepData, stepStates, onStepOperation]);

  /**
   * Handle cancel edit step
   */
  const handleCancelEditStep = useCallback(() => {
    setEditingStepId(null);
    setNewStepData({
      description: '',
      expected_result: '',
      continue_on_failure: false,
    });
  }, []);

  /**
   * Handle delete step
   */
  const handleDeleteStep = useCallback((stepId: string) => {
    if (!editMode) return;

    const step = stepStates.find(s => s.step.id === stepId)?.step;
    if (!step) return;

    const hasActions = step.action_ids.length > 0;
    const message = hasActions
      ? `Delete step "${step.description}"? This will also delete ${step.action_ids.length} associated actions.`
      : `Delete step "${step.description}"?`;

    if (confirm(message)) {
      onStepOperation({
        operation: 'delete',
        step_id: stepId,
      });
    }
  }, [editMode, stepStates, onStepOperation]);

  /**
   * Handle entering merge mode
   */
  const handleEnterMergeMode = useCallback(() => {
    if (!editMode) return;
    setMergeMode(true);
    setSelectedForMerge(new Set());
  }, [editMode]);

  /**
   * Handle exiting merge mode
   */
  const handleExitMergeMode = useCallback(() => {
    setMergeMode(false);
    setSelectedForMerge(new Set());
    setShowMergeDialog(false);
    setMergeFormData({ description: '', expected_result: '' });
  }, []);

  /**
   * Handle step selection for merging
   */
  const handleMergeStepToggle = useCallback((stepId: string) => {
    if (!mergeMode) return;

    setSelectedForMerge(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  }, [mergeMode]);

  /**
   * Handle starting merge process
   */
  const handleStartMerge = useCallback(() => {
    if (selectedForMerge.size < 2) {
      alert('Please select at least 2 steps to merge');
      return;
    }

    // Pre-populate merge form with combined descriptions
    const stepsToMerge = Array.from(selectedForMerge)
      .map(id => stepStates.find(s => s.step.id === id)?.step)
      .filter(Boolean)
      .sort((a, b) => a!.order - b!.order);

    const combinedDescription = stepsToMerge
      .map((step, index) => `${index + 1}. ${step!.description}`)
      .join('; ');

    const combinedExpectedResult = stepsToMerge
      .map(step => step!.expected_result)
      .filter(result => result && result.trim())
      .map((result, index) => `${index + 1}. ${result}`)
      .join('; ');

    setMergeFormData({
      description: `Merged Steps: ${combinedDescription}`,
      expected_result: combinedExpectedResult || 'All merged steps complete successfully',
    });

    setShowMergeDialog(true);
  }, [selectedForMerge, stepStates]);

  /**
   * Handle confirming merge
   */
  const handleConfirmMerge = useCallback(() => {
    if (!mergeFormData.description.trim()) {
      alert('Merge description is required');
      return;
    }

    onStepOperation({
      operation: 'merge',
      merge_step_ids: Array.from(selectedForMerge),
      step_data: {
        description: mergeFormData.description.trim(),
        expected_result: mergeFormData.expected_result.trim(),
      } as any, // We'll pass the description and expected_result through step_data
    });

    handleExitMergeMode();
  }, [mergeFormData, selectedForMerge, onStepOperation, handleExitMergeMode]);

  /**
   * Handle starting step split
   */
  const handleStartSplit = useCallback((stepId: string) => {
    if (!editMode) return;

    const step = stepStates.find(s => s.step.id === stepId)?.step;
    if (!step || step.action_ids.length < 2) {
      alert('Step must have at least 2 actions to split');
      return;
    }

    setSplitStepId(stepId);

    // Initialize with 2 empty split definitions
    setSplitDefinitions([
      {
        description: `${step.description} - Part 1`,
        expected_result: `Part 1 of: ${step.expected_result}`,
        action_ids: [],
        continue_on_failure: step.continue_on_failure,
      },
      {
        description: `${step.description} - Part 2`,
        expected_result: `Part 2 of: ${step.expected_result}`,
        action_ids: [],
        continue_on_failure: step.continue_on_failure,
      },
    ]);

    setShowSplitDialog(true);
  }, [editMode, stepStates]);

  /**
   * Handle adding a new split definition
   */
  const handleAddSplitDefinition = useCallback(() => {
    if (!splitStepId) return;

    const step = stepStates.find(s => s.step.id === splitStepId)?.step;
    if (!step) return;

    const newIndex = splitDefinitions.length + 1;
    setSplitDefinitions(prev => [
      ...prev,
      {
        description: `${step.description} - Part ${newIndex}`,
        expected_result: `Part ${newIndex} of: ${step.expected_result}`,
        action_ids: [],
        continue_on_failure: step.continue_on_failure,
      },
    ]);
  }, [splitStepId, stepStates, splitDefinitions.length]);

  /**
   * Handle removing a split definition
   */
  const handleRemoveSplitDefinition = useCallback((index: number) => {
    if (splitDefinitions.length <= 2) {
      alert('Must have at least 2 split definitions');
      return;
    }

    setSplitDefinitions(prev => prev.filter((_, i) => i !== index));
  }, [splitDefinitions.length]);

  /**
   * Handle updating split definition
   */
  const handleUpdateSplitDefinition = useCallback((
    index: number,
    field: string,
    value: any
  ) => {
    setSplitDefinitions(prev => prev.map((split, i) =>
      i === index ? { ...split, [field]: value } : split
    ));
  }, []);

  /**
   * Handle confirming split
   */
  const handleConfirmSplit = useCallback(() => {
    if (!splitStepId) return;

    // Validate that all splits have descriptions
    for (let i = 0; i < splitDefinitions.length; i++) {
      if (!splitDefinitions[i].description.trim()) {
        alert(`Split ${i + 1} must have a description`);
        return;
      }
    }

    // Validate that all action IDs are assigned
    const step = stepStates.find(s => s.step.id === splitStepId)?.step;
    if (!step) return;

    const allAssignedIds = splitDefinitions.flatMap(split => split.action_ids);
    const originalIds = step.action_ids;

    if (allAssignedIds.length !== originalIds.length ||
      !originalIds.every(id => allAssignedIds.includes(id))) {
      alert('All actions must be assigned to splits');
      return;
    }

    onStepOperation({
      operation: 'split',
      step_id: splitStepId,
      split_action_ids: splitDefinitions.map(split => split.action_ids),
      // Pass split definitions through step_data
      step_data: { splits: splitDefinitions } as any,
    });

    handleCancelSplit();
  }, [splitStepId, splitDefinitions, stepStates, onStepOperation]);

  /**
   * Handle canceling split
   */
  const handleCancelSplit = useCallback(() => {
    setShowSplitDialog(false);
    setSplitStepId(null);
    setSplitDefinitions([]);
  }, []);

  /**
   * Render step item
   */
  const renderStepItem = useCallback((stepState: StepUIState) => {
    const { step } = stepState;
    const indicator = getStepIndicator(stepState);
    const isSelected = selectedStepId === step.id;
    const isDragged = dragState.draggedStepId === step.id;
    const isDragOver = dragState.dragOverStepId === step.id;
    const isEditing = editingStepId === step.id;
    const isSelectedForMerge = selectedForMerge.has(step.id);

    if (isEditing) {
      return (
        <div key={step.id} className="step-item editing">
          <div className="step-edit-form">
            <div className="form-group">
              <label htmlFor={`desc-${step.id}`}>Description:</label>
              <input
                id={`desc-${step.id}`}
                type="text"
                value={newStepData.description}
                onChange={(e) => setNewStepData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter step description..."
                className="form-input"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor={`result-${step.id}`}>Expected Result:</label>
              <input
                id={`result-${step.id}`}
                type="text"
                value={newStepData.expected_result}
                onChange={(e) => setNewStepData(prev => ({ ...prev, expected_result: e.target.value }))}
                placeholder="Enter expected result..."
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={newStepData.continue_on_failure}
                  onChange={(e) => setNewStepData(prev => ({ ...prev, continue_on_failure: e.target.checked }))}
                />
                Continue on failure
              </label>
            </div>
            <div className="form-actions">
              <button onClick={handleSaveEditedStep} className="btn btn-primary">
                Save
              </button>
              <button onClick={handleCancelEditStep} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={step.id}
        className={`step-item ${isSelected ? 'selected' : ''} ${isDragged ? 'dragged' : ''} ${isDragOver ? 'drag-over' : ''} ${isSelectedForMerge ? 'selected-for-merge' : ''} ${mergeMode ? 'merge-mode' : ''}`}
        draggable={editMode && !mergeMode}
        onDragStart={(e) => handleDragStart(e, step.id)}
        onDragOver={(e) => handleDragOver(e, step.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, step.id)}
        onDragEnd={handleDragEnd}
        onClick={() => mergeMode ? handleMergeStepToggle(step.id) : handleStepSelect(step.id)}
      >
        <div className="step-header">
          <div className="step-indicator">
            {mergeMode && (
              <input
                type="checkbox"
                checked={isSelectedForMerge}
                onChange={() => handleMergeStepToggle(step.id)}
                className="merge-checkbox"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <span className="indicator-emoji">{getIndicatorEmoji(indicator)}</span>
            <span className="step-order">Step {step.order}</span>
          </div>
          {editMode && !mergeMode && (
            <div className="step-controls">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditStep(step.id);
                }}
                className="control-btn edit-btn"
                title="Edit step"
              >
                ✏️
              </button>
              {step.action_ids.length >= 2 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartSplit(step.id);
                  }}
                  className="control-btn split-btn"
                  title="Split step"
                >
                  ✂️
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStep(step.id);
                }}
                className="control-btn delete-btn"
                title="Delete step"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
        <div className="step-content">
          <div className="step-description">{step.description}</div>
          {step.expected_result && (
            <div className="step-expected-result">
              Expected: {step.expected_result}
            </div>
          )}
          <div className="step-meta">
            <span className="action-count">
              {step.action_ids.length} action{step.action_ids.length !== 1 ? 's' : ''}
            </span>
            {step.continue_on_failure && (
              <span className="continue-on-failure">Continue on failure</span>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    getStepIndicator,
    selectedStepId,
    dragState,
    editingStepId,
    newStepData,
    editMode,
    getIndicatorEmoji,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleStepSelect,
    handleEditStep,
    handleDeleteStep,
    handleSaveEditedStep,
    handleCancelEditStep,
  ]);

  return (
    <div className="test-step-planner" ref={dragRef}>
      <div className="planner-header">
        <h2 className="planner-title">Test Steps</h2>
        {editMode && !mergeMode && (
          <div className="header-controls">
            <button onClick={handleAddStep} className="add-step-btn" title="Add new step">
              + Add Step
            </button>
            {stepStates.length >= 2 && (
              <button onClick={handleEnterMergeMode} className="merge-btn" title="Merge steps">
                🔗 Merge
              </button>
            )}
          </div>
        )}
        {mergeMode && (
          <div className="merge-controls">
            <span className="merge-status">
              {selectedForMerge.size} step{selectedForMerge.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleStartMerge}
              className="btn btn-primary"
              disabled={selectedForMerge.size < 2}
              title="Merge selected steps"
            >
              Merge ({selectedForMerge.size})
            </button>
            <button onClick={handleExitMergeMode} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="steps-container">
        {stepStates.length === 0 ? (
          <div className="empty-steps">
            <p className="empty-text">
              No test steps defined.
              {editMode && ' Click "Add Step" to create your first step.'}
            </p>
          </div>
        ) : (
          stepStates
            .sort((a, b) => a.step.order - b.step.order)
            .map(renderStepItem)
        )}

        {/* Add step form */}
        {showAddForm && (
          <div className="step-item adding">
            <div className="step-edit-form">
              <div className="form-group">
                <label htmlFor="new-desc">Description:</label>
                <input
                  id="new-desc"
                  type="text"
                  value={newStepData.description}
                  onChange={(e) => setNewStepData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter step description..."
                  className="form-input"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-result">Expected Result:</label>
                <input
                  id="new-result"
                  type="text"
                  value={newStepData.expected_result}
                  onChange={(e) => setNewStepData(prev => ({ ...prev, expected_result: e.target.value }))}
                  placeholder="Enter expected result..."
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newStepData.continue_on_failure}
                    onChange={(e) => setNewStepData(prev => ({ ...prev, continue_on_failure: e.target.checked }))}
                  />
                  Continue on failure
                </label>
              </div>
              <div className="form-actions">
                <button onClick={handleSaveNewStep} className="btn btn-primary">
                  Add Step
                </button>
                <button onClick={handleCancelAddStep} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drag indicator */}
      {dragState.isDragging && (
        <div className="drag-indicator">
          Reordering steps...
        </div>
      )}

      {/* Merge dialog */}
      {showMergeDialog && (
        <div className="merge-dialog-overlay">
          <div className="merge-dialog">
            <h3>Merge Steps</h3>
            <p>Merging {selectedForMerge.size} steps into one. Actions will be combined in chronological order.</p>

            <div className="form-group">
              <label htmlFor="merge-desc">Merged Step Description:</label>
              <textarea
                id="merge-desc"
                value={mergeFormData.description}
                onChange={(e) => setMergeFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description for merged step..."
                className="form-textarea"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="merge-result">Expected Result:</label>
              <textarea
                id="merge-result"
                value={mergeFormData.expected_result}
                onChange={(e) => setMergeFormData(prev => ({ ...prev, expected_result: e.target.value }))}
                placeholder="Enter expected result for merged step..."
                className="form-textarea"
                rows={2}
              />
            </div>

            <div className="form-actions">
              <button onClick={handleConfirmMerge} className="btn btn-primary">
                Confirm Merge
              </button>
              <button onClick={() => setShowMergeDialog(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split dialog */}
      {showSplitDialog && splitStepId && (
        <div className="split-dialog-overlay">
          <div className="split-dialog">
            <h3>Split Step</h3>
            <p>
              Split this step into multiple steps. Drag actions from the original step to assign them to splits.
            </p>

            {/* Original step actions */}
            {(() => {
              const step = stepStates.find(s => s.step.id === splitStepId)?.step;
              if (!step) return null;

              return (
                <div className="original-actions">
                  <h4>Original Actions ({step.action_ids.length})</h4>
                  <div className="action-list">
                    {step.action_ids.map((actionId, index) => (
                      <div key={actionId} className="action-item">
                        Action {index + 1} (ID: {actionId.substring(0, 8)}...)
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Split definitions */}
            <div className="split-definitions">
              <h4>Split Into:</h4>
              {splitDefinitions.map((split, index) => (
                <div key={index} className="split-definition">
                  <div className="split-header">
                    <h5>Split {index + 1}</h5>
                    {splitDefinitions.length > 2 && (
                      <button
                        onClick={() => handleRemoveSplitDefinition(index)}
                        className="remove-split-btn"
                        title="Remove this split"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Description:</label>
                    <input
                      type="text"
                      value={split.description}
                      onChange={(e) => handleUpdateSplitDefinition(index, 'description', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Expected Result:</label>
                    <input
                      type="text"
                      value={split.expected_result}
                      onChange={(e) => handleUpdateSplitDefinition(index, 'expected_result', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Actions (comma-separated indices, 1-based):</label>
                    <input
                      type="text"
                      placeholder="e.g., 1,2,3"
                      onChange={(e) => {
                        const step = stepStates.find(s => s.step.id === splitStepId)?.step;
                        if (!step) return;

                        const indices = e.target.value
                          .split(',')
                          .map(s => parseInt(s.trim()) - 1)
                          .filter(i => i >= 0 && i < step.action_ids.length);

                        const actionIds = indices.map(i => step.action_ids[i]);
                        handleUpdateSplitDefinition(index, 'action_ids', actionIds);
                      }}
                      className="form-input"
                    />
                    <small>Assigned actions: {split.action_ids.length}</small>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={split.continue_on_failure}
                        onChange={(e) => handleUpdateSplitDefinition(index, 'continue_on_failure', e.target.checked)}
                      />
                      Continue on failure
                    </label>
                  </div>
                </div>
              ))}

              <button onClick={handleAddSplitDefinition} className="add-split-btn">
                + Add Another Split
              </button>
            </div>

            <div className="form-actions">
              <button onClick={handleConfirmSplit} className="btn btn-primary">
                Confirm Split
              </button>
              <button onClick={handleCancelSplit} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestStepPlanner;
