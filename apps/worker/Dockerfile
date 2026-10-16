# syntax=docker/dockerfile:1.7
# Airline.live worker imajı (hy-worker-rt, hy-worker-bg ve hy-migrate aynı imajı kullanır).
# Derleme bağlamı: repo kökü (docker build -f apps/worker/Dockerfile .).
FROM node:24-slim AS base
ENV CI=true
RUN npm install -g pnpm@12.6.0 turbo@2.11.3 && npm cache clean --force

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN turbo prune @havayolu/worker --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json ./
RUN turbo run build --filter=@havayolu/worker

FROM node:24-slim AS runner
ARG GIT_SHA=dev
ARG BUILD_TIME=
ENV NODE_ENV=production \
    APP_ENV=production \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}
WORKDIR /app
COPY --from=builder --chown=node:node /repo/apps/worker/dist ./dist
# hy-migrate: node packages/db/dist/migrate.js (migration SQL'leri drizzle/ klasöründen okunur)
COPY --from=builder --chown=node:node /repo/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=node:node /repo/packages/db/drizzle ./packages/db/drizzle
COPY --chown=node:node apps/worker/healthcheck.mjs ./healthcheck.mjs
USER node
EXPOSE 4200
HEALTHCHECK --interval=5s --timeout=3s --start-period=15s --retries=3 CMD ["node", "healthcheck.mjs"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
