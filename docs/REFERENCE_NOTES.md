# Reference Notes

Both references are read-only. Nothing was copied (no secrets, `.env` values or large blocks). Patterns are re-implemented.

## 1. `f1-project-backend` (Django REST API)

**What it does:** serves Formula 1 data over a REST API (FastF1 and Jolpica clients), with tiered API keys and rate limits.

**Stack:** Django 6, DRF, drf-spectacular, Celery (several Redis-backed queues), django-redis, gunicorn/uvicorn, pytest and Django tests. CI is a single GitHub Actions job.

**Layout:** `api/<feature>/{views,services,repository,serializers,urls}.py`, plus `api/common` (pagination, response, readiness, request_id) and `api/core` (cache decorators, task management).

### Reuse
| Pattern | Learnly equivalent |
|---|---|
| Central exception handler with one error shape (`error`, `error_code`, `retry_after_seconds`) | Express error middleware, shape `{error:{code,message,details,requestId}}` |
| `build_readiness` dict (available/unavailable data) | `/readyz` reporting mongo, redis, s3 and livekit |
| Layering `views -> services -> repository` | `routes -> services -> repositories` in `apps/api` |
| Request-id middleware and `event=... key=value` logs | pino structured logs with a `requestId` |
| Redis cache with fallback to the DB if the cache is down | Same for the cache layer |
| Rate-limit headers (`X-RateLimit-*`, `Retry-After`) | `express-rate-limit` with Redis store |
| Separate Celery queues by purpose | BullMQ queues `video`, `certificate`, `email`, `reminders` |
| CI with fake env vars and a fast unit-test job | GitHub Actions running vitest |
| OpenAPI generated and served at `/api/docs` | zod to OpenAPI at `/api/docs` |

### Do not reuse
- API-key auth (`X-API-Key`). We need JWT access plus a rotating refresh cookie and roles.
- The env-key fast-path that bypasses the DB, and the header dumps in auth debug logs.
- Committed artefacts (sqlite, celerybeat files, logs, venvs).
- The Django/Celery stack itself.

### Gaps (nothing to learn from it)
No Docker or compose, no WebSockets, no file uploads, no Mongo.

## 2. `CroudFundFrontend` (Next.js crowdfunding UI)

**What it does:** a campaign discovery, creation and dashboard UI with email verification and account management.

**Stack:** Next 16 App Router, React 19, Tailwind 4, Zustand (persisted), react-hook-form with zod, MUI, framer-motion and gsap.

**Layout:** `app/` routes, `_Components/<Feature>/`, `Api_services/*.ts`, `_Stores/`, `types/`, `proxy.ts` as the route guard.

### Reuse
| Pattern | Learnly equivalent |
|---|---|
| Token kept in an HttpOnly cookie, never exposed to client JS | Refresh cookie HttpOnly. Access token held in memory in Redux. |
| Typed `Api_services` wrappers with `extractErrorMessage` | RTK Query endpoints and a shared `baseQuery` error mapper |
| `proxy.ts` guards protected routes and redirects with `?next=` | Next `middleware.ts` (Next 14 name) |
| Feature-grouped components and multi-step forms | Course builder and quiz authoring steps |
| zod and react-hook-form for form validation | Same, with schemas shared via `packages/shared` |

### Do not reuse
- Zustand with a persisted user in `localStorage`. It is replaced by Redux Toolkit and not persisted.
- MUI, gsap and framer-motion. Tokens come from Tailwind only.
- Emoji `console.log` noise in the proxy and services.
- Inconsistent folder naming (`Api_services`, `utlis`, `_Components`). We use lower-case conventional names.

## 3. Conflicts and decisions

| Topic | Prompt | Reference | Choice |
|---|---|---|---|
| Next.js | 14 | 16 | **14**. The prompt wins and it is closest to MERN. |
| State | Redux Toolkit | Zustand | **Redux Toolkit and RTK Query**. |
| Tailwind | `tailwind.config.ts` tokens | v4 CSS-first | **Tailwind 3.4** with `tailwind.config.ts`. |
| Backend | Express, Mongo, BullMQ | Django, Celery | **Express and BullMQ**. Only the patterns carry over. |
| Auth | JWT and rotating refresh | cookie token and API key | **JWT access plus rotating refresh cookie**. |
| Folder style | monorepo from the prompt | different | **Prompt layout**. |

Neither reference is MERN. Where they disagree with the prompt, the prompt wins.
