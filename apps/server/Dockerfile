FROM node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/server/package.json ./apps/server/package.json
RUN npm install
COPY apps/server ./apps/server
RUN npm test --workspace @open-gardener/server
RUN npm run build --workspace @open-gardener/server

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY apps/server/package.json ./apps/server/package.json
RUN npm install --omit=dev
COPY --from=build /app/apps/server/dist ./apps/server/dist
RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 8000 8001
CMD ["node", "apps/server/dist/src/server.js"]
