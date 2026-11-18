import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createS3Storage, type S3ObjectClient } from '@/services/s3-storage';
import { deleteApplicationFiles, readControlDocument, saveControlDocument } from '@/services/storage';

describe('registration document storage', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'portal-storage-'));
    vi.stubEnv('STORAGE_DIR', directory);
    vi.stubEnv('STORAGE_DRIVER', undefined);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('uses the local filesystem by default', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const storedPath = await saveControlDocument('application-1', 1, bytes);

    expect(storedPath).toBe('registrations/application-1/1.pdf');
    expect(await readControlDocument(storedPath)).toEqual(bytes);

    await deleteApplicationFiles('application-1');
    await expect(readControlDocument(storedPath)).rejects.toThrow();
  });

  it('requires complete R2 configuration instead of falling back to local disk', async () => {
    vi.stubEnv('STORAGE_DRIVER', 's3');
    vi.stubEnv('S3_ENDPOINT', undefined);
    vi.stubEnv('S3_BUCKET', 'documents');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'key');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret');

    await expect(saveControlDocument('application-1', 1, new Uint8Array([1]))).rejects.toThrow(
      'S3_ENDPOINT is required when STORAGE_DRIVER=s3',
    );
    await expect(fs.stat(path.join(directory, 'registrations'))).rejects.toThrow();
  });

  it('writes and reads the exact bytes with an S3-compatible client', async () => {
    const objects = new Map<string, Uint8Array>();
    const client: S3ObjectClient = {
      async putObject(_bucket, key, body) {
        objects.set(key, body);
      },
      async getObject(_bucket, key) {
        const body = objects.get(key);
        if (!body) throw new Error('Object not found');
        return body;
      },
      async listObjects() {
        return { keys: [] };
      },
      async deleteObjects() {},
    };
    const storage = createS3Storage(client, 'documents');
    const bytes = new Uint8Array([0, 37, 80, 68, 70, 255]);

    const storedPath = await storage.saveControlDocument('application-1', 2, bytes);

    expect(await storage.readControlDocument(storedPath)).toEqual(bytes);
    await expect(storage.readControlDocument('registrations/missing/1.pdf')).rejects.toThrow('Object not found');
  });

  it('deletes only an application prefix across paginated S3 listings', async () => {
    const listedPrefixes: string[] = [];
    const deleted: string[][] = [];
    const client: S3ObjectClient = {
      async putObject() {},
      async getObject() {
        return new Uint8Array();
      },
      async listObjects(_bucket, prefix, continuationToken) {
        listedPrefixes.push(prefix);
        if (!continuationToken) return { keys: [`${prefix}1.pdf`], nextContinuationToken: 'next-page' };
        return { keys: [`${prefix}2.pdf`] };
      },
      async deleteObjects(_bucket, keys) {
        deleted.push(keys);
      },
    };

    await createS3Storage(client, 'documents').deleteApplicationFiles('application-1');

    expect(listedPrefixes).toEqual(['registrations/application-1/', 'registrations/application-1/']);
    expect(deleted).toEqual([['registrations/application-1/1.pdf'], ['registrations/application-1/2.pdf']]);
  });
});
