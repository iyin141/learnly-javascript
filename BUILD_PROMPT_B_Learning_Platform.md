# BUILD PROMPT B: Learning Platform with Live Classes ("Learnly") — Next.js front end + full local back end

You are a senior full-stack engineer. Build the whole of Project B (FS-03, learning platform with live classes) so that it runs locally with ONE command (`docker compose up`) and needs no paid cloud account. Work in the phases below, in order. After each phase, run its acceptance checks and stop to report before starting the next.

## 0. Inputs you will be given

1. **UI mockups** — the Stitch export for each screen, as HTML (phases B1 to B9, desktop 1440 and mobile 390), plus `UI_Brief_B_Learning_Platform.html` with the design tokens, states and screen rules. The mockups are the visual source of truth.
2. **Two reference codebases** — the owner will attach two existing codebases. Treat them as READ-ONLY references for structure, conventions and patterns (folder layout, auth middleware, socket handling, queue workers, error handling, test style). Rules:
   - First, read both and write `docs/REFERENCE_NOTES.md`: what each one does, its stack, which patterns you will reuse and which you will not, and any conflicts between them. Do not start coding until this is written.
   - Do not copy secrets, `.env` values, tokens, keys, personal data or licensed assets. Re-implement patterns; do not paste large blocks verbatim.
   - Where the two disagree, prefer the one closest to this stack (MERN, Redux Toolkit, BullMQ) and note the choice.
3. **Project requirements (FS-03)** — if anything below conflicts with the official project document the owner gives you, the project document wins. Ask once, then continue.

## 1. Target architecture

```
                 ┌───────────────────────────── docker compose ─────────────────────────────┐
 Browser ─▶ nginx (gateway :80) ─┬─▶ web      Next.js 14 (App Router, TS, Tailwind, Redux Toolkit)  :3000
                                 ├─▶ api      Node.js + Express, REST + Socket.IO                    :4000
                                 ├─▶ /cdn/*   ─▶ cdn (nginx cache, simulates CloudFront) ─▶ minio
                                 └─▶ /rtc     ─▶ livekit (WebRTC SFU, signalling)                   :7880
 api ─▶ mongo   :27017     users, courses, lessons, enrolments, quizzes, attempts, sessions, certificates
 api ─▶ redis   :6379      BullMQ queues, socket adapter, rate limit, cache, live session state
 api ─▶ minio   :9000      raw uploads, HLS output, thumbnails, recordings, certificate PDFs
 worker (BullMQ) ─▶ ffmpeg   video transcode to HLS (360p, 720p), thumbnails, duration probe
 livekit-egress (optional)  ─▶ minio   class recordings
 api ─▶ mailpit :8025      captured emails
```

Services: `web`, `api`, `worker`, `mongo`, `redis`, `minio`, `minio-init`, `cdn`, `livekit`, `livekit-egress` (compose profile `recording`), `mailpit`, `nginx`.

## 2. Simulating S3 and CloudFront inside Docker (required)

**S3 = MinIO**, accessed only through AWS SDK v3, so real AWS is an env-var change.

- Buckets created by `minio-init` (image `minio/mc`): `learnly-uploads` (private, raw videos and documents), `learnly-media` (HLS segments, thumbnails; read through the CDN only), `learnly-private` (certificates, recordings).
- S3 client: `endpoint: S3_ENDPOINT`, `region: us-east-1`, `forcePathStyle: true`. Keep `S3_ENDPOINT` (internal, `http://minio:9000`) separate from `S3_PUBLIC_ENDPOINT` used when signing URLs for the browser.
- **Large video upload:** use S3 multipart upload with presigned part URLs. `POST /api/uploads/video/init` → returns uploadId and part size; `POST .../part-urls`; browser uploads parts in parallel with retry and shows progress; `POST .../complete`. Aborted uploads are cleaned up by a lifecycle rule plus an `AbortMultipartUpload` job.
- Upload limits: video up to 2 GB for local, mime check (mp4, mov, webm), instructor role only.

**CloudFront = an nginx cache container (`cdn`)** in front of MinIO:
- `proxy_cache` on `/cdn/` with a 1-day TTL for segments and 10 s for `.m3u8` playlists, `Cache-Control` and `Accept-Ranges` passed through, `X-Cache: HIT|MISS` header exposed so you can show caching works.
- **Signed access:** use nginx `secure_link` (HMAC and expiry) to simulate CloudFront signed URLs/cookies. The api issues a short-lived signed path only to enrolled students: `GET /api/lessons/:id/playback` → `{ url: "/cdn/hls/{courseId}/{lessonId}/master.m3u8?md5=...&expires=..." }`. Segment requests carry the same token via a signed cookie so players do not need per-segment URLs.
- Wrap this in a `CdnSigner` interface with two implementations (`NginxSecureLink` for local, `CloudFrontSigner` using `@aws-sdk/cloudfront-signer` for real AWS) selected by env.

