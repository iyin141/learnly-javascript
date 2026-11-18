# Learnly (classroom)

Learning platform with live classes. Next.js 16 (App Router, React 19, Tailwind 4, Redux Toolkit), Express + Socket.IO API, BullMQ + FFmpeg worker, PostgreSQL (Prisma, Neon-ready), Redis, MinIO (S3), an nginx CDN cache (CloudFront stand-in) and LiveKit (WebRTC).

The Go rewrite of the same product lives next to it in `go/learnly`.

## Requirements checklist (internship brief FS-03 #2)

| # | Requirement | Where | Status |
|---|---|---|---|
| 1 | Roles (student, instructor, admin); course, lesson, enrolment schema | `apps/api/src/db.ts`, `db-learning.ts` | Done on PostgreSQL + Prisma (`packages/db`), Neon-ready |
| 2 | Course creation and video upload; FFmpeg in a BullMQ job to streaming formats | `routes/builder.ts`, `routes/uploads.ts` (S3 multipart), `apps/worker/src/transcoder.ts` (HLS 360p/720p) | Done, run end to end |
| 3 | Video delivered through CloudFront | `services/cdn.ts`: nginx `secure_link` cache locally (`CDN_SIGNER=nginx`); real CloudFront signer with RSA-SHA1 custom policy and signed cookies (`CDN_SIGNER=cloudfront`) | Local path run end to end; CloudFront signer verified by a unit test against its public key, not against AWS |
| 4 | Quizzes with auto-grading and progress tracking | `routes/quizzes.ts`, `@learnly/shared` scoring, `services/learning.ts` | Done, unit-tested |
| 5 | Live classes with WebRTC/LiveKit and chat | `routes/live.ts`, `LiveRoom.tsx`; chat over LiveKit data channel and stored in Postgres | Tokens, session lifecycle and chat storage built; a two-browser media test was not run |
| 6 | PDF certificates on completion | `routes/certificates.ts` (pdf-lib), public verify page | Done |
| 7a | Instructor revenue dashboard (Chart.js) | `/instructor/revenue`: monthly enrolments (bars) and net earnings (line) with Chart.js, plus per-course table | Done |
| 7b | Payment integration, test mode | `services/payments.ts`, `routes/payments.ts`: `POST /api/courses/:id/checkout`, mock provider (default, instant) or Stripe Checkout in test mode with a signed, replay-protected, idempotent webhook; platform fee 10% (`PLATFORM_FEE_BPS`), instructor earns the rest; paid courses refuse free enrolment (402) | Mock path run; Stripe path covered by signature unit tests only |

### Database: PostgreSQL on Neon

The data layer is Prisma over PostgreSQL (`packages/db`, migrations in `packages/db/prisma/migrations`). It was ported from MongoDB/Mongoose; the API, worker, seed script and tests all use Prisma now. Set `DATABASE_URL` (Neon pooled string) and `DIRECT_URL` (Neon direct string, used by `prisma migrate deploy`) in `.env`, then `pnpm db:migrate && pnpm seed`. Without them the compose `postgres` service is used.

### Paying for a course (test mode)

```bash
# instructor creates a priced course (priceCents) in the New course form, or seed: DATA 301 costs $49.00
# student: POST /api/courses/<id>/checkout   -> mock: enrolled immediately; stripe: { checkoutUrl }
PAYMENT_PROVIDER=stripe STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...   # Stripe test mode; live keys are refused
PAYMENT_PROVIDER=paystack PAYSTACK_SECRET_KEY=sk_test_... PAYMENT_CURRENCY=NGN            # Paystack test mode, where Stripe is unavailable
```

## Run

```bash
cp .env.example .env        # dev values only
docker compose up -d --build
pnpm install && pnpm db:migrate && pnpm seed   # schema + demo data (DATABASE_URL / DIRECT_URL from .env)
```

Compose project name: `learnly`. Host ports:

| Service | URL / port |
|---|---|
| Gateway (web + api + cdn + mail) | http://localhost:80 |
| MinIO S3 API / console | http://localhost:9000 / http://localhost:9091 |
| Mailpit UI / SMTP | http://localhost:8025 / 1025 |
| PostgreSQL / Redis (localhost only) | 5434 / 6379 |
| LiveKit signalling / TCP / UDP media | ws://localhost:7880 / 7881 / 50000-50100 |

`pnpm seed` from the host: `DATABASE_URL=postgresql://learnly:learnly@127.0.0.1:5434/learnly pnpm seed` (this wipes the tables first).

## Demo logins (password `password123`)

The login page shows these only when the web app is built with `NEXT_PUBLIC_DEMO_LOGINS=1` (off by default). The seed gives every demo account the same public password, so lock or delete them before real users arrive.

