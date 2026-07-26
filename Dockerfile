# ---- Build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++   # build better-sqlite3 si pas de prebuilt
COPY package.json package-lock.json* ./
# npm 10.8.2 (embarqué dans node:20-alpine) crashe avec "Exit handler never called!"
# sur VPS à faible RAM → on met à jour npm AVANT l'install (bug corrigé dans npm 11).
RUN npm install -g npm@11 --no-audit --no-fund \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set maxsockets 3 \
 && (npm ci --no-audit --no-fund --loglevel=error \
     || (echo "npm ci a échoué, nettoyage du cache et nouvelle tentative…" \
         && npm cache clean --force \
         && npm ci --no-audit --no-fund --loglevel=error)) \
 && test -x node_modules/.bin/next \
 && test -d node_modules/better-sqlite3
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536
RUN npm run build

# ---- Runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/app/data
RUN addgroup -S flydeal && adduser -S flydeal -G flydeal

# Output standalone Next.js + node_modules natifs (better-sqlite3 doit être reconstruit/présent)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# better-sqlite3 est externe au bundle standalone : on copie son module natif
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings

RUN mkdir -p /app/data && chown -R flydeal:flydeal /app/data
USER flydeal
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
