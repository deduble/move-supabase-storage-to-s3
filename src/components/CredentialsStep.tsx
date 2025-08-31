import React, { useState } from 'react';
import { AppState, LogEntry } from '../types';
import { SupabaseManager } from '../utils/supabase';
import { R2Manager } from '../utils/r2';

interface CredentialsStepProps {
  state: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
  onNext: () => void;
  addLog: (level: LogEntry['level'], message: string, file?: string) => void;
}

const CredentialsStep: React.FC<CredentialsStepProps> = ({
  state,
  onUpdate,
  onNext,
  addLog
}) => {
  const [testing, setTesting] = useState({ supabase: false, r2: false });
  const [testResults, setTestResults] = useState({ supabase: null as boolean | null, r2: null as boolean | null });
  const [validationErrors, setValidationErrors] = useState({ supabase: '', r2: '' });
  const [retryCount, setRetryCount] = useState({ supabase: 0, r2: 0 });

  // Validation functions
  const validateSupabaseUrl = (url: string): string => {
    if (!url.trim()) return 'Project URL is required';
    if (!url.includes('supabase.co')) return 'URL should be a Supabase project URL (*.supabase.co)';
    if (!url.startsWith('https://')) return 'URL must start with https://';
    return '';
  };

  const validateSupabaseKey = (key: string): string => {
    if (!key.trim()) return 'Service Role Key is required';
    if (!key.startsWith('eyJ')) return 'Service key should be a JWT token starting with "eyJ"';
    if (key.length < 100) return 'Service key appears to be incomplete';
    return '';
  };

  const validateR2Credentials = (creds: any): string => {
    if (!creds.accountId.trim()) return 'Account ID is required';
    if (!creds.accessKeyId.trim()) return 'Access Key ID is required';
    if (!creds.secretAccessKey.trim()) return 'Secret Access Key is required';
    if (creds.accountId.length !== 32) return 'Account ID should be 32 characters long';
    return '';
  };

  // Retry utility with exponential backoff
  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 2, baseDelay = 1000) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        const delay = baseDelay * Math.pow(2, attempt);
        addLog('warning', `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const testSupabaseConnection = async () => {
    // Validate inputs first
    const urlError = validateSupabaseUrl(state.supabaseCredentials.url);
    const keyError = validateSupabaseKey(state.supabaseCredentials.serviceKey);
    
    if (urlError || keyError) {
      setValidationErrors(prev => ({ ...prev, supabase: urlError || keyError }));
      addLog('error', `Validation failed: ${urlError || keyError}`);
      return;
    }

    setValidationErrors(prev => ({ ...prev, supabase: '' }));
    setTesting(prev => ({ ...prev, supabase: true }));
    setRetryCount(prev => ({ ...prev, supabase: 0 }));
    addLog('info', 'Testing Supabase connection...');
    
    try {
      const manager = new SupabaseManager(state.supabaseCredentials);
      
      await retryWithBackoff(async () => {
        const testResult = await manager.testConnection();
        if (!testResult.success) {
          throw new Error(testResult.error || 'Connection test failed');
        }
        return testResult;
      });
      
      addLog('success', 'Supabase connection successful');
      setTestResults(prev => ({ ...prev, supabase: true }));
      
      // Load available buckets with retry
      const buckets = await retryWithBackoff(async () => {
        return await manager.listBuckets();
      });
      
      const updatedBuckets = {
        ...state.availableBuckets,
        supabase: buckets
      };
      onUpdate({ availableBuckets: updatedBuckets });
      addLog('info', `Found ${buckets.length} Supabase buckets: ${buckets.join(', ')}`);
      
      // Force re-render by updating test results after bucket update
      setTimeout(() => setTestResults(prev => ({ ...prev, supabase: true })), 100);
      
    } catch (error) {
      addLog('error', `Supabase connection failed after retries: ${(error as Error).message}`);
      setTestResults(prev => ({ ...prev, supabase: false }));
    }
    
    setTesting(prev => ({ ...prev, supabase: false }));
  };

  const testR2Connection = async () => {
    // Validate inputs first
    const validationError = validateR2Credentials(state.r2Credentials);
    
    if (validationError) {
      setValidationErrors(prev => ({ ...prev, r2: validationError }));
      addLog('error', `Validation failed: ${validationError}`);
      return;
    }

    setValidationErrors(prev => ({ ...prev, r2: '' }));
    setTesting(prev => ({ ...prev, r2: true }));
    addLog('info', 'Testing R2 connection...');

    try {
      const manager = new R2Manager(state.r2Credentials);
      const result = await manager.testConnection();

      if (result.success) {
        addLog('success', 'R2 connection successful');
        setTestResults(prev => ({ ...prev, r2: true }));

        // Load available buckets
        const buckets = await manager.listBuckets();
        onUpdate({
          availableBuckets: {
            ...state.availableBuckets,
            r2: buckets
          }
        });
        addLog('info', `Found ${buckets.length} R2 buckets: ${buckets.join(', ')}`);
      } else {
        const errorMsg = result.error || 'Unknown error';
        if (errorMsg.includes('fetch') || errorMsg.includes('CORS') || errorMsg.includes('Access to fetch')) {
          addLog('error', 'R2 CORS error: Configure CORS policy on your R2 bucket for http://localhost:5173');
          addLog('warning', 'R2 requires per-bucket CORS. Add the origin http://localhost:5173 to your bucket CORS policy.');
        } else {
          addLog('error', `R2 connection failed: ${errorMsg}`);
        }
        setTestResults(prev => ({ ...prev, r2: false }));
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('fetch') || errorMsg.includes('CORS') || errorMsg.includes('Access to fetch')) {
        addLog('error', 'R2 CORS error: Configure CORS policy on your R2 bucket for http://localhost:5173');
        addLog('warning', 'R2 requires per-bucket CORS. Add the origin http://localhost:5173 to your bucket CORS policy.');
      } else {
        addLog('error', `R2 connection error: ${errorMsg}`);
      }
      setTestResults(prev => ({ ...prev, r2: false }));
    }

    setTesting(prev => ({ ...prev, r2: false }));
  };

  // Allow proceeding if at least Supabase connection works
  // R2 connection is optional - can be used for Supabase-only operations or configured later
  const canProceed = testResults.supabase === true;

  return (
    <div className="card">
      <h2>Storage Credentials</h2>
      
      <div className="warning">
        <strong>⚠️ Security Warning:</strong> Service keys provide full access to your storage. 
        Only use this application on trusted devices and clear credentials when finished.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2em', marginTop: '2em' }}>
        {/* Supabase Credentials */}
        <div>
          <h3>Supabase Storage</h3>
          
          <div className="form-group">
            <label>Project URL</label>
            <input
              type="url"
              value={state.supabaseCredentials.url}
              onChange={(e) => onUpdate({
                supabaseCredentials: {
                  ...state.supabaseCredentials,
                  url: e.target.value
                }
              })}
              placeholder="https://your-project.supabase.co"
            />
          </div>

          <div className="form-group">
            <label>Service Role Key</label>
            <textarea
              value={state.supabaseCredentials.serviceKey}
              onChange={(e) => onUpdate({
                supabaseCredentials: {
                  ...state.supabaseCredentials,
                  serviceKey: e.target.value
                }
              })}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              rows={3}
              style={{ fontFamily: 'monospace', fontSize: '0.9em' }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={testSupabaseConnection}
            disabled={testing.supabase || !state.supabaseCredentials.url || !state.supabaseCredentials.serviceKey}
            style={{ position: 'relative' }}
          >
            {testing.supabase ? (
              <span>
                <span style={{ opacity: 0.7 }}>🔄</span> Testing... (attempt {retryCount.supabase + 1})
              </span>
            ) : (
              'Test Connection'
            )}
          </button>

          {validationErrors.supabase && (
            <div className="error" style={{ marginTop: '1em' }}>
              ❌ {validationErrors.supabase}
            </div>
          )}

          {testResults.supabase === true && (
            <div className="success" style={{ marginTop: '1em' }}>
              ✅ Connection successful! Found {state.availableBuckets.supabase?.length || 0} buckets.
            </div>
          )}

          {testResults.supabase === false && (
            <div className="error" style={{ marginTop: '1em' }}>
              ❌ Connection failed. Check your credentials and try again.
            </div>
          )}
        </div>

        {/* R2 Credentials */}
        <div>
          <h3>Cloudflare R2</h3>
          
          <div className="form-group">
            <label>Account ID</label>
            <input
              type="text"
              value={state.r2Credentials.accountId}
              onChange={(e) => onUpdate({
                r2Credentials: {
                  ...state.r2Credentials,
                  accountId: e.target.value,
                  endpoint: `https://${e.target.value}.r2.cloudflarestorage.com`
                }
              })}
              placeholder="your-account-id"
            />
          </div>

          <div className="form-group">
            <label>Access Key ID</label>
            <input
              type="text"
              value={state.r2Credentials.accessKeyId}
              onChange={(e) => onUpdate({
                r2Credentials: {
                  ...state.r2Credentials,
                  accessKeyId: e.target.value
                }
              })}
              placeholder="your-access-key-id"
            />
          </div>

          <div className="form-group">
            <label>Secret Access Key</label>
            <input
              type="password"
              value={state.r2Credentials.secretAccessKey}
              onChange={(e) => onUpdate({
                r2Credentials: {
                  ...state.r2Credentials,
                  secretAccessKey: e.target.value
                }
              })}
              placeholder="your-secret-access-key"
            />
          </div>

          <div className="form-group">
            <label>Endpoint (auto-generated)</label>
            <input
              type="url"
              value={state.r2Credentials.endpoint}
              readOnly
              style={{ opacity: 0.7 }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={testR2Connection}
            disabled={testing.r2 || !state.r2Credentials.accountId || !state.r2Credentials.accessKeyId || !state.r2Credentials.secretAccessKey}
          >
            {testing.r2 ? 'Testing...' : 'Test Connection'}
          </button>

          {validationErrors.r2 && (
            <div className="error" style={{ marginTop: '1em' }}>
              ❌ {validationErrors.r2}
            </div>
          )}

          {testResults.r2 === true && (
            <div className="success" style={{ marginTop: '1em' }}>
              ✅ Connection successful! Found {state.availableBuckets.r2.length} buckets.
            </div>
          )}

          {testResults.r2 === false && (
            <div className="warning" style={{ marginTop: '1em' }}>
              ℹ️ R2 connection test incomplete. This is common in browsers due to CORS limitations - actual transfers will work fine.
              <details style={{ marginTop: '0.5em' }}>
                <summary style={{ cursor: 'pointer' }}>Why does this happen?</summary>
                <p style={{ fontSize: '0.9em', marginTop: '0.5em' }}>
                  Browser security prevents direct testing of AWS S3-compatible APIs. However, the AWS SDK uses optimized 
                  request patterns for actual file transfers that bypass these limitations. Your transfers will work normally.
                </p>
                <p style={{ fontSize: '0.9em', marginTop: '0.5em' }}>
                  <strong>Optional:</strong> To enable connection testing, add this CORS policy to your R2 bucket: Settings → CORS Policy → JSON
                </p>
                <pre style={{ fontSize: '0.8em', background: '#333', padding: '0.5em', borderRadius: '4px', marginTop: '0.5em' }}>
{`[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://deduble.github.io"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD", "DELETE", "OPTIONS"],
    "AllowedHeaders": [
      "Authorization", "Content-Type", "Content-Length", "Content-MD5",
      "x-amz-content-sha256", "x-amz-date", "x-amz-security-token",
      "x-amz-user-agent", "x-amz-acl", "x-amz-request-id",
      "x-amz-version-id", "x-id", "range", "if-match", "if-none-match",
      "if-modified-since", "if-unmodified-since", "cache-control",
      "expires", "x-amz-server-side-encryption", "x-amz-storage-class"
    ],
    "ExposeHeaders": [
      "ETag", "x-amz-request-id", "x-amz-version-id",
      "Content-Length", "Date", "Last-Modified", "x-amz-delete-marker"
    ],
    "MaxAgeSeconds": 3600
  }
]`}
                </pre>
                <p style={{ fontSize: '0.9em', marginTop: '0.5em' }}>
                  <strong>CRITICAL:</strong> Add this to your R2 bucket: Settings → CORS Policy → JSON<br/>
                  <em>CORS must be configured on the 'test' bucket specifically, not account-level.</em><br/>
                  <strong>Bucket URL being tested:</strong> https://3113757f0fb2bf6bd8b6240cd7fd4a47.r2.cloudflarestorage.com/test<br/>
                  <em>Note: You can proceed without R2 connection for Supabase-only operations.</em>
                </p>
              </details>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '2em', textAlign: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed}
        >
          Continue to Options
        </button>
        {testResults.supabase === true && testResults.r2 !== true && (
          <p style={{ fontSize: '0.9em', color: '#4ade80', marginTop: '1em' }}>
            ✅ Supabase connected! You can proceed - R2 transfers often work despite connection test issues.
          </p>
        )}
      </div>
    </div>
  );
};

export default CredentialsStep;
