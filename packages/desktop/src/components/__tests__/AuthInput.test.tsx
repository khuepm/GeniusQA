/**
 * Unit tests for AuthInput component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
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

    expect(getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('should display the current value', () => {
    const { getByDisplayValue } = render(
      <AuthInput
        value="test@example.com"
        onChangeText={mockOnChangeText}
        placeholder="Enter email"
      />
    );

    expect(getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  it('should call onChangeText when text changes', () => {
    const { getByPlaceholderText } = render(
      <AuthInput
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Enter email"
      />
    );

    const input = getByPlaceholderText('Enter email') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'new@example.com' } });

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

    const input = getByPlaceholderText('Enter password') as HTMLInputElement;
    expect(input.type).toBe('password');
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

    const input = getByPlaceholderText('Enter email') as HTMLInputElement;
    expect(input.type).toBe('email');
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

    const input = getByPlaceholderText('Enter text') as HTMLInputElement;
    expect(input.getAttribute('autocapitalize')).toBe('none');
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

    const input = getByPlaceholderText('Enter email') as HTMLInputElement;
    expect(input.disabled).toBe(true);
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

    expect(getByText('Email Address')).toBeInTheDocument();
  });
});
