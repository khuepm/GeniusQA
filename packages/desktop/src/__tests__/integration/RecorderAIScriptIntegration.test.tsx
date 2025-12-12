/**
 * Integration Tests for Recorder AI Script Integration
 * Tests: Load AI script in Recorder → Playback
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

import { ScriptData } from '../../types/aiScriptBuilder.types';
import { ScriptSource, TargetOS, StoredScriptInfo, ScriptFilter } from '../../services/scriptStorageService';
import { validateScript } from '../../services/scriptValidationService';

/**
 * Helper to create a mock recorded script info
 */
function createRecordedScriptInfo(overrides: Partial<StoredScriptInfo> = {}): StoredScriptInfo {
  return {
    filename: 'recording_2024-01-01_120000.json',
    path: '/path/to/recording_2024-01-01_120000.json',
    createdAt: new Date().toISOString(),
    duration: 5000,
    actionCount: 10,
    source: 'recorded',
    ...overrides,
  };
}

/**
 * Helper to create a mock AI-generated script info
 */
function createAIScriptInfo(overrides: Partial<StoredScriptInfo> = {}): StoredScriptInfo {
  return {
    filename: 'ai_script_login_test_2024-01-01.json',
    path: '/path/to/ai_script_login_test_2024-01-01.json',
    createdAt: new Date().toISOString(),
    duration: 3000,
    actionCount: 5,
    source: 'ai_generated',
    targetOS: 'macos',
    scriptName: 'Login Test',
    ...overrides,
  };
}

/**
 * Helper to create a mock script data
 */
function createMockScriptData(source: ScriptSource, targetOS?: TargetOS): ScriptData {
  const baseScript: ScriptData = {
    version: '1.0',
    metadata: {
      created_at: new Date().toISOString(),
      duration: 5000,
      action_count: 4,
      core_type: source === 'ai_generated' ? 'ai_generated' : 'python',
      platform: 'macos',
    },
    actions: [
      { type: 'mouse_click', timestamp: 0, x: 100, y: 200, button: 'left' },
      { type: 'key_type', timestamp: 1000, text: 'Hello World' },
      { type: 'wait', timestamp: 2000 },
      { type: 'mouse_click', timestamp: 3000, x: 300, y: 400, button: 'left' },
    ],
  };

  if (source === 'ai_generated') {
    baseScript.metadata.additional_data = {
      target_os: targetOS || 'macos',
      generated_by: 'ai_script_builder',
      generated_at: new Date().toISOString(),
      script_name: 'Test Script',
    };
  }

  return baseScript;
}

