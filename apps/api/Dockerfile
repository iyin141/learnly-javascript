# Base image node:22-slim is already present locally; pnpm and the npm packages are fetched at build time.
FROM node:22-slim AS builder
# openssl must be here too: prisma generate picks the query engine for the openssl it finds (3.0 on this base once it is installed)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm install -g pnpm@9.15.9

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false --filter @learnly/api...

COPY packages/shared packages/shared
COPY packages/db packages/db
RUN pnpm --filter @learnly/shared build && pnpm --filter @learnly/db build
COPY apps/api apps/api
RUN pnpm --filter @learnly/api build

# pnpm keeps per-package node_modules symlinks, so the runtime image is the whole workspace.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# the start command runs pnpm (migrations) and Prisma needs openssl
RUN npm install -g pnpm@9.15.9 && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app /app
USER node
EXPOSE 4000
# apply pending migrations (DIRECT_URL: Neon direct connection) and start; migrate deploy is a no-op when up to date
CMD ["sh", "-c", "pnpm --filter @learnly/db migrate && node apps/api/dist/index.js"]
