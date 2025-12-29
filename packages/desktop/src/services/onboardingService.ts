/**
 * Onboarding Service for Application-Focused Automation Feature
 * 
 * Manages first-time user guidance, permission checks, and setup wizard state.
 * Tracks onboarding completion status and provides platform-specific guidance.
 * 
 * Requirements: Task 18.1 - Feature onboarding flow
 */

import { invoke } from '@tauri-apps/api/tauri';

// Local storage keys for onboarding state
const ONBOARDING_STORAGE_KEY = 'geniusqa_automation_onboarding';
const PERMISSIONS_CHECK_KEY = 'geniusqa_permissions_last_check';

/**
 * Onboarding step definitions
 */
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: 'welcome' | 'permissions' | 'setup' | 'complete';
  isRequired: boolean;
  platformSpecific?: 'macos' | 'windows';
}

/**
 * Onboarding state stored in localStorage
 */
export interface OnboardingState {
  isCompleted: boolean;
  completedSteps: string[];
  currentStep: string | null;
  lastCompletedAt?: string;
  permissionsGranted: boolean;
  platformChecked?: string;
}

/**
 * Permission check result
 */
export interface PermissionStatus {
  isGranted: boolean;
  isRequired: boolean;
  platform: string;
  message: string;
  instructions?: string[];
}

/**
 * Default onboarding steps
 */
const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Application-Focused Automation',
    description: 'Learn how to automate tasks within specific applications while maintaining focus control.',
    component: 'welcome',
    isRequired: true,
  },
  {
    id: 'permissions-macos',
    title: 'Enable Accessibility Permissions',
    description: 'Grant accessibility permissions to monitor application focus on macOS.',
    component: 'permissions',
    isRequired: true,
    platformSpecific: 'macos',
  },
  {
    id: 'permissions-windows',
    title: 'System Permissions',
    description: 'Verify system permissions for application monitoring on Windows.',
    component: 'permissions',
    isRequired: true,
    platformSpecific: 'windows',
  },
  {
    id: 'setup',
    title: 'Initial Configuration',
    description: 'Configure default settings for focus strategies and monitoring options.',
    component: 'setup',
    isRequired: false,
  },
  {
    id: 'complete',
    title: 'Setup Complete',
    description: 'You\'re ready to start using application-focused automation!',
    component: 'complete',
    isRequired: true,
  },
];

/**
 * Onboarding Service class
 */
class OnboardingService {
  private currentPlatform: string | null = null;

  /**
   * Initialize the service and detect platform
   */
  async initialize(): Promise<void> {
    try {
      this.currentPlatform = await invoke<string>('get_platform_info');
    } catch (error) {
      console.warn('Failed to detect platform:', error);
      this.currentPlatform = 'unknown';
    }
  }

  /**
   * Check if onboarding is needed for the current user
   */
  isOnboardingNeeded(): boolean {
    const state = this.getOnboardingState();
    return !state.isCompleted;
  }

