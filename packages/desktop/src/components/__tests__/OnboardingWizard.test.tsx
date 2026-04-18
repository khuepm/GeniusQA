/**
 * OnboardingWizard Component Tests
 * 
 * Tests the onboarding wizard functionality for application-focused automation.
 * 
 * Requirements: Task 18.1 - Feature onboarding flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingWizard } from '../OnboardingWizard';
import { onboardingService } from '../../services/onboardingService';

// Mock the onboarding service
jest.mock('../../services/onboardingService', () => ({
  onboardingService: {
    initialize: jest.fn(),
    getOnboardingSteps: jest.fn(),
    getCurrentStep: jest.fn(),
    checkPermissions: jest.fn(),
    completeStep: jest.fn(),
    skipOnboarding: jest.fn(),
  },
}));

// Mock Tauri API
jest.mock('@tauri-apps/api/tauri', () => ({
  invoke: jest.fn(),
}));

const mockOnboardingService = onboardingService as jest.Mocked<typeof onboardingService>;

describe('OnboardingWizard', () => {
  const defaultProps = {
    isOpen: true,
    onComplete: jest.fn(),
    onSkip: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    mockOnboardingService.initialize.mockResolvedValue();
    mockOnboardingService.getOnboardingSteps.mockReturnValue([
      {
        id: 'welcome',
        title: 'Welcome',
        description: 'Welcome to the feature',
        component: 'welcome',
        isRequired: true,
      },
    ]);
    mockOnboardingService.getCurrentStep.mockReturnValue({
      id: 'welcome',
      title: 'Welcome',
      description: 'Welcome to the feature',
      component: 'welcome',
      isRequired: true,
    });
  });

  it('should render loading state initially', () => {
    render(<OnboardingWizard {...defaultProps} />);

    expect(screen.getByText('Initializing setup wizard...')).toBeInTheDocument();
  });

  it('should initialize onboarding service when opened', async () => {
    render(<OnboardingWizard {...defaultProps} />);

    await waitFor(() => {
      expect(mockOnboardingService.initialize).toHaveBeenCalled();
    });
  });

  it('should render welcome step after initialization', async () => {
    render(<OnboardingWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
    });
  });

  it('should show progress indicator', async () => {
    render(<OnboardingWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // Step number
    });
  });

  it('should not render when isOpen is false', () => {
    render(<OnboardingWizard {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Welcome')).not.toBeInTheDocument();
  });

  it('should handle step completion', async () => {
    render(<OnboardingWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Get Started'));

    expect(mockOnboardingService.completeStep).toHaveBeenCalledWith('welcome');
  });

  it('should handle skip functionality', async () => {
    render(<OnboardingWizard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Skip Setup')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Skip Setup'));

    expect(mockOnboardingService.skipOnboarding).toHaveBeenCalled();
    expect(defaultProps.onComplete).toHaveBeenCalled();
  });
});
