# biotech-frontend: Next.js 15 + React 19
# Multi-stage build: deps → builder → runner (standalone output)

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS builder
LABEL BUILD_TS_BUST=1777152800
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Force fresh Next.js build (clear any stale .next cache)
RUN rm -rf .next
ARG NEXT_PUBLIC_API_URL=https://biotech-api-production-7ec4.up.railway.app
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
# Bind to Railway-injected $PORT, fall back to 3000 locally
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 PORT=${PORT:-3000} node server.js"]
