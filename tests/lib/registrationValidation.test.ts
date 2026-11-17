import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUES,
  toPayload,
  validateFileSlots,
  validatePdfFile,
  validateRegistrationValues,
  type RegistrationFormValues,
} from '@/lib/registrationValidation';

const valid: RegistrationFormValues = {
  personal: {
    fullName: ' Rina Wijaya ',
    employeeId: 'E-1',
    nationalId: '3174',
    position: 'Auditor',
    unit: 'Cert',
    email: 'Rina@JMU.example',
    phone: '+62 812',
  },
  employment: {
    education: 'Bachelor (S1)',
    fieldOfStudy: 'Engineering',
    experienceYears: '6',
    employmentStatus: 'PERMANENT',
    startDate: '2020-01-15',
  },
  scopes: ['QMS'],
  declarationAccepted: true,
};

describe('registration form validation (mirrors the server rules)', () => {
  it('accepts a complete form', () => {
    expect(validateRegistrationValues(valid)).toEqual({});
  });

  it('lists every missing required field with the server wording', () => {
    const errors = validateRegistrationValues(EMPTY_VALUES);
    expect(errors).toMatchObject({
      fullName: 'Full name is required',
      employeeId: 'Employee ID is required',
      nationalId: 'National ID is required',
      position: 'Position is required',
      unit: 'Unit is required',
      email: 'Email is required',
      phone: 'Phone is required',
      fieldOfStudy: 'Field of study is required',
      experienceYears: 'Experience (years) is required',
      startDate: 'Start date is required',
      scopes: 'Select at least one service scope',
      declarationAccepted: 'The declaration must be accepted',
    });
  });

  it('checks email shape, experience range and whitespace-only text', () => {
    expect(validateRegistrationValues({ ...valid, personal: { ...valid.personal, email: 'nope' } }).email).toBe('Email is invalid');
    expect(validateRegistrationValues({ ...valid, personal: { ...valid.personal, fullName: '   ' } }).fullName).toBe('Full name is required');
    const exp = (v: string) => validateRegistrationValues({ ...valid, employment: { ...valid.employment, experienceYears: v } }).experienceYears;
    expect(exp('-1')).toBe('Experience must not be negative');
    expect(exp('81')).toBe('Experience must be at most 80 years');
    expect(exp('abc')).toBe('Experience (years) is required');
    expect(exp('0')).toBeUndefined();
  });

  it('builds the API payload with trimmed, lower-cased values and a numeric experience', () => {
    const p = toPayload('DOCUMENT_VERIFIER', valid);
    expect(p.personal.fullName).toBe('Rina Wijaya');
    expect(p.personal.email).toBe('rina@jmu.example');
    expect(p.employment.experienceYears).toBe(6);
    expect(p).toMatchObject({ role: 'DOCUMENT_VERIFIER', scopes: ['QMS'], declarationAccepted: true });
  });
});

describe('control document validation', () => {
  it('accepts only .pdf files up to 10 MB', () => {
    expect(validatePdfFile({ name: 'a.PDF', size: 100 })).toBeNull();
    expect(validatePdfFile({ name: 'a.png', size: 100 })).toBe('Only PDF files are accepted');
    expect(validatePdfFile({ name: 'a.pdf', size: 0 })).toBe('The file is empty');
    expect(validatePdfFile({ name: 'a.pdf', size: 10 * 1024 * 1024 + 1 })).toBe('File exceeds the 10 MB limit');
  });

  it('requires all seven slots and keeps per-slot errors', () => {
    const slots = [{ name: 'a.pdf', size: 5 }, null, { name: 'b.txt', size: 5 }, null, null, null, null];
    const required = 'A PDF file is required';
    expect(validateFileSlots(slots)).toEqual([null, required, 'Only PDF files are accepted', required, required, required, required]);
  });
});
