FROM node:20-slim AS builder

WORKDIR /app

# Copy server package files
COPY packages/server/package.json ./packages/server/
WORKDIR /app/packages/server
RUN npm install

# Build TypeScript
COPY packages/server/tsconfig.json ./
COPY packages/server/src/ ./src/
RUN npm run build

# Production image
FROM node:20-slim

WORKDIR /app

COPY packages/server/package.json ./
RUN npm install --omit=dev

# Built JS
COPY --from=builder /app/packages/server/dist/ ./dist/

# Meta data
COPY packages/server/data/ ./data/

# Update script + tsx for nightly cron
COPY scripts/update-meta.ts ./scripts/
RUN npm install -g tsx

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/index.js"]
