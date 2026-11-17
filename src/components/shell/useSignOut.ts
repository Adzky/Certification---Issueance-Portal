'use client';

import { useRouter } from 'next/navigation';
import { useLogout } from '@/api-client/hooks';

/** Logs out and goes to the role picker (used by "Switch Role" and "Sign out"). */
export function useSignOut(): () => void {
  const router = useRouter();
  const logout = useLogout();
  return () =>
    logout.mutate(undefined, {
      onSettled: () => router.replace('/login'),
    });
}
