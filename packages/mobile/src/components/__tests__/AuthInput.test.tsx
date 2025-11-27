/**
 * Unit tests for AuthInput component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AuthInput } from '../AuthInput';

describe('AuthInput', () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with basic props', () => {
    const { getByPlaceholderText } = render(
      <AuthInput
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter email"
      />
    );

    expect(getByPlaceholderText('Enter email')).toBeTruthy();
  });

  it('should display the current value', () => {
    const { getByDisplayValue } = render(
      <AuthInput
        value="test@example.com"
        onChangeText={mockOnChangeText}
        placeholder="Enter email"
      />
    );

    expect(getByDisplayValue('test@example.com')).toBeTruthy();
  });

  it('should call onChangeText when text changes', () => {
    const { getByPlaceholderText } = render(
      <AuthInput
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter email"
      />
    );

    const input = getByPlaceholderText('Enter email');
    fireEvent.changeText(input, 'new@example.com');

    expect(mockOnChangeText).toHaveBeenCalledWith('new@example.com');
  });

  it('should render with secure text entry for passwords', () => {
    const { getByPlaceholderText } = render(
      <AuthInput
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter password"
        secureTextEntry={true}
      />
    );

    const input = getByPlaceholderText('Enter password');
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('should apply email keyboard type', () => {
    const { getByPlaceholderText } = render(
      <AuthInput
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter email"
        keyboardType="email-address"
      />
    );

    const input = getByPlaceholderText('Enter email');
    expect(input.props.keyboardType).toBe('email-address');
  });

  it('should apply autoCapitalize prop', () => {
    const { getByPlaceholderText } = render(
      <AuthInput
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter text"
        autoCapitalize="none"
      />
    );

    const input = getByPlaceholderText('Enter text');
    expect(input.props.autoCapitalize).toBe('none');
  });

  it('should be disabled when editable is false', () => {
    const { getByPlaceholderText } = render(
      <AuthInput
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter email"
        editable={false}
      />
    );

    const input = getByPlaceholderText('Enter email');
    expect(input.props.editable).toBe(false);
  });

  it('should render with label when provided', () => {
    const { getByText } = render(
      <AuthInput
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter email"
        label="Email Address"
      />
    );

    expect(getByText('Email Address')).toBeTruthy();
  });
});
