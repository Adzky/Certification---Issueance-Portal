'use client';

/** React Query hooks over the typed REST client. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuditListQuery,
  CertificateDetail,
  CertificateListQuery,
  DocumentDetail,
  DocumentListQuery,
  ListQuery,
  RegistrationListQuery,
  ReturnBody,
  SignResult,
  VerifyBody,
} from '@/contract/types';
import { api, ApiError } from './client';

export const queryKeys = {
  session: ['session'] as const,
  loginOptions: ['loginOptions'] as const,
  reference: ['reference'] as const,
  permissions: ['permissions'] as const,
  requests: (q?: ListQuery) => (q ? (['requests', q] as const) : (['requests'] as const)),
  request: (id: string) => ['requests', 'detail', id] as const,
  documents: (q?: DocumentListQuery) => (q ? (['documents', q] as const) : (['documents'] as const)),
  document: (id: string) => ['documents', 'detail', id] as const,
  certificates: (q?: CertificateListQuery) => (q ? (['certificates', q] as const) : (['certificates'] as const)),
  certificate: (id: string) => ['certificates', 'detail', id] as const,
  registrations: (q?: RegistrationListQuery) => (q ? (['registrations', q] as const) : (['registrations'] as const)),
  users: ['users'] as const,
  dashboard: ['dashboard'] as const,
  audit: (q?: AuditListQuery) => (q ? (['audit', q] as const) : (['audit'] as const)),
  notifications: ['notifications'] as const,
};

/** Signed-out is a normal state for the session query, not an error: resolves to null. */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => {
      try {
        return await api.session.get();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 30_000,
  });
}

export const useLoginOptions = () => useQuery({ queryKey: queryKeys.loginOptions, queryFn: api.loginOptions });
export const useReference = () =>
  useQuery({ queryKey: queryKeys.reference, queryFn: api.reference, staleTime: 5 * 60_000 });
export const usePermissions = () => useQuery({ queryKey: queryKeys.permissions, queryFn: api.permissions });

export const useRequests = (q: ListQuery = {}) =>
  useQuery({ queryKey: queryKeys.requests(q), queryFn: () => api.requests.list(q) });
export const useRequest = (id: string | null | undefined) =>
  useQuery({ queryKey: queryKeys.request(id ?? ''), queryFn: () => api.requests.get(id!), enabled: !!id });

export const useDocuments = (q: DocumentListQuery = {}) =>
  useQuery({ queryKey: queryKeys.documents(q), queryFn: () => api.documents.list(q) });
export const useDocument = (id: string | null | undefined) =>
  useQuery({ queryKey: queryKeys.document(id ?? ''), queryFn: () => api.documents.get(id!), enabled: !!id });

export const useCertificates = (q: CertificateListQuery = {}) =>
  useQuery({ queryKey: queryKeys.certificates(q), queryFn: () => api.certificates.list(q) });
export const useCertificate = (id: string | null | undefined) =>
  useQuery({ queryKey: queryKeys.certificate(id ?? ''), queryFn: () => api.certificates.get(id!), enabled: !!id });

export const useDashboard = () => useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
export const useAudit = (q: AuditListQuery = {}) => useQuery({ queryKey: queryKeys.audit(q), queryFn: () => api.audit(q) });
export const useNotifications = () =>
  useQuery({ queryKey: queryKeys.notifications, queryFn: api.notifications.list, refetchInterval: 30_000 });
export const useRegistrations = (q: RegistrationListQuery = {}) =>
  useQuery({ queryKey: queryKeys.registrations(q), queryFn: () => api.registrations.list(q) });
export const useUsers = () => useQuery({ queryKey: queryKeys.users, queryFn: api.users.list });

export type WorkflowAction =
  | { kind: 'prepare'; id: string; body?: undefined }
  | { kind: 'submit'; id: string; body?: undefined }
  | { kind: 'verify'; id: string; body: VerifyBody }
  | { kind: 'return'; id: string; body: ReturnBody }
  | { kind: 'sign'; id: string; body?: undefined }
  | { kind: 'reject'; id: string; body: { reason: string } }
  | { kind: 'suspend'; id: string; body: { reason: string } }
  | { kind: 'reinstate'; id: string; body?: undefined }
  | { kind: 'revoke'; id: string; body: { reason: string } };

function runWorkflowAction(a: WorkflowAction): Promise<DocumentDetail | CertificateDetail | SignResult> {
  switch (a.kind) {
    case 'prepare':
      return api.requests.prepareDocument(a.id);
    case 'submit':
      return api.documents.submit(a.id);
    case 'verify':
      return api.documents.verify(a.id, a.body);
    case 'return':
      return api.documents.return(a.id, a.body);
    case 'sign':
      return api.documents.sign(a.id);
    case 'reject':
      return api.documents.reject(a.id, a.body.reason);
    case 'suspend':
      return api.certificates.suspend(a.id, a.body.reason);
    case 'reinstate':
      return api.certificates.reinstate(a.id);
    case 'revoke':
      return api.certificates.revoke(a.id, a.body.reason);
  }
}

const WORKFLOW_INVALIDATES = ['requests', 'documents', 'certificates', 'dashboard', 'notifications', 'audit'] as const;

/** One mutation for every workflow / lifecycle transition; refreshes all affected lists. */
export function useWorkflowAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runWorkflowAction,
    onSettled: () => Promise.all(WORKFLOW_INVALIDATES.map((key) => qc.invalidateQueries({ queryKey: [key] }))),
  });
}
