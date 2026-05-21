#!/bin/bash

# Script para configurar baseline manual de Phase 0
# Uso: bash tests/setup-baseline.sh

echo "📊 Configuración Manual de Baseline - Phase 0"
echo "=============================================="
echo ""
echo "Este script crea un archivo baseline inicial."
echo "Los checksums se generarán durante la primera conversión de cada fixture."
echo ""

FIXTURES_DIR="tests/fixtures"
CHECKSUMS_FILE="tests/regression-checksums.json"

# Verificar que los fixtures existen
echo "✅ Verificando fixtures..."
if [ ! -d "$FIXTURES_DIR" ]; then
    echo "❌ Directorio $FIXTURES_DIR no existe"
    exit 1
fi

FIXTURE_COUNT=$(find "$FIXTURES_DIR" -name "*.docx" -type f | wc -l)
echo "   Encontrados: $FIXTURE_COUNT documentos DOCX"

if [ $FIXTURE_COUNT -lt 5 ]; then
    echo "⚠️  Se esperaban 5 fixtures, pero encontramos $FIXTURE_COUNT"
    echo "   Asegúrate de tener:"
    echo "   • simple.docx"
    echo "   • multipage.docx"
    echo "   • semantic.docx"
    echo "   • tables.docx"
    echo "   • themed.docx"
fi

echo ""
echo "📝 Creando estructura baseline..."

# Crear archivo baseline inicial (vacío)
cat > "$CHECKSUMS_FILE" << 'EOF'
{
  ".metadata": {
    "fixture": ".metadata",
    "description": "Baseline checksums para validación de regresión",
    "generated_at": "2026-05-21T10:00:00Z",
    "version": "baseline-v1",
    "fixtures_count": 5,
    "note": "Los checksums se generarán en la primera ejecución de tests"
  },
  "simple.docx": {
    "fixture": "simple.docx",
    "zip_sha256": "pending",
    "content_xml_sha256": "pending",
    "ode_xml_sha256": "pending",
    "generated_at": "2026-05-21T10:00:00Z",
    "version": "baseline-v1"
  },
  "multipage.docx": {
    "fixture": "multipage.docx",
    "zip_sha256": "pending",
    "content_xml_sha256": "pending",
    "ode_xml_sha256": "pending",
    "generated_at": "2026-05-21T10:00:00Z",
    "version": "baseline-v1"
  },
  "semantic.docx": {
    "fixture": "semantic.docx",
    "zip_sha256": "pending",
    "content_xml_sha256": "pending",
    "ode_xml_sha256": "pending",
    "generated_at": "2026-05-21T10:00:00Z",
    "version": "baseline-v1"
  },
  "tables.docx": {
    "fixture": "tables.docx",
    "zip_sha256": "pending",
    "content_xml_sha256": "pending",
    "ode_xml_sha256": "pending",
    "generated_at": "2026-05-21T10:00:00Z",
    "version": "baseline-v1"
  },
  "themed.docx": {
    "fixture": "themed.docx",
    "zip_sha256": "pending",
    "content_xml_sha256": "pending",
    "ode_xml_sha256": "pending",
    "generated_at": "2026-05-21T10:00:00Z",
    "version": "baseline-v1"
  }
}
EOF

if [ -f "$CHECKSUMS_FILE" ]; then
    echo "✅ Archivo baseline creado: $CHECKSUMS_FILE"
    echo ""
    echo "📋 Estructura lista para Phase 0:"
    echo "   tests/fixtures/              ✅ (5 documentos DOCX)"
    echo "   tests/regression-checksums.json ✅ (estructura baseline)"
    echo "   tests/validate-regression.ts    ✅ (validador)"
    echo "   tests/generate-checksums.ts     ✅ (generador)"
    echo ""
    echo "🎯 Próximos pasos:"
    echo "   1. Convertir manualmente cada DOCX a ELPX desde la UI"
    echo "   2. O ejecutar convertDocxToElpx() desde tests"
    echo "   3. Actualizar checksums.json con los hashes reales"
    echo "   4. Commit Phase 0"
    echo ""
else
    echo "❌ Error creando $CHECKSUMS_FILE"
    exit 1
fi
