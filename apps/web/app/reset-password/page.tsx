"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import { useResetPasswordMutation } from "../../store/apiSlice";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reset, { isLoading }] = useResetPasswordMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (password !== confirm) { setErrorMessage("The two passwords do not match."); return; }
    try {
      await reset({ token, password }).unwrap();
      setDone(true);
    } catch (err: any) {
      setErrorMessage(err?.data?.error?.message || "Could not reset the password. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-md bg-card rounded-card border border-border shadow-card p-space-lg flex flex-col gap-space-md">
      <h1 className="font-headline-md text-headline-md font-bold text-ink text-center">Choose a new password</h1>
      {done ? (
        <p role="status" className="text-ink-secondary text-center">Your password has been changed. You can now <Link href="/login" className="text-primary font-semibold hover:underline">sign in</Link>.</p>
      ) : !token ? (
        <p role="alert" className="text-danger text-center">This reset link is incomplete. <Link href="/forgot-password" className="text-primary font-semibold hover:underline">Request a new one</Link>.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-space-sm">
          {errorMessage && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-sm">{errorMessage}</div>}
          <label htmlFor="rp-1" className="block font-label-sm text-label-sm text-ink-secondary">New password</label>
          <PasswordInput id="rp-1" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          <label htmlFor="rp-2" className="block font-label-sm text-label-sm text-ink-secondary">Repeat password</label>
          <PasswordInput id="rp-2" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          <button type="submit" disabled={isLoading} className="w-full mt-2 py-2.5 bg-primary text-white rounded-full font-semibold hover:bg-primary-hover disabled:opacity-50">
            {isLoading ? "Saving..." : "Change password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-ink-secondary">Loading...</div>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
