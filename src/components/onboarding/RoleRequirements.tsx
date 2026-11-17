'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  CircleCheck,
  Download,
  FileText,
  FolderOpen,
  Gavel,
  GraduationCap,
  IdCard,
  ListChecks,
  Scale,
  ShieldCheck,
  Stamp,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import { AUTHORISATION_STATUS_DEFINITIONS, PERSONNEL_RECORD_FIELDS, ROLE_CONTENT } from '@/domain/roleContent';
import type { Role } from '@/domain/types';
import { ROLE_META } from '@/lib/roles';
import { TONE_CLASSES, type Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'overview', label: 'Role Overview', icon: ClipboardList },
  { key: 'competency', label: 'Competency & Requirement', icon: GraduationCap },
  { key: 'authorisation', label: 'Authorisation & Impartiality', icon: ShieldCheck },
  { key: 'records', label: 'Records & Control Documents', icon: FolderOpen },
  { key: 'status', label: 'Authorisation Status', icon: Stamp },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const REQUIREMENT_ICONS = [GraduationCap, ShieldCheck, Scale, ListChecks, GraduationCap, UserRound, ClipboardList];

const STATUS_TONE: Record<string, Tone> = { ACTIVE: 'green', RESTRICTED: 'amber', SUSPENDED: 'blue', REVOKED: 'red', EXPIRED: 'grey' };

