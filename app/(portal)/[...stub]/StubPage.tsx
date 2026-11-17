'use client';

import { useSession } from '@/api-client/hooks';
import { PageHeader } from '@/components/common/PageHeader';
import { StubPanel } from '@/components/common/StubPanel';
import { findNavItem } from '@/domain/nav';

/** Title comes from the signed-in role's nav (e.g. "Templates" vs "Template Management"). */
export function StubPage({ pathname }: { pathname: string }) {
  const { data: session } = useSession();
  if (!session) return null;
  const item = findNavItem(session.role, pathname);
  if (!item) return null;
  return (
    <div className="space-y-5">
      <PageHeader icon={item.icon} title={item.label} subtitle="Part of the full JMU Certification & Issuance Portal." />
      <StubPanel title={item.label} />
    </div>
  );
}
