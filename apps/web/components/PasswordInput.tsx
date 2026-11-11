"use client";
import { useState, type InputHTMLAttributes } from "react";

export default function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-ink-secondary hover:text-ink"
      >
        <span className="material-symbols-outlined text-[20px]">{show ? "visibility_off" : "visibility"}</span>
      </button>
    </div>
  );
}
