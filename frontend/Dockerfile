FROM node:20-alpine AS builder

WORKDIR /app
# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
ARG VITE_API_URL
ARG VITE_MARTIN_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MARTIN_URL=$VITE_MARTIN_URL
RUN npm run build

# Setup Nginx server
FROM nginx:alpine
# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*
# Copy custom configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Cloud Run defaults to port 8080
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
