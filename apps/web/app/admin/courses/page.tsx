"use client";

import React, { useState } from "react";
import { DataTable } from "../../../components/DataTable";
import { useDecideCourseMutation, useGetAdminCoursesQuery } from "../../../store/apiSlice";

const apiMsg = (e: unknown, fallback: string) => (e as { data?: { error?: { message?: string } } } | undefined)?.data?.error?.message ?? fallback;

export default function AdminCourses() {
  const { data, isLoading, isError } = useGetAdminCoursesQuery("in_review");
  const [decide, { isLoading: busy }] = useDecideCourseMutation();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const decideCourse = async (id: string, approve: boolean) => {
    setMsg(null);
    try {
      await decide({ id, approve }).unwrap();
      setMsg({ ok: true, text: approve ? "Course approved and published." : "Course sent back to the instructor." });
    } catch (e) {
      setMsg({ ok: false, text: apiMsg(e, "Could not record the decision.") });
    }
  };
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-md">
      <h1 className="font-headline-lg text-headline-lg">Courses awaiting review</h1>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Admin access required.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}
      {data && (
        <DataTable
          empty="No courses are waiting for review."
          rows={data.courses}
          columns={[
            { header: "Course", cell: (c) => `${c.code}: ${c.title}` },
            { header: "Instructor", cell: (c) => c.instructorName },
            {
              header: "Decision",
              cell: (c) => (
                <span className="flex gap-space-sm">
                  <button disabled={busy} onClick={() => void decideCourse(c.id, true)} className="min-h-11 px-3 rounded-full bg-accent text-white">Approve</button>
                  <button disabled={busy} onClick={() => void decideCourse(c.id, false)} className="min-h-11 px-3 rounded-full border border-border">Send back</button>
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
