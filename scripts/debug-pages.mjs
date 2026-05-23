/**
 * Debug detallado: cómo se divide el contenido en páginas
 */

import fs from 'fs';
import mammoth from 'mammoth';

async function debug() {
  const filePath = '/Users/mariofloridoperez/Desktop/Lorem ipsum para trabajar.docx';

  console.log(`\n📄 Analizando división de páginas\n`);

  // Leer y convertir
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({
    buffer: buffer,
    includeEmbeddedStyleMap: true,
    includeDefaultStyleMap: true,
    ignoreEmptyParagraphs: true,
  });

  const html = result.value;

  // Parse como el código real lo hace
  const doc = new (require('jsdom').JSDOM)(html).window.document;
  const bodyElement = doc.body;

  console.log('📋 Analizando estructura del body:\n');

  let h1Count = 0;
  let h2Count = 0;
  let contentBeforeFirstH2 = '';
  let currentH1Title = '';
  let foundFirstH2 = false;

  for (const element of Array.from(bodyElement.children)) {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent.replace(/\s+/g, ' ').trim();

    if (!text) continue;

    if (tag === 'h1') {
      if (currentH1Title) {
        console.log(`\n✨ H1: "${currentH1Title}"`);
        console.log(`   Content BEFORE first H2 (${contentBeforeFirstH2.length} chars):`);
        if (contentBeforeFirstH2.length > 0) {
          console.log(`   ${contentBeforeFirstH2.substring(0, 100)}...`);
        } else {
          console.log(`   (vacío)`);
        }
      }

      h1Count++;
      h2Count = 0;
      currentH1Title = text;
      contentBeforeFirstH2 = '';
      foundFirstH2 = false;
      console.log(`\n[${h1Count}] H1 Encontrado: "${text}"`);
    } else if (tag === 'h2' && currentH1Title) {
      h2Count++;
      if (!foundFirstH2) {
        foundFirstH2 = true;
        console.log(`   └─ PRIMER H2: "${text}"`);
        console.log(`   └─ Content BEFORE first H2 guardado: ${contentBeforeFirstH2.length} chars`);
      } else {
        console.log(`   └─ H2[${h2Count}]: "${text}"`);
      }
    } else if (tag.match(/^h[3-6]$/)) {
      if (currentH1Title) {
        console.log(`   └─ ${tag.toUpperCase()}: "${text}"`);
      }
    } else if (tag === 'p' || tag === 'table') {
      if (currentH1Title && !foundFirstH2) {
        // Acumular contenido antes del primer H2
        contentBeforeFirstH2 += element.outerHTML;
      }
    }
  }

  // Última página
  if (currentH1Title) {
    console.log(`\n✨ H1: "${currentH1Title}"`);
    console.log(`   Content BEFORE first H2 (${contentBeforeFirstH2.length} chars):`);
    if (contentBeforeFirstH2.length > 0) {
      console.log(`   ${contentBeforeFirstH2.substring(0, 100)}...`);
    } else {
      console.log(`   (vacío)`);
    }
  }

  console.log(`\n\n📊 Resumen:`);
  console.log(`Total H1: ${h1Count}`);
  console.log(`Páginas con contenido ANTES del H2: ?`);
  console.log(`Páginas SIN contenido ANTES del H2: ?`);
}

debug().catch(console.error);
