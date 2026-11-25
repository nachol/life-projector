# Life Projector — projection mapping server
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    HTTPS_PORT=8443 \
    DATA_DIR=/data

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY public ./public

RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080 8443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "server/index.js"]
