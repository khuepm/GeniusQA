/**
 * Unit tests for LoadingSpinner component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render with default props', () => {
    const { UNSAFE_getByType } = render(<LoadingSpinner />);

    const spinner = UNSAFE_getByType('ActivityIndicator');
    expect(spinner).toBeTruthy();
    expect(spinner.props.size).toBe('large');
    expect(spinner.props.color).toBe('#007AFF');
  });

  it('should render with small size', () => {
    const { UNSAFE_getByType } = render(<LoadingSpinner size="small" />);

    const spinner = UNSAFE_getByType('ActivityIndicator');
    expect(spinner.props.size).toBe('small');
  });

  it('should render with large size', () => {
    const { UNSAFE_getByType } = render(<LoadingSpinner size="large" />);

    const spinner = UNSAFE_getByType('ActivityIndicator');
    expect(spinner.props.size).toBe('large');
  });

  it('should render with custom color', () => {
    const { UNSAFE_getByType } = render(<LoadingSpinner color="#FF0000" />);

    const spinner = UNSAFE_getByType('ActivityIndicator');
    expect(spinner.props.color).toBe('#FF0000');
  });

  it('should render with custom size and color', () => {
    const { UNSAFE_getByType } = render(
      <LoadingSpinner size="small" color="#00FF00" />
    );

    const spinner = UNSAFE_getByType('ActivityIndicator');
    expect(spinner.props.size).toBe('small');
    expect(spinner.props.color).toBe('#00FF00');
  });
});
