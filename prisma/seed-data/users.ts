import type { AuthorisationStatus, Role } from '../../src/domain/types';

export const ALL_SCOPES = ['QMS', 'ISMS', 'CE', 'INS', 'CDKAB'] as const;

export const SERVICE_SCOPES = [
  { code: 'QMS', name: 'Certification – ISO 9001', category: 'Management System', schemeLabel: 'ISO 9001:2015', documentType: 'CERTIFICATE', termMonths: 36 },
  { code: 'ISMS', name: 'Certification – ISO 27001', category: 'Management System', schemeLabel: 'ISO/IEC 27001:2022', documentType: 'CERTIFICATE', termMonths: 36 },
  { code: 'CE', name: 'Product Certification (CE/RoHS)', category: 'Product Certification', schemeLabel: 'CE / RoHS', documentType: 'CERTIFICATE', termMonths: 36 },
  { code: 'INS', name: 'Inspection (17020)', category: 'Inspection', schemeLabel: 'ISO/IEC 17020', documentType: 'INSPECTION_REPORT', termMonths: 12 },
  { code: 'CDKAB', name: 'Certification – CDKAB', category: 'Management System', schemeLabel: 'CDKAB', documentType: 'CERTIFICATE', termMonths: 36 },
] as const;

export interface SeedUser {
  key: string;
  name: string;
  role: Role;
  scopes: readonly string[];
  status: AuthorisationStatus;
  demo?: boolean;
}

const A = ALL_SCOPES;
const u = (key: string, name: string, role: Role, scopes: readonly string[], status: AuthorisationStatus = 'ACTIVE', demo = false): SeedUser => ({
  key,
  name,
  role,
  scopes,
  status,
  demo,
});

/**
 * 41 users created directly. The 42nd (Dwi Ananda, a pending Document Verifier)
 * arrives through `submitRegistration`, see PENDING_APPLICANT.
 */
