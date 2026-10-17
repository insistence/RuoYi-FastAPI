FROM node:22-slim AS builder
ENV TZ=UTC
WORKDIR /app
RUN npm install --global pnpm@11.22.0
COPY package.json pnpm-workspace.yaml ./
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm build:docker

FROM nginx:stable-alpine
ENV TZ=UTC
ARG NGINX_CONFIG=bin/nginx.dockermy.conf
COPY ${NGINX_CONFIG} /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
