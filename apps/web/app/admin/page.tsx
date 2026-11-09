import Link from "next/link";

export default function AdminHome() {
  const items = [
    ["users", "Users and roles"],
    ["courses", "Course approval"],
    ["reports", "Reports"],
  ] as const;
  return (
    <div className="p-margin-sm md:p-margin flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg">Admin</h1>
      <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([h, l]) => (
          <Link key={h} href={`/admin/${h}`} className="min-h-11 bg-card rounded-xl border border-border p-space-md hover:border-primary">{l}</Link>
        ))}
        <a href="/api/admin/queues/stats" className="min-h-11 bg-card rounded-xl border border-border p-space-md hover:border-primary">Job queue stats (JSON)</a>
      </div>
    </div>
  );
}
