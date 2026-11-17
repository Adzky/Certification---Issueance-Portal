import type { DocumentType } from './types';

export interface TemplateField {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'date';
  required: boolean;
}

export const TEMPLATE_FIELDS: Record<DocumentType, TemplateField[]> = {
  CERTIFICATE: [
    { key: 'clientName', label: 'Client name', kind: 'text', required: true },
    { key: 'clientAddress', label: 'Client address', kind: 'textarea', required: true },
    { key: 'standard', label: 'Standard', kind: 'text', required: true },
    { key: 'scopeStatement', label: 'Scope of certification', kind: 'textarea', required: true },
    { key: 'sites', label: 'Certified sites', kind: 'textarea', required: true },
    { key: 'auditDate', label: 'Audit date', kind: 'date', required: true },
  ],
  INSPECTION_REPORT: [
    { key: 'clientName', label: 'Client name', kind: 'text', required: true },
    { key: 'objectDescription', label: 'Inspected object', kind: 'textarea', required: true },
    { key: 'inspectionLocation', label: 'Inspection location', kind: 'text', required: true },
    { key: 'inspectionDate', label: 'Inspection date', kind: 'date', required: true },
    { key: 'method', label: 'Inspection method', kind: 'textarea', required: true },
    { key: 'findings', label: 'Findings', kind: 'textarea', required: true },
    { key: 'conclusion', label: 'Conclusion', kind: 'textarea', required: true },
  ],
};

/** Labels of required fields that are blank in `fields`. */
export function missingRequiredFields(type: DocumentType, fields: Record<string, string>): string[] {
  return TEMPLATE_FIELDS[type]
    .filter((f) => f.required && !(fields[f.key] ?? '').trim())
    .map((f) => f.label);
}
