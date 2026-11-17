/** Client-side checks for the onboarding form. They mirror the rules in `src/services/registrations.ts`. */
import { MAX_UPLOAD_BYTES, REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import type { RegistrationPayload } from '@/contract/types';
import type { Role } from '@/domain/types';

export interface RegistrationFormValues {
  personal: {
    fullName: string;
    employeeId: string;
    nationalId: string;
    position: string;
    unit: string;
    email: string;
    phone: string;
  };
  employment: {
    education: string;
    fieldOfStudy: string;
    /** Kept as text while typing; converted by {@link toPayload}. */
    experienceYears: string;
    employmentStatus: 'PERMANENT' | 'CONTRACT';
    startDate: string;
  };
  scopes: string[];
  declarationAccepted: boolean;
}

export const EDUCATION_OPTIONS = ['Diploma (D3)', 'Bachelor (S1)', 'Master (S2)', 'Doctorate (S3)', 'Other'] as const;

export const EMPTY_VALUES: RegistrationFormValues = {
  personal: { fullName: '', employeeId: '', nationalId: '', position: '', unit: '', email: '', phone: '' },
  employment: { education: 'Bachelor (S1)', fieldOfStudy: '', experienceYears: '', employmentStatus: 'PERMANENT', startDate: '' },
  scopes: [],
  declarationAccepted: false,
};

/** Error text per field key (`fullName`, `email`, `experienceYears`, `scopes`, `declarationAccepted`, ...). */
export type FieldErrors = Partial<Record<string, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistrationValues(v: RegistrationFormValues): FieldErrors {
  const e: FieldErrors = {};
  const required = (key: string, value: string, message: string) => {
    if (!value.trim()) e[key] = message;
  };
  required('fullName', v.personal.fullName, 'Full name is required');
  required('employeeId', v.personal.employeeId, 'Employee ID is required');
  required('nationalId', v.personal.nationalId, 'National ID is required');
  required('position', v.personal.position, 'Position is required');
  required('unit', v.personal.unit, 'Unit is required');
  required('phone', v.personal.phone, 'Phone is required');
  required('education', v.employment.education, 'Education is required');
  required('fieldOfStudy', v.employment.fieldOfStudy, 'Field of study is required');
  required('startDate', v.employment.startDate, 'Start date is required');
  if (!v.personal.email.trim()) e.email = 'Email is required';
  else if (!EMAIL.test(v.personal.email.trim())) e.email = 'Email is invalid';

  const years = v.employment.experienceYears.trim() === '' ? NaN : Number(v.employment.experienceYears);
  if (Number.isNaN(years)) e.experienceYears = 'Experience (years) is required';
  else if (years < 0) e.experienceYears = 'Experience must not be negative';
  else if (years > 80) e.experienceYears = 'Experience must be at most 80 years';

  if (v.scopes.length === 0) e.scopes = 'Select at least one service scope';
  if (!v.declarationAccepted) e.declarationAccepted = 'The declaration must be accepted';
  return e;
}

export function toPayload(role: Role, v: RegistrationFormValues): RegistrationPayload {
  const p = v.personal;
  return {
    role,
    scopes: v.scopes,
    personal: {
      fullName: p.fullName.trim(),
      employeeId: p.employeeId.trim(),
      nationalId: p.nationalId.trim(),
      position: p.position.trim(),
      unit: p.unit.trim(),
      email: p.email.trim().toLowerCase(),
      phone: p.phone.trim(),
    },
    employment: {
      education: v.employment.education.trim(),
      fieldOfStudy: v.employment.fieldOfStudy.trim(),
      experienceYears: Number(v.employment.experienceYears),
      employmentStatus: v.employment.employmentStatus,
      startDate: v.employment.startDate,
    },
    declarationAccepted: true,
  };
}

export interface FileLike {
  name: string;
  size: number;
}

/** Error for a chosen file (extension and size; the server also checks the PDF signature), or null. */
export function validatePdfFile(file: FileLike): string | null {
  if (!/\.pdf$/i.test(file.name)) return 'Only PDF files are accepted';
  if (file.size === 0) return 'The file is empty';
  if (file.size > MAX_UPLOAD_BYTES) return 'File exceeds the 10 MB limit';
  return null;
}

/** One entry per slot: null when the slot holds a valid file. */
export function validateFileSlots(files: readonly (FileLike | null)[]): (string | null)[] {
  return REQUIRED_CONTROL_DOCUMENTS.map((_, i) => {
    const f = files[i];
    return f ? validatePdfFile(f) : 'A PDF file is required';
  });
}

/** Reads the first bytes to confirm the file really is a PDF (a renamed image is not). */
export async function hasPdfSignature(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return '%PDF-'.split('').every((c, i) => head[i] === c.charCodeAt(0));
}
