FROM node:20-alpine AS builder

WORKDIR /app
# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
ARG VITE_API_URL
ARG VITE_MARTIN_URL
ARG VITE_MAPTILER_KEY
ARG VITE_E2E_TEST
ARG VITE_FARO_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MARTIN_URL=$VITE_MARTIN_URL
ENV VITE_MAPTILER_KEY=$VITE_MAPTILER_KEY
ENV VITE_E2E_TEST=$VITE_E2E_TEST
ENV VITE_FARO_URL=$VITE_FARO_URL
RUN npm run build

# Setup Nginx server
FROM nginx:alpine

# Pass ARGs down and export as ENVs for envsubst
ARG VITE_API_URL
ARG VITE_MARTIN_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MARTIN_URL=$VITE_MARTIN_URL

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*
# Copy custom configuration as a template for envsubst
COPY nginx.conf /etc/nginx/templates/default.conf.template
# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Cloud Run defaults to port 8080
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
