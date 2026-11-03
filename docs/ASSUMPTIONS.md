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
