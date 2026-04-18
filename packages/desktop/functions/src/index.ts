/**
 * Firebase Cloud Functions for GeniusQA Email Alert System
 *
 * This module exports Cloud Functions that handle:
 * - Error alert emails when critical errors occur
 * - Rate limiting to prevent alert fatigue
 * - Summary alerts when multiple users are affected
 *
 * Environment Variables Required:
 * - SMTP_HOST: SMTP server host (default: smtp.gmail.com)
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_SECURE: Use TLS (default: false)
 * - SMTP_USER: SMTP username
 * - SMTP_PASS: SMTP password
 * - SMTP_FROM: From email address
 * - ALERT_RECIPIENTS: Comma-separated list of recipient emails
 * - MAX_EMAILS_PER_HOUR: Rate limit per error type (default: 10)
 * - SUMMARY_THRESHOLD: Users affected to trigger summary (default: 5)
 * - ALERT_SEVERITY_LOW: Alert on low severity (default: false)
 * - ALERT_SEVERITY_MEDIUM: Alert on medium severity (default: false)
 * - ALERT_SEVERITY_HIGH: Alert on high severity (default: true)
 * - ALERT_SEVERITY_CRITICAL: Alert on critical severity (default: true)
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Cloud Functions
export { onErrorCreated } from './functions/errorAlert';
