#!/usr/bin/env bash
# Uso: rollback.sh <staging|prod>
set -euo pipefail
ENV_NAME="$1"
PORT=$([ "$ENV_NAME" = "prod" ] && echo 3002 || echo 3001)
if ! docker image inspect "restaurante-api:${ENV_NAME}-previous" >/dev/null 2>&1; then
  echo "No existe version anterior para ${ENV_NAME}: no se puede hacer rollback"; exit 1
fi
export ENV_NAME IMAGE_TAG="${ENV_NAME}-previous" APP_PORT="$PORT"
echo "ROLLBACK de ${ENV_NAME} a restaurante-api:${IMAGE_TAG}"
docker compose -p "restaurante-${ENV_NAME}" -f docker-compose.app.yml up -d
