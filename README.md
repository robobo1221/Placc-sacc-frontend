# Placc-sacc-frontend

Frontend for Placc Zacc, built with TanStack Start, MUI, and TanStack Query.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

Create `.env` from `.env.example` only when the Django API is hosted on a
different origin. The default API location is the same-origin `/api` path.

## Self-hosting

The production build contains a server-rendered application and static client
assets. Build it, then run the included Node server:

```bash
pnpm install --frozen-lockfile
pnpm build
HOST=127.0.0.1 PORT=3000 pnpm start
```

The server exposes `GET /health` for container and load-balancer health checks.
Place Nginx, Caddy, or another TLS reverse proxy in front of it. Route `/api/`
to Django and all other paths to this frontend. A baseline Nginx configuration
is available at `deploy/nginx.conf`.

Use HTTPS in production: browser geolocation is unavailable on non-secure
origins, apart from localhost.

### Docker

```bash
docker build -t placc-sacc-frontend .
docker run --rm -p 3000:3000 placc-sacc-frontend
```

For a separate API origin, pass its public API URL while building the image:

```bash
docker build \
  --build-arg VITE_DJANGO_API_URL=https://api.example.com/api \
  -t placc-sacc-frontend .
```

For a same-origin deployment, leave `VITE_DJANGO_API_URL` unset at build time
and proxy `/api/` to Django. If the API is on another domain, set
`VITE_DJANGO_API_URL` to its public `/api` URL at build time and configure
Django CORS for the frontend origin. `VITE_*` values are public client
configuration, not secret storage.

## Cloudflare Workers

This app can run on Cloudflare Workers through `wrangler.jsonc`. Wrangler is
needed for local Worker testing and deployment:

```bash
pnpm cf:dry-run
pnpm cf:dev
pnpm cf:deploy
```

The Worker serves static assets from `dist/client`, falls back to the TanStack
Start SSR handler, and exposes `GET /health`. Set the Cloudflare
`DJANGO_API_URL` variable to the public Django `/api` URL when you want the
Worker to proxy same-origin `/api/*` requests.
