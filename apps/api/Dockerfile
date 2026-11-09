# Base image node:22-slim is already present locally; pnpm and the npm packages are fetched at build time.
FROM node:22-slim AS builder
WORKDIR /app
RUN npm install -g pnpm@9.15.9

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false --filter @learnly/api...

COPY packages/shared packages/shared
RUN pnpm --filter @learnly/shared build
COPY apps/api apps/api
RUN pnpm --filter @learnly/api build

# pnpm keeps per-package node_modules symlinks, so the runtime image is the whole workspace.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app /app
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
