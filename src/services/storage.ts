import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
  const full = resolveInside(storagePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return storagePath;
}

export async function readControlDocument(storagePath: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(resolveInside(storagePath)));
}

/** Removes everything stored for an application (best effort). */
export async function deleteApplicationFiles(applicationId: string): Promise<void> {
  await rm(resolveInside(`registrations/${applicationId}`), { recursive: true, force: true });
}
