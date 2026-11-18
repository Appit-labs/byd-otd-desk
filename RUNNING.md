# BYD OTD Tracker — Running Instructions

## Prerequisites

- Node.js 22+
- Docker & Docker Compose (for containerized setup)
- MySQL 8 (for local dev without Docker)

## Quick Start (Docker Compose — Production)

1. Clone the repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` — set `JWT_SECRET` to a random string and `MYSQL_ROOT_PASSWORD` to a secure password
4. Build and start:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
5. Access the application at **http://localhost**
6. Login with default credentials: **superadmin** / **Admin@123**

> **Important:** The production compose file does not mount source code as volumes. To rebuild after code changes, run `docker compose -f docker-compose.prod.yml build` and then `docker compose -f docker-compose.prod.yml up -d`.

## Quick Start (Docker Compose — Development)

```bash
docker compose up -d
```

This starts MySQL and the backend with live-reload via mounted source volumes. The backend is accessible at `http://localhost:3000`.

## Local Development (Without Docker)

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env if needed (DB_HOST=localhost should work)
npm install
# Ensure MySQL is running with the correct credentials
npm run seed
npm run start:dev
```

The backend starts on **http://localhost:3000**.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server starts on **http://localhost:5173** and proxies `/api` requests to `http://localhost:3000`.

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `Admin@123` |

Create additional users via **Settings > User Management** after logging in.

## API Documentation

Swagger UI is available at **http://localhost:3000/api-docs** (when the backend is running, in either dev or production mode).

## Architecture

| Component | Technology | Dev Port | Prod Port |
|-----------|------------|----------|-----------|
| Backend | NestJS + Fastify | 3000 | 3000 (container) |
| Frontend | React + Vite | 5173 | 80 (via nginx) |
| Database | MySQL 8.0 | 3306 | 3306 (container) |
| Auth | JWT (8h expiry), bcrypt (12 rounds) | — | — |

### Service Diagram

```
Browser ──:80──> nginx ──/api──> backend:3000 ──> mysql:3306
                 │
                 └── serve static SPA (index.html)
```

## Environment Variables

### Root `.env` (used by `docker-compose.prod.yml`)

| Variable | Description | Default |
|----------|-------------|---------|
| `MYSQL_ROOT_PASSWORD` | MySQL root password | *(required)* |
| `MYSQL_DATABASE` | MySQL database name | `byd_otd_desk` |
| `DB_USERNAME` | Database username | `root` |
| `DB_PASSWORD` | Database password | *(same as MYSQL_ROOT_PASSWORD)* |
| `DB_DATABASE` | Database name | `byd_otd_desk` |
| `JWT_SECRET` | Secret key for JWT signing | *(required — change in production)* |
| `JWT_EXPIRY` | JWT token expiration duration | `8h` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Backend port | `3000` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost` |
| `SEED_ADMIN_PASSWORD` | Default admin password (used on seed) | `Admin@123` |

### Backend `.env` (used by local dev and development `docker-compose.yml`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USERNAME` | Database user | `root` |
| `DB_PASSWORD` | Database password | `root` |
| `DB_DATABASE` | Database name | `byd_otd_desk` |
| `DB_SYNC` | TypeORM auto-sync (dev only) | `false` |
| `DB_LOGGING` | TypeORM SQL logging | `false` |
| `JWT_SECRET` | Secret key for JWT signing | *(required)* |
| `JWT_EXPIRY` | JWT token expiration | `8h` |

## Common Tasks

### Viewing logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
```

### Rebuilding after code changes

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Stopping services

```bash
docker compose -f docker-compose.prod.yml down
```

To also remove the database volume (deletes all data):

```bash
docker compose -f docker-compose.prod.yml down -v
```

### Running database migrations

```bash
cd backend
npm run migration:run
```

### Seeding the database

```bash
cd backend
npm run seed
```
