#!/bin/bash

# Build script for local multi-platform Docker images
# Useful for testing on macOS before pushing to GitHub

set -e

BACKEND_IMAGE="pavelzagalsky/gcp-access-visualizer-backend"
FRONTEND_IMAGE="pavelzagalsky/gcp-access-visualizer-frontend"

# Detect local platform
LOCAL_PLATFORM=$(uname -m)
if [ "$LOCAL_PLATFORM" = "arm64" ]; then
    PLATFORM="linux/arm64"
elif [ "$LOCAL_PLATFORM" = "x86_64" ]; then
    PLATFORM="linux/amd64"
else
    echo "Unknown platform: $LOCAL_PLATFORM"
    exit 1
fi

echo "🔨 Building for platform: $PLATFORM"
echo ""

# Check if Docker Buildx is available
if ! docker buildx version &> /dev/null; then
    echo "❌ Docker Buildx is not available. Please install Docker Desktop or enable Buildx."
    exit 1
fi

# Create a builder instance if it doesn't exist
BUILDER_NAME="gcp-visualizer-builder"
if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
    echo "📦 Creating buildx builder instance..."
    docker buildx create --name "$BUILDER_NAME" --use
fi

docker buildx use "$BUILDER_NAME"

# Build backend
echo "🔨 Building backend image..."
docker buildx build \
    --platform "$PLATFORM" \
    --tag "$BACKEND_IMAGE:local" \
    --load \
    ./backend

# Build frontend
echo "🔨 Building frontend image..."
docker buildx build \
    --platform "$PLATFORM" \
    --tag "$FRONTEND_IMAGE:local" \
    --build-arg VITE_API_BASE_URL=/api \
    --load \
    ./frontend

echo ""
echo "✅ Build complete!"
echo ""
echo "Images built:"
echo "  - $BACKEND_IMAGE:local"
echo "  - $FRONTEND_IMAGE:local"
echo ""
echo "To use with docker-compose, update docker-compose.yml to use these image tags."

