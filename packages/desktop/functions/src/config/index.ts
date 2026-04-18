/**
 * Configuration for Cloud Functions
 * Reads from environment variables set via Firebase Functions config
 */

import { AlertConfig, EmailConfig, ErrorSeverity } from '../types';

/**
 * Get email configuration from environment variables
 */
export function getEmailConfig(): EmailConfig {
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.SMTP_FROM || 'GeniusQA Alerts <alerts@geniusqa.com>',
  };
}

/**
 * Get alert configuration from environment variables
 */
export function getAlertConfig(): AlertConfig {
  // Parse recipients from comma-separated string
  const recipientsStr = process.env.ALERT_RECIPIENTS || '';
  const recipients = recipientsStr
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  // Parse severity thresholds
  const severityThresholds: { [key in ErrorSeverity]: boolean } = {
    low: process.env.ALERT_SEVERITY_LOW === 'true',
    medium: process.env.ALERT_SEVERITY_MEDIUM === 'true',
    high: process.env.ALERT_SEVERITY_HIGH !== 'false', // Default true
    critical: process.env.ALERT_SEVERITY_CRITICAL !== 'false', // Default true
  };

  return {
    recipients,
    maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || '10', 10),
    summaryThreshold: parseInt(process.env.SUMMARY_THRESHOLD || '5', 10),
    severityThresholds,
  };
}

/**
 * Validate configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const emailConfig = getEmailConfig();
  const alertConfig = getAlertConfig();

  if (!emailConfig.auth.user) {
    errors.push('SMTP_USER environment variable is not set');
  }

  if (!emailConfig.auth.pass) {
    errors.push('SMTP_PASS environment variable is not set');
  }

  if (alertConfig.recipients.length === 0) {
    errors.push('ALERT_RECIPIENTS environment variable is not set or empty');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the current hourly window string
 * Format: YYYY-MM-DD-HH
 */
export function getCurrentHourlyWindow(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}`;
}
