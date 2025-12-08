/**
 * UsageStatistics Component
 * 
 * Displays session statistics for AI provider usage including
 * request count per provider, success rate, and average response time.
 * 
 * Requirements: 6.4
 */

import React, { useState } from 'react';
import {
  AIProvider,
  SessionStatistics,
  PROVIDER_DISPLAY_NAMES,
} from '../types/providerAdapter.types';
import './UsageStatistics.css';

/**
 * Props for UsageStatistics component
 * Requirements: 6.4
 */
export interface UsageStatisticsProps {
  /** Session statistics data */
  statistics: SessionStatistics;
  /** Whether to show as a compact tooltip or expanded panel */
  variant?: 'tooltip' | 'panel';
  /** Optional class name for styling */
  className?: string;
}

/**
 * Get provider icon based on provider ID
 */
const getProviderIcon = (providerId: AIProvider): string => {
  switch (providerId) {
    case 'gemini':
      return '✨';
    case 'openai':
      return '🤖';
    case 'anthropic':
      return '🧠';
    case 'azure':
      return '☁️';
    default:
      return '🔌';
  }
};

/**
 * Format milliseconds to human-readable time
 */
const formatResponseTime = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
};

/**
 * Format success rate as percentage
 */
const formatSuccessRate = (rate: number): string => {
  return `${Math.round(rate * 100)}%`;
};

/**
 * Get success rate color class
 */
const getSuccessRateClass = (rate: number): string => {
  if (rate >= 0.9) return 'success-rate-excellent';
  if (rate >= 0.7) return 'success-rate-good';
  if (rate >= 0.5) return 'success-rate-fair';
  return 'success-rate-poor';
};

/**
 * UsageStatistics Component
 * 
 * Renders session statistics for AI provider usage.
 * Can be displayed as a compact tooltip or expanded panel.
 * 
 * Requirements: 6.4
 */
export const UsageStatistics: React.FC<UsageStatisticsProps> = ({
  statistics,
  variant = 'panel',
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    totalRequests,
    requestsByProvider,
    successRate,
    averageResponseTime,
  } = statistics;

  // Convert Map to array for rendering
  const providerStats = Array.from(requestsByProvider.entries())
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]); // Sort by count descending

  const hasStats = totalRequests > 0;

  if (variant === 'tooltip') {
    return (
      <div
        className={`usage-statistics-tooltip ${className}`}
        data-testid="usage-statistics-tooltip"
      >
        <button
          className="usage-statistics-trigger"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label="View usage statistics"
          data-testid="usage-statistics-trigger"
        >
          <span className="usage-statistics-icon">📊</span>
          <span className="usage-statistics-count">{totalRequests}</span>
        </button>

        {isExpanded && (
          <div
            className="usage-statistics-popup"
            data-testid="usage-statistics-popup"
          >
            <UsageStatisticsContent
              totalRequests={totalRequests}
              providerStats={providerStats}
              successRate={successRate}
              averageResponseTime={averageResponseTime}
              hasStats={hasStats}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`usage-statistics-panel ${className}`}
      data-testid="usage-statistics-panel"
    >
      <div className="usage-statistics-header">
        <span className="usage-statistics-title">📊 Session Statistics</span>
      </div>
      <UsageStatisticsContent
        totalRequests={totalRequests}
        providerStats={providerStats}
        successRate={successRate}
        averageResponseTime={averageResponseTime}
        hasStats={hasStats}
      />
    </div>
  );
};

/**
 * Internal component for statistics content
 */
interface UsageStatisticsContentProps {
  totalRequests: number;
  providerStats: [AIProvider, number][];
  successRate: number;
  averageResponseTime: number;
  hasStats: boolean;
}

const UsageStatisticsContent: React.FC<UsageStatisticsContentProps> = ({
  totalRequests,
  providerStats,
  successRate,
  averageResponseTime,
  hasStats,
}) => {
  if (!hasStats) {
    return (
      <div className="usage-statistics-empty" data-testid="usage-statistics-empty">
        <span className="usage-statistics-empty-icon">📭</span>
        <span className="usage-statistics-empty-text">
          No requests yet this session
        </span>
      </div>
    );
  }

  return (
    <div className="usage-statistics-content" data-testid="usage-statistics-content">
      {/* Summary Stats */}
      <div className="usage-statistics-summary">
        <div className="usage-stat-item" data-testid="stat-total-requests">
          <span className="usage-stat-label">Total Requests</span>
          <span className="usage-stat-value">{totalRequests}</span>
        </div>
        <div className="usage-stat-item" data-testid="stat-success-rate">
          <span className="usage-stat-label">Success Rate</span>
          <span className={`usage-stat-value ${getSuccessRateClass(successRate)}`}>
            {formatSuccessRate(successRate)}
          </span>
        </div>
        <div className="usage-stat-item" data-testid="stat-avg-response-time">
          <span className="usage-stat-label">Avg Response Time</span>
          <span className="usage-stat-value">
            {formatResponseTime(averageResponseTime)}
          </span>
        </div>
      </div>

      {/* Per-Provider Stats */}
      {providerStats.length > 0 && (
        <div className="usage-statistics-providers">
          <div className="usage-providers-header">Requests by Provider</div>
          <div className="usage-providers-list" data-testid="usage-providers-list">
            {providerStats.map(([providerId, count]) => (
              <div
                key={providerId}
                className="usage-provider-item"
                data-testid={`provider-stat-${providerId}`}
              >
                <span className="usage-provider-icon">
                  {getProviderIcon(providerId)}
                </span>
                <span className="usage-provider-name">
                  {PROVIDER_DISPLAY_NAMES[providerId]}
                </span>
                <span className="usage-provider-count">{count}</span>
                <div
                  className="usage-provider-bar"
                  style={{
                    width: `${(count / totalRequests) * 100}%`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageStatistics;
