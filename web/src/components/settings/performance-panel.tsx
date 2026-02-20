"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Metric {
  label: string;
  count: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export function PerformancePanel() {
  const { data } = useSWR<{ metrics: Metric[] }>(
    "/api/performance",
    fetcher,
    { refreshInterval: 5000 }
  );

  const metrics = data?.metrics ?? [];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {metrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No performance data collected yet. Metrics will appear as you use
            MnM.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Avg (ms)</TableHead>
                <TableHead className="text-right">P50 (ms)</TableHead>
                <TableHead className="text-right">P95 (ms)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.label}>
                  <TableCell className="font-mono text-sm">
                    {m.label}
                  </TableCell>
                  <TableCell className="text-right">{m.count}</TableCell>
                  <TableCell className="text-right">{m.avg}</TableCell>
                  <TableCell className="text-right">{m.p50}</TableCell>
                  <TableCell className="text-right">{m.p95}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
