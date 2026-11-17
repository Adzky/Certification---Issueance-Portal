import { LogIn } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/shell/Logo';
import { Stepper, type StepNumber } from './StepHeader';

/** Public onboarding page chrome: white top bar, navy guide sidebar, stepper and content area. */
export function OnboardingFrame({
  step,
  sidebar,
  allDone,
  children,
}: {
  step: StepNumber;
  sidebar: ReactNode;
  /** Mark every step as complete (approved registration). */
  allDone?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-white px-4 shadow-[0_1px_3px_rgb(15_23_42/0.06)]">
        <Link href="/login" aria-label="JMU Sertifikasi – sign in">
          <Logo />
        </Link>
        <span className="hidden rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white sm:inline-block">Certification &amp; Issuance Portal</span>
        <Link
          href="/login"
          className="ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
        >
          <LogIn className="size-4" aria-hidden /> Already registered? Sign in
        </Link>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        {sidebar}
        <main className="min-w-0 flex-1 space-y-4 px-4 py-4 lg:px-6">
          <Stepper current={step} allDone={allDone} />
          {children}
        </main>
      </div>
    </div>
  );
}
