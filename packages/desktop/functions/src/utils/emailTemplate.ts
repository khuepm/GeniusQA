/**
 * Email templates for error alerts
 */

import { ErrorDocument, ErrorSeverity } from '../types';

/**
 * Get severity color for email styling
 */
function getSeverityColor(severity: ErrorSeverity): string {
  switch (severity) {
    case 'critical':
      return '#dc2626';
    case 'high':
      return '#ea580c';
    case 'medium':
      return '#ca8a04';
    case 'low':
      return '#65a30d';
    default:
      return '#6b7280';
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: FirebaseFirestore.Timestamp | Date): string {
  const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
  return date.toISOString();
}

/**
 * Generate HTML email for error alert
 */
export function generateErrorAlertHtml(error: ErrorDocument, errorId: string): string {
  const severityColor = getSeverityColor(error.severity);
  const timestamp = formatTimestamp(error.timestamp);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: ${severityColor}; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 20px; }
    .section { margin-bottom: 20px; }
    .section h2 { font-size: 14px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; }
    .value { background: #f9fafb; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 13px; word-break: break-all; }
    .stack { white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
    .meta { display: flex; gap: 20px; flex-wrap: wrap; }
    .meta-item { flex: 1; min-width: 150px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${severityColor}; color: white; }
    .footer { padding: 20px; background: #f9fafb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 ${error.severity.toUpperCase()} Error Alert</h1>
    </div>
    <div class="content">
      <div class="section">
        <h2>Error Type</h2>
        <div class="value">${escapeHtml(error.type)}</div>
      </div>
      
      <div class="section">
        <h2>Message</h2>
        <div class="value">${escapeHtml(error.message)}</div>
      </div>
      
      <div class="section">
        <h2>Details</h2>
        <div class="meta">
          <div class="meta-item">
            <h2>Severity</h2>
            <span class="badge">${error.severity.toUpperCase()}</span>
          </div>
          <div class="meta-item">
            <h2>Error ID</h2>
            <div class="value">${escapeHtml(errorId)}</div>
          </div>
          <div class="meta-item">
            <h2>Session ID</h2>
            <div class="value">${escapeHtml(error.sessionId)}</div>
          </div>
          <div class="meta-item">
            <h2>User ID</h2>
            <div class="value">${escapeHtml(error.userId || 'Anonymous')}</div>
          </div>
          <div class="meta-item">
            <h2>Timestamp</h2>
            <div class="value">${timestamp}</div>
          </div>
        </div>
      </div>
      
      ${error.stack ? `
      <div class="section">
        <h2>Stack Trace</h2>
        <div class="value stack">${escapeHtml(error.stack)}</div>
      </div>
      ` : ''}
      
      ${error.context ? `
      <div class="section">
        <h2>Context</h2>
        <div class="value"><pre>${escapeHtml(JSON.stringify(error.context, null, 2))}</pre></div>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      This alert was sent by GeniusQA Error Monitoring System.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML email for summary alert
 */
export function generateSummaryAlertHtml(
  errorType: string,
  affectedUsersCount: number,
  totalErrors: number,
  timeWindow: string,
  sampleErrors: ErrorDocument[]
): string {
  const sampleErrorsHtml = sampleErrors
    .slice(0, 5)
    .map(
      (err, i) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(err.message.substring(0, 100))}${err.message.length > 100 ? '...' : ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(err.userId || 'Anonymous')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${err.severity}</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #7c3aed; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 20px; }
    .stats { display: flex; gap: 20px; margin-bottom: 20px; }
    .stat { flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #1f2937; }
    .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px; background: #f9fafb; font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .footer { padding: 20px; background: #f9fafb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Error Summary Alert</h1>
    </div>
    <div class="content">
      <div class="section" style="margin-bottom: 20px;">
        <h2 style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0;">Error Type</h2>
        <div style="background: #f9fafb; padding: 12px; border-radius: 4px; font-family: monospace;">${escapeHtml(errorType)}</div>
      </div>
      
      <div class="section" style="margin-bottom: 20px;">
        <h2 style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0;">Time Window</h2>
        <div style="background: #f9fafb; padding: 12px; border-radius: 4px;">${escapeHtml(timeWindow)}</div>
      </div>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${affectedUsersCount}</div>
          <div class="stat-label">Affected Users</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalErrors}</div>
          <div class="stat-label">Total Errors</div>
        </div>
      </div>
      
      <h2 style="font-size: 14px; color: #6b7280; margin: 20px 0 8px 0;">Sample Errors</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Message</th>
            <th>User</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody>
          ${sampleErrorsHtml}
        </tbody>
      </table>
    </div>
    <div class="footer">
      This summary was sent by GeniusQA Error Monitoring System.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}
