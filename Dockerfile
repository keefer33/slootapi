FROM node:18-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (including dev dependencies for TypeScript compilation)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose the port the app runs on
EXPOSE 3001

# Add streaming optimizations
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Command to run the application
CMD ["node", "dist/index.js"]
