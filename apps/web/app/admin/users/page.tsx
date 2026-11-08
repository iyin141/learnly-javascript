"use client";

import React from "react";
import { DataTable } from "../../../components/DataTable";
import { useGetAdminUsersQuery, useSetUserRoleMutation } from "../../../store/apiSlice";

export default function AdminUsers() {
  const { data, isLoading, isError } = useGetAdminUsersQuery();
  const [setRole] = useSetUserRoleMutation();
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-md">
      <h1 className="font-headline-lg text-headline-lg">Users</h1>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Admin access required.</p>}
      {data && (
        <DataTable
          rows={data.users}
          columns={[
            { header: "Name", cell: (u) => u.name },
            { header: "Email", cell: (u) => u.email },
            {
              header: "Role",
              cell: (u) => (
                <select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => setRole({ id: u.id, role: e.target.value })} className="min-h-11 rounded-lg border border-border px-2">
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
