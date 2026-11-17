'use client';

import { TEMPLATE_FIELDS } from '@/domain/templates';
import type { DocumentType } from '@/domain/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface DraftEditorFormProps {
  type: DocumentType;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  disabled?: boolean;
  /** Keys of required fields to flag as missing (after a failed submit). */
  invalidKeys?: readonly string[];
}

/** Template-driven form: one labelled input per `TEMPLATE_FIELDS[type]` entry. */
export function DraftEditorForm({ type, values, onChange, disabled, invalidKeys = [] }: DraftEditorFormProps) {
  return (
    <form className="grid gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
      {TEMPLATE_FIELDS[type].map((f) => {
        const id = `field-${f.key}`;
        const invalid = invalidKeys.includes(f.key);
        const common = {
          id,
          value: values[f.key] ?? '',
          disabled,
          'aria-invalid': invalid || undefined,
          onChange: (e: { target: { value: string } }) => onChange({ ...values, [f.key]: e.target.value }),
        };
        return (
          <div key={f.key} className="grid gap-1.5">
            <Label htmlFor={id}>
              {f.label}
              {f.required && <span className="text-destructive" aria-hidden> *</span>}
            </Label>
            {f.kind === 'textarea' ? (
              <Textarea rows={3} {...common} />
            ) : (
              <Input type={f.kind === 'date' ? 'date' : 'text'} {...common} />
            )}
            {invalid && <p className="text-xs text-destructive">{f.label} is required.</p>}
          </div>
        );
      })}
    </form>
  );
}
