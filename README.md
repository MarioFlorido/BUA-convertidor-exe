# BUA ConvertidoreXe

Herramienta web para convertir documentos Word (DOCX) a formato eXeLearning (ELPX) con exportación a PDF.

**Desarrollado por:** Biblioteca Universitaria, Universidad de Alicante  
**Licencia:** CC BY-NC-SA 4.0  
**Demo:** https://marioflorido.github.io/BUA-convertidor-exe/

---

## Qué hace

1. **Cargar** un documento Word (.docx)
2. **Configurar** la estructura — qué hace cada nivel de encabezado (H1/H2/H3)
3. **Seleccionar** un tema visual institucional
4. **Descargar** el archivo .elpx listo para abrir en eXeLearning
5. **Exportar** PDF con portada, índice automático y estilos BUA

Funciona completamente en el navegador. No requiere servidor ni instalación adicional.

---

## Instalación

```bash
git clone https://github.com/MarioFlorido/BUA-convertidor-exe.git
cd BUA-convertidor-exe
npm install
```

---

## Uso

```bash
npm run dev       # Desarrollo (http://localhost:5173/BUA-convertidor-exe/)
npm run build     # Build de producción → dist/
npm run deploy    # Build + publicar en GitHub Pages
```

---

## Temas

Los temas son archivos ZIP con estilos CSS, imágenes y configuración. Se cargan directamente desde el navegador sin servidor.

El administrador de temas (accesible desde la app) permite:
- Cargar nuevos ZIPs
- Reemplazar temas al cambiar de curso académico
- Eliminar temas que ya no se usan

Solo el tema **Base** (plantilla por defecto de eXeLearning) no puede eliminarse.

### Estructura de un ZIP de tema

```
{ThemeId}.zip/
├── style.css          # Estilos (requerido)
├── config.xml         # Metadatos (requerido)
├── portada_pdf.png    # Imagen de portada para PDF
├── screenshot.png     # Vista previa en el selector
└── img/
    ├── logo_BUA.png
    └── logo_UA.png
```

---

## Arquitectura

```
DOCX
  ↓
SemanticDocument   ← modelo central agnóstico
  ↓           ↓
ELPX         PDF (Paged.js)
```

Documentación técnica detallada: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)

---

## Stack

| Paquete | Uso |
|---|---|
| `mammoth` | Extrae HTML de archivos DOCX |
| `fflate` | Compresión/descompresión ZIP |
| `idb` | Persistencia de temas en IndexedDB |
| `react` / `vite` | UI y tooling |
| Paged.js (CDN) | CSS Paged Media para PDF |

---

## Solución de problemas

**La plantilla base no carga**
```bash
git checkout public/base.elpx
```

**El PDF no muestra encabezado/pie**  
Paged.js carga desde CDN. Requiere conexión a internet.

**Las cajas BUA no tienen color en el PDF**  
El CSS del tema debe incluir las clases `.bua_ejemplo`, `.bua_definicion`, `.bua_importante` con `border-left` y `::before { content: "Etiqueta" }`.
