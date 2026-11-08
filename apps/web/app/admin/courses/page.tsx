"use client";

import React from "react";
import { DataTable } from "../../../components/DataTable";
import { useDecideCourseMutation, useGetAdminCoursesQuery } from "../../../store/apiSlice";

export default function AdminCourses() {
  const { data, isLoading, isError } = useGetAdminCoursesQuery("in_review");
  const [decide, { isLoading: busy }] = useDecideCourseMutation();
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-md">
      <h1 className="font-headline-lg text-headline-lg">Courses awaiting review</h1>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Admin access required.</p>}
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
                  <button disabled={busy} onClick={() => decide({ id: c.id, approve: true })} className="min-h-11 px-3 rounded-full bg-accent text-white">Approve</button>
                  <button disabled={busy} onClick={() => decide({ id: c.id, approve: false })} className="min-h-11 px-3 rounded-full border border-border">Send back</button>
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
