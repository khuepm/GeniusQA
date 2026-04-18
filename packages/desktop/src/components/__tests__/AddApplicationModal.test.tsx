/**
 * Unit tests for AddApplicationModal component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddApplicationModal } from '../AddApplicationModal';
import { FocusLossStrategy } from '../../types/applicationFocusedAutomation.types';

describe('AddApplicationModal', () => {
  const mockOnClose = jest.fn();
  const mockOnAddApplication = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onAddApplication: mockOnAddApplication,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <AddApplicationModal {...defaultProps} isOpen={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render modal when isOpen is true', () => {
    const { getByRole } = render(<AddApplicationModal {...defaultProps} />);

    expect(getByRole('heading', { name: 'Add Application' })).toBeInTheDocument();
  });

  it('should render all form fields', () => {
    const { getByLabelText } = render(<AddApplicationModal {...defaultProps} />);

    expect(getByLabelText(/application name/i)).toBeInTheDocument();
    expect(getByLabelText(/executable path/i)).toBeInTheDocument();
    expect(getByLabelText(/process name/i)).toBeInTheDocument();
    expect(getByLabelText(/bundle id/i)).toBeInTheDocument();
    expect(getByLabelText(/default focus strategy/i)).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const { getByText } = render(<AddApplicationModal {...defaultProps} />);

    const closeButton = getByText('×');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when cancel button is clicked', () => {
    const { getByText } = render(<AddApplicationModal {...defaultProps} />);

    const cancelButton = getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', () => {
    const { container } = render(<AddApplicationModal {...defaultProps} />);

    const overlay = container.querySelector('.modal-overlay');
    fireEvent.click(overlay!);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when modal content is clicked', () => {
    const { container } = render(<AddApplicationModal {...defaultProps} />);

    const modalContent = container.querySelector('.modal-content');
    fireEvent.click(modalContent!);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should update form fields when typed in', () => {
    const { getByLabelText } = render(<AddApplicationModal {...defaultProps} />);

    const nameInput = getByLabelText(/application name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Test App' } });

    expect(nameInput.value).toBe('Test App');
  });

  it('should prevent submission when required fields are empty', async () => {
    const { getByRole } = render(<AddApplicationModal {...defaultProps} />);

    const submitButton = getByRole('button', { name: /add application/i });
    fireEvent.click(submitButton);

    // The form should prevent submission when fields are empty
    // We can verify this by checking that onAddApplication was not called
    expect(mockOnAddApplication).not.toHaveBeenCalled();
  });

  it('should call onAddApplication with form data when valid form is submitted', async () => {
    const { getByLabelText, getByRole } = render(<AddApplicationModal {...defaultProps} />);

    // Fill in required fields
    fireEvent.change(getByLabelText(/application name/i), { target: { value: 'Test App' } });
    fireEvent.change(getByLabelText(/executable path/i), { target: { value: '/test/path' } });
    fireEvent.change(getByLabelText(/process name/i), { target: { value: 'TestProcess' } });

    const submitButton = getByRole('button', { name: /add application/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnAddApplication).toHaveBeenCalledWith({
        name: 'Test App',
        executable_path: '/test/path',
        process_name: 'TestProcess',
        bundle_id: undefined,
        process_id: 0,
      });
    }, { timeout: 3000 });
  });

  it('should include bundle_id when provided', async () => {
    const { getByLabelText, getByRole } = render(<AddApplicationModal {...defaultProps} />);

    // Fill in all fields including bundle_id
    fireEvent.change(getByLabelText(/application name/i), { target: { value: 'Test App' } });
    fireEvent.change(getByLabelText(/executable path/i), { target: { value: '/test/path' } });
    fireEvent.change(getByLabelText(/process name/i), { target: { value: 'TestProcess' } });
    fireEvent.change(getByLabelText(/bundle id/i), { target: { value: 'com.test.app' } });

    const submitButton = getByRole('button', { name: /add application/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnAddApplication).toHaveBeenCalledWith({
        name: 'Test App',
        executable_path: '/test/path',
        process_name: 'TestProcess',
        bundle_id: 'com.test.app',
        process_id: 0,
      });
    }, { timeout: 3000 });
  });

  it('should trim whitespace from form fields', async () => {
    const { getByLabelText, getByRole } = render(<AddApplicationModal {...defaultProps} />);

    // Fill in fields with extra whitespace
    fireEvent.change(getByLabelText(/application name/i), { target: { value: '  Test App  ' } });
    fireEvent.change(getByLabelText(/executable path/i), { target: { value: '  /test/path  ' } });
    fireEvent.change(getByLabelText(/process name/i), { target: { value: '  TestProcess  ' } });

    const submitButton = getByRole('button', { name: /add application/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnAddApplication).toHaveBeenCalledWith({
        name: 'Test App',
        executable_path: '/test/path',
        process_name: 'TestProcess',
        bundle_id: undefined,
        process_id: 0,
      });
    }, { timeout: 3000 });
  });

  it('should change focus strategy selection', () => {
    const { getByLabelText } = render(<AddApplicationModal {...defaultProps} />);

    const focusStrategySelect = getByLabelText(/default focus strategy/i) as HTMLSelectElement;
    fireEvent.change(focusStrategySelect, { target: { value: FocusLossStrategy.StrictError } });

    expect(focusStrategySelect.value).toBe(FocusLossStrategy.StrictError);
  });

  it('should render all focus strategy options', () => {
    const { getByText } = render(<AddApplicationModal {...defaultProps} />);

    expect(getByText('Auto Pause - Pause when focus is lost')).toBeInTheDocument();
    expect(getByText('Strict Error - Stop immediately on focus loss')).toBeInTheDocument();
    expect(getByText('Ignore - Continue with warnings')).toBeInTheDocument();
  });

  it('should render browse button', () => {
    const { getByText } = render(<AddApplicationModal {...defaultProps} />);

    expect(getByText('Browse')).toBeInTheDocument();
  });

  it('should render detect running apps button', () => {
    const { getByText } = render(<AddApplicationModal {...defaultProps} />);

    expect(getByText('🔍 Detect Running Apps')).toBeInTheDocument();
  });

  it('should disable submit button when submitting', async () => {
    const { getByLabelText, getByRole } = render(<AddApplicationModal {...defaultProps} />);

    // Fill in required fields
    fireEvent.change(getByLabelText(/application name/i), { target: { value: 'Test App' } });
    fireEvent.change(getByLabelText(/executable path/i), { target: { value: '/test/path' } });
    fireEvent.change(getByLabelText(/process name/i), { target: { value: 'TestProcess' } });

    const submitButton = getByRole('button', { name: /add application/i });
    fireEvent.click(submitButton);

    // Button should show loading state
    expect(getByRole('button', { name: /adding.../i })).toBeInTheDocument();
  });

  it('should reset form when modal opens', () => {
    const { getByLabelText, rerender } = render(
      <AddApplicationModal {...defaultProps} isOpen={false} />
    );

    // Reopen modal
    rerender(<AddApplicationModal {...defaultProps} isOpen={true} />);

    const nameInput = getByLabelText(/application name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('');
  });

  it('should handle form field changes without errors', async () => {
    const { getByLabelText, container } = render(<AddApplicationModal {...defaultProps} />);

    // Change a field - this should not throw any errors
    fireEvent.change(getByLabelText(/application name/i), { target: { value: 'Test' } });

    // Component should render without issues
    expect(container.querySelector('.modal-content')).toBeInTheDocument();
  });
});
