FROM node:22-slim AS builder
# openssl must be here too: prisma generate picks the query engine for the openssl it finds (3.0 on this base once it is installed)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm install -g pnpm@9.15.9

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile=false --filter @learnly/worker... --filter @learnly/api...

COPY packages/shared packages/shared
COPY packages/db packages/db
RUN pnpm --filter @learnly/shared build && pnpm --filter @learnly/db build
COPY apps/api apps/api
COPY apps/worker apps/worker
RUN pnpm --filter @learnly/worker build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# FFmpeg and ffprobe for the HLS pipeline (needs network at build time)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app /app
USER node
CMD ["node", "apps/worker/dist/worker/src/index.js"]
