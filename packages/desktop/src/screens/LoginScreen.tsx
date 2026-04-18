import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthInput } from '../components/AuthInput';
import { AuthButton } from '../components/AuthButton';
import './LoginScreen.css';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showOAuthFlow, setShowOAuthFlow] = useState(false);
  const [oauthUrl, setOauthUrl] = useState('');
  const [oauthCode, setOauthCode] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const navigate = useNavigate();
  const { signInWithEmail, signInWithGoogle, signInWithGoogleExternalBrowser, signInWithGoogleCode, loading, error, resetAuthState } = useAuth();

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      return;
    }
    await signInWithEmail(email, password);
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleBrowserLogin = async () => {
    try {
      if (signInWithGoogleExternalBrowser) {
        const url = await signInWithGoogleExternalBrowser();
        setOauthUrl(url);
        setShowOAuthFlow(true);
      }
    } catch (error) {
      console.error('Failed to start browser login:', error);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(oauthUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleCodeSubmit = async () => {
    if (!oauthCode.trim()) {
      return;
    }
    try {
      if (signInWithGoogleCode) {
        await signInWithGoogleCode(oauthCode);
      }
    } catch (error) {
      console.error('Failed to complete OAuth:', error);
    }
  };

  const navigateToRegister = () => {
    navigate('/register');
  };

  const handleReset = () => {
    resetAuthState();
    setEmail('');
    setPassword('');
    setShowOAuthFlow(false);
    setOauthUrl('');
    setOauthCode('');
    setCopySuccess(false);
  };

  return (
    <div className="login-container">
      {/* Header with Reset Button */}
      {(error || loading || showOAuthFlow) && (
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

          {/* OAuth Flow UI */}
          {showOAuthFlow ? (
            <div className="oauth-flow-container">
              <div className="oauth-step">
                <h3 className="oauth-step-title">Bước 1: Mở link trong trình duyệt</h3>
                <p className="oauth-step-description">
                  Link sẽ tự động mở. Nếu không, copy link bên dưới:
                </p>
                <div className="oauth-url-container">
                  <input
                    type="text"
                    value={oauthUrl}
                    readOnly
                    className="oauth-url-input"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="oauth-copy-button"
                    disabled={loading}
                  >
                    {copySuccess ? '✓ Đã copy' : '📋 Copy'}
                  </button>
                </div>
              </div>

              <div className="oauth-step">
                <h3 className="oauth-step-title">Bước 2: Đăng nhập Google</h3>
                <p className="oauth-step-description">
                  Hoàn tất đăng nhập trong trình duyệt
                </p>
              </div>

              <div className="oauth-step">
                <h3 className="oauth-step-title">Bước 3: Nhập mã xác thực</h3>
                <p className="oauth-step-description">
                  Copy mã từ trình duyệt và paste vào đây:
                </p>
                <AuthInput
                  value={oauthCode}
                  onChangeText={setOauthCode}
                  placeholder="Dán mã xác thực vào đây"
                  editable={!loading}
                />
                <AuthButton
                  title="Xác nhận"
                  onPress={handleCodeSubmit}
                  loading={loading}
                  disabled={loading || !oauthCode.trim()}
                  variant="primary"
                />
              </div>
            </div>
          ) : (
            <>
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

              {/* Google Sign In Button (Desktop: may show error) */}
              <AuthButton
                title="Đăng nhập với Google"
                onPress={handleGoogleSignIn}
                loading={loading}
                disabled={loading}
                variant="google"
              />

              {/* Browser OAuth Button (for Desktop) */}
              <AuthButton
                title="🌐 Đăng nhập với Browser"
                onPress={handleBrowserLogin}
                loading={loading}
                disabled={loading}
                variant="secondary"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
