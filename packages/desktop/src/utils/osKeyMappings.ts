/**
 * OS Key Mappings Utility
 * 
 * Defines keyboard shortcut mappings for different operating systems.
 * Used by AI Script Builder to generate OS-appropriate keyboard actions.
 * 
 * Requirements: 8.3, 8.4, 8.5
 */

import { TargetOS } from '../components/OSSelector';

/**
 * Common shortcut action names
 */
export type ShortcutAction =
  | 'copy'
  | 'paste'
  | 'cut'
  | 'selectAll'
  | 'save'
  | 'undo'
  | 'redo'
  | 'find'
  | 'findReplace'
  | 'new'
  | 'open'
  | 'close'
  | 'quit'
  | 'print'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'refresh'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'
  | 'fullscreen'
  | 'minimize'
  | 'switchApp'
  | 'switchWindow'
  | 'screenshot'
  | 'screenshotRegion'
  | 'delete'
  | 'forceQuit';

/**
 * Key mapping entry with display name and key combination
 */
export interface KeyMapping {
  /** Human-readable display name */
  displayName: string;
  /** Key combination string (e.g., "Cmd+C", "Ctrl+C") */
  keys: string;
  /** Individual key codes for script generation */
  keyCodes: string[];
  /** Modifier keys required */
  modifiers: string[];
}

/**
 * OS-specific key mappings
 * Requirements: 8.3, 8.4, 8.5
 */
