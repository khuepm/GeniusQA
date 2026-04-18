import React, { useEffect, useState, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchErrorLogs,
  fetchErrorLogStats,
  markErrorResolved,
  markErrorUnresolved,
  getErrorTypeOptions,
  getSeverityColor,
} from '../lib/errorLogService';
import { ErrorLog, ErrorLogFilters, ErrorLogStats, ErrorSeverity } from '../types/errorLog';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

const severityIcons: Record<ErrorSeverity, React.ReactNode> = {
  critical: <AlertCircle className="w-4 h-4" />,
  high: <AlertTriangle className="w-4 h-4" />,
  medium: <Info className="w-4 h-4" />,
  low: <CheckCircle className="w-4 h-4" />,
};

export const ErrorLogs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filters, setFilters] = useState<ErrorLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        fetchErrorLogs({ ...filters, searchQuery }),
        fetchErrorLogStats(),
      ]);
      setLogs(logsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleResolved = async (log: ErrorLog) => {
    if (!user) return;
    try {
      if (log.resolved) {
        await markErrorUnresolved(log.id);
      } else {
        await markErrorResolved(log.id, user.email || user.uid);
      }
      loadData();
    } catch (error) {
      console.error('Error updating log:', error);
    }
  };

  const handleFilterChange = (key: keyof ErrorLogFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Error Logs</h1>
            <p className="mt-1 text-gray-600">Monitor and manage application errors</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-red-50 rounded-lg shadow p-4 border border-red-200">
              <p className="text-sm text-red-600">Critical</p>
              <p className="text-2xl font-bold text-red-700">{stats.bySeverity.critical}</p>
            </div>
            <div className="bg-orange-50 rounded-lg shadow p-4 border border-orange-200">
              <p className="text-sm text-orange-600">High</p>
              <p className="text-2xl font-bold text-orange-700">{stats.bySeverity.high}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg shadow p-4 border border-yellow-200">
              <p className="text-sm text-yellow-600">Medium</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.bySeverity.medium}</p>
            </div>
            <div className="bg-green-50 rounded-lg shadow p-4 border border-green-200">
              <p className="text-sm text-green-600">Low</p>
              <p className="text-2xl font-bold text-green-700">{stats.bySeverity.low}</p>
            </div>
            <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
              <p className="text-sm text-blue-600">Resolved</p>
              <p className="text-2xl font-bold text-blue-700">{stats.resolvedCount}</p>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search errors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filters
              {Object.keys(filters).length > 0 && (
                <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {Object.keys(filters).length}
                </span>
              )}
            </button>
            {(Object.keys(filters).length > 0 || searchQuery) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={filters.severity || ''}
                  onChange={(e) => handleFilterChange('severity', e.target.value as ErrorSeverity)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Error Type</label>
                <select
                  value={filters.errorType || ''}
                  onChange={(e) => handleFilterChange('errorType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All</option>
                  {getErrorTypeOptions().map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.resolved === undefined ? '' : filters.resolved.toString()}
                  onChange={(e) => handleFilterChange('resolved', e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All</option>
                  <option value="false">Unresolved</option>
                  <option value="true">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <input
                  type="date"
                  onChange={(e) => handleFilterChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Error Logs List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-600">Loading errors...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
              <p className="mt-2 text-gray-600">No errors found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {logs.map((log) => (
                <div key={log.id} className={`${log.resolved ? 'bg-gray-50' : ''}`}>
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 flex items-start gap-4"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className={`p-2 rounded-lg ${getSeverityColor(log.severity)}`}>
                      {severityIcons[log.severity]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{log.errorType}</span>
                        {log.resolved && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Resolved
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate">{log.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(log.timestamp)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleResolved(log);
                        }}
                        className={`px-3 py-1 text-sm rounded ${log.resolved
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                      >
                        {log.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                      {expandedLog === log.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {expandedLog === log.id && (
                    <div className="px-4 pb-4 bg-gray-50 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Details</h4>
                          <dl className="mt-2 text-sm">
                            <div className="flex justify-between py-1">
                              <dt className="text-gray-500">Error ID</dt>
                              <dd className="text-gray-900 font-mono text-xs">{log.id}</dd>
                            </div>
                            {log.userId && (
                              <div className="flex justify-between py-1">
                                <dt className="text-gray-500">User ID</dt>
                                <dd className="text-gray-900 font-mono text-xs">{log.userId}</dd>
                              </div>
                            )}
                            {log.sessionId && (
                              <div className="flex justify-between py-1">
                                <dt className="text-gray-500">Session ID</dt>
                                <dd className="text-gray-900 font-mono text-xs">{log.sessionId}</dd>
                              </div>
                            )}
                            {log.resolvedBy && (
                              <div className="flex justify-between py-1">
                                <dt className="text-gray-500">Resolved By</dt>
                                <dd className="text-gray-900">{log.resolvedBy}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                        {log.deviceInfo && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700">Device Info</h4>
                            <dl className="mt-2 text-sm">
                              {log.deviceInfo.platform && (
                                <div className="flex justify-between py-1">
                                  <dt className="text-gray-500">Platform</dt>
                                  <dd className="text-gray-900">{log.deviceInfo.platform}</dd>
                                </div>
                              )}
                              {log.deviceInfo.osVersion && (
                                <div className="flex justify-between py-1">
                                  <dt className="text-gray-500">OS Version</dt>
                                  <dd className="text-gray-900">{log.deviceInfo.osVersion}</dd>
                                </div>
                              )}
                              {log.deviceInfo.appVersion && (
                                <div className="flex justify-between py-1">
                                  <dt className="text-gray-500">App Version</dt>
                                  <dd className="text-gray-900">{log.deviceInfo.appVersion}</dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        )}
                      </div>
                      {log.stackTrace && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Stack Trace</h4>
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                            {log.stackTrace}
                          </pre>
                        </div>
                      )}
                      {log.context && Object.keys(log.context).length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Context</h4>
                          <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
