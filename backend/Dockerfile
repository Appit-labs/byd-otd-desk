FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --workspace=backend

COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./backend/
COPY backend/src ./backend/src
RUN npm run build --workspace=backend

FROM node:24-alpine AS production

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --workspace=backend --production

COPY --from=builder /app/backend/dist ./backend/dist

EXPOSE 3000

CMD ["node", "backend/dist/main.js"]
