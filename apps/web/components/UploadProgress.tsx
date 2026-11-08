"use client";

import { authFetch } from "../store/authFetch";
import React, { useState, useEffect } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface UploadProgressProps {
  courseId: string;
  lessonId: string;
  file: File;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  courseId,
  lessonId,
  file,
  onSuccess,
  onCancel,
}) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "ready" | "error">("idle");
  const [statusText, setStatusText] = useState("Preparing upload...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function doUpload() {
      try {
        setStatus("uploading");
        setStatusText("Initializing multipart upload...");

        // 1. Init multipart upload
        const initRes = await authFetch("/api/uploads/video/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            lessonId,
            fileName: file.name,
            contentType: file.type || "video/mp4",
            fileSizeBytes: file.size,
          }),
        });

        if (!initRes.ok) {
          const err = await initRes.json();
          throw new Error(err.error?.message || "Failed to initialize upload");
        }

        const { uploadId, key, partSize } = await initRes.json();
        const totalParts = Math.ceil(file.size / partSize);

        // 2. Request part presigned URLs
        setStatusText(`Generating presigned URLs for ${totalParts} parts...`);
        const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);

        const urlsRes = await authFetch("/api/uploads/video/part-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId, key, partNumbers }),
        });

        if (!urlsRes.ok) throw new Error("Failed to get presigned part URLs");
        const { parts: partUrls } = await urlsRes.json();

        // 3. Upload parts in parallel (chunk size 5MB)
        const completedParts: Array<{ PartNumber: number; ETag: string }> = [];
        let bytesUploaded = 0;

        for (const { partNumber, url } of partUrls) {
          if (isCancelled) return;

          const start = (partNumber - 1) * partSize;
          const end = Math.min(file.size, start + partSize);
          const chunk = file.slice(start, end);

          setStatusText(`Uploading chunk ${partNumber} of ${totalParts}...`);

          const putRes = await fetch(url, {
            method: "PUT",
            body: chunk,
          });

          if (!putRes.ok) {
            throw new Error(`Failed to upload part ${partNumber}`);
          }

          const etag = putRes.headers.get("ETag") || `"${partNumber}"`;
          completedParts.push({ PartNumber: partNumber, ETag: etag });

          bytesUploaded += chunk.size;
          setProgress(Math.round((bytesUploaded / file.size) * 100));
        }

        // 4. Complete multipart upload
        if (isCancelled) return;
        setStatus("processing");
        setStatusText("Completing upload and enqueuing transcode job...");

        const compRes = await authFetch("/api/uploads/video/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            lessonId,
            uploadId,
            key,
            parts: completedParts,
          }),
        });

        if (!compRes.ok) throw new Error("Failed to complete upload");

        setStatus("ready");
        setStatusText("Video uploaded! Transcoding running in worker...");
        if (onSuccess) onSuccess();
      } catch (err: any) {
        if (!isCancelled) {
          setStatus("error");
          setErrorMessage(err.message || "Upload failed");
        }
      }
    }

    doUpload();

    return () => {
      isCancelled = true;
    };
  }, [courseId, lessonId, file, onSuccess]);

  return (
    <div className="bg-canvas border border-border rounded-xl p-4 my-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {status === "uploading" && <UploadCloud className="w-5 h-5 text-primary animate-pulse" />}
          {status === "processing" && <Loader2 className="w-5 h-5 text-accent-amber animate-spin" />}
          {status === "ready" && <CheckCircle2 className="w-5 h-5 text-accent-green" />}
          {status === "error" && <AlertCircle className="w-5 h-5 text-accent-coral" />}
          <span className="font-label-md text-label-md font-semibold text-ink truncate max-w-xs">
            {file.name}
          </span>
        </div>
        <span className="font-mono text-xs text-ink-secondary">
          {(file.size / (1024 * 1024)).toFixed(1)} MB
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            status === "error"
              ? "bg-accent-coral"
              : status === "ready"
              ? "bg-accent-green"
              : "bg-primary"
          }`}
          style={{ width: `${status === "ready" ? 100 : progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-ink-secondary">
        <span>{statusText}</span>
        {status === "uploading" && <span>{progress}%</span>}
      </div>

      {errorMessage && (
        <p className="text-xs text-accent-coral mt-1 font-medium">{errorMessage}</p>
      )}
    </div>
  );
};
