import { 
  S3Client, 
  ListBucketsCommand, 
  ListObjectsV2Command, 
  HeadObjectCommand, 
  GetObjectCommand,
  CreateBucketCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { R2Credentials, FileObject } from '../types';

export class R2Manager {
  private client: S3Client;

  constructor(credentials: R2Credentials) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: credentials.endpoint,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
      forcePathStyle: true,
      requestHandler: {
        requestTimeout: 30000,
        httpsAgent: undefined
      }
    });
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Simplified connection test - just try to list buckets
      // This is the most basic operation that should work if credentials are valid
      const command = new ListBucketsCommand({});
      await this.client.send(command);
      
      return { success: true };
    } catch (error) {
      const errorMsg = (error as Error).message;
      
      // Provide specific guidance based on error type
      if (errorMsg.includes('fetch') || errorMsg.includes('CORS') || errorMsg.includes('Access to fetch')) {
        return { 
          success: false, 
          error: 'Browser CORS limitation detected. This is normal - actual file transfers will work despite this test failing. CORS is only needed for connection testing in browsers.' 
        };
      }
      
      if (errorMsg.includes('InvalidAccessKeyId') || errorMsg.includes('SignatureDoesNotMatch')) {
        return { 
          success: false, 
          error: 'Invalid credentials. Please check your Access Key ID and Secret Access Key.' 
        };
      }
      
      if (errorMsg.includes('NoSuchBucket') || errorMsg.includes('AccessDenied')) {
        return { 
          success: false, 
          error: 'Access denied. Check your credentials have permission to list buckets.' 
        };
      }
      
      if (errorMsg.includes('NetworkingError') || errorMsg.includes('timeout')) {
        return {
          success: false,
          error: 'Network error. Check your internet connection and R2 endpoint URL.'
        };
      }
      
      return { 
        success: false, 
        error: `Connection test failed: ${errorMsg}. Note: File transfers may still work even if this test fails due to browser security limitations.` 
      };
    }
  }


  async listBuckets(): Promise<string[]> {
    try {
      const command = new ListBucketsCommand({});
      const response = await this.client.send(command);
      return response.Buckets?.map(bucket => bucket.Name || '') || [];
    } catch (error) {
      console.error('Failed to list R2 buckets:', error);
      return [];
    }
  }

  async createBucket(bucketName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const command = new CreateBucketCommand({ Bucket: bucketName });
      await this.client.send(command);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async listFiles(bucket: string, prefix?: string): Promise<FileObject[]> {
    try {
      const files: FileObject[] = [];
      let continuationToken: string | undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000
        });

        const response = await this.client.send(command);
        
        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key) {
              files.push({
                bucket,
                key: obj.Key,
                size: obj.Size || 0,
                lastModified: obj.LastModified || new Date(),
                etag: obj.ETag,
                source: 'r2' as const,
                destination: 'supabase' as const,
                action: 'copy' as const,
                status: 'pending' as const
              });
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return files;
    } catch (error) {
      console.error(`Failed to list files in R2 bucket ${bucket}:`, error);
      return [];
    }
  }

  async downloadFile(bucket: string, key: string): Promise<Blob> {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('No data received');
      }

      // Convert ReadableStream to Blob
      const chunks: Uint8Array[] = [];
      const reader = (response.Body as ReadableStream<Uint8Array>).getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      return new Blob(chunks as BlobPart[], { type: response.ContentType });
    } catch (error) {
      console.error(`Failed to download file ${key} from R2 bucket ${bucket}:`, error);
      throw error;
    }
  }

  async uploadFile(
    bucket: string,
    key: string,
    file: Blob,
    options: { contentType?: string; onProgress?: (progress: number) => void } = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: file,
          ContentType: options.contentType || 'application/octet-stream'
        },
        queueSize: 4,
        partSize: 1024 * 1024 * 5, // 5MB parts
      });

      if (options.onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          if (progress.loaded && progress.total) {
            options.onProgress!(progress.loaded / progress.total);
          }
        });
      }

      await upload.done();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async fileExists(bucket: string, key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getFileMetadata(bucket: string, key: string): Promise<{
    size: number;
    lastModified: Date;
    etag?: string;
    contentType?: string;
  } | null> {
    try {
      const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.client.send(command);
      
      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag,
        contentType: response.ContentType
      };
    } catch (error) {
      return null;
    }
  }
}
