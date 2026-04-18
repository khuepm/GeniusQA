import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Plus, FileText, Download, Upload, Zap, HardDrive } from 'lucide-react';
import { GuestModeIndicator } from '../components/GuestModeIndicator';
import { StorageUsageIndicator } from '../components/StorageUsageIndicator';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { ScriptExecutionModal } from '../components/ScriptExecutionModal';
import { useGuestMode } from '../contexts/GuestModeContext';

export const GuestDashboard: React.FC = () => {
  const { scripts, scriptCount, maxScripts, storageUsagePercent, runScript } = useGuestMode();
  const [showExecutionModal, setShowExecutionModal] = useState(false);

  const recentScripts = scripts.slice(-5).reverse();

  const handleRunScript = async (scriptId: string) => {
    setShowExecutionModal(true);
    await runScript(scriptId);
  };

  const quickActions = [
    {
      title: 'Record New Script',
      description: 'Start recording your interactions',
      icon: <Plus className="w-6 h-6" />,
      href: '/testcases/new',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'View All Scripts',
      description: 'Manage your test scripts',
      icon: <FileText className="w-6 h-6" />,
      href: '/testcases',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'Import Scripts',
      description: 'Import existing test files',
      icon: <Upload className="w-6 h-6" />,
      href: '/testcases?action=import',
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: 'Auto Generate',
      description: 'AI-powered test generation',
      icon: <Zap className="w-6 h-6" />,
      href: '/auto-generate',
      color: 'bg-orange-500 hover:bg-orange-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <UpgradePrompt />

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Welcome to GeniusQA - Start testing without barriers</p>
            </div>
            <GuestModeIndicator showStorageDetails={true} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Scripts</p>
                <p className="text-2xl font-semibold text-gray-900">{scriptCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Play className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Ready to Run</p>
                <p className="text-2xl font-semibold text-gray-900">{scriptCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <HardDrive className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Storage Used</p>
                <p className="text-2xl font-semibold text-gray-900">{storageUsagePercent}%</p>
                <p className="text-xs text-gray-500">{scriptCount}/{maxScripts} scripts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Usage Indicator */}
        <div className="mb-8">
          <StorageUsageIndicator
            currentCount={scriptCount}
            maxCount={maxScripts}
            size="lg"
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.href}
                className={`${action.color} text-white p-6 rounded-lg shadow hover:shadow-lg transition-all`}
              >
                <div className="flex items-center space-x-3">
                  {action.icon}
                  <div>
                    <h3 className="font-semibold">{action.title}</h3>
                    <p className="text-sm opacity-90">{action.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Scripts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Recent Scripts</h2>
              <Link
                to="/testcases"
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                View All
              </Link>
            </div>
          </div>

          {recentScripts.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {recentScripts.map((script) => (
                <div key={script.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900">{script.name}</h3>
                      <p className="text-sm text-gray-500">
                        Updated {new Date(script.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Edit
                      </button>
                      <button
                        onClick={() => handleRunScript(script.id)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Run
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No scripts yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first test script.
              </p>
              <div className="mt-6">
                <Link
                  to="/testcases/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Script
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Getting Started Guide */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Record Your First Test</h3>
                <p className="text-sm text-gray-600">Start by recording interactions with your application</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Edit & Enhance</h3>
                <p className="text-sm text-gray-600">Customize your scripts with assertions and validations</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Run & Export</h3>
                <p className="text-sm text-gray-600">Execute tests locally and export in multiple formats</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScriptExecutionModal
        isOpen={showExecutionModal}
        onClose={() => setShowExecutionModal(false)}
      />
    </div>
  );
};
