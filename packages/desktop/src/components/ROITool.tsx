/**
 * ROI Tool Component
 *
 * Canvas-based component for drawing and editing Region of Interest (ROI)
 * rectangles on screenshots. Supports interactive drawing, resizing, and
 * target marker positioning.
 *
 * Requirements: 2.2, 6.1, 6.2, 6.3, 6.4, 3.5
 */

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { VisionROI } from '../types/aiVisionCapture.types';
import './ROITool.css';

/**
 * Handle positions for ROI resize
 */
type HandlePosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

/**
 * Cursor styles for each handle position
 */
const HANDLE_CURSORS: Record<HandlePosition, string> = {
  'top-left': 'nwse-resize',
  'top': 'ns-resize',
  'top-right': 'nesw-resize',
  'right': 'ew-resize',
  'bottom-right': 'nwse-resize',
  'bottom': 'ns-resize',
  'bottom-left': 'nesw-resize',
  'left': 'ew-resize',
};

/**
 * Handle size in pixels
 */
const HANDLE_SIZE = 10;

/**
 * Minimum ROI dimensions
 */
const MIN_ROI_SIZE = 20;

/**
 * Marker size in pixels
 */
const MARKER_SIZE = 20;

export interface ROIToolProps {
  /** URL or base64 of the image to display */
  imageUrl: string;
  /** Current ROI value (null if no ROI defined) */
  roi: VisionROI | null;
  /** Callback when ROI changes */
  onROIChange: (roi: VisionROI) => void;
  /** Optional marker position (AI-returned coordinates) */
  markerPosition?: { x: number; y: number } | null;
  /** Callback when marker is dragged */
  onMarkerDrag?: (position: { x: number; y: number }) => void;
  /** Image dimensions for bounds checking */
  imageDimensions?: { width: number; height: number };
}

interface DragState {
  type: 'none' | 'draw' | 'resize' | 'marker';
  startX: number;
  startY: number;
  handle?: HandlePosition;
  initialROI?: VisionROI;
  initialMarker?: { x: number; y: number };
}

/**
 * ROI Tool Component
 *
 * Provides canvas-based drawing and editing of ROI rectangles with:
 * - Mouse handlers for drawing new ROI rectangles
 * - Dashed red border with corner/edge handles
 * - Interactive resize handles
 * - Target/crosshair marker rendering and dragging
 */