export const OS_KEY_MAPPINGS: Record<TargetOS, Record<ShortcutAction, KeyMapping>> = {
  /**
   * macOS key mappings (Cmd-based shortcuts)
   * Requirements: 8.3
   */
  macos: {
    copy: {
      displayName: 'Copy',
      keys: 'Cmd+C',
      keyCodes: ['c'],
      modifiers: ['meta'],
    },
    paste: {
      displayName: 'Paste',
      keys: 'Cmd+V',
      keyCodes: ['v'],
      modifiers: ['meta'],
    },
    cut: {
      displayName: 'Cut',
      keys: 'Cmd+X',
      keyCodes: ['x'],
      modifiers: ['meta'],
    },
    selectAll: {
      displayName: 'Select All',
      keys: 'Cmd+A',
      keyCodes: ['a'],
      modifiers: ['meta'],
    },
    save: {
      displayName: 'Save',
      keys: 'Cmd+S',
      keyCodes: ['s'],
      modifiers: ['meta'],
    },
    undo: {
      displayName: 'Undo',
      keys: 'Cmd+Z',
      keyCodes: ['z'],
      modifiers: ['meta'],
    },
    redo: {
      displayName: 'Redo',
      keys: 'Cmd+Shift+Z',
      keyCodes: ['z'],
      modifiers: ['meta', 'shift'],
    },
    find: {
      displayName: 'Find',
      keys: 'Cmd+F',
      keyCodes: ['f'],
      modifiers: ['meta'],
    },
    findReplace: {
      displayName: 'Find & Replace',
      keys: 'Cmd+Option+F',
      keyCodes: ['f'],
      modifiers: ['meta', 'alt'],
    },
    new: {
      displayName: 'New',
      keys: 'Cmd+N',
      keyCodes: ['n'],
      modifiers: ['meta'],
    },
    open: {
      displayName: 'Open',
      keys: 'Cmd+O',
      keyCodes: ['o'],
      modifiers: ['meta'],
    },
    close: {
      displayName: 'Close',
      keys: 'Cmd+W',
      keyCodes: ['w'],
      modifiers: ['meta'],
    },
    quit: {
      displayName: 'Quit',
      keys: 'Cmd+Q',
      keyCodes: ['q'],
      modifiers: ['meta'],
    },
    print: {
      displayName: 'Print',
      keys: 'Cmd+P',
      keyCodes: ['p'],
      modifiers: ['meta'],
    },
    bold: {
      displayName: 'Bold',
      keys: 'Cmd+B',
      keyCodes: ['b'],
      modifiers: ['meta'],
    },
    italic: {
      displayName: 'Italic',
      keys: 'Cmd+I',
      keyCodes: ['i'],
      modifiers: ['meta'],
    },
    underline: {
      displayName: 'Underline',
      keys: 'Cmd+U',
      keyCodes: ['u'],
      modifiers: ['meta'],
    },
    refresh: {
      displayName: 'Refresh',
      keys: 'Cmd+R',
      keyCodes: ['r'],
      modifiers: ['meta'],
    },
    zoomIn: {
      displayName: 'Zoom In',
      keys: 'Cmd++',
      keyCodes: ['='],
      modifiers: ['meta'],
    },
    zoomOut: {
      displayName: 'Zoom Out',
      keys: 'Cmd+-',
      keyCodes: ['-'],
      modifiers: ['meta'],
    },
    zoomReset: {
      displayName: 'Reset Zoom',
      keys: 'Cmd+0',
      keyCodes: ['0'],
      modifiers: ['meta'],
    },
    fullscreen: {
      displayName: 'Fullscreen',
      keys: 'Cmd+Ctrl+F',
      keyCodes: ['f'],
      modifiers: ['meta', 'ctrl'],
    },
    minimize: {
      displayName: 'Minimize',
      keys: 'Cmd+M',
      keyCodes: ['m'],
      modifiers: ['meta'],
    },
    switchApp: {
      displayName: 'Switch App',
      keys: 'Cmd+Tab',
      keyCodes: ['tab'],
      modifiers: ['meta'],
    },
    switchWindow: {
      displayName: 'Switch Window',
      keys: 'Cmd+`',
      keyCodes: ['`'],
      modifiers: ['meta'],
    },
    screenshot: {
      displayName: 'Screenshot',
      keys: 'Cmd+Shift+3',
      keyCodes: ['3'],
      modifiers: ['meta', 'shift'],
    },
    screenshotRegion: {
      displayName: 'Screenshot Region',
      keys: 'Cmd+Shift+4',
      keyCodes: ['4'],
      modifiers: ['meta', 'shift'],
    },
    delete: {
      displayName: 'Delete',
      keys: 'Cmd+Backspace',
      keyCodes: ['backspace'],
      modifiers: ['meta'],
    },
    forceQuit: {
      displayName: 'Force Quit',
      keys: 'Cmd+Option+Escape',
      keyCodes: ['escape'],
      modifiers: ['meta', 'alt'],
    },
  },

  /**
   * Windows key mappings (Ctrl-based shortcuts)
   * Requirements: 8.4
   */
  windows: {
    copy: {
      displayName: 'Copy',
      keys: 'Ctrl+C',
      keyCodes: ['c'],
      modifiers: ['ctrl'],
    },
    paste: {
      displayName: 'Paste',
      keys: 'Ctrl+V',
      keyCodes: ['v'],
      modifiers: ['ctrl'],
    },
    cut: {
      displayName: 'Cut',
      keys: 'Ctrl+X',
      keyCodes: ['x'],
      modifiers: ['ctrl'],
    },
    selectAll: {
      displayName: 'Select All',
      keys: 'Ctrl+A',
      keyCodes: ['a'],
      modifiers: ['ctrl'],
    },
    save: {
      displayName: 'Save',
      keys: 'Ctrl+S',
      keyCodes: ['s'],
      modifiers: ['ctrl'],
    },
    undo: {
      displayName: 'Undo',
      keys: 'Ctrl+Z',
      keyCodes: ['z'],
      modifiers: ['ctrl'],
    },
    redo: {
      displayName: 'Redo',
      keys: 'Ctrl+Y',
      keyCodes: ['y'],
      modifiers: ['ctrl'],
    },
    find: {
      displayName: 'Find',
      keys: 'Ctrl+F',
      keyCodes: ['f'],
      modifiers: ['ctrl'],
    },
    findReplace: {
      displayName: 'Find & Replace',
      keys: 'Ctrl+H',
      keyCodes: ['h'],
      modifiers: ['ctrl'],
    },
    new: {
      displayName: 'New',
      keys: 'Ctrl+N',
      keyCodes: ['n'],
      modifiers: ['ctrl'],
    },
    open: {
      displayName: 'Open',
      keys: 'Ctrl+O',
      keyCodes: ['o'],
      modifiers: ['ctrl'],
    },
    close: {
      displayName: 'Close',
      keys: 'Ctrl+W',
      keyCodes: ['w'],
      modifiers: ['ctrl'],
    },
    quit: {
      displayName: 'Quit',
      keys: 'Alt+F4',
      keyCodes: ['f4'],
      modifiers: ['alt'],
    },
    print: {
      displayName: 'Print',
      keys: 'Ctrl+P',
      keyCodes: ['p'],
      modifiers: ['ctrl'],
    },
    bold: {
      displayName: 'Bold',
      keys: 'Ctrl+B',
      keyCodes: ['b'],
      modifiers: ['ctrl'],
    },
    italic: {
      displayName: 'Italic',
      keys: 'Ctrl+I',
      keyCodes: ['i'],
      modifiers: ['ctrl'],
    },
    underline: {
      displayName: 'Underline',
      keys: 'Ctrl+U',
      keyCodes: ['u'],
      modifiers: ['ctrl'],
    },
    refresh: {
      displayName: 'Refresh',
      keys: 'F5',
      keyCodes: ['f5'],
      modifiers: [],
    },
    zoomIn: {
      displayName: 'Zoom In',
      keys: 'Ctrl++',
      keyCodes: ['='],
      modifiers: ['ctrl'],
    },
    zoomOut: {
      displayName: 'Zoom Out',
      keys: 'Ctrl+-',
      keyCodes: ['-'],
      modifiers: ['ctrl'],
    },
    zoomReset: {
      displayName: 'Reset Zoom',
      keys: 'Ctrl+0',
      keyCodes: ['0'],
      modifiers: ['ctrl'],
    },
    fullscreen: {
      displayName: 'Fullscreen',
      keys: 'F11',
      keyCodes: ['f11'],
      modifiers: [],
    },
    minimize: {
      displayName: 'Minimize',
      keys: 'Win+Down',
      keyCodes: ['down'],
      modifiers: ['meta'],
    },
    switchApp: {
      displayName: 'Switch App',
      keys: 'Alt+Tab',
      keyCodes: ['tab'],
      modifiers: ['alt'],
    },
    switchWindow: {
      displayName: 'Switch Window',
      keys: 'Ctrl+Tab',
      keyCodes: ['tab'],
      modifiers: ['ctrl'],
    },
    screenshot: {
      displayName: 'Screenshot',
      keys: 'Win+PrintScreen',
      keyCodes: ['printscreen'],
      modifiers: ['meta'],
    },
    screenshotRegion: {
      displayName: 'Screenshot Region',
      keys: 'Win+Shift+S',
      keyCodes: ['s'],
      modifiers: ['meta', 'shift'],
    },
    delete: {
      displayName: 'Delete',
      keys: 'Delete',
      keyCodes: ['delete'],
      modifiers: [],
    },
    forceQuit: {
      displayName: 'Force Quit',
      keys: 'Ctrl+Alt+Delete',
      keyCodes: ['delete'],
      modifiers: ['ctrl', 'alt'],
    },
  },

  /**
   * Universal/cross-platform key mappings
   * Uses generic action names that the playback engine will translate
   * Requirements: 8.5
   */
  universal: {
    copy: {
      displayName: 'Copy',
      keys: 'Copy',
      keyCodes: ['copy'],
      modifiers: [],
    },
    paste: {
      displayName: 'Paste',
      keys: 'Paste',
      keyCodes: ['paste'],
      modifiers: [],
    },
    cut: {
      displayName: 'Cut',
      keys: 'Cut',
      keyCodes: ['cut'],
      modifiers: [],
    },
    selectAll: {
      displayName: 'Select All',
      keys: 'SelectAll',
      keyCodes: ['selectall'],
      modifiers: [],
    },
    save: {
      displayName: 'Save',
      keys: 'Save',
      keyCodes: ['save'],
      modifiers: [],
    },
    undo: {
      displayName: 'Undo',
      keys: 'Undo',
      keyCodes: ['undo'],
      modifiers: [],
    },
    redo: {
      displayName: 'Redo',
      keys: 'Redo',
      keyCodes: ['redo'],
      modifiers: [],
    },
    find: {
      displayName: 'Find',
      keys: 'Find',
      keyCodes: ['find'],
      modifiers: [],
    },
    findReplace: {
      displayName: 'Find & Replace',
      keys: 'FindReplace',
      keyCodes: ['findreplace'],
      modifiers: [],
    },
    new: {
      displayName: 'New',
      keys: 'New',
      keyCodes: ['new'],
      modifiers: [],
    },
    open: {
      displayName: 'Open',
      keys: 'Open',
      keyCodes: ['open'],
      modifiers: [],
    },
    close: {
      displayName: 'Close',
      keys: 'Close',
      keyCodes: ['close'],
      modifiers: [],
    },
    quit: {
      displayName: 'Quit',
      keys: 'Quit',
      keyCodes: ['quit'],
      modifiers: [],
    },
    print: {
      displayName: 'Print',
      keys: 'Print',
      keyCodes: ['print'],
      modifiers: [],
    },
    bold: {
      displayName: 'Bold',
      keys: 'Bold',
      keyCodes: ['bold'],
      modifiers: [],
    },
    italic: {
      displayName: 'Italic',
      keys: 'Italic',
      keyCodes: ['italic'],
      modifiers: [],
    },
    underline: {
      displayName: 'Underline',
      keys: 'Underline',
      keyCodes: ['underline'],
      modifiers: [],
    },
    refresh: {
      displayName: 'Refresh',
      keys: 'Refresh',
      keyCodes: ['refresh'],
      modifiers: [],
    },
    zoomIn: {
      displayName: 'Zoom In',
      keys: 'ZoomIn',
      keyCodes: ['zoomin'],
      modifiers: [],
    },
    zoomOut: {
      displayName: 'Zoom Out',
      keys: 'ZoomOut',
      keyCodes: ['zoomout'],
      modifiers: [],
    },
    zoomReset: {
      displayName: 'Reset Zoom',
      keys: 'ZoomReset',
      keyCodes: ['zoomreset'],
      modifiers: [],
    },
    fullscreen: {
      displayName: 'Fullscreen',
      keys: 'Fullscreen',
      keyCodes: ['fullscreen'],
      modifiers: [],
    },
    minimize: {
      displayName: 'Minimize',
      keys: 'Minimize',
      keyCodes: ['minimize'],
      modifiers: [],
    },
    switchApp: {
      displayName: 'Switch App',
      keys: 'SwitchApp',
      keyCodes: ['switchapp'],
      modifiers: [],
    },
    switchWindow: {
      displayName: 'Switch Window',
      keys: 'SwitchWindow',
      keyCodes: ['switchwindow'],
      modifiers: [],
    },
    screenshot: {
      displayName: 'Screenshot',
      keys: 'Screenshot',
      keyCodes: ['screenshot'],
      modifiers: [],
    },
    screenshotRegion: {
      displayName: 'Screenshot Region',
      keys: 'ScreenshotRegion',
      keyCodes: ['screenshotregion'],
      modifiers: [],
    },
    delete: {
      displayName: 'Delete',
      keys: 'Delete',
      keyCodes: ['delete'],
      modifiers: [],
    },
    forceQuit: {
      displayName: 'Force Quit',
      keys: 'ForceQuit',
      keyCodes: ['forcequit'],
      modifiers: [],
    },
  },
};

