/** Path prefix the app is served under (for example "/learnly" on a shared domain); "" at the site root. Baked in at build time from NEXT_PUBLIC_BASE_PATH. */
export const BASE: string = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Prefix a root-relative URL ("/api/...", "/cdn/...") with the base path; absolute and already-prefixed URLs are returned unchanged. */
export function withBase(url: string): string {
  if (!BASE || !url.startsWith("/") || url.startsWith("//") || url === BASE || url.startsWith(BASE + "/")) return url;
  return BASE + url;
}
