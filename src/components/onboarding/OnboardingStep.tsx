'use client';

import { ClipboardCheck, ClipboardList, Monitor, UserRoundCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRegistrationStatus } from '@/api-client/hooks';
import { isRegistrableRole } from '@/domain/roleContent';
import { AccessSummary } from './AccessSummary';
import { OnboardingFrame } from './OnboardingFrame';
import { OnboardingSidebar, type SectionKey } from './OnboardingSidebar';
import { RegistrationForm } from './RegistrationForm';
import { RoleRequirements } from './RoleRequirements';
import { SelectRole } from './SelectRole';
import { StepTitle, type StepNumber } from './StepHeader';

/** One page of the public 4-step onboarding flow (`/register/[step]`). */
export function OnboardingStep({ step }: { step: StepNumber }) {
  const router = useRouter();
  const sp = useSearchParams();
  const roleParam = sp.get('role');
  const role = isRegistrableRole(roleParam) ? roleParam : null;
  const appId = sp.get('app');
  const [section, setSection] = useState<SectionKey>('personal');

  // Steps 2 and 3 need a valid role in the URL.
  useEffect(() => {
    if ((step === 2 || step === 3) && !role) router.replace('/register/1');
  }, [step, role, router]);

  // Step 4 shares its status query with AccessSummary (React Query de-duplicates), to know whether registration is approved.
  const status = useRegistrationStatus(step === 4 ? appId : null);

  if (step === 1) {
    return (
      <OnboardingFrame step={1} sidebar={<OnboardingSidebar step={1} />}>
        <StepTitle icon={UserRoundCheck} title="Select Role" subtitle="Choose the role you will perform in the Certification & Issuance process." />
        <SelectRole />
      </OnboardingFrame>
    );
  }
  if (step === 2) {
    if (!role) return null;
    return (
      <OnboardingFrame step={2} sidebar={<OnboardingSidebar step={2} role={role} onSelectRole={(r) => router.replace(`/register/2?role=${r}`)} />}>
        <StepTitle icon={ClipboardCheck} title="Role Review & Requirements" subtitle="Review the role description, requirements, authorisation and records before proceeding." />
        <RoleRequirements key={role} role={role} />
      </OnboardingFrame>
    );
  }
  if (step === 3) {
    if (!role) return null;
    return (
      <OnboardingFrame step={3} sidebar={<OnboardingSidebar step={3} section={section} />}>
        <StepTitle
          icon={ClipboardList}
          title="Register & Authorisation"
          subtitle="Complete your profile, provide competency and authorisation information, upload control documents and submit for approval."
        />
        <RegistrationForm key={role} role={role} onSectionChange={setSection} />
      </OnboardingFrame>
    );
  }
  return (
    <OnboardingFrame step={4} allDone={status.data?.status === 'APPROVED'} sidebar={<OnboardingSidebar step={4} approved={status.data?.status === 'APPROVED'} />}>
      <StepTitle
        icon={Monitor}
        title="Access to Dashboard"
        subtitle="Your role registration and authorisation are verified here. Once approved you can open your dashboard."
      />
      <AccessSummary appId={appId} onBack={() => (status.data ? router.push(`/register/3?role=${status.data.role}`) : router.push('/register/1'))} />
    </OnboardingFrame>
  );
}
