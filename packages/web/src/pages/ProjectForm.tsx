import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const ProjectForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) {
      fetchProject();
    }
  }, [id]);

  const fetchProject = async () => {
    try {
      if (!id) return;
      const docRef = doc(db, 'projects', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setName((data.name as string) || '');
        setDescription((data.description as string) || '');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      setError('Failed to load project');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user) {
        setError('Bạn cần đăng nhập trước khi tạo project.');
        return;
      }

      if (isEdit) {
        if (!id) return;
        const docRef = doc(db, 'projects', id);
        await updateDoc(docRef, {
          name,
          description,
          updated_at: new Date().toISOString(),
        });
      } else {
        const projectsRef = collection(db, 'projects');
        await addDoc(projectsRef, {
          name,
          description,
          user_id: user.uid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      navigate('/projects');
    } catch (error: any) {
      setError(error?.message || 'Tạo project thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEdit ? 'Edit Project' : 'Create New Project'}
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="My Automation Project"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Describe your project..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};