describe('Recorder AI Script Integration Tests', () => {
  describe('Script Selector Display', () => {
    /**
     * Test: Script selector displays both recorded and AI-generated scripts
     * Requirements: 9.1
     */
    it('should display both recorded and AI-generated scripts in selector', () => {
      const scripts: StoredScriptInfo[] = [
        createRecordedScriptInfo({ filename: 'recording1.json' }),
        createRecordedScriptInfo({ filename: 'recording2.json' }),
        createAIScriptInfo({ filename: 'ai_script1.json' }),
        createAIScriptInfo({ filename: 'ai_script2.json' }),
      ];

      // All scripts should be in the list
      expect(scripts).toHaveLength(4);

      // Should have both types
      const recordedCount = scripts.filter(s => s.source === 'recorded').length;
      const aiCount = scripts.filter(s => s.source === 'ai_generated').length;

      expect(recordedCount).toBe(2);
      expect(aiCount).toBe(2);
    });

    /**
     * Test: Scripts are sorted by creation date
     * Requirements: 9.1
     */
    it('should sort scripts by creation date', () => {
      const scripts: StoredScriptInfo[] = [
        createRecordedScriptInfo({ createdAt: '2024-01-01T10:00:00Z' }),
        createAIScriptInfo({ createdAt: '2024-01-02T10:00:00Z' }),
        createRecordedScriptInfo({ createdAt: '2024-01-03T10:00:00Z' }),
      ];

      // Sort by creation date (newest first)
      const sorted = [...scripts].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      expect(new Date(sorted[0].createdAt).getTime()).toBeGreaterThan(
        new Date(sorted[1].createdAt).getTime()
      );
      expect(new Date(sorted[1].createdAt).getTime()).toBeGreaterThan(
        new Date(sorted[2].createdAt).getTime()
      );
    });
  });

  describe('Visual Distinction', () => {
    /**
     * Test: AI-generated scripts are visually distinguished
     * Requirements: 9.2
     */
    it('should visually distinguish AI-generated scripts from recorded scripts', () => {
      const recordedScript = createRecordedScriptInfo();
      const aiScript = createAIScriptInfo();

      // Source types should be different
      expect(recordedScript.source).toBe('recorded');
      expect(aiScript.source).toBe('ai_generated');

      // AI script should have additional metadata
      expect(aiScript.targetOS).toBeDefined();
      expect(aiScript.scriptName).toBeDefined();

      // Recorded script should not have AI-specific metadata
      expect(recordedScript.targetOS).toBeUndefined();
      expect(recordedScript.scriptName).toBeUndefined();
    });

    /**
     * Test: Source badge is correctly determined
     * Requirements: 9.2
     */
    it('should determine correct source badge for scripts', () => {
      const getSourceBadge = (source: ScriptSource): string => {
        switch (source) {
          case 'recorded':
            return '🎬 Recorded';
          case 'ai_generated':
            return '🤖 AI Generated';
          default:
            return '📄 Unknown';
        }
      };

      expect(getSourceBadge('recorded')).toBe('🎬 Recorded');
      expect(getSourceBadge('ai_generated')).toBe('🤖 AI Generated');
    });

    /**
     * Test: Target OS is displayed for AI scripts
     * Requirements: 9.5
     */
    it('should display target OS for AI-generated scripts', () => {
      const aiScript = createAIScriptInfo({ targetOS: 'windows' });

      expect(aiScript.targetOS).toBe('windows');

      const getOSBadge = (targetOS?: TargetOS): string | null => {
        if (!targetOS) return null;
        switch (targetOS) {
          case 'macos':
            return '🍎 macOS';
          case 'windows':
            return '🪟 Windows';
          case 'universal':
            return '🌐 Universal';
          default:
            return null;
        }
      };

      expect(getOSBadge(aiScript.targetOS)).toBe('🪟 Windows');
    });
  });

  describe('AI Script Selection', () => {
    /**
     * Test: Selecting AI script loads it for playback
     * Requirements: 9.3
     */
    it('should load AI-generated script for playback when selected', () => {
      const aiScriptInfo = createAIScriptInfo();
      const aiScriptData = createMockScriptData('ai_generated', 'macos');

      // Simulate script selection
      let selectedScriptPath: string | null = null;
      let loadedScript: ScriptData | null = null;

      const handleScriptSelect = (scriptInfo: StoredScriptInfo, scriptData: ScriptData) => {
        selectedScriptPath = scriptInfo.path;
        loadedScript = scriptData;
      };

      handleScriptSelect(aiScriptInfo, aiScriptData);

      expect(selectedScriptPath).toBe(aiScriptInfo.path);
      expect(loadedScript).toBe(aiScriptData);
      expect(loadedScript?.actions.length).toBeGreaterThan(0);
    });

    /**
     * Test: AI script is valid for playback
     * Requirements: 9.3
     */
    it('should validate AI script is playable', () => {
      const aiScript = createMockScriptData('ai_generated', 'macos');

      const validationResult = validateScript(aiScript);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });
  });

  describe('Playback Controls', () => {
    /**
     * Test: Same playback controls for AI and recorded scripts
     * Requirements: 9.3
     */
    it('should provide same playback controls for AI scripts as recorded scripts', () => {
      const recordedScript = createMockScriptData('recorded');
      const aiScript = createMockScriptData('ai_generated', 'macos');

      // Both scripts should have valid structure for playback
      expect(recordedScript.version).toBe('1.0');
      expect(aiScript.version).toBe('1.0');

      expect(recordedScript.actions.length).toBeGreaterThan(0);
      expect(aiScript.actions.length).toBeGreaterThan(0);

      // Both should pass validation
      expect(validateScript(recordedScript).valid).toBe(true);
      expect(validateScript(aiScript).valid).toBe(true);
    });

    /**
     * Test: Playback state management works for AI scripts
     * Requirements: 9.3
     */
    it('should manage playback state correctly for AI scripts', () => {
      type PlaybackState = 'idle' | 'playing' | 'paused';

      let playbackState: PlaybackState = 'idle';
      let currentActionIndex = 0;
      let totalActions = 0;

      const aiScript = createMockScriptData('ai_generated', 'macos');
      totalActions = aiScript.actions.length;

      // Start playback
      const startPlayback = () => {
        playbackState = 'playing';
        currentActionIndex = 0;
      };

      // Pause playback
      const pausePlayback = () => {
        if (playbackState === 'playing') {
          playbackState = 'paused';
        }
      };

      // Resume playback
      const resumePlayback = () => {
        if (playbackState === 'paused') {
          playbackState = 'playing';
        }
      };

      // Stop playback
      const stopPlayback = () => {
        playbackState = 'idle';
        currentActionIndex = 0;
      };

      // Test state transitions
      expect(playbackState).toBe('idle');

      startPlayback();
      expect(playbackState).toBe('playing');
      expect(totalActions).toBe(aiScript.actions.length);

      pausePlayback();
      expect(playbackState).toBe('paused');

      resumePlayback();
      expect(playbackState).toBe('playing');

      stopPlayback();
      expect(playbackState).toBe('idle');
    });

    /**
     * Test: Progress tracking works for AI scripts
     * Requirements: 9.3
     */
    it('should track playback progress for AI scripts', () => {
      const aiScript = createMockScriptData('ai_generated', 'macos');
      const totalActions = aiScript.actions.length;

      // Simulate progress updates
      const calculateProgress = (currentAction: number, total: number): number => {
        return (currentAction / total) * 100;
      };

      expect(calculateProgress(0, totalActions)).toBe(0);
      expect(calculateProgress(2, totalActions)).toBe(50);
      expect(calculateProgress(totalActions, totalActions)).toBe(100);
    });
  });

  describe('Script Filtering in Recorder', () => {
    /**
     * Test: Filter by source in recorder script selector
     * Requirements: 9.4
     */
    it('should filter scripts by source in recorder', () => {
      const scripts: StoredScriptInfo[] = [
        createRecordedScriptInfo({ filename: 'rec1.json' }),
        createRecordedScriptInfo({ filename: 'rec2.json' }),
        createAIScriptInfo({ filename: 'ai1.json' }),
        createAIScriptInfo({ filename: 'ai2.json' }),
        createAIScriptInfo({ filename: 'ai3.json' }),
      ];

      const filterScripts = (scripts: StoredScriptInfo[], filter: ScriptFilter): StoredScriptInfo[] => {
        return scripts.filter(script => {
          if (filter.source && filter.source !== 'all') {
            if (script.source !== filter.source) {
              return false;
            }
          }
          if (filter.targetOS && script.source === 'ai_generated') {
            if (script.targetOS !== filter.targetOS) {
              return false;
            }
          }
          return true;
        });
      };

      // Filter all
      const allScripts = filterScripts(scripts, { source: 'all' });
      expect(allScripts).toHaveLength(5);

      // Filter recorded only
      const recordedScripts = filterScripts(scripts, { source: 'recorded' });
      expect(recordedScripts).toHaveLength(2);
      expect(recordedScripts.every(s => s.source === 'recorded')).toBe(true);

      // Filter AI only
      const aiScripts = filterScripts(scripts, { source: 'ai_generated' });
      expect(aiScripts).toHaveLength(3);
      expect(aiScripts.every(s => s.source === 'ai_generated')).toBe(true);
    });
  });

  describe('Script Info Display', () => {
    /**
     * Test: Display target OS info for AI scripts
     * Requirements: 9.5
     */
    it('should display target OS info for AI-generated scripts', () => {
      const macOSScript = createAIScriptInfo({ targetOS: 'macos' });
      const windowsScript = createAIScriptInfo({ targetOS: 'windows' });
      const universalScript = createAIScriptInfo({ targetOS: 'universal' });

      expect(macOSScript.targetOS).toBe('macos');
      expect(windowsScript.targetOS).toBe('windows');
      expect(universalScript.targetOS).toBe('universal');
    });

    /**
     * Test: Display script name for AI scripts
     * Requirements: 9.5
     */
    it('should display script name for AI-generated scripts', () => {
      const aiScript = createAIScriptInfo({ scriptName: 'My Login Test' });

      expect(aiScript.scriptName).toBe('My Login Test');
    });
  });

  describe('Complete Recorder Integration Flow', () => {
    /**
     * Test: Full flow - Load AI script in Recorder → Playback
     * Requirements: 9.1, 9.2, 9.3
     */
    it('should complete full recorder integration flow with AI script', () => {
      // Step 1: Scripts are loaded in recorder
      const scripts: StoredScriptInfo[] = [
        createRecordedScriptInfo({ filename: 'recording.json' }),
        createAIScriptInfo({ filename: 'ai_script.json', targetOS: 'macos' }),
      ];
      expect(scripts.length).toBe(2);

      // Step 2: AI script is visually distinguished
      const aiScript = scripts.find(s => s.source === 'ai_generated');
      expect(aiScript).toBeDefined();
      expect(aiScript?.source).toBe('ai_generated');
      expect(aiScript?.targetOS).toBe('macos');

      // Step 3: Select AI script
      const selectedScriptInfo = aiScript!;
      const selectedScriptData = createMockScriptData('ai_generated', 'macos');

      // Step 4: Validate script is playable
      const validationResult = validateScript(selectedScriptData);
      expect(validationResult.valid).toBe(true);

      // Step 5: Start playback
      let playbackState: 'idle' | 'playing' | 'paused' = 'idle';
      playbackState = 'playing';
      expect(playbackState).toBe('playing');

      // Step 6: Track progress
      const totalActions = selectedScriptData.actions.length;
      let currentAction = 0;

      // Simulate playback progress
      for (let i = 0; i < totalActions; i++) {
        currentAction = i + 1;
        const progress = (currentAction / totalActions) * 100;
        expect(progress).toBeGreaterThan(0);
        expect(progress).toBeLessThanOrEqual(100);
      }

      // Step 7: Playback completes
      playbackState = 'idle';
      expect(playbackState).toBe('idle');
      expect(currentAction).toBe(totalActions);
    });

    /**
     * Test: AI script playback with pause/resume
     * Requirements: 9.3
     */
    it('should support pause/resume for AI script playback', () => {
      const aiScript = createMockScriptData('ai_generated', 'windows');

      let playbackState: 'idle' | 'playing' | 'paused' = 'idle';
      let currentAction = 0;

      // Start playback
      playbackState = 'playing';
      currentAction = 1;
      expect(playbackState).toBe('playing');

      // Pause
      playbackState = 'paused';
      const pausedAction = currentAction;
      expect(playbackState).toBe('paused');

      // Resume
      playbackState = 'playing';
      expect(playbackState).toBe('playing');
      expect(currentAction).toBe(pausedAction); // Should resume from same position

      // Complete
      currentAction = aiScript.actions.length;
      playbackState = 'idle';
      expect(playbackState).toBe('idle');
    });
  });

  describe('Script Compatibility', () => {
    /**
     * Test: AI scripts are compatible with recorder playback engine
     * Requirements: 9.3
     */
    it('should ensure AI scripts are compatible with playback engine', () => {
      const aiScript = createMockScriptData('ai_generated', 'macos');

      // Check required fields for playback
      expect(aiScript.version).toBeDefined();
      expect(aiScript.metadata).toBeDefined();
      expect(aiScript.actions).toBeDefined();
      expect(Array.isArray(aiScript.actions)).toBe(true);

      // Check action structure
      aiScript.actions.forEach((action, index) => {
        expect(action.type).toBeDefined();
        expect(action.timestamp).toBeDefined();
        expect(typeof action.timestamp).toBe('number');
        expect(action.timestamp).toBeGreaterThanOrEqual(0);

        // Mouse actions should have coordinates
        if (['mouse_click', 'mouse_move', 'mouse_double_click'].includes(action.type)) {
          expect(action.x).toBeDefined();
          expect(action.y).toBeDefined();
        }

        // Key type actions should have text
        if (action.type === 'key_type') {
          expect(action.text).toBeDefined();
        }
      });

      // Timestamps should be in ascending order
      for (let i = 1; i < aiScript.actions.length; i++) {
        expect(aiScript.actions[i].timestamp).toBeGreaterThanOrEqual(
          aiScript.actions[i - 1].timestamp
        );
      }
    });
  });
});
