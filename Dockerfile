# Stage 1: build app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files & install dependencies
COPY package*.json ./
RUN npm install
RUN npm install -g @babel/core @babel/cli

# Copy source & build
COPY . .
RUN npm run build-src

# Stage 2: production image
FROM node:18-alpine

WORKDIR /app

# Copy only built artifacts and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./

# Expose port backend
EXPOSE 3000

# Run app
CMD ["npm", "run", "start:prod"]
