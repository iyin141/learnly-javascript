"use client";

import { Img } from "@/components/Img";
import PasswordInput from "@/components/PasswordInput";
import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoginMutation } from "../../store/apiSlice";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") || "/";
  // same-site paths only: one leading slash, no "//" or backslash (open redirect), no scheme
  const nextUrl = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [loginTrigger, { isLoading }] = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await loginTrigger({ email, password }).unwrap();
      router.push(nextUrl);
    } catch (err: any) {
      setErrorMessage(err?.data?.error?.message || "Invalid credentials. Please try again.");
    }
  };

  const handleQuickLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("password123");
  };

  return (
    <div className="w-full max-w-md bg-card rounded-card border border-border shadow-card p-space-lg flex flex-col gap-space-md">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center mx-auto text-xl font-bold mb-2">
          <Img name="logo" alt="" className="w-full h-full object-cover rounded-[inherit]" fallback={<>L</>} />
        </div>
        <h1 className="font-headline-md text-headline-md font-bold text-ink">Welcome back to Learnly</h1>
        <p className="font-body-md text-body-md text-ink-secondary mt-1">
          Sign in to continue to your classroom
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
        <div>
          <label htmlFor="field-1" className="block font-label-sm text-label-sm text-ink-secondary mb-1">
            Email Address
          </label>
          <input id="field-1"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
            className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="field-2" className="block font-label-sm text-label-sm text-ink-secondary mb-1">
            Password
          </label>
          <PasswordInput id="field-2"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="text-right -mt-1">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-2.5 bg-primary text-white rounded-full font-label-md text-label-md font-semibold hover:bg-primary-hover shadow-sm disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {/* Demo Roles Quick Fill (off unless NEXT_PUBLIC_DEMO_LOGINS=1 at build time) */}
      {process.env.NEXT_PUBLIC_DEMO_LOGINS === "1" && (
      <div className="pt-space-sm border-t border-border">
        <span className="font-caption text-caption text-ink-secondary block text-center mb-2">
          Quick demo credentials:
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickLogin("student@learnly.local")}
            className="px-2 py-1 bg-canvas hover:bg-slate-200 rounded-lg text-xs font-medium text-ink transition-colors"
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin("instructor@learnly.local")}
            className="px-2 py-1 bg-canvas hover:bg-slate-200 rounded-lg text-xs font-medium text-ink transition-colors"
          >
            Instructor
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin("admin@learnly.local")}
            className="px-2 py-1 bg-canvas hover:bg-slate-200 rounded-lg text-xs font-medium text-ink transition-colors"
          >
            Admin
          </button>
        </div>
      </div>
      )}

      <div className="text-center font-body-md text-sm text-ink-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary font-semibold hover:underline">
          Sign up
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-ink-secondary">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
