import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rolesFor, type Role } from "./store/routeAccess";

// "session" is a site-wide cookie set with the refresh token; its value is the user's role. The refresh token itself
// is scoped to /api/auth and never reaches page requests. The role here only picks pages: the API checks it again.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("session")?.value;
  const role = (["student", "instructor", "admin"].includes(session ?? "") ? session : null) as Role | null;
  const allowed = rolesFor(pathname);
  const to = (path: string, next?: string) => {
    const url = req.nextUrl.clone(); // keeps the base path
    url.pathname = path;
    url.search = "";
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  if (allowed && !session) return to("/login", pathname);
  // A legacy "1" marker (no role yet) passes here; AppShell checks the role once the user loads.
  if (allowed && role && !allowed.includes(role)) return to("/");
  // No /login redirect here: a leftover cookie from a dead session would lock the user out of signing in.
  // AppShell sends signed-in users away from /login and /register once their session has really loaded.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
