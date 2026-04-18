import React from 'react';
import { X, Play, Square, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useScriptExecution } from '../contexts/ScriptExecutionContext';

interface ScriptExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScriptExecutionModal: React.FC<ScriptExecutionModalProps> = ({ isOpen, onClose }) => {
  const { executionState, stopExecution, clearResults } = useScriptExecution();

  if (!isOpen) return null;

  const handleClose = () => {
    if (executionState.isExecuting) {
      stopExecution();
    }
    clearResults();
    onClose();
  };

  const getStepIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const progressPercentage = executionState.progress.total > 0
    ? (executionState.progress.current / executionState.progress.total) * 100
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {executionState.isExecuting ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="font-semibold text-gray-900">Running Script</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Play className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-900">Script Execution</span>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Script Info */}
          {executionState.currentScript && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">
                {executionState.currentScript.name}
              </h3>

              {/* Progress Bar */}
              {executionState.progress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Progress</span>
                    <span>{executionState.progress.current} / {executionState.progress.total} steps</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step Results */}
          <div className="flex-1 overflow-y-auto p-6">
            {executionState.stepResults.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 mb-3">Execution Log</h4>
                {executionState.stepResults.map((result, index) => (
                  <div
                    key={result.stepId}
                    className={`flex items-start space-x-3 p-3 rounded-lg ${result.success ? 'bg-green-50' : 'bg-red-50'
                      }`}
                  >
                    {getStepIcon(result.success)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'
                          }`}>
                          Step {index + 1}
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'
                        }`}>
                        {result.message}
                      </p>
                      {result.error && (
                        <p className="text-xs text-red-600 mt-1">
                          Error: {result.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : executionState.isExecuting ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Preparing to execute script...</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Ready to execute script</p>
              </div>
            )}

            {/* Final Result */}
            {executionState.lastResult && !executionState.isExecuting && (
              <div className={`mt-6 p-4 rounded-lg ${executionState.lastResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                <div className="flex items-center space-x-2">
                  {executionState.lastResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <h4 className={`font-medium ${executionState.lastResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                    {executionState.lastResult.success ? 'Execution Completed' : 'Execution Failed'}
                  </h4>
                </div>
                <p className={`text-sm mt-1 ${executionState.lastResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                  {executionState.lastResult.message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          {executionState.isExecuting ? (
            <button
              onClick={stopExecution}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
