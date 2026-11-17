'use client';

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ClipboardList,
  GraduationCap,
  Layers,
  Mail,
  PenLine,
  Phone,
  Save,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { toast } from 'sonner';
import { usePublicScopes, useSubmitRegistration } from '@/api-client/hooks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ROLE_CONTENT } from '@/domain/roleContent';
import type { Role } from '@/domain/types';
import { ROLE_META } from '@/lib/roles';
import {
  EDUCATION_OPTIONS,
  EMPTY_VALUES,
  hasPdfSignature,
  toPayload,
  validateFileSlots,
  validatePdfFile,
  validateRegistrationValues,
  type FieldErrors,
  type RegistrationFormValues,
} from '@/lib/registrationValidation';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ControlDocumentsUpload, EMPTY_SLOTS, type UploadSlot } from './ControlDocumentsUpload';
import { SECTIONS, type SectionKey } from './OnboardingSidebar';

export const DRAFT_KEY = 'jmu-registration-draft';

interface Draft {
  role: Role;
  values: Omit<RegistrationFormValues, 'declarationAccepted' | 'personal'> & { personal: Omit<RegistrationFormValues['personal'], 'nationalId' | 'phone'> };
}

function readDraft(role: Role): Draft['values'] | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<Draft>;
    return draft.role === role && draft.values ? draft.values : null;
  } catch {
    return null;
  }
}

const SECTION_ICON: Record<SectionKey, LucideIcon> = {
  personal: UserRound,
  scope: Layers,
  competency: GraduationCap,
  documents: ClipboardList,
  authorisation: ShieldCheck,
  declaration: PenLine,
};

const PROCESS_STEPS: { label: string; sub: string; icon: LucideIcon }[] = [
  { label: 'Submit', sub: 'Registration', icon: UserRound },
  { label: 'Competency', sub: 'Verification', icon: Search },
  { label: 'Authorisation', sub: 'Review', icon: ShieldCheck },
  { label: 'Approval by', sub: 'Authorising Official', icon: PenLine },
  { label: 'Active', sub: 'Access Granted', icon: BadgeCheck },
];

const inputClass = 'h-10 bg-white';