| Role | Email |
|---|---|
| Admin | admin@learnly.local |
| Instructor | instructor@learnly.local (also elena@ and marcus@learnly.local) |
| Student | student@learnly.local (plus student2 to student25) |

## Architecture

```
Browser -> nginx gateway -> web (Next 16)           pages, rewrites /api to the api
                         -> api (Express, Socket.IO) REST, quizzes, certificates, live tokens
                         -> /cdn -> cdn (nginx cache, secure_link) -> minio
                         -> /mail -> mailpit
api -> postgres (Neon), redis, minio, livekit (server API)
worker (BullMQ) -> ffmpeg HLS ladders, email and reminder queues
Browser <-> livekit (WebRTC, direct to the published ports)
```

Video: upload (S3 multipart) -> `video` queue -> FFmpeg -> `learnly-media/hls/...` -> `GET /api/lessons/:id/playback` returns a signed `/cdn/...m3u8` URL and sets signed cookies for segments. The second request for a segment returns `X-Cache: HIT`.

## Access rules and flows (as built)

- **Registration** accepts `student` or `instructor` only (the shared zod schema rejects anything else). Admin accounts are never self-service: an admin changes a role in Admin > Users (`PATCH /api/admin/users/:id`).
- **Course visibility.** `GET /api/courses/:id` returns an unpublished course only to its instructor and to admins (404 for everyone else). Lesson text and video storage keys go only to enrolled students, the course owner and admins; the public catalog (`GET /api/courses`) is unchanged. There is no free-preview flag, so a signed-out visitor sees the outline, not the lessons.
- **People tab.** `GET /api/courses/:id/people` lists the instructor and the enrolled students (first 500, oldest first). It is open to that course's students, its instructor and admins. Students see names, avatars and join dates; the instructor and admins also see emails and progress. No schema change: it reads `enrolments`.
- **Paying for a course.** `POST /api/courses/:id/checkout` creates a pending payment and returns the provider's page; the return address is `${WEB_BASE_URL}/courses/:id?payment=<paymentId>`. The course page then calls `POST /api/payments/:id/verify`, so a lost or late webhook does not leave a buyer without access. Publishing a course that is already published is refused (409).
- **Forgot password.** `POST /api/auth/forgot` always answers 204. `POST /api/auth/reset` takes `{ token, password }`. The token is a stateless JWT signed with a key derived from `JWT_ACCESS_SECRET`, valid 30 minutes, tied to a fingerprint of the current password hash, so it works once; a reset also revokes the user's refresh tokens. No table was added. The email goes through the normal email queue, so it is only delivered if `SMTP_HOST` points at a real mail server (the compose stack uses Mailpit, which keeps mail instead of sending it).
- **Origins.** `WEB_ORIGIN` is the plain browser origin (CORS and Socket.IO allow it; localhost is allowed only outside production). `WEB_BASE_URL` is that origin plus the base path and is used in links sent to people.
- **Live updates.** The API still emits `live:*` Socket.IO events but nothing in the web app listens (the Socket.IO connection is unauthenticated, A17), so the live pages poll. `socket.io-client` was removed from the web app.

## Deployed under a subpath (the shared VM)

The same code runs at `https://<host>/learnly-js` next to other apps. `docker-compose.deploy.yml` is the overlay for it:

```
host nginx  /learnly-js            -> web  (built with NEXT_BASE_PATH=/learnly-js)
            /learnly-js/api/       -> api  (prefix stripped, cookie paths rewritten)
            /learnly-js/cdn/       -> cdn (nginx secure_link) -> minio
            /learnly-js/socket.io/ -> api
            /<bucket>/...          -> minio  (presigned URLs are signed over host + path, so the three buckets
                                              `learnlyjs-uploads|media|private` are routed at the domain root)
            /twirp/                -> LiveKit server API of another stack (the LiveKit SDK drops any path prefix from its URL)
```

- The database is Neon (`DATABASE_URL`, `DIRECT_URL`); the local `postgres`, `livekit` and `nginx` gateway services are not started. The api runs `prisma migrate deploy` on every start.
- Bucket names come from `S3_BUCKET_UPLOADS|MEDIA|PRIVATE` (compose, `infra/minio/init.sh` and the CDN template all read them), so two stacks can share one domain.
- Live classes use a LiveKit server that is already running on the host: `LIVEKIT_URL` is the bare domain (server API through `/twirp/`), `LIVEKIT_PUBLIC_URL` is the `wss://` signalling path browsers use.
- Needed in the deploy env file: `WEB_ORIGIN`, `WEB_BASE_URL`, `LEARNLY_BASE_PATH`, the `LEARNLY_*` port variables, `S3_PUBLIC_ENDPOINT`, `CDN_SECRET`, `JWT_*`, `PAYSTACK_SECRET_KEY` (or the Stripe pair), `LIVEKIT_*`.

