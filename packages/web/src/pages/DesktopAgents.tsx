import React from 'react';
import { Layout } from '../components/Layout';
import { Monitor, Circle } from 'lucide-react';

export const DesktopAgents: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Desktop Agents</h1>
          <p className="mt-2 text-gray-600">Manage connected desktop automation agents</p>
        </div>

        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Monitor className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No desktop agents connected</h3>
          <p className="mt-1 text-sm text-gray-500">Install and run the desktop application to connect agents.</p>
          <div className="mt-6">
            <button className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
              Download Desktop App
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">How to connect a desktop agent</h2>
          <ol className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full font-medium mr-3">1</span>
              <span>Download and install the GeniusQA Desktop application for Windows or macOS</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full font-medium mr-3">2</span>
              <span>Launch the application and sign in with your account</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full font-medium mr-3">3</span>
              <span>Your desktop agent will appear here once connected</span>
            </li>
          </ol>
        </div>
      </div>
    </Layout>
  );
};
