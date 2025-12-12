import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { TestCase } from '../types/database';
import { Plus, FileText, Trash2, Edit, Play } from 'lucide-react';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  addDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export const TestCases: React.FC = () => {
  const { user } = useAuth();
  const [testcases, setTestcases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TestCase['status']>('draft');
  const isEditing = useMemo(() => !!editingId, [editingId]);

  useEffect(() => {
    fetchTestCases();
  }, []);

  const fetchTestCases = async () => {
    if (!user) {
      setTestcases([]);
      setLoading(false);
      return;
    }
    try {
      const testcasesQuery = query(
        collection(db, 'testcases'),
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc'),
      );
      const snapshot = await getDocs(testcasesQuery);
      const items: TestCase[] = snapshot.docs.map((d) => {
        const data = d.data();
        const created = (data.created_at as any)?.toDate
          ? (data.created_at as any).toDate().toISOString()
          : (data.created_at as string) || '';
        const updated = (data.updated_at as any)?.toDate
          ? (data.updated_at as any).toDate().toISOString()
          : (data.updated_at as string) || '';
        return {
          id: d.id,
          project_id: (data.project_id as string) || '',
          name: (data.name as string) || '',
          description: (data.description as string) || '',
          steps: (data.steps as any[]) || [],
          status: (data.status as TestCase['status']) || 'draft',
          created_at: created,
          updated_at: updated,
        };
      });
      setTestcases(items);
      setError('');
    } catch (error) {
      console.error('Error fetching test cases:', error);
      setError('Không tải được danh sách test case. Kiểm tra quyền Firestore hoặc cấu hình.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this test case?')) return;

    try {
      await deleteDoc(doc(db, 'testcases', id));
      setTestcases(testcases.filter((tc) => tc.id !== id));
    } catch (error) {
      console.error('Error deleting test case:', error);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setStatus('draft');
    setFormOpen(true);
  };

  const openEdit = (tc: TestCase) => {
    setEditingId(tc.id);
    setName(tc.name);
    setDescription(tc.description);
    setStatus(tc.status);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Vui lòng đăng nhập');
      return;
    }
    try {
      if (isEditing && editingId) {
        const ref = doc(db, 'testcases', editingId);
        await updateDoc(ref, {
          name,
          description,
          status,
          updated_at: new Date().toISOString(),
          user_id: user.uid,
        });
      } else {
        await addDoc(collection(db, 'testcases'), {
          project_id: '', // chưa có chọn project, giữ rỗng
          name,
          description,
          steps: [],
          status,
          user_id: user.uid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      setFormOpen(false);
      setEditingId(null);
      setName('');
      setDescription('');
      setStatus('draft');
      fetchTestCases();
    } catch (err) {
      console.error('Error saving test case:', err);
      alert('Lưu test case thất bại, kiểm tra console.');
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
          <button
            onClick={openCreate}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Test Case
          </button>
        </div>

        {formOpen && (
          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TestCase['status'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId(null);
                    setName('');
                    setDescription('');
                    setStatus('draft');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                >
                  {isEditing ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Không thể tải test cases</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
          </div>
        ) : testcases.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No test cases</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new test case.</p>
            <div className="mt-6">
              <button
                onClick={openCreate}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Test Case
              </button>
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
                      <button onClick={() => openEdit(testcase)} className="text-primary-600 hover:text-primary-900">
                        <Edit className="w-4 h-4 inline" />
                      </button>
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
}
  ;
