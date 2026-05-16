#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${1:-http://localhost:4000/api}"
WEBHOOK_URL="${API_BASE_URL}/webhooks/incoming"
LOGIN_URL="${API_BASE_URL}/auth/login"
LOGS_URL="${API_BASE_URL}/ai-logs"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: comando requerido no disponible -> $1"
    exit 1
  fi
}

require_cmd curl
require_cmd jq

echo "== E2E AI Flow: ejecutando webhooks de prueba =="

echo
echo "[Caso A] assetCode valido + falla"
curl -sS -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+5215551110001",
    "Body": "Hola soporte, AST-DEMO001 presenta falla critica de display y no inicia."
  }' | jq .

echo
echo "[Caso B] solo numero de serie"
curl -sS -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "fromEmail": "usuario@empresa.com",
    "subject": "Error de bateria",
    "body": "Favor revisar equipo con serial SN-DELL-7420-001, se apaga solo."
  }' | jq .

echo
echo "[Caso C] sin datos tecnicos"
curl -sS -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+5215551110002",
    "Body": "Tengo un problema urgente con mi equipo, ayudenme por favor."
  }' | jq .

echo
echo "== E2E AI Flow: consultando logs IA (admin) =="

LOGIN_RESPONSE="$(curl -sS -X POST "$LOGIN_URL" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@assetcore.local","password":"admin123"}')"

TOKEN="$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')"
if [[ -z "$TOKEN" ]]; then
  echo "Error: no se obtuvo token admin. Respuesta:"
  echo "$LOGIN_RESPONSE" | jq .
  exit 1
fi

LOGS_RESPONSE="$(curl -sS -X GET "$LOGS_URL" -H "Authorization: Bearer $TOKEN")"

TOTAL_MESSAGES="$(echo "$LOGS_RESPONSE" | jq '.logs | length')"
TICKETS_CREATED="$(echo "$LOGS_RESPONSE" | jq '[.logs[] | select(.createdTicket != null)] | length')"
NO_MATCH_MESSAGES="$(echo "$LOGS_RESPONSE" | jq '[.logs[] | select((.detectedAssetCode == null or .detectedAssetCode == "") and (.detectedSerialNumber == null or .detectedSerialNumber == ""))] | length')"

echo
echo "===== Resumen E2E AI ====="
echo "📥 Total Mensajes Recibidos: $TOTAL_MESSAGES"
echo "✅ Tickets Creados por IA: $TICKETS_CREATED"
echo "⚠️  Mensajes sin Match Tecnico: $NO_MATCH_MESSAGES"
echo "==========================="
