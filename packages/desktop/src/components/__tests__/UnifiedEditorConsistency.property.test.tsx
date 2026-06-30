/**
 * Property-Based Tests for Unified Editor Consistency
 * 
 * Tests that the unified editor provides consistent editing capabilities
 * regardless of script source (recorded or AI-generated).
 * 
 * **Feature: ai-script-builder, Property 18: Unified Editor Consistency**
 * **Validates: Requirements 10.3, 10.6**
 */

import '@testing-library/jest-dom';
import { ScriptSource, StoredScriptInfo } from '../../services/scriptStorageService';
import { ScriptData } from '../../types/aiScriptBuilder.types';

// Mock CSS imports
jest.mock('../tabs/EditorTabContent.css', () => ({}));

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Create a simple recorded script for testing
 */
function createRecordedScript(): ScriptData {
  return {
    version: '1.0',
    metadata: {
      created_at: new Date().toISOString(),
      duration: 1000,
      action_count: 2,
      core_type: 'rust',
      platform: 'macos',
    },
    actions: [
      { type: 'wait', timestamp: 0 },
      { type: 'wait', timestamp: 1000 },
    ],
  };
}

/**
 * Create a simple AI-generated script for testing
 */
function createAIScript(): ScriptData {
  return {
    version: '1.0',
    metadata: {
      created_at: new Date().toISOString(),
      duration: 1000,
      action_count: 2,
      core_type: 'ai_generated',
      platform: 'macos',
      additional_data: {
        source: 'ai_generated',
        generated_at: new Date().toISOString(),
        script_name: 'Test AI Script',
        target_os: 'macos',
      },
    },
    actions: [
      { type: 'wait', timestamp: 0 },
      { type: 'wait', timestamp: 1000 },
    ],
  };
}

/**
 * Create script info for testing
 */
