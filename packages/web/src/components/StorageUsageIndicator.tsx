import React from 'react';
import { AlertTriangle, HardDrive, CheckCircle } from 'lucide-react';

interface StorageUsageIndicatorProps {
  currentCount: number;
  maxCount: number;
  className?: string;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const StorageUsageIndicator: React.FC<StorageUsageIndicatorProps> = ({
  currentCount,
  maxCount,
  className = '',
  showDetails = true,
  size = 'md'
}) => {
  const usagePercent = Math.round((currentCount / maxCount) * 100);
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = currentCount >= maxCount;

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'p-2',
      text: 'text-xs',
      icon: 'w-3 h-3',
      bar: 'h-1'
    },
    md: {
      container: 'p-3',
      text: 'text-sm',
      icon: 'w-4 h-4',
      bar: 'h-2'
    },
    lg: {
      container: 'p-4',
      text: 'text-base',
      icon: 'w-5 h-5',
      bar: 'h-3'
    }
  };

  const config = sizeConfig[size];

  // Color scheme based on usage
  const getColorScheme = () => {
    if (isAtLimit) {
      return {
        bg: 'bg-red-50 border-red-200',
        text: 'text-red-800',
        icon: 'text-red-600',
        bar: 'bg-red-500',
        barBg: 'bg-red-100'
      };
    } else if (isNearLimit) {
      return {
        bg: 'bg-yellow-50 border-yellow-200',
        text: 'text-yellow-800',
        icon: 'text-yellow-600',
        bar: 'bg-yellow-500',
        barBg: 'bg-yellow-100'
      };
    } else {
      return {
        bg: 'bg-green-50 border-green-200',
        text: 'text-green-800',
        icon: 'text-green-600',
        bar: 'bg-green-500',
        barBg: 'bg-green-100'
      };
    }
  };

  const colors = getColorScheme();

  const getIcon = () => {
    if (isAtLimit) {
      return <AlertTriangle className={`${config.icon} ${colors.icon}`} />;
    } else if (isNearLimit) {
      return <AlertTriangle className={`${config.icon} ${colors.icon}`} />;
    } else {
      return <CheckCircle className={`${config.icon} ${colors.icon}`} />;
    }
  };

  const getMessage = () => {
    if (isAtLimit) {
      return 'Storage limit reached';
    } else if (isNearLimit) {
      return 'Storage nearly full';
    } else {
      return 'Storage available';
    }
  };

  return (
    <div className={`${colors.bg} border rounded-lg ${config.container} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getIcon()}
          <span className={`${config.text} font-medium ${colors.text}`}>
            {getMessage()}
          </span>
        </div>
        <div className={`${config.text} font-semibold ${colors.text}`}>
          {currentCount}/{maxCount}
        </div>
      </div>

      {showDetails && (
        <>
          {/* Progress bar */}
          <div className={`w-full ${colors.barBg} rounded-full ${config.bar} mb-2`}>
            <div
              className={`${colors.bar} ${config.bar} rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>

          {/* Usage details */}
          <div className="flex items-center justify-between">
            <span className={`${config.text} ${colors.text}`}>
              {usagePercent}% used
            </span>
            <span className={`${config.text} ${colors.text}`}>
              {maxCount - currentCount} remaining
            </span>
          </div>

          {/* Warning message */}
          {isNearLimit && (
            <div className={`mt-2 ${config.text} ${colors.text}`}>
              {isAtLimit
                ? 'Create an account to save unlimited scripts'
                : 'Consider creating an account for unlimited storage'
              }
            </div>
          )}
        </>
      )}
    </div>
  );
};
