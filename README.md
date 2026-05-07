# Anonymous Confession Wall

Anonymous Confession Wall is a MERN stack app for posting and browsing anonymous confessions with comments, sessions, and Google OAuth. It ships with Docker Compose, Nginx for the frontend, and Prometheus + Node Exporter monitoring.

## Features
- Anonymous confessions and comments
- Session-based auth and optional Google OAuth
- Rate limiting, CORS allowlist, and secure headers
- Production-style Docker build (Nginx + Node)
- Monitoring with Prometheus + Node Exporter

## Tech Stack
- Frontend: React + Vite + Tailwind
- Backend: Express (ESM), Passport, MongoDB (Mongoose)
- Database: MongoDB 7
- Reverse proxy: Nginx
- Monitoring: Prometheus, Node Exporter
- CI/CD: Jenkins pipeline

## Architecture (Docker Compose)
- frontend (Nginx) -> /api proxy -> backend
- backend -> mongo
- prometheus -> node-exporter

## Requirements
- Docker Engine + Docker Compose v2
- Node.js 20+ (only for local dev)
- Fedora Linux supported

## Environment Variables
Create a root .env file (copy from .env.example):

```bash
cp .env.example .env
```

Required for backend:
- MONGO_URI
- SESSION_SECRET
- CLIENT_URL

Optional:
- MONGO_DB_NAME (only if MONGO_URI does not include a db name)
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_CALLBACK_URL

## Quick Start (Docker Compose)
```bash
docker compose up -d --build
docker compose ps
```

## Local Dev (Optional)
Backend:
```bash
cd Backend
npm install
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

## Monitoring
Prometheus and Node Exporter are included in docker-compose.yml.

- Prometheus UI: http://localhost:9090
- Prometheus targets: http://localhost:9090/targets
- Node Exporter metrics: http://localhost:9100/metrics

## CI/CD (Jenkins)
The Jenkins pipeline performs:
- Checkout
- docker compose down
- docker compose up -d --build
- docker compose ps

## Ports
- Frontend: 5173 (served by Nginx)
- Backend: 8000
- MongoDB: internal only
- Prometheus: 9090
- Node Exporter: 9100

## Troubleshooting
- Containers not running: `docker compose ps`
- View logs: `docker compose logs -f backend` (or any service)
- Prometheus target DOWN: open http://localhost:9100/metrics
- SELinux enforcing (Fedora): add :Z to bind mounts if Prometheus cannot read config
- CORS errors: ensure CLIENT_URL matches the frontend URL

## License
ISC
