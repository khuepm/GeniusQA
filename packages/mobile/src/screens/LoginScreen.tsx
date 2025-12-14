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

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation();
  const { signInWithEmail, signInWithGoogle, loading, error } = useAuth();

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
    navigation.navigate('Register' as never);
  };

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
            <Text style={styles.tagline}>Đăng nhập để tiếp tục</Text>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
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
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>hoặc</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign In Button */}
          <AuthButton
            title="Đăng nhập với Google"
            onPress={handleGoogleSignIn}
            loading={loading}
            disabled={loading}
            variant="google"
          />

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={navigateToRegister} disabled={loading}>
              <Text style={[styles.registerLink, loading && styles.disabledLink]}>
                Đăng ký ngay
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#dadce0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#5f6368',
    fontSize: 14,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    fontSize: 14,
    color: '#5f6368',
  },
  registerLink: {
    fontSize: 14,
    color: '#1a73e8',
    fontWeight: '600',
  },
  disabledLink: {
    opacity: 0.5,
  },
});

export default LoginScreen;
