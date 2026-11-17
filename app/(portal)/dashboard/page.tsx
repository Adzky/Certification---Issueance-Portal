'use client';

import { LayoutDashboard } from 'lucide-react';
import { useSession } from '@/api-client/hooks';
import { PageHeader } from '@/components/common/PageHeader';
import { ROLE_META } from '@/lib/roles';

/** Placeholder per role; Task 15 replaces the body with the real dashboards. */
export default function DashboardPage() {
  const { data: session } = useSession();
  if (!session) return null;
  const meta = ROLE_META[session.role];
  return <PageHeader icon={LayoutDashboard} title={`Dashboard – ${meta.label}`} subtitle={meta.dashboardSubtitle} />;
}
