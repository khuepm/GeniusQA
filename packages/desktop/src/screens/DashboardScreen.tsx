import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthButton } from '../components/AuthButton';
import './DashboardScreen.css';

const DashboardScreen: React.FC = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleNavigateToRecorder = () => {
    navigate('/recorder');
  };

  /**
   * Navigate to Unified Script Manager - Script List tab
   * Requirements: 10.1
   */
  const handleNavigateToScripts = () => {
    navigate('/scripts');
  };

  /**
   * Navigate to Unified Script Manager - Editor tab
   * Requirements: 10.1, 10.3
   */
  const handleNavigateToScriptEditor = () => {
    navigate('/scripts/editor');
  };

  /**
   * Navigate to Unified Script Manager - AI Builder tab
   * Requirements: 10.1, 10.4
   */
  const handleNavigateToAIScriptBuilder = () => {
    navigate('/scripts/builder');
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        {/* Header Section */}
        <div className="dashboard-header">
          <h1 className="dashboard-logo">GeniusQA</h1>
          <h2 className="dashboard-welcome-text">Chào mừng trở lại!</h2>
          {user?.email && (
            <p className="dashboard-email-text">{user.email}</p>
          )}
        </div>

        {/* Main Content - Placeholder */}
        <div className="dashboard-main-content">
          <div className="dashboard-placeholder-card">
            <h3 className="dashboard-placeholder-title">Dashboard</h3>
            <p className="dashboard-placeholder-text">
              Nội dung dashboard sẽ được thêm vào trong các phiên bản tiếp theo.
            </p>
          </div>

          {/* Recorder Feature Card */}
          <div className="dashboard-feature-card">
            <h3 className="dashboard-feature-title">Desktop Recorder</h3>
            <p className="dashboard-feature-description">
              Record and replay desktop interactions for automation testing
            </p>
            <div className="dashboard-feature-button-container">
              <AuthButton
                title="Open Recorder"
                onPress={handleNavigateToRecorder}
                loading={false}
                disabled={false}
                variant="primary"
              />
            </div>
          </div>

          {/* Script Manager Feature Card - Requirements: 10.1 */}
          <div className="dashboard-feature-card">
            <h3 className="dashboard-feature-title">Script Manager</h3>
            <p className="dashboard-feature-description">
              Unified interface to view, edit, and manage all your automation scripts
            </p>
            <div className="dashboard-feature-button-container">
              <AuthButton
                title="Open Script Manager"
                onPress={handleNavigateToScripts}
                loading={false}
                disabled={false}
                variant="primary"
              />
            </div>
            {/* Quick access buttons for specific tabs */}
            <div className="dashboard-quick-access">
              <button
                className="dashboard-quick-button"
                onClick={handleNavigateToScriptEditor}
                title="Go directly to Script Editor"
              >
                ✏️ Editor
              </button>
              <button
                className="dashboard-quick-button"
                onClick={handleNavigateToAIScriptBuilder}
                title="Go directly to AI Script Builder"
              >
                🤖 AI Builder
              </button>
            </div>
          </div>

          <div className="dashboard-placeholder-card">
            <h3 className="dashboard-placeholder-title">Tính năng sắp ra mắt</h3>
            <p className="dashboard-placeholder-text">
              • Quản lý API keys<br />
              • Lịch sử automation<br />
              • Cài đặt hệ thống<br />
              • Báo cáo và phân tích
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="dashboard-footer">
          <AuthButton
            title="Đăng xuất"
            onPress={handleSignOut}
            loading={loading}
            disabled={loading}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
