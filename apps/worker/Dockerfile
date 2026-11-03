FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@9.15.9

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile=false

COPY packages/shared ./packages/shared
RUN pnpm --filter @learnly/shared build

COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
RUN pnpm --filter @learnly/worker build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install FFmpeg and ffprobe
RUN apk add --no-cache ffmpeg

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=nodejs:nodejs /app/apps/api ./apps/api
COPY --from=builder --chown=nodejs:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/worker/package.json ./apps/worker/package.json

USER nodejs
CMD ["node", "apps/worker/dist/index.js"]
