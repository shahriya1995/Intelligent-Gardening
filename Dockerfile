FROM node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json* tsconfig.json ./
RUN npm install
COPY src ./src
COPY tests ./tests
RUN npm test
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist/src ./dist
RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 8000 8001
CMD ["node", "dist/server.js"]
