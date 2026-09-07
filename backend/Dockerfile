# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN npx prisma generate && npm run build \
  && npx tsc scripts/create-admin.ts --outDir dist --rootDir . \
    --module commonjs --target ES2020 --esModuleInterop --skipLibCheck --moduleResolution node

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install prisma@^6.5.0 --no-save

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY db ./db
COPY scripts ./scripts

RUN chmod +x ./scripts/migrate-deploy.sh && mkdir -p uploads/custody uploads/tickets \
  && apk add --no-cache bash wget postgresql-client

EXPOSE 4000

CMD ["sh", "-c", "./scripts/migrate-deploy.sh && node dist/main.js"]
