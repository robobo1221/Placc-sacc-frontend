FROM node:22-alpine AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
ARG VITE_DJANGO_API_URL
ENV VITE_DJANGO_API_URL=$VITE_DJANGO_API_URL
RUN pnpm build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile && pnpm store prune

COPY --from=build /app/dist ./dist
COPY server.mjs ./

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "server.mjs"]
