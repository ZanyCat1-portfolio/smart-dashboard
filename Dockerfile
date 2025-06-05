# === Build Stage ===
FROM node:20 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
RUN VITE_BASE_PATH=$VITE_BASE_PATH npm run build

# === Production Stage ===
FROM node:20-slim
WORKDIR /app

# Copy built frontend and public assets
COPY --from=builder /app/dist    ./dist
COPY --from=builder /app/public  ./public

# Copy the backend entrypoint and its helper
COPY --from=builder /app/proxy-server.cjs   ./
COPY --from=builder /app/verify-devices.js  ./

# Copy package.json & lockfile so we can install only runtime deps
COPY package*.json ./

# Install only "dependencies" (no devDependencies)
RUN npm install --omit=dev

EXPOSE 8080

CMD ["node", "proxy-server.cjs"]
