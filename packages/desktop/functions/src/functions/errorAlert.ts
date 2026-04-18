/**
 * Error Alert Cloud Function
 * Triggers on new error documents in Firestore and sends email alerts
 */

import * as functions from 'firebase-functions';
import { ErrorDocument, ErrorSeverity } from '../types';
import { getAlertConfig, getCurrentHourlyWindow } from '../config';
import { canSendAlert, incrementAlertCount, trackAffectedUser, wasSummarySent, markSummarySent, getSampleErrors } from '../utils/rateLimiter';
import { sendEmail } from '../utils/emailSender';
import { generateErrorAlertHtml, generateSummaryAlertHtml } from '../utils/emailTemplate';

/**
 * Check if severity should trigger an alert
 */
function shouldAlertForSeverity(severity: ErrorSeverity): boolean {
  const config = getAlertConfig();
  return config.severityThresholds[severity] === true;
}

/**
 * Firestore trigger for error documents
 * Triggers on: errors/{date}/items/{errorId}
 */
export const onErrorCreated = functions.firestore
  .document('errors/{date}/items/{errorId}')
  .onCreate(async (snapshot, context) => {
    const errorData = snapshot.data() as ErrorDocument;
    const { date, errorId } = context.params;

    console.log(`Processing error: ${errorId} on ${date}`);

    // Check if we should alert for this severity
    if (!shouldAlertForSeverity(errorData.severity)) {
      console.log(`Skipping alert for severity: ${errorData.severity}`);
      return;
    }

    const config = getAlertConfig();
    const userId = errorData.userId || 'anonymous';

    // Track affected user for summary alerts
    const affectedUsersCount = await trackAffectedUser(errorData.type, userId);

    // Check if we need to send a summary alert (>5 users affected)
    if (affectedUsersCount >= config.summaryThreshold) {
      const summarySent = await wasSummarySent(errorData.type);

      if (!summarySent) {
        await sendSummaryAlert(errorData.type, affectedUsersCount);
      }
    }

    // Check rate limiting for individual alerts
    const canSend = await canSendAlert(errorData.type);

    if (!canSend) {
      console.log(`Rate limited: ${errorData.type}`);
      return;
    }

    // Send individual error alert
    await sendErrorAlert(errorData, errorId);

    // Increment alert count for rate limiting
    await incrementAlertCount(errorData.type);
  });

/**
 * Send individual error alert email
 */
async function sendErrorAlert(error: ErrorDocument, errorId: string): Promise<void> {
  const subject = `[${error.severity.toUpperCase()}] GeniusQA Error: ${error.type}`;
  const html = generateErrorAlertHtml(error, errorId);

  const result = await sendEmail(subject, html);

  if (result.success) {
    console.log(`Error alert sent for: ${errorId}`);
  } else {
    console.error(`Failed to send error alert: ${result.error}`);
  }
}

/**
 * Send summary alert email when threshold is exceeded
 */
async function sendSummaryAlert(errorType: string, affectedUsersCount: number): Promise<void> {
  const timeWindow = getCurrentHourlyWindow();
  const sampleErrors = await getSampleErrors(errorType, 5);

  // Calculate total errors from sample (approximate)
  const totalErrors = sampleErrors.length;

  const subject = `[SUMMARY] GeniusQA: ${affectedUsersCount} users affected by ${errorType}`;
  const html = generateSummaryAlertHtml(
    errorType,
    affectedUsersCount,
    totalErrors,
    timeWindow,
    sampleErrors as ErrorDocument[]
  );

  const result = await sendEmail(subject, html);

  if (result.success) {
    await markSummarySent(errorType);
    console.log(`Summary alert sent for: ${errorType}`);
  } else {
    console.error(`Failed to send summary alert: ${result.error}`);
  }
}
