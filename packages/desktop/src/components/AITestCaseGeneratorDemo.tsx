/**
 * AITestCaseGeneratorDemo Component
 * 
 * Demo component that shows how to integrate all AI Test Case Generator components.
 * This serves as an example and can be integrated into existing screens.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import React, { useState } from 'react';
import { TestCaseGeneratorModal } from './TestCaseGeneratorModal';
import { TestCasePreview } from './TestCasePreview';
import { TestCaseEditor } from './TestCaseEditor';
import { AITestCaseConfigurationUI } from './AITestCaseConfigurationUI';
import { validateTestCase, autoFixTestCase } from '../utils/testCaseValidation';
import {
  TestCase,
  GenerationPreferences,
  ValidationResult
} from '../types/aiTestCaseGenerator.types';
import './AITestCaseGeneratorDemo.css';

export const AITestCaseGeneratorDemo: React.FC = () => {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set());
  const [expandedTestCases, setExpandedTestCases] = useState<Set<string>>(new Set());
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);

  const handleTestCasesGenerated = (newTestCases: TestCase[]) => {
    setTestCases(prev => [...prev, ...newTestCases]);
    // Auto-select newly generated test cases
    const newIds = new Set(newTestCases.map(tc => tc.id));
    setSelectedTestCases(prev => new Set([...prev, ...newIds]));
  };

  const handleToggleSelection = (testCaseId: string) => {
    setSelectedTestCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testCaseId)) {
        newSet.delete(testCaseId);
      } else {
        newSet.add(testCaseId);
      }
      return newSet;
    });
  };

  const handleToggleExpansion = (testCaseId: string) => {
    setExpandedTestCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testCaseId)) {
        newSet.delete(testCaseId);
      } else {
        newSet.add(testCaseId);
      }
      return newSet;
    });
  };

  const handleEditTestCase = (testCase: TestCase) => {
    setEditingTestCase(testCase);
  };

  const handleSaveTestCase = (updatedTestCase: TestCase) => {
    const fixedTestCase = autoFixTestCase(updatedTestCase);
    setTestCases(prev =>
      prev.map(tc => tc.id === fixedTestCase.id ? fixedTestCase : tc)
    );
    setEditingTestCase(null);
  };

  const handleCancelEdit = () => {
    setEditingTestCase(null);
  };

  const handleValidateTestCase = (testCase: TestCase): ValidationResult => {
    return validateTestCase(testCase);
  };

  const handleConfigurationSave = async (apiKey: string, preferences: GenerationPreferences) => {
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');

      // Save API key if provided
      if (apiKey) {
        await invoke('configure_api_key', { apiKey });
      }

      // Save preferences
      await invoke('update_generation_preferences', { preferences });

      console.log('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  };

  const handleSelectAll = () => {
    setSelectedTestCases(new Set(testCases.map(tc => tc.id)));
  };

  const handleDeselectAll = () => {
    setSelectedTestCases(new Set());
  };

  const handleDeleteSelected = () => {
    setTestCases(prev => prev.filter(tc => !selectedTestCases.has(tc.id)));
    setSelectedTestCases(new Set());
    setExpandedTestCases(prev => {
      const newSet = new Set(prev);
      selectedTestCases.forEach(id => newSet.delete(id));
      return newSet;
    });
  };

  const handleAddToProject = async () => {
    const selectedCases = testCases.filter(tc => selectedTestCases.has(tc.id));

    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      await invoke('add_test_cases_to_project', { testCases: selectedCases });

      console.log(`Added ${selectedCases.length} test cases to project`);
      // Optionally remove added test cases from the list
      handleDeleteSelected();
    } catch (error) {
      console.error('Failed to add test cases to project:', error);
    }
  };

  return (
    <div className="ai-test-case-generator-demo">
      <div className="demo-header">
        <h2>AI Test Case Generator</h2>
        <div className="header-actions">
          <button
            className="config-button"
            onClick={() => setIsConfigOpen(true)}
          >
            ⚙️ Configure
          </button>
          <button
            className="generate-button"
            onClick={() => setIsGeneratorOpen(true)}
          >
            ✨ Generate Test Cases
          </button>
        </div>
      </div>

      {testCases.length > 0 && (
        <div className="test-cases-section">
          <div className="section-header">
            <h3>Generated Test Cases ({testCases.length})</h3>
            <div className="bulk-actions">
              <button onClick={handleSelectAll} className="action-button">
                Select All
              </button>
              <button onClick={handleDeselectAll} className="action-button">
                Deselect All
              </button>
              {selectedTestCases.size > 0 && (
                <>
                  <button onClick={handleAddToProject} className="primary-action-button">
                    Add to Project ({selectedTestCases.size})
                  </button>
                  <button onClick={handleDeleteSelected} className="danger-action-button">
                    Delete Selected
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="test-cases-list">
            {testCases.map(testCase => (
              <TestCasePreview
                key={testCase.id}
                testCase={testCase}
                isSelected={selectedTestCases.has(testCase.id)}
                isExpanded={expandedTestCases.has(testCase.id)}
                onToggleSelection={handleToggleSelection}
                onToggleExpansion={handleToggleExpansion}
                onEdit={handleEditTestCase}
              />
            ))}
          </div>
        </div>
      )}

      {testCases.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-content">
            <h3>No Test Cases Generated</h3>
            <p>Click "Generate Test Cases" to create AI-powered test documentation from your requirements.</p>
            <button
              className="generate-button large"
              onClick={() => setIsGeneratorOpen(true)}
            >
              ✨ Generate Your First Test Cases
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <TestCaseGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onTestCasesGenerated={handleTestCasesGenerated}
      />

      <AITestCaseConfigurationUI
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleConfigurationSave}
      />

      {/* Editor Modal */}
      {editingTestCase && (
        <div className="modal-overlay">
          <TestCaseEditor
            testCase={editingTestCase}
            onSave={handleSaveTestCase}
            onCancel={handleCancelEdit}
            onValidate={handleValidateTestCase}
          />
        </div>
      )}
    </div>
  );
};
