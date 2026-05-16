#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-http://localhost:4000/api/webhooks/incoming}"

echo "== Caso A: assetCode valido (AST-DEMO001) reportando falla =="
curl -sS -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+5215551110001",
    "Body": "Hola soporte, el equipo AST-DEMO001 tiene falla critica de pantalla y no inicia."
  }' | jq .

echo
echo "== Caso B: mensaje solo con numero de serie =="
curl -sS -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "fromEmail": "usuario@empresa.com",
    "subject": "Laptop con error de bateria",
    "body": "Reporte de falla en SN-DELL-7420-001, favor generar ticket."
  }' | jq .

echo
echo "== Caso C: mensaje sin datos tecnicos =="
curl -sS -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+5215551110002",
    "Body": "Necesito ayuda urgente con mi equipo, no se que tiene."
  }' | jq .

echo
echo "Prueba finalizada. Revisa /api/ai-logs para confirmar auditoria en incoming_messages."
