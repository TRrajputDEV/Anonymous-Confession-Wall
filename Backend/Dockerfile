# Backend Dockerfile
# Runs the Express server (ESM) in a small Node image.

FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source
COPY src ./src

EXPOSE 8000

CMD ["node", "src/server.js"]
