/**
 * Script de validación de regresión arquitectónica
 *
 * Uso:
 *   npx ts-node tests/validate-regression.ts [phase] [fixture]
 *   npx ts-node tests/validate-regression.ts 1 simple.docx
 *   npx ts-node tests/validate-regression.ts baseline
 *
 * Genera checksums SHA-256 de:
 * - content.xml (estructura semántica)
 * - ode.xml (navegación)
 * - ZIP completo (verificación integral)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { unzipSync } from 'fflate';

interface ChecksumEntry {
  fixture: string;
  zip_sha256: string;
  content_xml_sha256: string;
  ode_xml_sha256: string;
  preview_html_size?: number;
  manifest_xml_sha256?: string;
  generated_at: string;
  version: string;
}

interface RegressionChecksums {
  [key: string]: ChecksumEntry;
}

interface ValidationResult {
  fixture: string;
  passed: boolean;
  expected?: ChecksumEntry;
  generated?: ChecksumEntry;
  differences?: string[];
}

/**
 * Calcula SHA-256 de un buffer
 */
function calculateSha256(buffer: ArrayBuffer | Uint8Array): string {
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(buffer));
  return hash.digest('hex');
}

/**
 * Lee archivo de checksums
 */
function loadChecksums(filePath: string): RegressionChecksums {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`⚠️ Error leyendo checksums de ${filePath}:`, err);
    return {};
  }
}

/**
 * Guarda archivo de checksums
 */
function saveChecksums(filePath: string, checksums: RegressionChecksums): void {
  fs.writeFileSync(filePath, JSON.stringify(checksums, null, 2));
  console.log(`✅ Checksums guardados en ${filePath}`);
}

/**
 * Extrae checksums de un ELPX buffer
 */
function extractChecksums(
  elpxBuffer: ArrayBuffer,
  fixtureName: string,
  version: string = 'baseline-v1'
): ChecksumEntry {
  try {
    const zipData = unzipSync(new Uint8Array(elpxBuffer));

    // Checksums de archivos individuales
    const contentXmlBuffer = zipData['content.xml'];
    const odeXmlBuffer = zipData['ode.xml'];
    const manifestXmlBuffer = zipData['META-INF/manifest.xml'];

    const contentXmlSha = contentXmlBuffer
      ? calculateSha256(contentXmlBuffer)
      : 'MISSING';
    const odeXmlSha = odeXmlBuffer
      ? calculateSha256(odeXmlBuffer)
      : 'MISSING';
    const manifestXmlSha = manifestXmlBuffer
      ? calculateSha256(manifestXmlBuffer)
      : 'MISSING';
    const zipSha = calculateSha256(new Uint8Array(elpxBuffer));

    // Tamaño del preview HTML si existe
    const previewHtmlBuffer = zipData['preview.html'];
    const previewHtmlSize = previewHtmlBuffer?.length || undefined;

    return {
      fixture: fixtureName,
      zip_sha256: zipSha,
      content_xml_sha256: contentXmlSha,
      ode_xml_sha256: odeXmlSha,
      manifest_xml_sha256: manifestXmlSha,
      preview_html_size: previewHtmlSize,
      generated_at: new Date().toISOString(),
      version
    };
  } catch (err) {
    throw new Error(`Error extrayendo checksums de ${fixtureName}: ${err}`);
  }
}

/**
 * Valida un ELPX generado contra baseline
 */
function validateFixture(
  generated: ChecksumEntry,
  baseline: ChecksumEntry
): ValidationResult {
  const differences: string[] = [];

  if (generated.zip_sha256 !== baseline.zip_sha256) {
    differences.push(`ZIP mismatch: ${generated.zip_sha256} vs ${baseline.zip_sha256}`);
  }

  if (generated.content_xml_sha256 !== baseline.content_xml_sha256) {
    differences.push(`content.xml mismatch: ${generated.content_xml_sha256} vs ${baseline.content_xml_sha256}`);
  }

  if (generated.ode_xml_sha256 !== baseline.ode_xml_sha256) {
    differences.push(`ode.xml mismatch: ${generated.ode_xml_sha256} vs ${baseline.ode_xml_sha256}`);
  }

  return {
    fixture: generated.fixture,
    passed: differences.length === 0,
    expected: baseline,
    generated,
    differences: differences.length > 0 ? differences : undefined
  };
}

