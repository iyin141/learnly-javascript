"use client";

import PasswordInput from "@/components/PasswordInput";
import { Img } from "@/components/Img";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRegisterMutation } from "../../store/apiSlice";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [registerTrigger, { isLoading }] = useRegisterMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await registerTrigger({ name, email, password, role }).unwrap();
      router.push("/");
    } catch (err: any) {
      setErrorMessage(err?.data?.error?.message || "Registration failed. Please check your details.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-card border border-border shadow-card p-space-lg flex flex-col gap-space-md">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center mx-auto text-xl font-bold mb-2">
            <Img name="logo" alt="" className="w-full h-full object-cover rounded-[inherit]" fallback={<>L</>} />
          </div>
          <h1 className="font-headline-md text-headline-md font-bold text-ink">Join Learnly</h1>
          <p className="font-body-md text-body-md text-ink-secondary mt-1">
            Create an account to begin learning or teaching
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
              Full Name
            </label>
            <input id="field-1"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Johnson"
              className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="field-2" className="block font-label-sm text-label-sm text-ink-secondary mb-1">
              Email Address
            </label>
            <input id="field-2"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@university.edu"
              className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="field-3" className="block font-label-sm text-label-sm text-ink-secondary mb-1">
              Password
            </label>
            <PasswordInput id="field-3"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block font-label-sm text-label-sm text-ink-secondary mb-1">
              Account Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("student")}
                className={`py-2 px-3 rounded-lg text-sm font-medium border text-center transition-all ${
                  role === "student"
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border bg-canvas text-ink-secondary hover:text-ink"
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole("instructor")}
                className={`py-2 px-3 rounded-lg text-sm font-medium border text-center transition-all ${
                  role === "instructor"
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border bg-canvas text-ink-secondary hover:text-ink"
                }`}
              >
                Instructor
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 py-2.5 bg-primary text-white rounded-full font-label-md text-label-md font-semibold hover:bg-primary-hover shadow-sm disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div className="text-center font-body-md text-sm text-ink-secondary">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
