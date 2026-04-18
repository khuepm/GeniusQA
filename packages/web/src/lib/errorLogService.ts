import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { ErrorLog, ErrorLogFilters, ErrorLogStats, ErrorSeverity } from '../types/errorLog';

const ERRORS_COLLECTION = 'errors';
const DEFAULT_LIMIT = 50;

function convertTimestamp(timestamp: unknown): Date {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  return new Date();
}

export async function fetchErrorLogs(
  filters: ErrorLogFilters = {},
  maxResults: number = DEFAULT_LIMIT
): Promise<ErrorLog[]> {
  const constraints: QueryConstraint[] = [];

  if (filters.severity) {
    constraints.push(where('severity', '==', filters.severity));
  }

  if (filters.errorType) {
    constraints.push(where('errorType', '==', filters.errorType));
  }

  if (filters.resolved !== undefined) {
    constraints.push(where('resolved', '==', filters.resolved));
  }

  if (filters.startDate) {
    constraints.push(where('timestamp', '>=', Timestamp.fromDate(filters.startDate)));
  }

  if (filters.endDate) {
    constraints.push(where('timestamp', '<=', Timestamp.fromDate(filters.endDate)));
  }

  constraints.push(orderBy('timestamp', 'desc'));
  constraints.push(limit(maxResults));

  const q = query(collection(db, ERRORS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  const logs: ErrorLog[] = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      errorType: data.errorType || 'Unknown',
      message: data.message || '',
      severity: data.severity || 'medium',
      timestamp: convertTimestamp(data.timestamp),
      userId: data.userId,
      sessionId: data.sessionId,
      stackTrace: data.stackTrace,
      context: data.context,
      deviceInfo: data.deviceInfo,
      resolved: data.resolved || false,
      resolvedAt: data.resolvedAt ? convertTimestamp(data.resolvedAt) : undefined,
      resolvedBy: data.resolvedBy,
    };
  });

  // Client-side search filter
  if (filters.searchQuery) {
    const searchLower = filters.searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.message.toLowerCase().includes(searchLower) ||
        log.errorType.toLowerCase().includes(searchLower) ||
        log.stackTrace?.toLowerCase().includes(searchLower)
    );
  }

  return logs;
}


export async function fetchErrorLogStats(): Promise<ErrorLogStats> {
  const logs = await fetchErrorLogs({}, 500);

  const stats: ErrorLogStats = {
    total: logs.length,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    byType: {},
    resolvedCount: 0,
    unresolvedCount: 0,
  };

  for (const log of logs) {
    stats.bySeverity[log.severity]++;
    stats.byType[log.errorType] = (stats.byType[log.errorType] || 0) + 1;
    if (log.resolved) {
      stats.resolvedCount++;
    } else {
      stats.unresolvedCount++;
    }
  }

  return stats;
}

export async function markErrorResolved(
  errorId: string,
  resolvedBy: string
): Promise<void> {
  const errorRef = doc(db, ERRORS_COLLECTION, errorId);
  await updateDoc(errorRef, {
    resolved: true,
    resolvedAt: Timestamp.now(),
    resolvedBy,
  });
}

export async function markErrorUnresolved(errorId: string): Promise<void> {
  const errorRef = doc(db, ERRORS_COLLECTION, errorId);
  await updateDoc(errorRef, {
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
  });
}

export function getErrorTypeOptions(): string[] {
  return [
    'TypeError',
    'ReferenceError',
    'SyntaxError',
    'NetworkError',
    'ValidationError',
    'AuthenticationError',
    'PermissionError',
    'TimeoutError',
    'recording_failed',
    'playback_failed',
    'element_not_found',
    'core_connection_error',
    'script_load_error',
  ];
}

export function getSeverityColor(severity: ErrorSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
