import React, { useState, useEffect, useRef } from 'react';
import { AppState, LogEntry, TransferProgress, FileObject } from '../types';
import { SupabaseManager } from '../utils/supabase';
import { R2Manager } from '../utils/r2';
import { formatBytes, formatDuration, calculateThroughput, estimateTimeRemaining } from '../utils/storage';

interface TransferStepProps {
  state: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
  onComplete: () => void;
  onBack: () => void;
  addLog: (level: LogEntry['level'], message: string, file?: string) => void;
}

const TransferStep: React.FC<TransferStepProps> = ({
  state,
  onUpdate,
  onComplete,
  onBack,
  addLog
}) => {
  const [isTransferring, setIsTransferring] = useState(false);
  const [currentFiles, setCurrentFiles] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressRef = useRef<TransferProgress | null>(null);

  useEffect(() => {
    if (state.transferProgress) {
      progressRef.current = state.transferProgress;
    }
  }, [state.transferProgress]);

  const startTransfer = async () => {
    if (!state.transferPlan) return;

    setIsTransferring(true);
    onUpdate({ isTransferring: true, isPaused: false });
    
    abortControllerRef.current = new AbortController();
    
    const startTime = new Date();
    const progress: TransferProgress = {
      totalFiles: state.transferPlan.files.length,
      completedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      totalBytes: state.transferPlan.totalBytes,
      transferredBytes: 0,
      startTime,
      throughput: 0
    };

    onUpdate({ transferProgress: progress });
    progressRef.current = progress;

    addLog('info', `Starting ${state.transferOptions.dryRun ? 'dry run' : 'transfer'} of ${progress.totalFiles} files`);

    try {
      const isSupabaseToR2 = state.transferOptions.direction === 'supabase-to-r2';
      const sourceManager = isSupabaseToR2 
        ? new SupabaseManager(state.supabaseCredentials)
        : new R2Manager(state.r2Credentials);
      
      const destManager = isSupabaseToR2
        ? new R2Manager(state.r2Credentials)
        : new SupabaseManager(state.supabaseCredentials);

      // Process files with concurrency control
      const concurrency = state.transferOptions.concurrency;
      const filesToProcess = state.transferPlan.files.filter(f => f.action !== 'skip');
      
      for (let i = 0; i < filesToProcess.length; i += concurrency) {
        if (abortControllerRef.current?.signal.aborted) break;
        
        const batch = filesToProcess.slice(i, i + concurrency);
        const batchPromises = batch.map(file => processFile(file, sourceManager, destManager, isSupabaseToR2));
        
        setCurrentFiles(batch.map(f => f.key));
        await Promise.allSettled(batchPromises);
      }

      const finalProgress = progressRef.current;
      if (finalProgress) {
        const duration = (Date.now() - startTime.getTime()) / 1000;
        addLog('success', `Transfer completed in ${formatDuration(duration)}`);
        addLog('info', `Results: ${finalProgress.completedFiles} completed, ${finalProgress.failedFiles} failed, ${finalProgress.skippedFiles} skipped`);
      }

      onComplete();
      
    } catch (error) {
      addLog('error', `Transfer failed: ${(error as Error).message}`);
    }

    setIsTransferring(false);
    setCurrentFiles([]);
    onUpdate({ isTransferring: false });
  };

  const processFile = async (
    file: FileObject, 
    sourceManager: SupabaseManager | R2Manager, 
    destManager: SupabaseManager | R2Manager,
    isSupabaseToR2: boolean
  ): Promise<void> => {
    try {
      if (state.transferOptions.dryRun) {
        // Simulate processing time for dry run
        await new Promise(resolve => setTimeout(resolve, 100));
        updateProgress('completed', file.size);
        addLog('info', `[DRY RUN] Would transfer: ${file.bucket}/${file.key}`, file.key);
        return;
      }

      if (file.action === 'skip') {
        updateProgress('skipped', 0);
        addLog('info', `Skipped existing file: ${file.bucket}/${file.key}`, file.key);
        return;
      }

      // Download from source
      let blob: Blob;
      if (isSupabaseToR2) {
        blob = await (sourceManager as SupabaseManager).downloadFile(file.bucket, file.key);
      } else {
        blob = await (sourceManager as R2Manager).downloadFile(file.bucket, file.key);
      }

      // Upload to destination
      if (isSupabaseToR2) {
        const result = await (destManager as R2Manager).uploadFile(
          file.bucket, 
          file.key, 
          blob, 
          { 
            contentType: file.contentType,
            onProgress: (progress) => {
              // Update progress for this file
              const transferredBytes = Math.round(file.size * progress);
              file.transferredBytes = transferredBytes;
            }
          }
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }
      } else {
        const result = await (destManager as SupabaseManager).uploadFile(
          file.bucket,
          file.key,
          blob,
          { 
            upsert: file.action === 'overwrite',
            contentType: file.contentType 
          }
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }
      }

      updateProgress('completed', file.size);
      addLog('success', `Transferred: ${file.bucket}/${file.key} (${formatBytes(file.size)})`, file.key);

    } catch (error) {
      updateProgress('failed', 0);
      addLog('error', `Failed to transfer ${file.bucket}/${file.key}: ${(error as Error).message}`, file.key);
    }
  };

  const updateProgress = (type: 'completed' | 'failed' | 'skipped', bytes: number) => {
    if (!progressRef.current) return;

    const progress = { ...progressRef.current };
    
    switch (type) {
      case 'completed':
        progress.completedFiles++;
        progress.transferredBytes += bytes;
        break;
      case 'failed':
        progress.failedFiles++;
        break;
      case 'skipped':
        progress.skippedFiles++;
        break;
    }

    // Calculate throughput and ETA
    const elapsedSeconds = (Date.now() - progress.startTime.getTime()) / 1000;
    progress.throughput = calculateThroughput(progress.transferredBytes, elapsedSeconds);
    progress.estimatedTimeRemaining = estimateTimeRemaining(
      progress.totalBytes,
      progress.transferredBytes,
      progress.throughput
    );

    progressRef.current = progress;
    onUpdate({ transferProgress: progress });
  };

  const pauseTransfer = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onUpdate({ isPaused: true, isTransferring: false });
    setIsTransferring(false);
    addLog('warning', 'Transfer paused');
  };

  const resumeTransfer = () => {
    // For simplicity, we'll restart the transfer
    // In a production app, you'd want to resume from where you left off
    startTransfer();
    addLog('info', 'Transfer resumed');
  };

  const cancelTransfer = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsTransferring(false);
    setCurrentFiles([]);
    onUpdate({ isTransferring: false, isPaused: false });
    addLog('warning', 'Transfer cancelled');
  };

  const progress = state.transferProgress;
  const progressPercentage = progress ? (progress.completedFiles / progress.totalFiles) * 100 : 0;
  const bytesPercentage = progress ? (progress.transferredBytes / progress.totalBytes) * 100 : 0;

  return (
    <div className="card">
      <h2>{state.transferOptions.dryRun ? 'Dry Run' : 'Transfer'} in Progress</h2>

      {progress && (
        <>
          {/* Overall Progress */}
          <div style={{ marginBottom: '2em' }}>
            <h3>Overall Progress</h3>
            
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1em', marginTop: '1em' }}>
              <div>
                <strong>Files:</strong> {progress.completedFiles} / {progress.totalFiles} ({progressPercentage.toFixed(1)}%)
              </div>
              <div>
                <strong>Data:</strong> {formatBytes(progress.transferredBytes)} / {formatBytes(progress.totalBytes)} ({bytesPercentage.toFixed(1)}%)
              </div>
              <div>
                <strong>Speed:</strong> {formatBytes(progress.throughput)}/s
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1em', marginTop: '1em' }}>
              <div style={{ color: '#4ade80' }}>
                <strong>Completed:</strong> {progress.completedFiles}
              </div>
              <div style={{ color: '#ef4444' }}>
                <strong>Failed:</strong> {progress.failedFiles}
              </div>
              <div style={{ color: '#fbbf24' }}>
                <strong>Skipped:</strong> {progress.skippedFiles}
              </div>
            </div>

            {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
              <div style={{ marginTop: '1em' }}>
                <strong>Estimated Time Remaining:</strong> {formatDuration(progress.estimatedTimeRemaining)}
              </div>
            )}
          </div>

          {/* Current Files */}
          {currentFiles.length > 0 && (
            <div style={{ marginBottom: '2em' }}>
              <h3>Currently Processing</h3>
              <div style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                {currentFiles.map((file, index) => (
                  <div key={index} style={{ padding: '0.25em 0' }}>
                    📄 {file}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div style={{ textAlign: 'center', marginTop: '2em' }}>
            {!isTransferring && !state.isPaused && (
              <button className="btn btn-primary" onClick={startTransfer}>
                {state.transferOptions.dryRun ? 'Start Dry Run' : 'Start Transfer'}
              </button>
            )}

            {isTransferring && (
              <>
                <button className="btn btn-warning" onClick={pauseTransfer}>
                  Pause
                </button>
                <button className="btn btn-danger" onClick={cancelTransfer}>
                  Cancel
                </button>
              </>
            )}

            {state.isPaused && (
              <>
                <button className="btn btn-primary" onClick={resumeTransfer}>
                  Resume
                </button>
                <button className="btn btn-danger" onClick={cancelTransfer}>
                  Cancel
                </button>
              </>
            )}

            <button className="btn" onClick={onBack} disabled={isTransferring}>
              Back to Plan
            </button>
          </div>
        </>
      )}

      {!progress && (
        <div style={{ textAlign: 'center' }}>
          <p>Ready to start transfer</p>
          <button className="btn btn-primary" onClick={startTransfer}>
            {state.transferOptions.dryRun ? 'Start Dry Run' : 'Start Transfer'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TransferStep;
