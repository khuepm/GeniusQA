/**
 * Icon System
 * Centralized SVG icon components with consistent sizing and styling
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import React from 'react';

// Base icon props interface
export interface IconProps {
  size?: number;
  color?: string;
  opacity?: number;
  className?: string;
}

// Icon type definitions
export type IconType = 'record' | 'play' | 'stop' | 'save' | 'open' | 'clear' | 'settings';

// Helper function to ensure valid opacity
const getValidOpacity = (opacity?: number): number => {
  return typeof opacity === 'number' && !isNaN(opacity) ? opacity : 1;
};

// Individual icon components
export const RecordIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ opacity: getValidOpacity(opacity) }}
      {...props}
    >
      <circle cx="8" cy="8" r="6" fill={color} />
    </svg>
  );
};

export const PlayIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ opacity: getValidOpacity(opacity) }}
      {...props}
    >
      <path d="M3 2l10 6-10 6V2z" fill={color} />
    </svg>
  );
};

export const StopIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ opacity: getValidOpacity(opacity) }}
      {...props}
    >
      <rect x="3" y="3" width="10" height="10" fill={color} />
    </svg>
  );
};

export const SaveIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ opacity: getValidOpacity(opacity) }}
      {...props}
    >
      <path d="M2 2v12h12V4.5L11.5 2H2zm8 1v3H4V3h6zm1 4v7H3V7h8z" fill={color} />
    </svg>
  );
};

export const OpenIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ opacity: getValidOpacity(opacity) }}
      {...props}
    >
      <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" fill={color} />
    </svg>
  );
};

export const ClearIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ opacity: getValidOpacity(opacity) }}
      {...props}
    >
      <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z" fill={color} />
    </svg>
  );
};

export const SettingsIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ opacity: getValidOpacity(opacity) }}
      {...props}
    >
      <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" fill={color} />
      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" fill={color} />
    </svg>
  );
};

// Icon component mapping for dynamic access
export const ICON_COMPONENTS: Record<IconType, React.FC<IconProps>> = {
  record: RecordIcon,
  play: PlayIcon,
  stop: StopIcon,
  save: SaveIcon,
  open: OpenIcon,
  clear: ClearIcon,
  settings: SettingsIcon,
};

// Utility function to get icon component by type
export const getIcon = (type: IconType): React.FC<IconProps> => {
  return ICON_COMPONENTS[type];
};

// Default export for convenience
export default {
  RecordIcon,
  PlayIcon,
  StopIcon,
  SaveIcon,
  OpenIcon,
  ClearIcon,
  SettingsIcon,
  ICON_COMPONENTS,
  getIcon,
};
