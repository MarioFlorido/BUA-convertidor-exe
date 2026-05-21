/**
 * Script para generar baseline de regresión
 *
 * IMPORTANTE: Se ejecuta ANTES de cualquier refactorización
 * Genera checksums de referencia para validar cambios posteriores
 *
 * Uso:
 *   npx ts-node tests/generate-baseline.ts
 *
 * Genera:
 *   tests/regression-checksums.json (archivo de checksums de referencia)
 *   tests/snapshots/baseline/   (ELPX completos de referencia)
 */

import fs from 'fs';
import path from 'path';

const checksumsPath = path.join(__dirname, 'regression-checksums.json');
const snapshotsDir = path.join(__dirname, 'snapshots/baseline');
const fixturesDir = path.join(__dirname, 'fixtures');

/**
 * Template de checksums vacío (será llenado cuando ejecutes conversiones)
 */
const EMPTY_BASELINE: Record<string, any> = {
  '.metadata': {
    description: 'Checksums de referencia para regresión arquitectónica',
    generated_at: new Date().toISOString(),
    phase: 'baseline-setup',
    note: 'Ejecuta tests/generate-checksums-from-conversion.ts después de crear fixtures',
    version: 'baseline-v1'
  }
};

console.log('🧪 Generador de Baseline - Regresión Arquitectónica\n');
console.log('Este script prepara la infraestructura para baseline testing.\n');

// Verificar directorios
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
  console.log(`✅ Creado: ${snapshotsDir}`);
}

if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
  console.log(`✅ Creado: ${fixturesDir}`);
}

// Crear archivo inicial de checksums
fs.writeFileSync(checksumsPath, JSON.stringify(EMPTY_BASELINE, null, 2));
console.log(`✅ Creado: ${checksumsPath}\n`);

// Instrucciones
console.log('📋 PRÓXIMOS PASOS:\n');
console.log('1. Coloca documentos de prueba (.docx) en:');
console.log(`   ${fixturesDir}/\n`);
console.log('   Necesarios (mínimo):');
console.log('   - simple.docx (1 H1, contenido básico)');
console.log('   - multipage.docx (múltiples H1/H2)');
console.log('   - semantic.docx ([ejemplo], [definición], [importante])');
console.log('   - tables.docx ([horizontal], [vertical] tables)\n');

console.log('2. Ejecuta la conversión actual para crear snapshots:');
console.log('   npm run test:baseline:convert\n');

console.log('3. Verifica los checksums:');
console.log(`   cat ${checksumsPath}\n`);

console.log('4. Haz commit del baseline:');
console.log('   git add tests/regression-checksums.json tests/snapshots/baseline/');
console.log('   git commit -m "Phase 0: Regression testing baseline"\n');

console.log('IMPORTANTE:');
console.log('- NO modifiques regression-checksums.json manualmente');
console.log('- El baseline debe reflejar el comportamiento ACTUAL (que funciona)');
console.log('- Cualquier refactorización debe mantener estos checksums idénticos');
console.log('- Si falla validación: investigar diferencia o revert el cambio\n');
