'use client';

import { CheckCircle2, ExternalLink, FileText, UserCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/api-client/client';
import { useCan, useDecideRegistration, useRegistration } from '@/api-client/hooks';
import type { RegistrationDetail } from '@/contract/types';
import { DetailList, DetailPanel } from '@/components/common/DetailPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { toastError } from '@/components/common/notify';
import { StatusPill } from '@/components/common/StatusPill';
import { ReasonDialog } from '@/components/review/ReasonDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import { ROLE_LABEL } from '@/domain/permissions';
import { formatDate, formatDateTime } from '@/lib/format';

const cardClass = 'rounded-xl border bg-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]';
const DAY = 86_400_000;

/** yyyy-mm-dd for a UTC date. */
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function defaultUntil(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 2);
  return isoDay(d);
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Right-hand panel of the Pending Authorisations page. */
export function AuthorisationDetailPanel({ id }: { id: string | null }) {
  const { data, isPending, error } = useRegistration(id);
  if (!id) {
    return (
      <div className={cardClass}>
        <EmptyState icon={UserCheck} title="Select an application" description="Choose a row to review the applicant, the uploaded control documents and decide." />
      </div>
    );
  }
  if (isPending) return <div className={`${cardClass} p-8 text-center text-sm text-muted-foreground`}>Loading…</div>;
  if (error || !data) {
    return (
      <div className={cardClass}>
        <EmptyState icon={UserCheck} title="Application not found" description="It may have been removed." />
      </div>
    );
  }
  return <PanelBody reg={data} />;
}

function PanelBody({ reg }: { reg: RegistrationDetail }) {
  const can = useCan();
  const decide = useDecideRegistration();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [until, setUntil] = useState(defaultUntil);
  const [untilError, setUntilError] = useState<string | null>(null);

  const pending = reg.status === 'PENDING';
  const decidable = pending && can('registration.decide');
  const [minDay] = useState(() => isoDay(new Date(Date.now() + DAY)));

  const approve = () => {
    if (!until || until < minDay) {
      setUntilError('Choose a date in the future.');
      return;
    }
    decide.mutate(
      { id: reg.id, body: { decision: 'APPROVE', authorisedUntil: until } },
      {
        onSuccess: () => {
          setApproveOpen(false);
          toast.success('Registration approved', { description: `${reg.applicantName} can now sign in as ${ROLE_LABEL[reg.role]}.` });
        },
        onError: toastError,
      },
    );
  };
  const reject = (comment: string) =>
    decide.mutate(
      { id: reg.id, body: { decision: 'REJECT', comment } },
      {
        onSuccess: () => {
          setRejectOpen(false);
          toast.success('Registration rejected');
        },
        onError: toastError,
      },
    );

  const p = reg.personal;
  const e = reg.employment;
  return (
    <>
      <DetailPanel
        title="Authorisation Request"
        icon={UserCheck}
        badge={<StatusPill status={reg.status} kind="registration" />}
        tabs={[
          {
            key: 'applicant',
            label: 'Applicant',
            content: (
              <DetailList
                items={[
                  { label: 'Name', value: <span className="font-semibold">{reg.applicantName}</span> },
                  { label: 'Role', value: ROLE_LABEL[reg.role] },
                  { label: 'Service scope', value: reg.requestedScopes.join(', ') || '–' },
                  { label: 'Submitted', value: formatDateTime(reg.createdAt) },
                  { label: 'Control documents', value: `${reg.documents.length} / ${REQUIRED_CONTROL_DOCUMENTS.length} documents` },
                  { label: 'Employee ID', value: p.employeeId },
                  { label: 'National ID', value: p.nationalId },
                  { label: 'Position', value: `${p.position}, ${p.unit}` },
                  { label: 'Email', value: p.email },
                  { label: 'Phone', value: p.phone },
                  { label: 'Education', value: `${e.education} – ${e.fieldOfStudy}` },
                  { label: 'Experience', value: `${e.experienceYears} years` },
                  { label: 'Employment', value: `${e.employmentStatus === 'PERMANENT' ? 'Permanent' : 'Contract'} since ${formatDate(e.startDate)}` },
                ]}
              />
            ),
          },
          {
            key: 'documents',
            label: 'Documents',
            content: (
              <ul aria-label="Uploaded control documents" className="divide-y">
                {reg.documents.map((d) => (
                  <li key={d.slot} className="flex items-center gap-3 py-2.5 text-sm">
                    <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {d.slot}. {d.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {d.fileName} · {kb(d.sizeBytes)}
                      </span>
                    </span>
                    <a
                      href={api.registrations.fileUrl(reg.id, d.slot)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View ${d.slot}. ${d.name}`}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary hover:bg-tone-blue-soft focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      View <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            ),
          },
          {
            key: 'decision',
            label: 'Decision',
            content: pending ? (
              <p className="py-4 text-sm text-muted-foreground">No decision yet. Review the applicant and documents, then approve or reject.</p>
            ) : (
              <DetailList
                items={[
                  { label: 'Decision', value: <StatusPill status={reg.status} kind="registration" /> },
                  { label: 'Decided by', value: reg.decidedByName ?? '–' },
                  { label: 'Decided on', value: reg.decidedAt ? formatDateTime(reg.decidedAt) : '–' },
                  ...(reg.status === 'APPROVED'
                    ? [
                        { label: 'Authorised from', value: reg.authorisedFrom ? formatDate(reg.authorisedFrom) : '–' },
                        { label: 'Authorised until', value: reg.authorisedUntil ? formatDate(reg.authorisedUntil) : '–' },
                      ]
                    : []),
                  { label: 'Comment', value: reg.decisionComment ?? '–' },
                ]}
              />
            ),
          },
        ]}
        actions={
          decidable && (
            <>
              <Button onClick={() => { setUntil(defaultUntil()); setUntilError(null); setApproveOpen(true); }} disabled={decide.isPending}>
                <CheckCircle2 aria-hidden /> Approve
              </Button>
              <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={decide.isPending}>
                <XCircle aria-hidden /> Reject
              </Button>
            </>
          )
        }
      />

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve authorisation</DialogTitle>
            <DialogDescription>
              {reg.applicantName} will become {ROLE_LABEL[reg.role]} for {reg.requestedScopes.join(', ')}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="authorised-until">Authorised until</Label>
            <Input
              id="authorised-until"
              type="date"
              min={minDay}
              value={until}
              aria-invalid={!!untilError}
              onChange={(ev) => {
                setUntil(ev.target.value);
                setUntilError(null);
              }}
            />
            {untilError && (
              <p role="alert" className="text-sm text-destructive">
                {untilError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={decide.isPending}>
              Cancel
            </Button>
            <Button onClick={approve} disabled={decide.isPending}>
              Approve Authorisation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject registration"
        description={`Tell ${reg.applicantName} why the request is not approved.`}
        label="Comment"
        confirmLabel="Reject Registration"
        destructive
        pending={decide.isPending}
        onConfirm={reject}
      />
    </>
  );
}
