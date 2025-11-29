import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { AuthButton } from '../components/AuthButton';
import { RootStackParamList } from '../navigation/AppNavigator';

type DashboardNavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;

const DashboardScreen: React.FC = () => {
  const { user, signOut, loading } = useAuth();
  const navigation = useNavigation<DashboardNavigationProp>();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleNavigateToRecorder = () => {
    navigation.navigate('Recorder');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.logo}>GeniusQA</Text>
        <Text style={styles.welcomeText}>Chào mừng trở lại!</Text>
        {user?.email && (
          <Text style={styles.emailText}>{user.email}</Text>
        )}
      </View>

      {/* Main Content - Placeholder */}
      <View style={styles.mainContent}>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>Dashboard</Text>
          <Text style={styles.placeholderText}>
            Nội dung dashboard sẽ được thêm vào trong các phiên bản tiếp theo.
          </Text>
        </View>

        {/* Recorder Feature Card */}
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Desktop Recorder</Text>
          <Text style={styles.featureDescription}>
            Record and replay desktop interactions for automation testing
          </Text>
          <View style={styles.featureButtonContainer}>
            <AuthButton
              title="Open Recorder"
              onPress={handleNavigateToRecorder}
              loading={false}
              disabled={false}
              variant="primary"
            />
          </View>
        </View>

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>Tính năng sắp ra mắt</Text>
          <Text style={styles.placeholderText}>
            • Quản lý API keys{'\n'}
            • Lịch sử automation{'\n'}
            • Cài đặt hệ thống{'\n'}
            • Báo cáo và phân tích
          </Text>
        </View>
      </View>

      {/* Sign Out Button */}
      <View style={styles.footer}>
        <AuthButton
          title="Đăng xuất"
          onPress={handleSignOut}
          loading={loading}
          disabled={loading}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    color: '#5f6368',
  },
  mainContent: {
    flex: 1,
    marginBottom: 24,
  },
  placeholderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#5f6368',
    lineHeight: 22,
  },
  featureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#1a73e8',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#5f6368',
    lineHeight: 20,
    marginBottom: 16,
  },
  featureButtonContainer: {
    marginTop: 8,
  },
  footer: {
    paddingTop: 16,
  },
});

export default DashboardScreen;
