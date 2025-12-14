/**
 * Unit tests for AuthButton component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthButton } from '../AuthButton';

describe('AuthButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with title', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} />
    );

    expect(getByText('Sign In')).toBeInTheDocument();
  });

  it('should call onPress when clicked', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} />
    );

    const button = getByText('Sign In');
    fireEvent.click(button);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('should render primary variant by default', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} />
    );

    const button = getByText('Sign In').closest('button');
    expect(button).toHaveClass('auth-button-primary');
  });

  it('should render secondary variant', () => {
    const { getByText } = render(
      <AuthButton title="Cancel" onPress={mockOnPress} variant="secondary" />
    );

    const button = getByText('Cancel').closest('button');
    expect(button).toHaveClass('auth-button-secondary');
  });

  it('should render google variant', () => {
    const { getByText } = render(
      <AuthButton title="Sign in with Google" onPress={mockOnPress} variant="google" />
    );

    const button = getByText('Sign in with Google').closest('button');
    expect(button).toHaveClass('auth-button-google');
  });

  it('should show loading spinner when loading', () => {
    const { queryByText, container } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} loading={true} />
    );

    expect(queryByText('Sign In')).not.toBeInTheDocument();
    expect(container.querySelector('.auth-button-spinner')).toBeInTheDocument();
  });

  it('should not call onPress when disabled', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} disabled={true} />
    );

    const button = getByText('Sign In').closest('button');
    fireEvent.click(button!);

    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('should not call onPress when loading', () => {
    const { container } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} loading={true} />
    );

    const button = container.querySelector('button');
    fireEvent.click(button!);

    expect(mockOnPress).not.toHaveBeenCalled();
  });
});
