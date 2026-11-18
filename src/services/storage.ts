import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createS3StorageFromEnv } from './s3-storage';

function getStorageDriver(): 'local' | 's3' {
  const driver = process.env.STORAGE_DRIVER ?? 'local';
  if (driver === 'local' || driver === 's3') return driver;
  throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
}

/** Root directory for uploaded files (resolved on every call so tests can override it). */
export function storageRoot(): string {
  return path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), 'storage'));
}

function resolveInside(storagePath: string): string {
  const root = storageRoot();
  const full = path.resolve(root, storagePath);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error('Invalid storage path');
  return full;
}

/** Writes `registrations/<applicationId>/<slot>.pdf`; returns the path relative to the storage root. */
export async function saveControlDocument(applicationId: string, slot: number, bytes: Uint8Array): Promise<string> {
  const storagePath = `registrations/${applicationId}/${slot}.pdf`;
  if (getStorageDriver() === 's3') {
    return createS3StorageFromEnv().saveControlDocument(applicationId, slot, bytes);
  }
  const full = resolveInside(storagePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return storagePath;
}

export async function readControlDocument(storagePath: string): Promise<Uint8Array> {
  if (getStorageDriver() === 's3') {
    return createS3StorageFromEnv().readControlDocument(storagePath);
  }
  return new Uint8Array(await readFile(resolveInside(storagePath)));
}

/** Removes everything stored for an application (best effort). */
export async function deleteApplicationFiles(applicationId: string): Promise<void> {
  if (getStorageDriver() === 's3') {
    return createS3StorageFromEnv().deleteApplicationFiles(applicationId);
  }
  await rm(resolveInside(`registrations/${applicationId}`), { recursive: true, force: true });
}
