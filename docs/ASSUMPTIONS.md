# Assumptions

Recorded per prompt section 9. Each is revisable.

| # | Assumption | Reason |
|---|---|---|
| A1 | `UI_Brief_B_Learning_Platform.html` was not provided. Design comes from `design/stitch/learnly_calm_edtech_system/DESIGN.md` and the screenshots. | The file is missing from the input folder. |
| A2 | No mockups exist for login/register, instructor tools (B8) or admin (B9). They are built from the same tokens and components and flagged "no mockup". | The Stitch export has no such screens. |
| A3 | The FS-03 project document was not provided, so the prompt is the spec. | Nothing else was supplied. |
| A4 | The repo is built in the `classroom` folder as a pnpm monorepo. | The workspace is empty apart from the inputs. |
| A5 | Docker Desktop with WSL2 is assumed (Docker 29.6 and Compose 5.2 detected). | The WebRTC caveat is documented later. |
| A6 | MinIO API port 9000 is published on localhost so browsers can use presigned URLs. As a result `learnly-media` is anonymously readable on that port locally. Access control for playback is enforced at the CDN (`secure_link`). In real AWS the bucket stays private behind CloudFront OAC. | nginx cannot sign SigV4 requests to a private bucket. |
| A7 | Next.js 14 and Tailwind 3.4 are used, per the prompt. | See `REFERENCE_NOTES.md`. |
| A8 | The local dev LiveKit key and secret are fixed in `.env.example` and must change in production. | The prompt allows it for local use. |
| A9 | Official `minio/minio` and `minio/mc` images and `dl.min.io` binaries are no longer available (pull denied / 410 Gone). Compose uses the community MinIO fork `pgsty/minio` and `pgsty/mc`, pinned. Only the S3 API is used, via AWS SDK v3, so any S3-compatible server or real AWS can replace it with env changes. | Required to run locally at all. |
| A10 | Stack is now Next.js 16, React 19, Tailwind 4 (CSS-first `@theme`), overriding A7. `middleware.ts` is `proxy.ts`; no `next lint`; `params` are read with `useParams` in client pages. | Owner request. |
| A11 | Sidebar links Calendar, To-do, Archived and Settings were removed. The route list in the prompt has no such pages and no mockups exist for them. A "Live" link, and "Teach"/"Admin" for those roles, replace them. | Avoid dead links. |
| A12 | Mobile mockups are implemented as responsive breakpoints of the same pages (bottom tab bar under 768 px), not as separate routes. | One codebase per screen. |
| A13 | Quiz timing: the server stores `startedAt` and `endsAt` and accepts answers and submissions up to 5 s after `endsAt`. After that, saved answers are scored and the attempt is flagged `timedOut`. An attempt left open past the deadline is auto-submitted the next time the user starts that quiz. There is no background sweeper job. | Keeps enforcement server-side without a scheduler. |
| A14 | Certificate PDF is rendered with pdf-lib inside the API (best effort at issue time, on demand at download) instead of a `certificate` queue job in the worker. Download uses a 5 minute presigned URL. | Smaller moving parts; the queue exists for later. |
| A15 | Mock payments only (`provider: "mock"`), seeded for revenue charts. There is no checkout. | Prompt marks payments optional. |
| A16 | `POST /api/live/:id/token` lets only the host publish. Students get subscribe + data-channel rights until the host grants publish through the LiveKit server API (`/grant`). Raise-hand and chat travel on LiveKit data topics `hand` and `chat`; chat is also stored in Mongo for late joiners. | Matches section 4. |
| A17 | The Socket.IO connection is not authenticated yet (rooms are only used for broadcast of `live:started`, `live:ended`, `live:message`). Chat history over REST is authenticated. | Known gap, listed in the README. |
| A18 | Video is not mocked. Seeded lessons have `video.status = ready` but no HLS files until `pnpm video:sample` pushes a real sample through the pipeline. | Section 9 rule. |
| A19 | Accent green, success green, warning amber and muted ink are darkened (#15803d, #15803d, #b45309, #64748b) from the brief's lighter values so white text and small text reach 4.5:1 contrast (requirement 5.7). Hue is unchanged. | Accessibility requirement beats exact brief hex. |
| A20 | Docker images use `node:22-slim` (present locally) instead of `node:20-alpine`. Debian is needed for `apt-get install ffmpeg` in the worker. Not built here: pnpm, npm packages, ffmpeg and the LiveKit image all need network at build time. | Offline mitigation. |
| A21 | `webstore/learnly` is the classroom implementation ported over, with its own compose project name `learnly-store` and shifted host ports. The previous scaffold is kept under `legacy/` untouched. | Single tested code base instead of two diverging ones. |
