/**
 * Typed REST client — the UI's only way to reach the backend (see docs/api/openapi.yaml).
 * Depends on contract types only, never on server code, so the backend can be swapped.
 */
import type {
  ApiErrorCode,
  AuditEntry,
  AuditListQuery,
  CertificateDetail,
  CertificateListQuery,
  CertificatePage,
  CreateRequestBody,
  DashboardData,
  DecisionBody,
  DocumentDetail,
  DocumentListQuery,
  DocumentPage,
  ListQuery,
  LoginBody,
  LoginOption,
  MarkNotificationsReadBody,
  NotificationList,
  Page,
  PermissionsMatrix,
  PublicCertificate,
  PublicScope,
  ReferenceData,
  RegistrationDetail,
  RegistrationListQuery,
  RegistrationPayload,
  RegistrationStatusInfo,
  RegistrationSubmitted,
  RegistrationSummary,
  RequestDetail,
  RequestPage,
  ReturnBody,
  SessionInfo,
  SignResult,
  UpdateAssignmentBody,
  UserSummary,
  VerifyBody,
} from '@/contract/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function toQueryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

const seg = (v: string) => encodeURIComponent(v);

async function call<T>(method: string, path: string, opts: { query?: Query; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}${toQueryString(opts.query)}`, { method, headers, body, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'INTERNAL', 'Network error: the server could not be reached');
  }
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: ApiErrorCode; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

const get = <T>(path: string, query?: Query) => call<T>('GET', path, { query });
const post = <T>(path: string, body?: unknown) => call<T>('POST', path, { body: body ?? {} });
const patch = <T>(path: string, body: unknown) => call<T>('PATCH', path, { body });

/** Files for the seven control-document slots, in slot order (index 0 = slot 1). */
export type RegistrationFiles = readonly (Blob | File)[];

export const api = {
  loginOptions: () => get<LoginOption[]>('/api/login-options'),
  session: {
    get: () => get<SessionInfo>('/api/session'),
    login: (body: LoginBody) => post<SessionInfo>('/api/session', body),
    logout: () => call<{ ok: true }>('DELETE', '/api/session'),
  },
  reference: () => get<ReferenceData>('/api/reference'),
  publicScopes: () => get<PublicScope[]>('/api/public/scopes'),
  permissions: () => get<PermissionsMatrix>('/api/permissions'),
  requests: {
    list: (q: ListQuery = {}) => get<RequestPage>('/api/requests', q as Query),
    get: (id: string) => get<RequestDetail>(`/api/requests/${seg(id)}`),
    create: (body: CreateRequestBody) => post<RequestDetail>('/api/requests', body),
    prepareDocument: (id: string) => post<DocumentDetail>(`/api/requests/${seg(id)}/documents`),
  },
  documents: {
    list: (q: DocumentListQuery = {}) => get<DocumentPage>('/api/documents', q as Query),
    get: (id: string) => get<DocumentDetail>(`/api/documents/${seg(id)}`),
    updateFields: (id: string, fields: Record<string, string>) =>
      patch<DocumentDetail>(`/api/documents/${seg(id)}`, { fields }),
    submit: (id: string) => post<DocumentDetail>(`/api/documents/${seg(id)}/submit`),
    verify: (id: string, body: VerifyBody) => post<DocumentDetail>(`/api/documents/${seg(id)}/verify`, body),
    return: (id: string, body: ReturnBody) => post<DocumentDetail>(`/api/documents/${seg(id)}/return`, body),
    sign: (id: string) => post<SignResult>(`/api/documents/${seg(id)}/sign`),
    reject: (id: string, reason: string) => post<DocumentDetail>(`/api/documents/${seg(id)}/reject`, { reason }),
  },
  certificates: {
    list: (q: CertificateListQuery = {}) => get<CertificatePage>('/api/certificates', q as Query),
    get: (id: string) => get<CertificateDetail>(`/api/certificates/${seg(id)}`),
    pdfUrl: (id: string) => `${API_BASE_URL}/api/certificates/${seg(id)}/pdf`,
    suspend: (id: string, reason: string) => post<CertificateDetail>(`/api/certificates/${seg(id)}/suspend`, { reason }),
    reinstate: (id: string) => post<CertificateDetail>(`/api/certificates/${seg(id)}/reinstate`),
    revoke: (id: string, reason: string) => post<CertificateDetail>(`/api/certificates/${seg(id)}/revoke`, { reason }),
    verifyPublic: (number: string) => get<PublicCertificate>(`/api/public/certificates/${seg(number)}`),
  },
  registrations: {
    /** multipart: `payload` (JSON) + `file1`..`file7`. */
    submit: (payload: RegistrationPayload, files: RegistrationFiles) => {
      const form = new FormData();
      form.set('payload', JSON.stringify(payload));
      files.forEach((file, i) => {
        if (file) form.set(`file${i + 1}`, file, 'name' in file ? file.name : `document-${i + 1}.pdf`);
      });
      return call<RegistrationSubmitted>('POST', '/api/registrations', { form });
    },
    list: (q: RegistrationListQuery = {}) => get<RegistrationSummary[]>('/api/registrations', q as Query),
    get: (id: string) => get<RegistrationDetail>(`/api/registrations/${seg(id)}`),
    /** Inline PDF of one control document (slot 1..7), for links and iframes. */
    fileUrl: (id: string, slot: number) => `${API_BASE_URL}/api/registrations/${seg(id)}/files/${slot}`,
    decide: (id: string, body: DecisionBody) => post<RegistrationDetail>(`/api/registrations/${seg(id)}/decision`, body),
    status: (id: string) => get<RegistrationStatusInfo>(`/api/public/registrations/${seg(id)}/status`),
  },
  users: {
    list: () => get<UserSummary[]>('/api/users'),
    updateAssignment: (assignmentId: string, body: UpdateAssignmentBody) =>
      patch<UserSummary>(`/api/role-assignments/${seg(assignmentId)}`, body),
  },
  dashboard: (periodDays?: number) => get<DashboardData>('/api/dashboard', periodDays ? { periodDays } : {}),
  audit: (q: AuditListQuery = {}) => get<Page<AuditEntry>>('/api/audit', q as Query),
  notifications: {
    list: () => get<NotificationList>('/api/notifications'),
    markRead: (body: MarkNotificationsReadBody = {}) => post<NotificationList>('/api/notifications/read', body),
  },
};

export type Api = typeof api;
