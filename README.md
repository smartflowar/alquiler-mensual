# Alquiler al Día

Calculadora gratuita de aumento de alquiler para Argentina (IPC, ICL o % fijo), con detalle de cada ajuste, resumen para WhatsApp y recibo en PDF. Es un sitio estático: no necesita servidor ni base de datos.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página (incluye textos para Google y preguntas frecuentes) |
| `styles.css` | El diseño |
| `app.js` | La calculadora y el recibo PDF |
| `data/ipc.json` | Inflación mensual del INDEC (se actualiza sola) |
| `data/icl.json` | ICL diario del Banco Central (se actualiza solo) |
| `scripts/actualizar-datos.mjs` | Baja los índices de las fuentes oficiales |
| `.github/workflows/actualizar-datos.yml` | Corre el script todos los días en GitHub, gratis |
| `robots.txt`, `sitemap.xml` | Para que Google indexe el sitio |

## Cómo se actualizan los índices

Todos los días a las 8:17 (hora argentina) GitHub corre el script, baja el IPC y el ICL, y si hay datos nuevos los guarda en el repositorio. Vercel detecta el cambio y vuelve a publicar el sitio solo. No tenés que hacer nada.

Si una fuente falla un día, se conservan los datos anteriores y se reintenta al día siguiente.

## Publicarlo paso a paso (gratis)

### 1. Subirlo a GitHub
1. Creá una cuenta en [github.com](https://github.com) si no tenés.
2. Creá un repositorio nuevo llamado `alquiler-al-dia` (puede ser público o privado).
3. Subí todos los archivos de esta carpeta. Lo más fácil: en la página del repositorio, "Add file" → "Upload files" y arrastrá todo. **Ojo:** la carpeta `.github` empieza con punto y a veces está oculta; asegurate de subirla.

### 2. Activar la actualización automática
1. En el repositorio, entrá a **Settings → Actions → General**.
2. En "Workflow permissions" elegí **Read and write permissions** y guardá.
3. Andá a la pestaña **Actions**, elegí "Actualizar IPC e ICL" y tocá **Run workflow**. En un minuto vas a ver un commit nuevo con el ICL cargado.

### 3. Publicarlo con Vercel
1. Entrá a [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. "Add New → Project", elegí el repositorio `alquiler-al-dia` y tocá **Deploy** (no hace falta configurar nada).
3. Te da una dirección tipo `alquiler-al-dia.vercel.app`. Ya está online.

### 4. Ponerle tu dominio
1. Registrá un dominio `.com.ar` en [nic.ar](https://nic.ar) (necesitás clave fiscal de ARCA) o un `.com` en cualquier registrador.
2. En Vercel: Project → **Settings → Domains** → agregá tu dominio y seguí las instrucciones de DNS.
3. Reemplazá `TU-DOMINIO.com.ar` por tu dominio real en `index.html`, `robots.txt` y `sitemap.xml`.

### 5. Que Google lo encuentre
1. Entrá a [Google Search Console](https://search.google.com/search-console), agregá tu dominio y verificalo.
2. En "Sitemaps" cargá `sitemap.xml`.

### 6. Recibir aportes con Cafecito
1. Creá una cuenta en [cafecito.app](https://cafecito.app) y elegí tu usuario.
2. En `index.html`, buscá `TU-USUARIO` y reemplazalo por tu usuario (queda `https://cafecito.app/tuusuario`).
3. El botón aparece debajo del resultado y también después de descargar el recibo en PDF.

## Probarlo en tu computadora
Abrí una terminal en la carpeta y corré `npx serve` (o `python3 -m http.server`). Después entrá a la dirección que te muestra. Abrir `index.html` con doble clic no carga los índices, porque el navegador bloquea leer archivos locales.

## Ideas para las próximas versiones
- Páginas específicas para Google: "aumento alquiler trimestral IPC", "calculadora ICL", etc.
- Índice Casa Propia y otros que usan algunos contratos.
- Aviso por mail o WhatsApp cuando se acerca el próximo ajuste.
- Plan pago para propietarios con varios departamentos.
