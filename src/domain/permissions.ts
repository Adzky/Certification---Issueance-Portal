import { DomainError } from './errors';
import type { Action, Actor, Role } from './types';

export const ROLES: readonly Role[] = [
  'ISSUANCE_OFFICER',
  'DOCUMENT_VERIFIER',
  'AUTHORISED_SIGNATORY',
  'ISSUANCE_MANAGER',
  'SYSTEM_ADMIN',
];

export const ROLE_LABEL: Record<Role, string> = {
  ISSUANCE_OFFICER: 'Issuance Officer',
  DOCUMENT_VERIFIER: 'Document Verifier',
  AUTHORISED_SIGNATORY: 'Authorised Signatory',
  ISSUANCE_MANAGER: 'Issuance Manager',
  SYSTEM_ADMIN: 'System Administrator',
};

export const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  ISSUANCE_OFFICER: ['request.create', 'document.prepare', 'document.edit', 'document.submit'],
  DOCUMENT_VERIFIER: ['document.verify', 'document.return'],
  AUTHORISED_SIGNATORY: ['document.sign', 'document.reject'],
  ISSUANCE_MANAGER: [
    'records.viewAll',
    'certificate.suspend',
    'certificate.reinstate',
    'certificate.revoke',
    'registration.decide',
  ],
  SYSTEM_ADMIN: ['user.manage', 'records.viewAll'],
};

export function can(actor: Actor, action: Action, scopeCode?: string): boolean {
  if (!ROLE_ACTIONS[actor.role].includes(action)) return false;
  if (actor.assignmentStatus !== 'ACTIVE' && actor.assignmentStatus !== 'RESTRICTED') return false;
  return scopeCode === undefined || actor.scopeCodes.includes(scopeCode);
}

export function assertCan(actor: Actor, action: Action, scopeCode?: string): void {
  if (!can(actor, action, scopeCode)) {
    throw new DomainError(
      'FORBIDDEN',
      `Not permitted to ${action}${scopeCode ? ` in scope ${scopeCode}` : ''}`,
    );
  }
}
