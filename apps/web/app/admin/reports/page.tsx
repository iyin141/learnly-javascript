"use client";

import React from "react";
import { useGetAdminReportsQuery } from "../../../store/apiSlice";

const labels: Record<string, string> = {
  users: "Users",
  publishedCourses: "Published courses",
  enrolments: "Enrolments",
  certificates: "Certificates issued",
  quizAttempts: "Quiz attempts",
  revenueCents: "Revenue (USD, mock provider)",
};

export default function AdminReports() {
  const { data, isLoading, isError } = useGetAdminReportsQuery();
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-md">
      <h1 className="font-headline-lg text-headline-lg">Reports</h1>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Could not load reports. Admin access is required.</p>}
      <dl className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(data ?? {}).map(([k, v]) => (
          <div key={k} className="bg-card rounded-xl border border-border p-space-md">
            <dt className="font-caption text-caption text-ink-secondary">{labels[k] ?? k}</dt>
            <dd className="font-headline-lg text-headline-lg">{k === "revenueCents" ? `$${(v / 100).toFixed(2)}` : v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
