/**
 * Unit Tests for Script Preview Component - Playback Functionality
 * 
 * Tests the Play button visibility, playback progress indicator,
 * and error handling for script playback.
 * 
 * Requirements: 7.1, 7.4, 7.5, 7.6
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  PlaybackProgress,
  ScriptData,
  ValidationResult,
} from '../../types/aiScriptBuilder.types';
import { ScriptPreview } from '../ScriptPreview';

// ============================================================================
// Test Data
// ============================================================================

const mockScript: ScriptData = {
  version: '1.0',
  metadata: {
    created_at: '2024-01-01T00:00:00.000Z',
    duration: 5000,
    action_count: 3,
    core_type: 'desktop',
    platform: 'macos',
  },
  actions: [
    {
      type: 'mouse_move',
      timestamp: 0,
      x: 100,
      y: 200,
    },
    {
      type: 'mouse_click',
      timestamp: 1000,
      x: 100,
      y: 200,
      button: 'left',
    },
    {
      type: 'key_type',
      timestamp: 2000,
      text: 'Hello World',
    },
  ],
};

const validValidationResult: ValidationResult = {
  valid: true,
  errors: [],
  warnings: [],
};

const invalidValidationResult: ValidationResult = {
  valid: false,
  errors: [
    {
      field: 'actions[0].x',
      message: 'X coordinate out of bounds',
      actionIndex: 0,
    },
  ],
  warnings: [],
};

// ============================================================================
// Tests for Play Button Visibility (Requirement 7.1, 7.4)
// ============================================================================

describe('ScriptPreview - Play Button Visibility', () => {
  it('should NOT show Play button when script is not saved', () => {
    const mockOnPlay = jest.fn();

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={mockOnPlay}
        validationResult={validValidationResult}
        isSaved={false}
        isPlaying={false}
      />
    );

    const playButton = screen.queryByTestId('script-play-button');
    expect(playButton).not.toBeInTheDocument();
  });

  it('should show Play button when script is saved', () => {
    const mockOnPlay = jest.fn();

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={mockOnPlay}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={false}
      />
    );

    const playButton = screen.getByTestId('script-play-button');
    expect(playButton).toBeInTheDocument();
    expect(playButton).toHaveTextContent('Play');
  });

  it('should NOT show Play button when onPlay callback is not provided', () => {
    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={false}
      />
    );

    const playButton = screen.queryByTestId('script-play-button');
    expect(playButton).not.toBeInTheDocument();
  });

  it('should disable Play button when script is invalid', () => {
    const mockOnPlay = jest.fn();

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={mockOnPlay}
        validationResult={invalidValidationResult}
        isSaved={true}
        isPlaying={false}
      />
    );

    const playButton = screen.getByTestId('script-play-button');
    expect(playButton).toBeDisabled();
  });

  it('should disable Play button when playback is in progress', () => {
    const mockOnPlay = jest.fn();

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={mockOnPlay}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
      />
    );

    const playButton = screen.getByTestId('script-play-button');
    expect(playButton).toBeDisabled();
    expect(playButton).toHaveTextContent('Playing...');
  });

  it('should call onPlay callback when Play button is clicked', () => {
    const mockOnPlay = jest.fn();

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={mockOnPlay}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={false}
      />
    );

    const playButton = screen.getByTestId('script-play-button');
    fireEvent.click(playButton);

    expect(mockOnPlay).toHaveBeenCalledTimes(1);
    expect(mockOnPlay).toHaveBeenCalledWith(mockScript);
  });
});

// ============================================================================
// Tests for Playback Progress Indicator (Requirement 7.5)
// ============================================================================

describe('ScriptPreview - Playback Progress Indicator', () => {
  it('should NOT show progress indicator when not playing', () => {
    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={false}
      />
    );

    const progressIndicator = screen.queryByTestId('playback-progress');
    expect(progressIndicator).not.toBeInTheDocument();
  });

  it('should show progress indicator when playing', () => {
    const playbackProgress: PlaybackProgress = {
      currentAction: 2,
      totalActions: 3,
      status: 'playing',
    };

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
        playbackProgress={playbackProgress}
      />
    );

    const progressIndicator = screen.getByTestId('playback-progress');
    expect(progressIndicator).toBeInTheDocument();
    expect(progressIndicator).toHaveTextContent('Playing...');
    expect(progressIndicator).toHaveTextContent('Action 2 of 3');
  });

  it('should show correct status for paused playback', () => {
    const playbackProgress: PlaybackProgress = {
      currentAction: 1,
      totalActions: 3,
      status: 'paused',
    };

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
        playbackProgress={playbackProgress}
      />
    );

    const progressIndicator = screen.getByTestId('playback-progress');
    expect(progressIndicator).toHaveTextContent('Paused');
  });

  it('should show correct status for completed playback', () => {
    const playbackProgress: PlaybackProgress = {
      currentAction: 3,
      totalActions: 3,
      status: 'completed',
    };

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
        playbackProgress={playbackProgress}
      />
    );

    const progressIndicator = screen.getByTestId('playback-progress');
    expect(progressIndicator).toHaveTextContent('Completed');
  });

  it('should display progress bar with correct width', () => {
    const playbackProgress: PlaybackProgress = {
      currentAction: 2,
      totalActions: 4,
      status: 'playing',
    };

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
        playbackProgress={playbackProgress}
      />
    );

    const progressFill = screen.getByTestId('playback-progress').querySelector('.playback-progress-fill');
    expect(progressFill).toHaveStyle({ width: '50%' });
  });
});

// ============================================================================
// Tests for Playback Error Handling (Requirement 7.6)
// ============================================================================

describe('ScriptPreview - Playback Error Handling', () => {
  it('should display error message when playback fails', () => {
    const playbackProgress: PlaybackProgress = {
      currentAction: 2,
      totalActions: 3,
      status: 'error',
      error: 'Failed to execute mouse click: Invalid coordinates',
    };

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
        playbackProgress={playbackProgress}
      />
    );

    const errorDisplay = screen.getByTestId('playback-error');
    expect(errorDisplay).toBeInTheDocument();
    expect(errorDisplay).toHaveTextContent('Failed to execute mouse click: Invalid coordinates');
  });

  it('should show Edit Failed Action button when error occurs', () => {
    const playbackProgress: PlaybackProgress = {
      currentAction: 2,
      totalActions: 3,
      status: 'error',
      error: 'Action execution failed',
    };

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
        playbackProgress={playbackProgress}
      />
    );

    const editButton = screen.getByText(/Edit Failed Action/i);
    expect(editButton).toBeInTheDocument();
  });

  it('should open failed action for editing when Edit button is clicked', () => {
    const playbackProgress: PlaybackProgress = {
      currentAction: 2,
      totalActions: 3,
      status: 'error',
      error: 'Action execution failed',
    };

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
        playbackProgress={playbackProgress}
      />
    );

    const editButton = screen.getByText(/Edit Failed Action/i);
    fireEvent.click(editButton);

    // The action at index 1 (currentAction - 1) should be in edit mode
    // We can verify this by checking if the edit form is displayed
    const editForm = screen.getByText(/Timestamp \(ms\)/i);
    expect(editForm).toBeInTheDocument();
  });

  it('should NOT show error display when status is not error', () => {
    const playbackProgress: PlaybackProgress = {
      currentAction: 2,
      totalActions: 3,
      status: 'playing',
    };

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
        playbackProgress={playbackProgress}
      />
    );

    const errorDisplay = screen.queryByTestId('playback-error');
    expect(errorDisplay).not.toBeInTheDocument();
  });
});

// ============================================================================
// Tests for Save Button State (Requirement 7.1)
// ============================================================================

describe('ScriptPreview - Save Button State', () => {
  it('should show "Save Script" when not saved', () => {
    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        validationResult={validValidationResult}
        isSaved={false}
      />
    );

    const saveButton = screen.getByText(/Save Script/i);
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
  });

  it('should show "Saved" and be disabled when already saved', () => {
    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
      />
    );

    const saveButton = screen.getByText(/Saved/i);
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });

  it('should disable Discard button when playing', () => {
    const playbackProgress: PlaybackProgress = {
      currentAction: 1,
      totalActions: 3,
      status: 'playing',
    };

    render(
      <ScriptPreview
        script={mockScript}
        onEdit={jest.fn()}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
        onPlay={jest.fn()}
        validationResult={validValidationResult}
        isSaved={true}
        isPlaying={true}
        playbackProgress={playbackProgress}
      />
    );

    const discardButton = screen.getByText(/Discard/i);
    expect(discardButton).toBeDisabled();
  });
});
