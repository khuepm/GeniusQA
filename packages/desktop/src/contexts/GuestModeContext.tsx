/**
 * Guest Mode Context for GeniusQA Desktop
 * Provides local script management for anonymous users
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

// Electron API type declarations
declare global {
  interface Window {
    electronAPI?: {
      saveFile: (options: {
        content: string;
        defaultPath: string;
        filters: Array<{ name: string; extensions: string[] }>;
      }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    };
  }
}

interface Script {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface StorageInfo {
  used: number;
  available: number;
  total: number;
  usagePercent: number;
}

interface GuestModeContextType {
  isGuestMode: boolean;
  scripts: Script[];
  addScript: (script: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateScript: (id: string, updates: Partial<Script>) => void;
  deleteScript: (id: string) => void;
  getScript: (id: string) => Script | undefined;
  scriptCount: number;
  maxScripts: number;
  storageUsagePercent: number;
  showUpgradePrompt: boolean;
  dismissUpgradePrompt: () => void;
  canRecordMore: boolean;
  storageError: string | null;
  exportScript: (id: string, format: 'json' | 'javascript' | 'python') => void;
  exportAllScripts: (format: 'json' | 'javascript' | 'python') => void;
  exportSelectedScripts: (scriptIds: string[], format: 'json' | 'javascript' | 'python') => void;
  importScript: (scriptData: any) => boolean;
  clearStorageError: () => void;
  getStorageInfo: () => StorageInfo;
  isStorageNearFull: boolean;
}

const GuestModeContext = createContext<GuestModeContextType | undefined>(undefined);

const GUEST_SCRIPTS_KEY = 'geniusqa_desktop_guest_scripts';
const GUEST_PROMPT_DISMISSED_KEY = 'geniusqa_desktop_guest_prompt_dismissed';
const MAX_GUEST_SCRIPTS = 50;

export const useGuestMode = () => {
  const context = useContext(GuestModeContext);
  if (!context) {
    throw new Error('useGuestMode must be used within a GuestModeProvider');
  }
  return context;
};

export const GuestModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Enhanced storage quota handling
  const getStorageInfo = (): StorageInfo => {
    try {
      const scriptsJson = JSON.stringify(scripts);
      const used = new Blob([scriptsJson]).size;

      // Estimate available storage (localStorage typically has 5-10MB limit)
      // We'll use a conservative estimate of 5MB
      const total = 5 * 1024 * 1024; // 5MB in bytes
      const available = Math.max(0, total - used);
      const usagePercent = Math.round((used / total) * 100);

      return {
        used,
        available,
        total,
        usagePercent
      };
    } catch (error) {
      console.error('Failed to calculate storage info:', error);
      return {
        used: 0,
        available: 0,
        total: 0,
        usagePercent: 0
      };
    }
  };

  const clearStorageError = () => {
    setStorageError(null);
  };

  const isStorageNearFull = getStorageInfo().usagePercent >= 80;

  // Load scripts from localStorage on mount
  useEffect(() => {
    try {
      const savedScripts = localStorage.getItem(GUEST_SCRIPTS_KEY);
      if (savedScripts) {
        setScripts(JSON.parse(savedScripts));
      }
    } catch (error) {
      console.error('Failed to load guest scripts:', error);
      setStorageError('Failed to load saved scripts. Please refresh the app.');
    }
  }, []);

  // Save scripts to localStorage whenever scripts change
  useEffect(() => {
    try {
      const scriptsJson = JSON.stringify(scripts);

      // Check if we're approaching storage limits before saving
      const storageInfo = getStorageInfo();
      if (storageInfo.usagePercent >= 90) {
        setStorageError('Storage is nearly full. Consider deleting some scripts or creating an account for unlimited storage.');
      }

      localStorage.setItem(GUEST_SCRIPTS_KEY, scriptsJson);

      // Clear any previous storage errors on successful save
      if (storageError && storageError.includes('quota')) {
        setStorageError(null);
      }
    } catch (error) {
      console.error('Failed to save guest scripts:', error);
      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
          setStorageError('Storage quota exceeded. Please delete some scripts or create an account for unlimited storage.');
        } else if (error.message.includes('storage')) {
          setStorageError('Storage error occurred. Your changes may not persist. Try restarting the app.');
        } else {
          setStorageError('Failed to save scripts to local storage. Your changes may not persist.');
        }
      }
    }
  }, [scripts, storageError]);

  // Check if we should show upgrade prompt
  useEffect(() => {
    const dismissed = localStorage.getItem(GUEST_PROMPT_DISMISSED_KEY);
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    // Show prompt if user has 3+ scripts and hasn't dismissed in last 30 days
    if (scripts.length >= 3 && dismissedTime < thirtyDaysAgo) {
      setShowUpgradePrompt(true);
    }
  }, [scripts.length]);

  const addScript = (scriptData: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (scripts.length >= MAX_GUEST_SCRIPTS) {
      setStorageError(`Guest mode is limited to ${MAX_GUEST_SCRIPTS} scripts. Please create an account to save more scripts.`);
      return;
    }

    // Check storage before adding new script
    const storageInfo = getStorageInfo();
    if (storageInfo.usagePercent >= 95) {
      setStorageError('Storage is nearly full. Please delete some scripts before adding new ones, or create an account for unlimited storage.');
      return;
    }

    const newScript: Script = {
      ...scriptData,
      id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Test if we can save the new script by attempting to stringify it
      const testScripts = [...scripts, newScript];
      JSON.stringify(testScripts);

      // If we get here, the script should fit in storage
      setScripts(testScripts);

      // Clear any storage warnings if we successfully added a script
      if (storageError && storageError.includes('nearly full')) {
        setStorageError(null);
      }
    } catch (error) {
      console.error('Failed to add script due to storage constraints:', error);
      if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message.includes('quota'))) {
        setStorageError('Cannot add script: Storage quota exceeded. Please delete some scripts or create an account for unlimited storage.');
      } else {
        setStorageError('Cannot add script: Storage error occurred. Please try again or delete some scripts.');
      }
    }
  };

  const updateScript = (id: string, updates: Partial<Script>) => {
    try {
      const updatedScripts = scripts.map(script =>
        script.id === id
          ? { ...script, ...updates, updatedAt: new Date().toISOString() }
          : script
      );

      // Test if we can save the updated scripts
      JSON.stringify(updatedScripts);

      setScripts(updatedScripts);
    } catch (error) {
      console.error('Failed to update script due to storage constraints:', error);
      if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message.includes('quota'))) {
        setStorageError('Cannot update script: Storage quota exceeded. Please delete some scripts or create an account for unlimited storage.');
      } else {
        setStorageError('Cannot update script: Storage error occurred. Please try again.');
      }
    }
  };

  const deleteScript = (id: string) => {
    setScripts(prev => prev.filter(script => script.id !== id));

    // Clear storage errors when user deletes scripts
    if (storageError && (storageError.includes('quota') || storageError.includes('nearly full'))) {
      const newStorageInfo = getStorageInfo();
      if (newStorageInfo.usagePercent < 80) {
        setStorageError(null);
      }
    }
  };

  const getScript = (id: string) => {
    return scripts.find(script => script.id === id);
  };

  const dismissUpgradePrompt = () => {
    setShowUpgradePrompt(false);
    try {
      localStorage.setItem(GUEST_PROMPT_DISMISSED_KEY, Date.now().toString());
    } catch (error) {
      console.error('Failed to save prompt dismissal:', error);
      // Non-critical error, don't show to user
    }
  };

  const exportScript = (id: string, format: 'json' | 'javascript' | 'python') => {
    const script = getScript(id);
    if (!script) {
      alert('Script not found');
      return;
    }

    let content: string;
    let filename: string;
    let fileExtension: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(script, null, 2);
        filename = `${script.name}.json`;
        fileExtension = 'json';
        break;
      case 'javascript':
        content = generateJavaScriptCode(script);
        filename = `${script.name}.js`;
        fileExtension = 'js';
        break;
      case 'python':
        content = generatePythonCode(script);
        filename = `${script.name}.py`;
        fileExtension = 'py';
        break;
      default:
        alert('Unsupported export format');
        return;
    }

    // For desktop app, use Electron's dialog API to save file
    if (window.electronAPI && window.electronAPI.saveFile) {
      window.electronAPI.saveFile({
        content,
        defaultPath: filename,
        filters: [
          { name: `${format.toUpperCase()} Files`, extensions: [fileExtension] },
          { name: 'All Files', extensions: ['*'] }
        ]
      }).then((result: { success: boolean; filePath?: string; error?: string }) => {
        if (result.success) {
          alert(`Script exported successfully to ${result.filePath}`);
        } else {
          alert(`Export failed: ${result.error || 'Unknown error'}`);
        }
      }).catch((error: Error) => {
        console.error('Export failed:', error);
        alert(`Export failed: ${error.message}`);
      });
    } else {
      // Fallback for development or if Electron API is not available
      console.log('Exporting script:', filename, content);
      alert(`Script would be exported as ${filename} (Electron API not available)`);
    }
  };

  const exportAllScripts = (format: 'json' | 'javascript' | 'python') => {
    if (scripts.length === 0) {
      alert('No scripts to export');
      return;
    }

    let content: string;
    let filename: string;
    let fileExtension: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(scripts, null, 2);
        filename = `geniusqa_scripts_${new Date().toISOString().split('T')[0]}.json`;
        fileExtension = 'json';
        break;
      case 'javascript':
        content = scripts.map(script => generateJavaScriptCode(script)).join('\n\n');
        filename = `geniusqa_scripts_${new Date().toISOString().split('T')[0]}.js`;
        fileExtension = 'js';
        break;
      case 'python':
        content = scripts.map(script => generatePythonCode(script)).join('\n\n');
        filename = `geniusqa_scripts_${new Date().toISOString().split('T')[0]}.py`;
        fileExtension = 'py';
        break;
      default:
        alert('Unsupported export format');
        return;
    }

    // For desktop app, use Electron's dialog API to save file
    if (window.electronAPI && window.electronAPI.saveFile) {
      window.electronAPI.saveFile({
        content,
        defaultPath: filename,
        filters: [
          { name: `${format.toUpperCase()} Files`, extensions: [fileExtension] },
          { name: 'All Files', extensions: ['*'] }
        ]
      }).then((result: { success: boolean; filePath?: string; error?: string }) => {
        if (result.success) {
          alert(`All scripts exported successfully to ${result.filePath}`);
        } else {
          alert(`Export failed: ${result.error || 'Unknown error'}`);
        }
      }).catch((error: Error) => {
        console.error('Export failed:', error);
        alert(`Export failed: ${error.message}`);
      });
    } else {
      // Fallback for development or if Electron API is not available
      console.log('Exporting all scripts:', filename, content);
      alert(`All scripts would be exported as ${filename} (Electron API not available)`);
    }
  };

  const exportSelectedScripts = (scriptIds: string[], format: 'json' | 'javascript' | 'python') => {
    if (scriptIds.length === 0) {
      alert('No scripts selected for export');
      return;
    }

    const selectedScripts = scripts.filter(script => scriptIds.includes(script.id));
    if (selectedScripts.length === 0) {
      alert('Selected scripts not found');
      return;
    }

    let content: string;
    let filename: string;
    let fileExtension: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(selectedScripts, null, 2);
        filename = `geniusqa_selected_scripts_${new Date().toISOString().split('T')[0]}.json`;
        fileExtension = 'json';
        break;
      case 'javascript':
        content = selectedScripts.map(script => generateJavaScriptCode(script)).join('\n\n');
        filename = `geniusqa_selected_scripts_${new Date().toISOString().split('T')[0]}.js`;
        fileExtension = 'js';
        break;
      case 'python':
        content = selectedScripts.map(script => generatePythonCode(script)).join('\n\n');
        filename = `geniusqa_selected_scripts_${new Date().toISOString().split('T')[0]}.py`;
        fileExtension = 'py';
        break;
      default:
        alert('Unsupported export format');
        return;
    }

    // For desktop app, use Electron's dialog API to save file
    if (window.electronAPI && window.electronAPI.saveFile) {
      window.electronAPI.saveFile({
        content,
        defaultPath: filename,
        filters: [
          { name: `${format.toUpperCase()} Files`, extensions: [fileExtension] },
          { name: 'All Files', extensions: ['*'] }
        ]
      }).then((result: { success: boolean; filePath?: string; error?: string }) => {
        if (result.success) {
          alert(`Selected scripts exported successfully to ${result.filePath}`);
        } else {
          alert(`Export failed: ${result.error || 'Unknown error'}`);
        }
      }).catch((error: Error) => {
        console.error('Export failed:', error);
        alert(`Export failed: ${error.message}`);
      });
    } else {
      // Fallback for development or if Electron API is not available
      console.log('Exporting selected scripts:', filename, content);
      alert(`Selected scripts would be exported as ${filename} (Electron API not available)`);
    }
  };

  const importScript = (scriptData: any): boolean => {
    try {
      // Comprehensive validation with clear error messages
      const validationResult = validateImportData(scriptData);
      if (!validationResult.isValid) {
        alert(`Import failed:\n${validationResult.errors.join('\n')}`);
        return false;
      }

      // Handle single script import
      if (validationResult.type === 'single') {
        if (scripts.length >= MAX_GUEST_SCRIPTS) {
          alert(`Import failed: Guest mode is limited to ${MAX_GUEST_SCRIPTS} scripts. Please delete some scripts or create an account for unlimited storage.`);
          return false;
        }

        addScript({
          name: validationResult.data.name,
          content: validationResult.data.content || ''
        });
        return true;
      }

      // Handle multiple scripts import
      if (validationResult.type === 'multiple') {
        const scriptsToImport = validationResult.data as any[];
        let importedCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < scriptsToImport.length; i++) {
          const script = scriptsToImport[i];

          if (scripts.length + importedCount >= MAX_GUEST_SCRIPTS) {
            alert(`Import stopped: Guest mode limit of ${MAX_GUEST_SCRIPTS} scripts reached. ${importedCount} scripts were imported successfully.`);
            break;
          }

          try {
            addScript({
              name: script.name,
              content: script.content || ''
            });
            importedCount++;
          } catch (error) {
            errors.push(`Script "${script.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        if (errors.length > 0) {
          alert(`Import completed with warnings:\n${importedCount} scripts imported successfully.\n\nErrors:\n${errors.join('\n')}`);
        }

        return importedCount > 0;
      }

      return false;
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unexpected error occurred during import'}`);
      return false;
    }
  };

  // Comprehensive validation function for import data
  const validateImportData = (data: any): {
    isValid: boolean;
    errors: string[];
    type?: 'single' | 'multiple';
    data?: any;
  } => {
    const errors: string[] = [];

    // Check if data exists and is an object
    if (!data) {
      errors.push('No data provided for import');
      return { isValid: false, errors };
    }

    if (typeof data !== 'object') {
      errors.push('Import data must be a valid JSON object or array');
      return { isValid: false, errors };
    }

    // Handle array of scripts (multiple import)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        errors.push('Import array is empty - no scripts to import');
        return { isValid: false, errors };
      }

      if (data.length > MAX_GUEST_SCRIPTS) {
        errors.push(`Too many scripts in import file (${data.length}). Guest mode supports maximum ${MAX_GUEST_SCRIPTS} scripts.`);
        return { isValid: false, errors };
      }

      // Validate each script in the array
      const validScripts: any[] = [];
      for (let i = 0; i < data.length; i++) {
        const script = data[i];
        const scriptErrors: string[] = [];

        if (!script || typeof script !== 'object') {
          scriptErrors.push(`Script ${i + 1}: Invalid script format - must be an object`);
        } else {
          // Validate required fields
          if (!script.name) {
            scriptErrors.push(`Script ${i + 1}: Missing required 'name' field`);
          } else if (typeof script.name !== 'string') {
            scriptErrors.push(`Script ${i + 1}: 'name' field must be a string`);
          } else if (script.name.trim().length === 0) {
            scriptErrors.push(`Script ${i + 1}: 'name' field cannot be empty`);
          } else if (script.name.length > 100) {
            scriptErrors.push(`Script ${i + 1}: 'name' field is too long (maximum 100 characters)`);
          }

          // Content field validation (optional but if present, must be string)
          if (script.content !== undefined && typeof script.content !== 'string') {
            scriptErrors.push(`Script ${i + 1}: 'content' field must be a string if provided`);
          }

          // Check for duplicate names within the import
          const duplicateIndex = validScripts.findIndex(s => s.name === script.name);
          if (duplicateIndex !== -1) {
            scriptErrors.push(`Script ${i + 1}: Duplicate script name "${script.name}" (also found at position ${duplicateIndex + 1})`);
          }

          // Check if script name already exists in current scripts
          const existingScript = scripts.find(s => s.name === script.name);
          if (existingScript) {
            scriptErrors.push(`Script ${i + 1}: A script with name "${script.name}" already exists`);
          }
        }

        if (scriptErrors.length > 0) {
          errors.push(...scriptErrors);
        } else {
          validScripts.push({
            name: script.name.trim(),
            content: script.content || ''
          });
        }
      }

      if (errors.length > 0) {
        return { isValid: false, errors };
      }

      return {
        isValid: true,
        errors: [],
        type: 'multiple',
        data: validScripts
      };
    }

    // Handle single script import
    const scriptErrors: string[] = [];

    // Validate required fields for single script
    if (!data.name) {
      scriptErrors.push('Missing required \'name\' field');
    } else if (typeof data.name !== 'string') {
      scriptErrors.push('\'name\' field must be a string');
    } else if (data.name.trim().length === 0) {
      scriptErrors.push('\'name\' field cannot be empty');
    } else if (data.name.length > 100) {
      scriptErrors.push('\'name\' field is too long (maximum 100 characters)');
    }

    // Content field validation (optional but if present, must be string)
    if (data.content !== undefined && typeof data.content !== 'string') {
      scriptErrors.push('\'content\' field must be a string if provided');
    }

    // Check if script name already exists
    const existingScript = scripts.find(s => s.name === data.name);
    if (existingScript) {
      scriptErrors.push(`A script with name "${data.name}" already exists`);
    }

    if (scriptErrors.length > 0) {
      return { isValid: false, errors: scriptErrors };
    }

    return {
      isValid: true,
      errors: [],
      type: 'single',
      data: {
        name: data.name.trim(),
        content: data.content || ''
      }
    };
  };

  // Helper function to generate JavaScript code from script
  const generateJavaScriptCode = (script: Script): string => {
    let parsedContent;
    try {
      parsedContent = JSON.parse(script.content);
    } catch {
      parsedContent = null;
    }

    const functionName = script.name.replace(/[^a-zA-Z0-9]/g, '_');

    if (Array.isArray(parsedContent)) {
      // Generate code based on parsed script steps
      const steps = parsedContent.map((step: any, index: number) => {
        switch (step.action) {
          case 'navigate':
            return `  // Step ${index + 1}: Navigate to ${step.target}
  await page.goto('${step.value}');
  await page.waitForTimeout(${step.delay || 1000});`;
          case 'click':
            return `  // Step ${index + 1}: Click ${step.target}
  await page.click('[data-testid="${step.target}"], #${step.target}, .${step.target}');
  await page.waitForTimeout(${step.delay || 500});`;
          case 'type':
            return `  // Step ${index + 1}: Type in ${step.target}
  await page.fill('[data-testid="${step.target}"], #${step.target}, .${step.target}', '${step.value}');
  await page.waitForTimeout(${step.delay || 300});`;
          case 'wait':
            return `  // Step ${index + 1}: Wait for ${step.target}
  await page.waitForSelector('[data-testid="${step.target}"], #${step.target}, .${step.target}', { timeout: ${step.value || 5000} });`;
          case 'scroll':
            return `  // Step ${index + 1}: Scroll to ${step.target}
  await page.locator('[data-testid="${step.target}"], #${step.target}, .${step.target}').scrollIntoViewIfNeeded();
  await page.waitForTimeout(${step.delay || 500});`;
          default:
            return `  // Step ${index + 1}: ${step.action} on ${step.target}
  // TODO: Implement ${step.action} action
  await page.waitForTimeout(${step.delay || 500});`;
        }
      }).join('\n\n');

      return `// Generated by GeniusQA - ${script.name}
// Created: ${new Date(script.createdAt).toLocaleString()}
// This script uses Playwright for browser automation

const { chromium } = require('playwright');

async function ${functionName}() {
  console.log('Starting script: ${script.name}');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
${steps}
    
    console.log('Script execution completed successfully');
  } catch (error) {
    console.error('Script execution failed:', error);
  } finally {
    await browser.close();
  }
}

// Execute the script
${functionName}().catch(console.error);`;
    } else {
      // Fallback template for non-structured content
      return `// Generated by GeniusQA - ${script.name}
// Created: ${new Date(script.createdAt).toLocaleString()}
// This script uses Playwright for browser automation

const { chromium } = require('playwright');

async function ${functionName}() {
  console.log('Starting script: ${script.name}');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Script content:
    // ${script.content.split('\n').join('\n    // ')}
    
    // TODO: Implement actual automation logic here
    // Example:
    // await page.goto('https://example.com');
    // await page.click('#login-button');
    // await page.fill('#username', 'your-username');
    // await page.fill('#password', 'your-password');
    // await page.click('#submit');
    
    console.log('Script execution completed');
  } catch (error) {
    console.error('Script execution failed:', error);
  } finally {
    await browser.close();
  }
}

// Execute the script
${functionName}().catch(console.error);`;
    }
  };

  // Helper function to generate Python code from script
  const generatePythonCode = (script: Script): string => {
    let parsedContent;
    try {
      parsedContent = JSON.parse(script.content);
    } catch {
      parsedContent = null;
    }

    const functionName = script.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    if (Array.isArray(parsedContent)) {
      // Generate code based on parsed script steps
      const steps = parsedContent.map((step: any, index: number) => {
        switch (step.action) {
          case 'navigate':
            return `    # Step ${index + 1}: Navigate to ${step.target}
    driver.get('${step.value}')
    time.sleep(${(step.delay || 1000) / 1000})`;
          case 'click':
            return `    # Step ${index + 1}: Click ${step.target}
    element = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="${step.target}"], #${step.target}, .${step.target}'))
    )
    element.click()
    time.sleep(${(step.delay || 500) / 1000})`;
          case 'type':
            return `    # Step ${index + 1}: Type in ${step.target}
    element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="${step.target}"], #${step.target}, .${step.target}'))
    )
    element.clear()
    element.send_keys('${step.value}')
    time.sleep(${(step.delay || 300) / 1000})`;
          case 'wait':
            return `    # Step ${index + 1}: Wait for ${step.target}
    WebDriverWait(driver, ${(parseInt(step.value) || 5000) / 1000}).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="${step.target}"], #${step.target}, .${step.target}'))
    )`;
          case 'scroll':
            return `    # Step ${index + 1}: Scroll to ${step.target}
    element = driver.find_element(By.CSS_SELECTOR, '[data-testid="${step.target}"], #${step.target}, .${step.target}')
    driver.execute_script("arguments[0].scrollIntoView();", element)
    time.sleep(${(step.delay || 500) / 1000})`;
          default:
            return `    # Step ${index + 1}: ${step.action} on ${step.target}
    # TODO: Implement ${step.action} action
    time.sleep(${(step.delay || 500) / 1000})`;
        }
      }).join('\n\n');

      return `# Generated by GeniusQA - ${script.name}
# Created: ${new Date(script.createdAt).toLocaleString()}
# This script uses Selenium WebDriver for browser automation

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

def ${functionName}():
    """
    ${script.name}
    
    Automated test script generated from GeniusQA recording
    """
    print(f"Starting script: ${script.name}")
    
    # Setup Chrome driver
    chrome_options = Options()
    # chrome_options.add_argument("--headless")  # Uncomment for headless mode
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
${steps}
        
        print("Script execution completed successfully")
    except Exception as error:
        print(f"Script execution failed: {error}")
    finally:
        driver.quit()

if __name__ == "__main__":
    ${functionName}()`;
    } else {
      // Fallback template for non-structured content
      return `# Generated by GeniusQA - ${script.name}
# Created: ${new Date(script.createdAt).toLocaleString()}
# This script uses Selenium WebDriver for browser automation

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

def ${functionName}():
    """
    ${script.name}
    
    Script content:
    ${script.content.split('\n').join('\n    ')}
    """
    print(f"Starting script: ${script.name}")
    
    # Setup Chrome driver
    chrome_options = Options()
    # chrome_options.add_argument("--headless")  # Uncomment for headless mode
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # TODO: Implement actual automation logic here
        # Example:
        # driver.get('https://example.com')
        # driver.find_element(By.ID, 'username').send_keys('your-username')
        # driver.find_element(By.ID, 'password').send_keys('your-password')
        # driver.find_element(By.ID, 'login-button').click()
        # time.sleep(2)
        
        print("Script execution completed")
    except Exception as error:
        print(f"Script execution failed: {error}")
    finally:
        driver.quit()

if __name__ == "__main__":
    ${functionName}()`;
    }
  };

  const value = {
    isGuestMode: true,
    scripts,
    addScript,
    updateScript,
    deleteScript,
    getScript,
    scriptCount: scripts.length,
    maxScripts: MAX_GUEST_SCRIPTS,
    storageUsagePercent: Math.round((scripts.length / MAX_GUEST_SCRIPTS) * 100),
    showUpgradePrompt,
    dismissUpgradePrompt,
    canRecordMore: scripts.length < MAX_GUEST_SCRIPTS,
    storageError,
    exportScript,
    exportAllScripts,
    exportSelectedScripts,
    importScript,
    clearStorageError,
    getStorageInfo,
    isStorageNearFull,
  };

  return (
    <GuestModeContext.Provider value={value}>
      {children}
    </GuestModeContext.Provider>
  );
};
