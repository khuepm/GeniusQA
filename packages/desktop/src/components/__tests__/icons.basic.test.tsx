/**
 * Basic Tests for Icon System
 * Simple unit tests to verify icon system functionality
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import React from 'react';
import { render } from '@testing-library/react';
import {
  IconType,
  RecordIcon,
  PlayIcon,
  StopIcon,
  SaveIcon,
  OpenIcon,
  ClearIcon,
  SettingsIcon,
  ICON_COMPONENTS,
  getIcon,
} from '../icons';

describe('Icon System Basic Tests', () => {
  describe('Icon Components', () => {
    it('should render RecordIcon without errors', () => {
      const { container } = render(<RecordIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
    });

    it('should render PlayIcon without errors', () => {
      const { container } = render(<PlayIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
    });

    it('should render StopIcon without errors', () => {
      const { container } = render(<StopIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
    });

    it('should render SaveIcon without errors', () => {
      const { container } = render(<SaveIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
    });

    it('should render OpenIcon without errors', () => {
      const { container } = render(<OpenIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
    });

    it('should render ClearIcon without errors', () => {
      const { container } = render(<ClearIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
    });

    it('should render SettingsIcon without errors', () => {
      const { container } = render(<SettingsIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
    });
  });

  describe('Icon System Utilities', () => {
    it('should have ICON_COMPONENTS mapping', () => {
      expect(ICON_COMPONENTS).toBeDefined();
      expect(typeof ICON_COMPONENTS).toBe('object');
    });

    it('should have all required icons in ICON_COMPONENTS', () => {
      const requiredIcons: IconType[] = ['record', 'play', 'stop', 'save', 'open', 'clear', 'settings'];

      for (const iconType of requiredIcons) {
        expect(ICON_COMPONENTS[iconType]).toBeDefined();
        expect(typeof ICON_COMPONENTS[iconType]).toBe('function');
      }
    });

    it('should have getIcon utility function', () => {
      expect(getIcon).toBeDefined();
      expect(typeof getIcon).toBe('function');
    });

    it('getIcon should return correct components', () => {
      expect(getIcon('record')).toBe(RecordIcon);
      expect(getIcon('play')).toBe(PlayIcon);
      expect(getIcon('stop')).toBe(StopIcon);
      expect(getIcon('save')).toBe(SaveIcon);
      expect(getIcon('open')).toBe(OpenIcon);
      expect(getIcon('clear')).toBe(ClearIcon);
      expect(getIcon('settings')).toBe(SettingsIcon);
    });
  });

  describe('Icon Props', () => {
    it('should respect size prop', () => {
      const { container } = render(<RecordIcon size={24} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '24');
      expect(svg).toHaveAttribute('height', '24');
    });

    it('should respect color prop', () => {
      const { container } = render(<RecordIcon color="red" />);
      const svg = container.querySelector('svg');
      const circle = svg?.querySelector('circle');
      expect(circle).toHaveAttribute('fill', 'red');
    });

    it('should respect opacity prop', () => {
      const { container } = render(<RecordIcon opacity={0.5} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveStyle('opacity: 0.5');
    });

    it('should respect className prop', () => {
      const { container } = render(<RecordIcon className="test-class" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('test-class');
    });

    it('should use default values when props are not provided', () => {
      const { container } = render(<RecordIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
      expect(svg).toHaveStyle('opacity: 1');

      const circle = svg?.querySelector('circle');
      expect(circle).toHaveAttribute('fill', 'currentColor');
    });
  });

  describe('Icon Consistency', () => {
    it('all icons should have consistent viewBox', () => {
      const icons = [RecordIcon, PlayIcon, StopIcon, SaveIcon, OpenIcon, ClearIcon, SettingsIcon];

      for (const IconComponent of icons) {
        const { container } = render(<IconComponent />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
      }
    });

    it('all icons should have default size of 16', () => {
      const icons = [RecordIcon, PlayIcon, StopIcon, SaveIcon, OpenIcon, ClearIcon, SettingsIcon];

      for (const IconComponent of icons) {
        const { container } = render(<IconComponent />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '16');
        expect(svg).toHaveAttribute('height', '16');
      }
    });

    it('all icons should use currentColor by default', () => {
      const icons = [
        { Component: RecordIcon, selector: 'circle' },
        { Component: PlayIcon, selector: 'path' },
        { Component: StopIcon, selector: 'rect' },
        { Component: SaveIcon, selector: 'path' },
        { Component: OpenIcon, selector: 'path' },
        { Component: ClearIcon, selector: 'path' },
        { Component: SettingsIcon, selector: 'path' },
      ];

      for (const { Component, selector } of icons) {
        const { container } = render(<Component />);
        const svg = container.querySelector('svg');
        const fillElement = svg?.querySelector(selector);
        expect(fillElement).toHaveAttribute('fill', 'currentColor');
      }
    });
  });
});
