'use client';

import { ChevronDown, ClipboardList, FilePen, FileText, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCan, useRequest, useWorkflowAction } from '@/api-client/hooks';
import type { DocumentDetail, DocumentSummary, RequestDetail } from '@/contract/types';
import { DetailList, DetailPanel } from '@/components/common/DetailPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { toastError } from '@/components/common/notify';
import { StatusPill } from '@/components/common/StatusPill';
import { WorkflowStepper } from '@/components/common/WorkflowStepper';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDate, formatDateTime, timeAgo } from '@/lib/format';
import { NEXT_ACTION, requestSteps } from './workflow';

const EDITABLE: DocumentSummary['status'][] = ['IN_PROGRESS', 'REVISION'];

const cardClass = 'rounded-xl border bg-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]';

/** Right-hand request detail: Overview / Documents / Workflow / History + the next-step buttons. */
export function RequestDetailPanel({ requestId }: { requestId: string | null }) {
  const { data: request, isPending, error } = useRequest(requestId);

  if (!requestId) {
    return (
      <div className={cardClass}>
        <EmptyState icon={ClipboardList} title="Select a request" description="Choose a row in the table to see its details, workflow and next action." />
      </div>
    );
  }
  if (isPending) return <div className={`${cardClass} p-8 text-center text-sm text-muted-foreground`}>Loading…</div>;
  if (error || !request) {
    return (
      <div className={cardClass}>
        <EmptyState icon={ClipboardList} title="Request not found" description="It may have been removed or is outside your service scopes." />
      </div>
    );
  }
  return <RequestPanelBody request={request} />;
}

function RequestPanelBody({ request }: { request: RequestDetail }) {
  const router = useRouter();
  const can = useCan();
  const workflow = useWorkflowAction();

  const liveDraft = request.documents.find((d) => d.status !== 'REJECTED');
  const canPrepare =
    can('document.prepare') && (request.status === 'SUBMITTED' || (request.status === 'IN_PREPARATION' && !liveDraft));
  const draftEditable = !!liveDraft && EDITABLE.includes(liveDraft.status) && can('document.edit');
  const draftHref = liveDraft ? (draftEditable ? `/drafts/${liveDraft.id}/edit` : `/drafts?select=${liveDraft.id}`) : null;

  const prepare = async () => {
    try {
      const doc = (await workflow.mutateAsync({ kind: 'prepare', id: request.id })) as DocumentDetail;
      toast.success('Draft prepared');
      router.push(`/drafts/${doc.id}/edit`);
    } catch (e) {
      toastError(e);
    }
  };

  const stepper = <WorkflowStepper steps={requestSteps(request.status, request.createdAt, request.issuedAt)} />;

  const overview = (
    <div className="space-y-4">
      <DetailList
        items={[
          { label: 'Client', value: request.clientName },
          { label: 'Service Scope', value: `${request.scopeName} (${request.schemeLabel})` },
          { label: 'Object / Scope', value: request.objectScope },
          { label: 'Request Date', value: formatDateTime(request.createdAt) },
          { label: 'Priority', value: <StatusPill status={request.priority} kind="priority" /> },
          { label: 'Current Status', value: <StatusPill status={request.status} kind="request" /> },
          { label: 'Next Action', value: NEXT_ACTION[request.status] },
          { label: 'Assigned To', value: request.assigneeName ?? '—' },
        ]}
      />
      <div className="rounded-lg border p-3">
        <h3 className="mb-3 text-sm font-bold">Workflow Progress</h3>
        {stepper}
      </div>
    </div>
  );

  const documents = request.documents.length ? (
    <ul className="divide-y text-sm">
      {request.documents.map((d) => (
        <li key={d.id} className="flex items-center gap-3 py-2.5">
          <FileText className="size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <Link href={`/drafts?select=${d.id}`} className="font-semibold text-primary underline-offset-2 hover:underline">
              {d.number}
            </Link>
            <p className="text-xs text-muted-foreground">
              {d.version} · updated {timeAgo(d.updatedAt)} by {d.preparedByName}
            </p>
          </div>
          <StatusPill status={d.status} kind="document" />
        </li>
      ))}
    </ul>
  ) : (
    <p className="py-6 text-center text-sm text-muted-foreground">No draft has been prepared yet.</p>
  );

  const workflowTab = (
    <div className="space-y-4">
      {stepper}
      <DetailList
        items={[
          { label: 'Due Date', value: formatDate(request.dueDate) },
          { label: 'Next Action', value: NEXT_ACTION[request.status] },
          ...(request.certificate ? [{ label: 'Certificate', value: request.certificate.number }] : []),
        ]}
      />
    </div>
  );

  const history = request.timeline.length ? (
    <ol className="space-y-3 text-sm">
      {request.timeline.map((t) => (
        <li key={t.id} className="border-l-2 border-primary/30 pl-3">
          <p className="font-medium">{t.comment ?? t.action}</p>
          <p className="text-xs text-muted-foreground">
            {t.actorName ?? 'System'} · {formatDateTime(t.at)}
          </p>
        </li>
      ))}
    </ol>
  ) : (
    <p className="py-6 text-center text-sm text-muted-foreground">No history yet.</p>
  );

  const actions = (
    <>
      {canPrepare && (
        <Button onClick={prepare} disabled={workflow.isPending} className="gap-2">
          <FilePen /> Prepare Document
        </Button>
      )}
      {!canPrepare && draftHref && (
        <Button asChild className="gap-2">
          <Link href={draftHref}>
            <FilePen /> Open Draft
          </Link>
        </Button>
      )}
      {can('document.prepare') && request.status !== 'ISSUED' && request.status !== 'READY_FOR_SIGNING' && (
        <Button
          variant="outline"
          className="gap-2 text-primary"
          onClick={() => toast.info('Requesting revisions from the client is not available in this demo')}
        >
          <RotateCcw /> Request Revision
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1 text-primary">
            More <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              void navigator.clipboard?.writeText(request.number);
              toast.success('Request number copied');
            }}
          >
            Copy request number
          </DropdownMenuItem>
          {liveDraft && (
            <DropdownMenuItem onSelect={() => router.push(`/drafts?select=${liveDraft.id}`)}>View in Draft Documents</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <DetailPanel
      title="Request Detail"
      badge={request.number}
      tabs={[
        { key: 'overview', label: 'Overview', content: overview },
        { key: 'documents', label: 'Documents', content: documents },
        { key: 'workflow', label: 'Workflow', content: workflowTab },
        { key: 'history', label: 'History', content: history },
      ]}
      actions={actions}
    />
  );
}
