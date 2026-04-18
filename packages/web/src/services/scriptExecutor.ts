export interface ScriptStep {
  id: string;
  action: string;
  target: string;
  value?: string;
  delay?: number;
}

export interface ExecutionResult {
  success: boolean;
  message: string;
  error?: string;
  stepResults?: StepResult[];
}

export interface StepResult {
  stepId: string;
  success: boolean;
  message: string;
  error?: string;
  timestamp: string;
}

export interface ExecutionOptions {
  onStepComplete?: (result: StepResult) => void;
  onProgress?: (current: number, total: number) => void;
}

export class ScriptExecutor {
  private isRunning = false;
  private shouldStop = false;

  async executeScript(
    scriptContent: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Another script is already running',
        error: 'ALREADY_RUNNING'
      };
    }

    this.isRunning = true;
    this.shouldStop = false;

    try {
      // Parse script content
      let steps: ScriptStep[];
      try {
        const parsed = JSON.parse(scriptContent);
        steps = Array.isArray(parsed) ? parsed : parsed.steps || [];
      } catch (error) {
        return {
          success: false,
          message: 'Invalid script format',
          error: 'PARSE_ERROR'
        };
      }

      if (steps.length === 0) {
        return {
          success: false,
          message: 'No steps found in script',
          error: 'NO_STEPS'
        };
      }

      const stepResults: StepResult[] = [];
      
      for (let i = 0; i < steps.length; i++) {
        if (this.shouldStop) {
          break;
        }

        const step = steps[i];
        options.onProgress?.(i + 1, steps.length);

        const stepResult = await this.executeStep(step);
        stepResults.push(stepResult);
        options.onStepComplete?.(stepResult);

        if (!stepResult.success) {
          return {
            success: false,
            message: `Script failed at step ${i + 1}: ${stepResult.message}`,
            error: 'STEP_FAILED',
            stepResults
          };
        }

        // Add delay between steps if specified
        if (step.delay && step.delay > 0) {
          await this.delay(step.delay);
        }
      }

      return {
        success: true,
        message: `Script completed successfully. Executed ${stepResults.length} steps.`,
        stepResults
      };

    } catch (error) {
      return {
        success: false,
        message: 'Unexpected error during script execution',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    } finally {
      this.isRunning = false;
      this.shouldStop = false;
    }
  }

  private async executeStep(step: ScriptStep): Promise<StepResult> {
    const timestamp = new Date().toISOString();

    try {
      // For guest mode, we'll simulate script execution
      // In a real implementation, this would interact with the desktop app
      // or browser automation APIs
      
      switch (step.action.toLowerCase()) {
        case 'click':
          return await this.simulateClick(step, timestamp);
        case 'type':
        case 'input':
          return await this.simulateType(step, timestamp);
        case 'wait':
          return await this.simulateWait(step, timestamp);
        case 'scroll':
          return await this.simulateScroll(step, timestamp);
        case 'navigate':
          return await this.simulateNavigate(step, timestamp);
        default:
          return {
            stepId: step.id,
            success: false,
            message: `Unknown action: ${step.action}`,
            error: 'UNKNOWN_ACTION',
            timestamp
          };
      }
    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        message: `Failed to execute step: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: 'EXECUTION_ERROR',
        timestamp
      };
    }
  }

  private async simulateClick(step: ScriptStep, timestamp: string): Promise<StepResult> {
    // Simulate click action
    await this.delay(100); // Simulate processing time
    
    return {
      stepId: step.id,
      success: true,
      message: `Clicked on "${step.target}"`,
      timestamp
    };
  }

  private async simulateType(step: ScriptStep, timestamp: string): Promise<StepResult> {
    // Simulate typing action
    const text = step.value || '';
    await this.delay(text.length * 50); // Simulate typing time
    
    return {
      stepId: step.id,
      success: true,
      message: `Typed "${text}" into "${step.target}"`,
      timestamp
    };
  }

  private async simulateWait(step: ScriptStep, timestamp: string): Promise<StepResult> {
    const waitTime = parseInt(step.value || '1000');
    await this.delay(waitTime);
    
    return {
      stepId: step.id,
      success: true,
      message: `Waited ${waitTime}ms`,
      timestamp
    };
  }

  private async simulateScroll(step: ScriptStep, timestamp: string): Promise<StepResult> {
    await this.delay(200);
    
    return {
      stepId: step.id,
      success: true,
      message: `Scrolled to "${step.target}"`,
      timestamp
    };
  }

  private async simulateNavigate(step: ScriptStep, timestamp: string): Promise<StepResult> {
    await this.delay(500);
    
    return {
      stepId: step.id,
      success: true,
      message: `Navigated to "${step.value || step.target}"`,
      timestamp
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop(): void {
    this.shouldStop = true;
  }

  isExecuting(): boolean {
    return this.isRunning;
  }
}

// Singleton instance for the application
export const scriptExecutor = new ScriptExecutor();
