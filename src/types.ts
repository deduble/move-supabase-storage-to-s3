export interface SupabaseCredentials {
  url: string;
  serviceKey: string;
}

export interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
}

export interface TransferOptions {
  direction: 'supabase-to-r2' | 'r2-to-supabase';
  selectedBuckets: string[];
  prefixFilter: string;
  conflictPolicy: 'skip' | 'overwrite-newer' | 'always-overwrite';
  concurrency: number;
  dryRun: boolean;
  maxFileSize: number; // in bytes
  verifyIntegrity: boolean;
}

export interface FileObject {
  bucket: string;
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  etag?: string;
  source: 'supabase' | 'r2';
  destination: 'supabase' | 'r2';
  action: 'copy' | 'skip' | 'overwrite';
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  error?: string;
  transferredBytes?: number;
}

export interface TransferPlan {
  files: FileObject[];
  totalFiles: number;
  totalBytes: number;
  conflictCount: number;
  estimatedDuration: number; // in seconds
}

export interface TransferProgress {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  totalBytes: number;
  transferredBytes: number;
  currentFile?: string;
  startTime: Date;
  estimatedTimeRemaining?: number;
  throughput: number; // bytes per second
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  file?: string;
}

export interface AppState {
  step: 'tos' | 'credentials' | 'options' | 'plan' | 'transfer' | 'complete';
  tosAccepted: boolean;
  supabaseCredentials: SupabaseCredentials;
  r2Credentials: R2Credentials;
  transferOptions: TransferOptions;
  transferPlan?: TransferPlan;
  transferProgress?: TransferProgress;
  logs: LogEntry[];
  isPaused: boolean;
  isTransferring: boolean;
  availableBuckets: {
    supabase: string[];
    r2: string[];
  };
}

export interface StorageObject {
  id: string;
  name: string;
  bucket_id: string;
  owner?: string;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
  metadata: {
    eTag: string;
    size: number;
    mimetype: string;
    cacheControl: string;
    lastModified: string;
    contentLength: number;
    httpStatusCode: number;
  };
}
