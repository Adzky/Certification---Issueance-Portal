/** Descriptive content for the onboarding "Role Review & Requirements" step (informational, written for the demo). */
import type { Role } from './types';

export type ContentRole = Role | 'CERTIFICATION_DECISION_MAKER';

export interface RoleContent {
  title: string;
  coreResponsibility: string;
  /** The "Key Requirements" table: label on the left, explanation on the right. */
  keyRequirements: { label: string; text: string }[];
  competencyExamples: string[];
  authorisationScope: string[];
  impartiality: string[];
  evidence: string[];
}

const req = (label: string, text: string) => ({ label, text });

export const ROLE_CONTENT: Record<ContentRole, RoleContent> = {
  ISSUANCE_OFFICER: {
    title: 'Issuance Officer',
    coreResponsibility:
      'Prepares certificates and inspection reports from approved data, keeps drafts and their numbering in order, and submits them for verification.',
    keyRequirements: [
      req('Competency Requirements', 'Working knowledge of the issuance workflow, document structure and record control.'),
      req('Authorisation Requirements', 'Formal authority to create and edit drafts and to submit them for verification.'),
      req('Impartiality Requirements', 'Works objectively; no change to results to suit a client, and no conflict of interest.'),
      req('Competency Evidence', 'Training records, a competency assessment and a practical issuance exercise.'),
      req('Recommended Initial Education', 'Diploma (D3) or Bachelor in administration, quality management or a related field.'),
      req('Recommended Experience', 'At least one year in document administration, quality assurance or conformity work.'),
      req('Mandatory Evaluation', 'A practical test: prepare a draft, number it and take it to submission.'),
    ],
    competencyExamples: [
      'Understands the issuance workflow and its controls.',
      'Reads approved data and keeps document metadata consistent.',
      'Applies document numbering and record-control rules.',
      'Operates the Certification & Issuance Portal confidently.',
    ],
    authorisationScope: [
      'Create requests and prepare draft documents.',
      'Edit drafts and keep their versions in order.',
      'Submit drafts for verification.',
      'Not authorised to verify, sign or approve technical decisions.',
    ],
    impartiality: [
      'Do not alter results or conclusions to meet client wishes.',
      'Do not accept personal benefits related to issuance.',
      'Report any pressure or conflict of interest at once.',
      'Follow the defined verification and approval stages.',
    ],
    evidence: [
      'Training records (document control, system use).',
      'Competency assessment results.',
      'Practical issuance exercise (draft to submission).',
      'Performance evaluation records.',
    ],
  },
  DOCUMENT_VERIFIER: {
    title: 'Document Verifier',
    coreResponsibility:
      'Checks every submitted document for completeness, consistency and conformity, then approves it for signing or returns it with clear comments.',
    keyRequirements: [
      req('Competency Requirements', 'Sound grasp of the certification scheme and of conformity assessment criteria.'),
      req('Authorisation Requirements', 'Formal authority to verify submitted documents and to return them for revision.'),
      req('Impartiality Requirements', 'Verifies independently of the preparer; declares any link to the client.'),
      req('Competency Evidence', 'Assessment of a sample verification, plus records of scheme training.'),
      req('Recommended Initial Education', 'Bachelor in engineering, science, quality management or a relevant discipline.'),
      req('Recommended Experience', 'At least two years of audit, inspection or document review experience.'),
      req('Mandatory Evaluation', 'A witnessed verification of sample documents against the checklist.'),
    ],
    competencyExamples: [
      'Applies the verification checklist consistently.',
      'Spots inconsistencies between data, scope and references.',
      'Writes clear, actionable return comments.',
      'Knows the relevant standard and scheme rules.',
    ],
    authorisationScope: [
      'Open documents in the verification queue within authorised scopes.',
      'Approve documents for signing.',
      'Return documents for revision with a reason.',
      'Not authorised to edit drafts or sign documents.',
    ],
    impartiality: [
      'Do not verify documents you prepared.',
      'Declare any past or present link to the client.',
      'Base every decision on the evidence in the record.',
      'Keep client information confidential.',
    ],
    evidence: [
      'Scheme and standard training certificates.',
      'Witnessed verification assessment.',
      'Records of sample reviews and findings.',
      'Periodic performance evaluation.',
    ],
  },
  AUTHORISED_SIGNATORY: {
    title: 'Authorised Signatory',
    coreResponsibility:
      'Signs and authorises official certificates and reports within the scopes they are formally authorised for, or rejects them with a reason.',
    keyRequirements: [
      req('Competency Requirements', 'Senior-level understanding of the scheme, its risks and the meaning of a signature.'),
      req('Authorisation Requirements', 'A formal letter naming the scopes the person may sign, with an effective period.'),
      req('Impartiality Requirements', 'Signs only on the basis of the verified record and free of conflict of interest.'),
      req('Competency Evidence', 'Records of technical competence, leadership experience and scheme knowledge.'),
      req('Recommended Initial Education', 'Bachelor or higher in a technical or management discipline.'),
      req('Recommended Experience', 'At least five years in certification, inspection or related technical leadership.'),
      req('Mandatory Evaluation', 'Assessment by the management of readiness to take signing responsibility.'),
    ],
    competencyExamples: [
      'Interprets verification results and their implications.',
      'Understands the legal weight of an issued certificate.',
      'Recognises when a record is not fit to sign.',
      'Applies the signing and rejection rules of the portal.',
    ],
    authorisationScope: [
      'Sign verified documents within authorised scopes.',
      'Reject documents that are not fit for issuance, with a reason.',
      'Issue the certificate number and validity on signing.',
      'Not authorised to prepare or verify the same document.',
    ],
    impartiality: [
      'Do not sign for clients you have a stake in.',
      'Decline pressure to sign outside your authorised scope.',
      'Keep the signing record complete and truthful.',
      'Report any suspected misuse of signatures.',
    ],
    evidence: [
      'Formal authorisation letter with scope limits.',
      'Technical competence and leadership records.',
      'Management readiness assessment.',
      'Periodic review of the authorisation.',
    ],
  },
  ISSUANCE_MANAGER: {
    title: 'Issuance Manager',
    coreResponsibility:
      'Oversees the issuance process, its SLA and the certificate lifecycle, and decides on authorisation requests from new personnel.',
    keyRequirements: [
      req('Competency Requirements', 'Process management, SLA monitoring and a solid view of the certification lifecycle.'),
      req('Authorisation Requirements', 'Formal authority to approve personnel authorisations and to act on certificate status.'),
      req('Impartiality Requirements', 'Decides on evidence and policy, free of commercial or personal pressure.'),
      req('Competency Evidence', 'Management records, process-improvement results and scheme knowledge.'),
      req('Recommended Initial Education', 'Bachelor in management, engineering or a relevant field.'),
      req('Recommended Experience', 'At least five years in certification operations or quality management.'),
      req('Mandatory Evaluation', 'Management review of readiness to take process and lifecycle responsibility.'),
    ],
    competencyExamples: [
      'Monitors workload, SLA and bottlenecks across the workflow.',
      'Judges whether a registrant meets the role requirements.',
      'Applies suspension, reinstatement and revocation rules.',
      'Reports performance to top management.',
    ],
    authorisationScope: [
      'View all requests, documents and certificates.',
      'Approve or reject personnel authorisation requests.',
      'Suspend, reinstate or revoke certificates.',
      'Not authorised to sign documents unless separately authorised.',
    ],
    impartiality: [
      'Decide on authorisation requests on the evidence only.',
      'Declare any relationship with an applicant.',
      'Record the reason for every adverse decision.',
      'Protect confidential client and personnel information.',
    ],
    evidence: [
      'Management and quality records.',
      'Process-improvement and SLA results.',
      'Management readiness review.',
      'Periodic authorisation review.',
    ],
  },
  SYSTEM_ADMIN: {
    title: 'System Administrator',
    coreResponsibility:
      'Manages users, roles, permissions and the configuration of the portal so that every person has exactly the access they are authorised for.',
    keyRequirements: [
      req('Competency Requirements', 'Experience in access management, system configuration and audit logging.'),
      req('Authorisation Requirements', 'Formal authority to change user access and system settings.'),
      req('Impartiality Requirements', 'Applies access rules uniformly; does not grant access for personal reasons.'),
      req('Competency Evidence', 'Records of systems-administration training and security awareness.'),
      req('Recommended Initial Education', 'Diploma or Bachelor in information systems or a related field.'),
      req('Recommended Experience', 'At least two years administering business applications.'),
      req('Mandatory Evaluation', 'A practical test of user, role and permission changes.'),
    ],
    competencyExamples: [
      'Maintains users, roles and scopes accurately.',
      'Reads audit logs to trace a change.',
      'Applies least-privilege access.',
      'Follows change and backup procedures.',
    ],
    authorisationScope: [
      'Manage user accounts and role assignments.',
      'Change assignment status and service scopes.',
      'View the permission matrix and the audit trail.',
      'Not authorised to prepare, verify or sign certificates.',
    ],
    impartiality: [
      'Grant access only against an approved authorisation.',
      'Do not use administrator access to alter records.',
      'Keep access information confidential.',
      'Report any unauthorised access attempt.',
    ],
    evidence: [
      'Systems-administration training records.',
      'Security awareness certificate.',
      'Practical access-management test.',
      'Periodic access review.',
    ],
  },
  CERTIFICATION_DECISION_MAKER: {
    title: 'Certification Decision Maker',
    coreResponsibility:
      'A separate technical decision authority that decides whether certification is granted, maintained, suspended or withdrawn, based on review results.',
    keyRequirements: [
      req('Note', 'Informational only: this role is not part of the registration in this demo.'),
    ],
    competencyExamples: [],
    authorisationScope: [],
    impartiality: [],
    evidence: [],
  },
};

