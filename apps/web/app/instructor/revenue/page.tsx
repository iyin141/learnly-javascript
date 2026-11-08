"use client";

import React from "react";
import { DataTable } from "../../../components/DataTable";
import { useGetRevenueQuery } from "../../../store/apiSlice";

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function RevenuePage() {
  const { data, isLoading, isError } = useGetRevenueQuery();
  const max = Math.max(1, ...(data?.rows ?? []).map((r) => r.enrolments));
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
              <p className="text-ink-secondary font-caption">Earnings</p>
              <p className="font-headline-lg">{usd(data.totalEarningsCents)}</p>
            </div>
          </div>
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
