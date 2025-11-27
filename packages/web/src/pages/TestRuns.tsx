import React from 'react';
import { Layout } from '../components/Layout';
import { Play } from 'lucide-react';

export const TestRuns: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Test Runs</h1>
          <p className="mt-2 text-gray-600">View and manage test execution history</p>
        </div>

        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Play className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No test runs yet</h3>
          <p className="mt-1 text-sm text-gray-500">Execute a test case to see results here.</p>
        </div>
      </div>
    </Layout>
  );
};
