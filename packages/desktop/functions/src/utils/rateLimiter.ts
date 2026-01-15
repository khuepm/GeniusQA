/**
 * Rate limiting utilities for email alerts
 */

import * as admin from 'firebase-admin';
import { AlertTrackingDocument, SummaryAlertDocument } from '../types';
import { getAlertConfig, getCurrentHourlyWindow } from '../config';

const db = admin.firestore();

/**
 * Check if we can send an alert for this error type (rate limiting)
 * Returns true if under the limit, false if rate limited
 */
export async function canSendAlert(errorType: string): Promise<boolean> {
  const config = getAlertConfig();
  const hourlyWindow = getCurrentHourlyWindow();
  const trackingRef = db.collection('alerts').doc('tracking').collection('errors').doc(`${errorType}_${hourlyWindow}`);

  try {
    const doc = await trackingRef.get();

    if (!doc.exists) {
      return true;
    }

    const data = doc.data() as AlertTrackingDocument;
    return data.sentCount < config.maxEmailsPerHour;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Allow sending on error to not miss critical alerts
    return true;
  }
}

/**
 * Increment the alert count for an error type
 */
export async function incrementAlertCount(errorType: string): Promise<void> {
  const hourlyWindow = getCurrentHourlyWindow();
  const trackingRef = db.collection('alerts').doc('tracking').collection('errors').doc(`${errorType}_${hourlyWindow}`);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(trackingRef);

      if (!doc.exists) {
        const newDoc: AlertTrackingDocument = {
          errorType,
          sentCount: 1,
          lastSentAt: admin.firestore.Timestamp.now(),
          hourlyWindow,
        };
        transaction.set(trackingRef, newDoc);
      } else {
        transaction.update(trackingRef, {
          sentCount: admin.firestore.FieldValue.increment(1),
          lastSentAt: admin.firestore.Timestamp.now(),
        });
      }
    });
  } catch (error) {
    console.error('Error incrementing alert count:', error);
  }
}

/**
 * Track affected user for summary alerts
 * Returns the updated count of affected users
 */
export async function trackAffectedUser(errorType: string, userId: string): Promise<number> {
  const hourlyWindow = getCurrentHourlyWindow();
  const summaryRef = db.collection('alerts').doc('summary').collection('errors').doc(`${errorType}_${hourlyWindow}`);

  try {
    let affectedCount = 0;

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(summaryRef);

      if (!doc.exists) {
        const newDoc: SummaryAlertDocument = {
          errorType,
          affectedUsers: [userId],
          errorCount: 1,
          hourlyWindow,
        };
        transaction.set(summaryRef, newDoc);
        affectedCount = 1;
      } else {
        const data = doc.data() as SummaryAlertDocument;
        const affectedUsers = data.affectedUsers || [];

        if (!affectedUsers.includes(userId)) {
          affectedUsers.push(userId);
        }

        transaction.update(summaryRef, {
          affectedUsers,
          errorCount: admin.firestore.FieldValue.increment(1),
        });

        affectedCount = affectedUsers.length;
      }
    });

    return affectedCount;
  } catch (error) {
    console.error('Error tracking affected user:', error);
    return 0;
  }
}

/**
 * Check if summary alert was already sent for this window
 */
export async function wasSummarySent(errorType: string): Promise<boolean> {
  const hourlyWindow = getCurrentHourlyWindow();
  const summaryRef = db.collection('alerts').doc('summary').collection('errors').doc(`${errorType}_${hourlyWindow}`);

  try {
    const doc = await summaryRef.get();

    if (!doc.exists) {
      return false;
    }

    const data = doc.data() as SummaryAlertDocument;
    return !!data.summarySentAt;
  } catch (error) {
    console.error('Error checking summary status:', error);
    return false;
  }
}

/**
 * Mark summary alert as sent
 */
export async function markSummarySent(errorType: string): Promise<void> {
  const hourlyWindow = getCurrentHourlyWindow();
  const summaryRef = db.collection('alerts').doc('summary').collection('errors').doc(`${errorType}_${hourlyWindow}`);

  try {
    await summaryRef.update({
      summarySentAt: admin.firestore.Timestamp.now(),
    });
  } catch (error) {
    console.error('Error marking summary as sent:', error);
  }
}

/**
 * Get sample errors for summary alert
 */
export async function getSampleErrors(errorType: string, limit: number = 5): Promise<admin.firestore.DocumentData[]> {
  const today = new Date().toISOString().split('T')[0];

  try {
    const snapshot = await db
      .collection('errors')
      .doc(today)
      .collection('items')
      .where('type', '==', errorType)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data());
  } catch (error) {
    console.error('Error getting sample errors:', error);
    return [];
  }
}
