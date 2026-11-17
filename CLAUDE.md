# Distribuidora Chaque — reglas para Claude

App de gestión de Joel, dueño de Distribuidora Chaque (Santa Fe, Argentina).
JavaScript puro, sin frameworks, publicada en GitHub Pages desde la rama `main`.

## Cómo trabajar
- Hacé los cambios que pida Joel y **subilos directo a `main`** (así se publican solos en 1–2 minutos). Nada de ramas aparte ni pull requests.
- **Antes de subir, probá el cambio** (Node + jsdom, o Playwright con el Chromium de `/opt/pw-browsers`). Subí solo si todas las pruebas pasan. Si no estás seguro de algo, preguntale antes de subir.
- Después de subir, contale en pocas palabras qué cambió y cómo lo prueba (siempre: "cerrá y abrí la app para que tome el cambio"). Si algo sale mal, volvé a la versión anterior.
- No toques `style.css` salvo que haga falta: preferí estilos en línea.
- Respondele en **español argentino, simple y directo**. No sabe programar en detalle ni usa la terminal: explicá en términos de pantallas y botones, sin código.
- Estos cambios son solo para esta app. Hay otra app para clientes (cuenta appdistri, otro Apps Script) que **NO se toca** salvo que lo pida.
- Si te pide algo que no está claro, preguntá antes de cambiar código. Si dice "no modifiques nada todavía", solo proponé.

## Decisiones tomadas (no cambiar)
- Clientes y productos eliminados se borran **"suave"** (`eliminado: true`), nunca de verdad, para no romper el historial de ventas.
- El ranking de ventas por marca en Stock se ordena por **cantidad**, no por plata.
- El service worker (`sw.js`) **no guarda caché a propósito** (pide todo con `no-store`), así siempre se ve la última versión. Hay una propuesta pendiente de "red primero y copia guardada si no hay señal": no la hagas sin que Joel la apruebe.
- Los documentos para clientes dicen **"Remito"**, nunca "Factura".
- Los montos se escriben en formato argentino (`1.355.293,60`); `parseNumber` ya los entiende.
- Los clientes tipo **"Otro"** (y "🌐 Venta web") no cuentan en los rankings de Top clientes, pero sus ventas se suman en todo lo demás.
- Los productos se listan **ordenados por código**.
- No se agregó logo de fondo (marca de agua): lo probó y no le gustó.

## Cómo está armada
- `index.html` (carga solo `style.css` y `script.js`; la librería de Excel se baja recién al exportar), `script.js` (casi toda la lógica), `style.css`, `manifest.json`, `sw.js`, `img/` (fotos de productos y logo del PDF).
- Datos en el celu (`localStorage`) y sincronizados con Google Sheets mediante un Apps Script (`API_URL` en `script.js`). El Apps Script exige una **clave** que cada dispositivo carga en Backup y queda solo en ese dispositivo (nunca va en el código). El código del Apps Script no está en el repo.
- Sincronización: cada registro tiene `actualizadoEn`; al fusionar gana el más nuevo. Todo cambio a un pedido, cliente o producto tiene que poner `actualizadoEn = Date.now()`, si no otro dispositivo puede pisarlo.
- Stock: `aplicarStock` mueve el stock de los pedidos entregados; los borradores y los productos marcados "⏳ Falta entregar" (`item.pendiente`) no se descuentan hasta entregarse.
- Al abrir, la app se dibuja enseguida con los datos del celu y después trae lo nuevo de Google.

## Pruebas
- Las pruebas se arman en el scratchpad (no quedan en el repo y se pierden si cambia la máquina): servidor local que sirve una copia de la app con `API_URL` apuntando a un Google simulado.
- Ojo con pruebas que dependen de la fecha (nombres de meses, días de una cifra).
