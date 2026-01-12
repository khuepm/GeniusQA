/**
 * Property-Based Tests for Icon System
 * 
 * Tests the Icon System's core functionality including:
 * - Icon recognition and consistency (Property 7)
 * - Consistent sizing and styling across all icons
 * - Color and opacity props for state changes
 * 
 * Uses fast-check for property-based testing.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import * as fc from 'fast-check';
import React from 'react';
import { render } from '@testing-library/react';
import {
  IconType,
  IconProps,
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

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Arbitrary for valid icon types
 */
const iconTypeArb = fc.constantFrom<IconType>(
  'record',
  'play', 
  'stop',
  'save',
  'open',
  'clear',
  'settings'
);

/**
 * Arbitrary for icon sizes (reasonable range)
 */
const iconSizeArb = fc.integer({ min: 8, max: 128 });

/**
 * Arbitrary for CSS colors (hex format)
 */
const colorArb = fc.oneof(
  fc.constant('currentColor'),
  fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^[0-9a-fA-F]{6}$/.test(s)).map(hex => `#${hex}`),
  fc.constantFrom('red', 'blue', 'green', 'black', 'white', 'gray')
);

/**
 * Arbitrary for opacity values (0 to 1, avoiding NaN and invalid values)
 */
const opacityArb = fc.float({ min: Math.fround(0.01), max: Math.fround(1) });

/**
 * Arbitrary for CSS class names
 */
const classNameArb = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s))
);

/**
 * Arbitrary for complete IconProps
 */
