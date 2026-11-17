import { toast } from 'sonner';
import { ApiError } from '@/api-client/client';

/** Error toast; a 409 (stale item / invalid transition) gets the friendly "already updated" text. */
export function toastError(error: unknown): void {
  if (error instanceof ApiError && error.status === 409) {
    toast.error('This item was already updated by someone else', { description: 'The list has been refreshed.' });
    return;
  }
  toast.error(error instanceof Error ? error.message : 'Something went wrong');
}
