/**
 * ReferenceImageManager Component
 *
 * Component for managing reference images in AI Vision Capture actions.
 * Supports:
 * - Thumbnail grid display of reference images
 * - Paste handler (Ctrl+V / Cmd+V)
 * - Drag-and-drop handler
 * - Remove button for each thumbnail
 *
 * Requirements: 2.5, 2.6, 2.8
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import './ReferenceImageManager.css';

// ============================================================================
// Types
// ============================================================================

export interface ReferenceImageManagerProps {
  /** Array of reference image paths (relative paths in POSIX format) */
  images: string[];
  /** Callback when images array changes */
  onImagesChange: (images: string[]) => void;
  /** Base path for resolving image URLs (optional) */
  assetsBasePath?: string;
  /** Callback to save a new image and get its path */
  onSaveImage?: (imageData: Blob, actionId: string) => Promise<string>;
  /** Action ID for generating unique filenames */
  actionId?: string;
  /** Maximum number of reference images allowed */
  maxImages?: number;
  /** Whether the component is disabled */
  disabled?: boolean;
}

interface DragState {
  isDragging: boolean;
  isOver: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_IMAGES = 5;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a file is a valid image type
 */
function isValidImageType(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

/**
 * Convert a File to base64 data URL
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get image from clipboard
 */
async function getImageFromClipboard(clipboardData: DataTransfer): Promise<File | null> {
  const items = clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

// ============================================================================
// ReferenceImageManager Component
// ============================================================================

/**
 * ReferenceImageManager Component
 *
 * Manages reference images for AI Vision Capture with:
 * - Thumbnail grid display
 * - Paste support (Ctrl+V / Cmd+V)
 * - Drag-and-drop support
 * - Individual image removal
 */
export const ReferenceImageManager: React.FC<ReferenceImageManagerProps> = ({
  images,
  onImagesChange,
  assetsBasePath = '',
  onSaveImage,
  actionId = 'default',
  maxImages = DEFAULT_MAX_IMAGES,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isOver: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());

  // -------------------------------------------------------------------------
  // Image Processing
  // -------------------------------------------------------------------------

  /**
   * Process and add a new image
   */
  const addImage = useCallback(
    async (file: File) => {
      // Validate image type
      if (!isValidImageType(file)) {
        setError('Invalid image type. Please use PNG, JPEG, GIF, or WebP.');
        return;
      }

      // Check max images limit
      if (images.length >= maxImages) {
        setError(`Maximum ${maxImages} reference images allowed.`);
        return;
      }

      setError(null);

      try {
        let imagePath: string;

        if (onSaveImage) {
          // Use provided save function to persist image
          imagePath = await onSaveImage(file, actionId);
        } else {
          // Fallback: use data URL (not recommended for production)
          imagePath = await fileToDataUrl(file);
        }

        // Add to images array
        onImagesChange([...images, imagePath]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add image';
        setError(errorMessage);
      }
    },
    [images, onImagesChange, onSaveImage, actionId, maxImages]
  );

  /**
   * Remove an image at the specified index
   */
  const removeImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index);
      onImagesChange(newImages);
    },
    [images, onImagesChange]
  );

  // -------------------------------------------------------------------------
  // Paste Handler (Requirements: 2.5)
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if this component or its children are focused
      if (!containerRef.current?.contains(document.activeElement) &&
        document.activeElement !== containerRef.current) {
        return;
      }

      if (disabled) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const imageFile = await getImageFromClipboard(clipboardData);
      if (imageFile) {
        e.preventDefault();
        await addImage(imageFile);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addImage, disabled]);