## 3. Video pipeline (BullMQ + FFmpeg)

1. Upload completes → api creates `lesson.video = {status: "uploaded"}` and enqueues `video:transcode`.
2. Worker downloads the raw object from `learnly-uploads` (streamed to a temp dir), probes it with `ffprobe` (duration, resolution), then runs FFmpeg to produce HLS ladders (360p and 720p, 6-second segments, AES-128 optional behind a flag), a poster image and 3 timeline thumbnails.
3. Worker uploads the outputs to `learnly-media/hls/{courseId}/{lessonId}/...`, updates the lesson (`status: ready`, duration, renditions), emits a Socket.IO event `lesson:video:status` to the instructor, deletes temp files.
4. Failures: retries with exponential backoff (3 attempts), then `status: failed` with a readable reason. A dead-letter view in the instructor UI lets them retry.
5. Concurrency of 1 for FFmpeg jobs by default (env configurable); progress reported via `job.updateProgress` and shown in the UI.
6. The worker image includes FFmpeg (`apt-get install ffmpeg` or the `jrottenberg/ffmpeg` base).
7. Install `bull-board` at `/admin/queues`, admin only.

## 4. Live classes (WebRTC with LiveKit)

- Run `livekit/livekit-server` in dev mode from compose with keys from `.env` (a fixed dev key/secret pair is fine locally; document that it must change in production). Use host networking or fixed UDP ports (7881 TCP, 50000–50100 UDP) so WebRTC works on Docker Desktop; document the Docker Desktop caveat in the README.
- Token endpoint `POST /api/live/:sessionId/token`: checks enrolment or instructor ownership, issues a LiveKit access token (room = sessionId; instructor `roomAdmin`, `canPublish`, students `canPublish` only when promoted). Tokens expire in 1 hour.
- Front end uses `livekit-client` and `@livekit/components-react`: dark stage, large active-speaker tile, filmstrip, bottom control bar (mic, camera, share screen, raise hand, leave), side panel with Chat and People, recording indicator.
- **Raise-hand queue:** student sends a data message; instructor sees an ordered queue and can grant mic (api updates the participant permission through the LiveKit server API); revoke with one click.
- **Chat:** LiveKit data channel for in-room chat; also persisted through Socket.IO to Mongo so late joiners see history. (If a reference codebase already has a Socket.IO chat, reuse its pattern.)
- Session lifecycle in Mongo + Redis: `scheduled → live → ended`; instructor "Start class" creates the room and notifies enrolled students (Socket.IO + email); "End class" closes the room for everyone and stores attendance (join/leave times).
- Lobby page lists upcoming sessions, join-by-code field, "Start class" for the instructor, device check (camera/mic preview) before joining.
- Optional (`--profile recording`): LiveKit Egress records the room to MinIO `learnly-private/recordings/`; the worker later transcodes the recording into a normal lesson.
- Handle: permission denied for camera/mic, reconnect banner, network quality indicator, end-of-class screen.

## 5. Front end: converting the Stitch HTML to Next.js

Goal: pixel-faithful React, not a redesign.

1. **Tokens first** (brief section 2): primary `#2563EB`, accent green `#16A34A`, dark stage `#111827`, six course-card header colours, Inter font. Put them in `tailwind.config.ts` and CSS variables; no hard-coded hex values in components.
2. **Shared components** extracted from the HTML: `AppShell` (collapsible left rail → bottom tab bar on mobile), `CourseCard` (coloured header, avatar, progress bar, Continue, Live badge), `CourseTabs`, `LessonList`, `VideoPlayer` (hls.js, quality menu, resume position, speed, captions slot), `QuizRunner`, `QuestionCard`, `ProgressRing`, `LiveStage`, `ControlBar`, `SidePanel`, `LobbyCard`, `CertificateView`, `CourseBuilder` (drag to reorder), `UploadProgress`, `DataTable`, `Modal`, `Toast`, `EmptyState`, `Skeleton`.
3. **Routes (App Router):**
   - `/` home / my courses (B1), `/courses/[id]` Overview, Lessons, Quizzes, Live, People tabs (B2), `/courses/[id]/lessons/[lessonId]` player (B3), `/courses/[id]/quizzes/[quizId]` (B4), `/live` lobby (B5), `/live/[sessionId]` room (B6), `/certificates` and `/certificates/[id]` (B7)
   - `/instructor/*`: courses, builder, video upload, quizzes, live scheduling, revenue (B8)
   - `/admin/*`: users, course approval, reports, queues (B9)
   - `/login`, `/register`
