import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthInput } from '../components/AuthInput';
import { AuthButton } from '../components/AuthButton';
import './RegisterScreen.css';

const RegisterScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const navigate = useNavigate();
  const { signUpWithEmail, loading, error, resetAuthState } = useAuth();

  const handleRegister = async () => {
    // Clear previous validation errors
    setValidationError('');

    // Validate inputs
    if (!email || !password || !confirmPassword) {
      setValidationError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      setValidationError('Mật khẩu xác nhận không khớp');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setValidationError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    try {
      console.log('Attempting to register with email:', email);
      await signUpWithEmail(email, password);
      console.log('Registration successful');
    } catch (err: any) {
      console.error('Registration failed:', err);
      setValidationError(err.message || 'Đăng ký thất bại');
    }
  };

  const navigateToLogin = () => {
    navigate('/login');
  };

  const handleReset = () => {
    resetAuthState();
    setValidationError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const displayError = validationError || error;

  return (
    <div className="register-container">
      {/* Header with Reset Button */}
      {(displayError || loading) && (
        <div className="register-header">
          <button
            className="register-back-button"
            onClick={handleReset}
            disabled={false}
            title="Reset và quay lại"
          >
            ← Quay lại
          </button>
        </div>
      )}

      <div className="register-scroll-content">
        <div className="register-content">
          {/* Logo/Branding */}
          <div className="register-branding-container">
            <h1 className="register-logo">GeniusQA</h1>
            <p className="register-tagline">Tạo tài khoản mới</p>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="register-error-container">
              <p className="register-error-text">{displayError}</p>
            </div>
          )}

          {/* Email Input */}
          <AuthInput
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setValidationError('');
            }}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          {/* Password Input */}
          <AuthInput
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setValidationError('');
            }}
            placeholder="Mật khẩu"
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          {/* Confirm Password Input */}
          <AuthInput
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setValidationError('');
            }}
            placeholder="Xác nhận mật khẩu"
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          {/* Sign Up Button */}
          <AuthButton
            title="Đăng ký"
            onPress={handleRegister}
            loading={loading}
            disabled={loading || !email || !password || !confirmPassword}
            variant="primary"
          />

          {/* Login Link */}
          <div className="register-login-container">
            <span className="register-login-text">Đã có tài khoản? </span>
            <button
              className={`register-login-link ${loading ? 'disabled' : ''}`}
              onClick={navigateToLogin}
              disabled={loading}
            >
              Đăng nhập ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;
