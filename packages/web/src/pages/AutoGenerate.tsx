import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Sparkles } from 'lucide-react';

export const AutoGenerate: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Auto-Generate Test Cases</h1>
          <p className="mt-2 text-gray-600">Use AI to automatically generate test cases from requirements</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleGenerate} className="space-y-6">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                Describe your application or feature
              </label>
              <textarea
                id="prompt"
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Example: A login form with email and password fields, a remember me checkbox, and a forgot password link..."
              />
            </div>

            <button
              type="submit"
              disabled={loading || !prompt}
              className="w-full flex items-center justify-center px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {loading ? 'Generating...' : 'Generate Test Cases'}
            </button>
          </form>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Tips for better results:</h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Be specific about the functionality you want to test</li>
            <li>Include expected user interactions and workflows</li>
            <li>Mention any edge cases or validation rules</li>
            <li>Describe the expected outcomes</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};
