# syntax=docker/dockerfile:1.7
# Airline.live web imajı (Next.js standalone). Derleme bağlamı: repo kökü.
FROM node:24-slim AS base
ENV CI=true NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@12.6.0 turbo@2.11.3 && npm cache clean --force

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN turbo prune @havayolu/web --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json ./
RUN turbo run build --filter=@havayolu/web

FROM node:24-slim AS runner
ARG GIT_SHA=dev
ARG BUILD_TIME=
ENV NODE_ENV=production \
    APP_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}
WORKDIR /app
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public
COPY --chown=node:node apps/web/healthcheck.mjs ./healthcheck.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=15s --retries=3 CMD ["node", "healthcheck.mjs"]
CMD ["node", "apps/web/server.js"]
