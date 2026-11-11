/** Which roles may open which pages. Used by proxy.ts (before render) and AppShell (after the user loads). */
export type Role = "student" | "instructor" | "admin";
const ANY: Role[] = ["student", "instructor", "admin"];

// First match wins. Pages not listed are public.
const RULES: [RegExp, Role[]][] = [
  [/^\/admin(\/|$)/, ["admin"]],
  [/^\/instructor(\/|$)/, ["instructor", "admin"]],
  [/^\/courses\/[^/]+\/(lessons|quizzes)(\/|$)/, ANY],
  [/^\/(live|certificates)(\/|$)/, ANY],
];

/** Roles allowed on a path, or null when the page is public. */
export function rolesFor(pathname: string): Role[] | null {
  for (const [re, roles] of RULES) if (re.test(pathname)) return roles;
  return null;
}

/** Pages a signed-in user has no reason to see. */
export const isAuthPage = (pathname: string) => pathname === "/login" || pathname === "/register";
