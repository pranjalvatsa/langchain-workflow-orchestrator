# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY package*.json ./

# Clean npm cache and install dependencies
RUN npm cache clean --force && \
    npm install --verbose

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port (Render will set PORT environment variable)
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/health || exit 1

# Start the application
CMD ["npm", "start"]