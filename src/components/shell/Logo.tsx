import { cn } from '@/lib/utils';

/** Original JMU shield mark (same artwork as public/brand/logo.svg and app/icon.svg). */
export function ShieldMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 48" className={className} aria-hidden>
      <path d="M22 0 2 7.4v14.6C2 34.6 10.6 44 22 47c11.4-3 20-12.4 20-25V7.4L22 0Z" fill="#0b1f4d" />
      <path d="M22 5.2 7 10.8v11.2c0 9.7 6.3 17.2 15 19.9 8.7-2.7 15-10.2 15-19.9V10.8L22 5.2Z" fill="#1d4ed8" />
      <path d="M22 5.2v36.7c8.7-2.7 15-10.2 15-19.9V10.8L22 5.2Z" fill="#3b82f6" />
      <path d="m14 23.5 5.6 5.6L30.5 18" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Shield + "JMU SERTIFIKASI" wordmark + subline. `tone="light"` for dark backgrounds. */
export function Logo({ tone = 'dark', subline = 'Certification & Issuance Portal', className }: { tone?: 'dark' | 'light'; subline?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <ShieldMark className={cn('h-10 w-auto shrink-0', tone === 'light' && 'drop-shadow-[0_0_6px_rgb(59_130_246/0.6)]')} />
      <span className="leading-none">
        <span className={cn('block text-[17px] font-extrabold tracking-wide', tone === 'light' ? 'text-white' : 'text-navy')}>
          JMU SERTIFIKASI
        </span>
        <span className={cn('mt-1 block text-[11px] font-medium', tone === 'light' ? 'text-navy-foreground' : 'text-slate-600')}>
          {subline}
        </span>
      </span>
    </span>
  );
}
