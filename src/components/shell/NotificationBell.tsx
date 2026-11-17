'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMarkNotificationsRead, useNotifications } from '@/api-client/hooks';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Header bell: unread badge, dropdown of recent notifications, "Mark all read". */
export function NotificationBell() {
  const router = useRouter();
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="relative rounded-full"
          aria-label={`Notifications (${unread} unread)`}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-tone-red px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">Notifications</DropdownMenuLabel>
          <DropdownMenuItem
            className="h-auto w-auto gap-1 p-0 text-xs font-medium text-primary focus:bg-transparent focus:underline"
            disabled={unread === 0 || markRead.isPending}
            onSelect={(e) => {
              e.preventDefault();
              markRead.mutate({});
            }}
          >
            <CheckCheck /> Mark all read
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="items-start gap-2.5 rounded-none px-3 py-2"
                onSelect={() => {
                  if (!n.read) markRead.mutate({ ids: [n.id] });
                  if (n.link) router.push(n.link);
                }}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')}>
                  {!n.read && <span className="sr-only">Unread</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13px] leading-snug whitespace-normal', !n.read && 'font-medium')}>
                    {n.message}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