4. **State:** Redux Toolkit with RTK Query for server data, slices for auth, player progress, live room UI. Server components for public catalog pages, client components for player, quiz, live room.
5. **Player rules:** save position every 10 s, mark a lesson complete at 90 percent watched, next-lesson autoplay, keyboard shortcuts, signed playback URL refreshed before expiry.
6. All states from the brief: loading, empty, error, processing video, not enrolled, class not started, class ended, quiz timed out.
7. Accessibility: contrast 4.5:1, 44 px targets, focus ring, captions slot, keyboard-operable player and control bar.
8. Playwright visual tests at 1440 and 390 against the mockup screenshots in `design/`; report differences instead of silently changing the design.

## 6. Back end requirements

Monorepo (pnpm workspaces): `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `infra/`, `design/`.

- **Auth:** JWT access + rotating refresh cookie, roles `student | instructor | admin`, rate-limited login.
- **Data (MongoDB):** `users`, `courses` (status draft, in_review, published), `sections`, `lessons` (type video|text|file, video renditions), `enrolments` (progress per lesson, lastPosition), `quizzes`, `questions` (single, multiple, true/false, short), `attempts` (answers, score, startedAt, submittedAt), `liveSessions`, `attendance`, `messages`, `certificates` (code, issuedAt, courseId, userId), `payments` (optional, test mode).
- **Quizzes:** timed attempts enforced on the server (not the client), randomised question order, attempt limits, pass mark, instant result with explanations, instructor analytics per question.
- **Certificates:** issued when all lessons complete and required quizzes passed. The worker renders a PDF (Puppeteer or pdf-lib) into `learnly-private`, with a unique code and a public verify page `/verify/[code]`. Download uses a 5-minute presigned URL.
- **Revenue dashboard:** enrolments and earnings per course over time using aggregation pipelines (use test-mode payments or a `mock` provider).
- **Notifications:** Socket.IO (Redis adapter) + email via Mailpit: class starting soon, video ready, quiz graded, certificate issued.
- **Redis/BullMQ queues:** `video`, `certificate`, `email`, `reminders` (delayed job 15 minutes before a class).
- **Quality:** OpenAPI at `/api/docs`, zod validation on every route, central error shape, structured logs, `/healthz` and `/readyz` (mongo, redis, s3, livekit), unit tests for quiz scoring and completion rules, integration tests for upload → transcode → playback.

## 7. Docker, config and seed

- `docker-compose.yml` with healthchecks and `depends_on: condition: service_healthy`; named volumes for mongo, redis, minio, and the CDN cache.
- Multi-stage Dockerfiles; non-root users; worker image includes FFmpeg; `.dockerignore`.
- `docker-compose.dev.yml` with bind mounts and hot reload.
- `.env.example` with every variable documented; no real secrets in git.
- `scripts/seed.ts`: 1 admin, 3 instructors, 25 students, 6 courses (2 with a real short sample video put through the pipeline), quizzes, enrolments with partial progress, 3 scheduled live sessions, 1 issued certificate. Print demo logins at the end. Use only a tiny licence-free or self-generated sample video (for example generated with `ffmpeg -f lavfi -i testsrc`).
- Scripts: `up`, `down`, `seed`, `test`, `s3:smoke`, `video:sample`.

## 8. Phases and acceptance checks

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | `docs/REFERENCE_NOTES.md`, skeleton, tokens, compose with mongo, redis, minio, cdn, mailpit | Stack healthy; `s3-smoke` passes |
| 1 | Auth, app shell, My courses (B1), course page (B2) | Three roles log in; layout matches mockups |
| 2 | Course builder, multipart video upload, BullMQ + FFmpeg HLS pipeline | Upload a sample file → status moves to ready → thumbnails exist in MinIO |
| 3 | Signed playback through the CDN cache, player (B3), progress tracking | `X-Cache: HIT` on second segment request; unenrolled user gets 403; resume works |
| 4 | Quizzes (B4), completion rules, certificates (B7) | Server-enforced timer; PDF issued; verify page works |
| 5 | LiveKit room, lobby (B5, B6), raise-hand queue, chat, attendance | Two browsers join, instructor grants mic, chat persists |
| 6 | Instructor tools and revenue (B8), admin (B9), bull-board, notifications | All three roles finish their flows end to end |
| 7 | Hardening: rate limits, validation, a11y, visual tests, recording profile, README | `make test` green; README covers the Docker Desktop WebRTC caveat |

Deliver: running stack, `README.md` (setup, ports, demo logins, architecture diagram, how to swap MinIO for AWS S3, the nginx CDN for CloudFront and LiveKit for LiveKit Cloud), and a list of mockup elements you could not implement and why.

## 9. Rules for you

- Do not invent requirements; record assumptions in `docs/ASSUMPTIONS.md` and keep going.
- Small commits per phase, no secrets in git, pin versions, prefer well-known libraries.
- Test the video and live paths for real; do not mock them and call them done.
- When a mockup element is ambiguous or impossible, choose the simplest faithful option and log it.
