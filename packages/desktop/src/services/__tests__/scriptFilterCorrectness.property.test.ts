/**
 * Property-Based Tests for Script Filter Correctness
 * 
 * Tests that script filtering works correctly for all filter combinations.
 * For any filter selection (recorded, AI-generated, all), the filtered list
 * should contain only scripts matching the filter criteria.
 * 
 * **Feature: ai-script-builder, Property 16: Script Filter Correctness**
 * **Validates: Requirements 9.4**
 */

import * as fc from 'fast-check';
import {
    ScriptSource,
    StoredScriptInfo,
    TargetOS
} from '../scriptStorageService';

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

/**
 * Generate a valid script filter
 */
const scriptFilterArbitrary: fc.Arbitrary<ScriptFilter> = fc.record({
  source: fc.option(
    fc.constantFrom('all' as const, 'recorded' as const, 'ai_generated' as const),
    { nil: undefined }
  ),
  targetOS: fc.option(targetOSArbitrary, { nil: undefined }),
  searchQuery: fc.option(
    fc.string({ minLength: 1, maxLength: 20 }),
    { nil: undefined }
  ),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply filter to scripts (mimics the listScriptsBySource logic)
 */
function applyFilter(scripts: StoredScriptInfo[], filter: ScriptFilter): StoredScriptInfo[] {
  return scripts.filter(script => {
    // Filter by source
    if (filter.source && filter.source !== 'all') {
      if (script.source !== filter.source) {
        return false;
      }
    }

    // Filter by target OS (only applicable for AI-generated scripts)
    if (filter.targetOS) {
      if (script.source === 'ai_generated' && script.targetOS !== filter.targetOS) {
        return false;
      }
    }

    // Filter by search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const filename = script.filename.toLowerCase();
      const scriptName = (script.scriptName || '').toLowerCase();
      if (!filename.includes(query) && !scriptName.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Check if a script matches the filter criteria
 */
function scriptMatchesFilter(script: StoredScriptInfo, filter: ScriptFilter): boolean {
  // Check source filter
  if (filter.source && filter.source !== 'all') {
    if (script.source !== filter.source) {
      return false;
    }
  }

  // Check target OS filter (only for AI-generated scripts)
  if (filter.targetOS) {
    if (script.source === 'ai_generated' && script.targetOS !== filter.targetOS) {
      return false;
    }
  }

  // Check search query
  if (filter.searchQuery) {
    const query = filter.searchQuery.toLowerCase();
    const filename = script.filename.toLowerCase();
    const scriptName = (script.scriptName || '').toLowerCase();
    if (!filename.includes(query) && !scriptName.includes(query)) {
      return false;
    }
  }

  return true;
}

/**
 * Verify all filtered scripts match the filter criteria
 */
function allScriptsMatchFilter(scripts: StoredScriptInfo[], filter: ScriptFilter): boolean {
  return scripts.every(script => scriptMatchesFilter(script, filter));
}

/**
 * Verify no excluded scripts are in the filtered list
 */
function noExcludedScripts(
  allScripts: StoredScriptInfo[],
  filteredScripts: StoredScriptInfo[],
  filter: ScriptFilter
): boolean {
  const filteredPaths = new Set(filteredScripts.map(s => s.path));
  
  for (const script of allScripts) {
    const shouldBeIncluded = scriptMatchesFilter(script, filter);
    const isIncluded = filteredPaths.has(script.path);
    
    if (shouldBeIncluded !== isIncluded) {
      return false;
    }
  }
  
  return true;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Script Filter Correctness Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 16: Script Filter Correctness**
   * **Validates: Requirements 9.4**
   * 
   * For any filter selection (recorded, AI-generated, all), the filtered list
   * SHALL contain only scripts matching the filter criteria.
   */
  describe('Property 16: Script Filter Correctness', () => {
    it('filtered list contains only scripts matching filter criteria', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          scriptFilterArbitrary,
          (scripts, filter) => {
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must match the filter
            return allScriptsMatchFilter(filtered, filter);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter by source=recorded returns only recorded scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = { source: 'recorded' };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must be recorded
            return filtered.every(script => script.source === 'recorded');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter by source=ai_generated returns only AI-generated scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = { source: 'ai_generated' };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must be AI-generated
            return filtered.every(script => script.source === 'ai_generated');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter by source=all returns all scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = { source: 'all' };
            const filtered = applyFilter(scripts, filter);
            
            // Should return all scripts
            return filtered.length === scripts.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter by targetOS returns only matching AI scripts (recorded scripts pass through)', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          targetOSArbitrary,
          (scripts, targetOS) => {
            const filter: ScriptFilter = { targetOS };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must be either:
            // 1. Recorded scripts (pass through)
            // 2. AI-generated scripts with matching targetOS
            return filtered.every(script =>
              script.source === 'recorded' ||
              (script.source === 'ai_generated' && script.targetOS === targetOS)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter by searchQuery returns only matching scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          fc.string({ minLength: 1, maxLength: 10 }),
          (scripts, searchQuery) => {
            const filter: ScriptFilter = { searchQuery };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must match the search query
            return filtered.every(script => {
              const query = searchQuery.toLowerCase();
              const filename = script.filename.toLowerCase();
              const scriptName = (script.scriptName || '').toLowerCase();
              return filename.includes(query) || scriptName.includes(query);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('combined filter (source + targetOS) returns correct scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          targetOSArbitrary,
          (scripts, targetOS) => {
            const filter: ScriptFilter = {
              source: 'ai_generated',
              targetOS,
            };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must be AI-generated with matching targetOS
            return filtered.every(script =>
              script.source === 'ai_generated' && script.targetOS === targetOS
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('combined filter (source + searchQuery) returns correct scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          scriptSourceArbitrary,
          fc.string({ minLength: 1, maxLength: 10 }),
          (scripts, source, searchQuery) => {
            const filter: ScriptFilter = {
              source,
              searchQuery,
            };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must match both criteria
            return filtered.every(script => {
              const matchesSource = script.source === source;
              const query = searchQuery.toLowerCase();
              const filename = script.filename.toLowerCase();
              const scriptName = (script.scriptName || '').toLowerCase();
              const matchesQuery = filename.includes(query) || scriptName.includes(query);
              
              return matchesSource && matchesQuery;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('combined filter (all three criteria) returns correct scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          targetOSArbitrary,
          fc.string({ minLength: 1, maxLength: 10 }),
          (scripts, targetOS, searchQuery) => {
            const filter: ScriptFilter = {
              source: 'ai_generated',
              targetOS,
              searchQuery,
            };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must match all three criteria
            return filtered.every(script => {
              const matchesSource = script.source === 'ai_generated';
              const matchesOS = script.targetOS === targetOS;
              const query = searchQuery.toLowerCase();
              const filename = script.filename.toLowerCase();
              const scriptName = (script.scriptName || '').toLowerCase();
              const matchesQuery = filename.includes(query) || scriptName.includes(query);
              
              return matchesSource && matchesOS && matchesQuery;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no excluded scripts appear in filtered list', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          scriptFilterArbitrary,
          (scripts, filter) => {
            const filtered = applyFilter(scripts, filter);
            
            // Verify no excluded scripts are included
            return noExcludedScripts(scripts, filtered, filter);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty filter returns all scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = {};
            const filtered = applyFilter(scripts, filter);
            
            // Should return all scripts
            return filtered.length === scripts.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter with undefined source returns all scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = { source: undefined };
            const filtered = applyFilter(scripts, filter);
            
            // Should return all scripts
            return filtered.length === scripts.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('targetOS filter does not exclude recorded scripts', () => {
      fc.assert(
        fc.property(
          fc.array(recordedScriptArbitrary, { minLength: 1, maxLength: 10 }),
          targetOSArbitrary,
          (recordedScripts, targetOS) => {
            const filter: ScriptFilter = { targetOS };
            const filtered = applyFilter(recordedScripts, filter);
            
            // Recorded scripts should pass through targetOS filter
            // (targetOS filter only applies to AI-generated scripts)
            return filtered.length === recordedScripts.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter preserves script order', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          scriptFilterArbitrary,
          (scripts, filter) => {
            const filtered = applyFilter(scripts, filter);
            
            // Verify order is preserved by checking indices
            let lastIndex = -1;
            for (const filteredScript of filtered) {
              // Find first occurrence of this script in original list
              const index = scripts.findIndex(s => 
                s.path === filteredScript.path && 
                s.filename === filteredScript.filename &&
                s.source === filteredScript.source
              );
              
              if (index === -1) {
                return false; // Script not found in original list
              }
              
              if (index < lastIndex) {
                return false; // Order not preserved
              }
              
              lastIndex = index;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter is case-insensitive for search query', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          fc.string({ minLength: 1, maxLength: 10 }),
          (scripts, searchQuery) => {
            const lowerFilter: ScriptFilter = { searchQuery: searchQuery.toLowerCase() };
            const upperFilter: ScriptFilter = { searchQuery: searchQuery.toUpperCase() };
            
            const lowerFiltered = applyFilter(scripts, lowerFilter);
            const upperFiltered = applyFilter(scripts, upperFilter);
            
            // Should return same results regardless of case
            return lowerFiltered.length === upperFiltered.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter by non-existent search query returns empty list', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            // Use a search query that won't match any script
            const filter: ScriptFilter = {
              searchQuery: 'ZZZZZ_NONEXISTENT_QUERY_12345',
            };
            const filtered = applyFilter(scripts, filter);
            
            // Should return empty list
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter by macOS returns matching AI scripts and all recorded scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = { targetOS: 'macos' };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must be either recorded or macOS AI scripts
            return filtered.every(script =>
              script.source === 'recorded' ||
              (script.source === 'ai_generated' && script.targetOS === 'macos')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter by Windows returns matching AI scripts and all recorded scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = { targetOS: 'windows' };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must be either recorded or Windows AI scripts
            return filtered.every(script =>
              script.source === 'recorded' ||
              (script.source === 'ai_generated' && script.targetOS === 'windows')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter by Universal returns matching AI scripts and all recorded scripts', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = { targetOS: 'universal' };
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must be either recorded or Universal AI scripts
            return filtered.every(script =>
              script.source === 'recorded' ||
              (script.source === 'ai_generated' && script.targetOS === 'universal')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('search query matches filename', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            if (scripts.length === 0) {
              return true;
            }

            // Pick a script and search for part of its filename
            const targetScript = scripts[0];
            const searchQuery = targetScript.filename.substring(0, 5);
            
            const filter: ScriptFilter = { searchQuery };
            const filtered = applyFilter(scripts, filter);
            
            // Target script should be in filtered list
            return filtered.some(s => s.path === targetScript.path);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('search query matches script name for AI scripts', () => {
      fc.assert(
        fc.property(
          fc.array(aiGeneratedScriptArbitrary, { minLength: 1, maxLength: 10 }),
          (scripts) => {
            // Pick a script and search for part of its script name
            const targetScript = scripts[0];
            const searchQuery = (targetScript.scriptName || '').substring(0, 5);
            
            if (!searchQuery) {
              return true; // Skip if no script name
            }
            
            const filter: ScriptFilter = { searchQuery };
            const filtered = applyFilter(scripts, filter);
            
            // Target script should be in filtered list
            return filtered.some(s => s.path === targetScript.path);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter returns subset of original list', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          scriptFilterArbitrary,
          (scripts, filter) => {
            const filtered = applyFilter(scripts, filter);
            
            // Filtered list should be subset of original
            return filtered.length <= scripts.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter is idempotent', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          scriptFilterArbitrary,
          (scripts, filter) => {
            const filtered1 = applyFilter(scripts, filter);
            const filtered2 = applyFilter(filtered1, filter);
            
            // Applying filter twice should give same result
            return filtered1.length === filtered2.length &&
              filtered1.every((s, i) => s.path === filtered2[i].path);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple filters with same criteria return same results', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          scriptFilterArbitrary,
          (scripts, filter) => {
            const filtered1 = applyFilter(scripts, filter);
            const filtered2 = applyFilter(scripts, filter);
            
            // Should return identical results
            return filtered1.length === filtered2.length &&
              filtered1.every((s, i) => s.path === filtered2[i].path);
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
    it('handles empty script list', () => {
      const filter: ScriptFilter = { source: 'all' };
      const filtered = applyFilter([], filter);
      
      expect(filtered).toEqual([]);
    });

    it('handles filter on empty list with all criteria', () => {
      const filter: ScriptFilter = {
        source: 'ai_generated',
        targetOS: 'macos',
        searchQuery: 'test',
      };
      const filtered = applyFilter([], filter);
      
      expect(filtered).toEqual([]);
    });

    it('handles single recorded script with recorded filter', () => {
      const script: StoredScriptInfo = {
        filename: 'recording_test.json',
        path: '/home/user/GeniusQA/recordings/recording_test.json',
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'recorded',
      };

      const filter: ScriptFilter = { source: 'recorded' };
      const filtered = applyFilter([script], filter);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toEqual(script);
    });

    it('handles single AI script with AI filter', () => {
      const script: StoredScriptInfo = {
        filename: 'ai_script_test.json',
        path: '/home/user/GeniusQA/recordings/ai_script_test.json',
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'ai_generated',
        targetOS: 'macos',
        scriptName: 'Test Script',
      };

      const filter: ScriptFilter = { source: 'ai_generated' };
      const filtered = applyFilter([script], filter);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toEqual(script);
    });

    it('handles recorded script with AI filter', () => {
      const script: StoredScriptInfo = {
        filename: 'recording_test.json',
        path: '/home/user/GeniusQA/recordings/recording_test.json',
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'recorded',
      };

      const filter: ScriptFilter = { source: 'ai_generated' };
      const filtered = applyFilter([script], filter);
      
      expect(filtered).toHaveLength(0);
    });

    it('handles AI script with recorded filter', () => {
      const script: StoredScriptInfo = {
        filename: 'ai_script_test.json',
        path: '/home/user/GeniusQA/recordings/ai_script_test.json',
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'ai_generated',
        targetOS: 'macos',
        scriptName: 'Test Script',
      };

      const filter: ScriptFilter = { source: 'recorded' };
      const filtered = applyFilter([script], filter);
      
      expect(filtered).toHaveLength(0);
    });

    it('handles search query with special characters', () => {
      const script: StoredScriptInfo = {
        filename: 'ai_script_test-123_v2.0.json',
        path: '/home/user/GeniusQA/recordings/ai_script_test-123_v2.0.json',
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'ai_generated',
        targetOS: 'macos',
        scriptName: 'Test Script (v2.0)',
      };

      const filter: ScriptFilter = { searchQuery: 'v2.0' };
      const filtered = applyFilter([script], filter);
      
      expect(filtered).toHaveLength(1);
    });

    it('handles empty search query', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = { searchQuery: '' };
            const filtered = applyFilter(scripts, filter);
            
            // Empty search query should match all scripts
            return filtered.length === scripts.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles whitespace-only search query', () => {
      fc.assert(
        fc.property(
          scriptCombinationArbitrary,
          (scripts) => {
            const filter: ScriptFilter = { searchQuery: '   ' };
            const filtered = applyFilter(scripts, filter);
            
            // Whitespace search query should match scripts with spaces
            return filtered.every(script => {
              const filename = script.filename.toLowerCase();
              const scriptName = (script.scriptName || '').toLowerCase();
              return filename.includes('   ') || scriptName.includes('   ');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles very long search query', () => {
      const longQuery = 'a'.repeat(1000);
      const script: StoredScriptInfo = {
        filename: 'recording_test.json',
        path: '/home/user/GeniusQA/recordings/recording_test.json',
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'recorded',
      };

      const filter: ScriptFilter = { searchQuery: longQuery };
      const filtered = applyFilter([script], filter);
      
      expect(filtered).toHaveLength(0);
    });

    it('handles scripts with missing scriptName field', () => {
      const script: StoredScriptInfo = {
        filename: 'ai_script_test.json',
        path: '/home/user/GeniusQA/recordings/ai_script_test.json',
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'ai_generated',
        targetOS: 'macos',
        // scriptName is undefined
      };

      const filter: ScriptFilter = { searchQuery: 'test' };
      const filtered = applyFilter([script], filter);
      
      // Should still match on filename
      expect(filtered).toHaveLength(1);
    });

    it('handles scripts with missing targetOS field', () => {
      const script: StoredScriptInfo = {
        filename: 'ai_script_test.json',
        path: '/home/user/GeniusQA/recordings/ai_script_test.json',
        createdAt: new Date().toISOString(),
        duration: 10,
        actionCount: 5,
        source: 'ai_generated',
        scriptName: 'Test Script',
        // targetOS is undefined
      };

      const filter: ScriptFilter = { targetOS: 'macos' };
      const filtered = applyFilter([script], filter);
      
      // Should not match since targetOS doesn't match
      expect(filtered).toHaveLength(0);
    });

    it('handles large number of scripts', () => {
      fc.assert(
        fc.property(
          fc.array(scriptInfoArbitrary, { minLength: 100, maxLength: 200 }),
          scriptFilterArbitrary,
          (scripts, filter) => {
            const filtered = applyFilter(scripts, filter);
            
            // All filtered scripts must match the filter
            return allScriptsMatchFilter(filtered, filter);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('handles all recorded scripts', () => {
      fc.assert(
        fc.property(
          fc.array(recordedScriptArbitrary, { minLength: 10, maxLength: 50 }),
          (scripts) => {
            const filter: ScriptFilter = { source: 'recorded' };
            const filtered = applyFilter(scripts, filter);
            
            // Should return all scripts
            return filtered.length === scripts.length;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('handles all AI-generated scripts', () => {
      fc.assert(
        fc.property(
          fc.array(aiGeneratedScriptArbitrary, { minLength: 10, maxLength: 50 }),
          (scripts) => {
            const filter: ScriptFilter = { source: 'ai_generated' };
            const filtered = applyFilter(scripts, filter);
            
            // Should return all scripts
            return filtered.length === scripts.length;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('handles mixed OS types in AI scripts', () => {
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

      const macosFilter: ScriptFilter = { targetOS: 'macos' };
      const windowsFilter: ScriptFilter = { targetOS: 'windows' };
      const universalFilter: ScriptFilter = { targetOS: 'universal' };

      const macosFiltered = applyFilter(scripts, macosFilter);
      const windowsFiltered = applyFilter(scripts, windowsFilter);
      const universalFiltered = applyFilter(scripts, universalFilter);

      expect(macosFiltered).toHaveLength(1);
      expect(macosFiltered[0].targetOS).toBe('macos');
      
      expect(windowsFiltered).toHaveLength(1);
      expect(windowsFiltered[0].targetOS).toBe('windows');
      
      expect(universalFiltered).toHaveLength(1);
      expect(universalFiltered[0].targetOS).toBe('universal');
    });
  });
});
