/** The seven control documents every registration must upload, in slot order (slot 1 = first). */
export const REQUIRED_CONTROL_DOCUMENTS: readonly string[] = [
  'Job Description & Responsibility Matrix',
  'Competency Requirements & Assessment Record',
  'Training, Experience & Performance Record',
  'Formal Authorisation Letter (Draft/Previous)',
  'Authorisation Scope & Permission Matrix',
  'Impartiality, Confidentiality & Conflict of Interest Declaration',
  'Periodic Competency & Authorisation Review',
];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function hasPdfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((b, i) => bytes[i] === b);
}
