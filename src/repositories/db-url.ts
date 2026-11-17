import path from 'node:path';

/**
 * Resolves a SQLite `file:` URL. Relative paths are resolved against the
 * `prisma/` directory (the schema location), so `file:./dev.db` means
 * `prisma/dev.db` regardless of the process working directory.
 */
export function resolveDbUrl(raw: string | undefined, root = process.cwd()): string {
  const url = raw && raw.length > 0 ? raw : 'file:./dev.db';
  if (!url.startsWith('file:')) return url;
  const p = url.slice('file:'.length);
  const abs = path.isAbsolute(p) ? p : path.resolve(root, 'prisma', p);
  return 'file:' + abs.split(path.sep).join('/');
}
