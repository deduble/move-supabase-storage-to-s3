import React from 'react';
import { AppState } from '../types';
import { formatBytes } from '../utils/storage';

interface OptionsStepProps {
  state: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const OptionsStep: React.FC<OptionsStepProps> = ({
  state,
  onUpdate,
  onNext,
  onBack
}) => {
  let sourceBuckets = state.transferOptions.direction === 'supabase-to-r2'
    ? state.availableBuckets.supabase
    : state.availableBuckets.r2;

  // Add mock bucket for testing if no buckets found
  if (sourceBuckets.length === 0 && state.transferOptions.direction === 'supabase-to-r2') {
    sourceBuckets = ['test'];
  }

  const handleBucketSelection = (bucket: string, selected: boolean) => {
    const newSelection = selected
      ? [...state.transferOptions.selectedBuckets, bucket]
      : state.transferOptions.selectedBuckets.filter(b => b !== bucket);
    
    onUpdate({
      transferOptions: {
        ...state.transferOptions,
        selectedBuckets: newSelection
      }
    });
  };

  const selectAllBuckets = () => {
    onUpdate({
      transferOptions: {
        ...state.transferOptions,
        selectedBuckets: [...sourceBuckets]
      }
    });
  };

  const clearBucketSelection = () => {
    onUpdate({
      transferOptions: {
        ...state.transferOptions,
        selectedBuckets: []
      }
    });
  };

  const canProceed = state.transferOptions.selectedBuckets.length > 0;

  return (
    <div className="card">
      <h2>Transfer Options</h2>

      {/* Dry Run Toggle - Prominent */}
      <div className="card" style={{ backgroundColor: state.transferOptions.dryRun ? '#1a5f32' : '#5f1a1a', marginBottom: '2em', padding: '1.5em' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1em', marginBottom: '0.5em' }}>
          <input
            type="checkbox"
            id="dry-run-main"
            checked={state.transferOptions.dryRun}
            onChange={(e) => onUpdate({
              transferOptions: {
                ...state.transferOptions,
                dryRun: e.target.checked
              }
            })}
            style={{ transform: 'scale(1.3)' }}
          />
          <label htmlFor="dry-run-main" style={{ margin: 0, cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold' }}>
            {state.transferOptions.dryRun ? '🔍 DRY RUN MODE' : '⚠️ ACTUAL TRANSFER MODE'}
          </label>
        </div>
        <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.9 }}>
          {state.transferOptions.dryRun 
            ? 'Safe mode: Preview files and actions without making any changes'
            : 'LIVE mode: Files will actually be transferred and modified'
          }
        </p>
      </div>

      {/* Direction */}
      <div className="form-group">
        <label>Transfer Direction</label>
        <select
          value={state.transferOptions.direction}
          onChange={(e) => onUpdate({
            transferOptions: {
              ...state.transferOptions,
              direction: e.target.value as 'supabase-to-r2' | 'r2-to-supabase',
              selectedBuckets: [] // Reset selection when direction changes
            }
          })}
        >
          <option value="supabase-to-r2">Supabase → Cloudflare R2</option>
          <option value="r2-to-supabase">Cloudflare R2 → Supabase</option>
        </select>
      </div>

      {/* Bucket Selection */}
      <div className="form-group">
        <label>
          Source Buckets ({state.transferOptions.direction === 'supabase-to-r2' ? 'Supabase' : 'R2'})
        </label>
        
        <div style={{ marginBottom: '1em' }}>
          <button className="btn" onClick={selectAllBuckets}>Select All</button>
          <button className="btn" onClick={clearBucketSelection}>Clear All</button>
        </div>

        {sourceBuckets.length === 0 ? (
          <div className="warning">
            No buckets found. Please go back and test your connection.
          </div>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #444', padding: '1em', borderRadius: '4px' }}>
            {sourceBuckets.map(bucket => (
              <div key={bucket} className="checkbox-group">
                <input
                  type="checkbox"
                  id={`bucket-${bucket}`}
                  checked={state.transferOptions.selectedBuckets.includes(bucket)}
                  onChange={(e) => handleBucketSelection(bucket, e.target.checked)}
                />
                <label htmlFor={`bucket-${bucket}`}>{bucket}</label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prefix Filter */}
      <div className="form-group">
        <label>Path Prefix Filter (optional)</label>
        <input
          type="text"
          value={state.transferOptions.prefixFilter}
          onChange={(e) => onUpdate({
            transferOptions: {
              ...state.transferOptions,
              prefixFilter: e.target.value
            }
          })}
          placeholder="e.g., uploads/ or images/2024/"
        />
        <small style={{ color: '#ccc' }}>Only transfer files whose paths start with this prefix</small>
      </div>

      {/* Conflict Policy */}
      <div className="form-group">
        <label>Conflict Policy</label>
        <div style={{ marginTop: '0.5em' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '0.75em' }}>
            <input
              type="radio"
              id="policy-skip"
              name="conflictPolicy"
              value="skip"
              checked={state.transferOptions.conflictPolicy === 'skip'}
              onChange={(e) => onUpdate({
                transferOptions: {
                  ...state.transferOptions,
                  conflictPolicy: e.target.value as any
                }
              })}
            />
            <label htmlFor="policy-skip" style={{ cursor: 'pointer' }}>
              Skip existing files (safest)
            </label>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '0.75em' }}>
            <input
              type="radio"
              id="policy-newer"
              name="conflictPolicy"
              value="overwrite-newer"
              checked={state.transferOptions.conflictPolicy === 'overwrite-newer'}
              onChange={(e) => onUpdate({
                transferOptions: {
                  ...state.transferOptions,
                  conflictPolicy: e.target.value as any
                }
              })}
            />
            <label htmlFor="policy-newer" style={{ cursor: 'pointer' }}>
              Overwrite if source is newer
            </label>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
            <input
              type="radio"
              id="policy-always"
              name="conflictPolicy"
              value="always-overwrite"
              checked={state.transferOptions.conflictPolicy === 'always-overwrite'}
              onChange={(e) => onUpdate({
                transferOptions: {
                  ...state.transferOptions,
                  conflictPolicy: e.target.value as any
                }
              })}
            />
            <label htmlFor="policy-always" style={{ cursor: 'pointer', color: '#ef4444' }}>
              Always overwrite (dangerous)
            </label>
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <details style={{ marginTop: '2em' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Advanced Options</summary>
        
        <div style={{ marginTop: '1em' }}>
          <div className="form-group">
            <label>Concurrency (parallel transfers)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={state.transferOptions.concurrency}
              onChange={(e) => onUpdate({
                transferOptions: {
                  ...state.transferOptions,
                  concurrency: parseInt(e.target.value) || 4
                }
              })}
            />
            <small style={{ color: '#ccc' }}>Higher values = faster but more resource intensive</small>
          </div>

          <div className="form-group">
            <label>Max File Size</label>
            <select
              value={state.transferOptions.maxFileSize}
              onChange={(e) => onUpdate({
                transferOptions: {
                  ...state.transferOptions,
                  maxFileSize: parseInt(e.target.value)
                }
              })}
            >
              <option value={100 * 1024 * 1024}>100 MB</option>
              <option value={500 * 1024 * 1024}>500 MB</option>
              <option value={1024 * 1024 * 1024}>1 GB</option>
              <option value={2 * 1024 * 1024 * 1024}>2 GB</option>
              <option value={5 * 1024 * 1024 * 1024}>5 GB</option>
            </select>
            <small style={{ color: '#ccc' }}>Files larger than this will be skipped</small>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '0.75em' }}>
            <input
              type="checkbox"
              id="dry-run"
              checked={state.transferOptions.dryRun}
              onChange={(e) => onUpdate({
                transferOptions: {
                  ...state.transferOptions,
                  dryRun: e.target.checked
                }
              })}
            />
            <label htmlFor="dry-run" style={{ cursor: 'pointer' }}>
              Dry Run (preview only, no actual transfers)
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
            <input
              type="checkbox"
              id="verify-integrity"
              checked={state.transferOptions.verifyIntegrity}
              onChange={(e) => onUpdate({
                transferOptions: {
                  ...state.transferOptions,
                  verifyIntegrity: e.target.checked
                }
              })}
            />
            <label htmlFor="verify-integrity" style={{ cursor: 'pointer' }}>
              Verify file integrity (size comparison)
            </label>
          </div>
        </div>
      </details>

      {/* Summary */}
      <div className="card" style={{ marginTop: '2em', backgroundColor: '#333' }}>
        <h3>Transfer Summary</h3>
        <p><strong>Direction:</strong> {state.transferOptions.direction === 'supabase-to-r2' ? 'Supabase → R2' : 'R2 → Supabase'}</p>
        <p><strong>Selected Buckets:</strong> {state.transferOptions.selectedBuckets.length} ({state.transferOptions.selectedBuckets.join(', ')})</p>
        <p><strong>Prefix Filter:</strong> {state.transferOptions.prefixFilter || 'None'}</p>
        <p><strong>Conflict Policy:</strong> {state.transferOptions.conflictPolicy}</p>
        <p><strong>Max File Size:</strong> {formatBytes(state.transferOptions.maxFileSize)}</p>
        <p style={{ 
          color: state.transferOptions.dryRun ? '#4ade80' : '#ef4444', 
          fontWeight: 'bold',
          fontSize: '1.1em'
        }}>
          <strong>Mode:</strong> {state.transferOptions.dryRun ? '🔍 DRY RUN (Preview Only)' : '⚠️ ACTUAL TRANSFER'}
        </p>
      </div>

      <div style={{ marginTop: '2em', textAlign: 'center' }}>
        <button className="btn" onClick={onBack}>
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed}
        >
          Continue to Plan
        </button>
      </div>
    </div>
  );
};

export default OptionsStep;
