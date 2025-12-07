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

  const handleNavigateToScriptEditor = () => {
    navigate('/script-editor');
  };

  const handleNavigateToAIScriptBuilder = () => {
    navigate('/ai-script-builder');
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

          {/* Script Editor Feature Card */}
          <div className="dashboard-feature-card">
            <h3 className="dashboard-feature-title">Script Editor</h3>
            <p className="dashboard-feature-description">
              View, edit, and manage your recorded automation scripts
            </p>
            <div className="dashboard-feature-button-container">
              <AuthButton
                title="Open Script Editor"
                onPress={handleNavigateToScriptEditor}
                loading={false}
                disabled={false}
                variant="primary"
              />
            </div>
          </div>

          {/* AI Script Builder Feature Card */}
          <div className="dashboard-feature-card">
            <h3 className="dashboard-feature-title">AI Script Builder</h3>
            <p className="dashboard-feature-description">
              Generate automation scripts using AI by describing your test scenarios in natural language
            </p>
            <div className="dashboard-feature-button-container">
              <AuthButton
                title="Open AI Script Builder"
                onPress={handleNavigateToAIScriptBuilder}
                loading={false}
                disabled={false}
                variant="primary"
              />
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