  // -------------------------------------------------------------------------
  // Drag and Drop Handlers (Requirements: 2.5)
  // -------------------------------------------------------------------------

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      setDragState({ isDragging: true, isOver: true });
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only set isOver to false if we're leaving the container
      if (!containerRef.current?.contains(e.relatedTarget as Node)) {
        setDragState({ isDragging: false, isOver: false });
      }
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      setDragState((prev) => ({ ...prev, isOver: true }));
    },
    [disabled]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState({ isDragging: false, isOver: false });

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(isValidImageType);

      if (imageFiles.length === 0) {
        setError('No valid images found. Please drop PNG, JPEG, GIF, or WebP files.');
        return;
      }

      // Add images up to the limit
      const availableSlots = maxImages - images.length;
      const filesToAdd = imageFiles.slice(0, availableSlots);

      for (const file of filesToAdd) {
        await addImage(file);
      }

      if (imageFiles.length > availableSlots) {
        setError(`Only ${availableSlots} image(s) added. Maximum ${maxImages} reference images allowed.`);
      }
    },
    [addImage, disabled, images.length, maxImages]
  );

  // -------------------------------------------------------------------------
  // File Input Handler
  // -------------------------------------------------------------------------

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        await addImage(file);
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [addImage]
  );

  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // -------------------------------------------------------------------------
  // Image Loading State
  // -------------------------------------------------------------------------

  const handleImageLoad = useCallback((index: number) => {
    setLoadingImages((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const handleImageError = useCallback((index: number) => {
    setLoadingImages((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Resolve Image URL
  // -------------------------------------------------------------------------

  const resolveImageUrl = useCallback(
    (imagePath: string): string => {
      // If it's already a data URL or absolute URL, return as-is
      if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
        return imagePath;
      }
      // Otherwise, prepend the assets base path
      return assetsBasePath ? `${assetsBasePath}/${imagePath}` : imagePath;
    },
    [assetsBasePath]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const canAddMore = images.length < maxImages && !disabled;

  return (
    <div
      ref={containerRef}
      className={`reference-image-manager ${dragState.isOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      tabIndex={0}
      data-testid="reference-image-manager"
    >
      {/* Header */}
      <div className="rim-header">
        <label className="rim-label">Reference Images</label>
        <span className="rim-count">
          {images.length}/{maxImages}
        </span>
      </div>

      {/* Thumbnail Grid (Requirements: 2.8) */}
      <div className="rim-grid" data-testid="rim-grid">
        {images.map((imagePath, index) => (
          <div
            key={`${imagePath}-${index}`}
            className="rim-thumbnail"
            data-testid={`rim-thumbnail-${index}`}
          >
            <img
              src={resolveImageUrl(imagePath)}
              alt={`Reference ${index + 1}`}
              onLoad={() => handleImageLoad(index)}
              onError={() => handleImageError(index)}
              className={loadingImages.has(index) ? 'loading' : ''}
            />
            {!disabled && (
              <button
                className="rim-remove-btn"
                onClick={() => removeImage(index)}
                title="Remove image"
                data-testid={`rim-remove-btn-${index}`}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Add Button */}
        {canAddMore && (
          <button
            className="rim-add-btn"
            onClick={handleAddClick}
            title="Add reference image"
            data-testid="rim-add-btn"
          >
            <span className="rim-add-icon">+</span>
            <span className="rim-add-text">Add</span>
          </button>
        )}
      </div>

      {/* Drop Zone Overlay */}
      {dragState.isOver && canAddMore && (
        <div className="rim-drop-overlay" data-testid="rim-drop-overlay">
          <div className="rim-drop-content">
            <span className="rim-drop-icon">📷</span>
            <span className="rim-drop-text">Drop images here</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && !dragState.isOver && (
        <div className="rim-empty" data-testid="rim-empty">
          <p>No reference images</p>
          <p className="rim-hint">
            Paste (Ctrl+V / Cmd+V), drag & drop, or click + to add
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rim-error" data-testid="rim-error">
          <span className="rim-error-icon">⚠️</span>
          <span>{error}</span>
          <button
            className="rim-error-dismiss"
            onClick={() => setError(null)}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        onChange={handleFileInputChange}
        className="rim-file-input"
        data-testid="rim-file-input"
      />
    </div>
  );
};

export default ReferenceImageManager;
