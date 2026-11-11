FROM node:22-slim AS builder
WORKDIR /app
RUN npm install -g pnpm@9.15.9

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile=false --filter @learnly/web...

COPY packages/shared packages/shared
RUN pnpm --filter @learnly/shared build
COPY apps/web apps/web
ARG NEXT_BASE_PATH=""
ENV NEXT_BASE_PATH=$NEXT_BASE_PATH NEXT_PUBLIC_BASE_PATH=$NEXT_BASE_PATH NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @learnly/web build

FROM node:22-slim
WORKDIR /app/apps/web
ENV NODE_ENV=production PORT=3000
COPY --from=builder --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
