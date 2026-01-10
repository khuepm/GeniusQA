import React from 'react';
import { Link } from 'react-router-dom';
import { User, ArrowRight, HardDrive } from 'lucide-react';
import { useGuestMode } from '../contexts/GuestModeContext';

interface GuestModeIndicatorProps {
  className?: string;
  showStorageDetails?: boolean;
}

export const GuestModeIndicator: React.FC<GuestModeIndicatorProps> = ({
  className = '',
  showStorageDetails = false
}) => {
  const { scriptCount, maxScripts, storageUsagePercent, storageError } = useGuestMode();

  const isNearLimit = storageUsagePercent >= 80;
  const isAtLimit = scriptCount >= maxScripts;

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <User className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">Guest Mode</span>
          <span className="text-xs text-blue-600">• Scripts saved locally</span>
          {showStorageDetails && (
            <div className="flex items-center space-x-1 text-xs text-blue-600">
              <HardDrive className="w-3 h-3" />
              <span className={isNearLimit ? 'text-yellow-600 font-medium' : ''}>
                {scriptCount}/{maxScripts}
              </span>
            </div>
          )}
        </div>
        <Link
          to="/register"
          className="inline-flex items-center space-x-1 text-xs text-blue-700 hover:text-blue-800 font-medium"
        >
          <span>Create Account</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {showStorageDetails && isNearLimit && (
        <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
          {isAtLimit
            ? 'Storage limit reached. Create an account for unlimited scripts.'
            : `Storage ${storageUsagePercent}% full. Consider creating an account.`
          }
        </div>
      )}

      {storageError && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {storageError}
        </div>
      )}
    </div>
  );
};
