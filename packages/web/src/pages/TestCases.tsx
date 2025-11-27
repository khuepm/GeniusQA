import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { TestCase } from '../types/database';
import { Plus, FileText, Trash2, Edit, Play } from 'lucide-react';

export const TestCases: React.FC = () => {
  const [testcases, setTestcases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestCases();
  }, []);

  const fetchTestCases = async () => {
    try {
      const { data, error } = await supabase
        .from('testcases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTestcases(data || []);
    } catch (error) {
      console.error('Error fetching test cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this test case?')) return;

    try {
      const { error } = await supabase.from('testcases').delete().eq('id', id);
      if (error) throw error;
      setTestcases(testcases.filter((tc) => tc.id !== id));
    } catch (error) {
      console.error('Error deleting test case:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Test Cases</h1>
            <p className="mt-2 text-gray-600">Manage your test cases</p>
          </div>
          <Link
            to="/testcases/new"
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Test Case
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : testcases.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No test cases</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new test case.</p>
            <div className="mt-6">
              <Link
                to="/testcases/new"
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Test Case
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Steps
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {testcases.map((testcase) => (
                  <tr key={testcase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{testcase.name}</div>
                      <div className="text-sm text-gray-500 truncate max-w-md">{testcase.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(testcase.status)}`}>
                        {testcase.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {testcase.steps?.length || 0} steps
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(testcase.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button className="text-green-600 hover:text-green-900">
                        <Play className="w-4 h-4 inline" />
                      </button>
                      <Link to={`/testcases/${testcase.id}/edit`} className="text-primary-600 hover:text-primary-900">
                        <Edit className="w-4 h-4 inline" />
                      </Link>
                      <button onClick={() => handleDelete(testcase.id)} className="text-red-600 hover:text-red-900">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};
