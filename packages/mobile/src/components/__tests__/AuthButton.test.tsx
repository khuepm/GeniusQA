/**
 * Unit tests for AuthButton component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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

    expect(getByText('Sign In')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} />
    );

    const button = getByText('Sign In');
    fireEvent.press(button);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('should render primary variant by default', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} />
    );

    expect(getByText('Sign In')).toBeTruthy();
  });

  it('should render secondary variant', () => {
    const { getByText } = render(
      <AuthButton title="Cancel" onPress={mockOnPress} variant="secondary" />
    );

    expect(getByText('Cancel')).toBeTruthy();
  });

  it('should render google variant', () => {
    const { getByText } = render(
      <AuthButton title="Sign in with Google" onPress={mockOnPress} variant="google" />
    );

    expect(getByText('Sign in with Google')).toBeTruthy();
  });

  it('should show loading spinner when loading', () => {
    const { queryByText, UNSAFE_getByType } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} loading={true} />
    );

    expect(queryByText('Sign In')).toBeNull();
    expect(UNSAFE_getByType('ActivityIndicator')).toBeTruthy();
  });

  it('should not call onPress when disabled', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} disabled={true} />
    );

    const button = getByText('Sign In');
    fireEvent.press(button);

    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('should not call onPress when loading', () => {
    const { UNSAFE_getByType } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} loading={true} />
    );

    const button = UNSAFE_getByType('TouchableOpacity');
    fireEvent.press(button);

    expect(mockOnPress).not.toHaveBeenCalled();
  });
});
