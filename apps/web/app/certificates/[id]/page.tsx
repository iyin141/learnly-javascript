"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CertificateView } from "../../../components/CertificateView";
import { useGetCertificateQuery, useLazyGetCertificateDownloadQuery } from "../../../store/apiSlice";

export default function CertificatePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetCertificateQuery(id);
  const [download, { isFetching }] = useLazyGetCertificateDownloadQuery();
  const [copied, setCopied] = useState(false);
  const cert = data?.certificate;

  if (isLoading) return <div className="p-margin"><div className="h-96 rounded-xl bg-border animate-pulse" /></div>;
  if (isError || !cert) return <div className="p-margin"><p role="alert">Certificate not found.</p></div>;

  const verifyUrl = `${window.location.origin}/verify/${cert.code}`;
  const onDownload = async () => {
    const r = await download(id);
    if (r.data?.url) window.open(r.data.url, "_blank", "noopener");
  };
  const btn = "min-h-11 px-space-md rounded-full bg-card border border-border inline-flex items-center gap-space-xs font-label-md text-label-md hover:border-primary";
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-lg">
      <nav className="font-caption text-caption text-ink-secondary"><Link href="/certificates" className="hover:text-primary">Certificates</Link> / {cert.courseTitle}</nav>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-ink">Course Completion & Verified Credential</h1>
          <p className="text-ink-secondary">Issued upon completion of all lessons and required assessments.</p>
        </div>
        <div className="flex flex-wrap gap-space-sm">
          <button className={btn} onClick={async () => { await navigator.clipboard.writeText(verifyUrl); setCopied(true); }}>
            <span className="material-symbols-outlined text-[18px]">link</span>{copied ? "Copied" : "Copy Link"}
          </button>
          <button onClick={onDownload} disabled={isFetching} className="min-h-11 px-space-md rounded-full bg-primary text-white inline-flex items-center gap-space-xs font-label-md">
            <span className="material-symbols-outlined text-[18px]">download</span>{isFetching ? "Preparing..." : "Download PDF"}
          </button>
        </div>
      </div>
      <CertificateView cert={cert} />
      <section className="bg-card rounded-xl border border-border p-space-lg grid gap-space-md md:grid-cols-3">
        <div><p className="font-caption text-ink-secondary uppercase">Issued to</p><p className="font-label-md font-semibold">{cert.studentName}</p></div>
        <div><p className="font-caption text-ink-secondary uppercase">Issue date</p><p className="font-label-md font-semibold">{new Date(cert.issuedAt).toLocaleDateString(undefined, { dateStyle: "long" })}</p></div>
        <div><p className="font-caption text-ink-secondary uppercase">Public verification</p><Link className="text-primary underline break-all" href={`/verify/${cert.code}`}>{verifyUrl}</Link></div>
      </section>
    </div>
  );
}
