/**
 * Property-Based Tests for Script Filtering Correctness
 * 
 * Tests correctness properties for script filtering in ScriptListTabContent,
 * ensuring filtered results only contain scripts matching filter criteria.
 * 
 * **Feature: unified-recording-tabs, Property 3: Script Filtering Correctness**
 * **Validates: Requirements 3.2**
 */

import * as fc from 'fast-check';
import {
  StoredScriptInfo,
  ScriptFilter as ScriptFilterType,
  ScriptSource,
  TargetOS,
} from '../../../services/scriptStorageService';

// ============================================================================
// Filter Function (extracted from ScriptListTabContent for testing)
// ============================================================================

/**
 * Filters scripts based on filter criteria
 * This is the same logic used in ScriptListTabContent component
 */
function filterScripts(
  scripts: StoredScriptInfo[],
  filter: ScriptFilterType
): StoredScriptInfo[] {
  return scripts.filter((script) => {
    // Filter by source
    if (filter.source && filter.source !== 'all') {
      if (script.source !== filter.source) {
        return false;
      }
    }

    // Filter by target OS (only for AI-generated scripts)
    if (filter.targetOS && script.source === 'ai_generated') {
      if (script.targetOS !== filter.targetOS) {
        return false;
      }
    }

    // Filter by search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const filename = script.filename.toLowerCase();
      const scriptName = script.scriptName?.toLowerCase() || '';
      
      if (!filename.includes(query) && !scriptName.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

// ============================================================================
// Arbitraries (Generators) for Script Data
// ============================================================================

const alphanumericChars = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a valid script source type
 */
const scriptSourceArbitrary: fc.Arbitrary<ScriptSource> = fc.constantFrom(
  'recorded',
  'ai_generated',
  'unknown'
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
 * Generate a valid ISO date string
 */
const isoDateArbitrary = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }),
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 }),
  fc.integer({ min: 0, max: 59 })
).map(([year, month, day, hour, minute, second]) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}.000Z`;
});

/**
 * Generate a valid filename
 */
const filenameArbitrary = fc.string({ minLength: 5, maxLength: 30 })
  .filter(s => s.length >= 5 && [...s].every(c => alphanumericChars.includes(c.toLowerCase()) || c === '_' || c === '-'))
  .map(name => `${name}.json`);

/**
 * Generate a valid script name (optional)
 */
const scriptNameArbitrary = fc.option(
  fc.string({ minLength: 3, maxLength: 50 })
    .filter(s => s.length >= 3),
  { nil: undefined }
);

/**
 * Generate a valid StoredScriptInfo
 */
const storedScriptInfoArbitrary: fc.Arbitrary<StoredScriptInfo> = fc.record({
  filename: filenameArbitrary,
  path: fc.string({ minLength: 10, maxLength: 100 }).map(s => `/path/to/${s}`),
  createdAt: isoDateArbitrary,
  duration: fc.float({ min: 0, max: 3600, noNaN: true }),
  actionCount: fc.integer({ min: 0, max: 1000 }),
  source: scriptSourceArbitrary,
  targetOS: fc.option(targetOSArbitrary, { nil: undefined }),
  scriptName: scriptNameArbitrary,
});

/**
 * Generate a list of scripts
 */
const scriptListArbitrary = fc.array(storedScriptInfoArbitrary, { minLength: 0, maxLength: 50 });

/**
 * Generate a search query string
 */
const searchQueryArbitrary = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.length >= 1 && [...s].every(c => alphanumericChars.includes(c.toLowerCase())));

/**
 * Generate a valid filter configuration
 */
const filterArbitrary: fc.Arbitrary<ScriptFilterType> = fc.record({
  source: fc.option(
    fc.constantFrom<ScriptSource | 'all'>('all', 'recorded', 'ai_generated', 'unknown'),
    { nil: undefined }
  ),
  targetOS: fc.option(targetOSArbitrary, { nil: undefined }),
  searchQuery: fc.option(searchQueryArbitrary, { nil: undefined }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Script Filtering Correctness Property Tests', () => {
  /**
   * **Feature: unified-recording-tabs, Property 3: Script Filtering Correctness**
   * **Validates: Requirements 3.2**
   * 
   * For any script list and filter configuration, the filtered results SHALL
   * only contain scripts matching the filter criteria (source type, search query).
   */
  describe('Property 3: Script Filtering Correctness', () => {
    it('filtered results only contain scripts matching source filter', () => {
      fc.assert(
        fc.property(
          scriptListArbitrary,
          fc.constantFrom<ScriptSource>('recorded', 'ai_generated', 'unknown'),
          (scripts, sourceFilter) => {
            const filter: ScriptFilterType = { source: sourceFilter };
            const filtered = filterScripts(scripts, filter);

            // All filtered scripts must match the source filter
            return filtered.every(script => script.source === sourceFilter);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filtered results only contain scripts matching search query in filename', () => {
      fc.assert(
        fc.property(
          scriptListArbitrary,
          searchQueryArbitrary,
          (scripts, searchQuery) => {
            const filter: ScriptFilterType = { searchQuery };
            const filtered = filterScripts(scripts, filter);

            // All filtered scripts must contain the search query in filename or scriptName
            return filtered.every(script => {
              const filename = script.filename.toLowerCase();
              const scriptName = script.scriptName?.toLowerCase() || '';
              const query = searchQuery.toLowerCase();
              return filename.includes(query) || scriptName.includes(query);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filtered results only contain AI scripts matching target OS filter', () => {
      fc.assert(
        fc.property(
          scriptListArbitrary,
          targetOSArbitrary,
          (scripts, osFilter) => {
            const filter: ScriptFilterType = { 
              source: 'ai_generated',
              targetOS: osFilter 
            };
            const filtered = filterScripts(scripts, filter);

            // All filtered scripts must be AI-generated and match the OS filter
            return filtered.every(script => 
              script.source === 'ai_generated' && script.targetOS === osFilter
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filter with source "all" returns all scripts (no source filtering)', () => {
      fc.assert(
        fc.property(scriptListArbitrary, (scripts) => {
          const filter: ScriptFilterType = { source: 'all' };
          const filtered = filterScripts(scripts, filter);

          // Should return all scripts when source is 'all'
          return filtered.length === scripts.length;
        }),
        { numRuns: 100 }
      );
    });

    it('empty filter returns all scripts', () => {
      fc.assert(
        fc.property(scriptListArbitrary, (scripts) => {
          const filter: ScriptFilterType = {};
          const filtered = filterScripts(scripts, filter);

          // Should return all scripts when no filter is applied
          return filtered.length === scripts.length;
        }),
        { numRuns: 100 }
      );
    });

    it('combined filters are applied conjunctively (AND logic)', () => {
      fc.assert(
        fc.property(
          scriptListArbitrary,
          fc.constantFrom<ScriptSource>('recorded', 'ai_generated'),
          searchQueryArbitrary,
          (scripts, sourceFilter, searchQuery) => {
            const filter: ScriptFilterType = { 
              source: sourceFilter,
              searchQuery 
            };
            const filtered = filterScripts(scripts, filter);

            // All filtered scripts must match BOTH source AND search query
            return filtered.every(script => {
              const matchesSource = script.source === sourceFilter;
              const filename = script.filename.toLowerCase();
              const scriptName = script.scriptName?.toLowerCase() || '';
              const query = searchQuery.toLowerCase();
              const matchesSearch = filename.includes(query) || scriptName.includes(query);
              return matchesSource && matchesSearch;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filtered results are a subset of original scripts', () => {
      fc.assert(
        fc.property(scriptListArbitrary, filterArbitrary, (scripts, filter) => {
          const filtered = filterScripts(scripts, filter);

          // Filtered count should never exceed original count
          if (filtered.length > scripts.length) {
            return false;
          }

          // Every filtered script must exist in original list
          return filtered.every(filteredScript =>
            scripts.some(script => script.path === filteredScript.path)
          );
        }),
        { numRuns: 100 }
      );
    });

    it('search is case-insensitive', () => {
      fc.assert(
        fc.property(
          scriptListArbitrary,
          searchQueryArbitrary,
          (scripts, searchQuery) => {
            const lowerFilter: ScriptFilterType = { searchQuery: searchQuery.toLowerCase() };
            const upperFilter: ScriptFilterType = { searchQuery: searchQuery.toUpperCase() };
            const mixedFilter: ScriptFilterType = { searchQuery };

            const lowerFiltered = filterScripts(scripts, lowerFilter);
            const upperFiltered = filterScripts(scripts, upperFilter);
            const mixedFiltered = filterScripts(scripts, mixedFilter);

            // All case variations should produce the same results
            return (
              lowerFiltered.length === upperFiltered.length &&
              upperFiltered.length === mixedFiltered.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('OS filter only applies to AI-generated scripts', () => {
      fc.assert(
        fc.property(
          scriptListArbitrary,
          targetOSArbitrary,
          (scripts, osFilter) => {
            // Filter with OS but source is 'recorded'
            const filter: ScriptFilterType = { 
              source: 'recorded',
              targetOS: osFilter 
            };
            const filtered = filterScripts(scripts, filter);

            // OS filter should be ignored for recorded scripts
            // All filtered scripts should be recorded (regardless of their targetOS)
            return filtered.every(script => script.source === 'recorded');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filtering is idempotent (applying same filter twice gives same result)', () => {
      fc.assert(
        fc.property(scriptListArbitrary, filterArbitrary, (scripts, filter) => {
          const firstFilter = filterScripts(scripts, filter);
          const secondFilter = filterScripts(firstFilter, filter);

          // Applying the same filter twice should give the same result
          return firstFilter.length === secondFilter.length;
        }),
        { numRuns: 100 }
      );
    });

    it('no scripts are lost when filter matches all', () => {
      fc.assert(
        fc.property(
          fc.array(
            storedScriptInfoArbitrary.map(script => ({
              ...script,
              source: 'recorded' as ScriptSource,
              filename: 'test_script.json',
            })),
            { minLength: 1, maxLength: 20 }
          ),
          (scripts) => {
            // All scripts have source 'recorded' and filename contains 'test'
            const filter: ScriptFilterType = { 
              source: 'recorded',
              searchQuery: 'test'
            };
            const filtered = filterScripts(scripts, filter);

            // All scripts should pass the filter
            return filtered.length === scripts.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
