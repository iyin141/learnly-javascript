import React from "react";
import type { CertificateInfo } from "@learnly/shared";

/** The certificate sheet (B7). Pure presentation, used by the owner page and the public verify page. */
export function CertificateView({ cert }: { cert: CertificateInfo }) {
  return (
    <div className="bg-card rounded-xl shadow-md p-space-sm md:p-space-lg">
      <div className="border-2 border-dashed border-primary-ring rounded-xl p-space-lg md:p-margin text-center flex flex-col items-center gap-space-md bg-gradient-to-b from-card to-primary/5">
        <div className="flex items-center gap-space-sm text-primary">
          <span className="material-symbols-outlined text-[36px]">workspace_premium</span>
          <span className="font-headline-lg text-headline-lg tracking-wide">LEARNLY</span>
        </div>
        <p className="tracking-[0.3em] text-ink-secondary font-label-md text-label-md">CERTIFICATE OF COMPLETION</p>
        <p className="italic text-ink-secondary">This is to certify that</p>
        <h2 className="font-headline-xl text-headline-xl text-ink">{cert.studentName}</h2>
        <p className="text-ink-secondary max-w-xl">has successfully completed the course</p>
        <h3 className="font-headline-lg text-headline-lg text-primary max-w-2xl">{cert.courseTitle}</h3>
        <p className="font-caption text-caption text-ink-secondary">
          Issued on {new Date(cert.issuedAt).toLocaleDateString(undefined, { dateStyle: "long" })} &middot; {cert.hours} hours
        </p>
        <div className="flex flex-col items-center">
          <div className="w-48 border-b border-ink-muted h-8" />
          <p className="font-label-md text-label-md font-semibold">{cert.instructorName}</p>
          <p className="font-caption text-caption text-ink-secondary">Instructor</p>
        </div>
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-space-sm text-left">
          <div>
            <p className="font-caption text-caption text-ink-secondary uppercase">Credential identifier</p>
            <p className="font-mono font-semibold">{cert.code}</p>
            <p className="font-caption text-caption text-ink-secondary">/verify/{cert.code}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-chip-done-bg text-chip-done-fg px-3 py-1 font-caption">
            <span className="material-symbols-outlined text-[16px]">lock</span> Authenticated
          </span>
        </div>
      </div>
    </div>
  );
}
