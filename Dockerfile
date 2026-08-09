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

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# The deployed server drives its own headless Chromium now (the in-browser
# Turo connect flow — server/src/turo/browserSessions.js), not just the
# local CLI script, so the browser binary actually needs to be here.
# --with-deps pulls in the OS-level packages Chromium needs to run headless.
RUN npx playwright install --with-deps chromium

COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV PORT=4100
EXPOSE 4100

CMD ["node", "src/index.js"]
