import { withBase } from "./basePath";
import type { AuthResponse } from "@learnly/shared";

// One refresh at a time for the whole tab. The API rotates the refresh token on every use and treats a second use of
// the old one as theft (it revokes the whole session), so parallel 401s must share a single /auth/refresh call.
let inflight: Promise<AuthResponse | null> | null = null;

export function refreshSession(): Promise<AuthResponse | null> {
  inflight ??= fetch(withBase("/api/auth/refresh"), { method: "POST", credentials: "include" })
    .then((r) => (r.ok ? (r.json() as Promise<AuthResponse>) : null))
    .catch(() => null)
    .finally(() => setTimeout(() => { inflight = null; }, 0));
  return inflight;
}
