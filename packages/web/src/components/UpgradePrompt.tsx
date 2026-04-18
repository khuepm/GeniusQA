import React from 'react';
import { Link } from 'react-router-dom';
import { X, Cloud, Shield, Users } from 'lucide-react';
import { useGuestMode } from '../contexts/GuestModeContext';

export const UpgradePrompt: React.FC = () => {
  const { showUpgradePrompt, dismissUpgradePrompt } = useGuestMode();

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Save Your Work to the Cloud
          </h3>
          <button
            onClick={dismissUpgradePrompt}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          You've created multiple scripts! Create a free account to never lose your work and unlock additional features.
        </p>

        <div className="space-y-3 mb-6">
          <div className="flex items-center space-x-3">
            <Cloud className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-700">Cloud backup & sync across devices</span>
          </div>
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-700">Never lose your scripts</span>
          </div>
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-gray-700">Share scripts with others</span>
          </div>
        </div>

        <div className="flex space-x-3">
          <Link
            to="/register"
            className="flex-1 bg-blue-600 text-white text-center py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Create Free Account
          </Link>
          <button
            onClick={dismissUpgradePrompt}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
