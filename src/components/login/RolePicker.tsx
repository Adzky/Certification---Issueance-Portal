'use client';

import { ArrowRight, ChevronRight, Loader2, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useLogin, useLoginOptions } from '@/api-client/hooks';
import type { LoginOption } from '@/contract/types';
import type { Role } from '@/domain/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusPill } from '@/components/common/StatusPill';
import { initials } from '@/lib/format';
import { ROLE_META, ROLE_ORDER } from '@/lib/roles';
import { TONE_CLASSES } from '@/lib/tones';
import { cn } from '@/lib/utils';

type PickerUser = LoginOption['users'][number];

/** Users of a role with the main demo user first. */
function orderUsers(role: Role, users: readonly PickerUser[]): PickerUser[] {
  const demo = ROLE_META[role].demoUser;
  return [...users].sort((a, b) => Number(b.name === demo) - Number(a.name === demo));
}

/** "Choose Your Role" card: five role cards; a role with several users opens a user picker. */
export function RolePicker() {
  const router = useRouter();
  const options = useLoginOptions();
  const login = useLogin();
  const [openRole, setOpenRole] = useState<Role | null>(null);

  const usersOf = (role: Role) => orderUsers(role, options.data?.find((o) => o.role === role)?.users ?? []);

  const signIn = (role: Role, userId: string) =>
    login.mutate(
      { role, userId },
      {
        onSuccess: () => router.replace('/dashboard'),
        onError: (e) => toast.error(e.message),
      },
    );

  const pickRole = (role: Role) => {
    const users = usersOf(role);
    if (users.length === 1) signIn(role, users[0].userId);
    else if (users.length > 1) setOpenRole(role);
  };

  const dialogUsers = openRole ? usersOf(openRole) : [];

  return (
    <div className="w-full max-w-xl rounded-2xl bg-white p-7 shadow-[0_20px_60px_rgb(11_31_77/0.25)] sm:p-8">
      <h2 className="text-2xl font-bold text-navy">Choose Your Role</h2>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to the demo as one of the five portal roles.</p>

      <ul className="mt-6 space-y-3">
        {ROLE_ORDER.map((role) => {
          const m = ROLE_META[role];
          const Icon = m.icon;
          const count = usersOf(role).length;
          return (
            <li key={role}>
              <button
                type="button"
                onClick={() => pickRole(role)}
                disabled={options.isPending || count === 0 || login.isPending}
                className="group flex w-full items-center gap-4 rounded-xl border bg-white px-4 py-3.5 text-left shadow-[0_1px_3px_rgb(15_23_42/0.06)] transition-all hover:-translate-y-px hover:border-primary/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-70"
              >
                <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', TONE_CLASSES[m.tone].tile)}>
                  <Icon className="size-6" strokeWidth={1.9} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-foreground">{m.label}</span>
                  <span className="block text-sm text-muted-foreground">{m.description}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      {options.isError && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Could not load the demo users. Is the server running?
        </p>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to the portal?{' '}
        <Link href="/register/1" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          Register for a role <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </p>

      <Dialog open={openRole !== null} onOpenChange={(o) => !o && setOpenRole(null)}>
        <DialogContent className="sm:max-w-md">
          {openRole && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Sign in as {ROLE_META[openRole].label}</DialogTitle>
                <DialogDescription>Choose a demo user. The highlighted user has the richest sample data.</DialogDescription>
              </DialogHeader>
              <ul className="-mx-1 max-h-[55vh] space-y-1.5 overflow-y-auto px-1 py-0.5">
                {dialogUsers.map((u) => {
                  const isDemo = u.name === ROLE_META[openRole].demoUser;
                  const pending = login.isPending && login.variables?.userId === u.userId;
                  return (
                    <li key={u.userId}>
                      <button
                        type="button"
                        disabled={login.isPending}
                        onClick={() => signIn(openRole, u.userId)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-tone-blue-soft/40 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-70',
                          isDemo && 'border-primary/40 bg-tone-blue-soft/60',
                        )}
                      >
                        <Avatar className="size-9">
                          <AvatarFallback className={cn('text-xs font-semibold', isDemo ? 'bg-primary text-white' : 'bg-muted text-foreground')}>
                            {initials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{u.name}</span>
                          {isDemo && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <Star className="size-3 fill-current" aria-hidden /> Recommended demo user
                            </span>
                          )}
                        </span>
                        {u.status !== 'ACTIVE' && <StatusPill status={u.status} kind="authorisation" />}
                        {pending ? (
                          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
