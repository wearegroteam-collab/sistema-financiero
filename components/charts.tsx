"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { expenseCategories } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { ExpenseCategoryKey } from "@/lib/types";

export function SalesChart({
  data,
  currency,
}: {
  data: { date: string; total: number }[];
  currency: string;
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#178047" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#178047" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e7edf2" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${Number(value) / 1000000}M`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
          <Area type="monotone" dataKey="total" stroke="#178047" strokeWidth={2} fill="url(#salesGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({
  percentages,
}: {
  percentages: Record<ExpenseCategoryKey | "available", number>;
}) {
  const data = [
    ...expenseCategories.map((category) => ({
      name: category.label,
      value: percentages[category.key],
      color: category.color,
    })),
    { name: "Disponible", value: percentages.available, color: "#178047" },
  ].filter((item) => item.value > 0);

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={3}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
