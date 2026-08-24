# CodeTrace frontend — production image. Repo-root build context (same
# shared-types reason as backend/Dockerfile).

FROM node:22-slim AS builder

WORKDIR /build
COPY . .

# VITE_API_URL is baked into the built JS bundle at build time by Vite —
# it must be a build ARG, not a runtime environment variable. Setting it
# only in docker-compose.yml's `environment:` would silently do nothing.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm ci
RUN npm run build --workspace=shared/types
RUN npm run build --workspace=frontend

FROM nginx:alpine AS runtime

COPY --from=builder /build/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
