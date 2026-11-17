'use client';

import { LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { useDashboard, useSession } from '@/api-client/hooks';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { ManagerDashboard, PeriodSelector, type PeriodDays } from '@/components/dashboards/ManagerDashboard';
import { OfficerDashboard } from '@/components/dashboards/OfficerDashboard';
import { SignatoryDashboard } from '@/components/dashboards/SignatoryDashboard';
import { DashboardSkeleton } from '@/components/dashboards/shared';
import { VerifierDashboard } from '@/components/dashboards/VerifierDashboard';
import { Button } from '@/components/ui/button';
import { ROLE_META } from '@/lib/roles';

function RoleDashboard() {
  const { data, isError, refetch } = useDashboard();
  if (isError)
    return (
      <EmptyState
        title="Dashboard could not be loaded"
        description="Something went wrong while loading your dashboard."
        action={<Button onClick={() => void refetch()}>Try again</Button>}
      />
    );
  if (!data) return <DashboardSkeleton />;
  switch (data.role) {
    case 'ISSUANCE_OFFICER':
      return <OfficerDashboard data={data} />;
    case 'DOCUMENT_VERIFIER':
      return <VerifierDashboard data={data} />;
    case 'AUTHORISED_SIGNATORY':
      return <SignatoryDashboard data={data} />;
    case 'SYSTEM_ADMIN':
      return <AdminDashboard data={data} />;
    default:
      return null;
  }
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);
  if (!session) return null;
  const meta = ROLE_META[session.role];
  const isManager = session.role === 'ISSUANCE_MANAGER';
  return (
    <div className="space-y-5">
      <PageHeader
        icon={LayoutDashboard}
        title={`Dashboard – ${meta.label}`}
        subtitle={meta.dashboardSubtitle}
        actions={isManager ? <PeriodSelector value={periodDays} onChange={setPeriodDays} /> : undefined}
      />
      {isManager ? <ManagerDashboard periodDays={periodDays} /> : <RoleDashboard />}
    </div>
  );
}
