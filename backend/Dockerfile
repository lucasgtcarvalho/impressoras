FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libssl3
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install --package-lock-only
COPY . .
RUN npx prisma generate --schema=src/database/prisma/schema.prisma && npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libssl3
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/database/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1 && node dist/main"]