export const ROITool: React.FC<ROIToolProps> = ({
  imageUrl,
  roi,
  onROIChange,
  markerPosition,
  onMarkerDrag,
  imageDimensions,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [dragState, setDragState] = useState<DragState>({
    type: 'none',
    startX: 0,
    startY: 0,
  });
  const [hoveredHandle, setHoveredHandle] = useState<HandlePosition | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
  }>({ visible: false, x: 0, y: 0, text: '' });

  // Scale factor for coordinate conversion
  const [scale, setScale] = useState(1);

  /**
   * Load image and set canvas dimensions
   */
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setIsImageLoaded(true);

      // Calculate scale to fit container
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight || 500;
        const imgWidth = imageDimensions?.width || img.naturalWidth;
        const imgHeight = imageDimensions?.height || img.naturalHeight;

        const scaleX = containerWidth / imgWidth;
        const scaleY = containerHeight / imgHeight;
        const newScale = Math.min(scaleX, scaleY, 1);

        setScale(newScale);
        setCanvasSize({
          width: imgWidth * newScale,
          height: imgHeight * newScale,
        });
      }
    };
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl);
      setIsImageLoaded(false);
    };
    img.src = imageUrl;
  }, [imageUrl, imageDimensions]);

  /**
   * Get handle rectangles for the current ROI
   */
  const getHandleRects = useCallback(
    (currentROI: VisionROI): Record<HandlePosition, { x: number; y: number }> => {
      const scaledROI = {
        x: currentROI.x * scale,
        y: currentROI.y * scale,
        width: currentROI.width * scale,
        height: currentROI.height * scale,
      };

      const halfHandle = HANDLE_SIZE / 2;

      return {
        'top-left': { x: scaledROI.x - halfHandle, y: scaledROI.y - halfHandle },
        'top': { x: scaledROI.x + scaledROI.width / 2 - halfHandle, y: scaledROI.y - halfHandle },
        'top-right': { x: scaledROI.x + scaledROI.width - halfHandle, y: scaledROI.y - halfHandle },
        'right': { x: scaledROI.x + scaledROI.width - halfHandle, y: scaledROI.y + scaledROI.height / 2 - halfHandle },
        'bottom-right': { x: scaledROI.x + scaledROI.width - halfHandle, y: scaledROI.y + scaledROI.height - halfHandle },
        'bottom': { x: scaledROI.x + scaledROI.width / 2 - halfHandle, y: scaledROI.y + scaledROI.height - halfHandle },
        'bottom-left': { x: scaledROI.x - halfHandle, y: scaledROI.y + scaledROI.height - halfHandle },
        'left': { x: scaledROI.x - halfHandle, y: scaledROI.y + scaledROI.height / 2 - halfHandle },
      };
    },
    [scale]
  );


  /**
   * Check if a point is within a handle
   */
  const getHandleAtPoint = useCallback(
    (x: number, y: number, currentROI: VisionROI): HandlePosition | null => {
      const handles = getHandleRects(currentROI);

      for (const [position, rect] of Object.entries(handles)) {
        if (
          x >= rect.x &&
          x <= rect.x + HANDLE_SIZE &&
          y >= rect.y &&
          y <= rect.y + HANDLE_SIZE
        ) {
          return position as HandlePosition;
        }
      }
      return null;
    },
    [getHandleRects]
  );

  /**
   * Check if a point is within the marker
   */
  const isPointInMarker = useCallback(
    (x: number, y: number): boolean => {
      if (!markerPosition) return false;

      const scaledMarkerX = markerPosition.x * scale;
      const scaledMarkerY = markerPosition.y * scale;
      const halfMarker = MARKER_SIZE / 2;

      return (
        x >= scaledMarkerX - halfMarker &&
        x <= scaledMarkerX + halfMarker &&
        y >= scaledMarkerY - halfMarker &&
        y <= scaledMarkerY + halfMarker
      );
    },
    [markerPosition, scale]
  );

  /**
   * Draw the canvas content
   */
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img || !isImageLoaded) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);

    // Draw ROI if exists
    if (roi) {
      const scaledROI = {
        x: roi.x * scale,
        y: roi.y * scale,
        width: roi.width * scale,
        height: roi.height * scale,
      };

      // Draw dashed red border
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(scaledROI.x, scaledROI.y, scaledROI.width, scaledROI.height);
      ctx.setLineDash([]);

      // Draw semi-transparent overlay outside ROI
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      // Top
      ctx.fillRect(0, 0, canvas.width, scaledROI.y);
      // Bottom
      ctx.fillRect(0, scaledROI.y + scaledROI.height, canvas.width, canvas.height - scaledROI.y - scaledROI.height);
      // Left
      ctx.fillRect(0, scaledROI.y, scaledROI.x, scaledROI.height);
      // Right
      ctx.fillRect(scaledROI.x + scaledROI.width, scaledROI.y, canvas.width - scaledROI.x - scaledROI.width, scaledROI.height);

      // Draw resize handles
      const handles = getHandleRects(roi);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;

      for (const [position, rect] of Object.entries(handles)) {
        ctx.fillRect(rect.x, rect.y, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(rect.x, rect.y, HANDLE_SIZE, HANDLE_SIZE);

        // Highlight hovered handle
        if (hoveredHandle === position) {
          ctx.fillStyle = '#ffcccc';
          ctx.fillRect(rect.x, rect.y, HANDLE_SIZE, HANDLE_SIZE);
          ctx.strokeRect(rect.x, rect.y, HANDLE_SIZE, HANDLE_SIZE);
          ctx.fillStyle = '#ffffff';
        }
      }
    }

    // Draw marker if exists
    if (markerPosition) {
      const scaledMarkerX = markerPosition.x * scale;
      const scaledMarkerY = markerPosition.y * scale;

      // Draw crosshair
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(scaledMarkerX - MARKER_SIZE, scaledMarkerY);
      ctx.lineTo(scaledMarkerX + MARKER_SIZE, scaledMarkerY);
      ctx.stroke();

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(scaledMarkerX, scaledMarkerY - MARKER_SIZE);
      ctx.lineTo(scaledMarkerX, scaledMarkerY + MARKER_SIZE);
      ctx.stroke();

      // Draw circle
      ctx.beginPath();
      ctx.arc(scaledMarkerX, scaledMarkerY, MARKER_SIZE / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Draw center dot
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(scaledMarkerX, scaledMarkerY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [canvasSize, roi, markerPosition, scale, isImageLoaded, getHandleRects, hoveredHandle]);

  /**
   * Redraw canvas when dependencies change
   */
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  /**
   * Get mouse position relative to canvas
   */
  const getMousePosition = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  /**
   * Clamp ROI to image bounds
   */
  const clampROI = useCallback(
    (newROI: VisionROI): VisionROI => {
      const imgWidth = (imageDimensions?.width || imageRef.current?.naturalWidth || canvasSize.width) / scale;
      const imgHeight = (imageDimensions?.height || imageRef.current?.naturalHeight || canvasSize.height) / scale;

      let { x, y, width, height } = newROI;

      // Ensure minimum size
      width = Math.max(width, MIN_ROI_SIZE);
      height = Math.max(height, MIN_ROI_SIZE);

      // Clamp to image bounds
      x = Math.max(0, Math.min(x, imgWidth - width));
      y = Math.max(0, Math.min(y, imgHeight - height));
      width = Math.min(width, imgWidth - x);
      height = Math.min(height, imgHeight - y);

      return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
    },
    [canvasSize, scale, imageDimensions]
  );


  /**
   * Handle mouse down - start drawing, resizing, or marker dragging
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePosition(e);

      // Check if clicking on marker
      if (markerPosition && isPointInMarker(pos.x, pos.y)) {
        setDragState({
          type: 'marker',
          startX: pos.x,
          startY: pos.y,
          initialMarker: { ...markerPosition },
        });
        return;
      }

      // Check if clicking on a handle
      if (roi) {
        const handle = getHandleAtPoint(pos.x, pos.y, roi);
        if (handle) {
          setDragState({
            type: 'resize',
            startX: pos.x,
            startY: pos.y,
            handle,
            initialROI: { ...roi },
          });
          return;
        }
      }

      // Start drawing new ROI
      setDragState({
        type: 'draw',
        startX: pos.x,
        startY: pos.y,
      });
    },
    [getMousePosition, roi, markerPosition, isPointInMarker, getHandleAtPoint]
  );

  /**
   * Handle mouse move - update drawing, resizing, or marker position
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePosition(e);

      // Update tooltip during drag
      if (dragState.type !== 'none') {
        if (dragState.type === 'draw' || dragState.type === 'resize') {
          const currentROI = roi || { x: 0, y: 0, width: 0, height: 0 };
          setTooltipInfo({
            visible: true,
            x: pos.x + 15,
            y: pos.y + 15,
            text: `X: ${Math.round(currentROI.x)}, Y: ${Math.round(currentROI.y)}\nW: ${Math.round(currentROI.width)}, H: ${Math.round(currentROI.height)}`,
          });
        } else if (dragState.type === 'marker' && markerPosition) {
          setTooltipInfo({
            visible: true,
            x: pos.x + 15,
            y: pos.y + 15,
            text: `X: ${Math.round(markerPosition.x)}, Y: ${Math.round(markerPosition.y)}`,
          });
        }
      }

      // Handle drawing
      if (dragState.type === 'draw') {
        const x = Math.min(dragState.startX, pos.x) / scale;
        const y = Math.min(dragState.startY, pos.y) / scale;
        const width = Math.abs(pos.x - dragState.startX) / scale;
        const height = Math.abs(pos.y - dragState.startY) / scale;

        const newROI = clampROI({ x, y, width, height });
        onROIChange(newROI);
        return;
      }

      // Handle resizing
      if (dragState.type === 'resize' && dragState.handle && dragState.initialROI) {
        const deltaX = (pos.x - dragState.startX) / scale;
        const deltaY = (pos.y - dragState.startY) / scale;
        const initial = dragState.initialROI;

        let newROI: VisionROI = { ...initial };

        switch (dragState.handle) {
          case 'top-left':
            newROI = {
              x: initial.x + deltaX,
              y: initial.y + deltaY,
              width: initial.width - deltaX,
              height: initial.height - deltaY,
            };
            break;
          case 'top':
            newROI = {
              ...initial,
              y: initial.y + deltaY,
              height: initial.height - deltaY,
            };
            break;
          case 'top-right':
            newROI = {
              ...initial,
              y: initial.y + deltaY,
              width: initial.width + deltaX,
              height: initial.height - deltaY,
            };
            break;
          case 'right':
            newROI = {
              ...initial,
              width: initial.width + deltaX,
            };
            break;
          case 'bottom-right':
            newROI = {
              ...initial,
              width: initial.width + deltaX,
              height: initial.height + deltaY,
            };
            break;
          case 'bottom':
            newROI = {
              ...initial,
              height: initial.height + deltaY,
            };
            break;
          case 'bottom-left':
            newROI = {
              x: initial.x + deltaX,
              y: initial.y,
              width: initial.width - deltaX,
              height: initial.height + deltaY,
            };
            break;
          case 'left':
            newROI = {
              x: initial.x + deltaX,
              y: initial.y,
              width: initial.width - deltaX,
              height: initial.height,
            };
            break;
        }

        onROIChange(clampROI(newROI));
        return;
      }

      // Handle marker dragging
      if (dragState.type === 'marker' && dragState.initialMarker && onMarkerDrag) {
        const deltaX = (pos.x - dragState.startX) / scale;
        const deltaY = (pos.y - dragState.startY) / scale;

        const imgWidth = (imageDimensions?.width || imageRef.current?.naturalWidth || canvasSize.width / scale);
        const imgHeight = (imageDimensions?.height || imageRef.current?.naturalHeight || canvasSize.height / scale);

        const newX = Math.max(0, Math.min(dragState.initialMarker.x + deltaX, imgWidth));
        const newY = Math.max(0, Math.min(dragState.initialMarker.y + deltaY, imgHeight));

        onMarkerDrag({ x: Math.round(newX), y: Math.round(newY) });
        return;
      }

      // Update cursor based on hover
      if (roi) {
        const handle = getHandleAtPoint(pos.x, pos.y, roi);
        setHoveredHandle(handle);
      }

      // Check if hovering over marker
      if (markerPosition && isPointInMarker(pos.x, pos.y)) {
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'move';
        }
        return;
      }

      // Update cursor
      if (canvasRef.current) {
        if (hoveredHandle) {
          canvasRef.current.style.cursor = HANDLE_CURSORS[hoveredHandle];
        } else {
          canvasRef.current.style.cursor = 'crosshair';
        }
      }
    },
    [
      getMousePosition,
      dragState,
      roi,
      markerPosition,
      scale,
      clampROI,
      onROIChange,
      onMarkerDrag,
      getHandleAtPoint,
      isPointInMarker,
      hoveredHandle,
      canvasSize,
      imageDimensions,
    ]
  );

  /**
   * Handle mouse up - finish drawing, resizing, or marker dragging
   */
  const handleMouseUp = useCallback(() => {
    setDragState({ type: 'none', startX: 0, startY: 0 });
    setTooltipInfo({ visible: false, x: 0, y: 0, text: '' });
  }, []);

  /**
   * Handle mouse leave - cancel drag operation
   */
  const handleMouseLeave = useCallback(() => {
    if (dragState.type !== 'none') {
      setDragState({ type: 'none', startX: 0, startY: 0 });
      setTooltipInfo({ visible: false, x: 0, y: 0, text: '' });
    }
    setHoveredHandle(null);
  }, [dragState.type]);

  /**
   * Cursor style based on current state
   */
  const cursorStyle = useMemo(() => {
    if (dragState.type === 'marker') return 'move';
    if (dragState.type === 'resize' && dragState.handle) {
      return HANDLE_CURSORS[dragState.handle];
    }
    if (hoveredHandle) return HANDLE_CURSORS[hoveredHandle];
    return 'crosshair';
  }, [dragState, hoveredHandle]);

  return (
    <div className="roi-tool-container" ref={containerRef} data-testid="roi-tool">
      {!isImageLoaded && (
        <div className="roi-tool-loading">
          <span>Loading image...</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="roi-tool-canvas"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        data-testid="roi-canvas"
      />

      {tooltipInfo.visible && (
        <div
          className="roi-tool-tooltip"
          style={{
            left: tooltipInfo.x,
            top: tooltipInfo.y,
          }}
          data-testid="roi-tooltip"
        >
          {tooltipInfo.text.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {roi && (
        <div className="roi-tool-info" data-testid="roi-info">
          <span>ROI: ({roi.x}, {roi.y}) - {roi.width}×{roi.height}</span>
        </div>
      )}

      {markerPosition && (
        <div className="roi-tool-marker-info" data-testid="marker-info">
          <span>Target: ({markerPosition.x}, {markerPosition.y})</span>
        </div>
      )}
    </div>
  );
};

export default ROITool;
