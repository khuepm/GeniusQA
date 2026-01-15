export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorLog {
  id: string;
  errorType: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  stackTrace?: string;
  context?: Record<string, unknown>;
  deviceInfo?: {
    platform?: string;
    osVersion?: string;
    appVersion?: string;
  };
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface ErrorLogFilters {
  severity?: ErrorSeverity;
  errorType?: string;
  startDate?: Date;
  endDate?: Date;
  resolved?: boolean;
  searchQuery?: string;
}

export interface ErrorLogStats {
  total: number;
  bySeverity: Record<ErrorSeverity, number>;
  byType: Record<string, number>;
  resolvedCount: number;
  unresolvedCount: number;
}
