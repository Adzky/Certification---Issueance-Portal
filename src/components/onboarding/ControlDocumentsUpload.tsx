'use client';

import { CheckCircle2, Circle, FileText, FolderOpen, Upload, X, XCircle } from 'lucide-react';
import { REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import { cn } from '@/lib/utils';

export interface UploadSlot {
  file: File | null;
  /** Why the chosen file (or the empty slot, after a submit attempt) is not acceptable. */
  error: string | null;
}

export const EMPTY_SLOTS = (): UploadSlot[] => REQUIRED_CONTROL_DOCUMENTS.map(() => ({ file: null, error: null }));

/** Slots holding an accepted file. */
export const uploadedCount = (slots: readonly UploadSlot[]): number => slots.filter((s) => s.file && !s.error).length;

function viewFile(file: File): void {
  const url = URL.createObjectURL(file);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The seven "Required Control Documents" rows: pick a PDF per row, see its state, view or remove it. */
export function ControlDocumentsUpload({
  slots,
  onPick,
  onClear,
}: {
  slots: readonly UploadSlot[];
  onPick: (index: number, file: File) => void;
  onClear: (index: number) => void;
}) {
  const count = uploadedCount(slots);
  const complete = count === REQUIRED_CONTROL_DOCUMENTS.length;
  return (
    <section aria-label="Required control documents" className="rounded-xl border bg-card p-4 shadow-[0_1px_3px_rgb(15_23_42/0.05)]">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <FolderOpen className="size-6 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Required Control Documents ({REQUIRED_CONTROL_DOCUMENTS.length} Records)</h2>
          <p className="text-xs text-muted-foreground">PDF only, up to 10 MB each.</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
            complete ? 'bg-tone-green-soft text-tone-green' : 'bg-tone-amber-soft text-tone-amber',
          )}
        >
          {count} / {REQUIRED_CONTROL_DOCUMENTS.length} Uploaded
          {complete && <CheckCircle2 className="size-4" aria-hidden />}
        </span>
      </header>
      <ul className="divide-y">
        {REQUIRED_CONTROL_DOCUMENTS.map((name, i) => {
          const slot = slots[i]!;
          const ok = !!slot.file && !slot.error;
          return (
            <li key={name} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              {ok ? (
                <CheckCircle2 className="size-5 shrink-0 text-tone-green" aria-label="Uploaded" />
              ) : slot.error ? (
                <XCircle className="size-5 shrink-0 text-tone-red" aria-label="Problem" />
              ) : (
                <Circle className="size-5 shrink-0 text-slate-300" aria-label="Not uploaded" />
              )}
              <FileText className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-medium">
                  {i + 1}. {name}
                </p>
                {slot.file && <p className="truncate text-xs text-muted-foreground">{slot.file.name}</p>}
                {slot.error && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {slot.error}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {ok && (
                  <button
                    type="button"
                    onClick={() => viewFile(slot.file!)}
                    aria-label={`View ${i + 1}. ${name}`}
                    className="rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary hover:bg-tone-blue-soft focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    View
                  </button>
                )}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold hover:bg-muted focus-within:outline-2 focus-within:outline-ring">
                  <Upload className="size-3.5" aria-hidden />
                  {slot.file ? 'Replace' : 'Choose file'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    aria-label={`Upload ${i + 1}. ${name}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onPick(i, file);
                      e.target.value = '';
                    }}
                  />
                </label>
                {slot.file && (
                  <button
                    type="button"
                    onClick={() => onClear(i)}
                    aria-label={`Remove ${i + 1}. ${name}`}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