/**
 * Get key mapping for a specific action and OS
 */
export function getKeyMapping(os: TargetOS, action: ShortcutAction): KeyMapping {
  return OS_KEY_MAPPINGS[os][action];
}

/**
 * Get all key mappings for a specific OS
 */
export function getOSKeyMappings(os: TargetOS): Record<ShortcutAction, KeyMapping> {
  return OS_KEY_MAPPINGS[os];
}

/**
 * Get display string for a shortcut (e.g., "Cmd+C" or "Ctrl+C")
 */
export function getShortcutDisplayString(os: TargetOS, action: ShortcutAction): string {
  return OS_KEY_MAPPINGS[os][action].keys;
}

/**
 * Get all available shortcut actions
 */
export function getAvailableShortcuts(): ShortcutAction[] {
  return Object.keys(OS_KEY_MAPPINGS.macos) as ShortcutAction[];
}

/**
 * Check if a key code is valid for a specific OS
 * Requirements: 8.3, 8.4, 8.5
 */
export function isValidKeyForOS(keyCode: string, os: TargetOS): boolean {
  const mappings = OS_KEY_MAPPINGS[os];
  const normalizedKey = keyCode.toLowerCase();
  
  // Check if the key is used in any mapping for this OS
  for (const action of Object.keys(mappings) as ShortcutAction[]) {
    const mapping = mappings[action];
    if (mapping.keyCodes.some(k => k.toLowerCase() === normalizedKey)) {
      return true;
    }
  }
  
  // Also allow common single keys
  const commonKeys = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'enter', 'return', 'tab', 'space', 'backspace', 'delete', 'escape',
    'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  ];
  
  return commonKeys.includes(normalizedKey);
}