/**
 * Genera reporte de validación
 */
function generateReport(
  results: ValidationResult[],
  phaseNumber: number | 'baseline'
): void {
  const timestamp = new Date().toISOString();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n' + '='.repeat(70));
  console.log(`📊 REPORTE DE VALIDACIÓN - Phase ${phaseNumber}`);
  console.log('='.repeat(70));
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Total: ${results.length} | ✅ Pasadas: ${passed} | ❌ Fallidas: ${failed}`);
  console.log('='.repeat(70));

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.fixture}`);

    if (!result.passed && result.differences) {
      for (const diff of result.differences) {
        console.log(`   └─ ${diff}`);
      }
    }
  }

  console.log('='.repeat(70));
  console.log(`Resultado: ${failed === 0 ? '✅ TODOS LOS TESTS PASARON' : '❌ FALLOS DETECTADOS'}`);
  console.log('='.repeat(70) + '\n');

  // Guardar reporte
  const reportPath = path.join(
    __dirname,
    `reports/phase-${phaseNumber}-report-${timestamp.replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify({
    phase: phaseNumber,
    timestamp,
    summary: { total: results.length, passed, failed },
    results
  }, null, 2));

  console.log(`📄 Reporte guardado en: ${reportPath}`);
}

/**
 * Información de uso
 */
function printUsage(): void {
  console.log(`
Validador de Regresión - BUA Convertidor

COMANDOS:

  npx ts-node tests/validate-regression.ts baseline
    → Genera baseline con todos los fixtures

  npx ts-node tests/validate-regression.ts 1 simple.docx
    → Valida Phase 1 contra baseline (fixture: simple.docx)

  npx ts-node tests/validate-regression.ts 2
    → Valida Phase 2 contra baseline (todos los fixtures)

ARCHIVOS:

  tests/fixtures/           → Documentos de prueba (.docx)
  tests/regression-checksums.json → Checksums baseline
  tests/reports/            → Reportes de validación

NOTA: El script espera que ELPX buffers sean generados por la
función convertDocxToElpx() del código actual/refactorizado.
  `);
}

// Main
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === 'help') {
  printUsage();
  process.exit(0);
}

console.log('🧪 Validador de Regresión Arquitectónica\n');
console.log('Nota: Este script requiere fixtures DOCX en tests/fixtures/');
console.log('      y que se generen checksums durante la ejecución.\n');
console.log('Este es un STUB de validación. Para usarlo, necesitas:');
console.log('  1. Crear documentos de prueba (.docx)');
console.log('  2. Generar baseline: npm run test:baseline');
console.log('  3. Ejecutar validación: npm run test:regression:phase 1\n');

console.log('📋 Estructura esperada:\n');
console.log('tests/');
console.log('├── fixtures/');
console.log('│   ├── simple.docx');
console.log('│   ├── multipage.docx');
console.log('│   ├── semantic.docx');
console.log('│   ├── tables.docx');
console.log('│   └── themed.docx');
console.log('├── regression-checksums.json');
console.log('├── reports/');
console.log('└── validate-regression.ts\n');

console.log('Checksums en regression-checksums.json deben incluir:');
console.log('  - zip_sha256: Hash del ELPX completo');
console.log('  - content_xml_sha256: Hash de content.xml');
console.log('  - ode_xml_sha256: Hash de ode.xml');
console.log('  - manifest_xml_sha256: Hash de manifest.xml');
console.log('  - generated_at: Timestamp de generación');
console.log('  - version: "baseline-v1" u otro identificador\n');

// Exportar funciones para uso en otros scripts
export {
  calculateSha256,
  loadChecksums,
  saveChecksums,
  extractChecksums,
  validateFixture,
  generateReport,
  type ChecksumEntry,
  type RegressionChecksums,
  type ValidationResult
};
