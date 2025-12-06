/**
 * CoreSelector Component
 * 
 * Provides UI for selecting between Python and Rust automation cores.
 * Displays core availability, status, and performance metrics.
 * Allows users to switch between cores with validation feedback.
 * 
 * Requirements: 1.1, 6.1, 6.4, 10.2, 10.3
 */

import React, { useState, useEffect } from 'react';
import { getIPCBridge } from '../services/ipcBridgeService';
import './CoreSelector.css';

/**
 * Core type enumeration
 */
export type CoreType = 'python' | 'rust';

/**
 * Core status information
 */
export interface CoreStatus {
  activeCoreType: CoreType;
  availableCores: CoreType[];
  coreHealth: {
    python?: boolean;
    rust?: boolean;
  };
}

/**
 * Performance metrics for a core
 */
export interface PerformanceMetrics {
  coreType: CoreType;
  lastOperationTime: number;
  memoryUsage: number;
  cpuUsage: number;
  operationCount: number;
  errorRate: number;
}

/**
 * User settings that should be preserved during core switching
 */
export interface UserSettings {
  playbackSpeed: number;
  loopCount: number;
  selectedScriptPath?: string | null;
  uiState: UIState;
}

/**
 * UI state that should be preserved during core switching
 */
export interface UIState {
  showPreview: boolean;
  previewOpacity: number;
  lastRecordingDirectory?: string | null;
  windowGeometry?: WindowGeometry | null;
}

/**
 * Window geometry for UI state preservation
 */
export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Core recommendation based on performance analysis
 */
export interface CoreRecommendation {
  recommendedCore: CoreType;
  confidence: number; // 0.0 to 1.0
  reasons: string[];
  performanceImprovement?: number; // Percentage improvement
}

/**
 * Detailed performance comparison metrics
 */
export interface ComparisonDetails {
  responseTimeRatio: number; // rust_time / python_time
  memoryUsageRatio?: number;
  successRateDifference: number;
  operationsCountDifference: number;
}

/**
 * Performance comparison between cores
 */
export interface PerformanceComparison {
  pythonMetrics?: PerformanceMetrics;
  rustMetrics?: PerformanceMetrics;
  recommendation: CoreRecommendation;
  comparisonDetails: ComparisonDetails;
}

/**
 * Props for CoreSelector component
 */
