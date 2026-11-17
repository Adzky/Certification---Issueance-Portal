'use client';

import { ChevronDown, LogOut, Repeat } from 'lucide-react';
import type { SessionInfo } from '@/contract/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLE_META } from '@/lib/roles';
import { initials } from '@/lib/format';
import { useSignOut } from './useSignOut';

/** Header user block (avatar, name, role) with "Switch Role" and "Sign out" (both end at /login). */
export function UserMenu({ session }: { session: SessionInfo }) {
  const signOut = useSignOut();
  const { user, role } = session;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${user.name}, ${ROLE_META[role].label}`}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar className="size-9">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback className="bg-navy text-xs font-semibold text-white">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{ROLE_META[role].label}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-semibold text-foreground">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}>
          <Repeat /> Switch Role
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
