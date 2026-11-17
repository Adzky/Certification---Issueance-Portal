/** Colour tones shared by stat-card icon tiles, status pills and dashboard stats. */
export type Tone = 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'grey';

/** Tailwind classes per tone (tokens defined in app/globals.css). Literal strings so Tailwind sees them. */
export const TONE_CLASSES: Record<Tone, { tile: string; pill: string; dot: string; text: string }> = {
  blue: { tile: 'bg-tone-blue-soft text-tone-blue', pill: 'bg-tone-blue-soft text-tone-blue ring-tone-blue/15', dot: 'bg-tone-blue', text: 'text-tone-blue' },
  amber: { tile: 'bg-tone-amber-soft text-tone-amber', pill: 'bg-tone-amber-soft text-tone-amber ring-tone-amber/15', dot: 'bg-tone-amber', text: 'text-tone-amber' },
  green: { tile: 'bg-tone-green-soft text-tone-green', pill: 'bg-tone-green-soft text-tone-green ring-tone-green/15', dot: 'bg-tone-green', text: 'text-tone-green' },
  red: { tile: 'bg-tone-red-soft text-tone-red', pill: 'bg-tone-red-soft text-tone-red ring-tone-red/15', dot: 'bg-tone-red', text: 'text-tone-red' },
  purple: { tile: 'bg-tone-purple-soft text-tone-purple', pill: 'bg-tone-purple-soft text-tone-purple ring-tone-purple/15', dot: 'bg-tone-purple', text: 'text-tone-purple' },
  grey: { tile: 'bg-tone-grey-soft text-tone-grey', pill: 'bg-tone-grey-soft text-tone-grey ring-tone-grey/15', dot: 'bg-tone-grey', text: 'text-tone-grey' },
};
