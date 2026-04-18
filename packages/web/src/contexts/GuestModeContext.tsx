/**
 * Guest Mode Context for GeniusQA Web
 * Provides local script management for anonymous users
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { scriptExecutor } from '../services/scriptExecutor';

interface Script {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
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
  runScript: (id: string) => Promise<void>;
  exportScript: (id: string, format: 'json' | 'javascript' | 'python') => void;
  exportAllScripts: (format: 'json' | 'javascript' | 'python') => void;
  importScript: (scriptData: any) => boolean;
}

const GuestModeContext = createContext<GuestModeContextType | undefined>(undefined);

const GUEST_SCRIPTS_KEY = 'geniusqa_web_guest_scripts';
const GUEST_PROMPT_DISMISSED_KEY = 'geniusqa_web_guest_prompt_dismissed';
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

  // Load scripts from localStorage on mount
  useEffect(() => {
    try {
      const savedScripts = localStorage.getItem(GUEST_SCRIPTS_KEY);
      if (savedScripts) {
        setScripts(JSON.parse(savedScripts));
      }
    } catch (error) {
      console.error('Failed to load guest scripts:', error);
    }
  }, []);

  // Save scripts to localStorage whenever scripts change
  useEffect(() => {
    try {
      const scriptsJson = JSON.stringify(scripts);
      localStorage.setItem(GUEST_SCRIPTS_KEY, scriptsJson);
      setStorageError(null);
    } catch (error) {
      console.error('Failed to save guest scripts:', error);
      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
          setStorageError('Storage quota exceeded. Please delete some scripts or create an account for unlimited storage.');
        } else {
          setStorageError('Failed to save scripts to local storage. Your changes may not persist.');
        }
      }
    }
  }, [scripts]);
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
      alert(`Guest mode is limited to ${MAX_GUEST_SCRIPTS} scripts. Please create an account to save more scripts.`);
      return;
    }

    const newScript: Script = {
      ...scriptData,
      id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setScripts(prev => [...prev, newScript]);
  };

  const updateScript = (id: string, updates: Partial<Script>) => {
    setScripts(prev => prev.map(script =>
      script.id === id
        ? { ...script, ...updates, updatedAt: new Date().toISOString() }
        : script
    ));
  };

  const deleteScript = (id: string) => {
    setScripts(prev => prev.filter(script => script.id !== id));
  };

  const getScript = (id: string) => {
    return scripts.find(script => script.id === id);
  };

  const dismissUpgradePrompt = () => {
    setShowUpgradePrompt(false);
    localStorage.setItem(GUEST_PROMPT_DISMISSED_KEY, Date.now().toString());
  };

  const runScript = async (id: string) => {
    const script = getScript(id);
    if (!script) {
      throw new Error('Script not found');
    }

    const result = await scriptExecutor.executeScript(script.content);
    if (!result.success) {
      throw new Error(result.message);
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

    switch (format) {
      case 'json':
        content = JSON.stringify(script, null, 2);
        filename = `${script.name}.json`;
        break;
      case 'javascript':
        content = `// Generated script: ${script.name}`;
        filename = `${script.name}.js`;
        break;
      case 'python':
        content = `# Generated script: ${script.name}`;
        filename = `${script.name}.py`;
        break;
      default:
        alert('Unsupported export format');
        return;
    }

    // Create download link for web
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAllScripts = (format: 'json' | 'javascript' | 'python') => {
    if (scripts.length === 0) {
      alert('No scripts to export');
      return;
    }

    const content = JSON.stringify(scripts, null, 2);
    const filename = `geniusqa_scripts_${new Date().toISOString().split('T')[0]}.json`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importScript = (scriptData: any): boolean => {
    try {
      if (!scriptData || typeof scriptData !== 'object') {
        throw new Error('Invalid script data format');
      }

      if (scriptData.name && scriptData.content) {
        addScript({
          name: scriptData.name,
          content: scriptData.content || ''
        });
        return true;
      }

      throw new Error('Script data must contain name and content fields');
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
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
    runScript,
    exportScript,
    exportAllScripts,
    importScript,
  };

  return (
    <GuestModeContext.Provider value={value}>
      {children}
    </GuestModeContext.Provider>
  );
};
