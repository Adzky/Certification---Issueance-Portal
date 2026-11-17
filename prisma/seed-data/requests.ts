import type { DocumentType, Priority } from '../../src/domain/types';
import { TEMPLATE_FIELDS } from '../../src/domain/templates';
import type { Rng } from './prng';

export const OBJECT_SCOPES: Record<string, readonly string[]> = {
  QMS: [
    'Manufacture and distribution of steel pipes and fittings',
    'Production of plastic packaging and injection-moulded parts',
    'Design and manufacture of garments for export',
    'Coal mining operations and overburden removal',
    'Processing of crude palm oil and kernel',
    'Contract manufacturing of consumer electronics',
  ],
  ISMS: [
    'Information security for data-centre and cloud hosting services',
    'Information security for the corporate ERP and finance systems',
    'Information security for laboratory information management systems',
    'Information security for customer-facing digital platforms',
  ],
  CE: [
    'Low-voltage switchgear and distribution panels',
    'Industrial LED lighting luminaires',
    'Plastic toys and children articles (RoHS)',
    'Power inverters and battery chargers',
  ],
  INS: [
    'Pressure vessels and boilers at the Balikpapan plant',
    'Lifting equipment and overhead cranes',
    'Storage tanks and piping systems',
    'Electrical installations at the production hall',
    'Conveyor and material-handling systems',
  ],
  CDKAB: [
    'Quality management system for agricultural processing',
    'Quality management system for contract laboratory services',
    'Quality management system for fabrication workshops',
  ],
};

const SITES = ['Head office', 'Plant 1', 'Plant 2', 'Warehouse and distribution centre', 'Laboratory'];
const METHODS = [
  'Visual examination and dimensional measurement',
  'Non-destructive testing (ultrasonic thickness) and functional test',
  'Load test at 125% of rated capacity and visual inspection',
  'Documentation review, on-site inspection and sampling',
];
const FINDINGS = [
  'No nonconformities found. Minor observations recorded for follow-up.',
  'All inspected items conform; two minor observations closed during the inspection.',
  'Equipment in good condition; one recommendation regarding the maintenance schedule.',
];
const CONCLUSIONS = [
  'Conforms to the applicable requirements.',
  'Conforms to the applicable requirements and is fit for continued operation.',
];

export const RETURN_COMMENTS = [
  'Scope statement does not match the request. Please align the wording.',
  'Audit date is missing a supporting reference. Please correct and resubmit.',
  'Client address differs from the registered address; please verify.',
  'Findings section needs more detail before this can be verified.',
  'Numbering metadata is incorrect; please review the document header.',
];

export const REJECT_REASONS = [
  'Certified sites list is incomplete; please correct before signing.',
  'Scope of certification must be re-confirmed with the client.',
  'Signing deferred: audit date does not match the audit report.',
];

export const SUSPEND_REASONS = [
  'Surveillance audit overdue',
  'Corrective actions not closed within the agreed period',
  'Suspended at the request of the client',
];

export const REVOKE_REASONS = [
  'Major nonconformity not resolved within the deadline',
  'Client ceased the certified activity',
  'Misuse of the certification mark',
];

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Field values for a document, keyed by TEMPLATE_FIELDS. `workDate` is the date
 * of the audit / inspection (epoch ms).
 */
export function documentFields(
  type: DocumentType,
  c: { clientName: string; clientAddress: string; standard: string; objectScope: string },
  workDate: number,
  rng: Rng,
): Record<string, string> {
  if (type === 'CERTIFICATE') {
    return {
      clientName: c.clientName,
      clientAddress: c.clientAddress,
      standard: c.standard,
      scopeStatement: c.objectScope,
      sites: `${rng.pick(SITES)}, ${c.clientAddress.split(',')[0]}`,
      auditDate: isoDay(workDate),
    };
  }
  return {
    clientName: c.clientName,
    objectDescription: c.objectScope,
    inspectionLocation: c.clientAddress,
    inspectionDate: isoDay(workDate),
    method: rng.pick(METHODS),
    findings: rng.pick(FINDINGS),
    conclusion: rng.pick(CONCLUSIONS),
  };
}

