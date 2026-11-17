import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import type { StepNumber } from '@/components/onboarding/StepHeader';

export const metadata: Metadata = { title: 'Register – JMU Certification & Issuance Portal' };

export default async function RegisterPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!/^[1-4]$/.test(step)) notFound();
  return (
    <Suspense>
      <OnboardingStep step={Number(step) as StepNumber} />
    </Suspense>
  );
}
