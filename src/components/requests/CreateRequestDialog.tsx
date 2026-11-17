'use client';

import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useCreateRequest, useReference, useSession } from '@/api-client/hooks';
import type { RequestDetail } from '@/contract/types';
import { toastError } from '@/components/common/notify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Priority } from '@/domain/types';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

/** "Create Issuance Request" button + dialog. Service scopes are limited to the actor's own scopes. */
export function CreateRequestDialog({ onCreated }: { onCreated?: (request: RequestDetail) => void }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [scopeCode, setScopeCode] = useState('');
  const [objectScope, setObjectScope] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [error, setError] = useState<string | null>(null);
  const { data: reference } = useReference();
  const { data: session } = useSession();
  const create = useCreateRequest();

  const scopes = (reference?.scopes ?? []).filter((s) => session?.scopeCodes.includes(s.code));

  const reset = () => {
    setClientId('');
    setScopeCode('');
    setObjectScope('');
    setPriority('NORMAL');
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientId || !scopeCode || !objectScope.trim()) {
      setError('Client, service scope and object / scope are required.');
      return;
    }
    try {
      const created = await create.mutateAsync({ clientId, scopeCode, objectScope: objectScope.trim(), priority });
      toast.success(`Request ${created.number} created`);
      setOpen(false);
      reset();
      onCreated?.(created);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="h-11 gap-2 px-5 text-sm font-semibold">
          <Plus /> Create Issuance Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Create Issuance Request</DialogTitle>
            <DialogDescription>Register a new client request for a certificate or inspection report.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="req-client">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="req-client" aria-label="Client" className="w-full">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {(reference?.clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="req-scope">Service scope</Label>
            <Select value={scopeCode} onValueChange={setScopeCode}>
              <SelectTrigger id="req-scope" aria-label="Service scope" className="w-full">
                <SelectValue placeholder="Select a service scope" />
              </SelectTrigger>
              <SelectContent>
                {scopes.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="req-object">Object / scope</Label>
            <Input
              id="req-object"
              value={objectScope}
              onChange={(e) => setObjectScope(e.target.value)}
              placeholder="e.g. Lifting & rigging equipment"
              maxLength={500}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="req-priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger id="req-priority" aria-label="Priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
