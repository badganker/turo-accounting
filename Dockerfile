# ---- client build ----
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- server (this is what actually runs) ----
FROM node:20-slim AS server
WORKDIR /app/server

# better-sqlite3 builds a native addon if no prebuilt binary matches this
# platform/Node version.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# The deployed server never runs the interactive Turo login itself (no
# display) — that happens locally via `npm run connect:turo` — so skip
# downloading Chromium here; playwright the npm package is still installed
# since server/src/turo/interactiveLogin.js imports it, but the ~300MB
# browser binary would be dead weight on this image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV PORT=4100
EXPOSE 4100

CMD ["node", "src/index.js"]
