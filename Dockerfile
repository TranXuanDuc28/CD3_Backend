# Base image
FROM node:18-alpine

# Set working directory
WORKDIR /duc/backend

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

RUN npm install -g @babel/core @babel/cli

# Copy the rest of the project
COPY . .

# Build app (Next.js sẽ tạo .next/)
RUN npm run build-src

# Start the app
CMD ["npm","run", "build"]
