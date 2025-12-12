/**
 * Integration Tests for OS Selection Flow
 * Tests: Select OS → Generate → Verify OS-specific actions
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { TargetOS } from '../../components/OSSelector';
import {
  OS_KEY_MAPPINGS,
  getKeyMapping,
  getOSKeyMappings,
  getShortcutDisplayString,
  isValidKeyForOS,
  shortcutToScriptAction,
  getPrimaryModifier,
  getModifierDisplayName,
  ShortcutAction,
} from '../../utils/osKeyMappings';

describe('OS Selection Flow Integration Tests', () => {
  describe('OS Selector Component Behavior', () => {
    /**
     * Test: OS selector displays all three options
     * Requirements: 8.1
     */
    it('should have all three OS options available', () => {
      const osOptions: TargetOS[] = ['macos', 'windows', 'universal'];

      osOptions.forEach(os => {
        expect(OS_KEY_MAPPINGS[os]).toBeDefined();
        expect(Object.keys(OS_KEY_MAPPINGS[os]).length).toBeGreaterThan(0);
      });
    });

    /**
     * Test: Each OS has complete key mappings
     * Requirements: 8.3, 8.4, 8.5
     */
    it('should have complete key mappings for each OS', () => {
      const requiredActions: ShortcutAction[] = [
        'copy', 'paste', 'cut', 'selectAll', 'save', 'undo', 'redo',
      ];

      const osOptions: TargetOS[] = ['macos', 'windows', 'universal'];

      osOptions.forEach(os => {
        requiredActions.forEach(action => {
          const mapping = getKeyMapping(os, action);
          expect(mapping).toBeDefined();
          expect(mapping.displayName).toBeDefined();
          expect(mapping.keys).toBeDefined();
          expect(mapping.keyCodes).toBeDefined();
          expect(Array.isArray(mapping.keyCodes)).toBe(true);
          expect(mapping.modifiers).toBeDefined();
          expect(Array.isArray(mapping.modifiers)).toBe(true);
        });
      });
    });
  });

  describe('OS-Specific Key Code Generation', () => {
    /**
     * Test: macOS uses Cmd-based shortcuts
     * Requirements: 8.3
     */
    it('should generate macOS-specific key codes with Cmd modifier', () => {
      const macOSMappings = getOSKeyMappings('macos');

      // Copy should use Cmd+C
      expect(macOSMappings.copy.keys).toBe('Cmd+C');
      expect(macOSMappings.copy.modifiers).toContain('meta');

      // Paste should use Cmd+V
      expect(macOSMappings.paste.keys).toBe('Cmd+V');
      expect(macOSMappings.paste.modifiers).toContain('meta');

      // Save should use Cmd+S
      expect(macOSMappings.save.keys).toBe('Cmd+S');
      expect(macOSMappings.save.modifiers).toContain('meta');
    });

    /**
     * Test: Windows uses Ctrl-based shortcuts
     * Requirements: 8.4
     */
    it('should generate Windows-specific key codes with Ctrl modifier', () => {
      const windowsMappings = getOSKeyMappings('windows');

      // Copy should use Ctrl+C
      expect(windowsMappings.copy.keys).toBe('Ctrl+C');
      expect(windowsMappings.copy.modifiers).toContain('ctrl');

      // Paste should use Ctrl+V
      expect(windowsMappings.paste.keys).toBe('Ctrl+V');
      expect(windowsMappings.paste.modifiers).toContain('ctrl');

      // Save should use Ctrl+S
      expect(windowsMappings.save.keys).toBe('Ctrl+S');
      expect(windowsMappings.save.modifiers).toContain('ctrl');
    });

    /**
     * Test: Universal uses cross-platform compatible actions
     * Requirements: 8.5
     */
    it('should generate Universal cross-platform compatible actions', () => {
      const universalMappings = getOSKeyMappings('universal');

      // Universal should use generic action names without modifiers
      expect(universalMappings.copy.keys).toBe('Copy');
      expect(universalMappings.copy.modifiers).toHaveLength(0);

      expect(universalMappings.paste.keys).toBe('Paste');
      expect(universalMappings.paste.modifiers).toHaveLength(0);

      expect(universalMappings.save.keys).toBe('Save');
      expect(universalMappings.save.modifiers).toHaveLength(0);
    });
  });

  describe('OS-Specific Shortcut Display', () => {
    /**
     * Test: Display strings are correct for each OS
     * Requirements: 8.2
     */
    it('should return correct display strings for shortcuts', () => {
      // macOS
      expect(getShortcutDisplayString('macos', 'copy')).toBe('Cmd+C');
      expect(getShortcutDisplayString('macos', 'redo')).toBe('Cmd+Shift+Z');

      // Windows
      expect(getShortcutDisplayString('windows', 'copy')).toBe('Ctrl+C');
      expect(getShortcutDisplayString('windows', 'redo')).toBe('Ctrl+Y');

      // Universal
      expect(getShortcutDisplayString('universal', 'copy')).toBe('Copy');
      expect(getShortcutDisplayString('universal', 'redo')).toBe('Redo');
    });
  });

  describe('Key Code Validation', () => {
    /**
     * Test: Valid key codes are accepted for each OS
     * Requirements: 8.3, 8.4, 8.5
     */
    it('should validate common key codes for all OS types', () => {
      const commonKeys = ['a', 'b', 'c', 'enter', 'tab', 'space', 'escape'];
      const osOptions: TargetOS[] = ['macos', 'windows', 'universal'];

      osOptions.forEach(os => {
        commonKeys.forEach(key => {
          expect(isValidKeyForOS(key, os)).toBe(true);
        });
      });
    });

    /**
     * Test: Function keys are valid
     */
    it('should validate function keys', () => {
      const functionKeys = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'];
      const osOptions: TargetOS[] = ['macos', 'windows', 'universal'];

      osOptions.forEach(os => {
        functionKeys.forEach(key => {
          expect(isValidKeyForOS(key, os)).toBe(true);
        });
      });
    });

    /**
     * Test: Navigation keys are valid
     */
    it('should validate navigation keys', () => {
      const navKeys = ['up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown'];
      const osOptions: TargetOS[] = ['macos', 'windows', 'universal'];

      osOptions.forEach(os => {
        navKeys.forEach(key => {
          expect(isValidKeyForOS(key, os)).toBe(true);
        });
      });
    });

    /**
     * Test: Case insensitivity
     */
    it('should validate keys case-insensitively', () => {
      expect(isValidKeyForOS('ENTER', 'macos')).toBe(true);
      expect(isValidKeyForOS('Enter', 'windows')).toBe(true);
      expect(isValidKeyForOS('eNtEr', 'universal')).toBe(true);
    });
  });

  describe('Script Action Generation', () => {
    /**
     * Test: Convert shortcut to script action for macOS
     * Requirements: 8.3
     */
    it('should convert shortcut to macOS script action', () => {
      const action = shortcutToScriptAction('macos', 'copy', 1.5);

      expect(action.type).toBe('key_press');
      expect(action.timestamp).toBe(1.5);
      expect(action.key).toBe('c');
      expect(action.modifiers).toContain('meta');
    });

    /**
     * Test: Convert shortcut to script action for Windows
     * Requirements: 8.4
     */
    it('should convert shortcut to Windows script action', () => {
      const action = shortcutToScriptAction('windows', 'copy', 2.0);

      expect(action.type).toBe('key_press');
      expect(action.timestamp).toBe(2.0);
      expect(action.key).toBe('c');
      expect(action.modifiers).toContain('ctrl');
    });

    /**
     * Test: Convert shortcut to script action for Universal
     * Requirements: 8.5
     */
    it('should convert shortcut to Universal script action', () => {
      const action = shortcutToScriptAction('universal', 'copy', 0.5);

      expect(action.type).toBe('key_press');
      expect(action.timestamp).toBe(0.5);
      expect(action.key).toBe('copy');
      expect(action.modifiers).toHaveLength(0);
    });
  });

  describe('Primary Modifier Detection', () => {
    /**
     * Test: Get primary modifier for each OS
     * Requirements: 8.2
     */
    it('should return correct primary modifier for each OS', () => {
      expect(getPrimaryModifier('macos')).toBe('meta');
      expect(getPrimaryModifier('windows')).toBe('ctrl');
      expect(getPrimaryModifier('universal')).toBe('primary');
    });
  });

  describe('Modifier Display Names', () => {
    /**
     * Test: Display names for modifiers are OS-appropriate
     * Requirements: 8.2
     */
    it('should return correct modifier display names for macOS', () => {
      expect(getModifierDisplayName('meta', 'macos')).toBe('⌘');
      expect(getModifierDisplayName('ctrl', 'macos')).toBe('⌃');
      expect(getModifierDisplayName('alt', 'macos')).toBe('⌥');
      expect(getModifierDisplayName('shift', 'macos')).toBe('⇧');
    });

    it('should return correct modifier display names for Windows', () => {
      expect(getModifierDisplayName('meta', 'windows')).toBe('Win');
      expect(getModifierDisplayName('ctrl', 'windows')).toBe('Ctrl');
      expect(getModifierDisplayName('alt', 'windows')).toBe('Alt');
      expect(getModifierDisplayName('shift', 'windows')).toBe('Shift');
    });

    it('should return correct modifier display names for Universal', () => {
      expect(getModifierDisplayName('primary', 'universal')).toBe('Primary');
      expect(getModifierDisplayName('ctrl', 'universal')).toBe('Ctrl');
      expect(getModifierDisplayName('alt', 'universal')).toBe('Alt');
      expect(getModifierDisplayName('shift', 'universal')).toBe('Shift');
    });
  });

  describe('OS-Specific Differences', () => {
    /**
     * Test: macOS and Windows have different redo shortcuts
     * Requirements: 8.3, 8.4
     */
    it('should have different redo shortcuts for macOS and Windows', () => {
      const macOSRedo = getKeyMapping('macos', 'redo');
      const windowsRedo = getKeyMapping('windows', 'redo');

      // macOS uses Cmd+Shift+Z
      expect(macOSRedo.keys).toBe('Cmd+Shift+Z');
      expect(macOSRedo.keyCodes).toContain('z');
      expect(macOSRedo.modifiers).toContain('meta');
      expect(macOSRedo.modifiers).toContain('shift');

      // Windows uses Ctrl+Y
      expect(windowsRedo.keys).toBe('Ctrl+Y');
      expect(windowsRedo.keyCodes).toContain('y');
      expect(windowsRedo.modifiers).toContain('ctrl');
      expect(windowsRedo.modifiers).not.toContain('shift');
    });

    /**
     * Test: macOS and Windows have different quit shortcuts
     * Requirements: 8.3, 8.4
     */
    it('should have different quit shortcuts for macOS and Windows', () => {
      const macOSQuit = getKeyMapping('macos', 'quit');
      const windowsQuit = getKeyMapping('windows', 'quit');

      // macOS uses Cmd+Q
      expect(macOSQuit.keys).toBe('Cmd+Q');
      expect(macOSQuit.modifiers).toContain('meta');

      // Windows uses Alt+F4
      expect(windowsQuit.keys).toBe('Alt+F4');
      expect(windowsQuit.modifiers).toContain('alt');
    });

    /**
     * Test: macOS and Windows have different refresh shortcuts
     * Requirements: 8.3, 8.4
     */
    it('should have different refresh shortcuts for macOS and Windows', () => {
      const macOSRefresh = getKeyMapping('macos', 'refresh');
      const windowsRefresh = getKeyMapping('windows', 'refresh');

      // macOS uses Cmd+R
      expect(macOSRefresh.keys).toBe('Cmd+R');
      expect(macOSRefresh.modifiers).toContain('meta');

      // Windows uses F5
      expect(windowsRefresh.keys).toBe('F5');
      expect(windowsRefresh.modifiers).toHaveLength(0);
    });
  });

  describe('Complete OS Selection Flow', () => {
    /**
     * Test: Full flow - select OS, get mappings, generate actions
     * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
     */
    it('should complete full OS selection flow for macOS', () => {
      const selectedOS: TargetOS = 'macos';

      // Step 1: Get all mappings for selected OS
      const mappings = getOSKeyMappings(selectedOS);
      expect(mappings).toBeDefined();

      // Step 2: Generate script actions for common operations
      const copyAction = shortcutToScriptAction(selectedOS, 'copy', 0);
      const pasteAction = shortcutToScriptAction(selectedOS, 'paste', 0.5);
      const saveAction = shortcutToScriptAction(selectedOS, 'save', 1.0);

      // Step 3: Verify all actions use macOS-specific modifiers
      expect(copyAction.modifiers).toContain('meta');
      expect(pasteAction.modifiers).toContain('meta');
      expect(saveAction.modifiers).toContain('meta');

      // Step 4: Verify key codes are valid for macOS
      expect(isValidKeyForOS(copyAction.key, selectedOS)).toBe(true);
      expect(isValidKeyForOS(pasteAction.key, selectedOS)).toBe(true);
      expect(isValidKeyForOS(saveAction.key, selectedOS)).toBe(true);
    });

    it('should complete full OS selection flow for Windows', () => {
      const selectedOS: TargetOS = 'windows';

      // Step 1: Get all mappings for selected OS
      const mappings = getOSKeyMappings(selectedOS);
      expect(mappings).toBeDefined();

      // Step 2: Generate script actions for common operations
      const copyAction = shortcutToScriptAction(selectedOS, 'copy', 0);
      const pasteAction = shortcutToScriptAction(selectedOS, 'paste', 0.5);
      const saveAction = shortcutToScriptAction(selectedOS, 'save', 1.0);

      // Step 3: Verify all actions use Windows-specific modifiers
      expect(copyAction.modifiers).toContain('ctrl');
      expect(pasteAction.modifiers).toContain('ctrl');
      expect(saveAction.modifiers).toContain('ctrl');

      // Step 4: Verify key codes are valid for Windows
      expect(isValidKeyForOS(copyAction.key, selectedOS)).toBe(true);
      expect(isValidKeyForOS(pasteAction.key, selectedOS)).toBe(true);
      expect(isValidKeyForOS(saveAction.key, selectedOS)).toBe(true);
    });

    it('should complete full OS selection flow for Universal', () => {
      const selectedOS: TargetOS = 'universal';

      // Step 1: Get all mappings for selected OS
      const mappings = getOSKeyMappings(selectedOS);
      expect(mappings).toBeDefined();

      // Step 2: Generate script actions for common operations
      const copyAction = shortcutToScriptAction(selectedOS, 'copy', 0);
      const pasteAction = shortcutToScriptAction(selectedOS, 'paste', 0.5);
      const saveAction = shortcutToScriptAction(selectedOS, 'save', 1.0);

      // Step 3: Verify all actions use no modifiers (cross-platform)
      expect(copyAction.modifiers).toHaveLength(0);
      expect(pasteAction.modifiers).toHaveLength(0);
      expect(saveAction.modifiers).toHaveLength(0);

      // Step 4: Verify key codes are generic action names
      expect(copyAction.key).toBe('copy');
      expect(pasteAction.key).toBe('paste');
      expect(saveAction.key).toBe('save');
    });
  });
});
