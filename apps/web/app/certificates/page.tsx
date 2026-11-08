"use client";

import React from "react";
import Link from "next/link";
import { useGetCertificatesQuery } from "../../store/apiSlice";

export default function CertificatesPage() {
  const { data, isLoading, isError } = useGetCertificatesQuery();
  const certs = data?.certificates ?? [];
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-ink">Certificates</h1>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Log in to see your certificates.</p>}
      {!isLoading && !isError && certs.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-space-lg text-center">
          <span className="material-symbols-outlined text-[40px] text-ink-muted">workspace_premium</span>
          <p className="text-ink-secondary">Finish every lesson and pass the required quizzes in a course to earn a certificate.</p>
        </div>
      )}
      <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
        {certs.map((c) => (
          <li key={c.id}>
            <Link href={`/certificates/${c.id}`} className="block bg-card rounded-xl border border-border p-space-md hover:border-primary min-h-11">
              <span className="material-symbols-outlined text-primary">verified</span>
              <p className="font-label-md text-label-md font-semibold text-ink">{c.courseTitle}</p>
              <p className="font-caption text-caption text-ink-secondary">Issued {new Date(c.issuedAt).toLocaleDateString()}</p>
              <p className="font-mono text-xs mt-1">{c.code}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
