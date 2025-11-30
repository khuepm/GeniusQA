/**
 * Unit tests for LoadingSpinner component
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render with default props', () => {
    const { container } = render(<LoadingSpinner />);

    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('loading-spinner-large');
    expect(spinner).toHaveStyle({ borderTopColor: '#007AFF' });
  });

  it('should render with small size', () => {
    const { container } = render(<LoadingSpinner size="small" />);

    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toHaveClass('loading-spinner-small');
  });

  it('should render with large size', () => {
    const { container } = render(<LoadingSpinner size="large" />);

    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toHaveClass('loading-spinner-large');
  });

  it('should render with custom color', () => {
    const { container } = render(<LoadingSpinner color="#FF0000" />);

    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toHaveStyle({ borderTopColor: '#FF0000' });
  });

  it('should render with custom size and color', () => {
    const { container } = render(
      <LoadingSpinner size="small" color="#00FF00" />
    );

    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toHaveClass('loading-spinner-small');
    expect(spinner).toHaveStyle({ borderTopColor: '#00FF00' });
  });
});
