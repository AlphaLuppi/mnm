import type { ChartBlock as ChartBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const DEFAULT_COLORS = [
  "hsl(var(--primary))",
  "hsl(220 70% 55%)",
  "hsl(150 60% 45%)",
  "hsl(30 80% 55%)",
  "hsl(280 60% 55%)",
];

function getColor(item: { color?: string }, index: number): string {
  return item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

export function ChartBlock({ block }: { block: ChartBlockType; context: BlockContext }) {
  const { chartType, data, title } = block;

  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      <div className="w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart data={data}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          ) : chartType === "bar" ? (
            <BarChart data={data}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value">
                {data.map((item, i) => (
                  <Cell key={i} fill={getColor(item, i)} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Tooltip />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={chartType === "donut" ? 40 : 0}
                label={({ name }) => name}
              >
                {data.map((item, i) => (
                  <Cell key={i} fill={getColor(item, i)} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
