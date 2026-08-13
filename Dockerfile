# ---- builder: install deps and run tests ----
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chown -R node:node /app

USER node

CMD ["npm", "test"]

# ---- runner: production image (tests only for this homework) ----
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/src ./src
COPY --from=builder /app/test ./test
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/vitest.config.ts ./vitest.config.ts

USER node

CMD ["npm", "test"]
