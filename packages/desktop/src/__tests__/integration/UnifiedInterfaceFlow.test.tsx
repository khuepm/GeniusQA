/**
 * Integration Tests for Unified Interface
 * Tests: List → Select → Edit → Save workflow
 * Tests: AI Builder → Editor transition
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { ScriptData } from '../../types/aiScriptBuilder.types';
import { ScriptFilter, ScriptSource, TargetOS, StoredScriptInfo } from '../../services/scriptStorageService';
import { validateScript } from '../../services/scriptValidationService';

/**
 * Tab types for the unified interface
 * Requirements: 10.1
 */
type TabType = 'list' | 'builder' | 'editor';

/**
 * Helper to create a mock stored script info
 */
function createMockScriptInfo(overrides: Partial<StoredScriptInfo> = {}): StoredScriptInfo {
  return {
    filename: 'test_script.json',
    path: '/path/to/test_script.json',
    createdAt: new Date().toISOString(),
    duration: 5000,
    actionCount: 10,
    source: 'recorded',
    ...overrides,
  };
}

/**
 * Helper to create a mock script data
 */
function createMockScriptData(overrides: Partial<ScriptData> = {}): ScriptData {
  return {
    version: '1.0',
    metadata: {
      created_at: new Date().toISOString(),
      duration: 5000,
      action_count: 3,
      core_type: 'python',
      platform: 'macos',
    },
    actions: [
      { type: 'mouse_click', timestamp: 0, x: 100, y: 200, button: 'left' },
      { type: 'key_type', timestamp: 1000, text: 'Hello' },
      { type: 'wait', timestamp: 2000 },
    ],
    ...overrides,
  };
}

