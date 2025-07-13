FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install ffmpeg for audio processing
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/
COPY assets/ ./assets/

# Create required directories
RUN mkdir -p temp output

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Start the application
CMD ["npm", "start"]
