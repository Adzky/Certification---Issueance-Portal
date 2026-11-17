'use client';

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardData } from '@/contract/types';

/** Weekly certificates issued (bars) against requests created (line). */
export function TrendChart({ data }: { data: NonNullable<DashboardData['trend']> }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Certificates issued and requests created per week">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="#e5e9f2" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 12, fill: '#475569' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#475569' }} />
          <Tooltip cursor={{ fill: 'rgb(29 78 216 / 0.06)' }} />
          <Legend verticalAlign="bottom" height={28} iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="issued" name="Issued" fill="var(--tone-blue)" radius={[3, 3, 0, 0]} maxBarSize={44} />
          <Line
            dataKey="requested"
            name="Requested"
            type="monotone"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
