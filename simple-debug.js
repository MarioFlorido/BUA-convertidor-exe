/**
 * Script simple de debug - analiza estructura de DOCX
 */

const fs = require('fs');
const mammoth = require('mammoth');

async function debug() {
  const filePath = '/Users/mariofloridoperez/Desktop/Lorem ipsum para trabajar.docx';

  console.log(`\n📄 Analizando: ${filePath}\n`);

  // Leer archivo
  const buffer = fs.readFileSync(filePath);

  // Convertir con Mammoth
  console.log('1️⃣  Extrayendo HTML con Mammoth...\n');
  const result = await mammoth.convertArrayBuffer({
    arrayBuffer: buffer,
    includeEmbeddedStyleMap: true,
    includeDefaultStyleMap: true,
    ignoreEmptyParagraphs: true,
  });

  const html = result.value;

  // Mostrar headings
  console.log('📋 Encabezados detectados:\n');
  const headingRegex = /<h([1-6])>(.*?)<\/h\1>/g;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]+>/g, '').trim().substring(0, 80);
    headings.push({ level, text });
    console.log(`  H${level}: "${text}"`);
  }

  if (headings.length === 0) {
    console.log('  ⚠️  No se encontraron headings H1-H6');
  }

  // Mostrar estructura de párrafos
  console.log('\n2️⃣  Estructura de párrafos y headings:\n');

  // Regex mejorada que encuentra h1-h6 y párrafos
  const structureRegex = /(<h[1-6]>[^<]*<\/h[1-6]>|<p>.*?<\/p>)/g;
  const elements = html.match(structureRegex) || [];

  console.log(`Total de elementos: ${elements.length}\n`);

  // Mostrar primeros 30 elementos para ver estructura
  let h1Count = 0;
  for (let i = 0; i < Math.min(30, elements.length); i++) {
    const el = elements[i];
    if (el.match(/^<h1/)) {
      h1Count++;
      const text = el.replace(/<[^>]+>/g, '').substring(0, 60);
      console.log(`\n[${i}] ✨ H1: "${text}"`);
    } else if (el.match(/^<h[2-6]/)) {
      const level = el.match(/<h([2-6])/)[1];
      const text = el.replace(/<[^>]+>/g, '').substring(0, 60);
      console.log(`[${i}] H${level}: "${text}"`);
    } else {
      const text = el.replace(/<[^>]+>/g, '').substring(0, 60);
      if (text.trim().length > 0) {
        console.log(`[${i}] 📝 ${text}`);
      }
    }
  }

  if (elements.length > 30) {
    console.log(`\n... y ${elements.length - 30} elementos más`);
  }

  console.log(`\n\n📊 Resumen:`);
  console.log(`Total H1: ${headings.filter(h => h.level === 1).length}`);
  console.log(`Total H2: ${headings.filter(h => h.level === 2).length}`);
  console.log(`Total H3: ${headings.filter(h => h.level === 3).length}`);
  console.log(`Total párrafos: ${(html.match(/<p>/g) || []).length}`);
  console.log(`Total elementos: ${elements.length}`);

  // Guardar HTML completo para inspección
  const debugFile = '/tmp/debug-docx.html';
  fs.writeFileSync(debugFile, html);
  console.log(`\n✅ HTML guardado en: ${debugFile}`);
}

debug().catch(console.error);
