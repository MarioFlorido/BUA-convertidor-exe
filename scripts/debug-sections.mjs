/**
 * Debug: analizar cómo se dividen las secciones
 */

import fs from 'fs';
import mammoth from 'mammoth';

async function debug() {
  const filePath = '/Users/mariofloridoperez/Desktop/Lorem ipsum para trabajar.docx';

  console.log(`\n📄 Analizando secciones de contenido\n`);

  // Leer y convertir
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({
    buffer: buffer,
    includeEmbeddedStyleMap: true,
    includeDefaultStyleMap: true,
    ignoreEmptyParagraphs: true,
  });

  const html = result.value;

  // Buscar patrones H1 -> contenido -> H2 -> contenido -> H1
  const h1Regex = /<h1[^>]*>(.*?)<\/h1>/gi;
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;

  let h1Match;
  let h1Index = 0;

  console.log('🔍 Estructura H1 → Contenido → H2:\n');

  while ((h1Match = h1Regex.exec(html)) !== null) {
    h1Index++;
    const h1Text = h1Match[1].replace(/<[^>]+>/g, '').substring(0, 60);
    const h1Pos = h1Match.index;

    // Buscar el siguiente H1 o fin del documento
    const nextH1Regex = /<h1[^>]*>/gi;
    nextH1Regex.lastIndex = h1Pos + 1;
    const nextH1 = nextH1Regex.exec(html);
    const h1End = nextH1 ? nextH1.index : html.length;

    // Extraer contenido de esta H1
    const h1Content = html.substring(h1Pos, h1End);

    // Buscar primer H2 en este contenido
    const firstH2Regex = /<h2[^>]*>(.*?)<\/h2>/i;
    const firstH2Match = firstH2Regex.exec(h1Content);

    if (firstH2Match) {
      const h2Text = firstH2Match[1].replace(/<[^>]+>/g, '').substring(0, 60);
      const beforeH2Content = h1Content.substring(0, firstH2Match.index);

      // Contar párrafos y elementos antes del H2
      const pCount = (beforeH2Content.match(/<p>/gi) || []).length;
      const beforeH2Text = beforeH2Content.replace(/<[^>]+>/g, '').trim().substring(0, 80);

      console.log(`[${h1Index}] H1: "${h1Text}"`);
      console.log(`    Contenido ANTES del primer H2:`);
      console.log(`      - Párrafos: ${pCount}`);
      console.log(`      - Texto: "${beforeH2Text}${beforeH2Text.length > 80 ? '...' : ''}"`);
      console.log(`    Primer H2: "${h2Text}"`);
    } else {
      console.log(`[${h1Index}] H1: "${h1Text}" (sin H2s)`);
    }

    console.log();
  }

  console.log(`\n✅ Total H1s encontrados: ${h1Index}`);
}

debug().catch(console.error);
