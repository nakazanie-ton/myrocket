FROM node:20-alpine AS build

WORKDIR /app

COPY plugins/xrocket-exchange/package.json plugins/xrocket-exchange/package-lock.json ./
RUN npm ci

COPY plugins/xrocket-exchange/tsconfig.json ./
COPY plugins/xrocket-exchange/src ./src
RUN npm run build

FROM node:20-alpine AS stdio

ENV NODE_ENV=production \
    XROCKET_PROFILE=public \
    XROCKET_ENVIRONMENT=mainnet \
    XROCKET_ENABLE_TRADING=false \
    XROCKET_ENABLE_TRANSFERS=false \
    XROCKET_ENABLE_WITHDRAWALS=false \
    XROCKET_ALLOW_MAINNET_WRITES=false

WORKDIR /app

COPY --from=build --chown=node:node /app/dist ./dist

USER node

ENTRYPOINT ["node", "dist/cli.js"]

FROM node:20-alpine AS hosted

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /app/dist/hosted.js ./dist/hosted.js

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||'3000')+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["node", "dist/hosted.js"]
