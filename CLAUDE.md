# Distribuidora Chaque — reglas para Claude

App de gestión de Joel, dueño de Distribuidora Chaque (Santa Fe, Argentina).
JavaScript puro, sin frameworks, publicada en GitHub Pages desde la rama `main`.

## Cómo trabajar
- Hacé los cambios que pida Joel y **subilos directo a `main`** (así se publican solos en 1–2 minutos). Nada de ramas aparte ni pull requests.
- **Antes de subir, probá el cambio** (Node + jsdom, o Playwright con el Chromium de `/opt/pw-browsers`). Subí solo si **todas** las pruebas pasan. Si no estás seguro de algo, preguntale antes de subir.
- Después de subir, contale en pocas palabras qué cambió y cómo lo prueba (siempre: "cerrá y abrí la app para que tome el cambio"). Si algo sale mal, volvé a la versión anterior.
- No toques `style.css` salvo que haga falta: preferí estilos en línea.
- Respondele en **español argentino, simple y directo**. No sabe programar en detalle ni usa la terminal: explicá en términos de pantallas y botones, sin código.
- Estos cambios son solo para esta app. Hay otra app para clientes (cuenta appdistri, otro Apps Script) que **NO se toca** salvo que lo pida.
- Si te pide algo que no está claro, preguntá antes de cambiar código. Si dice "no modifiques nada todavía", solo proponé.
- **Mantené este archivo al día.** Cada vez que se agregue una función nueva o Joel tome una decisión (o cambie una), actualizá la sección que corresponda de este archivo **en el mismo commit** que sube el cambio. Si Joel dice "dejemos como estaba", sacá la nota de lo que se revirtió. No hace falta anotar arreglos chicos: el historial de GitHub ya guarda cada cambio.

## Decisiones tomadas (no cambiar sin que Joel lo pida)
- Clientes, productos y pedidos eliminados se borran **"suave"** (`eliminado: true`), nunca de verdad, para no romper el historial de ventas.
- El ranking de ventas por marca en Stock se ordena por **cantidad**, no por plata.
- El service worker (`sw.js`) **no guarda caché a propósito** (pide los archivos de la app con `no-store`), así siempre se ve la última versión. Hay una propuesta pendiente de "red primero y copia guardada si no hay señal": **no la hagas sin que Joel la apruebe** (dijo que primero prueba unos días la apertura rápida).
- Los documentos para clientes dicen **"Remito"**, nunca "Factura".
- Los montos se escriben en formato argentino (`1.355.293,60`); `parseNumber` ya los entiende. `formatCurrency` usa un espacio que no se corta (` `) entre `$` y el número.
- Los clientes tipo **"Otro"** y **"🌐 Venta web"** no cuentan en los rankings de Top clientes, pero sus ventas se suman en todo lo demás.
- Los productos se listan **ordenados por código** en todas las pantallas (`catalogActivo()`).
- **No hay logo de fondo (marca de agua)**: lo probó y le distraía. No volver a agregarlo.
- **Se sacaron** (no los usa más, no volver a agregarlos): los botones **📥 Día** y **📊 Mensual** de "Productos vendidos" (Resumen) y las **fotos de productos** (botón "📷 Ver imagen"; ya tiene la página web con las fotos). El único Excel que queda es el del contador (Monotributo) y el del pedido a fábrica.
- La tabla `PRECIOS_DISTRIBUIDOR` (costos) **no es de esos botones**: la usa `costoDeProducto` para la ganancia. No borrarla.
- Las pantallas largas del Resumen se **pliegan** (arrancan cerradas, se abren tocando el título): Monotributo, Venta web, Nafta, Km, Gastos extraordinarios y los tres Top. Mantener ese estilo para secciones nuevas.
- Los precios de los pedidos web son los que vienen en el mensaje de WhatsApp (público o mayorista según la cantidad).
- **La app NUNCA escribe en la pestaña `pedidos_web`**: el guardado de la app (`doPost`) borra y reescribe la pestaña entera y se perderían los pedidos que llegaron en el medio. Solo se lee. `guardarEnDriveUnaVez` no incluye `pedidos_web` en sus tipos: mantenerlo así.
- **Todo texto que viene de la web se limpia al importarlo** (`textoWebSeguro`: sin `<`, `>`, comillas ni caracteres de control): lo escribe cualquiera desde la web pública y la app muestra muchos textos sin filtrar. No guardar texto de la web sin pasar por esa función.
- El **costo con descuento** de cada producto se usa para calcular la ganancia; el **precio de lista de fábrica** (`precioLista`) es aparte y solo va en el pedido a fábrica.

