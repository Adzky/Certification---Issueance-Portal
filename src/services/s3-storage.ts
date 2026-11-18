import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export interface S3ObjectClient {
  putObject(bucket: string, key: string, body: Uint8Array): Promise<void>;
  getObject(bucket: string, key: string): Promise<Uint8Array>;
  listObjects(
    bucket: string,
    prefix: string,
    continuationToken?: string,
  ): Promise<{ keys: string[]; nextContinuationToken?: string }>;
  deleteObjects(bucket: string, keys: string[]): Promise<void>;
}

interface S3Storage {
  saveControlDocument(applicationId: string, slot: number, bytes: Uint8Array): Promise<string>;
  readControlDocument(storagePath: string): Promise<Uint8Array>;
  deleteApplicationFiles(applicationId: string): Promise<void>;
}

let cachedStorage:
  | {
      endpoint: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      storage: S3Storage;
    }
  | undefined;

export function createS3Storage(client: S3ObjectClient, bucket: string): S3Storage {
  return {
    async saveControlDocument(applicationId, slot, bytes) {
      const key = `registrations/${resolveApplicationId(applicationId)}/${slot}.pdf`;
      await client.putObject(bucket, key, bytes);
      return key;
    },
    async readControlDocument(storagePath) {
      return client.getObject(bucket, resolveStoragePath(storagePath));
    },
    async deleteApplicationFiles(applicationId) {
      const prefix = `registrations/${resolveApplicationId(applicationId)}/`;
      let continuationToken: string | undefined;
      do {
        const page = await client.listObjects(bucket, prefix, continuationToken);
        const keys = page.keys.filter((key) => key.startsWith(prefix));
        if (keys.length > 0) await client.deleteObjects(bucket, keys);
        continuationToken = page.nextContinuationToken;
      } while (continuationToken);
    },
  };
}

export function createS3StorageFromEnv(): S3Storage {
  const endpoint = requiredEnv('S3_ENDPOINT');
  const bucket = requiredEnv('S3_BUCKET');
  const accessKeyId = requiredEnv('S3_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnv('S3_SECRET_ACCESS_KEY');
  const region = process.env.S3_REGION || 'auto';
  if (
    cachedStorage?.endpoint === endpoint &&
    cachedStorage.bucket === bucket &&
    cachedStorage.accessKeyId === accessKeyId &&
    cachedStorage.secretAccessKey === secretAccessKey &&
    cachedStorage.region === region
  ) {
    return cachedStorage.storage;
  }
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  const storage = createS3Storage(createS3ObjectClient(client), bucket);
  cachedStorage = { endpoint, bucket, accessKeyId, secretAccessKey, region, storage };
  return storage;
}

function createS3ObjectClient(client: S3Client): S3ObjectClient {
  return {
    async putObject(bucket, key, body) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
    },
    async getObject(bucket, key) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!response.Body) throw new Error(`S3 object ${key} has no body`);
      return new Uint8Array(await response.Body.transformToByteArray());
    },
    async listObjects(bucket, prefix, continuationToken) {
      const response = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
      );
      if (response.IsTruncated && !response.NextContinuationToken) {
        throw new Error(`S3 listing for ${prefix} is truncated without a continuation token`);
      }
      return {
        keys: (response.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : [])),
        nextContinuationToken: response.NextContinuationToken,
      };
    },
    async deleteObjects(bucket, keys) {
      const response = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      if (response.Errors?.length) {
        throw new Error(`Failed to delete S3 object ${response.Errors[0]?.Key ?? '(unknown key)'}`);
      }
    },
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=s3`);
  return value;
}

function resolveApplicationId(applicationId: string): string {
  if (!applicationId || applicationId === '.' || applicationId === '..' || /[\\/]/.test(applicationId)) {
    throw new Error('Invalid application ID');
  }
  return applicationId;
}

function resolveStoragePath(storagePath: string): string {
  const segments = storagePath.replaceAll('\\', '/').split('/');
  if (!storagePath || segments.some((segment) => segment === '..') || segments[0] !== 'registrations') {
    throw new Error('Invalid storage path');
  }
  return segments.join('/');
}
