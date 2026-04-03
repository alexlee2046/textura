FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
# Use China mirrors: npmmirror for npm packages, npmmirror for Prisma engines
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
RUN --mount=type=cache,id=textura-npm,target=/root/.npm \
    npm config set registry https://registry.npmmirror.com && npm ci --legacy-peer-deps

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client (cache engines download)
RUN --mount=type=cache,target=/root/.cache/prisma \
    npx prisma generate
# Build with Next.js incremental cache
RUN --mount=type=cache,id=textura-next,target=/app/.next/cache \
    npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create directory for generated images and fix permissions
RUN mkdir -p /app/public/generated && \
    chown -R nextjs:nodejs /app && \
    chmod -R u+w /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
