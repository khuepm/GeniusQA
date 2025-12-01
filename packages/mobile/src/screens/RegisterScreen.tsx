import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { AuthInput } from '../components/AuthInput';
import { AuthButton } from '../components/AuthButton';

const RegisterScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const navigation = useNavigation();
  const { signUpWithEmail, loading, error } = useAuth();

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

    await signUpWithEmail(email, password);
  };

  const navigateToLogin = () => {
    navigation.navigate('Login' as never);
  };

  const displayError = validationError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Logo/Branding */}
          <View style={styles.brandingContainer}>
            <Text style={styles.logo}>GeniusQA</Text>
            <Text style={styles.tagline}>Tạo tài khoản mới</Text>
          </View>

          {/* Error Message */}
          {displayError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
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
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={navigateToLogin} disabled={loading}>
              <Text style={[styles.loginLink, loading && styles.disabledLink]}>
                Đăng nhập ngay
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#5f6368',
  },
  errorContainer: {
    backgroundColor: '#fce8e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#d93025',
    fontSize: 14,
    textAlign: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: '#5f6368',
  },
  loginLink: {
    fontSize: 14,
    color: '#1a73e8',
    fontWeight: '600',
  },
  disabledLink: {
    opacity: 0.5,
  },
});

export default RegisterScreen;
