FROM node:20-alpine AS build

WORKDIR /app

COPY plugins/xrocket-exchange/package.json plugins/xrocket-exchange/package-lock.json ./
RUN npm ci

COPY plugins/xrocket-exchange/tsconfig.json ./
COPY plugins/xrocket-exchange/src ./src
RUN npm run build

FROM node:20-alpine AS runtime

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
