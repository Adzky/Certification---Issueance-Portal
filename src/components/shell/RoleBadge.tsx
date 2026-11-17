import type { Role } from '@/domain/types';
import { ROLE_META, ROLE_PILL_CLASSES } from '@/lib/roles';
import { cn } from '@/lib/utils';

/** Solid header pill "Role: Issuance Officer", coloured per role. */
export interface RoleBadgeProps {
  role: Role;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap shadow-sm',
        ROLE_PILL_CLASSES[meta.tone],
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      Role: {meta.label}
    </span>
  );
}