const iconPropsArb: fc.Arbitrary<IconProps> = fc.record({
  size: fc.option(iconSizeArb, { nil: undefined }),
  color: fc.option(colorArb, { nil: undefined }),
  opacity: fc.option(opacityArb, { nil: undefined }),
  className: classNameArb,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Renders an icon component and returns the SVG element
 */
function renderIcon(IconComponent: React.FC<IconProps>, props: IconProps = {}): SVGElement {
  const { container } = render(React.createElement(IconComponent, props));
  const svg = container.querySelector('svg');
  if (!svg) {
    throw new Error('Icon component did not render an SVG element');
  }
  return svg;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Icon System Property Tests', () => {
  // ==========================================================================
  // Property 7: Icon Recognition and Consistency
  // ==========================================================================

  /**
   * **Feature: desktop-ui-redesign, Property 7: Icon Recognition and Consistency**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
   * 
   * For any icon type, the icon should be recognizable, consistently sized,
   * and support color and opacity props for state changes.
   */
  describe('Property 7: Icon Recognition and Consistency', () => {
    
    // Requirement 7.1: Create RecordIcon, PlayIcon, StopIcon, SaveIcon, OpenIcon, SettingsIcon
    it('all required icon components exist and are functions', () => {
      const requiredIcons = [
        RecordIcon,
        PlayIcon,
        StopIcon,
        SaveIcon,
        OpenIcon,
        ClearIcon,
        SettingsIcon,
      ];

      for (const IconComponent of requiredIcons) {
        expect(typeof IconComponent).toBe('function');
      }
    });

    it('ICON_COMPONENTS mapping contains all required icons', () => {
      fc.assert(
        fc.property(iconTypeArb, (iconType: IconType) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          return typeof IconComponent === 'function';
        }),
        { numRuns: 100 }
      );
    });

    it('getIcon utility function returns correct icon component', () => {
      fc.assert(
        fc.property(iconTypeArb, (iconType: IconType) => {
          const IconComponent = getIcon(iconType);
          const expectedComponent = ICON_COMPONENTS[iconType];
          return IconComponent === expectedComponent;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 7.2: Ensure consistent sizing and styling across all icons
    it('all icons render as SVG elements with consistent structure', () => {
      fc.assert(
        fc.property(iconTypeArb, iconPropsArb, (iconType: IconType, props: IconProps) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg = renderIcon(IconComponent, props);
            
            // Should be an SVG element
            if (svg.tagName.toLowerCase() !== 'svg') return false;
            
            // Should have viewBox attribute
            if (!svg.hasAttribute('viewBox')) return false;
            
            // ViewBox should be consistent (0 0 16 16)
            const viewBox = svg.getAttribute('viewBox');
            if (viewBox !== '0 0 16 16') return false;
            
            return true;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('icons respect size prop consistently', () => {
      fc.assert(
        fc.property(iconTypeArb, iconSizeArb, (iconType: IconType, size: number) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg = renderIcon(IconComponent, { size });
            
            // Width and height should match the size prop
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            
            return width === size.toString() && height === size.toString();
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('icons use default size when size prop is not provided', () => {
      fc.assert(
        fc.property(iconTypeArb, (iconType: IconType) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg = renderIcon(IconComponent, {});
            
            // Default size should be 16
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            
            return width === '16' && height === '16';
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 7.3: Implement color and opacity props for state changes
    it('icons respect color prop for state changes', () => {
      fc.assert(
        fc.property(iconTypeArb, colorArb, (iconType: IconType, color: string) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg = renderIcon(IconComponent, { color });
            
            // Find elements with fill attribute
            const fillElements = svg.querySelectorAll('[fill]');
            
            if (fillElements.length === 0) return false;
            
            // All fill elements should use the provided color
            for (const element of fillElements) {
              const fillValue = element.getAttribute('fill');
              if (fillValue !== color) return false;
            }
            
            return true;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('icons use currentColor as default color', () => {
      fc.assert(
        fc.property(iconTypeArb, (iconType: IconType) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg = renderIcon(IconComponent, {});
            
            // Find elements with fill attribute
            const fillElements = svg.querySelectorAll('[fill]');
            
            if (fillElements.length === 0) return false;
            
            // All fill elements should use currentColor by default
            for (const element of fillElements) {
              const fillValue = element.getAttribute('fill');
              if (fillValue !== 'currentColor') return false;
            }
            
            return true;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('icons respect opacity prop for state changes', () => {
      fc.assert(
        fc.property(iconTypeArb, opacityArb, (iconType: IconType, opacity: number) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg = renderIcon(IconComponent, { opacity });
            
            // SVG should have style attribute with opacity
            const style = svg.getAttribute('style');
            if (!style) return false;
            
            // Should contain opacity value
            const opacityMatch = style.match(/opacity:\s*([0-9.]+)/);
            if (!opacityMatch) return false;
            
            const actualOpacity = parseFloat(opacityMatch[1]);
            
            // Allow small floating point differences
            return Math.abs(actualOpacity - opacity) < 0.01;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('icons use default opacity of 1 when opacity prop is not provided', () => {
      fc.assert(
        fc.property(iconTypeArb, (iconType: IconType) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg = renderIcon(IconComponent, {});
            
            // SVG should have style attribute with opacity: 1
            const style = svg.getAttribute('style');
            if (!style) return false;
            
            const opacityMatch = style.match(/opacity:\s*([0-9.]+)/);
            if (!opacityMatch) return false;
            
            return parseFloat(opacityMatch[1]) === 1;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 7.4: Maintain consistent visual style and sizing across all buttons
    it('icons apply className prop correctly', () => {
      fc.assert(
        fc.property(
          iconTypeArb,
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
          (iconType: IconType, className: string) => {
            const IconComponent = ICON_COMPONENTS[iconType];
            
            try {
              const svg = renderIcon(IconComponent, { className });
              
              // SVG should have the className
              return svg.classList.contains(className);
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('icons handle multiple props simultaneously', () => {
      fc.assert(
        fc.property(iconTypeArb, iconPropsArb, (iconType: IconType, props: IconProps) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg = renderIcon(IconComponent, props);
            
            // Check size if provided
            if (props.size !== undefined) {
              const width = svg.getAttribute('width');
              const height = svg.getAttribute('height');
              if (width !== props.size.toString() || height !== props.size.toString()) {
                return false;
              }
            }
            
            // Check color if provided
            if (props.color !== undefined) {
              const fillElements = svg.querySelectorAll('[fill]');
              for (const element of fillElements) {
                const fillValue = element.getAttribute('fill');
                if (fillValue !== props.color) return false;
              }
            }
            
            // Check opacity if provided
            if (props.opacity !== undefined) {
              const style = svg.getAttribute('style');
              if (!style) return false;
              const opacityMatch = style.match(/opacity:\s*([0-9.]+)/);
              if (!opacityMatch) return false;
              const actualOpacity = parseFloat(opacityMatch[1]);
              if (Math.abs(actualOpacity - props.opacity) >= 0.01) return false;
            }
            
            // Check className if provided
            if (props.className !== undefined) {
              if (!svg.classList.contains(props.className)) return false;
            }
            
            return true;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 7.5: Ensure they remain recognizable at the compact button size
    it('icons remain recognizable at compact sizes', () => {
      const compactSizes = [12, 14, 16, 18, 20]; // Common compact sizes
      
      fc.assert(
        fc.property(
          iconTypeArb,
          fc.constantFrom(...compactSizes),
          (iconType: IconType, size: number) => {
            const IconComponent = ICON_COMPONENTS[iconType];
            
            try {
              const svg = renderIcon(IconComponent, { size });
              
              // Should render without errors
              if (!svg) return false;
              
              // Should have correct dimensions
              const width = svg.getAttribute('width');
              const height = svg.getAttribute('height');
              if (width !== size.toString() || height !== size.toString()) return false;
              
              // Should have viewBox for scalability
              const viewBox = svg.getAttribute('viewBox');
              if (viewBox !== '0 0 16 16') return false;
              
              // Should contain drawable elements (paths, circles, rects)
              const drawableElements = svg.querySelectorAll('path, circle, rect, polygon, line');
              if (drawableElements.length === 0) return false;
              
              return true;
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('icon components are pure functions (same input produces same output)', () => {
      fc.assert(
        fc.property(iconTypeArb, iconPropsArb, (iconType: IconType, props: IconProps) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg1 = renderIcon(IconComponent, props);
            const svg2 = renderIcon(IconComponent, props);
            
            // Should produce identical SVG structure
            return svg1.outerHTML === svg2.outerHTML;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('all icons have unique visual representations', () => {
      const iconTypes: IconType[] = ['record', 'play', 'stop', 'save', 'open', 'clear', 'settings'];
      const renderedIcons = new Map<string, IconType>();
      
      for (const iconType of iconTypes) {
        const IconComponent = ICON_COMPONENTS[iconType];
        const svg = renderIcon(IconComponent, {});
        
        // Get the inner content (paths, circles, etc.) as a signature
        const innerContent = Array.from(svg.children)
          .map(child => child.outerHTML)
          .join('');
        
        // Check if this visual representation already exists
        if (renderedIcons.has(innerContent)) {
          // Icons should have unique visual representations
          expect(renderedIcons.get(innerContent)).not.toBe(iconType);
        }
        
        renderedIcons.set(innerContent, iconType);
      }
      
      // All icons should have been processed
      expect(renderedIcons.size).toBe(iconTypes.length);
    });

    it('icons maintain aspect ratio when resized', () => {
      fc.assert(
        fc.property(iconTypeArb, iconSizeArb, (iconType: IconType, size: number) => {
          const IconComponent = ICON_COMPONENTS[iconType];
          
          try {
            const svg = renderIcon(IconComponent, { size });
            
            const width = parseInt(svg.getAttribute('width') || '0');
            const height = parseInt(svg.getAttribute('height') || '0');
            
            // Width and height should be equal (square aspect ratio)
            return width === height && width === size;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
