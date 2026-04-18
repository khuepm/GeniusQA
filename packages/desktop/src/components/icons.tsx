/**
 * Icon System for Desktop UI
 * SVG-based icon components with consistent sizing and styling
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import React from 'react';

// Helper function to ensure valid opacity value
const normalizeOpacity = (opacity: number): number => {
  if (isNaN(opacity) || opacity < 0 || opacity > 1) {
    return 1;
  }
  return opacity;
};

// Icon type definitions
export type IconType = 'record' | 'play' | 'stop' | 'save' | 'open' | 'clear' | 'settings';

// Icon props interface
export interface IconProps {
  size?: number;
  color?: string;
  opacity?: number;
  className?: string;
}

// Record Icon - Red circle for recording
export const RecordIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    style={{ opacity: normalizeOpacity(opacity) }}
  >
    <circle cx="8" cy="8" r="6" fill={color} />
  </svg>
);

// Play Icon - Right-pointing triangle
export const PlayIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    style={{ opacity: normalizeOpacity(opacity) }}
  >
    <path d="M3 2l10 6-10 6V2z" fill={color} />
  </svg>
);

// Stop Icon - Square
export const StopIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    style={{ opacity: normalizeOpacity(opacity) }}
  >
    <rect x="3" y="3" width="10" height="10" fill={color} />
  </svg>
);

// Save Icon - Floppy disk
export const SaveIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    style={{ opacity: normalizeOpacity(opacity) }}
  >
    <path d="M2 2v12h12V4.5L11.5 2H2zm8 1v3H4V3h6zm1 11H3V6h8v8zm-1-6H4v5h6V8z" fill={color} />
  </svg>
);

// Open Icon - Folder
export const OpenIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    style={{ opacity: normalizeOpacity(opacity) }}
  >
    <path d="M1 3v10h14V5H8L6 3H1zm1 1h4l2 2h7v7H2V4z" fill={color} />
  </svg>
);

// Clear Icon - X or trash can
export const ClearIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    style={{ opacity: normalizeOpacity(opacity) }}
  >
    <path d="M3 4v9h10V4H3zm8 8H5V5h6v7zm-4-6v5h1V6H7zm2 0v5h1V6H9zM6 2h4v1H6V2z" fill={color} />
  </svg>
);

// Settings Icon - Gear
export const SettingsIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  opacity = 1,
  className
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={className}
    style={{ opacity: normalizeOpacity(opacity) }}
  >
    <path d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0-1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill={color} />
    <path d="M6.5 1h3l.5 1.5 1.4.5 1.5-.5L14 3.5l-.5 1.5.5 1.4 1.5.5L14 8.5l-1.5.5-.5 1.4.5 1.5L11.5 13l-1.5-.5-1.4.5-.5 1.5h-3l-.5-1.5-1.4-.5-1.5.5L2 11.5l.5-1.5-.5-1.4L.5 8 2 6.5l1.5-.5.5-1.4L3.5 3 5 2.5l1.4-.5L6.5 1zm.5 1l-.4 1.2-1.2.4L4.2 3 3 4.2l.6 1.2-.4 1.2L2 7l1.2.4.4 1.2L3 9.8 4.2 11l1.2-.6 1.2.4L7 12h2l.4-1.2 1.2-.4L11.8 11 13 9.8l-.6-1.2.4-1.2L14 7l-1.2-.4-.4-1.2L13 4.2 11.8 3l-1.2.6-1.2-.4L9 2H7z" fill={color} />
  </svg>
);

// Icon components mapping
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
export const getIcon = (iconType: IconType): React.FC<IconProps> => {
  return ICON_COMPONENTS[iconType];
};
