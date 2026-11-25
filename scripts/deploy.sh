#!/usr/bin/env bash
# Uso: deploy.sh <staging|prod> <tag> <puerto>
set -euo pipefail
ENV_NAME="$1"; TAG="$2"; PORT="$3"
export ENV_NAME IMAGE_TAG="$TAG" APP_PORT="$PORT"

docker network create cicd-net >/dev/null 2>&1 || true

# Guarda la version que esta corriendo como "previous" para poder hacer rollback
CURRENT=$(docker inspect --format '{{.Image}}' "restaurante-${ENV_NAME}-app" 2>/dev/null || true)
if [ -n "$CURRENT" ]; then
  docker tag "$CURRENT" "restaurante-api:${ENV_NAME}-previous"
  echo "Version anterior guardada como restaurante-api:${ENV_NAME}-previous"
fi

echo "Desplegando restaurante-api:${TAG} en ${ENV_NAME} (puerto ${PORT})"
docker compose -p "restaurante-${ENV_NAME}" -f docker-compose.app.yml up -d --remove-orphans