/** The roles an applicant can register for, in card order. */
export const REGISTRABLE_ROLES: readonly Role[] = [
  'ISSUANCE_OFFICER',
  'DOCUMENT_VERIFIER',
  'AUTHORISED_SIGNATORY',
  'ISSUANCE_MANAGER',
  'SYSTEM_ADMIN',
];

export const isRegistrableRole = (v: string | null | undefined): v is Role =>
  !!v && (REGISTRABLE_ROLES as readonly string[]).includes(v);

/** What the five personnel-authorisation-record fields hold (step 2 strip). */
export const PERSONNEL_RECORD_FIELDS: readonly { label: string; detail: string }[] = [
  { label: 'Identity', detail: '(Name, ID, Unit)' },
  { label: 'Role', detail: '(e.g. Issuance Officer)' },
  { label: 'Service Scope', detail: '(e.g. Inspection, Certification)' },
  { label: 'Authority', detail: '(Permissions & Limits)' },
  { label: 'Effective Date', detail: '(Date of Appointment)' },
  { label: 'Status', detail: '(Active / Restricted / Suspended / Revoked / Expired)' },
  { label: 'Authorising Official', detail: '(Name & Position of the Appointing Authority)' },
];

/** The authorisation status definitions shown in the sidebar legend and on step 2. */
export const AUTHORISATION_STATUS_DEFINITIONS: readonly { status: string; short: string; detail: string }[] = [
  { status: 'ACTIVE', short: 'Active', detail: 'Competence verified and authorisation valid, with no restriction on assignment.' },
  { status: 'RESTRICTED', short: 'Restricted', detail: 'Authority is limited, for example by scope or competency.' },
  { status: 'SUSPENDED', short: 'Suspended', detail: 'Authority is temporarily disabled.' },
  { status: 'REVOKED', short: 'Revoked', detail: 'Authorisation has been withdrawn; no access.' },
  { status: 'EXPIRED', short: 'Expired', detail: 'The authorisation period has ended; re-authorisation is required.' },
];
