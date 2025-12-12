import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { FolderKanban, FileText, Play, TrendingUp } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    projects: 0,
    testcases: 0,
    testRuns: 0,
    successRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        const projectsQuery = query(collection(db, 'projects'), where('user_id', '==', user.uid));
        const testcasesQuery = collection(db, 'testcases');
        const testRunsQuery = collection(db, 'test_runs');
        const passedRunsQuery = query(collection(db, 'test_runs'), where('status', '==', 'passed'));

        const [projectsRes, testcasesRes, testRunsRes, passedRunsRes] = await Promise.all([
          getCountFromServer(projectsQuery),
          getCountFromServer(testcasesQuery),
          getCountFromServer(testRunsQuery),
          getCountFromServer(passedRunsQuery),
        ]);

        const totalRuns = testRunsRes.data().count || 0;
        const passedRuns = passedRunsRes.data().count || 0;
        const successRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

        setStats({
          projects: projectsRes.data().count || 0,
          testcases: testcasesRes.data().count || 0,
          testRuns: totalRuns,
          successRate,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const statCards = [
    { label: 'Projects', value: stats.projects, icon: FolderKanban, color: 'bg-blue-500', link: '/projects' },
    { label: 'Test Cases', value: stats.testcases, icon: FileText, color: 'bg-green-500', link: '/testcases' },
    { label: 'Test Runs', value: stats.testRuns, icon: Play, color: 'bg-purple-500', link: '/test-runs' },
    { label: 'Success Rate', value: `${stats.successRate}%`, icon: TrendingUp, color: 'bg-orange-500', link: '/test-runs' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Welcome back! Here's an overview of your testing activity.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Link
                  key={stat.label}
                  to={stat.link}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`${stat.color} rounded-lg p-3`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                to="/projects/new"
                className="block w-full text-left px-4 py-3 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg transition-colors"
              >
                Create New Project
              </Link>
              <Link
                to="/testcases/new"
                className="block w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
              >
                Create Test Case
              </Link>
              <Link
                to="/auto-generate"
                className="block w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors"
              >
                Auto-Generate Tests
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="text-sm text-gray-600">
              <p>No recent activity yet. Start by creating your first project!</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
