FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_API_URL
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY package.json package-lock.json ./
COPY frontend ./frontend
RUN npm run build --workspace frontend

FROM nginx:alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