interface CoreSelectorProps {
  currentCore: CoreType;
  availableCores: CoreType[];
  onCoreChange: (core: CoreType) => void;
  performanceMetrics?: PerformanceMetrics[];
  performanceComparison?: PerformanceComparison;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * CoreSelector Component
 * 
 * Renders a selection interface for choosing between automation cores.
 * Shows availability status, performance comparison, and switching controls.
 */
export const CoreSelector: React.FC<CoreSelectorProps> = ({
  currentCore,
  availableCores,
  onCoreChange,
  performanceMetrics = [],
  performanceComparison,
  disabled = false,
  loading = false,
}) => {
  const [switchingTo, setSwitchingTo] = useState<CoreType | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle core selection change
   */
  const handleCoreSelect = async (coreType: CoreType) => {
    if (disabled || loading || coreType === currentCore) {
      return;
    }

    try {
      setError(null);
      setSwitchingTo(coreType);
      await onCoreChange(coreType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch core';
      setError(errorMessage);
    } finally {
      setSwitchingTo(null);
    }
  };

  /**
   * Get core display name
   */
  const getCoreDisplayName = (coreType: CoreType): string => {
    switch (coreType) {
      case 'python':
        return 'Python Core';
      case 'rust':
        return 'Rust Core';
      default:
        return 'Unknown Core';
    }
  };

  /**
   * Get core description
   */
  const getCoreDescription = (coreType: CoreType): string => {
    switch (coreType) {
      case 'python':
        return 'Stable automation using PyAutoGUI';
      case 'rust':
        return 'High-performance native automation';
      default:
        return 'Unknown automation core';
    }
  };

  /**
   * Get core icon
   */
  const getCoreIcon = (coreType: CoreType): string => {
    switch (coreType) {
      case 'python':
        return '🐍';
      case 'rust':
        return '🦀';
      default:
        return '❓';
    }
  };

  /**
   * Check if core is available
   */
  const isCoreAvailable = (coreType: CoreType): boolean => {
    return availableCores?.includes(coreType) ?? false;
  };

  /**
   * Get performance metrics for a core
   */
  const getCoreMetrics = (coreType: CoreType): PerformanceMetrics | undefined => {
    return performanceMetrics.find(m => m.coreType === coreType);
  };

  /**
   * Format performance value
   */
  const formatPerformanceValue = (value: number, unit: string): string => {
    if (value === 0) return 'N/A';
    return `${value.toFixed(1)}${unit}`;
  };

  /**
   * Get performance comparison indicator
   */
  const getPerformanceComparison = (coreType: CoreType): 'better' | 'worse' | 'equal' | 'unknown' => {
    const currentMetrics = getCoreMetrics(currentCore);
    const compareMetrics = getCoreMetrics(coreType);

    if (!currentMetrics || !compareMetrics || coreType === currentCore) {
      return 'unknown';
    }

    // Compare based on operation time (lower is better)
    if (compareMetrics.lastOperationTime < currentMetrics.lastOperationTime * 0.9) {
      return 'better';
    } else if (compareMetrics.lastOperationTime > currentMetrics.lastOperationTime * 1.1) {
      return 'worse';
    } else {
      return 'equal';
    }
  };

  /**
   * Get performance comparison text
   */
  const getPerformanceComparisonText = (coreType: CoreType): string => {
    const comparison = getPerformanceComparison(coreType);
    switch (comparison) {
      case 'better':
        return 'Faster performance';
      case 'worse':
        return 'Slower performance';
      case 'equal':
        return 'Similar performance';
      default:
        return 'Performance unknown';
    }
  };

  /**
   * Get performance comparison icon
   */
  const getPerformanceComparisonIcon = (coreType: CoreType): string => {
    const comparison = getPerformanceComparison(coreType);
    switch (comparison) {
      case 'better':
        return '⚡';
      case 'worse':
        return '🐌';
      case 'equal':
        return '⚖️';
      default:
        return '❓';
    }
  };

  return (
    <div className="core-selector-container" data-testid="core-selector">
      <div className="core-selector-header">
        <h3 className="core-selector-title">Automation Core</h3>
        <div className="core-selector-status">
          <span className="core-selector-status-label">Active:</span>
          <span className="core-selector-status-value">
            {getCoreIcon(currentCore)} {getCoreDisplayName(currentCore)}
          </span>
        </div>
      </div>

      {error && (
        <div className="core-selector-error">
          <span className="core-selector-error-text">{error}</span>
        </div>
      )}

      <div className="core-selector-options">
        {(['python', 'rust'] as CoreType[]).map((coreType) => {
          const isAvailable = isCoreAvailable(coreType);
          const isActive = coreType === currentCore;
          const isSwitching = switchingTo === coreType;
          const metrics = getCoreMetrics(coreType);
          const isDisabled = disabled || loading || !isAvailable;

          return (
            <button
              key={coreType}
              className={`core-option ${isActive ? 'active' : ''} ${!isAvailable ? 'unavailable' : ''} ${isSwitching ? 'switching' : ''}`}
              onClick={() => handleCoreSelect(coreType)}
              disabled={isDisabled}
              data-testid={`core-option-${coreType}`}
              aria-selected={isActive}
            >
              <div className="core-option-header">
                <div className="core-option-info">
                  <span className="core-option-icon">
                    {getCoreIcon(coreType)}
                  </span>
                  <div className="core-option-text">
                    <span className="core-option-name">
                      {getCoreDisplayName(coreType)}
                    </span>
                    <span className="core-option-description">
                      {getCoreDescription(coreType)}
                    </span>
                  </div>
                </div>

                <div className="core-option-status">
                  {isSwitching ? (
                    <div className="core-option-switching">
                      <span className="core-option-spinner" />
                      <span className="core-option-switching-text">Switching...</span>
                    </div>
                  ) : isActive ? (
                    <div className="core-option-active">
                      <span className="core-option-active-icon">✓</span>
                      <span className="core-option-active-text">Active</span>
                    </div>
                  ) : !isAvailable ? (
                    <div className="core-option-unavailable">
                      <span className="core-option-unavailable-icon">⚠️</span>
                      <span className="core-option-unavailable-text">Unavailable</span>
                    </div>
                  ) : (
                    <div className="core-option-available">
                      <span className="core-option-available-text">Available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Metrics */}
              {metrics && isAvailable && (
                <div className="core-option-metrics">
                  <div className="core-metrics-row">
                    <div className="core-metric">
                      <span className="core-metric-label">Last Operation:</span>
                      <span className="core-metric-value">
                        {formatPerformanceValue(metrics.lastOperationTime, 'ms')}
                      </span>
                    </div>
                    <div className="core-metric">
                      <span className="core-metric-label">Memory:</span>
                      <span className="core-metric-value">
                        {formatPerformanceValue(metrics.memoryUsage, 'MB')}
                      </span>
                    </div>
                  </div>
                  <div className="core-metrics-row">
                    <div className="core-metric">
                      <span className="core-metric-label">Operations:</span>
                      <span className="core-metric-value">
                        {metrics.operationCount}
                      </span>
                    </div>
                    <div className="core-metric">
                      <span className="core-metric-label">Error Rate:</span>
                      <span className="core-metric-value">
                        {formatPerformanceValue(metrics.errorRate * 100, '%')}
                      </span>
                    </div>
                  </div>

                  {/* Performance Comparison */}
                  {!isActive && (
                    <div className="core-performance-comparison">
                      <span className="core-comparison-icon">
                        {getPerformanceComparisonIcon(coreType)}
                      </span>
                      <span className="core-comparison-text">
                        {getPerformanceComparisonText(coreType)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Unavailable Reason */}
              {!isAvailable && (
                <div className="core-option-unavailable-reason">
                  <span className="core-unavailable-reason-text">
                    {coreType === 'rust'
                      ? 'Rust core not installed or configured'
                      : 'Python dependencies missing or core failed to initialize'
                    }
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Performance Recommendation */}
      {performanceComparison && performanceComparison.recommendation && (
        <div className="core-selector-recommendation">
          <h4 className="core-recommendation-title">
            Performance Recommendation
          </h4>
          <div className="core-recommendation-content">
            <div className="core-recommendation-header">
              <span className="core-recommendation-icon">
                {getCoreIcon(performanceComparison.recommendation.recommendedCore)}
              </span>
              <div className="core-recommendation-text">
                <span className="core-recommendation-core">
                  {getCoreDisplayName(performanceComparison.recommendation.recommendedCore)} Recommended
                </span>
                <span className="core-recommendation-confidence">
                  Confidence: {(performanceComparison.recommendation.confidence * 100).toFixed(0)}%
                </span>
              </div>
              {performanceComparison.recommendation.performanceImprovement && (
                <span className="core-recommendation-improvement">
                  +{performanceComparison.recommendation.performanceImprovement.toFixed(1)}% improvement
                </span>
              )}
            </div>

            <div className="core-recommendation-reasons">
              {performanceComparison.recommendation.reasons.map((reason, index) => (
                <div key={index} className="core-recommendation-reason">
                  <span className="core-recommendation-reason-bullet">•</span>
                  <span className="core-recommendation-reason-text">{reason}</span>
                </div>
              ))}
            </div>

            {/* Detailed Comparison */}
            {performanceComparison.comparisonDetails && (
              <div className="core-comparison-details">
                <h5 className="core-comparison-details-title">Performance Details</h5>
                <div className="core-comparison-metrics">
                  <div className="core-comparison-metric">
                    <span className="core-comparison-metric-label">Response Time Ratio:</span>
                    <span className="core-comparison-metric-value">
                      {performanceComparison.comparisonDetails.responseTimeRatio.toFixed(2)}x
                    </span>
                  </div>
                  <div className="core-comparison-metric">
                    <span className="core-comparison-metric-label">Success Rate Difference:</span>
                    <span className="core-comparison-metric-value">
                      {performanceComparison.comparisonDetails.successRateDifference > 0 ? '+' : ''}
                      {(performanceComparison.comparisonDetails.successRateDifference * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="core-comparison-metric">
                    <span className="core-comparison-metric-label">Operations Difference:</span>
                    <span className="core-comparison-metric-value">
                      {performanceComparison.comparisonDetails.operationsCountDifference > 0 ? '+' : ''}
                      {performanceComparison.comparisonDetails.operationsCountDifference}
                    </span>
                  </div>
                  {performanceComparison.comparisonDetails.memoryUsageRatio && (
                    <div className="core-comparison-metric">
                      <span className="core-comparison-metric-label">Memory Usage Ratio:</span>
                      <span className="core-comparison-metric-value">
                        {performanceComparison.comparisonDetails.memoryUsageRatio.toFixed(2)}x
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Summary */}
      {performanceMetrics.length > 1 && !performanceComparison && (
        <div className="core-selector-summary">
          <h4 className="core-summary-title">Performance Comparison</h4>
          <div className="core-summary-content">
            <p className="core-summary-text">
              Choose the core that best fits your performance and compatibility needs.
              Performance metrics are updated after each operation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoreSelector;
