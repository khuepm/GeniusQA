/**
 * Test Case Validation Utilities
 * 
 * Provides validation functions for test case data to ensure
 * all required fields are present and properly formatted.
 * 
 * Requirements: 5.1, 5.4, 5.5
 */

import {
  TestCase,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '../types/aiTestCaseGenerator.types';

/**
 * Validates a test case and returns validation results
 */
export function validateTestCase(testCase: TestCase): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate required fields
  if (!testCase.title?.trim()) {
    errors.push({
      field: 'title',
      message: 'Title is required',
      severity: 'error'
    });
  }

  if (!testCase.description?.trim()) {
    errors.push({
      field: 'description',
      message: 'Description is required',
      severity: 'error'
    });
  }

  if (!testCase.expected_result?.trim()) {
    errors.push({
      field: 'expected_result',
      message: 'Expected result is required',
      severity: 'error'
    });
  }

  // Validate test steps
  if (!testCase.steps || testCase.steps.length === 0) {
    errors.push({
      field: 'steps',
      message: 'At least one test step is required',
      severity: 'error'
    });
  } else {
    testCase.steps.forEach((step, index) => {
      if (!step.action?.trim()) {
        errors.push({
          field: `steps.${index}.action`,
          message: `Step ${index + 1} action is required`,
          severity: 'error'
        });
      }

      // Check for reasonable step order
      if (step.order !== index + 1) {
        warnings.push({
          field: `steps.${index}.order`,
          message: `Step order should be ${index + 1}`,
          suggestion: 'Steps should be numbered sequentially starting from 1'
        });
      }
    });
  }

  // Validate ID format (should be UUID-like)
  if (!testCase.id || !/^[a-f0-9-]{36}$/i.test(testCase.id)) {
    warnings.push({
      field: 'id',
      message: 'Test case ID should be a valid UUID',
      suggestion: 'Generate a new UUID for the test case'
    });
  }

  // Check for reasonable title length
  if (testCase.title && testCase.title.length > 200) {
    warnings.push({
      field: 'title',
      message: 'Title is very long',
      suggestion: 'Consider shortening the title to under 200 characters'
    });
  }

  // Check for reasonable description length
  if (testCase.description && testCase.description.length > 1000) {
    warnings.push({
      field: 'description',
      message: 'Description is very long',
      suggestion: 'Consider shortening the description or moving details to test steps'
    });
  }

  // Check for empty preconditions
  if (testCase.preconditions === '') {
    warnings.push({
      field: 'preconditions',
      message: 'Preconditions are empty',
      suggestion: 'Consider adding preconditions or set to null if not needed'
    });
  }

  // Validate metadata
  if (!testCase.metadata) {
    errors.push({
      field: 'metadata',
      message: 'Metadata is required',
      severity: 'error'
    });
  } else {
    if (!testCase.metadata.created_at) {
      errors.push({
        field: 'metadata.created_at',
        message: 'Creation timestamp is required',
        severity: 'error'
      });
    }

    if (!testCase.metadata.generated_by) {
      errors.push({
        field: 'metadata.generated_by',
        message: 'Generator information is required',
        severity: 'error'
      });
    }
  }

  return {
    is_valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates multiple test cases and returns aggregated results
 */
export function validateTestCases(testCases: TestCase[]): ValidationResult[] {
  return testCases.map(testCase => validateTestCase(testCase));
}

/**
 * Checks if a test case has any validation issues
 */
export function hasValidationIssues(testCase: TestCase): boolean {
  const result = validateTestCase(testCase);
  return !result.is_valid || result.warnings.length > 0;
}

/**
 * Gets a summary of validation issues across multiple test cases
 */
export function getValidationSummary(testCases: TestCase[]): {
  totalCases: number;
  validCases: number;
  casesWithErrors: number;
  casesWithWarnings: number;
  totalErrors: number;
  totalWarnings: number;
} {
  const results = validateTestCases(testCases);
  
  return {
    totalCases: testCases.length,
    validCases: results.filter(r => r.is_valid && r.warnings.length === 0).length,
    casesWithErrors: results.filter(r => !r.is_valid).length,
    casesWithWarnings: results.filter(r => r.is_valid && r.warnings.length > 0).length,
    totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0)
  };
}

/**
 * Auto-fixes common validation issues in a test case
 */
export function autoFixTestCase(testCase: TestCase): TestCase {
  const fixed = { ...testCase };

  // Fix step ordering
  if (fixed.steps) {
    fixed.steps = fixed.steps.map((step, index) => ({
      ...step,
      order: index + 1
    }));
  }

  // Trim whitespace from text fields
  if (fixed.title) {
    fixed.title = fixed.title.trim();
  }
  
  if (fixed.description) {
    fixed.description = fixed.description.trim();
  }
  
  if (fixed.expected_result) {
    fixed.expected_result = fixed.expected_result.trim();
  }

  if (fixed.preconditions) {
    fixed.preconditions = fixed.preconditions.trim();
    // Convert empty string to null
    if (fixed.preconditions === '') {
      fixed.preconditions = undefined;
    }
  }

  // Fix step actions
  if (fixed.steps) {
    fixed.steps = fixed.steps.map(step => ({
      ...step,
      action: step.action?.trim() || '',
      expected_outcome: step.expected_outcome?.trim() || undefined,
      notes: step.notes?.trim() || undefined
    }));
  }

  return fixed;
}