function createScriptInfo(source: ScriptSource): StoredScriptInfo {
  return {
    filename: source === 'ai_generated' ? 'ai_script_test.json' : 'recording_test.json',
    path: `/test/${source}_script.json`,
    createdAt: new Date().toISOString(),
    duration: 1000,
    actionCount: 2,
    source,
    targetOS: source === 'ai_generated' ? 'macos' : undefined,
    scriptName: source === 'ai_generated' ? 'Test Script' : undefined,
  };
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Unified Editor Consistency Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 18: Unified Editor Consistency**
   * **Validates: Requirements 10.3, 10.6**
   * 
   * For any script (recorded or AI-generated), opening it in the Editor tab
   * SHALL provide the same editing tools and capabilities.
   */
  describe('Property 18: Unified Editor Consistency', () => {
    it('both script types have view mode toggle (Visual/JSON)', () => {
      const recordedScript = createRecordedScript();
      const recordedInfo = createScriptInfo('recorded');

      const { unmount: unmount1 } = render(
        <EditorTabContent
          script={recordedScript}
          selectedScript={recordedInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const recordedHasVisual = !!screen.queryByText('Visual');
      const recordedHasJson = !!screen.queryByText('JSON');
      unmount1();

      const aiScript = createAIScript();
      const aiInfo = createScriptInfo('ai_generated');

      const { unmount: unmount2 } = render(
        <EditorTabContent
          script={aiScript}
          selectedScript={aiInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const aiHasVisual = !!screen.queryByText('Visual');
      const aiHasJson = !!screen.queryByText('JSON');
      unmount2();

      expect(recordedHasVisual).toBe(true);
      expect(recordedHasJson).toBe(true);
      expect(aiHasVisual).toBe(true);
      expect(aiHasJson).toBe(true);
    });

    it('both script types have edit mode toggle', () => {
      const recordedScript = createRecordedScript();
      const recordedInfo = createScriptInfo('recorded');

      const { unmount: unmount1 } = render(
        <EditorTabContent
          script={recordedScript}
          selectedScript={recordedInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const recordedHasEdit = !!screen.queryByText(/Edit/);
      unmount1();

      const aiScript = createAIScript();
      const aiInfo = createScriptInfo('ai_generated');

      const { unmount: unmount2 } = render(
        <EditorTabContent
          script={aiScript}
          selectedScript={aiInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const aiHasEdit = !!screen.queryByText(/Edit/);
      unmount2();

      expect(recordedHasEdit).toBe(true);
      expect(aiHasEdit).toBe(true);
    });

    it('both script types have save button', () => {
      const recordedScript = createRecordedScript();
      const recordedInfo = createScriptInfo('recorded');

      const { unmount: unmount1 } = render(
        <EditorTabContent
          script={recordedScript}
          selectedScript={recordedInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const recordedHasSave = !!screen.queryByText(/Save/);
      unmount1();

      const aiScript = createAIScript();
      const aiInfo = createScriptInfo('ai_generated');

      const { unmount: unmount2 } = render(
        <EditorTabContent
          script={aiScript}
          selectedScript={aiInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const aiHasSave = !!screen.queryByText(/Save/);
      unmount2();

      expect(recordedHasSave).toBe(true);
      expect(aiHasSave).toBe(true);
    });

    it('both script types render visual editor by default', () => {
      const recordedScript = createRecordedScript();
      const recordedInfo = createScriptInfo('recorded');

      const { unmount: unmount1 } = render(
        <EditorTabContent
          script={recordedScript}
          selectedScript={recordedInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const recordedHasVisual = !!screen.queryByTestId('editor-visual');
      unmount1();

      const aiScript = createAIScript();
      const aiInfo = createScriptInfo('ai_generated');

      const { unmount: unmount2 } = render(
        <EditorTabContent
          script={aiScript}
          selectedScript={aiInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const aiHasVisual = !!screen.queryByTestId('editor-visual');
      unmount2();

      expect(recordedHasVisual).toBe(true);
      expect(aiHasVisual).toBe(true);
    });

    it('both script types display action list in visual mode', () => {
      const recordedScript = createRecordedScript();
      const recordedInfo = createScriptInfo('recorded');

      const { unmount: unmount1 } = render(
        <EditorTabContent
          script={recordedScript}
          selectedScript={recordedInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const recordedHasAction = !!screen.queryByTestId('editor-action-0');
      unmount1();

      const aiScript = createAIScript();
      const aiInfo = createScriptInfo('ai_generated');

      const { unmount: unmount2 } = render(
        <EditorTabContent
          script={aiScript}
          selectedScript={aiInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const aiHasAction = !!screen.queryByTestId('editor-action-0');
      unmount2();

      expect(recordedHasAction).toBe(true);
      expect(aiHasAction).toBe(true);
    });

    it('edit mode enables action editing for both script types', () => {
      const recordedScript = createRecordedScript();
      const recordedInfo = createScriptInfo('recorded');

      const { unmount: unmount1 } = render(
        <EditorTabContent
          script={recordedScript}
          selectedScript={recordedInfo}
          editMode={true}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const recordedHasDelete = !!screen.queryByLabelText(/Delete action/);
      unmount1();

      const aiScript = createAIScript();
      const aiInfo = createScriptInfo('ai_generated');

      const { unmount: unmount2 } = render(
        <EditorTabContent
          script={aiScript}
          selectedScript={aiInfo}
          editMode={true}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const aiHasDelete = !!screen.queryByLabelText(/Delete action/);
      unmount2();

      expect(recordedHasDelete).toBe(true);
      expect(aiHasDelete).toBe(true);
    });

    it('save button is disabled when not in edit mode for both script types', () => {
      const recordedScript = createRecordedScript();
      const recordedInfo = createScriptInfo('recorded');

      const { unmount: unmount1 } = render(
        <EditorTabContent
          script={recordedScript}
          selectedScript={recordedInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const recordedSaveButton = screen.queryByText(/Save/);
      const recordedIsDisabled = recordedSaveButton?.closest('button')?.disabled;
      unmount1();

      const aiScript = createAIScript();
      const aiInfo = createScriptInfo('ai_generated');

      const { unmount: unmount2 } = render(
        <EditorTabContent
          script={aiScript}
          selectedScript={aiInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const aiSaveButton = screen.queryByText(/Save/);
      const aiIsDisabled = aiSaveButton?.closest('button')?.disabled;
      unmount2();

      expect(recordedIsDisabled).toBe(true);
      expect(aiIsDisabled).toBe(true);
    });
  });


  /**
   * Edge cases and boundary conditions
   */
  describe('Edge Cases and Boundary Conditions', () => {
    it('handles scripts with no actions', () => {
      const emptyScript: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 0,
          action_count: 0,
          core_type: 'rust',
          platform: 'macos',
        },
        actions: [],
      };

      const scriptInfo: StoredScriptInfo = {
        filename: 'empty_script.json',
        path: '/test/empty_script.json',
        createdAt: new Date().toISOString(),
        duration: 0,
        actionCount: 0,
        source: 'recorded',
      };

      const { unmount } = render(
        <EditorTabContent
          script={emptyScript}
          selectedScript={scriptInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const hasEditingTools = !!(
        screen.queryByText('Visual') &&
        screen.queryByText('JSON') &&
        screen.queryByText(/Edit/) &&
        screen.queryByText(/Save/)
      );
      unmount();

      expect(hasEditingTools).toBe(true);
    });

    it('handles null script by showing placeholder', () => {
      const { unmount } = render(
        <EditorTabContent
          script={null}
          selectedScript={null}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const placeholder = screen.queryByTestId('editor-placeholder');
      unmount();

      expect(placeholder).not.toBeNull();
    });

    it('handles AI script without target OS metadata', () => {
      const script: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 100,
          action_count: 1,
          core_type: 'ai_generated',
          platform: 'macos',
          additional_data: {
            source: 'ai_generated',
            script_name: 'Test Script',
          },
        },
        actions: [{ type: 'wait', timestamp: 100 }],
      };

      const scriptInfo: StoredScriptInfo = {
        filename: 'ai_script_test.json',
        path: '/test/ai_script_test.json',
        createdAt: new Date().toISOString(),
        duration: 100,
        actionCount: 1,
        source: 'ai_generated',
      };

      const { unmount } = render(
        <EditorTabContent
          script={script}
          selectedScript={scriptInfo}
          editMode={false}
          onEditModeChange={() => { }}
          onScriptSave={() => { }}
          onActionUpdate={() => { }}
          onActionDelete={() => { }}
        />
      );

      const hasEditingTools = !!(
        screen.queryByText('Visual') &&
        screen.queryByText('JSON') &&
        screen.queryByText(/Edit/) &&
        screen.queryByText(/Save/)
      );
      unmount();

      expect(hasEditingTools).toBe(true);
    });
  });
});
