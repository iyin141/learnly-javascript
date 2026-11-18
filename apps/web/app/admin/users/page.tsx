"use client";

import React, { useState } from "react";
import { DataTable } from "../../../components/DataTable";
import { useGetAdminUsersQuery, useSetUserRoleMutation } from "../../../store/apiSlice";

const apiMsg = (e: unknown, fallback: string) => (e as { data?: { error?: { message?: string } } } | undefined)?.data?.error?.message ?? fallback;

export default function AdminUsers() {
  const { data, isLoading, isError } = useGetAdminUsersQuery();
  const [setRole] = useSetUserRoleMutation();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changeRole = async (id: string, role: string) => {
    setMsg(null);
    try {
      await setRole({ id, role }).unwrap();
      setMsg({ ok: true, text: "Role updated." });
    } catch (e) {
      setMsg({ ok: false, text: apiMsg(e, "Could not change the role.") });
    }
  };
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-md">
      <h1 className="font-headline-lg text-headline-lg">Users</h1>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Admin access required.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}
      {data && (
        <DataTable
          rows={data.users}
          columns={[
            { header: "Name", cell: (u) => u.name },
            { header: "Email", cell: (u) => u.email },
            {
              header: "Role",
              cell: (u) => (
                <select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => void changeRole(u.id, e.target.value)} className="min-h-11 rounded-lg border border-border px-2">
                  {["student", "instructor", "admin"].map((r) => <option key={r}>{r}</option>)}
                </select>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
