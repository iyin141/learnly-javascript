"use client";

import React from "react";
import { useParams } from "next/navigation";
import { CertificateView } from "../../../components/CertificateView";
import { useVerifyCertificateQuery } from "../../../store/apiSlice";

export default function VerifyPage() {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, isError } = useVerifyCertificateQuery(code);
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-lg max-w-4xl mx-auto">
      {isLoading && <div className="h-96 rounded-xl bg-border animate-pulse" />}
      {isError && (
        <div role="alert" className="bg-card rounded-xl border border-danger p-space-lg text-center">
          <span className="material-symbols-outlined text-danger text-[40px]">gpp_bad</span>
          <h1 className="font-headline-lg">No credential matches {code}</h1>
          <p className="text-ink-secondary">Check the code and try again. A certificate that is not listed here is not valid.</p>
        </div>
      )}
      {data?.valid && data.certificate && (
        <>
          <div className="bg-chip-done-bg text-chip-done-fg rounded-xl p-space-md flex items-center gap-space-sm">
            <span className="material-symbols-outlined">verified</span>
            <span className="font-label-md">Verified credential. This certificate was issued by Learnly.</span>
          </div>
          <CertificateView cert={data.certificate} />
        </>
      )}
    </div>
  );
}
