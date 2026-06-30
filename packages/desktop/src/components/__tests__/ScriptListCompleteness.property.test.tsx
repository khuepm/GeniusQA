/**
 * Property-Based Tests for Script List Completeness
 * 
 * Tests that the script list displays all scripts correctly with proper source indicators.
 * For any combination of recorded and AI-generated scripts in storage, the script list
 * should display all scripts with correct source type indicators.
 * 
 * **Feature: ai-script-builder, Property 15: Script List Completeness**
 * **Validates: Requirements 9.1, 9.2, 10.2**
 */

import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import {
  ScriptFilter,
  ScriptSource,
  StoredScriptInfo,
  TargetOS,
} from '../../services/scriptStorageService';
import { ScriptListTabContent } from '../tabs/ScriptListTabContent';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid script source type
 */
const scriptSourceArbitrary: fc.Arbitrary<ScriptSource> = fc.constantFrom(
  'recorded',
  'ai_generated'
);

/**
 * Generate a valid target OS
 */
const targetOSArbitrary: fc.Arbitrary<TargetOS> = fc.constantFrom(
  'macos',
  'windows',
  'universal'
);

/**
 * Generate a valid script filename
 */
const scriptFilenameArbitrary = (source: ScriptSource): fc.Arbitrary<string> => {
  if (source === 'ai_generated') {
    return fc.tuple(
      fc.string({ minLength: 5, maxLength: 30 }),
      fc.integer({ min: 1000000000000, max: 9999999999999 })
    ).map(([name, timestamp]) =>
      `ai_script_${name.replace(/[^a-z0-9_-]/gi, '_')}_${timestamp}.json`
    );
  } else {
    return fc.tuple(
      fc.string({ minLength: 5, maxLength: 30 }),
      fc.integer({ min: 1000000000000, max: 9999999999999 })
    ).map(([name, timestamp]) =>
      `recording_${name.replace(/[^a-z0-9_-]/gi, '_')}_${timestamp}.json`
    );
  }
};

/**
 * Generate a valid script name (for AI-generated scripts)
 */
const scriptNameArbitrary: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 5, maxLength: 50 })
    .filter(s => s.trim().length >= 5)
    .map(s => s.replace(/[^a-zA-Z0-9_\-\s]/g, '')),
  fc.constantFrom(
    'Login Test',
    'Navigation Flow',
    'Form Submission',
    'Data Entry Script',
    'UI Automation Test'
  )
);

/**
 * Generate a recorded script info
 */
const recordedScriptArbitrary: fc.Arbitrary<StoredScriptInfo> = fc.record({
  filename: scriptFilenameArbitrary('recorded'),
  path: fc.string({ minLength: 10, maxLength: 100 })
    .map(p => `/home/user/GeniusQA/recordings/${p}.json`),
  createdAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
    .map(timestamp => new Date(timestamp).toISOString()),
  duration: fc.integer({ min: 1, max: 300 }),
  actionCount: fc.integer({ min: 1, max: 100 }),
  source: fc.constant('recorded' as const),
});

/**
 * Generate an AI-generated script info
 */
const aiGeneratedScriptArbitrary: fc.Arbitrary<StoredScriptInfo> = fc.record({
  filename: scriptFilenameArbitrary('ai_generated'),
  path: fc.string({ minLength: 10, maxLength: 100 })
    .map(p => `/home/user/GeniusQA/recordings/${p}.json`),
  createdAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
    .map(timestamp => new Date(timestamp).toISOString()),
  duration: fc.integer({ min: 1, max: 300 }),
  actionCount: fc.integer({ min: 1, max: 100 }),
  source: fc.constant('ai_generated' as const),
  targetOS: targetOSArbitrary,
  scriptName: scriptNameArbitrary,
});

/**
 * Generate a script info (either recorded or AI-generated)
 */
const scriptInfoArbitrary: fc.Arbitrary<StoredScriptInfo> = fc.oneof(
  recordedScriptArbitrary,
  aiGeneratedScriptArbitrary
);

/**
 * Generate a combination of recorded and AI-generated scripts
 */
