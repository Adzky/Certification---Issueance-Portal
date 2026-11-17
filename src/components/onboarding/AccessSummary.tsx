'use client';

import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Gavel, Info, Briefcase, Monitor, UserRound, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLogin, useRegistrationStatus } from '@/api-client/hooks';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { REGISTRABLE_ROLES, ROLE_CONTENT } from '@/domain/roleContent';
import type { Role } from '@/domain/types';
import { formatDate, initials } from '@/lib/format';
import { ROLE_META } from '@/lib/roles';
import { TONE_CLASSES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { toastError } from '@/components/common/notify';

function Banner({ tone, icon: Icon, title, text, pill }: { tone: 'green' | 'amber' | 'red'; icon: typeof CheckCircle2; title: string; text: string; pill: string }) {
  const styles = {
    green: 'border-tone-green/25 bg-gradient-to-r from-tone-green-soft to-white text-tone-green',
    amber: 'border-tone-amber/25 bg-gradient-to-r from-tone-amber-soft to-white text-tone-amber',
    red: 'border-tone-red/25 bg-gradient-to-r from-tone-red-soft to-white text-tone-red',
  }[tone];
  return (
    <section aria-live="polite" className={cn('flex flex-wrap items-center gap-4 rounded-xl border p-4', styles)}>
      <Icon className="size-12 shrink-0" strokeWidth={1.6} aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-foreground/80">{text}</p>
      </div>
      <span className={cn('inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-foreground', `border-current ${TONE_CLASSES[tone].text}`)}>
        <span className={cn('size-2.5 rounded-full', TONE_CLASSES[tone].dot)} aria-hidden />
        <span className="text-foreground">{pill}</span>
      </span>
    </section>
  );
}

function RoleCard({ role, mine }: { role: Role | 'CERTIFICATION_DECISION_MAKER'; mine: boolean }) {
  const decision = role === 'CERTIFICATION_DECISION_MAKER';
  const meta = decision ? null : ROLE_META[role];
  const Icon = meta?.icon ?? Gavel;
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-xl border bg-card p-4',
        mine ? 'border-primary bg-tone-blue-soft/40 ring-2 ring-primary/50' : 'opacity-90',
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn('size-7 shrink-0', mine ? 'text-primary' : 'text-slate-500')} strokeWidth={1.6} aria-hidden />
        <p className="min-w-0 flex-1 font-bold">
          {decision ? 'Certification Decision Maker' : meta!.label}
          {decision && <span className="block text-xs font-medium text-muted-foreground">(Technical Decision Authority)</span>}
        </p>
        <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold', mine ? 'bg-tone-green-soft text-tone-green' : 'bg-muted text-muted-foreground')}>
          {mine ? 'Your Role' : 'Not Assigned'}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{ROLE_CONTENT[role].coreResponsibility}</p>
    </li>
  );
}

/** Step 4: status of the application (polled), then the account summary and the "Access My Dashboard" action. */
export function AccessSummary({ appId, onBack }: { appId: string | null; onBack: () => void }) {
  const router = useRouter();
  const status = useRegistrationStatus(appId);
  const login = useLogin();

  if (!appId || status.isError) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          title="We could not find that registration"
          description={appId ? 'The link may be incomplete or the application no longer exists.' : 'Start a registration to follow its status here.'}
          action={
            <Button asChild>
              <Link href="/register/1">Start a new registration</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const data = status.data;
  if (!data) return <div className="h-64 animate-pulse rounded-xl bg-muted" aria-label="Loading status" />;

  const role = data.role;
  const meta = ROLE_META[role];
  const approved = data.status === 'APPROVED';
  const rejected = data.status === 'REJECTED';
  const name = data.applicantName ?? 'Applicant';
  const period =
    data.authorisedFrom && data.authorisedUntil ? `${formatDate(data.authorisedFrom)} – ${formatDate(data.authorisedUntil)}` : approved ? '–' : 'Set when approved';

  const enter = () => {
    if (!data.userId) return;
    login.mutate(
      { userId: data.userId, role },
      { onSuccess: () => router.push('/dashboard'), onError: toastError },
    );
  };

  return (
    <div className="space-y-4">
      {approved ? (
        <Banner tone="green" icon={CheckCircle2} title="Authorisation Successful" text="Your account has been activated and is ready to use." pill="Authorisation Status: Active" />
      ) : rejected ? (
        <Banner tone="red" icon={XCircle} title="Authorisation Not Granted" text="Your authorisation request was not approved." pill="Authorisation Status: Revoked" />
      ) : (
        <Banner
          tone="amber"
          icon={Clock3}
          title="Awaiting Authorisation"
          text="Your registration has been submitted. The Issuance Manager is reviewing your documents; this page updates automatically."
          pill="Authorisation Status: Pending"
        />
      )}

      {rejected && (
        <section aria-label="Decision" className="rounded-xl border border-tone-red/30 bg-card p-4">
          <h3 className="text-sm font-bold">Decision comment</h3>
          <p className="mt-1 text-sm">{data.decisionComment ?? 'No comment was recorded.'}</p>
          <Button asChild variant="outline" className="mt-3">
            <Link href="/register/1">Start a new registration</Link>
          </Button>
        </section>
      )}

      <section aria-label="Registration summary" className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.5fr)]">
        <div className="flex items-center gap-4">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-navy text-2xl font-bold text-white ring-4 ring-tone-blue-soft">
            {name === 'Applicant' ? <UserRound className="size-9" aria-hidden /> : initials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-2xl font-bold">{name}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="size-4" aria-hidden /> {meta.label} applicant
            </p>
          </div>
        </div>
        <div className="hidden bg-border md:block" aria-hidden />
        <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="font-semibold">Assigned Role</dt>
          <dd>{approved ? meta.label : `${meta.label} (requested)`}</dd>
          <dt className="font-semibold">Service Scope</dt>
          <dd>{data.scopes.join(', ') || '–'}</dd>
          <dt className="font-semibold">Authorisation Period</dt>
          <dd>{period}</dd>
          <dt className="font-semibold">Authorising Official</dt>
          <dd>{data.authorisedBy ?? 'Issuance Manager'}</dd>
        </dl>
      </section>

      <section aria-label="Your dashboard access">
        <h2 className="mb-2 text-xl font-bold">Your Dashboard Access</h2>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {REGISTRABLE_ROLES.map((r) => (
            <RoleCard key={r} role={r} mine={approved && r === role} />
          ))}
          <RoleCard role="CERTIFICATION_DECISION_MAKER" mine={false} />
        </ul>
      </section>

      <p className="flex items-start gap-2 rounded-lg border border-tone-blue/20 bg-tone-blue-soft/60 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          <strong>Note:</strong> You can access only the role(s) assigned and authorised to you. If you require access to another role, please submit a new authorisation
          request.
        </span>
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="outline" size="lg" className="h-11" onClick={onBack}>
          <ArrowLeft aria-hidden /> Back to Authorisation
        </Button>
        {approved && !data.userId ? (
          <Button asChild size="lg" className="h-11 px-6">
            <Link href="/login">
              Sign in to your dashboard <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button size="lg" className="h-11 px-6" disabled={!approved || login.isPending} onClick={enter}>
            <Monitor aria-hidden /> Access My Dashboard <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