function Panel({ title, subtitle, icon: Icon, children, className }: { title: string; subtitle?: string; icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('rounded-xl border bg-card p-4 shadow-[0_1px_3px_rgb(15_23_42/0.05)]', className)}>
      <header className="mb-3 flex items-start gap-3">
        <Icon className="mt-0.5 size-6 shrink-0 text-primary" strokeWidth={1.7} aria-hidden />
        <div>
          <h2 className="text-lg leading-tight font-bold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Field({ id, label, error, required = true, children, className }: { id: string; label: string; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline gap-0.5">
        <Label htmlFor={id} className="text-sm font-semibold">
          {label}
        </Label>
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const noopSubscribe = () => () => undefined;

/** Step 3: profile header, authorisation process strip, section tabs and the whole registration form. */
export function RegistrationForm(props: { role: Role; onSectionChange?: (s: SectionKey) => void }) {
  // A saved draft lives in localStorage, so the form is built on the client only (no hydration mismatch).
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return <div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Loading form" />;
  return <RegistrationFormBody {...props} />;
}

function initialValues(role: Role): { values: RegistrationFormValues; restored: boolean } {
  const draft = readDraft(role);
  if (!draft) return { values: EMPTY_VALUES, restored: false };
  return {
    values: { ...EMPTY_VALUES, ...draft, personal: { ...EMPTY_VALUES.personal, ...draft.personal, nationalId: '', phone: '' }, employment: { ...EMPTY_VALUES.employment, ...draft.employment } },
    restored: true,
  };
}

function RegistrationFormBody({ role, onSectionChange }: { role: Role; onSectionChange?: (s: SectionKey) => void }) {
  const router = useRouter();
  const uid = useId();
  const meta = ROLE_META[role];
  const content = ROLE_CONTENT[role];
  const { data: scopes } = usePublicScopes();
  const submit = useSubmitRegistration();

  const [initial] = useState(() => initialValues(role));
  const [values, setValues] = useState<RegistrationFormValues>(initial.values);
  const [slots, setSlots] = useState<UploadSlot[]>(EMPTY_SLOTS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [hasDraft, setHasDraft] = useState(initial.restored);
  const [active, setActive] = useState<SectionKey>('personal');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial.restored) toast.info('Draft restored', { description: 'Documents must be uploaded again.' });
  }, [initial.restored]);

  const choose = (key: SectionKey) => {
    setActive(key);
    onSectionChange?.(key);
  };

  // Keep the active tab and the sidebar in step with the section being read.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(`${uid}-${s.key}`)).filter((e): e is HTMLElement => !!e);
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const key = hit?.target.getAttribute('data-section') as SectionKey | undefined;
        if (key) choose(key);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `choose` only forwards to stable state setters/callbacks
  }, [uid]);

  const goTo = (key: SectionKey) => {
    choose(key);
    document.getElementById(`${uid}-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const setPersonal = (k: keyof RegistrationFormValues['personal'], v: string) => {
    setValues((s) => ({ ...s, personal: { ...s.personal, [k]: v } }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const setEmployment = <K extends keyof RegistrationFormValues['employment']>(k: K, v: RegistrationFormValues['employment'][K]) => {
    setValues((s) => ({ ...s, employment: { ...s.employment, [k]: v } }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const pick = async (index: number, file: File) => {
    let error = validatePdfFile(file);
    setSlots((s) => s.map((x, i) => (i === index ? { file, error } : x)));
    if (!error && !(await hasPdfSignature(file))) {
      error = 'Only PDF files are accepted';
      setSlots((s) => s.map((x, i) => (i === index && x.file === file ? { file, error } : x)));
    }
  };
  const clear = (index: number) => setSlots((s) => s.map((x, i) => (i === index ? { file: null, error: null } : x)));

  const saveDraft = () => {
    try {
      // The national ID / passport number and phone number are never written to the browser.
      const { nationalId: _n, phone: _p, ...personal } = values.personal;
      void _n;
      void _p;
      const draft: Draft = { role, values: { personal, employment: values.employment, scopes: values.scopes } };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setHasDraft(true);
      toast.success('Draft saved', {
        description:
          'Your name, email and other details are kept on this device. National ID, phone and documents are not stored and must be entered again. Use Clear draft on a shared device.',
      });
    } catch {
      toast.error('Could not save the draft in this browser');
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage unavailable */
    }
    setHasDraft(false);
    setValues(EMPTY_VALUES);
    setErrors({});
    toast.success('Draft cleared');
  };

  const onSubmit = async () => {
    setServerError(null);
    setAttempted(true);
    const fieldErrors = validateRegistrationValues(values);
    const fileErrors = validateFileSlots(slots.map((s) => (s.file && !s.error ? s.file : null)));
    // Keep the specific reason for a file that was rejected when chosen.
    const nextSlots = slots.map((s, i) => ({ file: s.file, error: s.error ?? fileErrors[i] ?? null }));
    setSlots(nextSlots);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0 || nextSlots.some((s) => s.error)) {
      setServerError(null);
      const first = Object.keys(fieldErrors)[0];
      requestAnimationFrame(() => {
        const el = first ? document.getElementById(`${uid}-${first}`) : null;
        if (el) el.focus();
        else goTo(Object.keys(fieldErrors).length ? 'personal' : 'documents');
      });
      return;
    }
    try {
      const res = await submit.mutateAsync({ payload: toPayload(role, values), files: slots.map((s) => s.file!) });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* storage unavailable */
      }
      router.push(`/register/4?app=${encodeURIComponent(res.applicationId)}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'The registration could not be submitted');
    }
  };

  const id = (k: string) => `${uid}-${k}`;
  const errCount = Object.keys(errors).filter((k) => errors[k]).length + slots.filter((s) => s.error).length;
  const p = values.personal;
  const e = values.employment;
  const describe = (k: string) => (errors[k] ? `${id(k)}-error` : undefined);

  return (
    <div ref={root} className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-label="Applicant" className="flex items-center gap-4 rounded-xl border bg-gradient-to-r from-[#e3ecfb] to-white p-4">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-navy text-2xl font-bold text-white ring-4 ring-white">
            {p.fullName.trim() ? initials(p.fullName) : <UserRound className="size-9" aria-hidden />}
          </span>
          <div className="min-w-0 space-y-1">
            <p className="truncate text-xl font-bold">{p.fullName.trim() || 'Your name'}</p>
            <p className="truncate text-sm text-muted-foreground">
              Email: {p.email.trim() || '–'} &nbsp;|&nbsp; Phone: {p.phone.trim() || '–'}
            </p>
            <p className="flex items-center gap-2 text-sm font-semibold">
              Selected Role:
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-primary ring-1 ring-primary/20">
                <meta.icon className="size-4" aria-hidden /> {meta.label}
              </span>
            </p>
          </div>
        </section>
        <section aria-label="Authorisation Process" className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold">Authorisation Process</h2>
          <ol className="grid grid-cols-5 gap-1 text-center">
            {PROCESS_STEPS.map((s, i) => (
              <li key={s.label} className="relative flex flex-col items-center gap-1">
                <span className={cn('flex size-11 items-center justify-center rounded-full', i === 0 ? 'bg-primary text-white' : i === 4 ? 'bg-tone-green-soft text-tone-green' : 'bg-tone-blue-soft text-primary')}>
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="text-[11px] leading-tight font-semibold">{s.label}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{s.sub}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div role="tablist" aria-label="Form sections" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {SECTIONS.map((s) => {
          const Icon = SECTION_ICON[s.key];
          const on = active === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => goTo(s.key)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-card hover:bg-muted',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{s.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {(serverError || (attempted && errCount > 0)) && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-tone-red-soft px-4 py-3 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{serverError ?? 'Please correct the highlighted items before submitting.'}</p>
            {serverError && <p className="text-xs">Check the form and try again.</p>}
          </div>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div id={id('personal')} data-section="personal" className="scroll-mt-20">
          <Panel title="Personal Information" subtitle="Provide your identity and employment information." icon={UserRound}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field id={id('fullName')} label="Full Name" error={errors.fullName}>
                <Input id={id('fullName')} className={inputClass} value={p.fullName} aria-invalid={!!errors.fullName} aria-describedby={describe('fullName')} onChange={(ev) => setPersonal('fullName', ev.target.value)} />
              </Field>
              <Field id={id('employeeId')} label="Employee ID" error={errors.employeeId}>
                <Input id={id('employeeId')} className={inputClass} value={p.employeeId} aria-invalid={!!errors.employeeId} aria-describedby={describe('employeeId')} onChange={(ev) => setPersonal('employeeId', ev.target.value)} />
              </Field>
              <Field id={id('nationalId')} label="National ID / Passport No." error={errors.nationalId}>
                <Input id={id('nationalId')} className={inputClass} value={p.nationalId} aria-invalid={!!errors.nationalId} aria-describedby={describe('nationalId')} onChange={(ev) => setPersonal('nationalId', ev.target.value)} />
              </Field>
              <Field id={id('position')} label="Position / Job Title" error={errors.position} className="sm:col-span-1">
                <Input id={id('position')} className={inputClass} value={p.position} aria-invalid={!!errors.position} aria-describedby={describe('position')} onChange={(ev) => setPersonal('position', ev.target.value)} />
              </Field>
              <Field id={id('unit')} label="Organization Unit" error={errors.unit} className="sm:col-span-2">
                <Input id={id('unit')} className={inputClass} value={p.unit} aria-invalid={!!errors.unit} aria-describedby={describe('unit')} onChange={(ev) => setPersonal('unit', ev.target.value)} />
              </Field>
              <Field id={id('email')} label="Email" error={errors.email} className="sm:col-span-1">
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input id={id('email')} type="email" className={cn(inputClass, 'pl-9')} value={p.email} aria-invalid={!!errors.email} aria-describedby={describe('email')} onChange={(ev) => setPersonal('email', ev.target.value)} />
                </div>
              </Field>
              <Field id={id('phone')} label="Phone Number" error={errors.phone} className="sm:col-span-2">
                <div className="relative">
                  <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input id={id('phone')} type="tel" className={cn(inputClass, 'pl-9')} value={p.phone} aria-invalid={!!errors.phone} aria-describedby={describe('phone')} onChange={(ev) => setPersonal('phone', ev.target.value)} />
                </div>
              </Field>
            </div>
          </Panel>
          </div>

          <div id={id('competency')} data-section="competency" className="scroll-mt-20">
            <Panel title="Employment & Qualification" subtitle="Your education, experience and employment status." icon={GraduationCap}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={id('education')} label="Recommended Initial Education" error={errors.education}>
                  <select
                    id={id('education')}
                    value={e.education}
                    onChange={(ev) => setEmployment('education', ev.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {EDUCATION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id={id('fieldOfStudy')} label="Field of Study" error={errors.fieldOfStudy}>
                  <Input id={id('fieldOfStudy')} className={inputClass} value={e.fieldOfStudy} aria-invalid={!!errors.fieldOfStudy} aria-describedby={describe('fieldOfStudy')} onChange={(ev) => setEmployment('fieldOfStudy', ev.target.value)} />
                </Field>
                <Field id={id('experienceYears')} label="Relevant Experience (years)" error={errors.experienceYears}>
                  <Input id={id('experienceYears')} type="number" min={0} max={80} step={1} inputMode="numeric" className={inputClass} value={e.experienceYears} aria-invalid={!!errors.experienceYears} aria-describedby={describe('experienceYears')} onChange={(ev) => setEmployment('experienceYears', ev.target.value)} />
                </Field>
                <Field id={id('startDate')} label="Employment Start Date" error={errors.startDate}>
                  <Input id={id('startDate')} type="date" className={inputClass} value={e.startDate} aria-invalid={!!errors.startDate} aria-describedby={describe('startDate')} onChange={(ev) => setEmployment('startDate', ev.target.value)} />
                </Field>
                <div className="space-y-1.5 sm:col-span-2">
                  <p id={id('status-label')} className="text-sm font-semibold">
                    Current Employment Status
                  </p>
                  <RadioGroup
                    aria-labelledby={id('status-label')}
                    value={e.employmentStatus}
                    onValueChange={(v) => setEmployment('employmentStatus', v as 'PERMANENT' | 'CONTRACT')}
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="PERMANENT" id={id('permanent')} />
                      <Label htmlFor={id('permanent')}>Permanent Employee</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="CONTRACT" id={id('contract')} />
                      <Label htmlFor={id('contract')}>Contract</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          <div id={id('scope')} data-section="scope" className="scroll-mt-20">
            <Panel title="Role & Authorisation Overview" icon={ClipboardList}>
              <dl className="mb-3 divide-y text-sm">
                <div className="grid grid-cols-[9rem_1fr] gap-3 py-2">
                  <dt className="font-semibold">Selected Role</dt>
                  <dd className="font-semibold text-primary">{meta.label}</dd>
                </div>
                <div className="grid grid-cols-[9rem_1fr] gap-3 py-2">
                  <dt className="font-semibold">Main Responsibility</dt>
                  <dd className="text-muted-foreground">{content.coreResponsibility}</dd>
                </div>
              </dl>
              <fieldset aria-describedby={errors.scopes ? id('scopes-error') : undefined}>
                <legend className="mb-1.5 text-sm font-semibold">
                  Service Scope (Requested) <span aria-hidden className="text-destructive">*</span>
                </legend>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {(scopes ?? []).map((s) => {
                    const checked = values.scopes.includes(s.code);
                    const cid = id(`scope-${s.code}`);
                    return (
                      <li key={s.code}>
                        <label
                          htmlFor={cid}
                          className={cn(
                            'flex cursor-pointer items-center gap-2.5 rounded-full border px-3 py-2 text-sm',
                            checked ? 'border-tone-green/30 bg-tone-green-soft font-medium' : 'bg-white hover:bg-muted',
                          )}
                        >
                          <Checkbox
                            id={cid}
                            checked={checked}
                            onCheckedChange={(on) => {
                              setValues((v) => ({ ...v, scopes: on === true ? [...v.scopes, s.code] : v.scopes.filter((c) => c !== s.code) }));
                              setErrors((er) => ({ ...er, scopes: undefined }));
                            }}
                          />
                          {s.name}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {errors.scopes && (
                  <p id={id('scopes-error')} className="mt-1.5 text-xs font-medium text-destructive">
                    {errors.scopes}
                  </p>
                )}
              </fieldset>
            </Panel>
          </div>
          <div id={id('authorisation')} data-section="authorisation" className="scroll-mt-20">
            <Panel title="Authorisation Details" subtitle="How your authorisation is decided." icon={UserCheck}>
              <dl className="divide-y text-sm">
                {[
                  ['Authorising Official', 'Issuance Manager'],
                  ['Authorisation Period', 'Set on approval (default two years from the approval date)'],
                  ['Authorisation Status', 'Pending until the Issuance Manager has reviewed your documents'],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[10rem_1fr] gap-3 py-2">
                    <dt className="font-semibold">{k}</dt>
                    <dd className="text-muted-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </div>
      </div>

      <div id={id('documents')} data-section="documents" className="scroll-mt-20">
        <ControlDocumentsUpload slots={slots} onPick={(i, f) => void pick(i, f)} onClear={clear} />
      </div>

      <div id={id('declaration')} data-section="declaration" className="scroll-mt-20">
        <Panel title="Declaration & Submission" subtitle="Confirm your declaration to submit for authorisation." icon={PenLine}>
          <div className="flex items-start gap-3">
            <Checkbox
              id={id('declarationAccepted')}
              checked={values.declarationAccepted}
              aria-invalid={!!errors.declarationAccepted}
              onCheckedChange={(on) => {
                setValues((v) => ({ ...v, declarationAccepted: on === true }));
                setErrors((er) => ({ ...er, declarationAccepted: undefined }));
              }}
              className="mt-0.5"
            />
            <Label htmlFor={id('declarationAccepted')} className="text-sm leading-relaxed font-normal">
              I declare that the information and documents provided are accurate and complete, and that I will perform this role impartially and keep client
              information confidential.
            </Label>
          </div>
          {errors.declarationAccepted && <p className="mt-1.5 text-xs font-medium text-destructive">{errors.declarationAccepted}</p>}
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="outline" size="lg" className="h-11" onClick={() => router.push(`/register/2?role=${role}`)}>
          <ArrowLeft aria-hidden /> Back: Role Review
        </Button>
        <div className="flex flex-wrap gap-3">
          {hasDraft && (
            <Button variant="ghost" size="lg" className="h-11" onClick={clearDraft}>
              Clear draft
            </Button>
          )}
          <Button variant="outline" size="lg" className="h-11" onClick={saveDraft}>
            <Save aria-hidden /> Save as Draft
          </Button>
          <Button size="lg" className="h-11 px-6" onClick={() => void onSubmit()} disabled={submit.isPending}>
            <Send aria-hidden /> {submit.isPending ? 'Submitting…' : 'Submit for Authorisation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
