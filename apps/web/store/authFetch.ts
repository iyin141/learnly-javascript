import { store } from "./index";
import { setCredentials, logoutAction } from "./authSlice";
import { withBase } from "./basePath";

/** fetch for /api calls outside RTK Query: adds the bearer token and retries once after a refresh. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const run = () => {
    const headers = new Headers(init.headers);
    const t = store.getState().auth.accessToken;
    if (t) headers.set("Authorization", `Bearer ${t}`);
    return fetch(withBase(input), { ...init, headers, credentials: "include" });
  };
  let res = await run();
  if (res.status === 401) {
    const r = await fetch(withBase("/api/auth/refresh"), { method: "POST", credentials: "include" });
    if (r.ok) {
      const d = await r.json();
      store.dispatch(setCredentials({ user: d.user, accessToken: d.accessToken }));
      res = await run();
    } else store.dispatch(logoutAction());
  }
  return res;
}
