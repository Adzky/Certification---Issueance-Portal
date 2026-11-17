import type { AuthorisationStatus, RegistrationStatus, Role } from '@/domain/types';
import type { TimelineEntry } from './dto';

export interface RegistrationSummary {
  id: string;
  userId: string;
  applicantName: string;
  email: string;
  role: Role;
  requestedScopes: string[];
  status: RegistrationStatus;
  createdAt: string;
  decidedAt: string | null;
}

export interface RegistrationDetail extends RegistrationSummary {
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
    experienceYears: number;
    employmentStatus: 'PERMANENT' | 'CONTRACT';
    startDate: string;
  };
  declarationAccepted: boolean;
  documents: { slot: number; name: string; fileName: string; sizeBytes: number }[];
  decisionComment: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  assignmentStatus: AuthorisationStatus | null;
  authorisedFrom: string | null;
  authorisedUntil: string | null;
}

export interface RegistrationStatusInfo {
  status: RegistrationStatus;
  assignmentStatus: AuthorisationStatus;
  role: Role;
  scopes: string[];
  authorisedFrom?: string;
  authorisedUntil?: string;
  authorisedBy?: string;
}

export interface UserAssignment {
  assignmentId: string;
  role: Role;
  status: AuthorisationStatus;
  scopeCodes: string[];
  authorisedFrom: string | null;
  authorisedUntil: string | null;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  position: string | null;
  unit: string | null;
  assignments: UserAssignment[];
}

export interface LoginOption {
  role: Role;
  users: { userId: string; name: string; avatarUrl?: string; status: AuthorisationStatus }[];
}

export type AuditEntry = TimelineEntry;

export interface DashboardData {
  role: Role;
  stats: { key: string; label: string; value: number; tone: 'blue' | 'amber' | 'green' | 'red' | 'purple' }[];
  queue: {
    id: string;
    number: string;
    client: string;
    scope: string;
    status: string;
    dueInDays?: number;
    link: string;
  }[];
  trend?: { label: string; issued: number; requested: number }[];
  statusBreakdown?: { status: string; count: number }[];
  sla?: { achievedPct: number; targetPct: 90 };
  recentActivity?: { at: string; text: string; ok: boolean }[];
}
