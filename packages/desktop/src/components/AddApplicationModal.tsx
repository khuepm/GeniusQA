import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { ApplicationInfo, FocusLossStrategy } from '../types/applicationFocusedAutomation.types';
import './AddApplicationModal.css';

interface AddApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddApplication: (appInfo: ApplicationInfo) => void;
}

export const AddApplicationModal: React.FC<AddApplicationModalProps> = ({
  isOpen,
  onClose,
  onAddApplication,
}) => {
  const [formData, setFormData] = useState<ApplicationInfo>({
    name: '',
    executable_path: '',
    process_name: '',
    bundle_id: '',
    process_id: 0,
  });
  const [focusStrategy, setFocusStrategy] = useState<FocusLossStrategy>(FocusLossStrategy.AutoPause);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        name: '',
        executable_path: '',
        process_name: '',
        bundle_id: '',
        process_id: 0,
      });
      setFocusStrategy(FocusLossStrategy.AutoPause);
      setError(null);
    }
  }, [isOpen]);

  const handleInputChange = (field: keyof ApplicationInfo, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.executable_path.trim() || !formData.process_name.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const appInfo: ApplicationInfo = {
        ...formData,
        name: formData.name.trim(),
        executable_path: formData.executable_path.trim(),
        process_name: formData.process_name.trim(),
        bundle_id: formData.bundle_id?.trim() || undefined,
      };

      await onAddApplication(appInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBrowseExecutable = async () => {
    try {
      setIsBrowsing(true);
      setError(null);

      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Executable',
          extensions: ['exe', 'app']
        }]
      });

      if (selected && typeof selected === 'string') {
        handleInputChange('executable_path', selected);

        // Auto-fill process name from executable
        const fileName = selected.split('/').pop()?.replace(/\.(exe|app)$/, '') || '';
        if (fileName) {
          handleInputChange('process_name', fileName);
          if (!formData.name) {
            handleInputChange('name', fileName);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse for executable');
    } finally {
      setIsBrowsing(false);
    }
  };

  const detectRunningApplications = async () => {
    try {
      setIsDetecting(true);
      setError(null);

      const runningApps = await invoke<ApplicationInfo[]>('get_running_applications');

      if (runningApps && runningApps.length > 0) {
        // For now, auto-fill with the first detected application
        // In a full implementation, this could show a selection dialog
        const firstApp = runningApps[0];
        setFormData({
          name: firstApp.name,
          executable_path: firstApp.executable_path,
          process_name: firstApp.process_name,
          bundle_id: firstApp.bundle_id || '',
          process_id: firstApp.process_id,
        });

        console.log(`Detected ${runningApps.length} running applications. Auto-filled with: ${firstApp.name}`);
      } else {
        setError('No running applications detected');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect running applications');
    } finally {
      setIsDetecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Application</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="app-name">Application Name *</label>
            <input
              id="app-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Visual Studio Code"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="executable-path">Executable Path *</label>
            <div className="input-with-button">
              <input
                id="executable-path"
                type="text"
                value={formData.executable_path}
                onChange={(e) => handleInputChange('executable_path', e.target.value)}
                placeholder="e.g., /Applications/Visual Studio Code.app"
                required
              />
              <button
                type="button"
                className="browse-button"
                onClick={handleBrowseExecutable}
                disabled={isBrowsing}
              >
                {isBrowsing ? 'Browsing...' : 'Browse'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="process-name">Process Name *</label>
            <input
              id="process-name"
              type="text"
              value={formData.process_name}
              onChange={(e) => handleInputChange('process_name', e.target.value)}
              placeholder="e.g., Code"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="bundle-id">Bundle ID (macOS)</label>
            <input
              id="bundle-id"
              type="text"
              value={formData.bundle_id || ''}
              onChange={(e) => handleInputChange('bundle_id', e.target.value)}
              placeholder="e.g., com.microsoft.VSCode"
            />
          </div>

          <div className="form-group">
            <label htmlFor="focus-strategy">Default Focus Strategy</label>
            <select
              id="focus-strategy"
              value={focusStrategy}
              onChange={(e) => setFocusStrategy(e.target.value as FocusLossStrategy)}
            >
              <option value={FocusLossStrategy.AutoPause}>Auto Pause - Pause when focus is lost</option>
              <option value={FocusLossStrategy.StrictError}>Strict Error - Stop immediately on focus loss</option>
              <option value={FocusLossStrategy.Ignore}>Ignore - Continue with warnings</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="detect-button secondary"
              onClick={detectRunningApplications}
              disabled={isDetecting}
            >
              {isDetecting ? '🔍 Detecting...' : '🔍 Detect Running Apps'}
            </button>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