function Card({ title, icon: Icon, children, className, tone }: { title: ReactNode; icon?: typeof FileText; children: ReactNode; className?: string; tone?: Tone }) {
  return (
    <section className={cn('rounded-xl border bg-card p-4 shadow-[0_1px_3px_rgb(15_23_42/0.05)]', tone && TONE_CLASSES[tone].tile.split(' ')[0], className)}>
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
        {Icon && <Icon className="size-5 text-primary" aria-hidden />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Checks({ items, tone }: { items: readonly string[]; tone: Tone }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <Check className={cn('mt-0.5 size-4 shrink-0', TONE_CLASSES[tone].text)} strokeWidth={3} aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}

function KeyRequirements({ role }: { role: Role }) {
  const c = ROLE_CONTENT[role];
  return (
    <Card title={`Key Requirements for ${c.title}`} icon={ListChecks}>
      <dl className="divide-y rounded-lg border">
        {c.keyRequirements.map((r, i) => {
          const Icon = REQUIREMENT_ICONS[i % REQUIREMENT_ICONS.length]!;
          return (
            <div key={r.label} className="grid grid-cols-[minmax(0,12rem)_1fr] items-center gap-3 px-3 py-2">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden /> {r.label}
              </dt>
              <dd className="text-sm text-muted-foreground">{r.text}</dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}

function DetailedDescription({ role }: { role: Role }) {
  const c = ROLE_CONTENT[role];
  return (
    <Card title="Detailed Description" icon={FileText}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Competency Requirements (Examples)" tone="green" className="border-tone-green/20">
          <Checks items={c.competencyExamples} tone="green" />
        </Card>
        <Card title="Authorisation Scope" tone="amber" className="border-tone-amber/20">
          <Checks items={c.authorisationScope} tone="amber" />
        </Card>
        <Card title="Impartiality Requirements (Key Points)" tone="red" className="border-tone-red/20">
          <Checks items={c.impartiality} tone="red" />
        </Card>
        <Card title="Competency Evidence (Examples)" tone="blue" className="border-tone-blue/20">
          <Checks items={c.evidence} tone="blue" />
        </Card>
      </div>
    </Card>
  );
}

function StatusDefinitions() {
  return (
    <Card title="Authorisation Status Definition" icon={Stamp}>
      <dl className="space-y-1.5">
        {AUTHORISATION_STATUS_DEFINITIONS.map((d) => (
          <div key={d.status} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-sm">
            <dt>
              <span className={cn('inline-flex w-full items-center gap-2 rounded-md px-2.5 py-1 font-semibold', TONE_CLASSES[STATUS_TONE[d.status]!].tile)}>
                <span className={cn('size-2 rounded-full', TONE_CLASSES[STATUS_TONE[d.status]!].dot)} aria-hidden />
                {d.short}
              </span>
            </dt>
            <dd className="text-muted-foreground">{d.detail}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function PersonnelRecord() {
  return (
    <Card title="Personnel Authorisation Record (Required Data)" icon={IdCard}>
      <p className="mb-3 text-sm text-muted-foreground">Each authorised person has a record containing:</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {PERSONNEL_RECORD_FIELDS.map((f) => (
          <li key={f.label} className="rounded-lg border bg-muted/40 px-2 py-3 text-center">
            <p className="text-sm font-semibold">{f.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{f.detail}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ControlDocuments() {
  return (
    <Card title={`Personnel Control Documents (${REQUIRED_CONTROL_DOCUMENTS.length} Required Records)`} icon={FolderOpen}>
      <p className="mb-3 text-sm text-muted-foreground">These control documents are prepared and maintained for each role:</p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {REQUIRED_CONTROL_DOCUMENTS.map((d, i) => (
          <li key={d} className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-3 text-center text-xs font-medium">
            <span className="flex size-6 items-center justify-center rounded-full bg-tone-blue-soft text-xs font-bold text-tone-blue">{i + 1}</span>
            {d}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function RelatedRole() {
  const c = ROLE_CONTENT.CERTIFICATION_DECISION_MAKER;
  return (
    <Card title="Related Role: Certification Decision Maker" icon={Gavel} tone="purple" className="border-tone-purple/20">
      <p className="text-sm font-medium text-tone-purple">(Technical Decision Authority)</p>
      <p className="mt-1 text-sm text-muted-foreground">{c.coreResponsibility}</p>
    </Card>
  );
}

/** Step 2: role hero, tabbed requirement panels, record strips and the proceed bar. */
export function RoleRequirements({ role }: { role: Role }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('overview');
  const meta = ROLE_META[role];
  const content = ROLE_CONTENT[role];
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <section
        aria-label="Selected role"
        className="flex flex-wrap items-center gap-6 overflow-hidden rounded-xl border bg-gradient-to-r from-[#dfe9fb] via-[#eef3fc] to-white p-5"
      >
        <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-border">
          <Icon className="size-10" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-48">
          <span className="rounded-full bg-tone-blue-soft px-2.5 py-0.5 text-xs font-semibold text-tone-blue">Selected Role</span>
          <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-navy">{content.title}</p>
        </div>
        <div className="min-w-64 flex-1 border-l border-border pl-6">
          <p className="flex items-center gap-2 text-sm font-bold">
            <CircleCheck className="size-5 text-primary" aria-hidden /> Core Responsibility
          </p>
          <p className="mt-1 text-sm text-foreground/80">{content.coreResponsibility}</p>
        </div>
      </section>

      <div role="tablist" aria-label="Role information" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {TABS.map((t) => {
          const TabIcon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-card hover:bg-muted',
              )}
            >
              <TabIcon className="size-4 shrink-0" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)!.label} className="space-y-4">
        {tab === 'overview' && (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            <KeyRequirements role={role} />
            <DetailedDescription role={role} />
          </div>
        )}
        {tab === 'competency' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <KeyRequirements role={role} />
            <Card title="Competency Requirements (Examples)" icon={GraduationCap}>
              <Checks items={content.competencyExamples} tone="green" />
              <h4 className="mt-4 mb-2 text-sm font-bold">Competency Evidence (Examples)</h4>
              <Checks items={content.evidence} tone="blue" />
            </Card>
          </div>
        )}
        {tab === 'authorisation' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Authorisation Scope" icon={ShieldCheck}>
              <Checks items={content.authorisationScope} tone="amber" />
            </Card>
            <Card title="Impartiality Requirements (Key Points)" icon={Scale}>
              <Checks items={content.impartiality} tone="red" />
            </Card>
          </div>
        )}
        {tab === 'records' && (
          <>
            <PersonnelRecord />
            <ControlDocuments />
          </>
        )}
        {tab === 'status' && <StatusDefinitions />}
      </div>

      {tab !== 'records' && (
        <div className={cn('grid gap-4', tab !== 'status' && 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
          <PersonnelRecord />
          {tab !== 'status' && <StatusDefinitions />}
        </div>
      )}
      {tab !== 'records' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ControlDocuments />
          <RelatedRole />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="outline" size="lg" className="h-11" onClick={() => router.push('/register/1')}>
          <ArrowLeft aria-hidden /> Change Role
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="lg" className="h-11" onClick={() => toast.info('The role requirements PDF is available in the full release')}>
            <Download aria-hidden /> Download Role Requirements (PDF)
          </Button>
          <Button size="lg" className="h-11 px-5" onClick={() => router.push(`/register/3?role=${role}`)}>
            Proceed to Registration &amp; Authorisation <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
