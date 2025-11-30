import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthInput } from '../components/AuthInput';
import { AuthButton } from '../components/AuthButton';
import './LoginScreen.css';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { signInWithEmail, signInWithGoogle, loading, error, resetAuthState } = useAuth();

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      return;
    }
    await signInWithEmail(email, password);
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const navigateToRegister = () => {
    navigate('/register');
  };

  const handleReset = () => {
    resetAuthState();
    setEmail('');
    setPassword('');
  };

  return (
    <div className="login-container">
      {/* Header with Reset Button */}
      {(error || loading) && (
        <div className="login-header">
          <button
            className="login-back-button"
            onClick={handleReset}
            disabled={false}
            title="Reset và quay lại"
          >
            ← Quay lại
          </button>
        </div>
      )}

      <div className="login-scroll-content">
        <div className="login-content">
          {/* Logo/Branding */}
          <div className="login-branding-container">
            <h1 className="login-logo">GeniusQA</h1>
            <p className="login-tagline">Đăng nhập để tiếp tục</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="login-error-container">
              <p className="login-error-text">{error}</p>
            </div>
          )}

          {/* Email Input */}
          <AuthInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          {/* Password Input */}
          <AuthInput
            value={password}
            onChangeText={setPassword}
            placeholder="Mật khẩu"
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          {/* Sign In Button */}
          <AuthButton
            title="Đăng nhập"
            onPress={handleEmailSignIn}
            loading={loading}
            disabled={loading || !email || !password}
            variant="primary"
          />

          {/* Divider */}
          <div className="login-divider">
            <div className="login-divider-line" />
            <span className="login-divider-text">hoặc</span>
            <div className="login-divider-line" />
          </div>

          {/* Google Sign In Button */}
          <AuthButton
            title="Đăng nhập với Google"
            onPress={handleGoogleSignIn}
            loading={loading}
            disabled={loading}
            variant="google"
          />

          {/* Register Link */}
          <div className="login-register-container">
            <span className="login-register-text">Chưa có tài khoản? </span>
            <button
              className={`login-register-link ${loading ? 'disabled' : ''}`}
              onClick={navigateToRegister}
              disabled={loading}
            >
              Đăng ký ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
