/**
 * Script para generar checksums baseline de todos los fixtures
 *
 * Uso:
 *   npx ts-node tests/generate-checksums.ts
 *
 * Genera:
 *   tests/regression-checksums.json con SHA-256 de cada fixture
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { convertDocxToElpx } from '../src/core/docxToElpx';

interface ChecksumEntry {
  fixture: string;
  zip_sha256: string;
  content_xml_sha256: string;
  ode_xml_sha256: string;
  manifest_xml_sha256?: string;
  generated_at: string;
  version: string;
}

interface RegressionChecksums {
  [key: string]: ChecksumEntry;
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
 * Extrae checksums de un ELPX buffer (descompone el ZIP)
 */
function extractChecksums(
  elpxBuffer: ArrayBuffer,
  fixtureName: string
): ChecksumEntry {
  // Importar aquí para evitar issues de módulos
  const { unzipSync } = require('fflate');

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

    return {
      fixture: fixtureName,
      zip_sha256: zipSha,
      content_xml_sha256: contentXmlSha,
      ode_xml_sha256: odeXmlSha,
      manifest_xml_sha256: manifestXmlSha,
      generated_at: new Date().toISOString(),
      version: 'baseline-v1'
    };
  } catch (err) {
    throw new Error(`Error extrayendo checksums de ${fixtureName}: ${err}`);
  }
}

/**
 * Genera baseline para todos los fixtures
 */
async function generateBaseline() {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const checksumsPath = path.join(__dirname, 'regression-checksums.json');

  console.log('📊 Generador de Baseline - Regresión Arquitectónica\n');
  console.log(`📁 Buscando fixtures en: ${fixturesDir}`);

  // Verificar que el directorio existe
  if (!fs.existsSync(fixturesDir)) {
    console.error(`❌ Directorio no existe: ${fixturesDir}`);
    process.exit(1);
  }

  // Listar fixtures
  const fixtures = fs.readdirSync(fixturesDir)
    .filter(f => f.endsWith('.docx'))
    .sort();

  if (fixtures.length === 0) {
    console.error('❌ No hay archivos .docx en tests/fixtures/');
    console.error('   Necesitas crear 5 documentos de prueba:');
    console.error('   - simple.docx');
    console.error('   - multipage.docx');
    console.error('   - semantic.docx');
    console.error('   - tables.docx');
    console.error('   - themed.docx');
    process.exit(1);
  }

  console.log(`✅ Encontrados ${fixtures.length} fixtures:\n`);
  fixtures.forEach(f => console.log(`   • ${f}`));
  console.log();

  const checksums: RegressionChecksums = {
    '.metadata': {
      fixture: '.metadata',
      zip_sha256: '',
      content_xml_sha256: '',
      ode_xml_sha256: '',
      generated_at: new Date().toISOString(),
      version: 'baseline-v1'
    }
  };

  // Procesar cada fixture
  for (const fixture of fixtures) {
    const filePath = path.join(fixturesDir, fixture);

    console.log(`⏳ Procesando: ${fixture}...`);

    try {
      // Leer archivo
      const fileBuffer = fs.readFileSync(filePath);
      const file = new File([fileBuffer], fixture, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // Convertir a ELPX
      const result = await convertDocxToElpx(
        file,
        {
          theme: 'base',
          h1Mode: 'page',
          h2Mode: 'block'
        }
      );

      // Extraer checksums
      const checksumEntry = extractChecksums(result.elpxBuffer, fixture);
      checksums[fixture] = checksumEntry;

      console.log(`   ✅ ZIP hash:     ${checksumEntry.zip_sha256.substring(0, 16)}...`);
      console.log(`   ✅ content.xml:  ${checksumEntry.content_xml_sha256.substring(0, 16)}...`);
      console.log(`   ✅ ode.xml:      ${checksumEntry.ode_xml_sha256.substring(0, 16)}...`);
      console.log();
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      process.exit(1);
    }
  }

  // Guardar checksums
  fs.writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));
  console.log(`\n✅ Checksums guardados en: ${checksumsPath}`);
  console.log(`📊 Total de fixtures procesados: ${fixtures.length}`);
  console.log('\n🎉 Baseline generado exitosamente!\n');
  console.log('Próximos pasos:');
  console.log('1. git add tests/fixtures/ tests/regression-checksums.json');
  console.log('2. git commit -m "Phase 0: Baseline fixtures and checksums"');
  console.log('3. git push origin main');
  console.log('4. Proceder a Phase 1: Extract DocxParser\n');
}

// Ejecutar
generateBaseline().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
