import Link from "next/link";

const TABS = [
  ["", "Overview"],
  ["?tab=lessons", "Lessons"],
  ["?tab=quizzes", "Quizzes"],
  ["?tab=live", "Live"],
  ["?tab=people", "People"],
] as const;

/** Link-based tab bar for pages outside the course overview route. */
export function CourseTabs({ courseId, active }: { courseId: string; active: string }) {
  return (
    <nav aria-label="Course sections" className="flex gap-space-lg overflow-x-auto border-b border-border bg-card rounded-t-xl px-space-md">
      {TABS.map(([q, label]) => (
        <Link
          key={label}
          href={`/courses/${courseId}${q}`}
          aria-current={active === label ? "page" : undefined}
          className={`min-h-11 flex items-center font-label-md text-label-md border-b-2 ${active === label ? "border-primary text-primary font-semibold" : "border-transparent text-ink-secondary hover:text-ink"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
