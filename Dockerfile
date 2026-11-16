# 一个容器同时提供网站 + Web 应用 + API
FROM node:22-bookworm-slim AS web
WORKDIR /src/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
ARG VITE_API_BASE=
ARG VITE_HOTLINE=60123456789
ARG VITE_APK_URL=/downloads/anxin-care.apk
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data WEB_DIR=/app/web
WORKDIR /app/server
COPY server/package*.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && npm ci --omit=dev && apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY server/ ./
COPY --from=web /src/web/dist /app/web
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "src/index.js"]