export const USERS: readonly SeedUser[] = [
  // Issuance Officers (16)
  u('andi', 'Andi Pratama', 'ISSUANCE_OFFICER', ['QMS', 'ISMS', 'CE', 'INS'], 'ACTIVE', true),
  u('siti', 'Siti Rahayu', 'ISSUANCE_OFFICER', ['QMS', 'ISMS', 'CDKAB']),
  u('agus', 'Agus Setiawan', 'ISSUANCE_OFFICER', ['INS', 'CE', 'QMS']),
  u('maya', 'Maya Kusuma', 'ISSUANCE_OFFICER', ['ISMS', 'CE', 'INS', 'CDKAB']),
  u('rizky', 'Rizky Maulana', 'ISSUANCE_OFFICER', A),
  u('putri', 'Putri Anggraini', 'ISSUANCE_OFFICER', ['QMS', 'CDKAB']),
  u('hendra', 'Hendra Gunawan', 'ISSUANCE_OFFICER', ['QMS', 'INS'], 'SUSPENDED'),
  u('ratna', 'Ratna Sari', 'ISSUANCE_OFFICER', ['CE', 'QMS', 'ISMS']),
  u('yoga', 'Yoga Permana', 'ISSUANCE_OFFICER', ['INS'], 'RESTRICTED'),
  u('nur', 'Nur Aini', 'ISSUANCE_OFFICER', ['QMS', 'ISMS', 'INS']),
  u('dimas', 'Dimas Prakoso', 'ISSUANCE_OFFICER', ['CE', 'CDKAB', 'INS']),
  u('lestari', 'Lestari Wijaya', 'ISSUANCE_OFFICER', ['QMS', 'CE']),
  u('eko', 'Eko Prasetyo', 'ISSUANCE_OFFICER', ['ISMS', 'INS', 'CDKAB']),
  u('intan', 'Intan Permata', 'ISSUANCE_OFFICER', ['QMS', 'ISMS', 'CE', 'INS']),
  u('bayu', 'Bayu Nugroho', 'ISSUANCE_OFFICER', ['INS', 'QMS']),
  u('citra', 'Citra Dewanti', 'ISSUANCE_OFFICER', ['CDKAB', 'CE', 'ISMS']),
  // Document Verifiers (9 here + Dwi Ananda pending)
  u('dewi', 'Dewi Lestari', 'DOCUMENT_VERIFIER', A, 'ACTIVE', true),
  u('wahyu', 'Wahyu Kurniawan', 'DOCUMENT_VERIFIER', ['QMS', 'ISMS', 'CDKAB']),
  u('anita', 'Anita Susanti', 'DOCUMENT_VERIFIER', ['CE', 'INS']),
  u('tono', 'Tono Wibowo', 'DOCUMENT_VERIFIER', ['QMS', 'INS'], 'SUSPENDED'),
  u('sari', 'Sari Handayani', 'DOCUMENT_VERIFIER', A),
  u('rudi', 'Rudi Hartono', 'DOCUMENT_VERIFIER', ['ISMS', 'CE', 'CDKAB']),
  u('fitri', 'Fitri Ramadhani', 'DOCUMENT_VERIFIER', ['QMS'], 'RESTRICTED'),
  u('yuni', 'Yuni Astuti', 'DOCUMENT_VERIFIER', ['QMS', 'INS', 'CE']),
  u('galih', 'Galih Saputra', 'DOCUMENT_VERIFIER', ['ISMS', 'INS', 'CDKAB']),
  // Authorised Signatories (7)
  u('budi', 'Budi Santoso', 'AUTHORISED_SIGNATORY', A, 'ACTIVE', true),
  u('slamet', 'Slamet Riyadi', 'AUTHORISED_SIGNATORY', ['QMS', 'ISMS', 'CDKAB']),
  u('ayu', 'Ayu Kartika', 'AUTHORISED_SIGNATORY', ['CE', 'INS', 'QMS']),
  u('taufik', 'Taufik Rahman', 'AUTHORISED_SIGNATORY', A),
  u('maria', 'Maria Magdalena', 'AUTHORISED_SIGNATORY', ['ISMS', 'INS', 'CE']),
  u('irfan', 'Irfan Hakim', 'AUTHORISED_SIGNATORY', ['QMS', 'CDKAB'], 'SUSPENDED'),
  u('retno', 'Retno Palupi', 'AUTHORISED_SIGNATORY', ['QMS', 'ISMS', 'CE', 'INS', 'CDKAB']),
  // Issuance Managers (5)
  u('rina', 'Rina Wulandari', 'ISSUANCE_MANAGER', A, 'ACTIVE', true),
  u('bambang', 'Bambang Sutrisno', 'ISSUANCE_MANAGER', A),
  u('endang', 'Endang Susilowati', 'ISSUANCE_MANAGER', A),
  u('kurniawan', 'Kurniawan Adi', 'ISSUANCE_MANAGER', A),
  u('lina', 'Lina Marlina', 'ISSUANCE_MANAGER', A),
  // System Administrators (4)
  u('fajar', 'Fajar Hidayat', 'SYSTEM_ADMIN', A, 'ACTIVE', true),
  u('gita', 'Gita Savitri', 'SYSTEM_ADMIN', A),
  u('hadi', 'Hadi Purnomo', 'SYSTEM_ADMIN', A),
  u('mega', 'Mega Puspita', 'SYSTEM_ADMIN', A),
];

export const PENDING_APPLICANT = {
  name: 'Dwi Ananda',
  email: 'dwi.ananda@jmu.co.id',
  employeeId: 'JMU-00042',
  nationalId: '3174015508920003',
  role: 'DOCUMENT_VERIFIER' as Role,
  scopes: ['QMS', 'INS'],
  position: 'Senior Document Controller',
  unit: 'Quality Assurance',
  phone: '+62 812-5550-0142',
  education: 'S1',
  fieldOfStudy: 'Industrial Engineering',
  experienceYears: 6,
  employmentStatus: 'PERMANENT' as const,
};

export const emailFor = (name: string): string => `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@jmu.co.id`;

export const POSITION: Record<Role, { position: string; unit: string }> = {
  ISSUANCE_OFFICER: { position: 'Issuance Officer', unit: 'Certification Services' },
  DOCUMENT_VERIFIER: { position: 'Document Verifier', unit: 'Quality Assurance' },
  AUTHORISED_SIGNATORY: { position: 'Authorised Signatory', unit: 'Certification Board' },
  ISSUANCE_MANAGER: { position: 'Issuance Manager', unit: 'Certification Services' },
  SYSTEM_ADMIN: { position: 'System Administrator', unit: 'Information Technology' },
};
