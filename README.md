This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
# Copy example .env
cp .env.example .env

# Start database
docker-compose up -d postgres

# Run database migration
npx drizzle-kit migrate

# Run server
npm run build && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. All three security keys can be generated with:

```bash
openssl rand -hex 32
```

### Database

| Variable            | Description                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `POSTGRES_DB`       | PostgreSQL database name                                                                        |
| `POSTGRES_USER`     | PostgreSQL username                                                                             |
| `POSTGRES_PASSWORD` | PostgreSQL password                                                                             |
| `POSTGRES_PORT`     | Host port for PostgreSQL (default `5433`, container always uses `5432`)                         |
| `DATABASE_URL`      | Full connection string: `postgresql://USER:PASSWORD@HOST:PORT/DB` — must match the values above |

### Security Keys

| Variable              | Format                                        | Description                                                                                                                      |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`      | **Min 32 characters** (recommend 64-char hex) | HMAC-SHA256 signing key for session tokens. Sessions cannot be verified without it                                               |
| `TOTP_PENDING_KEY`    | **Exactly 64 hex characters** (32 bytes)      | AES-256-GCM wrapping key used during the 2FA login flow to temporarily protect the user's derived key                            |
| `RESOURCE_MASTER_KEY` | **Exactly 64 hex characters** (32 bytes)      | HKDF-SHA256 master key from which per-engagement encryption keys are derived. All scope data and file encryption depends on this |

`TOTP_PENDING_KEY` and `RESOURCE_MASTER_KEY` must be exactly 64 hex characters — the app will refuse to start otherwise. `SESSION_SECRET` must be at least 32 characters.

### Registration

| Variable            | Description                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `REGISTRATION_MODE` | `open` (anyone can register), `code` (requires security code), `invite` (requires invite link), or `disabled` (no registration) |
| `REGISTRATION_CODE` | Static code users must provide to register. Only required when `REGISTRATION_MODE=code`. Compared using timing-safe equality    |

### CAPTCHA (Captchacat)

| Variable              | Description                                                                       |
| --------------------- | --------------------------------------------------------------------------------- |
| `CAPTCHA_ENABLED`     | `true` or `false` — toggles CAPTCHA on auth pages                                 |
| `CAPTCHACAT_SITE_KEY` | Public site key from the Captchacat dashboard. Required when CAPTCHA is enabled   |
| `CAPTCHACAT_API_KEY`  | Secret API key for server-side token validation. Required when CAPTCHA is enabled |

### Upload Limits

| Variable                         | Description                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB` | Max upload size in MB (default `2048`). The `NEXT_PUBLIC_` prefix means this value is exposed to the browser |

## Docker Deployment

This application is fully containerized and production-ready. The deployment uses Docker Compose to orchestrate the Next.js app, PostgreSQL database, and Adminer for database management.

### Quick Start

1. **Generate required security keys:**

   ```bash
   # Generate three keys (SESSION_SECRET, TOTP_PENDING_KEY, RESOURCE_MASTER_KEY)
   openssl rand -hex 32
   openssl rand -hex 32
   openssl rand -hex 32
   ```

2. **Create `.env` file** with the following required variables:

   ```bash
   # Database (defaults work for development)
   POSTGRES_DB=redteam
   POSTGRES_USER=redteam
   POSTGRES_PASSWORD=redteam_dev_password
   POSTGRES_PORT=5433
   DATABASE_URL=postgresql://redteam:redteam_dev_password@localhost:5433/redteam

   # Security Keys (REQUIRED - use the generated keys from step 1)
   SESSION_SECRET=<64-char-hex-from-openssl>
   TOTP_PENDING_KEY=<64-char-hex-from-openssl>
   RESOURCE_MASTER_KEY=<64-char-hex-from-openssl>

   # Registration
   REGISTRATION_MODE=open  # or 'code', 'invite', 'disabled'
   REGISTRATION_CODE=      # only needed if REGISTRATION_MODE=code

   # CAPTCHA (optional)
   CAPTCHA_ENABLED=false
   CAPTCHACAT_SITE_KEY=
   CAPTCHACAT_API_KEY=
   ```

3. **Start the services:**

   ```bash
   docker-compose up -d
   ```

   This will:
   - Pull/build all necessary images
   - Start PostgreSQL on port 5433
   - Run database migrations automatically
   - Start the Next.js app on port 3000
   - Start Adminer (database UI) on port 10003

4. **Access the application:**
   - App: [http://localhost:3000](http://localhost:3000)
   - Adminer: [http://localhost:10003](http://localhost:10003)

### Container Architecture

- **postgres** (PostgreSQL 17): Database server with persistent volume (`pgdata`)
- **app** (Next.js): Multi-stage build with automatic migrations on startup
- **adminer**: Web-based database management interface

### Data Persistence

All data is stored in Docker volumes:

- `pgdata`: PostgreSQL database (survives container restarts)
- `appdata`: User uploads and avatars

**Important:** Your data is safe when restarting containers. Migrations are additive and idempotent — running `docker-compose up -d` with a new app version will only apply new schema changes without affecting existing data.

### Deployment Commands

```bash
# Start services in background
docker-compose up -d

# View logs
docker-compose logs -f app
docker-compose logs -f postgres

# Stop services (keeps data)
docker-compose stop

# Restart after code changes
docker-compose up -d --build app

# Stop and remove containers (keeps data)
docker-compose down

# DANGER: Remove containers AND volumes (deletes all data)
docker-compose down -v
```

### Updating to a New Version

```bash
# Pull latest code
git pull

# Rebuild and restart the app (migrations run automatically)
docker-compose up -d --build app
```

The entrypoint script automatically runs `drizzle-kit migrate` on startup, so new schema migrations are applied before the app starts.

### Health Checks

The app container includes a health check that pings `http://localhost:3000/` every 30 seconds. The PostgreSQL container also has a health check using `pg_isready`. View health status:

```bash
docker ps
```

### Security Notes for Production

1. **Change default passwords** in `.env` before deploying
2. **Use strong 64-character hex keys** for all three security variables
3. Set `REGISTRATION_MODE=invite` or `code` to restrict access
4. Enable CAPTCHA with `CAPTCHA_ENABLED=true`
5. Close Adminer port (remove from `docker-compose.yml`) or restrict via firewall
6. Use a reverse proxy (nginx/Traefik) with HTTPS/TLS
7. **Never commit `.env`** to version control

### Troubleshooting

**Migration errors on startup:**

```bash
# Check app logs
docker-compose logs app

# Manually run migrations
docker-compose exec app node ./node_modules/drizzle-kit/bin.cjs migrate
```

**Database connection refused:**

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check health
docker-compose exec postgres pg_isready -U redteam -d redteam
```

**Port conflicts:**

If port 3000, 5433, or 10003 are already in use, modify the ports in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Change host port (left side)
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
