"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForgotPasswordMutation } from "../../store/apiSlice";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forgot, { isLoading }] = useForgotPasswordMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await forgot({ email }).unwrap();
      setSent(true);
    } catch (err: any) {
      setErrorMessage(err?.data?.error?.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-card border border-border shadow-card p-space-lg flex flex-col gap-space-md">
        <h1 className="font-headline-md text-headline-md font-bold text-ink text-center">Reset your password</h1>
        {sent ? (
          <p role="status" className="text-ink-secondary text-center">
            If an account exists for that address, we have sent a link to reset the password. It works for 30 minutes.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-space-sm">
            <p className="text-ink-secondary">Enter your email and we will send you a reset link.</p>
            {errorMessage && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-sm">{errorMessage}</div>}
            <label htmlFor="fp-email" className="block font-label-sm text-label-sm text-ink-secondary">Email Address</label>
            <input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            <button type="submit" disabled={isLoading} className="w-full mt-2 py-2.5 bg-primary text-white rounded-full font-semibold hover:bg-primary-hover disabled:opacity-50">
              {isLoading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
        <div className="text-center text-sm"><Link href="/login" className="text-primary font-semibold hover:underline">Back to sign in</Link></div>
      </div>
    </div>
  );
}
