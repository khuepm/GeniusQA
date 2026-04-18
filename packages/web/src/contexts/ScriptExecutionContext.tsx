import React, { createContext, useContext, useState, useCallback } from 'react';
import { scriptExecutor, ExecutionResult, StepResult } from '../services/scriptExecutor';

interface ExecutionState {
  isExecuting: boolean;
  currentScript?: {
    id: string;
    name: string;
  };
  progress: {
    current: number;
    total: number;
  };
  stepResults: StepResult[];
  lastResult?: ExecutionResult;
}

interface ScriptExecutionContextType {
  executionState: ExecutionState;
  executeScript: (scriptId: string, scriptName: string, scriptContent: string) => Promise<ExecutionResult>;
  stopExecution: () => void;
  clearResults: () => void;
}

const ScriptExecutionContext = createContext<ScriptExecutionContextType | undefined>(undefined);

export const useScriptExecution = () => {
  const context = useContext(ScriptExecutionContext);
  if (!context) {
    throw new Error('useScriptExecution must be used within a ScriptExecutionProvider');
  }
  return context;
};

export const ScriptExecutionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isExecuting: false,
    progress: { current: 0, total: 0 },
    stepResults: []
  });

  const executeScript = useCallback(async (
    scriptId: string,
    scriptName: string,
    scriptContent: string
  ): Promise<ExecutionResult> => {
    if (executionState.isExecuting) {
      return {
        success: false,
        message: 'Another script is already running',
        error: 'ALREADY_RUNNING'
      };
    }

    // Reset state
    setExecutionState({
      isExecuting: true,
      currentScript: { id: scriptId, name: scriptName },
      progress: { current: 0, total: 0 },
      stepResults: []
    });

    try {
      const result = await scriptExecutor.executeScript(scriptContent, {
        onProgress: (current, total) => {
          setExecutionState(prev => ({
            ...prev,
            progress: { current, total }
          }));
        },
        onStepComplete: (stepResult) => {
          setExecutionState(prev => ({
            ...prev,
            stepResults: [...prev.stepResults, stepResult]
          }));
        }
      });

      setExecutionState(prev => ({
        ...prev,
        isExecuting: false,
        lastResult: result
      }));

      return result;
    } catch (error) {
      const errorResult: ExecutionResult = {
        success: false,
        message: 'Unexpected error during execution',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };

      setExecutionState(prev => ({
        ...prev,
        isExecuting: false,
        lastResult: errorResult
      }));

      return errorResult;
    }
  }, [executionState.isExecuting]);

  const stopExecution = useCallback(() => {
    scriptExecutor.stop();
    setExecutionState(prev => ({
      ...prev,
      isExecuting: false
    }));
  }, []);

  const clearResults = useCallback(() => {
    setExecutionState(prev => ({
      ...prev,
      stepResults: [],
      lastResult: undefined,
      progress: { current: 0, total: 0 }
    }));
  }, []);

  const value = {
    executionState,
    executeScript,
    stopExecution,
    clearResults
  };

  return (
    <ScriptExecutionContext.Provider value={value}>
      {children}
    </ScriptExecutionContext.Provider>
  );
};
