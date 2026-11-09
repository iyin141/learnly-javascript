# Learnly (classroom)

Learning platform with live classes. Next.js 16 (App Router, React 19, Tailwind 4, Redux Toolkit), Express + Socket.IO API, BullMQ + FFmpeg worker, MongoDB, Redis, MinIO (S3), an nginx CDN cache (CloudFront stand-in) and LiveKit (WebRTC).

> Status: written offline-constrained. See "What is untested" before relying on anything here.

## Run

```bash
cp .env.example .env        # dev values only
docker compose up -d --build
pnpm install && pnpm seed   # demo data (needs MONGO_URI pointing at the published Mongo port, see below)
```

Compose project name: `learnly`. Host ports:

| Service | URL / port |
|---|---|
| Gateway (web + api + cdn + mail) | http://localhost:80 |
| MinIO S3 API / console | http://localhost:9000 / http://localhost:9091 |
| Mailpit UI / SMTP | http://localhost:8025 / 1025 |
| MongoDB / Redis (localhost only) | 27017 / 6379 |
| LiveKit signalling / TCP / UDP media | ws://localhost:7880 / 7881 / 50000-50100 |

`pnpm seed` from the host: `MONGO_URI=mongodb://127.0.0.1:27017/learnly pnpm seed`.

## Demo logins (password `password123`)

| Role | Email |
|---|---|
| Admin | admin@learnly.local |
| Instructor | instructor@learnly.local (also elena@ and marcus@learnly.local) |
| Student | student@learnly.local (plus student2 to student25; student2 has a completed course and a certificate, code LRN-2026-DEMO0001) |

## Architecture

```
Browser -> nginx gateway -> web (Next 16)           pages, rewrites /api to the api
                         -> api (Express, Socket.IO) REST, quizzes, certificates, live tokens
                         -> /cdn -> cdn (nginx cache, secure_link) -> minio
                         -> /mail -> mailpit
api -> mongo, redis, minio, livekit (server API)
worker (BullMQ) -> ffmpeg HLS ladders, email and reminder queues
Browser <-> livekit (WebRTC, direct to the published ports)
```

Video: upload (S3 multipart) -> `video` queue -> FFmpeg -> `learnly-media/hls/...` -> `GET /api/lessons/:id/playback` returns a signed `/cdn/...m3u8` URL and sets signed cookies for segments. The second request for a segment returns `X-Cache: HIT`.

## Swapping the local pieces for the real thing

- **MinIO to AWS S3:** set `S3_ENDPOINT` (blank or the regional endpoint), `S3_PUBLIC_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE=false` and the three bucket names. Code uses only AWS SDK v3. Keep `learnly-media` private and let CloudFront read it through OAC (the local bucket is anonymously readable only so nginx can proxy it, see ASSUMPTIONS A6).
- **nginx CDN to CloudFront:** set `CDN_SIGNER=cloudfront` and add the key pair id and private key; the `CdnSigner` interface has the nginx implementation today. `CloudFrontSigner` in `apps/api/src/services/cdn.ts` is a placeholder that returns dummy values; implement it with `@aws-sdk/cloudfront-signer` first. Playback URL shape stays the same for the player.
- **LiveKit to LiveKit Cloud:** set `LIVEKIT_URL` (https/wss project URL for the server API), `LIVEKIT_PUBLIC_URL` (wss URL the browser uses), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Remove the `livekit` compose service. **The dev key pair in `.env.example` is public: change it for anything real.**

## Docker Desktop and WebRTC (important)

WebRTC media goes over UDP/TCP directly to LiveKit, not through nginx. On Docker Desktop (Windows/macOS) the container sits behind a VM, so:

1. Publish the TCP and UDP ports (done in compose: the UDP range above plus the TCP port). The range must match LiveKit's `rtc.port_range_*` (set through `LIVEKIT_CONFIG` in compose).
2. If two browsers on the same machine can sign in to a room but show no video, set `rtc.use_external_ip: false` and `rtc.node_ip: 127.0.0.1` (or your LAN IP) in `LIVEKIT_CONFIG`, then restart the `livekit` service. For other devices on your LAN use the LAN IP and open the app through it.
3. Host networking (`network_mode: host`) works on Linux but not reliably on Docker Desktop, so it is not used.
4. Camera and microphone need a secure context: use `http://localhost`, not a LAN IP over plain http (or put TLS in front).
5. TURN is not configured. Strict corporate NATs may need it.

## Tests

- `pnpm test` runs the api unit tests (quiz scoring, completion rule) and `apps/api/test/auth.test.ts` (needs MongoDB on `MONGO_URI`, default test db `learnly_test`).
- Visual tests: `pnpm test:visual` (Playwright, 1440 px and 390 px) compares each route with `design/stitch/*/screen.png`. It reports differences; never run it with `--update-snapshots`. Needs `pnpm exec playwright install chromium`, the stack running and the seed loaded.

## Accessibility notes

Skip link, labelled nav landmarks and form fields, visible focus ring, reduced-motion support, 44 px targets on interactive controls, a captions slot in the player, keyboard shortcuts in the player (space/k, arrows, m, f, < >). Accent greens and muted text were darkened for 4.5:1 contrast (ASSUMPTIONS A19). No automated axe run has been done.

## What is untested (honest list)

Everything below was written without being able to install dependencies or pull images, so none of it has been compiled or run:

- TypeScript compile of the web, api and worker (`pnpm -r build`) and all unit/integration tests.
- Docker builds of api, worker and web (base `node:22-slim` is local; pnpm, packages, ffmpeg and the LiveKit image need network). `docker compose config` validates the files only.
- The LiveKit room, raise-hand queue, mic grant, chat persistence and attendance, with real browsers.
- hls.js playback, signed-URL refresh and resume against a real transcoded video; the CDN `X-Cache: HIT` check.
- Quiz timer enforcement end to end, certificate PDF issue and the presigned download, verify page.
- Email and reminder workers against Mailpit.
- Playwright specs and the visual comparison.

Not implemented: the CloudFront signer, bull-board UI (there are JSON queue endpoints at `/api/admin/queues/*`), the `--profile recording` LiveKit Egress service, OpenAPI coverage of the new routes, authenticated Socket.IO, Calendar/To-do/Archived/Settings pages, and the code-panel/whiteboard/notes parts of the lesson and live-room mockups.
