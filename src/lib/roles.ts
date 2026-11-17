/** Presentation metadata per role: icon, tone, picker copy and its stage in the issuance workflow. */
import { FileText, type LucideIcon, Settings, ShieldCheck, Signature, ChartColumnIncreasing } from 'lucide-react';
import { ROLE_LABEL, ROLES } from '@/domain/permissions';
import type { Role } from '@/domain/types';
import type { Tone } from './tones';

export interface RoleMeta {
  role: Role;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  /** One line on the login role card. */
  description: string;
  /** Stage name in the end-to-end workflow diagram. */
  stage: string;
  /** One line under the stage in the workflow diagram. */
  stageDescription: string;
  /** Subtitle of the role's dashboard. */
  dashboardSubtitle: string;
  /** The main demo user for the role: listed first and highlighted in the user picker. */
  demoUser: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  ISSUANCE_OFFICER: {
    role: 'ISSUANCE_OFFICER',
    label: ROLE_LABEL.ISSUANCE_OFFICER,
    icon: FileText,
    tone: 'blue',
    description: 'Prepares certificate and document drafts.',
    stage: 'Preparation',
    stageDescription: 'Prepares document drafts and submits them for verification.',
    dashboardSubtitle: 'Your drafting work for certificates and inspection reports.',
    demoUser: 'Andi Pratama',
  },
  DOCUMENT_VERIFIER: {
    role: 'DOCUMENT_VERIFIER',
    label: ROLE_LABEL.DOCUMENT_VERIFIER,
    icon: ShieldCheck,
    tone: 'green',
    description: 'Verifies document completeness and conformity.',
    stage: 'Verification',
    stageDescription: 'Checks completeness and conformity of each document.',
    dashboardSubtitle: 'Completeness, consistency and conformity checks on submitted documents.',
    demoUser: 'Dewi Lestari',
  },
  AUTHORISED_SIGNATORY: {
    role: 'AUTHORISED_SIGNATORY',
    label: ROLE_LABEL.AUTHORISED_SIGNATORY,
    icon: Signature,
    tone: 'purple',
    description: 'Signs official documents within their authorisation.',
    stage: 'Signing',
    stageDescription: 'Signs official documents within their authorised scope.',
    dashboardSubtitle: 'Sign official documents within your authorised scope.',
    demoUser: 'Budi Santoso',
  },
  ISSUANCE_MANAGER: {
    role: 'ISSUANCE_MANAGER',
    label: ROLE_LABEL.ISSUANCE_MANAGER,
    icon: ChartColumnIncreasing,
    tone: 'amber',
    description: 'Manages the issuance process, performance and lifecycle.',
    stage: 'Control & Monitoring',
    stageDescription: 'Oversees the process, SLA and certificate lifecycle.',
    dashboardSubtitle: 'Issuance performance, workload and process compliance.',
    demoUser: 'Rina Wulandari',
  },
  SYSTEM_ADMIN: {
    role: 'SYSTEM_ADMIN',
    label: ROLE_LABEL.SYSTEM_ADMIN,
    icon: Settings,
    tone: 'grey',
    description: 'Manages users, access rights and system configuration.',
    stage: 'System & Access',
    stageDescription: 'Manages users, roles, templates and system security.',
    dashboardSubtitle: 'Users, authorisations and system configuration.',
    demoUser: 'Fajar Hidayat',
  },
};

/** Roles in workflow order. */
export const ROLE_ORDER: readonly Role[] = ROLES;

/** Solid role-pill classes (header "Role: …" badge), literal for Tailwind. */
export const ROLE_PILL_CLASSES: Record<Tone, string> = {
  blue: 'bg-tone-blue text-white',
  green: 'bg-tone-green text-white',
  purple: 'bg-tone-purple text-white',
  amber: 'bg-tone-amber text-white',
  red: 'bg-tone-red text-white',
  grey: 'bg-tone-grey text-white',
};
