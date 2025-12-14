import React from 'react';
import './AuthButton.css';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'google';
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}) => {
  const isDisabled = disabled || loading;

  const buttonClasses = [
    'auth-button',
    `auth-button-${variant}`,
    isDisabled && 'auth-button-disabled',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={buttonClasses}
      onClick={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <span className="auth-button-spinner" />
      ) : (
        <span className="auth-button-text">{title}</span>
      )}
    </button>
  );
};
