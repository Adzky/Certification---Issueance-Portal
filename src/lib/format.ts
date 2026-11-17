/** Display formatting shared by the UI (English, Indonesian time zone not assumed: local time). */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  const days = Math.floor(diff / DAY);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return formatDate(iso);
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** `16 Oct 2026` */
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
/** `16 Oct 2026, 09:24` */
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

/** Two-letter initials for avatars: "Andi Pratama" → "AP". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