/** A random subset of the required fields (for half-finished drafts). */
export function partialFields(type: DocumentType, full: Record<string, string>, rng: Rng): Record<string, string> {
  const keys = TEMPLATE_FIELDS[type].map((f) => f.key).filter((k) => full[k] && rng.chance(0.55));
  return Object.fromEntries(keys.map((k) => [k, full[k]!]));
}

export type Outcome =
  | 'SUBMITTED'
  | 'DRAFT'
  | 'DRAFT_REJECTED'
  | 'IN_VERIFICATION'
  | 'REVISION'
  | 'READY'
  | 'ISSUED'
  | 'ISSUED_RETURNED'
  | 'ISSUED_REJECTED';

/** ~120 requests over the last 60 days: 60% issued, 15% in process, 10% awaiting verification, 5% revision, 10% submitted. */
export const OUTCOME_COUNTS: Record<Outcome, number> = {
  SUBMITTED: 12,
  DRAFT: 7,
  DRAFT_REJECTED: 2,
  IN_VERIFICATION: 12,
  REVISION: 6,
  READY: 9,
  ISSUED: 56,
  ISSUED_RETURNED: 12,
  ISSUED_REJECTED: 4,
};

/** Age range (days before `now`) a request in this state was created. */
export const AGE_DAYS: Record<Exclude<Outcome, 'ISSUED' | 'ISSUED_RETURNED' | 'ISSUED_REJECTED'>, [number, number]> = {
  SUBMITTED: [0.3, 5],
  DRAFT: [1, 9],
  DRAFT_REJECTED: [5, 12],
  IN_VERIFICATION: [1.5, 11],
  REVISION: [3, 15],
  READY: [2.5, 13],
};

export interface FlowSpec {
  outcome: Outcome;
  scopeCode: string;
  priority: Priority;
  /** Key of a SeedUser when the request must belong to a specific officer. */
  officerKey?: string;
  /** Fixed age in days (overrides the random range). */
  ageDays?: number;
}

/** Requests that guarantee every demo role has work on first login. */
export const ANDI_FORCED: FlowSpec[] = [
  { outcome: 'SUBMITTED', scopeCode: 'QMS', priority: 'HIGH', officerKey: 'andi', ageDays: 0.6 },
  { outcome: 'SUBMITTED', scopeCode: 'INS', priority: 'NORMAL', officerKey: 'andi', ageDays: 1.5 },
  { outcome: 'SUBMITTED', scopeCode: 'ISMS', priority: 'LOW', officerKey: 'andi', ageDays: 3 },
  { outcome: 'REVISION', scopeCode: 'CE', priority: 'NORMAL', officerKey: 'andi', ageDays: 6 },
  { outcome: 'REVISION', scopeCode: 'QMS', priority: 'HIGH', officerKey: 'andi', ageDays: 8 },
  { outcome: 'DRAFT', scopeCode: 'ISMS', priority: 'NORMAL', officerKey: 'andi', ageDays: 2.5 },
];

export function buildFlowSpecs(rng: Rng): FlowSpec[] {
  const counts = { ...OUTCOME_COUNTS };
  for (const f of ANDI_FORCED) counts[f.outcome]--;
  const specs: FlowSpec[] = [...ANDI_FORCED];
  for (const outcome of Object.keys(counts) as Outcome[]) {
    if (outcome === 'ISSUED') continue; // written as bulk rows, see buildHistory
    for (let i = 0; i < counts[outcome]; i++) {
      specs.push({
        outcome,
        scopeCode: rng.weighted({ QMS: 30, ISMS: 18, INS: 22, CE: 15, CDKAB: 15 }),
        priority: rng.weighted({ NORMAL: 65, HIGH: 15, LOW: 20 }),
      });
    }
  }
  return specs;
}
