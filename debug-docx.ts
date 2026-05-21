/**
 * Script de debug para analizar estructura de DOCX
 * Muestra qué headings detecta y cómo se estructura el contenido
 */

import fs from 'fs';
import mammoth from 'mammoth';
import { parseDocumentStructure } from './src/core/parseStructure';
import { applyDivClasses, applyTableClasses } from './src/core/transformers/HtmlTransformer';

async function debugDocx(filePath: string) {
  console.log(`\n📄 Analizando: ${filePath}\n`);

  // Leer archivo
  const buffer = fs.readFileSync(filePath);

  // Convertir con Mammoth
  console.log('1️⃣  Extrayendo HTML con Mammoth...\n');
  const result = await mammoth.convertArrayBuffer({
    arrayBuffer: buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ),
    includeEmbeddedStyleMap: true,
    includeDefaultStyleMap: true,
    ignoreEmptyParagraphs: true,
  });

  const html = result.value;

  // Mostrar primeros headings
  console.log('📋 Encabezados detectados:\n');
  const headingRegex = /<h([1-6])>(.*?)<\/h\1>/g;
  const headings: Array<{ level: number; text: string }> = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    headings.push({ level, text });
    console.log(`  H${level}: "${text}"`);
  }

  if (headings.length === 0) {
    console.log('  ⚠️  No se encontraron headings H1-H6');
  }

  // Analizar estructura
  console.log('\n2️⃣  Analizando estructura con parseDocumentStructure...\n');
  const structure = parseDocumentStructure(html);

  console.log(`Total H1 sections: ${structure.h1Sections.length}\n`);

  for (let i = 0; i < structure.h1Sections.length; i++) {
    const section = structure.h1Sections[i];
    console.log(`📍 H1[${i}] (Level ${section.level}): "${section.title}"`);
    console.log(`   └─ H2 items: ${section.h2Items.length}`);
    section.h2Items.forEach((item, j) => {
      console.log(`      [${j}] (${item.option}): "${item.text}"`);
    });
    console.log();
  }

  // Aplicar transformaciones
  console.log('3️⃣  Aplicando transformaciones...\n');
  let transformed = html;
  transformed = applyDivClasses(transformed);
  transformed = applyTableClasses(transformed);

  // Contar párrafos antes/después
  const paraBefore = (html.match(/<p>/g) || []).length;
  const paraAfter = (transformed.match(/<p>/g) || []).length;

  console.log(`Párrafos antes: ${paraBefore}`);
  console.log(`Párrafos después: ${paraAfter}\n`);

  // Guardar HTML para inspección
  const debugFile = '/tmp/debug-docx.html';
  fs.writeFileSync(debugFile, transformed);
  console.log(`✅ HTML guardado en: ${debugFile}`);
  console.log('   Abre este archivo en navegador para inspeccionar\n');

  // Intentar convertir a ELPX para ver si falla
  console.log('4️⃣  Intentando conversión completa...\n');
  try {
    const { convertHtmlToElpx } = await import('./src/core/docxToElpx');
    const result = await convertHtmlToElpx(
      transformed,
      'debug.docx',
      {
        heading1Mode: 'page',
        heading2Mode: 'block',
        heading3Mode: 'block',
        heading4Mode: 'block',
        themeId: 'base',
      }
    );

    console.log(`✅ Conversión exitosa`);
    console.log(`   Pages: ${result.blockCount ? 'N/A' : '?'}`);
    console.log(`   Blocks: ${result.blockCount}`);
  } catch (error) {
    console.error(`❌ Error en conversión:`, error);
  }
}

// Ejecutar
const filePath = '/Users/mariofloridoperez/Desktop/Lorem ipsum para trabajar.docx';
debugDocx(filePath).catch(console.error);
