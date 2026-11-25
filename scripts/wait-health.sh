#!/usr/bin/env bash
# Uso: wait-health.sh <url> [intentos]
URL="$1"; INTENTOS="${2:-20}"
for i in $(seq 1 "$INTENTOS"); do
  if curl --fail --silent --max-time 3 "$URL" >/dev/null; then
    echo "OK: $URL responde (intento $i)"; exit 0
  fi
  echo "Esperando $URL (intento $i/$INTENTOS)..."; sleep 3
done
echo "FALLO: $URL no responde"; exit 1