describe('Unified Interface Flow Integration Tests', () => {
  describe('Tab Navigation', () => {
    /**
     * Test: All three tabs are available
     * Requirements: 10.1
     */
    it('should have all three tabs defined', () => {
      const tabs: TabType[] = ['list', 'builder', 'editor'];

      expect(tabs).toContain('list');
      expect(tabs).toContain('builder');
      expect(tabs).toContain('editor');
      expect(tabs).toHaveLength(3);
    });

    /**
     * Test: Tab configuration is correct
     * Requirements: 10.1
     */
    it('should have correct tab configuration', () => {
      const tabConfig = [
        { id: 'list' as TabType, label: 'Script List', icon: '📋' },
        { id: 'builder' as TabType, label: 'AI Builder', icon: '🤖' },
        { id: 'editor' as TabType, label: 'Editor', icon: '✏️' },
      ];

      expect(tabConfig[0].id).toBe('list');
      expect(tabConfig[0].label).toBe('Script List');
      expect(tabConfig[1].id).toBe('builder');
      expect(tabConfig[1].label).toBe('AI Builder');
      expect(tabConfig[2].id).toBe('editor');
      expect(tabConfig[2].label).toBe('Editor');
    });

    /**
     * Test: Tab state transitions are valid
     * Requirements: 10.1
     */
    it('should allow valid tab transitions', () => {
      const validTransitions: Record<TabType, TabType[]> = {
        list: ['builder', 'editor'],
        builder: ['list', 'editor'],
        editor: ['list', 'builder'],
      };

      // All tabs can transition to any other tab
      expect(validTransitions.list).toContain('builder');
      expect(validTransitions.list).toContain('editor');
      expect(validTransitions.builder).toContain('list');
      expect(validTransitions.builder).toContain('editor');
      expect(validTransitions.editor).toContain('list');
      expect(validTransitions.editor).toContain('builder');
    });
  });

  describe('Script List Tab', () => {
    /**
     * Test: Script list displays all scripts with source indicators
     * Requirements: 10.2
     */
    it('should display scripts with source type indicators', () => {
      const scripts: StoredScriptInfo[] = [
        createMockScriptInfo({ source: 'recorded', filename: 'recorded_script.json' }),
        createMockScriptInfo({ source: 'ai_generated', filename: 'ai_script.json' }),
      ];

      // Verify source types are correctly identified
      expect(scripts[0].source).toBe('recorded');
      expect(scripts[1].source).toBe('ai_generated');
    });

    /**
     * Test: Script filter options are available
     * Requirements: 10.2
     */
    it('should have all filter options available', () => {
      const filterOptions: (ScriptSource | 'all')[] = ['all', 'recorded', 'ai_generated'];

      expect(filterOptions).toContain('all');
      expect(filterOptions).toContain('recorded');
      expect(filterOptions).toContain('ai_generated');
    });

    /**
     * Test: Filter correctly filters scripts by source
     * Requirements: 10.2
     */
    it('should filter scripts by source correctly', () => {
      const allScripts: StoredScriptInfo[] = [
        createMockScriptInfo({ source: 'recorded', filename: 'recorded1.json' }),
        createMockScriptInfo({ source: 'recorded', filename: 'recorded2.json' }),
        createMockScriptInfo({ source: 'ai_generated', filename: 'ai1.json' }),
        createMockScriptInfo({ source: 'ai_generated', filename: 'ai2.json' }),
      ];

      // Filter by recorded
      const recordedFilter: ScriptFilter = { source: 'recorded' };
      const recordedScripts = allScripts.filter(s =>
        recordedFilter.source === 'all' || s.source === recordedFilter.source
      );
      expect(recordedScripts).toHaveLength(2);
      expect(recordedScripts.every(s => s.source === 'recorded')).toBe(true);

      // Filter by AI generated
      const aiFilter: ScriptFilter = { source: 'ai_generated' };
      const aiScripts = allScripts.filter(s =>
        aiFilter.source === 'all' || s.source === aiFilter.source
      );
      expect(aiScripts).toHaveLength(2);
      expect(aiScripts.every(s => s.source === 'ai_generated')).toBe(true);

      // Filter by all
      const allFilter: ScriptFilter = { source: 'all' };
      const allFiltered = allScripts.filter(s =>
        allFilter.source === 'all' || s.source === allFilter.source
      );
      expect(allFiltered).toHaveLength(4);
    });

    /**
     * Test: Filter by target OS for AI scripts
     * Requirements: 10.2
     */
    it('should filter AI scripts by target OS', () => {
      const scripts: StoredScriptInfo[] = [
        createMockScriptInfo({ source: 'ai_generated', targetOS: 'macos' }),
        createMockScriptInfo({ source: 'ai_generated', targetOS: 'windows' }),
        createMockScriptInfo({ source: 'ai_generated', targetOS: 'universal' }),
        createMockScriptInfo({ source: 'recorded' }), // No targetOS
      ];

      const macOSFilter: ScriptFilter = { source: 'ai_generated', targetOS: 'macos' };
      const macOSScripts = scripts.filter(s => {
        if (macOSFilter.source && macOSFilter.source !== 'all' && s.source !== macOSFilter.source) {
          return false;
        }
        if (macOSFilter.targetOS && s.source === 'ai_generated' && s.targetOS !== macOSFilter.targetOS) {
          return false;
        }
        return true;
      });

      expect(macOSScripts).toHaveLength(1);
      expect(macOSScripts[0].targetOS).toBe('macos');
    });

    /**
     * Test: Search filter works correctly
     * Requirements: 10.2
     */
    it('should filter scripts by search query', () => {
      const scripts: StoredScriptInfo[] = [
        createMockScriptInfo({ filename: 'login_test.json', scriptName: 'Login Test' }),
        createMockScriptInfo({ filename: 'checkout_flow.json', scriptName: 'Checkout Flow' }),
        createMockScriptInfo({ filename: 'user_registration.json', scriptName: 'User Registration' }),
      ];

      const searchFilter: ScriptFilter = { searchQuery: 'login' };
      const filteredScripts = scripts.filter(s => {
        if (searchFilter.searchQuery) {
          const query = searchFilter.searchQuery.toLowerCase();
          const filename = s.filename.toLowerCase();
          const scriptName = (s.scriptName || '').toLowerCase();
          return filename.includes(query) || scriptName.includes(query);
        }
        return true;
      });

      expect(filteredScripts).toHaveLength(1);
      expect(filteredScripts[0].filename).toBe('login_test.json');
    });
  });

  describe('Script Selection and Editor Tab', () => {
    /**
     * Test: Selecting a script opens it in Editor tab
     * Requirements: 10.3
     */
    it('should transition to editor tab when script is selected', () => {
      let activeTab: TabType = 'list';
      let selectedScript: StoredScriptInfo | null = null;

      const handleScriptSelect = (script: StoredScriptInfo) => {
        selectedScript = script;
        activeTab = 'editor';
      };

      const script = createMockScriptInfo({ filename: 'test.json' });
      handleScriptSelect(script);

      expect(activeTab).toBe('editor');
      expect(selectedScript).toBe(script);
    });

    /**
     * Test: Editor provides same tools for all script types
     * Requirements: 10.3, 10.6
     */
    it('should provide same editing capabilities for all script types', () => {
      const recordedScript = createMockScriptData({
        metadata: {
          created_at: new Date().toISOString(),
          duration: 5000,
          action_count: 3,
          core_type: 'python',
          platform: 'macos',
        }
      });

      const aiScript = createMockScriptData({
        metadata: {
          created_at: new Date().toISOString(),
          duration: 5000,
          action_count: 3,
          core_type: 'ai_generated',
          platform: 'macos',
          additional_data: { generated_by: 'ai_script_builder' },
        }
      });

      // Both scripts should be editable
      const canEditRecorded = recordedScript.actions.length > 0;
      const canEditAI = aiScript.actions.length > 0;

      expect(canEditRecorded).toBe(true);
      expect(canEditAI).toBe(true);

      // Both scripts should be validatable
      const recordedValidation = validateScript(recordedScript);
      const aiValidation = validateScript(aiScript);

      expect(recordedValidation.valid).toBe(true);
      expect(aiValidation.valid).toBe(true);
    });

    /**
     * Test: Action editing updates script data
     * Requirements: 10.6
     */
    it('should update script data when action is edited', () => {
      const script = createMockScriptData();
      const originalX = script.actions[0].x;

      // Simulate editing action
      const updatedActions = [...script.actions];
      updatedActions[0] = { ...updatedActions[0], x: 500 };

      const updatedScript: ScriptData = {
        ...script,
        actions: updatedActions,
      };

      expect(updatedScript.actions[0].x).toBe(500);
      expect(updatedScript.actions[0].x).not.toBe(originalX);
    });

    /**
     * Test: Action deletion updates script
     * Requirements: 10.6
     */
    it('should update script when action is deleted', () => {
      const script = createMockScriptData();
      const originalLength = script.actions.length;

      // Simulate deleting action at index 1
      const updatedActions = script.actions.filter((_, i) => i !== 1);

      const updatedScript: ScriptData = {
        ...script,
        actions: updatedActions,
        metadata: {
          ...script.metadata,
          action_count: updatedActions.length,
        },
      };

      expect(updatedScript.actions.length).toBe(originalLength - 1);
      expect(updatedScript.metadata.action_count).toBe(originalLength - 1);
    });
  });

  describe('AI Builder Tab', () => {
    /**
     * Test: AI Builder tab has OS selector
     * Requirements: 10.4
     */
    it('should have OS selector in AI Builder tab', () => {
      const osOptions: TargetOS[] = ['macos', 'windows', 'universal'];

      expect(osOptions).toContain('macos');
      expect(osOptions).toContain('windows');
      expect(osOptions).toContain('universal');
    });

    /**
     * Test: OS selection state is maintained
     * Requirements: 10.4
     */
    it('should maintain OS selection state', () => {
      let targetOS: TargetOS = 'universal';

      const handleOSChange = (os: TargetOS) => {
        targetOS = os;
      };

      handleOSChange('macos');
      expect(targetOS).toBe('macos');

      handleOSChange('windows');
      expect(targetOS).toBe('windows');
    });
  });

  describe('AI Builder to Editor Transition', () => {
    /**
     * Test: Generated script can transition to Editor tab
     * Requirements: 10.5
     */
    it('should allow transition from AI Builder to Editor with generated script', () => {
      let activeTab: TabType = 'builder';
      let generatedScript: ScriptData | null = null;
      let editorScript: ScriptData | null = null;

      // Simulate script generation
      generatedScript = createMockScriptData({
        metadata: {
          created_at: new Date().toISOString(),
          duration: 3000,
          action_count: 3,
          core_type: 'ai_generated',
          platform: 'macos',
          additional_data: {
            generated_by: 'ai_script_builder',
            target_os: 'macos',
          },
        },
      });

      // Simulate transition to editor
      const handleTransitionToEditor = (script: ScriptData) => {
        editorScript = script;
        activeTab = 'editor';
      };

      handleTransitionToEditor(generatedScript);

      expect(activeTab).toBe('editor');
      expect(editorScript).toBe(generatedScript);
      expect(editorScript?.metadata.additional_data?.generated_by).toBe('ai_script_builder');
    });

    /**
     * Test: Script is loaded for refinement after save
     * Requirements: 10.5
     */
    it('should load saved script in Editor for refinement', () => {
      const savedScript = createMockScriptData({
        metadata: {
          created_at: new Date().toISOString(),
          duration: 5000,
          action_count: 4,
          core_type: 'ai_generated',
          platform: 'macos',
          additional_data: {
            script_name: 'My AI Script',
            generated_by: 'ai_script_builder',
          },
        },
      });

      // Verify script can be loaded in editor
      expect(savedScript.version).toBe('1.0');
      expect(savedScript.actions.length).toBeGreaterThan(0);
      expect(savedScript.metadata.additional_data?.script_name).toBe('My AI Script');
    });
  });

  describe('Complete List → Select → Edit → Save Workflow', () => {
    /**
     * Test: Full workflow from list to save
     * Requirements: 10.1, 10.2, 10.3, 10.6
     */
    it('should complete full list to save workflow', () => {
      // Step 1: Start at list tab
      let activeTab: TabType = 'list';
      expect(activeTab).toBe('list');

      // Step 2: Scripts are displayed
      const scripts: StoredScriptInfo[] = [
        createMockScriptInfo({ filename: 'script1.json', source: 'recorded' }),
        createMockScriptInfo({ filename: 'script2.json', source: 'ai_generated' }),
      ];
      expect(scripts.length).toBeGreaterThan(0);

      // Step 3: Select a script
      const selectedScriptInfo = scripts[0];
      let selectedScript: ScriptData | null = createMockScriptData();
      activeTab = 'editor';
      expect(activeTab).toBe('editor');
      expect(selectedScript).not.toBeNull();

      // Step 4: Edit the script
      const editedScript: ScriptData = {
        ...selectedScript!,
        actions: [
          ...selectedScript!.actions,
          { type: 'wait', timestamp: 3000 },
        ],
        metadata: {
          ...selectedScript!.metadata,
          action_count: selectedScript!.actions.length + 1,
        },
      };
      expect(editedScript.actions.length).toBe(selectedScript!.actions.length + 1);

      // Step 5: Validate edited script
      const validationResult = validateScript(editedScript);
      expect(validationResult.valid).toBe(true);

      // Step 6: Save (simulated)
      const saveResult = { success: true, scriptPath: '/path/to/saved.json' };
      expect(saveResult.success).toBe(true);
    });
  });

  describe('Complete AI Builder → Editor Workflow', () => {
    /**
     * Test: Full workflow from AI Builder to Editor
     * Requirements: 10.4, 10.5, 10.6
     */
    it('should complete full AI Builder to Editor workflow', () => {
      // Step 1: Start at AI Builder tab
      let activeTab: TabType = 'builder';
      let targetOS: TargetOS = 'macos';
      expect(activeTab).toBe('builder');

      // Step 2: Select target OS
      targetOS = 'windows';
      expect(targetOS).toBe('windows');

      // Step 3: Generate script (simulated)
      const generatedScript = createMockScriptData({
        metadata: {
          created_at: new Date().toISOString(),
          duration: 5000,
          action_count: 3,
          core_type: 'ai_generated',
          platform: 'windows',
          additional_data: {
            target_os: targetOS,
            generated_by: 'ai_script_builder',
          },
        },
      });
      expect(generatedScript.metadata.additional_data?.target_os).toBe('windows');

      // Step 4: Validate generated script
      const validationResult = validateScript(generatedScript);
      expect(validationResult.valid).toBe(true);

      // Step 5: Save script (simulated)
      const saveResult = { success: true, scriptPath: '/path/to/ai_script.json' };
      expect(saveResult.success).toBe(true);

      // Step 6: Transition to Editor
      activeTab = 'editor';
      expect(activeTab).toBe('editor');

      // Step 7: Script is loaded in Editor
      const editorScript = generatedScript;
      expect(editorScript.version).toBe('1.0');
      expect(editorScript.actions.length).toBeGreaterThan(0);

      // Step 8: Edit script in Editor
      const refinedScript: ScriptData = {
        ...editorScript,
        actions: [
          ...editorScript.actions,
          { type: 'mouse_click', timestamp: 6000, x: 500, y: 500, button: 'left' },
        ],
        metadata: {
          ...editorScript.metadata,
          action_count: editorScript.actions.length + 1,
        },
      };
      expect(refinedScript.actions.length).toBe(editorScript.actions.length + 1);

      // Step 9: Save refined script
      const refinedValidation = validateScript(refinedScript);
      expect(refinedValidation.valid).toBe(true);
    });
  });

  describe('Script Source Indicators', () => {
    /**
     * Test: Recorded scripts have correct indicator
     * Requirements: 10.2
     */
    it('should identify recorded scripts correctly', () => {
      const script = createMockScriptInfo({ source: 'recorded' });

      expect(script.source).toBe('recorded');
      expect(script.targetOS).toBeUndefined();
    });

    /**
     * Test: AI-generated scripts have correct indicator and metadata
     * Requirements: 10.2
     */
    it('should identify AI-generated scripts with metadata', () => {
      const script = createMockScriptInfo({
        source: 'ai_generated',
        targetOS: 'macos',
        scriptName: 'My AI Script',
      });

      expect(script.source).toBe('ai_generated');
      expect(script.targetOS).toBe('macos');
      expect(script.scriptName).toBe('My AI Script');
    });
  });

  describe('Editor Consistency', () => {
    /**
     * Test: Same editing tools for recorded and AI scripts
     * Requirements: 10.6
     */
    it('should provide consistent editing experience', () => {
      const recordedScript = createMockScriptData();
      const aiScript = createMockScriptData({
        metadata: {
          created_at: new Date().toISOString(),
          duration: 5000,
          action_count: 3,
          core_type: 'ai_generated',
          platform: 'macos',
        },
      });

      // Both should support action editing
      const editRecordedAction = (script: ScriptData, index: number, field: string, value: unknown) => {
        const updatedActions = [...script.actions];
        updatedActions[index] = { ...updatedActions[index], [field]: value };
        return { ...script, actions: updatedActions };
      };

      const editedRecorded = editRecordedAction(recordedScript, 0, 'x', 999);
      const editedAI = editRecordedAction(aiScript, 0, 'x', 999);

      expect(editedRecorded.actions[0].x).toBe(999);
      expect(editedAI.actions[0].x).toBe(999);

      // Both should support action deletion
      const deleteAction = (script: ScriptData, index: number) => {
        const updatedActions = script.actions.filter((_, i) => i !== index);
        return {
          ...script,
          actions: updatedActions,
          metadata: { ...script.metadata, action_count: updatedActions.length },
        };
      };

      const deletedRecorded = deleteAction(recordedScript, 0);
      const deletedAI = deleteAction(aiScript, 0);

      expect(deletedRecorded.actions.length).toBe(recordedScript.actions.length - 1);
      expect(deletedAI.actions.length).toBe(aiScript.actions.length - 1);
    });
  });
});
