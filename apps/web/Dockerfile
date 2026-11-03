FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@9.15.9

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile=false

COPY packages/shared ./packages/shared
RUN pnpm --filter @learnly/shared build

COPY apps/web ./apps/web
RUN pnpm --filter @learnly/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared/package.json ./packages/shared/package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node_modules/.bin/next", "start", "apps/web", "-p", "3000"]
