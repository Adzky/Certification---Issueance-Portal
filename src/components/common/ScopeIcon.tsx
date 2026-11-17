import { BadgeCheck, ClipboardCheck, Package, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { DocumentType } from '@/domain/types';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  'Management System': ShieldCheck,
  'Product Certification': Package,
  Inspection: ClipboardCheck,
};

/** Small blue outline icon for a service scope (by category, falling back to the document type). */
export function ScopeIcon({ category, documentType, className }: { category?: string; documentType?: DocumentType; className?: string }) {
  const Icon = (category && ICONS[category]) || (documentType === 'INSPECTION_REPORT' ? ClipboardCheck : BadgeCheck);
  return <Icon className={cn('size-5 shrink-0 text-primary', className)} strokeWidth={1.7} aria-hidden />;
}
