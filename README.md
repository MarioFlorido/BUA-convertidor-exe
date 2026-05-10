# ConvertidoreXe

Aplicación web para convertir documentos Word (.docx) a paquetes eXeLearning (.elpx).

## 🎯 Características

- ✅ Conversión de documentos Word a eXeLearning
- ✅ Configuración flexible de encabezados (H1-H4 como páginas o bloques)
- ✅ Procesamiento en el cliente (privado y sin servidor)
- ✅ Interfaz simple y funcional
- ✅ Soporte para múltiples temas (próximamente)

## 🚀 Inicio rápido

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

### Build para producción

```bash
npm run build
```

## 📋 Requisitos

- Node.js 16 o superior
- npm o yarn

## 🗂️ Estructura del proyecto

```
src/
  ├── core/              # Lógica del motor de conversión
  │   └── docxToElpx.ts
  ├── components/        # Componentes React
  ├── types/             # Tipos TypeScript
  ├── styles/            # Estilos globales
  ├── App.tsx            # Componente principal
  └── main.tsx           # Punto de entrada
public/
  └── themes/            # Temas eXeLearning (se cargan por separado)
```

## 🎨 Temas

Los temas se alojan en la carpeta `public/themes/` como archivos ZIP independientes. Cada tema contiene:
- `style.css` - Estilos personalizados
- `style.js` - Scripts del tema
- `config.xml` - Metadatos del tema
- `icons/` - Iconos personalizados
- `img/` - Imágenes y fuentes

## 📝 Notas de desarrollo

- El motor de conversión NO incluye soporte para fórmulas matemáticas
- Las imágenes se procesan como ficheros en `content/resources/`
- La interfaz es minimalista: blanco, negro y gris (#ccc)

## 📄 Licencia

Creative Commons Attribution-Share Alike 4.0

---

**Biblioteca Universitaria, Universidad de Alicante**

Programa para pasar de documentos Word a eXeLearning
