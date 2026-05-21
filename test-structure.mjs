import fs from 'fs';
import mammoth from 'mammoth';

async function test() {
  const filePath = '/Users/mariofloridoperez/Desktop/Lorem ipsum para trabajar.docx';
  
  console.log('\n📄 Analizando estructura del documento\n');
  
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({
    buffer: buffer,
    includeEmbeddedStyleMap: true,
    includeDefaultStyleMap: true,
    ignoreEmptyParagraphs: true,
  });
  
  const html = result.value;
  
  // Simular la extracción de secciones como lo hace buildFromStructure
  const sections = [];
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html);
  const tempDiv = dom.window.document.body;
  
  let currentHtml = '';
  
  for (const node of Array.from(tempDiv.childNodes)) {
    if (!(node instanceof dom.window.HTMLElement)) continue;
    
    const tag = node.tagName.toLowerCase();
    const match = /^h([1-6])$/.exec(tag);
    
    if (match) {
      const level = Number(match[1]);
      const text = node.textContent || '';
      
      if (currentHtml.trim()) {
        sections.push({
          level: sections.length === 0 ? 1 : 999,
          text: '',
          html: currentHtml.trim(),
        });
      }
      
      sections.push({
        level,
        text: text.trim(),
        html: '',
      });
      
      currentHtml = '';
    } else {
      currentHtml += node.outerHTML;
    }
  }
  
  if (currentHtml.trim()) {
    sections.push({
      level: 999,
      text: '',
      html: currentHtml.trim(),
    });
  }
  
  // Analizar secciones
  console.log('📋 Secciones extraídas:\n');
  
  let h1Count = 0;
  let h2Count = 0;
  
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    
    if (s.level === 1) {
      h1Count++;
      console.log(`[${i}] H1[${h1Count}]: "${s.text.substring(0, 50)}"`);
    } else if (s.level === 2) {
      h2Count++;
      console.log(`   └─ [${i}] H2: "${s.text.substring(0, 50)}"`);
    } else if (s.level === 3) {
      console.log(`      └─ [${i}] H3: "${s.text.substring(0, 50)}"`);
    } else if (s.level === 999) {
      const preview = s.html.replace(/<[^>]+>/g, ' ').trim().substring(0, 60);
      console.log(`      └─ [${i}] CONTENT: "${preview}${preview.length >= 60 ? '...' : ''}"`);
    }
  }
  
  console.log('\n🔍 Búsqueda de H2 duplicados:\n');
  
  const h2Map = new Map();
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].level === 2) {
      const text = sections[i].text.trim();
      if (!h2Map.has(text)) {
        h2Map.set(text, []);
      }
      h2Map.get(text).push(i);
    }
  }
  
  for (const [text, indices] of h2Map) {
    if (indices.length > 1) {
      console.log(`⚠️  H2 duplicado: "${text}"`);
      console.log(`   Encontrado en índices: ${indices.join(', ')}`);
      indices.forEach(idx => {
        // Encontrar el H1 anterior
        let h1Before = -1;
        for (let i = idx - 1; i >= 0; i--) {
          if (sections[i].level === 1) {
            h1Before = i;
            break;
          }
        }
        console.log(`   └─ En sección H1[${h1Before}]: "${sections[h1Before]?.text || 'N/A'}"`);
      });
    }
  }
  
  console.log('\n✨ Test completado\n');
}

test().catch(console.error);
