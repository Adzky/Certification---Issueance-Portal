import type { Metadata } from 'next';
import { RolePicker } from '@/components/login/RolePicker';
import { Logo } from '@/components/shell/Logo';

export const metadata: Metadata = { title: 'Sign in – JMU Certification & Issuance Portal' };

/** Original decorative illustration: a certificate card with a seal (no reference artwork reused). */
function CertificateArt() {
  return (
    <svg viewBox="0 0 320 240" className="h-auto w-full max-w-sm" aria-hidden>
      <defs>
        <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#93c5fd" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="seal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <g transform="rotate(-8 160 120)">
        <rect x="50" y="30" width="200" height="150" rx="14" fill="url(#card)" stroke="#bfdbfe" strokeOpacity="0.6" />
        <rect x="72" y="52" width="70" height="8" rx="4" fill="#dbeafe" fillOpacity="0.85" />
        <rect x="72" y="72" width="156" height="6" rx="3" fill="#dbeafe" fillOpacity="0.5" />
        <rect x="72" y="88" width="140" height="6" rx="3" fill="#dbeafe" fillOpacity="0.5" />
        <rect x="72" y="104" width="120" height="6" rx="3" fill="#dbeafe" fillOpacity="0.5" />
        <path d="M76 150c10-14 18 6 28-6s16 4 26-4" fill="none" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" />
        <path d="m206 152-10 34 14-8 10 12 4-34z" fill="#1d4ed8" />
        <path d="m222 152 10 34-14-8-10 12-4-34z" fill="#2563eb" />
        <circle cx="214" cy="146" r="22" fill="url(#seal)" stroke="#fef3c7" strokeWidth="3" />
        <path d="m205 146 6 6 12-13" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_left,#1e40af_0%,#0b1f4d_55%,#071433_100%)] px-8 py-10 text-white sm:px-12">
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-blue-500/20 blur-3xl" aria-hidden />
        <Logo tone="light" subline="Digital Trust & Assurance Platform" />
        <div className="relative my-auto max-w-lg py-12">
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            Certification &amp; Issuance Portal
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-navy-foreground">
            Choose your role to access the system for issuing certificates and inspection reports.
          </p>
          <div className="mt-10 hidden lg:block">
            <CertificateArt />
          </div>
        </div>
        <p className="relative text-xs text-navy-foreground/70">Demo environment · sample data only</p>
      </section>
      <section className="flex items-center justify-center bg-[linear-gradient(160deg,#eef3fb,#dfe8f7)] px-4 py-10 sm:px-8">
        <RolePicker />
      </section>
    </main>
  );
}
