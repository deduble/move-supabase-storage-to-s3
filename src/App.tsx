import { useState, useEffect } from 'react';
import { AppState, LogEntry } from './types';
import { storage } from './utils/storage';
import TOSModal from './components/TOSModal';
import CredentialsStep from './components/CredentialsStep';
import OptionsStep from './components/OptionsStep';
import PlanStep from './components/PlanStep';
import TransferStep from './components/TransferStep';
import CompleteStep from './components/CompleteStep';
import Stepper from './components/Stepper';
import ErrorBoundary from './components/ErrorBoundary';

const initialState: AppState = {
  step: 'tos',
  tosAccepted: false,
  supabaseCredentials: {
    url: 'https://djjkahrtaadgqutzdnxh.supabase.co',
    serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqamthaHJ0YWFkZ3F1dHpkbnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjYwMDAxNywiZXhwIjoyMDcyMTc2MDE3fQ.P4xbu2RAU-U8c331bkvd3ynrJnm-6vpgnTAq64P0zto'
  },
  r2Credentials: {
    accountId: '3113757f0fb2bf6bd8b6240cd7fd4a47',
    accessKeyId: '566bf6b5f4627cc258d7b52ae8360f44',
    secretAccessKey: '10243fabf51e0d72c5e8c8770ec22710f7f590c7ae8dfb1897f2587e97474727',
    endpoint: 'https://3113757f0fb2bf6bd8b6240cd7fd4a47.r2.cloudflarestorage.com'
  },
  transferOptions: {
    direction: 'supabase-to-r2',
    selectedBuckets: [],
    prefixFilter: '',
    conflictPolicy: 'skip',
    concurrency: 4,
    dryRun: true,
    maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
    verifyIntegrity: true
  },
  logs: [],
  isPaused: false,
  isTransferring: false,
  availableBuckets: {
    supabase: [],
    r2: []
  }
};

function App() {
  const [state, setState] = useState<AppState>(initialState);

  useEffect(() => {
    loadSavedState();
  }, []);

  const loadSavedState = async () => {
    try {
      const savedState = await storage.loadAppState();
      const savedLogs = await storage.loadLogs();
      
      if (savedState) {
        setState(prev => ({
          ...prev,
          ...savedState,
          logs: savedLogs
        }));
      }
    } catch (error) {
      console.error('Failed to load saved state:', error);
    }
  };

  const updateState = async (updates: Partial<AppState>) => {
    // Use functional update to ensure React detects state changes
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      
      // Save to storage (excluding sensitive data by default) - don't await in setState
      const stateToSave = { ...updates };
      if (!updates.tosAccepted) {
        delete stateToSave.supabaseCredentials;
        delete stateToSave.r2Credentials;
      }
      
      // Save asynchronously without blocking state update
      storage.saveAppState(stateToSave).catch(console.error);
      
      if (updates.logs) {
        storage.saveLogs(updates.logs).catch(console.error);
      }
      
      return newState;
    });
  };

  const addLog = (level: LogEntry['level'], message: string, file?: string) => {
    const newLog: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      file
    };
    
    const newLogs = [...state.logs, newLog];
    updateState({ logs: newLogs });
  };

  const clearData = async () => {
    try {
      await storage.clearAll();
      setState(initialState);
      addLog('info', 'All application data cleared successfully');
    } catch (error) {
      addLog('error', `Failed to clear data: ${(error as Error).message}`);
    }
  };


  // Auto-cleanup on page unload for security
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state.tosAccepted) {
        storage.clearAll().catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.tosAccepted]);

  const renderCurrentStep = () => {
    switch (state.step) {
      case 'tos':
        return (
          <TOSModal
            onAccept={() => updateState({ tosAccepted: true, step: 'credentials' })}
          />
        );
      case 'credentials':
        return (
          <CredentialsStep
            state={state}
            onUpdate={updateState}
            onNext={() => updateState({ step: 'options' })}
            addLog={addLog}
          />
        );
      case 'options':
        return (
          <OptionsStep
            state={state}
            onUpdate={updateState}
            onNext={() => updateState({ step: 'plan' })}
            onBack={() => updateState({ step: 'credentials' })}
          />
        );
      case 'plan':
        return (
          <PlanStep
            state={state}
            onUpdate={updateState}
            onNext={() => updateState({ step: 'transfer' })}
            onBack={() => updateState({ step: 'options' })}
            addLog={addLog}
          />
        );
      case 'transfer':
        return (
          <TransferStep
            state={state}
            onUpdate={updateState}
            onComplete={() => updateState({ step: 'complete' })}
            onBack={() => updateState({ step: 'plan' })}
            addLog={addLog}
          />
        );
      case 'complete':
        return (
          <CompleteStep
            state={state}
            onRestart={() => updateState({ step: 'credentials', transferPlan: undefined, transferProgress: undefined })}
            onClearData={clearData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <div className="App">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <a 
            href="https://buymeacoffee.com/deduble" 
            target="_blank" 
            rel="noreferrer" 
            style={{ 
              display: 'inline-block',
              backgroundColor: '#fbbf24',
              color: '#000',
              padding: '8px 16px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.95em',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              border: '2px solid #f59e0b'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f59e0b';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#fbbf24';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            ☕ Buy me a coffee
          </a>
        </div>

        <h1 style={{ marginBottom: 8 }}>Supabase ↔ R2 Storage Migrator</h1>
        <p style={{ marginTop: 0, opacity: 0.85 }}>Fast, non-destructive copy between Supabase Storage and Cloudflare R2</p>

        {state.step !== 'tos' && (
          <Stepper currentStep={state.step} />
        )}

        <ErrorBoundary>
          {renderCurrentStep()}
        </ErrorBoundary>

        {state.step !== 'tos' && state.logs.length > 0 && (
          <div className="card">
            <h3>Activity Log</h3>
            <div className="log-container">
              {state.logs.slice(-50).map((log, index) => (
                <div key={index} className={`log-entry log-${log.level}`}>
                  <span>[{new Date(log.timestamp).toLocaleTimeString()}] </span>
                  <span>{log.message}</span>
                  {log.file && <span> - {log.file}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
