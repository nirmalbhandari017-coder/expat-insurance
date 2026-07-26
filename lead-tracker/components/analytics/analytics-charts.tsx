"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from "recharts";

const AXIS = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";

export function FunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="stage" stroke={AXIS} fontSize={11} width={110} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyTrend({ data }: { data: { month: string; total: number; converted: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={28} />
        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#gTotal)" strokeWidth={2} name="Total leads" />
        <Area type="monotone" dataKey="converted" stroke="hsl(var(--status-open))" fill="transparent" strokeWidth={2} name="Converted" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
