/**
 * Test para verificar que el fix de extractH2Content funciona
 * No repite contenido de la primera página en siguientes páginas
 */

import fs from 'fs';
import mammoth from 'mammoth';
import { JSDOM } from 'jsdom';

// Configurar DOMParser global para jsdom
const { DOMParser } = new JSDOM().window;
global.DOMParser = DOMParser;

import { parseDocumentStructure } from './src/core/parseStructure.js';
import { buildProjectFromStructure } from './src/core/buildFromStructure.js';

async function testFix() {
  const filePath = '/Users/mariofloridoperez/Desktop/Lorem ipsum para trabajar.docx';

  console.log(`\n🔧 Probando FIX para bug de contenido repetido\n`);
  console.log(`📄 Archivo: ${filePath}\n`);

  // 1. Leer DOCX
  const buffer = fs.readFileSync(filePath);

  // 2. Convertir con Mammoth
  const result = await mammoth.convertToHtml({
    buffer: buffer,
    includeEmbeddedStyleMap: true,
    includeDefaultStyleMap: true,
    ignoreEmptyParagraphs: true,
  });

  const html = result.value;

  // 3. Analizar estructura
  const structure = parseDocumentStructure(html);

  console.log(`📊 Estructura detectada:`);
  console.log(`   - Total H1s: ${structure.h1Sections.length}`);

  for (let i = 0; i < structure.h1Sections.length; i++) {
    const h1 = structure.h1Sections[i];
    console.log(`   [${i}] H1: "${h1.title}" (Level ${h1.level})`);
    console.log(`       └─ H2 items: ${h1.h2Items.length}`);
    h1.h2Items.forEach((h2, j) => {
      console.log(`          [${j}] "${h2.text}" (${h2.option})`);
    });
  }

  // 4. Construir proyecto
  console.log(`\n🔨 Construyendo proyecto...\n`);
  const project = buildProjectFromStructure(html, 'test.docx', structure);

  console.log(`✅ Proyecto construido:`);
  console.log(`   - Título: "${project.title}"`);
  console.log(`   - Páginas: ${project.pages.length}`);

  // 5. Analizar contenido de cada página
  console.log(`\n📖 Contenido de páginas:\n`);

  for (let pageIdx = 0; pageIdx < project.pages.length; pageIdx++) {
    const page = project.pages[pageIdx];
    console.log(`\n[Página ${pageIdx}] "${page.title}" (Level ${page.level})`);
    console.log(`Bloques: ${page.blocks.length}`);

    for (let blockIdx = 0; blockIdx < page.blocks.length; blockIdx++) {
      const block = page.blocks[blockIdx];
      const title = block.title || '(sin título)';
      const contentLen = block.html.length;

      // Extracto del contenido para mostrar
      const textContent = block.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const preview = textContent.substring(0, 100);

      console.log(`   [Bloque ${blockIdx}] "${title}"`);
      console.log(`      Contenido: ${contentLen} chars`);
      console.log(`      Preview: "${preview}${preview.length >= 100 ? '...' : ''}"`);
    }
  }

  // 6. Verificación crítica: ¿El contenido es diferente en cada página?
  console.log(`\n🔍 VERIFICACIÓN: ¿Contenido diferente entre páginas?\n`);

  let allDifferent = true;
  const pageContents = project.pages.map(p =>
    p.blocks.map(b => b.html).join('\n')
  );

  for (let i = 0; i < pageContents.length; i++) {
    for (let j = i + 1; j < pageContents.length; j++) {
      if (pageContents[i] === pageContents[j]) {
        console.log(`❌ FALLO: Página ${i} y Página ${j} tienen contenido IDÉNTICO`);
        allDifferent = false;
      } else {
        // Verificar si el contenido de i aparece completamente en j
        if (pageContents[j].includes(pageContents[i])) {
          console.log(`⚠️  ADVERTENCIA: Contenido de Página ${i} aparece EN Página ${j}`);
        }
        if (pageContents[i].includes(pageContents[j])) {
          console.log(`⚠️  ADVERTENCIA: Contenido de Página ${j} aparece EN Página ${i}`);
        }
      }
    }
  }

  if (allDifferent) {
    console.log(`✅ ÉXITO: Todas las páginas tienen contenido diferente`);
  }

  console.log(`\n✨ Test completado\n`);
}

testFix().catch(console.error);