## Swapping the local pieces for the real thing

- **MinIO to AWS S3:** set `S3_ENDPOINT` (blank or the regional endpoint), `S3_PUBLIC_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE=false` and the three bucket names. Code uses only AWS SDK v3. Keep `learnly-media` private and let CloudFront read it through OAC (the local bucket is anonymously readable only so nginx can proxy it, see ASSUMPTIONS A6).
- **nginx CDN to CloudFront:** set `CDN_SIGNER=cloudfront`, `CDN_CF_DOMAIN` (distribution domain), `CDN_CF_KEY_PAIR_ID`, `CDN_CF_PRIVATE_KEY` (PEM, `
` escapes allowed) and, if the API and the CDN are on sibling subdomains, `CDN_COOKIE_DOMAIN`. `CloudFrontSigner` signs a wildcard custom policy for the lesson folder with node:crypto and returns the three CloudFront cookies. The playback URL shape stays the same for the player.
- **LiveKit to LiveKit Cloud:** set `LIVEKIT_URL` (https/wss project URL for the server API), `LIVEKIT_PUBLIC_URL` (wss URL the browser uses), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Remove the `livekit` compose service. **The dev key pair in `.env.example` is public: change it for anything real.**

## Docker Desktop and WebRTC (important)

WebRTC media goes over UDP/TCP directly to LiveKit, not through nginx. On Docker Desktop (Windows/macOS) the container sits behind a VM, so:

1. Publish the TCP and UDP ports (done in compose: the UDP range above plus the TCP port). The range must match LiveKit's `rtc.port_range_*` (set through `LIVEKIT_CONFIG` in compose).
2. If two browsers on the same machine can sign in to a room but show no video, set `rtc.use_external_ip: false` and `rtc.node_ip: 127.0.0.1` (or your LAN IP) in `LIVEKIT_CONFIG`, then restart the `livekit` service. For other devices on your LAN use the LAN IP and open the app through it.
3. Host networking (`network_mode: host`) works on Linux but not reliably on Docker Desktop, so it is not used.
4. Camera and microphone need a secure context: use `http://localhost`, not a LAN IP over plain http (or put TLS in front).
5. TURN is not configured. Strict corporate NATs may need it.

## Tests

- `pnpm test` runs the api unit tests (quiz scoring, completion rule, payments, Stripe webhook signature, CloudFront signature) and `apps/api/test/auth.test.ts` (needs PostgreSQL: create a `learnly_test` database, run the migrations against it, and export `DATABASE_URL`; test files run serially because they share it).
- Visual tests: `pnpm test:visual` (Playwright, 1440 px and 390 px) compares each route with `design/stitch/*/screen.png`. It reports differences; never run it with `--update-snapshots`. Needs `pnpm exec playwright install chromium`, the stack running and the seed loaded.

## Accessibility notes

Skip link, labelled nav landmarks and form fields, visible focus ring, reduced-motion support, 44 px targets on interactive controls, a captions slot in the player, keyboard shortcuts in the player (space/k, arrows, m, f, < >). Accent greens and muted text were darkened for 4.5:1 contrast (ASSUMPTIONS A19). No automated axe run has been done.

## What is untested (honest list)

Status (2026-11-19): the web, api and worker compile (`tsc --noEmit` is clean), the images build and run on the VM, and the unit tests that need no database pass (rules, payments, reset token). Not exercised end to end, because each needs a signed-in browser or a live service:

- The database-backed tests (`apps/api/test/auth.test.ts` and the other integration tests).
- The paid-course return and verify flow against Paystack or Stripe, and the password-reset email (delivery needs a real SMTP server).
- Parallel part upload to S3 (the bucket must let the browser read the `ETag` header; behind the single-domain nginx route this is same-origin and needs no CORS rule).
- The LiveKit room, raise-hand queue, mic grant, chat persistence and attendance, with real browsers.
- hls.js playback, signed-URL refresh and resume against a real transcoded video; the CDN `X-Cache: HIT` check.
- Quiz timer enforcement end to end, certificate PDF issue and the presigned download, verify page.
- Email and reminder workers against Mailpit.
- Playwright specs and the visual comparison.

Not implemented: bull-board UI (there are JSON queue endpoints at `/api/admin/queues/*`), the `--profile recording` LiveKit Egress service, OpenAPI coverage of the new routes, authenticated Socket.IO, Calendar/To-do/Archived/Settings pages, and the code-panel/whiteboard/notes parts of the lesson and live-room mockups.
