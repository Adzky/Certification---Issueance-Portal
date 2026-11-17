'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const MIN_REASON_LENGTH = 5;

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Field label (default "Reason"). */
  label?: string;
  confirmLabel: string;
  /** Destructive styling for the confirm button (reject). */
  destructive?: boolean;
  pending?: boolean;
  /** Called with the trimmed reason once it is long enough. */
  onConfirm: (reason: string) => void;
}

/** Shared "give a reason" dialog (return for revision, reject): required text, min 5 characters, inline error. */
export function ReasonDialog(props: ReasonDialogProps) {
  // Remount on open so the text and error always start fresh.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>{props.open && <ReasonForm {...props} />}</DialogContent>
    </Dialog>
  );
}

function ReasonForm({ onOpenChange, title, description, label = 'Reason', confirmLabel, destructive, pending, onConfirm }: ReasonDialogProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const reason = text.trim();
    if (reason.length < MIN_REASON_LENGTH) {
      setError(`${label} is required and must be at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }
    onConfirm(reason);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="reason-text">{label}</Label>
        <Textarea
          id="reason-text"
          rows={4}
          value={text}
          aria-invalid={!!error}
          aria-describedby={error ? 'reason-error' : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
        />
        {error && (
          <p id="reason-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button variant={destructive ? 'destructive' : 'default'} onClick={submit} disabled={pending}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