/**
 * Convert a shortcut action to script action format
 */
export function shortcutToScriptAction(
  os: TargetOS,
  action: ShortcutAction,
  timestamp: number
): { type: 'key_press'; timestamp: number; key: string; modifiers: string[] } {
  const mapping = OS_KEY_MAPPINGS[os][action];
  return {
    type: 'key_press',
    timestamp,
    key: mapping.keyCodes[0],
    modifiers: mapping.modifiers,
  };
}

/**
 * Get the primary modifier key for an OS
 */
export function getPrimaryModifier(os: TargetOS): string {
  switch (os) {
    case 'macos':
      return 'meta'; // Cmd key
    case 'windows':
      return 'ctrl';
    case 'universal':
      return 'primary'; // Generic
  }
}

/**
 * Get human-readable modifier key name for display
 */
export function getModifierDisplayName(modifier: string, os: TargetOS): string {
  const modifierNames: Record<TargetOS, Record<string, string>> = {
    macos: {
      meta: '⌘',
      ctrl: '⌃',
      alt: '⌥',
      shift: '⇧',
    },
    windows: {
      meta: 'Win',
      ctrl: 'Ctrl',
      alt: 'Alt',
      shift: 'Shift',
    },
    universal: {
      meta: 'Super',
      ctrl: 'Ctrl',
      alt: 'Alt',
      shift: 'Shift',
      primary: 'Primary',
    },
  };
  
  return modifierNames[os][modifier] || modifier;
}