## Funciones (qué hace cada una)
- **Monotributo** (Resumen): fecha de alta, categoría y tope se cargan a mano (nada fijo en el código). Cada pedido entregado desde el alta se marca facturado o no (con número); se ve lo facturado vs. sin factura, lo de los últimos 12 meses contra el tope y hay Excel para el contador. Los pedidos anteriores al alta no cuentan.
- **Bloqueo con huella/PIN** (Backup): solo por dispositivo, se pide al abrir o tras 5 min fuera. PIN guardado como hash.
- **Clave de Google** (Backup): cada dispositivo la carga una vez; el Apps Script rechaza todo sin ella. Nunca va en el código. El Apps Script (proyecto que termina en `...fx6w`) no está en el repo.
- **Espacio del dispositivo**: barra en Backup y aviso al pasar el 80%; si el celu se llena igual se guarda en Google.
- **Stock**: cada producto muestra la fecha de la última carga a mano (Sumar/Fijar). **🔍 Revisar movimientos** (en ✏️ Editar del producto) lista las ventas desde el último ajuste y detecta ventas que no descontaron. **Unificar** productos repetidos. Precio de lista de fábrica por producto.
- **Pedido a fábrica** (Stock): se arma por marca con cantidades a mano, muestra vendidas este mes/mes pasado y reservadas; se manda como Excel (menú Compartir) o texto por WhatsApp. No toca el stock.
- **Pedidos**: se guardan solos al salir de un pedido nuevo, al compartir por WhatsApp o si el celu cierra la app (pedido en curso en `localStorage`). Editar un entregado con "Ignorar stock" lo pasa a borrador. Botón 🗑️ Eliminar pedido (devuelve stock solo de lo entregado). Después de Confirmar entrega se muestra el pedido para cobrar/avisar.
- **⏳ Falta entregar** (por producto): el pedido queda entregado (cuenta como venta y deuda) pero ese producto no descuenta stock hasta que se entrega (`item.pendiente`); queda reservado.
- **Venta web**: botón 🌐 Pedido web pega el mensaje de WhatsApp de la página, lee productos y precios, y guarda en el cliente especial `cliente-venta-web`. Los nombres de la web se aprenden por producto (`aliasWeb`). Se guarda como pendiente de entrega o entregado.
- **Pedidos de la web que llegan solos**: la web agrega una fila por pedido en la pestaña `pedidos_web` de la planilla (JSON en la columna A, ids `W-XXXXXX`; el script que la escribe es otro proyecto de Apps Script, no está en el repo). La app los **lee** con el `doGet` de siempre (`?tipo=pedidos_web`) en cada sincronización (al abrir, 🔄 Recargar y cada 2 minutos) y los importa **pendientes de entrega** (borrador, no tocan el stock) en `cliente-venta-web`, con id `web-W-XXXXXX` (así no se importan dos veces, ni desde otro dispositivo, ni después de borrarlos con 🗑️). El stock se descuenta recién al confirmar la entrega. Los productos se reconocen por código; si la web avisa `enCatalogo: false` queda `sinProducto` y no deja entregar hasta sacarlo y agregarlo desde la lista.
- **Ruta del día / Ordenar clientes**: cada cliente tiene día de visita, zona y frecuencia (7, 14, 21, 28 días o sin frecuencia). Calendario fijo (un quincenal toca una semana sí y otra no, compre o no) usando `cicloInicio`. Los "Sin frecuencia" y tipo "Otro" no aparecen en la ruta ni en inactivos.
- **📱 Mensajes**: `porMensaje` (cliente que se atiende por WhatsApp, 📱 fijo) y `recordarMensaje` (recordatorio que se borra solo al escribirle por WhatsApp desde la app). Mensaje general guardado (`configVehiculo.mensajeClientes`, con `{nombre}`) y mensaje propio por cliente (`mensajePropio`); botón 📤 Enviar de a uno.
- **Saldo a favor**: si un cliente paga de más, el excedente queda en `saldoFavor` (con `movimientosFavor`), se usa al registrar el pago de otro pedido ("Usar saldo a favor") o se ajusta a mano. El aviso de pago por WhatsApp lo menciona.
- **Resumen**: gráfico de ventas de 5 meses con flechas y montos abreviados; el Monotributo va debajo de Pedidos pendientes.
- Actualización automática cada 2 minutos con la app abierta (no interrumpe si se está escribiendo).

## Cómo está armada
- `index.html` (carga solo `style.css` y `script.js`; la librería de Excel se baja recién al exportar), `script.js` (casi toda la lógica), `style.css`, `manifest.json`, `sw.js`, `img/` (solo el logo del PDF).
- Datos en el celu (`localStorage`) y sincronizados con Google Sheets mediante un Apps Script (`API_URL` en `script.js`). Los ajustes sueltos (vehículo, monotributo, mensaje general) viajan en el registro `vehiculo`.
- Sincronización: cada registro tiene `actualizadoEn`; al fusionar gana el más nuevo. **Todo cambio a un pedido, cliente o producto tiene que poner `actualizadoEn = Date.now()`**, si no otro dispositivo puede pisarlo. Ojo: si un dispositivo guarda un producto con stock viejo puede pisar el stock del otro (riesgo conocido, pendiente de resolver).
- Stock: `aplicarStock` mueve el stock de los pedidos entregados; los borradores y los productos con `pendiente` no se descuentan hasta entregarse.
- Ventas por producto: `productoVendido()` agrupa por el nombre actual del producto (las ventas viejas con un código interno que ya no existe se juntan por nombre).
- Al abrir, la app se dibuja enseguida con los datos del celu y después trae lo nuevo de Google.

## Pendientes / ideas (hablar con Joel antes de hacerlas)
- Service worker "red primero, copia guardada si no hay señal".
- Historial de movimientos de stock guardado (hoy 🔍 Revisar lo reconstruye con los pedidos) y evitar que celu y compu se pisen el stock.
- Aviso de recategorización del monotributo (enero y julio).
- Clave del Apps Script: hoy cada dispositivo la carga a mano.

## Pruebas
- Las pruebas se arman en el scratchpad (no quedan en el repo y se pierden si cambia la máquina): servidor local que sirve una copia de la app con `API_URL` apuntando a un Google simulado, y Playwright con el Chromium de `/opt/pw-browsers`.
- Ojo con pruebas que dependen de la fecha (nombres de meses, días de una cifra) y con el espacio que no se corta en los montos.
- Antes de subir: correr todas las pruebas de lo que se tocó y las anteriores relacionadas, y subir solo si todas pasan.
