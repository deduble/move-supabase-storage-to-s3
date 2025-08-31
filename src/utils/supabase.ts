import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseCredentials, FileObject } from '../types';

export class SupabaseManager {
  private client: SupabaseClient;

  constructor(credentials: SupabaseCredentials) {
    this.client = createClient(credentials.url, credentials.serviceKey);
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.storage.listBuckets();
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async listBuckets(): Promise<string[]> {
    try {
      const { data, error } = await this.client.storage.listBuckets();
      if (error) throw new Error(error.message);
      return data.map(bucket => bucket.name);
    } catch (error) {
      console.error('Failed to list Supabase buckets:', error);
      return [];
    }
  }

  async createBucket(bucketName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.storage.createBucket(bucketName, {
        public: false,
        allowedMimeTypes: undefined,
        fileSizeLimit: undefined
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Quick probe: can we query storage.objects via REST API?
  async fastListingAvailable(): Promise<boolean> {
    try {
      const { error } = await this.client
        .schema('storage')
        .from('objects')
        .select('id')
        .limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  // DB-first listing with automatic fallback to Storage API
  async listFilesFromDatabase(buckets: string[], prefixFilter?: string): Promise<FileObject[]> {
    const allFiles: FileObject[] = [];

    for (const bucket of buckets) {
      const usedDB = await this.tryListViaDB(bucket, prefixFilter, allFiles);
      if (!usedDB) {
        const fallback = await this.listFiles(bucket, prefixFilter);
        allFiles.push(...fallback);
      }
    }

    return allFiles;
  }

  private async tryListViaDB(
    bucket: string,
    prefix?: string,
    collector?: FileObject[]
  ): Promise<boolean> {
    try {
      const pageSize = 1000;
      let from = 0;
      let any = false;
      while (true) {
        const { data, error } = await this.client
          .schema('storage')
          .from('objects')
          .select('name, bucket_id, metadata, updated_at')
          .eq('bucket_id', bucket)
          .like('name', `${prefix ?? ''}%`)
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        any = true;
        const mapped = data
          .filter(row => row.name)
          .map(row => ({
            bucket: row.bucket_id as string,
            key: row.name as string,
            size: (row as any).metadata?.size ?? 0,
            lastModified: new Date((row as any).updated_at),
            contentType: (row as any).metadata?.mimetype,
            source: 'supabase' as const,
            destination: 'r2' as const,
            action: 'copy' as const,
            status: 'pending' as const
          }));
        collector?.push(...mapped);

        if (data.length < pageSize) break;
        from += pageSize;
      }
      return any;
    } catch (e) {
      // DB path unavailable – schema not exposed or insufficient perms
      return false;
    }
  }

  async listFiles(bucket: string, prefix?: string): Promise<FileObject[]> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .list(prefix || '', {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) throw new Error(error.message);
      if (!data) return [];

      return data
        .filter(file => file.name) // Filter out folders
        .map(file => ({
          bucket,
          key: prefix ? `${prefix}/${file.name}` : file.name,
          size: file.metadata?.size || 0,
          lastModified: new Date(file.updated_at || file.created_at),
          contentType: file.metadata?.mimetype,
          etag: file.metadata?.eTag,
          source: 'supabase' as const,
          destination: 'r2' as const,
          action: 'copy' as const,
          status: 'pending' as const
        }));
    } catch (error) {
      console.error(`Failed to list files in bucket ${bucket}:`, error);
      return [];
    }
  }

  async downloadFile(bucket: string, path: string): Promise<Blob> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .download(path);

      if (error) throw new Error(error.message);
      if (!data) throw new Error('No data received');

      return data;
    } catch (error) {
      console.error(`Failed to download file ${path} from bucket ${bucket}:`, error);
      throw error;
    }
  }

  async uploadFile(
    bucket: string,
    path: string,
    file: Blob,
    options: { upsert?: boolean; contentType?: string } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.storage
        .from(bucket)
        .upload(path, file, {
          upsert: options.upsert || false,
          contentType: options.contentType
        });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async fileExists(bucket: string, path: string): Promise<boolean> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .list(path.split('/').slice(0, -1).join('/') || '', {
          search: path.split('/').pop()
        });

      if (error) return false;
      return data?.some(file => file.name === path.split('/').pop()) || false;
    } catch (error) {
      return false;
    }
  }
}
