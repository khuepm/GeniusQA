import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = '#007AFF',
}) => {
  return (
    <div className="loading-spinner-container">
      <div
        className={`loading-spinner ${size === 'small' ? 'loading-spinner-small' : 'loading-spinner-large'}`}
        style={{ borderTopColor: color }}
      />
    </div>
  );
};
