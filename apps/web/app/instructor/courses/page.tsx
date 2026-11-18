"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreateCourseMutation, useGetInstructorCoursesQuery, useSubmitForReviewMutation } from "../../../store/apiSlice";
import { FormModal, ModalField } from "../../../components/Modal";

const COLORS = ["blue", "coral", "slate", "purple", "teal", "amber"];
import { Edit3, Eye } from "lucide-react";

export default function InstructorCoursesIndexPage() {
  const { data, isLoading, isError } = useGetInstructorCoursesQuery();
  const [submit, { isLoading: submitting }] = useSubmitForReviewMutation();
  const courses = data?.courses ?? [];
  const router = useRouter();
  const [createCourse, { isLoading: creating }] = useCreateCourseMutation();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [nf, setNf] = useState({ title: "", code: "", term: "", description: "", subjectColor: "blue", price: "" });
  // "Create or Join" in the header links here with ?new=1
  useEffect(() => { if (new URLSearchParams(window.location.search).get("new") === "1") setOpen(true); }, []);
  async function create() {
    setErr("");
    try {
      const { price, ...rest } = nf;
      const cents = Math.round(Number(price) * 100);
      if (price && (!Number.isFinite(cents) || cents < 0)) { setErr("Enter a valid price"); return; }
      const r = await createCourse({ ...rest, ...(price ? { priceCents: cents } : {}) }).unwrap();
      setOpen(false);
      router.push(`/instructor/courses/${r.course.id}/builder`);
    } catch (e: any) {
      setErr(e?.data?.error?.message || "Could not create the course");
    }
  }
  return (
    <div className="p-margin-sm md:p-margin max-w-6xl mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-ink">Instructor Courses</h1>
          <p className="text-ink-secondary">Build curriculum, upload video, schedule classes and publish.</p>
        </div>
        <nav className="flex flex-wrap gap-space-sm">
          <button type="button" onClick={() => { setErr(""); setOpen(true); }} className="min-h-11 px-space-md rounded-full bg-primary text-white font-semibold inline-flex items-center hover:bg-primary-hover">New course</button>
          <Link href="/instructor/live" className="min-h-11 px-space-md rounded-full bg-card border border-border inline-flex items-center">Schedule live</Link>
          <Link href="/instructor/revenue" className="min-h-11 px-space-md rounded-full bg-card border border-border inline-flex items-center">Revenue</Link>
          <Link href="/instructor/quizzes" className="min-h-11 px-space-md rounded-full bg-card border border-border inline-flex items-center">Quizzes</Link>
        </nav>
      </div>
      <FormModal open={open} title="New course" subtitle="Saved as a draft. Add sections, lessons and video in the builder, then submit it for review." submitLabel="Create course" busy={creating} error={err} onSubmit={() => void create()} onClose={() => setOpen(false)}>
        <ModalField label="Title"><input className="modal-input" value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} minLength={3} required /></ModalField>
        <ModalField label="Course code" hint="For example CS 101"><input className="modal-input" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} minLength={2} maxLength={20} required /></ModalField>
        <ModalField label="Term" hint="Optional"><input className="modal-input" value={nf.term} onChange={(e) => setNf({ ...nf, term: e.target.value })} placeholder="Self-paced" /></ModalField>
        <ModalField label="Price (USD)" hint="Leave empty for a free course. Paid courses are bought in test mode."><input className="modal-input" inputMode="decimal" pattern="[0-9]*(\\.[0-9]{0,2})?" value={nf.price} onChange={(e) => setNf({ ...nf, price: e.target.value })} /></ModalField>
        <ModalField label="Description" hint="Optional"><textarea className="modal-input" rows={3} value={nf.description} onChange={(e) => setNf({ ...nf, description: e.target.value })} /></ModalField>
        <ModalField label="Colour"><select className="modal-input capitalize" value={nf.subjectColor} onChange={(e) => setNf({ ...nf, subjectColor: e.target.value })}>{COLORS.map((c) => <option key={c} value={c}>{c}</option>)}</select></ModalField>
      </FormModal>
      {isLoading && <div className="h-32 rounded-xl bg-border animate-pulse" />}
      {isError && <p role="alert" className="text-danger">Log in as an instructor to manage courses.</p>}
      {!isLoading && !isError && courses.length === 0 && <p className="bg-card rounded-xl border border-border p-space-lg text-center text-ink-secondary">You have no courses yet.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {courses.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-space-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{c.code}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 capitalize">{c.status.replace("_", " ")}</span>
            </div>
            <h3 className="font-label-md text-label-md font-bold text-ink">{c.title}</h3>
            <p className="font-caption text-caption text-ink-secondary">{c.lessons} lessons, {c.students} students</p>
            <div className="flex gap-space-sm mt-auto">
              <Link href={`/instructor/courses/${c.id}/builder`} className="flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 bg-primary/10 text-primary rounded-lg text-sm font-semibold"><Edit3 className="w-4 h-4" />Builder</Link>
              {c.status === "draft" && <button disabled={submitting} onClick={() => submit(c.id)} className="min-h-11 px-3 rounded-lg border border-border text-sm">Submit for review</button>}
              <Link href={`/courses/${c.id}`} aria-label="View course" className="min-w-11 min-h-11 inline-flex items-center justify-center border border-border rounded-lg"><Eye className="w-4 h-4" /></Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
