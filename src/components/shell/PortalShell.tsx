'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/api-client/hooks';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

/**
 * Portal frame (header + navy sidebar + content). The root proxy already keeps signed-out
 * users and foreign roles out (ruling R5); this only handles a session that ends mid-visit.
 */
export function PortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace('/login');
  }, [isPending, session, router]);

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground" role="status">
        Loading portal…
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Header session={session} />
      <div className="flex">
        <Sidebar role={session.role} />
        <main className="min-w-0 flex-1 px-6 py-5">{children}</main>
      </div>
    </div>
  );
}
