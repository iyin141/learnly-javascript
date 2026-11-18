"use client";

import React from "react";
import { useGetQueueStatsQuery } from "../../../store/apiSlice";

export default function AdminQueues() {
  const { data, isLoading, isError, refetch } = useGetQueueStatsQuery(undefined, { pollingInterval: 10000 });
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-md">
      <div className="flex items-center justify-between">
        <h1 className="font-headline-lg text-headline-lg">Job queues</h1>
        <button type="button" onClick={() => void refetch()} className="min-h-11 px-space-md rounded-full border border-border">Refresh</button>
      </div>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Could not load queue stats. Admin access is required.</p>}
      <div className="grid gap-gutter sm:grid-cols-2">
        {Object.entries(data?.stats ?? {}).map(([name, counts]) => (
          <section key={name} className="bg-card rounded-xl border border-border p-space-md">
            <h2 className="font-label-md font-semibold capitalize mb-space-xs">{name}</h2>
            <dl className="grid grid-cols-3 gap-space-sm text-sm">
              {Object.entries(counts).map(([k, v]) => (
                <div key={k}><dt className="text-ink-secondary capitalize">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
