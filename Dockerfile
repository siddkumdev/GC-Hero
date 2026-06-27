# syntax=docker/dockerfile:1

# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Secrets are injected at runtime via Cloud Run; build-time vars are harmless placeholders
# so Next.js can complete the build without real credentials.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    FIREBASE_PROJECT_ID=build-placeholder \
    FIREBASE_CLIENT_EMAIL=build-placeholder \
    FIREBASE_PRIVATE_KEY=build-placeholder \
    GEMINI_API_KEY=build-placeholder

RUN npm run build

# ── Stage 3: minimal runtime image ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# Non-root user for security.
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy only the standalone output + static assets.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
