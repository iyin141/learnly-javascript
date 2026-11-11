import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/todo", "/calendar", "/instructor", "/admin"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // "session" is a site-wide marker set with the refresh token (which is scoped to /api/auth and never reaches page requests).
  const refreshToken = req.cookies.get("session")?.value ?? req.cookies.get("refreshToken")?.value;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !refreshToken) {
    const url = req.nextUrl.clone();          // keeps the base path
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
