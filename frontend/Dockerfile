# Frontend Dockerfile
# Builds the Vite app and serves it via nginx.

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

# Custom nginx config for SPA routing + /api reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static site
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
