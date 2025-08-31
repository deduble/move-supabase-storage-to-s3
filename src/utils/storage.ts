import { get, set, del, clear } from 'idb-keyval';
import { AppState, TransferProgress, LogEntry } from '../types';

const STORAGE_KEYS = {
  APP_STATE: 'app-state',
  TRANSFER_PROGRESS: 'transfer-progress',
  LOGS: 'logs',
  CREDENTIALS: 'credentials',
  TRANSFER_PLAN: 'transfer-plan'
};

export const storage = {
  async saveAppState(state: Partial<AppState>): Promise<void> {
    try {
      await set(STORAGE_KEYS.APP_STATE, state);
    } catch (error) {
      console.error('Failed to save app state:', error);
    }
  },

  async loadAppState(): Promise<Partial<AppState> | null> {
    try {
      const result = await get(STORAGE_KEYS.APP_STATE);
      return result ?? null;
    } catch (error) {
      console.error('Failed to load app state:', error);
      return null;
    }
  },

  async saveTransferProgress(progress: TransferProgress): Promise<void> {
    try {
      await set(STORAGE_KEYS.TRANSFER_PROGRESS, progress);
    } catch (error) {
      console.error('Failed to save transfer progress:', error);
    }
  },

  async loadTransferProgress(): Promise<TransferProgress | null> {
    try {
      const result = await get(STORAGE_KEYS.TRANSFER_PROGRESS);
      return result ?? null;
    } catch (error) {
      console.error('Failed to load transfer progress:', error);
      return null;
    }
  },

  async saveLogs(logs: LogEntry[]): Promise<void> {
    try {
      await set(STORAGE_KEYS.LOGS, logs);
    } catch (error) {
      console.error('Failed to save logs:', error);
    }
  },

  async loadLogs(): Promise<LogEntry[]> {
    try {
      const logs = await get(STORAGE_KEYS.LOGS);
      return logs || [];
    } catch (error) {
      console.error('Failed to load logs:', error);
      return [];
    }
  },

  async clearAll(): Promise<void> {
    try {
      await clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  },

  async clearCredentials(): Promise<void> {
    try {
      await del(STORAGE_KEYS.CREDENTIALS);
    } catch (error) {
      console.error('Failed to clear credentials:', error);
    }
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export const calculateThroughput = (bytes: number, seconds: number): number => {
  return seconds > 0 ? bytes / seconds : 0;
};

export const estimateTimeRemaining = (
  totalBytes: number,
  transferredBytes: number,
  throughput: number
): number => {
  if (throughput <= 0) return 0;
  const remainingBytes = totalBytes - transferredBytes;
  return remainingBytes / throughput;
};
