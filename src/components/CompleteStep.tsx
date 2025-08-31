import React from 'react';
import { AppState } from '../types';
import { formatBytes, formatDuration } from '../utils/storage';

interface CompleteStepProps {
  state: AppState;
  onRestart: () => void;
  onClearData: () => void;
  onClearCredentials?: () => void;
}

const CompleteStep: React.FC<CompleteStepProps> = ({
  state,
  onRestart,
  onClearData
}) => {
  const progress = state.transferProgress;
  const plan = state.transferPlan;

  const downloadLogs = () => {
    const logsText = state.logs.map(log => 
      `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()}: ${log.message}${log.file ? ` - ${log.file}` : ''}`
    ).join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      transferOptions: state.transferOptions,
      plan: plan,
      progress: progress,
      logs: state.logs
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSuccessRate = () => {
    if (!progress) return 0;
    const total = progress.completedFiles + progress.failedFiles;
    return total > 0 ? (progress.completedFiles / total) * 100 : 0;
  };

  const getDuration = () => {
    if (!progress) return 0;
    return (Date.now() - progress.startTime.getTime()) / 1000;
  };

  return (
    <div className="card">
      <h2>
        {state.transferOptions.dryRun ? 'Dry Run' : 'Transfer'} Complete! 
        {getSuccessRate() === 100 ? ' ✅' : ' ⚠️'}
      </h2>

      {progress && plan && (
        <>
          {/* Summary Stats */}
          <div className="card" style={{ backgroundColor: '#333', marginBottom: '2em' }}>
            <h3>Final Results</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1em' }}>
              <div>
                <strong>Total Files:</strong> {plan.totalFiles.toLocaleString()}
              </div>
              <div>
                <strong>Total Size:</strong> {formatBytes(plan.totalBytes)}
              </div>
              <div>
                <strong>Duration:</strong> {formatDuration(getDuration())}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1em', marginTop: '1em' }}>
              <div style={{ color: '#4ade80' }}>
                <strong>✅ Completed:</strong> {progress.completedFiles}
              </div>
              <div style={{ color: '#ef4444' }}>
                <strong>❌ Failed:</strong> {progress.failedFiles}
              </div>
              <div style={{ color: '#fbbf24' }}>
                <strong>⏭️ Skipped:</strong> {progress.skippedFiles}
              </div>
            </div>

            <div style={{ marginTop: '1em' }}>
              <div>
                <strong>Success Rate:</strong> {getSuccessRate().toFixed(1)}%
              </div>
              <div>
                <strong>Data Transferred:</strong> {formatBytes(progress.transferredBytes)}
              </div>
              <div>
                <strong>Average Speed:</strong> {formatBytes(progress.throughput)}/s
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {progress.failedFiles === 0 && progress.completedFiles > 0 && (
            <div className="success">
              🎉 All files transferred successfully! 
              {state.transferOptions.dryRun && ' (This was a dry run - no actual files were transferred)'}
            </div>
          )}

          {progress.failedFiles > 0 && (
            <div className="warning">
              ⚠️ {progress.failedFiles} files failed to transfer. Check the logs for details.
              You can retry the failed files by starting a new transfer.
            </div>
          )}

          {progress.completedFiles === 0 && progress.failedFiles === 0 && (
            <div className="warning">
              ℹ️ No files were transferred. This might be because all files were skipped due to conflicts
              or no files matched your criteria.
            </div>
          )}

          {/* Recommendations */}
          <div className="card" style={{ backgroundColor: '#2a2a2a', marginTop: '2em' }}>
            <h3>Next Steps</h3>
            <ul style={{ textAlign: 'left' }}>
              {progress.failedFiles > 0 && (
                <li>Review the failed transfers in the logs and retry if needed</li>
              )}
              {!state.transferOptions.dryRun && (
                <li>Verify the transferred files in your destination storage</li>
              )}
              {state.transferOptions.dryRun && (
                <li>If the dry run results look good, run the actual transfer</li>
              )}
              <li>Download the transfer report and logs for your records</li>
              <li>Clear your credentials from this browser for security</li>
            </ul>
          </div>

          {/* Error Summary */}
          {progress.failedFiles > 0 && (
            <div style={{ marginTop: '2em' }}>
              <h3>Recent Errors</h3>
              <div className="log-container" style={{ maxHeight: '200px' }}>
                {state.logs
                  .filter(log => log.level === 'error')
                  .slice(-10)
                  .map((log, index) => (
                    <div key={index} className="log-entry log-error">
                      <span>[{log.timestamp.toLocaleTimeString()}] </span>
                      <span>{log.message}</span>
                      {log.file && <span> - {log.file}</span>}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div style={{ marginTop: '2em', textAlign: 'center' }}>
        <button className="btn btn-primary" onClick={onRestart}>
          Start New Transfer
        </button>
        
        <button className="btn" onClick={downloadReport}>
          Download Report
        </button>
        
        <button className="btn" onClick={downloadLogs}>
          Download Logs
        </button>
        
        <button className="btn btn-danger" onClick={onClearData}>
          Clear All Data
        </button>
      </div>

      {/* Security Reminder */}
      <div className="warning" style={{ marginTop: '2em' }}>
        <strong>🔒 Security Reminder:</strong> Consider clearing your credentials and transfer data 
        from this browser when you're finished. Use the "Clear All Data" button above.
      </div>
    </div>
  );
};

export default CompleteStep;