  /**
   * Get current onboarding state from localStorage
   */
  getOnboardingState(): OnboardingState {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as OnboardingState;
        // Check if platform has changed since last onboarding
        // Only check if currentPlatform is initialized to avoid false resets on load
        if (this.currentPlatform && state.platformChecked && state.platformChecked !== this.currentPlatform) {
          // Reset onboarding if platform changed
          return this.getDefaultOnboardingState();
        }
        return state;
      }
    } catch (error) {
      console.warn('Failed to load onboarding state:', error);
    }
    return this.getDefaultOnboardingState();
  }

  /**
   * Get default onboarding state
   */
  private getDefaultOnboardingState(): OnboardingState {
    return {
      isCompleted: false,
      completedSteps: [],
      currentStep: null,
      permissionsGranted: false,
      platformChecked: this.currentPlatform || undefined,
    };
  }

  /**
   * Save onboarding state to localStorage
   */
  private saveOnboardingState(state: OnboardingState): void {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  }

  /**
   * Get onboarding steps for current platform
   */
  getOnboardingSteps(): OnboardingStep[] {
    return DEFAULT_STEPS.filter(step => {
      if (!step.platformSpecific) return true;
      return step.platformSpecific === this.currentPlatform;
    });
  }

  /**
   * Get current step in onboarding flow
   */
  getCurrentStep(): OnboardingStep | null {
    const state = this.getOnboardingState();
    const steps = this.getOnboardingSteps();
    
    // Try to find the stored current step
    if (state.currentStep) {
      const step = steps.find(step => step.id === state.currentStep);
      // If found, return it. If not found, it means state is invalid, fall through to default logic.
      if (step) return step;
    }

    // Find first incomplete step
    const incompleteStep = steps.find(step => !state.completedSteps.includes(step.id));
    
    // If all are complete but we are here, return null? Or should we show the last step?
    // If onboarding is marked incomplete but all steps are done, return complete step
    if (!incompleteStep) {
       // Return the last step (Complete) if no incomplete steps found
       return steps[steps.length - 1] || null;
    }

    return incompleteStep || null;
  }

  /**
   * Mark a step as completed
   */
  completeStep(stepId: string): void {
    const state = this.getOnboardingState();
    
    if (!state.completedSteps.includes(stepId)) {
      state.completedSteps.push(stepId);
    }

    // Check if all required steps are completed
    const steps = this.getOnboardingSteps();
    const requiredSteps = steps.filter(step => step.isRequired);
    const allRequiredCompleted = requiredSteps.every(step => 
      state.completedSteps.includes(step.id)
    );

    if (allRequiredCompleted) {
      state.isCompleted = true;
      state.lastCompletedAt = new Date().toISOString();
    }

    // Set next step
    const nextStep = this.getNextStep(stepId);
    state.currentStep = nextStep?.id || null;

    this.saveOnboardingState(state);
  }

  /**
   * Get next step after the given step
   */
  private getNextStep(currentStepId: string): OnboardingStep | null {
    const steps = this.getOnboardingSteps();
    const currentIndex = steps.findIndex(step => step.id === currentStepId);
    
    if (currentIndex >= 0 && currentIndex < steps.length - 1) {
      return steps[currentIndex + 1];
    }
    
    return null;
  }

  /**
   * Skip onboarding (for advanced users)
   */
  skipOnboarding(): void {
    const state = this.getOnboardingState();
    state.isCompleted = true;
    state.lastCompletedAt = new Date().toISOString();
    state.currentStep = null;
    this.saveOnboardingState(state);
  }

  /**
   * Reset onboarding state (for testing or re-onboarding)
   */
  resetOnboarding(): void {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    localStorage.removeItem(PERMISSIONS_CHECK_KEY);
  }

  /**
   * Check system permissions for application monitoring
   */
  async checkPermissions(): Promise<PermissionStatus> {
    try {
      // Cache permission checks for 5 minutes to avoid excessive system calls
      const lastCheck = localStorage.getItem(PERMISSIONS_CHECK_KEY);
      const now = Date.now();
      
      if (lastCheck) {
        const lastCheckTime = parseInt(lastCheck, 10);
        if (now - lastCheckTime < 5 * 60 * 1000) { // 5 minutes
          // Return cached result if available
          const state = this.getOnboardingState();
          if (state.permissionsGranted !== undefined) {
            return this.getPermissionStatusForPlatform(state.permissionsGranted);
          }
        }
      }

      // Check permissions via Tauri command
      const hasPermissions = await this.checkSystemPermissions();
      
      // Update state
      const state = this.getOnboardingState();
      state.permissionsGranted = hasPermissions;
      this.saveOnboardingState(state);
      
      // Cache the check time
      localStorage.setItem(PERMISSIONS_CHECK_KEY, now.toString());
      
      return this.getPermissionStatusForPlatform(hasPermissions);
    } catch (error) {
      console.error('Failed to check permissions:', error);
      return {
        isGranted: false,
        isRequired: true,
        platform: this.currentPlatform || 'unknown',
        message: 'Failed to check system permissions. Please try again.',
      };
    }
  }

  /**
   * Check system permissions via Tauri
   */
  private async checkSystemPermissions(): Promise<boolean> {
    try {
      // Use the existing accessibility permissions check command
      const hasPermissions = await invoke<boolean>('check_accessibility_permissions');
      return hasPermissions;
    } catch (error) {
      console.error('Failed to check accessibility permissions:', error);
      return false;
    }
  }

  /**
   * Get platform-specific permission status
   */
  private getPermissionStatusForPlatform(isGranted: boolean): PermissionStatus {
    const platform = this.currentPlatform || 'unknown';
    
    if (platform === 'macos') {
      return {
        isGranted,
        isRequired: true,
        platform,
        message: isGranted 
          ? 'Accessibility permissions are enabled.'
          : 'Accessibility permissions are required to monitor application focus.',
        instructions: isGranted ? undefined : [
          'Open System Settings (or System Preferences)',
          'Go to Privacy & Security → Accessibility',
          'Find GeniusQA in the list and enable it',
          'If GeniusQA is not listed, click the + button to add it',
          'Restart GeniusQA after granting permissions',
        ],
      };
    } else if (platform === 'windows') {
      return {
        isGranted,
        isRequired: true,
        platform,
        message: isGranted
          ? 'System permissions are configured correctly.'
          : 'System permissions may need to be configured.',
        instructions: isGranted ? undefined : [
          'Run GeniusQA as Administrator if needed',
          'Check Windows Defender settings if automation is blocked',
          'Ensure no antivirus software is blocking GeniusQA',
        ],
      };
    }

    return {
      isGranted: true,
      isRequired: false,
      platform,
      message: 'Platform-specific permissions are not required.',
    };
  }

  /**
   * Open system settings for permissions (platform-specific)
   */
  async openPermissionSettings(): Promise<void> {
    try {
      if (this.currentPlatform === 'macos') {
        await invoke('open_accessibility_settings');
      } else if (this.currentPlatform === 'windows') {
        await invoke('open_system_settings');
      }
    } catch (error) {
      console.error('Failed to open permission settings:', error);
      // Fallback: provide manual instructions
    }
  }

  /**
   * Get platform-specific guidance text
   */
  getPlatformGuidance(): string {
    const platform = this.currentPlatform || 'unknown';
    
    if (platform === 'macos') {
      return 'On macOS, GeniusQA requires Accessibility permissions to monitor which applications are in focus. This ensures automation only runs when your target application is active.';
    } else if (platform === 'windows') {
      return 'On Windows, GeniusQA uses system APIs to monitor application focus. Some antivirus software may require you to whitelist GeniusQA for full functionality.';
    }
    
    return 'GeniusQA monitors application focus to ensure automation runs only within your target applications.';
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();

// Export class for testing
export { OnboardingService };

export default onboardingService;
