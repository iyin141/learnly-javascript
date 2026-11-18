"use client";

import React from "react";
import { DataTable } from "../../../components/DataTable";
import { useGetRevenueQuery } from "../../../store/apiSlice";
import { SeriesChart, type Series } from "../../../components/Chart";

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function RevenuePage() {
  const { data, isLoading, isError } = useGetRevenueQuery();
  const max = Math.max(1, ...(data?.rows ?? []).map((r) => r.enrolments));
  // one point per month: enrolments (bars) and net earnings (line), summed over courses
  const months = React.useMemo(() => {
    const m = new Map<string, { enrolments: number; cents: number }>();
    for (const r of data?.rows ?? []) { const x = m.get(r.month) ?? { enrolments: 0, cents: 0 }; x.enrolments += r.enrolments; x.cents += r.earningsCents; m.set(r.month, x); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);
  const labels = React.useMemo(() => months.map(([k]) => k), [months]);
  const series = React.useMemo<Series[]>(() => [
    { label: "Enrolments", data: months.map(([, v]) => v.enrolments), color: "#2f6fed" },
    { label: "Net earnings (USD)", data: months.map(([, v]) => v.cents / 100), color: "#e8710a", type: "line", yAxis: "y1" },
  ], [months]);
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-md">
      <h1 className="font-headline-lg text-headline-lg">Revenue</h1>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Instructor access required.</p>}
      {data && (
        <>
          <div className="grid gap-gutter sm:grid-cols-2">
            <div className="bg-card rounded-xl border border-border p-space-md">
              <p className="text-ink-secondary font-caption">Enrolments</p>
              <p className="font-headline-lg">{data.totalEnrolments}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-space-md">
              <p className="text-ink-secondary font-caption">Net earnings <span className="text-ink-secondary">(after platform fee)</span></p>
              <p className="font-headline-lg">{usd(data.totalEarningsCents)}</p>
            </div>
          </div>
          {months.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-space-md">
              <SeriesChart labels={labels} series={series} ariaLabel="Enrolments and net earnings per month" />
            </div>
          )}
          <DataTable
            empty="No enrolments or payments yet."
            rows={data.rows}
            columns={[
              { header: "Month", cell: (r) => r.month },
              { header: "Course", cell: (r) => r.course },
              {
                header: "Enrolments",
                cell: (r) => (
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2 rounded bg-primary" style={{ width: `${(r.enrolments / max) * 120}px` }} />
                    {r.enrolments}
                  </span>
                ),
              },
              { header: "Earnings", cell: (r) => usd(r.earningsCents) },
            ]}
          />
        </>
      )}
    </div>
  );
}
