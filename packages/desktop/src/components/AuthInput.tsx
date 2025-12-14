import React from 'react';
import './AuthInput.css';

interface AuthInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  label?: string;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  label,
}) => {
  const inputType = secureTextEntry ? 'password' : keyboardType === 'email-address' ? 'email' : 'text';

  return (
    <div className="auth-input-container">
      {label && <label className="auth-input-label">{label}</label>}
      <input
        className={`auth-input ${!editable ? 'auth-input-disabled' : ''}`}
        type={inputType}
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder={placeholder}
        disabled={!editable}
        autoCapitalize={autoCapitalize}
        autoCorrect="off"
      />
    </div>
  );
};
