/**
 * AIBuilderTabContent Component
 * 
 * Displays the AI Builder interface within the tab system.
 * Integrates AIChatInterface, ScriptPreview, and OSSelector components.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React, { useState, useCallback } from 'react';
import { AIChatInterface } from '../AIChatInterface';
import { ScriptPreview } from '../ScriptPreview';
import { OSSelector, TargetOS } from '../OSSelector';
import { ScriptData, ValidationResult } from '../../types/aiScriptBuilder.types';
import { AIProvider, ProviderInfo, ProviderModel } from '../../types/providerAdapter.types';
import { validateScript } from '../../services/scriptValidationService';
import './AIBuilderTabContent.css';

/**
 * Props for AIBuilderTabContent component
 */
export interface AIBuilderTabContentProps {
  /** Target OS for script generation */
  targetOS: TargetOS;
  /** Callback when OS selection changes */
  onOSChange: (os: TargetOS) => void;
  /** Callback when a script is generated */
  onScriptGenerated: (script: ScriptData) => void;
  /** Callback when a script is saved */
  onScriptSaved: () => void;
  /** Whether API key is configured */
  apiKeyConfigured: boolean;
  /** Available AI providers */
  providers?: ProviderInfo[];
  /** Currently active provider */
  activeProvider?: AIProvider | null;
  /** Callback when provider is selected */
  onProviderSelect?: (providerId: AIProvider) => void;
  /** Callback to configure a provider */
  onConfigureProvider?: (providerId: AIProvider) => void;
  /** Available models for active provider */
  models?: ProviderModel[];
  /** Currently active model */
  activeModel?: string | null;
  /** Callback when model is selected */
  onModelSelect?: (modelId: string) => void;
  /** Whether provider is loading */
  providerLoading?: boolean;
}

/**
 * AIBuilderTabContent Component
 * 
 * Main component for the AI Builder tab content area.
 * Displays chat interface, script preview, and OS selector.
 */
export const AIBuilderTabContent: React.FC<AIBuilderTabContentProps> = ({
  targetOS,
  onOSChange,
  onScriptGenerated,
  onScriptSaved,
  apiKeyConfigured,
  providers = [],
  activeProvider = null,
  onProviderSelect,
  onConfigureProvider,
  models = [],
  activeModel = null,
  onModelSelect,
  providerLoading = false,
}) => {
  // Local state for generated script preview
  const [generatedScript, setGeneratedScript] = useState<ScriptData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    valid: true,
    errors: [],
    warnings: [],
  });

  /**
   * Handle script generation from AI chat
   * Requirements: 4.4
   */
  const handleScriptGenerated = useCallback((script: ScriptData) => {
    setGeneratedScript(script);
    const validation = validateScript(script);
    setValidationResult(validation);
    onScriptGenerated(script);
  }, [onScriptGenerated]);

  /**
   * Handle script edit in preview
   */
  const handleScriptEdit = useCallback((script: ScriptData) => {
    setGeneratedScript(script);
    const validation = validateScript(script);
    setValidationResult(validation);
  }, []);

  /**
   * Handle script save
   * Requirements: 4.4
   */
  const handleScriptSave = useCallback((script: ScriptData) => {
    // Script will be saved by parent component
    onScriptSaved();
    // Clear the preview after save
    setGeneratedScript(null);
    setValidationResult({ valid: true, errors: [], warnings: [] });
  }, [onScriptSaved]);

  /**
   * Handle script discard
   */
  const handleScriptDiscard = useCallback(() => {
    setGeneratedScript(null);
    setValidationResult({ valid: true, errors: [], warnings: [] });
  }, []);

  return (
    <div className="ai-builder-tab-content" data-testid="ai-builder-tab-content">
      {/* OS Selector - Requirements: 4.2 */}
      <div className="ai-builder-os-section">
        <OSSelector
          selectedOS={targetOS}
          onOSChange={onOSChange}
          disabled={false}
          label="Target OS"
          compact={true}
        />
      </div>

      {/* Main content area */}
      <div className="ai-builder-main">
        {/* Chat Interface - Requirements: 4.1 */}
        <div className="ai-builder-chat-section">
          <AIChatInterface
            onScriptGenerated={handleScriptGenerated}
            apiKeyConfigured={apiKeyConfigured}
            targetOS={targetOS}
            providers={providers}
            activeProvider={activeProvider}
            onProviderSelect={onProviderSelect}
            onConfigureProvider={onConfigureProvider}
            models={models}
            activeModel={activeModel}
            onModelSelect={onModelSelect}
            providerLoading={providerLoading}
          />
        </div>

        {/* Script Preview - Requirements: 4.1 */}
        <div className="ai-builder-preview-section">
          <ScriptPreview
            script={generatedScript}
            onEdit={handleScriptEdit}
            onSave={handleScriptSave}
            onDiscard={handleScriptDiscard}
            validationResult={validationResult}
          />
        </div>
      </div>
    </div>
  );
};

export default AIBuilderTabContent;