const scriptCombinationArbitrary: fc.Arbitrary<StoredScriptInfo[]> = fc.record({
  recordedCount: fc.integer({ min: 0, max: 10 }),
  aiGeneratedCount: fc.integer({ min: 0, max: 10 }),
}).chain(({ recordedCount, aiGeneratedCount }) => {
  return fc.tuple(
    fc.array(recordedScriptArbitrary, { minLength: recordedCount, maxLength: recordedCount }),
    fc.array(aiGeneratedScriptArbitrary, { minLength: aiGeneratedCount, maxLength: aiGeneratedCount })
  ).map(([recorded, aiGenerated]) => [...recorded, ...aiGenerated]);
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Renders ScriptListTabContent with given scripts
 */
const renderScriptList = (
  scripts: StoredScriptInfo[],
  filter: ScriptFilter = { source: 'all' }
) => {
  const mockOnFilterChange = jest.fn();
  const mockOnScriptSelect = jest.fn();
  const mockOnScriptDelete = jest.fn();

  return render(
    <ScriptListTabContent
      scripts={scripts}
      filter={filter}
      onFilterChange={mockOnFilterChange}
      onScriptSelect={mockOnScriptSelect}
      onScriptDelete={mockOnScriptDelete}
      loading={false}
      selectedScriptPath={null}
    />
  );
};

/**
 * Counts the number of script items displayed
 */
const countDisplayedScripts = (): number => {
  const scriptListItems = screen.queryByTestId('script-list-items');
  if (!scriptListItems) {
    return 0;
  }

  // Count all script-list-item elements
  const items = scriptListItems.querySelectorAll('.script-list-item');
  return items.length;
};

/**
 * Gets all displayed script items
 */
const getDisplayedScriptItems = (): HTMLElement[] => {
  const scriptListItems = screen.queryByTestId('script-list-items');
  if (!scriptListItems) {
    return [];
  }

  return Array.from(scriptListItems.querySelectorAll('.script-list-item'));
};

/**
 * Checks if a script item has the correct source badge
 */
const hasCorrectSourceBadge = (item: HTMLElement, expectedSource: ScriptSource): boolean => {
  const sourceBadge = item.querySelector(`.script-badge.source-${expectedSource}`);
  return sourceBadge !== null;
};

/**
 * Checks if a script item has the correct OS badge (for AI-generated scripts)
 */
const hasCorrectOSBadge = (item: HTMLElement, expectedOS?: TargetOS): boolean => {
  if (!expectedOS) {
    // Should not have any OS badge
    const osBadges = item.querySelectorAll('.script-badge[class*="os-"]');
    return osBadges.length === 0;
  }

  const osBadge = item.querySelector(`.script-badge.os-${expectedOS}`);
  return osBadge !== null;
};

/**
 * Checks if a script item displays the correct filename
 */
const hasCorrectFilename = (item: HTMLElement, expectedFilename: string): boolean => {
  const filenameElement = item.querySelector('.script-list-item-filename');
  return filenameElement?.textContent === expectedFilename;
};

/**
 * Verifies that all scripts are displayed with correct indicators
 */
const verifyAllScriptsDisplayed = (
  scripts: StoredScriptInfo[],
  displayedItems: HTMLElement[]
): boolean => {
  if (scripts.length !== displayedItems.length) {
    return false;
  }

  // Create a map of filenames to scripts for easy lookup
  const scriptMap = new Map(scripts.map(s => [s.filename, s]));

  // Verify each displayed item
  for (const item of displayedItems) {
    const filenameElement = item.querySelector('.script-list-item-filename');
    if (!filenameElement) {
      return false;
    }

    const filename = filenameElement.textContent || '';
    const script = scriptMap.get(filename);

    if (!script) {
      return false;
    }

    // Check source badge
    if (!hasCorrectSourceBadge(item, script.source)) {
      return false;
    }

    // Check OS badge (only for AI-generated scripts)
    if (!hasCorrectOSBadge(item, script.targetOS)) {
      return false;
    }
  }

  return true;
};

// ============================================================================
// Property Tests
// ============================================================================

describe('Script List Completeness Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * **Feature: ai-script-builder, Property 15: Script List Completeness**
   * **Validates: Requirements 9.1, 9.2, 10.2**
   * 
   * For any combination of recorded and AI-generated scripts in storage,
   * the script list SHALL display all scripts with correct source type indicators.
   */
  describe('Property 15: Script List Completeness', () => {
    it('displays all scripts regardless of source type', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            cleanup();
            renderScriptList(scripts);

            if (scripts.length === 0) {
              // Should show empty state
              const emptyState = screen.queryByTestId('script-list-empty');
              return emptyState !== null;
            }

            // Should display all scripts
            const displayedCount = countDisplayedScripts();
            return displayedCount === scripts.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays correct source badge for each script', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            cleanup();

            if (scripts.length === 0) {
              return true; // Skip empty case
            }

            renderScriptList(scripts);
            const displayedItems = getDisplayedScriptItems();

            // Verify each script has correct source badge
            for (let i = 0; i < scripts.length; i++) {
              const script = scripts[i];
              const item = displayedItems[i];

              if (!item) {
                return false;
              }

              if (!hasCorrectSourceBadge(item, script.source)) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays OS badge only for AI-generated scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            cleanup();

            if (scripts.length === 0) {
              return true; // Skip empty case
            }

            renderScriptList(scripts);
            const displayedItems = getDisplayedScriptItems();

            // Verify OS badges
            for (let i = 0; i < scripts.length; i++) {
              const script = scripts[i];
              const item = displayedItems[i];

              if (!item) {
                return false;
              }

              if (script.source === 'ai_generated') {
                // Should have OS badge
                if (!hasCorrectOSBadge(item, script.targetOS)) {
                  return false;
                }
              } else {
                // Should NOT have OS badge
                if (!hasCorrectOSBadge(item, undefined)) {
                  return false;
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays all recorded scripts with recorded badge', () => {
      fc.assert(
        fc.property(
          fc.array(recordedScriptArbitrary, { minLength: 1, maxLength: 20 }),
          (scripts) => {
            cleanup();
            renderScriptList(scripts);

            const displayedItems = getDisplayedScriptItems();

            // All items should have recorded badge
            return displayedItems.every(item =>
              hasCorrectSourceBadge(item, 'recorded')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays all AI-generated scripts with AI badge', () => {
      fc.assert(
        fc.property(
          fc.array(aiGeneratedScriptArbitrary, { minLength: 1, maxLength: 20 }),
          (scripts) => {
            cleanup();
            renderScriptList(scripts);

            const displayedItems = getDisplayedScriptItems();

            // All items should have AI-generated badge
            return displayedItems.every(item =>
              hasCorrectSourceBadge(item, 'ai_generated')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays correct filename for each script', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            cleanup();

            if (scripts.length === 0) {
              return true; // Skip empty case
            }

            renderScriptList(scripts);
            const displayedItems = getDisplayedScriptItems();

            // Verify each script has correct filename
            for (const script of scripts) {
              const matchingItem = displayedItems.find(item =>
                hasCorrectFilename(item, script.filename)
              );

              if (!matchingItem) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays all scripts with complete metadata', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            cleanup();

            if (scripts.length === 0) {
              return true; // Skip empty case
            }

            renderScriptList(scripts);
            const displayedItems = getDisplayedScriptItems();

            return verifyAllScriptsDisplayed(scripts, displayedItems);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('maintains script order in display', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            cleanup();

            if (scripts.length === 0) {
              return true; // Skip empty case
            }

            renderScriptList(scripts);
            const displayedItems = getDisplayedScriptItems();

            // Verify order matches
            for (let i = 0; i < scripts.length; i++) {
              const script = scripts[i];
              const item = displayedItems[i];

              if (!item || !hasCorrectFilename(item, script.filename)) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays mixed recorded and AI scripts correctly', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(recordedScriptArbitrary, { minLength: 1, maxLength: 5 }),
            fc.array(aiGeneratedScriptArbitrary, { minLength: 1, maxLength: 5 })
          ),
          ([recorded, aiGenerated]) => {
            cleanup();
            const scripts = [...recorded, ...aiGenerated];
            renderScriptList(scripts);

            const displayedItems = getDisplayedScriptItems();

            // Should display all scripts
            if (displayedItems.length !== scripts.length) {
              return false;
            }

            // Verify recorded scripts have recorded badge
            const recordedItems = displayedItems.slice(0, recorded.length);
            const allRecordedCorrect = recordedItems.every(item =>
              hasCorrectSourceBadge(item, 'recorded')
            );

            // Verify AI scripts have AI badge and OS badge
            const aiItems = displayedItems.slice(recorded.length);
            const allAICorrect = aiItems.every((item, idx) =>
              hasCorrectSourceBadge(item, 'ai_generated') &&
              hasCorrectOSBadge(item, aiGenerated[idx].targetOS)
            );

            return allRecordedCorrect && allAICorrect;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays scripts with different target OS correctly', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            aiGeneratedScriptArbitrary,
            aiGeneratedScriptArbitrary,
            aiGeneratedScriptArbitrary
          ).map(([s1, s2, s3]) => [
            { ...s1, targetOS: 'macos' as TargetOS },
            { ...s2, targetOS: 'windows' as TargetOS },
            { ...s3, targetOS: 'universal' as TargetOS },
          ]),
          (scripts) => {
            cleanup();
            renderScriptList(scripts);

            const displayedItems = getDisplayedScriptItems();

            // Verify each script has correct OS badge
            return scripts.every((script, idx) => {
              const item = displayedItems[idx];
              return item && hasCorrectOSBadge(item, script.targetOS);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles empty script list correctly', () => {
      cleanup();
      renderScriptList([]);

      // Should show empty state
      const emptyState = screen.queryByTestId('script-list-empty');
      expect(emptyState).toBeInTheDocument();

      // Should not show any script items
      const displayedCount = countDisplayedScripts();
      expect(displayedCount).toBe(0);
    });

    it('handles single script correctly', () => {
      fc.assert(
        fc.property(
          scriptInfoArbitrary,
          (script) => {
            cleanup();
            renderScriptList([script]);

            const displayedCount = countDisplayedScripts();
            if (displayedCount !== 1) {
              return false;
            }

            const displayedItems = getDisplayedScriptItems();
            const item = displayedItems[0];

            return hasCorrectSourceBadge(item, script.source) &&
              hasCorrectFilename(item, script.filename) &&
              hasCorrectOSBadge(item, script.targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles large number of scripts correctly', () => {
      fc.assert(
        fc.property(
          fc.array(scriptInfoArbitrary, { minLength: 50, maxLength: 100 }),
          (scripts) => {
            cleanup();
            renderScriptList(scripts);

            const displayedCount = countDisplayedScripts();
            return displayedCount === scripts.length;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('displays script name for AI-generated scripts', () => {
      fc.assert(
        fc.property(
          fc.array(aiGeneratedScriptArbitrary, { minLength: 1, maxLength: 10 }),
          (scripts) => {
            cleanup();
            renderScriptList(scripts);

            const displayedItems = getDisplayedScriptItems();

            // Verify each AI script shows its script name
            return scripts.every((script, idx) => {
              const item = displayedItems[idx];
              if (!item) return false;

              const scriptNameElement = item.querySelector('.script-list-item-name');
              return scriptNameElement?.textContent === script.scriptName;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('does not display script name for recorded scripts', () => {
      fc.assert(
        fc.property(
          fc.array(recordedScriptArbitrary, { minLength: 1, maxLength: 10 }),
          (scripts) => {
            cleanup();
            renderScriptList(scripts);

            const displayedItems = getDisplayedScriptItems();

            // Verify recorded scripts don't show script name
            return displayedItems.every(item => {
              const scriptNameElement = item.querySelector('.script-list-item-name');
              return scriptNameElement === null || scriptNameElement.textContent === '';
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays action count for all scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            cleanup();

            if (scripts.length === 0) {
              return true; // Skip empty case
            }

            renderScriptList(scripts);
            const displayedItems = getDisplayedScriptItems();

            // Verify each script shows action count
            return scripts.every((script, idx) => {
              const item = displayedItems[idx];
              if (!item) return false;

              const infoText = item.textContent || '';
              return infoText.includes(`Actions: ${script.actionCount}`);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays duration for all scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            cleanup();

            if (scripts.length === 0) {
              return true; // Skip empty case
            }

            renderScriptList(scripts);
            const displayedItems = getDisplayedScriptItems();

            // Verify each script shows duration
            return scripts.every((script, idx) => {
              const item = displayedItems[idx];
              if (!item) return false;

              const infoText = item.textContent || '';
              return infoText.includes('Duration:');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays created date for all scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            cleanup();

            if (scripts.length === 0) {
              return true; // Skip empty case
            }

            renderScriptList(scripts);
            const displayedItems = getDisplayedScriptItems();

            // Verify each script shows created date
            return scripts.every((script, idx) => {
              const item = displayedItems[idx];
              if (!item) return false;

              const infoText = item.textContent || '';
              return infoText.includes('Created:');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Edge cases and boundary conditions
   */
  describe('Edge Cases and Boundary Conditions', () => {
    it('handles scripts with very long filenames', () => {
      const longFilename = 'ai_script_' + 'a'.repeat(200) + '.json';
      const script: StoredScriptInfo = {
        filename: longFilename,
        path: '/home/user/GeniusQA/recordings/' + longFilename,
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'ai_generated',
        targetOS: 'macos',
        scriptName: 'Test Script',
      };

      cleanup();
      renderScriptList([script]);

      const displayedCount = countDisplayedScripts();
      expect(displayedCount).toBe(1);

      const displayedItems = getDisplayedScriptItems();
      expect(hasCorrectFilename(displayedItems[0], longFilename)).toBe(true);
    });

    it('handles scripts with special characters in names', () => {
      const script: StoredScriptInfo = {
        filename: 'ai_script_test-123_v2.0.json',
        path: '/home/user/GeniusQA/recordings/ai_script_test-123_v2.0.json',
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'ai_generated',
        targetOS: 'windows',
        scriptName: 'Test Script (v2.0) - Final',
      };

      cleanup();
      renderScriptList([script]);

      const displayedCount = countDisplayedScripts();
      expect(displayedCount).toBe(1);
    });

    it('handles scripts with zero duration', () => {
      const script: StoredScriptInfo = {
        filename: 'recording_instant.json',
        path: '/home/user/GeniusQA/recordings/recording_instant.json',
        createdAt: new Date().toISOString(),
        duration: 0,
        actionCount: 1,
        source: 'recorded',
      };

      cleanup();
      renderScriptList([script]);

      const displayedCount = countDisplayedScripts();
      expect(displayedCount).toBe(1);
    });

    it('handles scripts with zero actions', () => {
      const script: StoredScriptInfo = {
        filename: 'recording_empty.json',
        path: '/home/user/GeniusQA/recordings/recording_empty.json',
        createdAt: new Date().toISOString(),
        duration: 0,
        actionCount: 0,
        source: 'recorded',
      };

      cleanup();
      renderScriptList([script]);

      const displayedCount = countDisplayedScripts();
      expect(displayedCount).toBe(1);
    });

    it('handles scripts with very large action counts', () => {
      const script: StoredScriptInfo = {
        filename: 'ai_script_large.json',
        path: '/home/user/GeniusQA/recordings/ai_script_large.json',
        createdAt: new Date().toISOString(),
        duration: 3600,
        actionCount: 10000,
        source: 'ai_generated',
        targetOS: 'universal',
        scriptName: 'Large Test Script',
      };

      cleanup();
      renderScriptList([script]);

      const displayedCount = countDisplayedScripts();
      expect(displayedCount).toBe(1);

      const displayedItems = getDisplayedScriptItems();
      const infoText = displayedItems[0].textContent || '';
      expect(infoText).toContain('Actions: 10000');
    });

    it('handles all three target OS types in one list', () => {
      const scripts: StoredScriptInfo[] = [
        {
          filename: 'ai_script_macos.json',
          path: '/home/user/GeniusQA/recordings/ai_script_macos.json',
          createdAt: new Date().toISOString(),
          duration: 10,
          actionCount: 5,
          source: 'ai_generated',
          targetOS: 'macos',
          scriptName: 'macOS Script',
        },
        {
          filename: 'ai_script_windows.json',
          path: '/home/user/GeniusQA/recordings/ai_script_windows.json',
          createdAt: new Date().toISOString(),
          duration: 10,
          actionCount: 5,
          source: 'ai_generated',
          targetOS: 'windows',
          scriptName: 'Windows Script',
        },
        {
          filename: 'ai_script_universal.json',
          path: '/home/user/GeniusQA/recordings/ai_script_universal.json',
          createdAt: new Date().toISOString(),
          duration: 10,
          actionCount: 5,
          source: 'ai_generated',
          targetOS: 'universal',
          scriptName: 'Universal Script',
        },
      ];

      cleanup();
      renderScriptList(scripts);

      const displayedCount = countDisplayedScripts();
      expect(displayedCount).toBe(3);

      const displayedItems = getDisplayedScriptItems();
      expect(hasCorrectOSBadge(displayedItems[0], 'macos')).toBe(true);
      expect(hasCorrectOSBadge(displayedItems[1], 'windows')).toBe(true);
      expect(hasCorrectOSBadge(displayedItems[2], 'universal')).toBe(true);
    });
  });
});
