import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkflowStepState = 'done' | 'current' | 'todo';

/** One stage of the stepper. */
export interface WorkflowStep {
  label: string;
  /** Second line, e.g. a date or "(In Progress)". */
  sub?: string;
  state: WorkflowStepState;
}

/** Horizontal progress through workflow stages (done = green check, current = blue ring, todo = grey). Fits its container. */
export interface WorkflowStepperProps {
  steps: readonly WorkflowStep[];
  className?: string;
}

export function WorkflowStepper({ steps, className }: WorkflowStepperProps) {
  return (
    <ol
      className={cn('grid w-full', className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label="Workflow progress"
    >
      {steps.map((step, i) => (
        <li
          key={`${step.label}-${i}`}
          className="relative flex flex-col items-center px-0.5 text-center"
          aria-current={step.state === 'current' ? 'step' : undefined}
          data-state={step.state}
        >
          {i > 0 && (
            <span
              aria-hidden
              className={cn(
                'absolute top-[11px] right-1/2 h-0.5 w-full',
                step.state === 'todo' ? 'bg-border' : 'bg-tone-green',
              )}
            />
          )}
          <span
            className={cn(
              'relative z-10 flex size-6 items-center justify-center rounded-full',
              step.state === 'done' && 'bg-tone-green text-white',
              step.state === 'current' && 'border-[5px] border-primary bg-white',
              step.state === 'todo' && 'border-2 border-border bg-muted',
            )}
          >
            {step.state === 'done' && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
          </span>
          <span
            className={cn(
              'mt-1.5 text-xs leading-tight font-medium break-words',
              step.state === 'todo' ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {step.label}
          </span>
          {step.sub && <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{step.sub}</span>}
        </li>
      ))}
    </ol>
  );
}
