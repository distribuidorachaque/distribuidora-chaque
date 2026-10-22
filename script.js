// ═══════════════════════════════════════════════════════════════
// PEDIDOS ALUNEXA / FUNGIMANIA
// ═══════════════════════════════════════════════════════════════

const API_URL = "https://script.google.com/macros/s/AKfycbyfH5zvUfGZmX_45u2JckvHvpR4bD2-CeMpi-27Bm94RMtNNiBUWPi2162xdiLUN8fx6w/exec";

// Devuelve la fecha de HOY en formato YYYY-MM-DD usando el horario LOCAL del
// dispositivo (no UTC). new Date().toISOString() siempre da la fecha en UTC,
// lo cual hace que después de las 21hs en Argentina (UTC-3) ya muestre el día
// siguiente. Esta función evita ese bug.
function fechaHoyLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

// Combina una lista local con una de Drive SIN perder ningún registro: si un
// mismo id está en las dos, se queda con la versión local (se asume más
// reciente, porque recién se cargó en este dispositivo); si un id solo está
// en una de las dos listas, lo conserva igual. Esto reemplaza la comparación
// por cantidad de antes, que podía perder un registro puntual aunque la otra
// lista tuviera "igual o más" cantidad en total.
function fusionarPorId(local, remoto) {
  const mapa = new Map();
  local.concat(remoto).forEach(item => {
    if (!item || !item.id) return;
    const anterior = mapa.get(item.id);
    if (!anterior) {
      mapa.set(item.id, item);
    } else {
      // Si los dos tienen marca de fecha de actualización, gana el más
      // reciente de verdad. Si no la tienen (datos viejos), se queda con
      // el que ya estaba (el local, que entra primero en la lista).
      const tAnterior = anterior.actualizadoEn || 0;
      const tNuevo = item.actualizadoEn || 0;
      if (tNuevo > tAnterior) mapa.set(item.id, item);
    }
  });
  return Array.from(mapa.values());
}

// El catálogo NO se puede fusionar por ID: los productos "por defecto" generan
// un id nuevo y aleatorio cada vez que el catálogo arranca de cero (por
// ejemplo, si se vació el localStorage), así que el mismo producto puede
// tener IDs distintos en distintos momentos. Por eso se fusiona por
// nombre+categoría, que es estable, quedándose con el de mayor stock.
function fusionarCatalogoPorNombre(local, remoto) {
  const vistos = {};
  const resultado = [];
  local.concat(remoto).forEach(p => {
    if (!p || !p.nombre) return;
    const key = p.nombre + "|" + p.categoria;
    if (!vistos[key]) {
      vistos[key] = p;
      resultado.push(p);
      return;
    }
    const actual = vistos[key];
    const tActual = actual.actualizadoEn || 0;
    const tNuevo = p.actualizadoEn || 0;
    // Si los dos tienen fecha real, gana el más reciente de verdad.
    // Si no hay fecha (productos viejos sin esa marca), se queda con el de mayor stock.
    const reemplazar = (tActual || tNuevo) ? (tNuevo > tActual) : (p.stock > actual.stock);
    if (reemplazar) {
      resultado[resultado.indexOf(actual)] = p;
      vistos[key] = p;
    }
  });
  return resultado;
}
const IVA_RATE = 0.21;
const STOCK_BAJO_UMBRAL = 5;
const DIAS_INACTIVIDAD_UMBRAL = 7; // días sin comprar para que el cliente se marque como "frío"
const STORAGE_KEYS = {
  clients: "alunexa_clients_v1",
  catalog: "alunexa_catalog_v8_google",
  orders: "alunexa_orders_v1",
  inversiones: "alunexa_inversiones_v1"
};
const TIPOS_CLIENTE = ["Farmacia", "Dietética", "Supermercado", "Verdulería", "Kiosco", "Gimnasio", "Otro"];
const DIAS_VISITA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const HORARIOS_CLIENTE = ["Mañana", "Tarde", "Todo el día", "Corrido"];

function generarId() {
  return "id-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
}

// ── Catálogo por defecto ─────────────────────────────────────────────────────
const defaultCatalog = [
  { id: generarId(), nombre: "Bisglicinato de Magnesio", categoria: "Alunexa", precioVentaSinIVA: 10315, stock: 0, codigo: "100" },
  { id: generarId(), nombre: "Citrato de Magnesio", categoria: "Alunexa", precioVentaSinIVA: 9590, stock: 0, codigo: "101" },
  { id: generarId(), nombre: "Multimagnesio", categoria: "Alunexa", precioVentaSinIVA: 9150, stock: 0, codigo: "102" },
  { id: generarId(), nombre: "Magnesio", categoria: "Alunexa", precioVentaSinIVA: 7215, stock: 0, codigo: "103" },
  { id: generarId(), nombre: "Calcio, Magnesio y Vitamina D3", categoria: "Alunexa", precioVentaSinIVA: 7800, stock: 0, codigo: "104" },
  { id: generarId(), nombre: "Vitamina C, Zinc y Vitamina D", categoria: "Alunexa", precioVentaSinIVA: 8970, stock: 0, codigo: "105" },
  { id: generarId(), nombre: "Vitamina B12", categoria: "Alunexa", precioVentaSinIVA: 8000, stock: 0, codigo: "106" },
  { id: generarId(), nombre: "Colágeno Hidrolizado", categoria: "Alunexa", precioVentaSinIVA: 8850, stock: 0, codigo: "107" },
  { id: generarId(), nombre: "Resveratrol", categoria: "Alunexa", precioVentaSinIVA: 11375, stock: 0, codigo: "108" },
  { id: generarId(), nombre: "Cardo Mariano", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0, codigo: "200" },
  { id: generarId(), nombre: "Tremella", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0, codigo: "201" },
  { id: generarId(), nombre: "Ashwagandha", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0, codigo: "202" },
  { id: generarId(), nombre: "Cordyceps", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0, codigo: "203" },
  { id: generarId(), nombre: "Melena de León", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0, codigo: "204" },
  { id: generarId(), nombre: "Reishi", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0, codigo: "205" },
  { id: generarId(), nombre: "Almendra", categoria: "Vita", precioVentaSinIVA: 15000, stock: 0, codigo: "300" },
  { id: generarId(), nombre: "Chocolate", categoria: "Vita", precioVentaSinIVA: 15000, stock: 0, codigo: "301" },
  { id: generarId(), nombre: "Proteína", categoria: "Vita", precioVentaSinIVA: 17250, stock: 0, codigo: "302" },
  { id: generarId(), nombre: "Bites", categoria: "Vita", precioVentaSinIVA: 3150, stock: 0, codigo: "303" }
];

const defaultClients = [
  { id: generarId(), nombre: "Cliente ejemplo", telefono: "", email: "", direccion: "", tipo: "Farmacia", notas: "" }
];

// ── Estado global ────────────────────────────────────────────────────────────
let clients = JSON.parse(localStorage.getItem(STORAGE_KEYS.clients) || "null") || defaultClients;
let catalog = JSON.parse(localStorage.getItem(STORAGE_KEYS.catalog) || "null") || defaultCatalog;
let orders  = JSON.parse(localStorage.getItem(STORAGE_KEYS.orders)  || "[]");
let inversiones = JSON.parse(localStorage.getItem(STORAGE_KEYS.inversiones) || "[]");

let currentItems      = [];
let editingOrderId    = null;
let filtroCategoria   = "Todas";
let tiposSeleccionados = new Set();
let filtroDiaCliente = "Todos";
let filtroZonaCliente = "Todas";

function setFiltroZona(zona) {
  filtroZonaCliente = zona;
  renderVistaClientes();
}
let busquedaCliente = "";
let vistaActual       = "clientes";  // clientes | form-cliente | pedido | historial | stock | backup
let clienteActivoId   = null;
let editandoClienteId = null;
let ordenConFormPago  = null;
let modoBorrador      = false;
let filtroStock       = "Todas";
let costosVehiculoAbierto = false;
let gastosExtraAbierto = false;
let kmPorMes = JSON.parse(localStorage.getItem("alunexa_km_por_mes_v1") || "{}");
let metaPorMes = JSON.parse(localStorage.getItem("alunexa_meta_por_mes_v1") || "{}");

function claveMesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
}

function getKmMesActual() {
  return kmPorMes[claveMesActual()] || 0;
}
let configVehiculo = JSON.parse(localStorage.getItem("alunexa_config_vehiculo_v1") || "null") || {
  seguro: 70000,
  celular: 8000,
  monotributo: 0,
  servicioCosto: 70000,
  servicioKm: 10000,
  cubiertasCosto: 540000,
  cubiertasKm: 60000,
  bateriaCosto: 200000,
  bateriaAnios: 3,
  actualizadoEn: 0
};

// Los km y la meta de ventas por mes ahora viven adentro de configVehiculo,
// así viajan a Drive junto con el resto de la config y se ven iguales en
// el celu y en la compu. Si ya tenías cargados km o metas de antes (guardados
// solo en este dispositivo), los migramos acá adentro una sola vez.
if (!configVehiculo.kmPorMes) configVehiculo.kmPorMes = {};
if (!configVehiculo.metaPorMes) configVehiculo.metaPorMes = {};
let huboMigracionLocal = false;
Object.keys(kmPorMes).forEach(k => {
  if (configVehiculo.kmPorMes[k] === undefined) { configVehiculo.kmPorMes[k] = kmPorMes[k]; huboMigracionLocal = true; }
});
Object.keys(metaPorMes).forEach(k => {
  if (configVehiculo.metaPorMes[k] === undefined) { configVehiculo.metaPorMes[k] = metaPorMes[k]; huboMigracionLocal = true; }
});
if (huboMigracionLocal) {
  configVehiculo.actualizadoEn = Date.now();
  setItemSeguro("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
  fetchConTimeout(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "vehiculo", payload: [configVehiculo] }) });
}
// A partir de acá, kmPorMes y metaPorMes apuntan al mismo objeto que
// configVehiculo.kmPorMes/.metaPorMes, así que todo el código que ya
// usaba kmPorMes[mes] y metaPorMes[mes] sigue funcionando igual.
kmPorMes = configVehiculo.kmPorMes;
metaPorMes = configVehiculo.metaPorMes;

let marcasListaPrecios = new Set();
let marcaAvisoSeleccionada = null;
let mensajeAvisoMarca = "";
let enviadosAvisoMarca = new Set();

// ── Almacenamiento ───────────────────────────────────────────────────────────
// ── Espacio en el dispositivo ───────────────────────────────────────────
// El navegador le da a cada página un espacio limitado (unos 5 millones de
// caracteres). Si se llena, guardar en el dispositivo falla: antes eso cortaba
// todo el guardado (ni siquiera llegaba a Google) sin avisar. Ahora se avisa
// y el guardado en Google sigue igual.
var ESPACIO_LIMITE_APROX = 5000000;
var ultimoAvisoEspacio = 0;
var avisoEspacioCasiLlenoMostrado = false;

function espacioUsado() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      total += k.length + (localStorage.getItem(k) || "").length;
    }
  } catch {}
  return total;
}

function porcentajeEspacio() {
  return Math.min(100, Math.round((espacioUsado() / ESPACIO_LIMITE_APROX) * 100));
}

function mostrarBarraEspacio(texto) {
  const bar = document.getElementById("offline-bar");
  if (!bar) return;
  bar.textContent = texto;
  bar.classList.remove("offline-bar-ok");
  bar.classList.add("offline-bar-visible");
  setTimeout(() => { if (navigator.onLine) bar.classList.remove("offline-bar-visible"); }, 10000);
}

function avisarSinEspacio() {
  if (Date.now() - ultimoAvisoEspacio < 60000) return;
  ultimoAvisoEspacio = Date.now();
  mostrarBarraEspacio("⚠️ Este dispositivo se quedó sin espacio para la app. Lo nuevo se guarda en Google igual. Mirá 💾 Backup.");
}

function revisarEspacioCasiLleno() {
  if (avisoEspacioCasiLlenoMostrado) return;
  const pct = porcentajeEspacio();
  if (pct >= 80) {
    avisoEspacioCasiLlenoMostrado = true;
    mostrarBarraEspacio(`⚠️ El espacio de la app en este dispositivo está al ${pct}%. Mirá 💾 Backup.`);
  }
}

function setItemSeguro(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
    return true;
  } catch (e) {
    console.log("No se pudo guardar en el dispositivo:", clave, e);
    avisarSinEspacio();
    return false;
  }
}

function guardarLocal() {
  const ok = [
    setItemSeguro(STORAGE_KEYS.clients, JSON.stringify(clients)),
    setItemSeguro(STORAGE_KEYS.catalog, JSON.stringify(catalog)),
    setItemSeguro(STORAGE_KEYS.orders,  JSON.stringify(orders)),
    setItemSeguro(STORAGE_KEYS.inversiones, JSON.stringify(inversiones))
  ].every(Boolean);
  // Si ya se avisó que no hay espacio, no se tapa ese aviso con el del 80%.
  if (ok) revisarEspacioCasiLleno();
}

function renderCardEspacio() {
  const usado = espacioUsado();
  const pct = porcentajeEspacio();
  const color = pct >= 90 ? "#dc2626" : pct >= 80 ? "#f59e0b" : "#059669";
  const millones = (usado / 1000000).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return `
    <div class="form-card">
      <h3 class="section-title">📱 Espacio en este dispositivo</h3>
      <div style="background:#e5e7eb; border-radius:6px; height:14px; overflow:hidden;">
        <div style="background:${color}; height:100%; width:${Math.max(1, pct)}%;"></div>
      </div>
      <p style="margin:6px 0 0; font-size:14px;"><strong>${pct}%</strong> usado <span class="muted">(${millones} de unos 5 millones de caracteres)</span></p>
      <p class="muted" style="margin:6px 0 0; font-size:13px;">${pct >= 80
        ? "⚠️ Se está llenando. Exportá un backup y avisale a Claude para liberar espacio."
        : "✅ Hay lugar de sobra. Si llega al 80% te va a aparecer un aviso."}</p>
    </div>`;
}

// ── Seguro: evita que se solapen guardados/sincronizaciones ────────────────
// Si dos de estas operaciones corren al mismo tiempo, pueden pisarse entre sí
// o mostrar momentáneamente datos duplicados mientras una pisa a la otra.
let syncEnCurso = false;

// ── Guardar en Drive con verificación y reintentos ─────────────────────────
// Antes, si la escritura a Drive fallaba en silencio (no-cors no deja leer
// la respuesta), la app nunca se enteraba. Ahora: manda los datos, espera un
// segundo, y vuelve a consultar Drive para confirmar que realmente llegaron.
// Si no coincide, reintenta hasta 3 veces antes de avisar que falló.
// Toda llamada a Google tiene un tiempo máximo: si Google se cuelga, cortamos
// y seguimos, en vez de dejar la app "Guardando..." varios minutos.
// Clave de Google: el Apps Script solo acepta pedidos que traigan la clave.
// La clave NO está escrita en este código (que es público): se carga una vez
// en cada dispositivo (en Backup) y queda guardada solo ahí.
function leerClaveGoogle() {
  try { return localStorage.getItem("alunexa_clave_google_v1") || ""; } catch { return ""; }
}

let ultimoAvisoClave = 0;
function avisarClaveIncorrecta() {
  if (Date.now() - ultimoAvisoClave < 60000) return;
  ultimoAvisoClave = Date.now();
  const bar = document.getElementById("offline-bar");
  if (!bar) return;
  bar.textContent = leerClaveGoogle()
    ? "🔑 Google rechazó la clave. Revisala en 💾 Backup → Clave de Google."
    : "🔑 Falta cargar la clave de Google en este dispositivo: 💾 Backup → Clave de Google.";
  bar.classList.remove("offline-bar-ok");
  bar.classList.add("offline-bar-visible");
  setTimeout(() => { if (navigator.onLine) bar.classList.remove("offline-bar-visible"); }, 8000);
}

async function fetchConTimeout(url, opciones, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 30000);
  let op = { ...(opciones || {}), signal: ctrl.signal };
  const esGoogle = typeof url === "string" && url.startsWith(API_URL);
  if (esGoogle) {
    const clave = leerClaveGoogle();
    if (op.method === "POST" && typeof op.body === "string") {
      try { op.body = JSON.stringify({ ...JSON.parse(op.body), clave }); } catch {}
    } else {
      url += (url.includes("?") ? "&" : "?") + "clave=" + encodeURIComponent(clave);
    }
  }
  try {
    const resp = await fetch(url, op);
    // Si Google contesta que la clave está mal, se corta acá como un error
    // (igual que si no hubiera internet): no se toca ningún dato.
    if (esGoogle && op.method !== "POST") {
      let datos = null;
      try { datos = await resp.clone().json(); } catch {}
      if (datos && !Array.isArray(datos) && datos.error === "clave") {
        avisarClaveIncorrecta();
        throw new Error("Clave de Google incorrecta");
      }
    }
    return resp;
  } finally {
    clearTimeout(t);
  }
}

function guardarClaveGoogle() {
  const input = document.getElementById("claveGoogleInput");
  const clave = (input ? input.value : "").trim();
  if (clave.length < 8) return alert("La clave tiene que tener al menos 8 caracteres.");
  localStorage.setItem("alunexa_clave_google_v1", clave);
  ultimoAvisoClave = 0;
  alert("✅ Clave guardada en este dispositivo.");
  renderVistaBackup();
  forzarRecargaDrive();
}

function cambiarClaveGoogle() {
  localStorage.removeItem("alunexa_clave_google_v1");
  renderVistaBackup();
}

function renderCardClaveGoogle() {
  const clave = leerClaveGoogle();
  if (clave) {
    return `
    <div class="form-card">
      <h3 class="section-title">🔑 Clave de Google</h3>
      <p class="muted" style="margin:0 0 10px;">✅ Cargada en este dispositivo (termina en "${clave.slice(-2).replace(/[<>&"']/g, "")}").</p>
      <button class="btn-gray btn-full" onclick="cambiarClaveGoogle()">✏️ Cambiar clave</button>
    </div>`;
  }
  return `
    <div class="form-card" style="border-left:4px solid #f59e0b;">
      <h3 class="section-title">🔑 Clave de Google</h3>
      <p class="muted" style="margin:0 0 10px;">Es la clave que protege tus datos en Google. Tiene que ser la misma en todos tus dispositivos y la misma que pusiste en el Apps Script.</p>
      <input id="claveGoogleInput" type="password" autocomplete="off" placeholder="Escribí la clave" style="width:100%; box-sizing:border-box; border:1.5px solid #d1d5db; border-radius:8px; padding:10px; font-size:15px; margin-bottom:8px;" />
      <button class="btn-primary btn-full" onclick="guardarClaveGoogle()">💾 Guardar clave</button>
    </div>`;
}

// Un solo guardado a la vez. Si mientras se guarda llegan más pedidos de
// guardado (cargaste varias cosas seguidas), NO se encolan uno por cada
// cambio: se anota que hay algo pendiente y se hace UNA sola vuelta más al
// terminar, que ya lleva todo lo último.
let guardadoEnCurso = null;
let guardadoPendiente = false;

function guardarEnDriveConVerificacion(onProgreso) {
  if (guardadoEnCurso) {
    guardadoPendiente = true;
    return guardadoEnCurso;
  }
  guardadoEnCurso = (async () => {
    let ok = false;
    try {
      do {
        guardadoPendiente = false;
        ok = await guardarEnDriveUnaVez(onProgreso);
      } while (guardadoPendiente);
    } finally {
      guardadoEnCurso = null;
    }
    return ok;
  })();
  return guardadoEnCurso;
}

// Huella de una lista: sirve para saber si lo que hay en el dispositivo es
// exactamente igual a lo que ya está en Google (sin importar el orden).
function huellaLista(arr) {
  return (arr || []).map(x => JSON.stringify(x)).sort().join("\n");
}

async function guardarEnDriveUnaVez(onProgreso) {
  // Si hay una sincronización (lectura) en curso, esperamos a que termine,
  // pero como mucho 45 segundos: nunca nos quedamos trabados para siempre.
  const inicioEspera = Date.now();
  while (syncEnCurso && Date.now() - inicioEspera < 45000) {
    await new Promise(r => setTimeout(r, 400));
  }

  syncEnCurso = true;
  try {
    const TIPOS = ["clientes", "catalogo", "pedidos", "inversiones"];
    const getLocal = t => t === "clientes" ? clients : t === "catalogo" ? catalog : t === "pedidos" ? orders : inversiones;

    // 1) Traemos lo último de Google y lo fusionamos con lo local. El Apps
    //    Script REEMPLAZA toda la hoja con lo que se le manda, así que sin
    //    este paso un dispositivo con datos viejos podría pisar cambios
    //    hechos en otro (ej: un pago confirmado en el celu).
    //    De paso nos quedamos con la "huella" de lo que tiene Google, para
    //    después subir SOLO lo que cambió.
    let huellaDrive = null;
    try {
      const resp = await Promise.all(TIPOS.map(t => fetchConTimeout(API_URL + "?tipo=" + t, null, 60000)));
      const datos = await Promise.all(resp.map(r => r.json()));
      const [dC0, dCat0, dP0, dI0] = datos.map(d => d.map(r => JSON.parse(r[0])));
      if (dC0.length > 0)   clients = fusionarPorId(clients, dC0);
      if (dCat0.length > 0) catalog = fusionarCatalogoPorNombre(catalog, dCat0);
      if (dP0.length > 0)   orders  = fusionarPorId(orders, dP0);
      if (dI0.length > 0)   inversiones = fusionarPorId(inversiones, dI0);
      guardarLocal();
      huellaDrive = { clientes: huellaLista(dC0), catalogo: huellaLista(dCat0), pedidos: huellaLista(dP0), inversiones: huellaLista(dI0) };
    } catch (e) {
      console.log("No se pudo repasar con Google antes de guardar, se sube todo:", e);
    }

    // 2) ¿Qué hay que subir? Solo las listas que quedaron distintas a lo que
    //    ya tiene Google. Si no pudimos leer Google, subimos todo.
    //    (Una lista vacía no se sube: el Apps Script la ignora a propósito.)
    const aSubir = TIPOS.filter(t => {
      const local = getLocal(t);
      if (!local || local.length === 0) return false;
      return !huellaDrive || huellaDrive[t] !== huellaLista(local);
    });
    if (aSubir.length === 0) return true; // Google ya tiene todo igual

    const maxIntentos = 2;
    for (let intento = 1; intento <= maxIntentos; intento++) {
      if (onProgreso) onProgreso(intento, maxIntentos);
      try {
        // Subir una hoja grande (los pedidos) puede tardar: le damos hasta 2 minutos.
        await Promise.all(aSubir.map(t =>
          fetchConTimeout(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: t, payload: getLocal(t) }) }, 120000)
        ));

        await new Promise(r => setTimeout(r, intento === 1 ? 500 : 1500 * intento));

        // 3) Verificamos solo lo que subimos.
        const resp = await Promise.all(aSubir.map(t => fetchConTimeout(API_URL + "?tipo=" + t, null, 60000)));
        const datos = await Promise.all(resp.map(r => r.json()));
        if (aSubir.every((t, i) => datos[i].length >= getLocal(t).length)) return true;
      } catch (e) {
        console.log(`Intento ${intento} de guardado falló:`, e);
      }
    }
    return false;
  } finally {
    syncEnCurso = false;
  }
}

// Aviso de guardado fallido: una barrita arriba que se va sola, en vez de un
// cartel que te frena la pantalla y tenés que cerrar con "Aceptar".
let ultimoAvisoGuardadoFallido = 0;
function avisarGuardadoFallido() {
  if (Date.now() - ultimoAvisoGuardadoFallido < 60000) return;
  ultimoAvisoGuardadoFallido = Date.now();
  const bar = document.getElementById("offline-bar");
  if (!bar) return;
  bar.textContent = "⚠️ No se pudo guardar en Google ahora. Está guardado en este dispositivo — tocá ☁️ Guardar más tarde.";
  bar.classList.remove("offline-bar-ok");
  bar.classList.add("offline-bar-visible");
  setTimeout(() => { if (navigator.onLine) bar.classList.remove("offline-bar-visible"); }, 6000);
}

async function guardarStorage() {
  guardarLocal();
  const ok = await guardarEnDriveConVerificacion();
  if (!ok) avisarGuardadoFallido();
}

async function forzarRecargaDrive() {
  if (syncEnCurso) return; // ya hay un guardado/sincronización en curso, evitamos pisarlo
  syncEnCurso = true;
  sincronizarConfigVehiculo();

  const btn = document.getElementById("btnGuardarAhora");
  if (btn) { btn.textContent = "⏳ Cargando..."; btn.disabled = true; }
  let necesitaPush = false;
  try {
    const [rC, rCat, rP, rI] = await Promise.all([
      fetchConTimeout(API_URL + "?tipo=clientes"),
      fetchConTimeout(API_URL + "?tipo=catalogo"),
      fetchConTimeout(API_URL + "?tipo=pedidos"),
      fetchConTimeout(API_URL + "?tipo=inversiones")
    ]);
    const [dC, dCat, dP, dI] = await Promise.all([rC.json(), rCat.json(), rP.json(), rI.json()]);

    const antesC = clients.length, antesCat = catalog.length, antesP = orders.length, antesI = inversiones.length;

    if (dC.length > 0) clients = fusionarPorId(clients, dC.map(r => JSON.parse(r[0])));
    if (dCat.length > 0) catalog = fusionarCatalogoPorNombre(catalog, dCat.map(r => JSON.parse(r[0])));
    if (dP.length > 0) orders = fusionarPorId(orders, dP.map(r => JSON.parse(r[0])));
    if (dI.length > 0) inversiones = fusionarPorId(inversiones, dI.map(r => JSON.parse(r[0])));

    guardarLocal();
    // Si la fusión agregó algo que Drive no tenía, hay que empujarlo de
    // vuelta — pero recién después de soltar el seguro syncEnCurso.
    necesitaPush = clients.length > antesC || catalog.length > antesCat || orders.length > antesP || inversiones.length > antesI;

    if (btn) { btn.textContent = "✅ Actualizado!"; btn.style.background = "#059669"; }
    setTimeout(() => {
      if (btn) { btn.textContent = "☁️ Guardar"; btn.style.background = ""; btn.disabled = false; }
      renderApp();
    }, 1500);
  } catch(e) {
    if (btn) { btn.textContent = "❌ Error"; btn.style.background = "#ef4444"; btn.disabled = false; }
  } finally {
    syncEnCurso = false;
  }
  if (necesitaPush) guardarEnDriveConVerificacion();
}

// ── Sincronización automática al volver a la pestaña ───────────────────────
// Cuando volvés a la pestaña de la PC después de cargar algo en el celu (u otro
// dispositivo), trae los datos frescos de Drive sin que tengas que tocar nada.
async function sincronizarSilencioso() {
  if (vistaActual === "form-cliente" || vistaActual === "pedido") return;
  if (syncEnCurso) return;
  syncEnCurso = true;
  sincronizarConfigVehiculo();

  let necesitaPush = false;
  try {
    const [rC, rCat, rP, rI] = await Promise.all([
      fetchConTimeout(API_URL + "?tipo=clientes"),
      fetchConTimeout(API_URL + "?tipo=catalogo"),
      fetchConTimeout(API_URL + "?tipo=pedidos"),
      fetchConTimeout(API_URL + "?tipo=inversiones")
    ]);
    const [dC, dCat, dP, dI] = await Promise.all([rC.json(), rCat.json(), rP.json(), rI.json()]);

    const antesC = clients.length, antesCat = catalog.length, antesP = orders.length, antesI = inversiones.length;
    const fotoAntes = JSON.stringify([clients, catalog, orders, inversiones]);

    if (dC.length > 0) clients = fusionarPorId(clients, dC.map(r => JSON.parse(r[0])));
    if (dCat.length > 0) catalog = fusionarCatalogoPorNombre(catalog, dCat.map(r => JSON.parse(r[0])));
    if (dP.length > 0) orders = fusionarPorId(orders, dP.map(r => JSON.parse(r[0])));
    if (dI.length > 0) inversiones = fusionarPorId(inversiones, dI.map(r => JSON.parse(r[0])));

    necesitaPush = clients.length > antesC || catalog.length > antesCat || orders.length > antesP || inversiones.length > antesI;

    // Solo se vuelve a dibujar la pantalla si llegó algo nuevo (así no te
    // mueve la pantalla cada vez que revisa y no hay cambios).
    if (JSON.stringify([clients, catalog, orders, inversiones]) !== fotoAntes) {
      guardarLocal();
      renderApp();
    }
  } catch (e) {
    console.log("Sync silenciosa falló:", e);
  } finally {
    syncEnCurso = false;
  }
  if (necesitaPush) guardarEnDriveConVerificacion();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") sincronizarSilencioso();
});

// ── Actualización automática cada 2 minutos ────────────────────────────────
// Si dejás la app abierta (por ejemplo en la compu), cada 2 minutos se fija
// si cambió algo en Google (lo que cargaste en el celu) y lo trae. No lo hace
// si estás escribiendo en algún campo, si hay una ventanita abierta, o si
// estás cargando un pedido o un cliente, para no borrarte lo que tipeás.
function estaOcupadoEscribiendo() {
  const el = document.activeElement;
  if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return true;
  return [...document.querySelectorAll(".modal-overlay")].some(m => m.style.display && m.style.display !== "none");
}

setInterval(() => {
  if (document.visibilityState !== "visible" || !navigator.onLine) return;
  if (typeof appBloqueada !== "undefined" && appBloqueada) return;
  if (estaOcupadoEscribiendo()) return;
  sincronizarSilencioso();
}, 120000);

async function guardarAhora() {
  const btn = document.getElementById("btnGuardarAhora");
  if (btn) { btn.textContent = "⏳ Guardando..."; btn.disabled = true; btn.style.background = ""; }
  guardarLocal();

  const ok = await guardarEnDriveConVerificacion((intento, total) => {
    if (btn && intento > 1) btn.textContent = `⏳ Reintentando (${intento}/${total})...`;
  });

  if (ok) {
    if (btn) { btn.textContent = "✅ Guardado y confirmado!"; btn.style.background = "#059669"; }
  } else {
    if (btn) { btn.textContent = "❌ No se pudo confirmar"; btn.style.background = "#ef4444"; }
  }

  setTimeout(() => {
    if (btn) { btn.textContent = "☁️ Guardar"; btn.style.background = ""; btn.disabled = false; }
  }, 2500);
}

async function cargarDatos() {
  syncEnCurso = true;
  sincronizarConfigVehiculo();
  let dC = [], dCat = [], dP = [], dI = [];
  try {
    const [rC, rCat, rP, rI] = await Promise.all([
      fetchConTimeout(API_URL + "?tipo=clientes"),
      fetchConTimeout(API_URL + "?tipo=catalogo"),
      fetchConTimeout(API_URL + "?tipo=pedidos"),
      fetchConTimeout(API_URL + "?tipo=inversiones")
    ]);
    [dC, dCat, dP, dI] = await Promise.all([rC.json(), rCat.json(), rP.json(), rI.json()]);

    if (dC.length > 0)   clients = clients.concat(dC.map(r => JSON.parse(r[0])));
    if (dCat.length > 0) catalog = catalog.concat(dCat.map(r => JSON.parse(r[0])));
    if (dP.length > 0)   orders  = orders.concat(dP.map(r => JSON.parse(r[0])));
    if (dI.length > 0)   inversiones = inversiones.concat(dI.map(r => JSON.parse(r[0])));

  } catch (e) {
    console.log("Modo local:", e);
  }

  // Migrar campos faltantes
  clients = clients.map(c => ({ tipo: "Otro", ...c }));
  orders  = orders.map(o => ({ pagado: false, pagos: [], ...o }));

  // Reconstruir clientes que están en pedidos pero no en la lista
  const idsClientes = new Set(clients.map(c => c.id));
  orders.forEach(o => {
    if (o.client && o.client.id && !idsClientes.has(o.client.id)) {
      clients.push({
        id: o.client.id,
        nombre: o.client.nombre,
        tipo: o.client.tipo || "Otro",
        telefono: o.client.telefono || "",
        email: o.client.email || "",
        direccion: o.client.direccion || "",
        notas: ""
      });
      idsClientes.add(o.client.id);
    }
  });

  // Deduplicar clientes por ID, quedándose con la versión más reciente de verdad
  clients = fusionarPorId(clients, []);

  // Deduplicar catálogo por nombre+categoria (quedándose con el de mayor stock)
  catalog = fusionarCatalogoPorNombre(catalog, []);

  // Deduplicar pedidos por ID, quedándose con la versión más reciente de verdad
  orders = fusionarPorId(orders, []);

  // Deduplicar inversiones por ID, quedándose con la versión más reciente de verdad
  inversiones = fusionarPorId(inversiones, []);

  guardarLocal();
  // Si el usuario ya está completando un formulario (cargando un cliente o
  // armando un pedido) justo cuando termina de sincronizar, no le pisamos
  // la pantalla — los datos ya quedaron guardados igual, se van a ver la
  // próxima vez que cambie de pantalla.
  try {
    if (vistaActual !== "form-cliente" && vistaActual !== "pedido") renderApp();
  } finally {
    syncEnCurso = false;
  }

  // Si después de fusionar y deduplicar quedó más de lo que Drive tenía
  // (había algo local que Drive todavía no tenía), lo empujamos de vuelta.
  if (clients.length > dC.length || catalog.length > dCat.length || orders.length > dP.length || inversiones.length > dI.length) {
    guardarEnDriveConVerificacion();
  }
}

// ── Utilidades ───────────────────────────────────────────────────────────────
function formatCurrency(v) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(Number(v || 0));
}
// Entiende montos escritos de cualquier forma:
//   "1.355.293,60" (como en Argentina)  → 1355293.6
//   "1355293,60" / "1355293.60" / "1355293" / "$ 1.355" (= mil trescientos cincuenta y cinco)
// Regla: si hay punto y coma, el que va último es el de los decimales. Si hay
// varios puntos (o varias comas), son de miles. Un solo punto seguido de
// exactamente 3 cifras, con 1 a 3 cifras adelante ("1.355"), es de miles.
function parseNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v || "").trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const ultPunto = s.lastIndexOf("."), ultComa = s.lastIndexOf(",");
  if (ultPunto > -1 && ultComa > -1) {
    s = ultComa > ultPunto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (ultComa > -1) {
    s = (s.match(/,/g).length > 1) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (ultPunto > -1) {
    if (s.match(/\./g).length > 1) {
      s = s.replace(/\./g, "");
    } else {
      const [ent, dec] = s.split(".");
      const cifrasEnt = ent.replace("-", "").length;
      if (dec.length === 3 && cifrasEnt >= 1 && cifrasEnt <= 3) s = ent + dec;
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Para precargar un monto en un campo: redondeado a 2 decimales.
function montoParaInput(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function priceWithIVA(p) { return Number(p || 0) * (1 + IVA_RATE); }

// ── Navegación ───────────────────────────────────────────────────────────────
let pedidoRecienEntregadoId = null; // para resaltar el pedido que se acaba de entregar

function setVista(vista, clienteId) {
  if (vista !== "historial") pedidoRecienEntregadoId = null;
  // Al salir de la pantalla de Clientes limpiamos el buscador, así cuando
  // volvés aparece vacío y listo para buscar otro cliente (no queda pegado
  // lo que habías buscado antes de irte a Resumen, Stock, etc.).
  if (vista !== "clientes") busquedaCliente = "";
  // Lo mismo con el buscador de Deudores: al salir se borra.
  if (vista !== "deudores") busquedaDeudores = "";
  // Si estabas editando un pedido ya confirmado y te vas a otra pantalla sin
  // guardar (por ejemplo, tocando el menú de abajo), se hace lo mismo que con
  // "Cancelar": el stock que se había devuelto al entrar a editar se vuelve a
  // descontar, así no queda stock de más.
  if (vistaActual === "pedido" && vista !== "pedido" && editingOrderId) {
    const order = orders.find(o => o.id === editingOrderId);
    if (order && !order.borrador) aplicarStock(order.items, -1);
    currentItems   = [];
    editingOrderId = null;
  }
  vistaActual = vista;
  if (clienteId !== undefined) clienteActivoId = clienteId;
  cerrarModal();
  cerrarModalConfirmar();
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Modal cliente ────────────────────────────────────────────────────────────
// ── Ver todos los datos del cliente, en solo lectura (sin entrar a editar) ──
function verDatosCliente() {
  const c = clients.find(x => x.id === clienteActivoId);
  if (!c) return;

  document.getElementById("verClienteNombre").textContent = c.nombre;

  const frecuenciaTxto = sinFrecuencia(c) ? "Sin frecuencia" : (Number(c.frecuencia) === 14 ? "Quincenal (cada 14 días)" : (Number(c.frecuencia) === 21 ? "Cada 21 días" : "Semanal (cada 7 días)"));
  const filas = [
    ["Tipo", c.tipo || "Otro"],
    ["Zona", c.zona || "—"],
    ["Día de visita", c.diaVisita || "Sin asignar"],
    ["Horario", c.horario || "—"],
    ["Frecuencia", frecuenciaTxto],
    ["Teléfono", c.telefono || "—"],
    ["Teléfono 2", c.telefono2 || "—"],
    ["Email", c.email || "—"],
    ["Dirección", c.direccion || "—"],
    ["Notas", c.notas || "—"],
    ["Potencial", c.potencial ? "Sí 🌱" : "No"],
  ];

  document.getElementById("verClienteDatos").innerHTML = filas.map(([label, valor]) => `
    <div style="display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid #f0f0f0;">
      <span class="muted">${label}</span>
      <strong style="text-align:right;">${valor}</strong>
    </div>
  `).join("");

  document.getElementById("modalVerCliente").style.display = "flex";
}

function cerrarModalVerCliente() {
  const modal = document.getElementById("modalVerCliente");
  if (modal) modal.style.display = "none";
}

function abrirModalCliente(id) {
  clienteActivoId = id;
  const client = clients.find(c => c.id === id);
  if (!client) return;

  document.getElementById("modalClienteNombre").textContent = client.nombre;
  document.getElementById("modalClienteInfo").textContent =
    [client.tipo || "Otro", client.zona ? "📍 " + client.zona : "", client.horario ? "🕐 " + client.horario : "", sinFrecuencia(client) ? "📅 Sin frecuencia" : (Number(client.frecuencia) === 14 ? "📅 Quincenal" : (Number(client.frecuencia) === 21 ? "📅 Cada 21 días" : "📅 Semanal")), client.telefono, client.telefono2, client.direccion].filter(Boolean).join(" · ");

  const btnTel2 = document.getElementById("btnModalTelefono2");
  if (btnTel2) btnTel2.style.display = client.telefono2 ? "flex" : "none";

  document.getElementById("modalCliente").style.display = "flex";
}

// ── Ver imagen del producto ────────────────────────────────────────────────
function mostrarImagenProducto(nombre) {
  const src = IMAGENES_PRODUCTO[nombre];
  if (!src) return;
  document.getElementById("imgProductoModal").src = src;
  document.getElementById("modalImagenProducto").style.display = "flex";
}

function cerrarModalImagen() {
  document.getElementById("modalImagenProducto").style.display = "none";
}

function cerrarModal() {
  const m = document.getElementById("modalCliente");
  if (m) m.style.display = "none";
}

function confirmarEliminarCliente() {
  const client = clients.find(c => c.id === clienteActivoId);
  if (!client) return;
  cerrarModal();
  document.getElementById("confirmarNombre").textContent = client.nombre;
  document.getElementById("modalConfirmar").style.display = "flex";
}

function cerrarModalConfirmar() {
  const m = document.getElementById("modalConfirmar");
  if (m) m.style.display = "none";
}

function eliminarClienteActivo() {
  const c = clients.find(c => c.id === clienteActivoId);
  if (c) { c.eliminado = true; c.actualizadoEn = Date.now(); }
  guardarStorage();
  clienteActivoId = null;
  cerrarModalConfirmar();
  setVista("clientes");
}

// ── Desde modal: acciones ─────────────────────────────────────────────────────
function abrirMaps() {
  const client = clients.find(c => c.id === clienteActivoId);
  if (!client) return;

  if (client.lat && client.lng) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${client.lat},${client.lng}`, "_blank");
    return cerrarModal();
  }

  const direccion = client.direccion || "";
  if (!direccion) return alert("Este cliente no tiene dirección cargada. Editalo para agregarla.");
  const query = encodeURIComponent(direccion + ", Santa Fe, Argentina");
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, "_blank");
  cerrarModal();
}

function irACargarPedido() {
  cerrarModal();
  editingOrderId = null;
  currentItems   = [];
  modoBorrador   = false;   // arranca siempre en OFF: no se arrastra el "ignorar stock" del cliente anterior
  filtroCategoria = "Todas";
  setVista("pedido");
}

function verHistorial() {
  cerrarModal();
  setVista("historial");
}

function abrirFormCliente(id) {
  editandoClienteId = id || null;
  cerrarModal();
  setVista("form-cliente");
}

// ── Filtro tipo cliente (selección múltiple) ──────────────────────────────────
function toggleFiltroTipo(tipo) {
  if (tipo === "Todas") {
    tiposSeleccionados.clear(); // "Todas" = vaciar selección, mostrar todo
  } else if (tiposSeleccionados.has(tipo)) {
    tiposSeleccionados.delete(tipo);
  } else {
    tiposSeleccionados.add(tipo);
  }
  renderVistaClientes();
}

function setFiltroDia(dia) {
  filtroDiaCliente = dia;
  renderVistaClientes();
}

function clientesFiltrados() {
  let lista = clients.filter(c => !c.eliminado);

  if (tiposSeleccionados.size > 0) {
    lista = lista.filter(c => tiposSeleccionados.has(c.tipo || "Otro"));
  }

  if (filtroDiaCliente !== "Todos") {
    lista = lista.filter(c => (c.diaVisita || "Sin asignar") === filtroDiaCliente);
  }

  if (filtroZonaCliente !== "Todas") {
    lista = lista.filter(c => (c.zona || "Sin zona") === filtroZonaCliente);
  }

  const q = busquedaCliente.trim().toLowerCase();
  if (q) {
    lista = lista.filter(c =>
      (c.nombre || "").toLowerCase().includes(q) ||
      (c.direccion || "").toLowerCase().includes(q) ||
      (c.telefono || "").toLowerCase().includes(q)
    );
  }

  return lista;
}

function buscarClientes(valor) {
  busquedaCliente = valor;
  renderVistaClientes();
  const input = document.getElementById("inputBusquedaCliente");
  if (input) {
    input.focus();
    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
  }
}

// ── Guardar cliente (nuevo o edición) ─────────────────────────────────────────
function togglePotencial() {
  const checked = document.getElementById("formClientePotencial").checked;
  const box = document.getElementById("formSeguimientoBox");
  if (box) box.style.display = checked ? "block" : "none";
}

// ── Geolocalización: autocompletar dirección con OpenStreetMap/Nominatim ──────
function usarMiUbicacion() {
  const btn = document.getElementById("btnUbicacion");
  if (!navigator.geolocation) {
    return alert("Tu navegador no soporta geolocalización.");
  }

  btn.disabled = true;
  btn.textContent = "📍 Buscando...";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      document.getElementById("formClienteLat").value = latitude;
      document.getElementById("formClienteLng").value = longitude;
      const manualFlag = document.getElementById("formClienteUbicacionManual");
      if (manualFlag) manualFlag.value = "1";

      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;
        const resp = await fetch(url, { headers: { "Accept-Language": "es" } });
        const data = await resp.json();
        const a = data.address || {};

        const calle  = a.road || a.pedestrian || a.street || "";
        const numero = a.house_number || "";
        const ciudad = a.city || a.town || a.village || a.suburb || "";

        let direccion = [calle, numero].filter(Boolean).join(" ");
        if (ciudad && ciudad.toLowerCase() !== "santa fe") direccion = [direccion, ciudad].filter(Boolean).join(", ");
        if (!direccion) direccion = data.display_name || "";

        if (direccion) {
          document.getElementById("formClienteDireccion").value = direccion;
        } else {
          alert("Se guardó tu ubicación pero no se pudo armar la dirección. Completala a mano si querés.");
        }
      } catch (e) {
        alert("Se guardó la ubicación (lat/lng) pero no se pudo consultar la dirección. Revisá tu conexión.");
      } finally {
        btn.disabled = false;
        btn.textContent = "📡 Mi ubicación";
      }
    },
    (err) => {
      btn.disabled = false;
      btn.textContent = "📡 Mi ubicación";
      if (err.code === err.PERMISSION_DENIED) {
        alert("No diste permiso de ubicación. Activalo en el navegador para usar esta función.");
      } else {
        alert("No se pudo obtener tu ubicación. Probá de nuevo o completá la dirección a mano.");
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function guardarCliente() {
  const nombre     = document.getElementById("formClienteNombre").value.trim();
  const tipo       = document.getElementById("formClienteTipo").value;
  const diaVisita  = document.getElementById("formClienteDia")?.value || "";
  const zona       = document.getElementById("formClienteZona")?.value.trim() || "";
  const horario    = document.getElementById("formClienteHorario")?.value || "";
  const valorFrecuencia = document.getElementById("formClienteFrecuencia")?.value;
  const frecuencia = valorFrecuencia === "0" ? 0 : (Number(valorFrecuencia) || 7);
  const telefono   = document.getElementById("formClienteTelefono").value.trim();
  const telefono2  = document.getElementById("formClienteTelefono2")?.value.trim() || "";
  const email      = document.getElementById("formClienteEmail").value.trim();
  const direccion  = document.getElementById("formClienteDireccion").value.trim();
  const potencial  = document.getElementById("formClientePotencial").checked;
  const seguimiento = document.getElementById("formClienteSeguimiento")?.value || "";
  const latVal = document.getElementById("formClienteLat")?.value;
  const lngVal = document.getElementById("formClienteLng")?.value;
  const lat = latVal ? parseFloat(latVal) : null;
  const lng = lngVal ? parseFloat(lngVal) : null;
  const ubicacionManual = document.getElementById("formClienteUbicacionManual")?.value === "1";

  if (!nombre) return alert("Escribí el nombre del cliente");
  if (!tipo) return alert("Elegí un tipo de comercio");

  // Detectar si ya existe un cliente con el mismo nombre o el mismo teléfono
  // (comparando sin importar mayúsculas/espacios), para no cargarlo de nuevo
  // por error. Si estás editando un cliente, no lo compara contra sí mismo.
  const normalizar = s => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const soloDigitos = s => (s || "").replace(/\D/g, "");
  const nombreNorm = normalizar(nombre);
  const telNorm = soloDigitos(telefono);

  const posibleDuplicado = clients.find(c => {
    if (c.eliminado) return false;
    if (editandoClienteId && c.id === editandoClienteId) return false;
    const mismoNombre = normalizar(c.nombre) === nombreNorm;
    const mismoTelefono = telNorm.length >= 6 && (soloDigitos(c.telefono) === telNorm || soloDigitos(c.telefono2) === telNorm);
    return mismoNombre || mismoTelefono;
  });

  if (posibleDuplicado) {
    const motivo = normalizar(posibleDuplicado.nombre) === nombreNorm ? "el mismo nombre" : "el mismo teléfono";
    const seguir = confirm(`⚠️ Ya tenés cargado a "${posibleDuplicado.nombre}" con ${motivo}. ¿Igual querés guardar este como un cliente nuevo?`);
    if (!seguir) return;
  }

  if (editandoClienteId) {
    const c = clients.find(c => c.id === editandoClienteId);
    if (c) Object.assign(c, { nombre, tipo, diaVisita, zona, horario, frecuencia, telefono, telefono2, email, direccion, potencial, seguimiento, lat, lng, ubicacionManual, actualizadoEn: Date.now() });
  } else {
    clients.unshift({ id: generarId(), nombre, tipo, diaVisita, zona, horario, frecuencia, telefono, telefono2, email, direccion, notas: "", potencial, seguimiento, lat, lng, ubicacionManual, actualizadoEn: Date.now() });
  }

  guardarStorage();
  editandoClienteId = null;
  setVista("clientes");
}

// ── Catálogo ──────────────────────────────────────────────────────────────────
function obtenerCategorias() {
  const cats = [...new Set(catalogActivo().map(p => p.categoria || "Sin categoría"))];
  return ["Todas", ...cats.sort((a, b) => a.localeCompare(b))];
}

function obtenerCatalogoFiltrado() {
  if (filtroCategoria === "Todas") return catalogActivo();
  return catalogActivo().filter(p => (p.categoria || "Sin categoría") === filtroCategoria);
}

function renderSelectProductos() {
  const s = document.getElementById("productoSelect");
  if (!s) return;
  const prods = obtenerCatalogoFiltrado();
  s.innerHTML = `<option value="">Seleccionar producto</option>` +
    prods.map(p => {
      const aviso = p.stock === 0 ? " ⛔" : (p.stock <= STOCK_BAJO_UMBRAL ? " ⚠️" : "");
      const pr = preciosParaClienteActivo(p);
      return `<option value="${p.id}">${p.nombre} — ${pr.usaPublico ? "🏷️ " : ""}${formatCurrency(pr.precio)} (Stock: ${p.stock})${aviso}</option>`;
    }).join("");
}

function aplicarDescuento() {
  if (filtroCategoria !== "Vita") return;
  const precioBase = parseNumber(document.getElementById("precioVenta").value);
  const pctEl = document.getElementById("descuentoPct");
  const resultEl = document.getElementById("precioConDescuento");
  if (!pctEl || !resultEl || !precioBase) return;
  const pct = Math.max(0, Math.min(100, Number(pctEl.value || 0)));
  const precioFinal = precioBase * (1 - pct / 100);
  resultEl.innerHTML = pct > 0
    ? `<span class="precio-final-desc">= ${formatCurrency(precioFinal)}</span>`
    : "";
}

function getPrecioConDescuento() {
  const precioBase = parseNumber(document.getElementById("precioVenta").value);
  if (filtroCategoria !== "Vita") return precioBase;
  const pctEl = document.getElementById("descuentoPct");
  const pct = pctEl ? Math.max(0, Math.min(100, Number(pctEl.value || 0))) : 0;
  return precioBase * (1 - pct / 100);
}

// ¿El pedido que se está cargando es de un cliente tipo "Otro" (precio público)?
function clienteActivoEsPublico() {
  const client = clients.find(c => c.id === clienteActivoId);
  return !!client && (client.tipo || "Otro") === "Otro";
}

// Precio que le corresponde al cliente activo para ese producto, y el "otro"
// precio (para tenerlo a la vista si te lo preguntan mientras cargás).
function preciosParaClienteActivo(prod) {
  const tienePublico = prod.precioPublico > 0;
  const usaPublico = clienteActivoEsPublico() && tienePublico;
  return {
    usaPublico,
    precio: usaPublico ? prod.precioPublico : prod.precioVentaSinIVA,
    otro: tienePublico ? (usaPublico ? prod.precioVentaSinIVA : prod.precioPublico) : null,
    etiquetaOtro: usaPublico ? "Mayorista" : "Público"
  };
}

function autocompletarProducto() {
  const prod = catalog.find(p => p.id === document.getElementById("productoSelect").value);
  if (!prod) return;

  // Si el cliente activo es tipo "Otro" y el producto tiene precio público, usarlo
  const client = clients.find(c => c.id === clienteActivoId);
  const esPublico = client && (client.tipo || "Otro") === "Otro" && prod.precioPublico > 0;
  const precioBase = esPublico ? prod.precioPublico : prod.precioVentaSinIVA;

  document.getElementById("precioVenta").value = montoParaInput(precioBase);
  const cantInput = document.getElementById("cantidad");
  if (cantInput) cantInput.value = "";
  const info = document.getElementById("infoPrecioProducto");
  const disponible = getDisponibleParaAgregar(prod.id);
  const claseHint = disponible <= 0 ? 'hint-agotado' : (disponible <= STOCK_BAJO_UMBRAL ? 'hint-bajo' : '');
  if (info) info.innerHTML = `
    <span class="price-hint">s/IVA: ${formatCurrency(precioBase)}</span>
    <span class="price-hint">c/IVA: ${formatCurrency(priceWithIVA(precioBase))}</span>
    ${esPublico ? `<span class="price-hint" style="color:#7c3aed;font-weight:600">🏷️ Precio público</span>` : ""}
    ${!esPublico && prod.precioPublico > 0 ? `<span class="price-hint muted">Público: ${formatCurrency(prod.precioPublico)}</span>` : ""}
    ${esPublico ? `<span class="price-hint muted">Mayorista: ${formatCurrency(prod.precioVentaSinIVA)}</span>` : ""}
    <span class="price-hint stock-hint ${claseHint}">Disponible: ${disponible}${disponible > 0 && disponible <= STOCK_BAJO_UMBRAL ? ' ⚠️' : ''}</span>
    ${IMAGENES_PRODUCTO[prod.nombre] ? `<button type="button" class="price-hint" style="border:none; cursor:pointer;" onclick="mostrarImagenProducto('${prod.nombre}')">📷 Ver imagen</button>` : ''}
  `;
}

// Códigos sugeridos (100=Alunexa, 200=Fungimania, 300=Vita) para que la
// búsqueda rápida funcione de entrada si el producto se llama igual que acá.
// Si en Stock cargás un código distinto para alguno, ese manda por sobre
// esta sugerencia.
const CODIGOS_SUGERIDOS = {
  "Bisglicinato de Magnesio": "100",
  "Citrato de Magnesio": "101",
  "Multimagnesio": "102",
  "Magnesio": "103",
  "Calcio, Magnesio y Vitamina D3": "104",
  "Vitamina C, Zinc y Vitamina D": "105",
  "Vitamina B12": "106",
  "Colágeno Hidrolizado": "107",
  "Resveratrol": "108",
  "Cardo Mariano": "200",
  "Tremella": "201",
  "Ashwagandha": "202",
  "Cordyceps": "203",
  "Melena de León": "204",
  "Reishi": "205",
  "Almendra": "300",
  "Chocolate": "301",
  "Proteína": "302",
  "Bites": "303"
};

// Compara nombres de producto sin importar mayúsculas, tildes o espacios de
// más, para que el código de respaldo funcione aunque el nombre real en tu
// catálogo esté escrito un poco distinto al de la lista sugerida.
function normalizarNombreProducto(s) {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // saca tildes
    .toLowerCase().trim().replace(/\s+/g, " ");
}
const CODIGOS_SUGERIDOS_NORM = Object.fromEntries(
  Object.entries(CODIGOS_SUGERIDOS).map(([nombre, cod]) => [normalizarNombreProducto(nombre), cod])
);

// Catálogo "activo": lo que se puede seguir vendiendo. Los productos
// eliminados no se borran de verdad — se ocultan de las listas, pero los
// pedidos viejos que ya los tenían cargados siguen mostrando todo bien,
// porque cada pedido guarda una foto de los datos al momento de la venta.
// Productos activos ordenados por código (100, 101, … 400, 401…), así cada
// producto nuevo cae solo en su lugar. Los que no tienen código van al final,
// en el orden en que se cargaron.
function catalogActivo() {
  const conOrden = catalog.filter(p => !p.eliminado).map((p, i) => ({ p, i, cod: parseInt(codigoDeProducto(p), 10) }));
  conOrden.sort((a, b) => {
    const aTiene = !isNaN(a.cod), bTiene = !isNaN(b.cod);
    if (aTiene && bTiene && a.cod !== b.cod) return a.cod - b.cod;
    if (aTiene !== bTiene) return aTiene ? -1 : 1;
    return a.i - b.i;
  });
  return conOrden.map(x => x.p);
}

function codigoDeProducto(p) {
  if (p.codigo) return String(p.codigo);
  if (CODIGOS_SUGERIDOS[p.nombre]) return CODIGOS_SUGERIDOS[p.nombre];
  return CODIGOS_SUGERIDOS_NORM[normalizarNombreProducto(p.nombre)] || "";
}

function cambiarFiltroCategoria() {
  filtroCategoria = document.getElementById("filtroCategoria").value;
  renderVistaPedido();
}

// Búsqueda rápida por código mientras Joel va tipeando en el campo de
// pedido: si el código coincide con uno solo, selecciona el producto
// directo. Si coincide con varios (por ejemplo tipeó "10" y hay 100-108),
// muestra la lista para que siga tipeando.
function buscarPorCodigo() {
  const info = document.getElementById("infoCodigoProducto");
  if (!info) return;
  const val = document.getElementById("codigoProducto").value.trim();
  if (!val) { info.innerHTML = ""; return; }

  const exacto = catalogActivo().filter(p => codigoDeProducto(p) && codigoDeProducto(p) === val);
  if (exacto.length === 1) {
    seleccionarProductoPorCodigo(exacto[0]);
    mostrarProductoConfirmado(exacto[0]);
    const cantInput = document.getElementById("cantidad");
    if (cantInput) cantInput.focus();
    return;
  }

  const parciales = catalogActivo().filter(p => codigoDeProducto(p) && codigoDeProducto(p).startsWith(val));
  if (parciales.length > 0) {
    info.innerHTML = `
      <div style="border:1px solid #e5e7eb; border-radius:10px; overflow-y:auto; max-height:260px;">
        ${parciales.map(p => `
          <div onclick="elegirCodigoDeLaLista('${p.id}')" style="padding:10px 12px; border-bottom:1px solid #f0f0f0; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
            <div><strong>${codigoDeProducto(p)}</strong> — ${p.nombre}</div>
            ${(() => { const pr = preciosParaClienteActivo(p); return `
            <div style="text-align:right; white-space:nowrap; padding-left:8px;">
              <div style="font-size:14px; font-weight:600; ${pr.usaPublico ? "color:#7c3aed;" : ""}">${pr.usaPublico ? "🏷️ " : ""}${formatCurrency(pr.precio)}</div>
              ${pr.otro ? `<div class="muted" style="font-size:11px;">${pr.etiquetaOtro}: ${formatCurrency(pr.otro)}</div>` : ""}
            </div>`; })()}
          </div>
        `).join("")}
      </div>
      <p class="muted" style="margin-top:4px; font-size:12px;">${parciales.length} coincidencia${parciales.length > 1 ? "s" : ""}${parciales.length > 5 ? " — deslizá para ver todas" : ""}</p>
    `;
    return;
  }

  info.innerHTML = `<div style="color:#dc2626; font-size:14px; padding:8px 0;">⚠️ Ningún producto con ese código</div>`;
}

// Tarjeta grande y clara confirmando qué producto quedó seleccionado — así
// nunca hay dudas de qué estás por cargar antes de poner la cantidad.
function mostrarProductoConfirmado(prod) {
  const info = document.getElementById("infoCodigoProducto");
  if (!info) return;
  const disponible = getDisponibleParaAgregar(prod.id);
  const reservado = prod.stock - disponible;
  const stockTxt = disponible <= 0
    ? `<span style="color:#dc2626;">sin disponible${reservado > 0 ? " (ya reservado en borradores)" : ""}</span>`
    : (disponible <= STOCK_BAJO_UMBRAL ? `<span style="color:#d97706;">disponible: ${disponible}</span>` : `disponible: ${disponible}`);
  const pr = preciosParaClienteActivo(prod);
  info.innerHTML = `
    <div style="background:#ecfdf5; border:1px solid #059669; border-radius:10px; padding:10px 12px;">
      <div style="font-size:16px; font-weight:600; color:#065f46;">✅ ${prod.nombre}</div>
      <div style="font-size:15px; font-weight:600; margin-top:3px; ${pr.usaPublico ? "color:#7c3aed;" : "color:#065f46;"}">${pr.usaPublico ? "🏷️ Precio público: " : "Precio: "}${formatCurrency(pr.precio)}</div>
      <div class="muted" style="font-size:13px; margin-top:2px;">${pr.otro ? `${pr.etiquetaOtro}: ${formatCurrency(pr.otro)} · ` : ""}${stockTxt}</div>
    </div>
  `;
}

// Tocar una de las coincidencias de la lista de código parcial la selecciona
// directo, igual que si hubieras terminado de tipear el código exacto.
function elegirCodigoDeLaLista(prodId) {
  const prod = catalog.find(p => p.id === prodId);
  if (!prod) return;
  document.getElementById("codigoProducto").value = codigoDeProducto(prod);
  seleccionarProductoPorCodigo(prod);
  mostrarProductoConfirmado(prod);
  const cantInput = document.getElementById("cantidad");
  if (cantInput) cantInput.focus();
}

// Al apretar Enter en el campo de código: si ya hay uno solo coincidiendo,
// lo confirma; si hay varios, no hace nada (elegís de la lista con el dedo).
function confirmarCodigoConEnter() {
  const val = document.getElementById("codigoProducto")?.value.trim();
  if (!val) return;
  const parciales = catalogActivo().filter(p => codigoDeProducto(p) && codigoDeProducto(p).startsWith(val));
  if (parciales.length === 1) {
    elegirCodigoDeLaLista(parciales[0].id);
  } else {
    const cantInput = document.getElementById("cantidad");
    if (cantInput && document.getElementById("productoSelect")?.value) cantInput.focus();
  }
}

function seleccionarProductoPorCodigo(prod) {
  filtroCategoria = prod.categoria;
  const catSelect = document.getElementById("filtroCategoria");
  if (catSelect) catSelect.value = prod.categoria;
  renderSelectProductos();
  actualizarVisibilidadDescuento();
  const prodSelect = document.getElementById("productoSelect");
  if (prodSelect) prodSelect.value = prod.id;
  autocompletarProducto();
}

// Muestra u oculta el cuadro de descuento de Vita sin tener que refrescar
// toda la pantalla del pedido (así no se pierde lo que estabas tipeando).
function actualizarVisibilidadDescuento() {
  const el = document.getElementById("descuentoBoxContainer");
  if (el) el.style.display = filtroCategoria === "Vita" ? "block" : "none";
}

// ── Items del pedido ──────────────────────────────────────────────────────────
function getDisponibleParaAgregar(productId) {
  const prod = catalog.find(p => p.id === productId);
  if (!prod) return 0;
  const usadoEnPedidoActual = currentItems.filter(i => i.productId === productId).reduce((a, i) => a + i.cantidad, 0);
  // Lo que ya está "prometido" en otros pedidos que quedaron en borrador
  // (todavía no descontaron stock de verdad, pero ya no está disponible
  // para ofrecerle a otro cliente el mismo día).
  const reservadoEnBorradores = orders
    .filter(o => o.borrador && !o.eliminado && o.id !== editingOrderId)
    .reduce((acc, o) => acc + o.items.filter(i => i.productId === productId).reduce((a, i) => a + i.cantidad, 0), 0);
  return prod.stock - usadoEnPedidoActual - reservadoEnBorradores;
}

function agregarItem() {
  if (!clienteActivoId) return alert("No hay cliente seleccionado");
  const productId = document.getElementById("productoSelect").value;
  const prod = catalog.find(p => p.id === productId);
  if (!prod) return alert("Seleccioná un producto");

  const cantidad = Number(document.getElementById("cantidad").value);
  if (!cantidad || cantidad < 1) return alert("Poné la cantidad antes de agregar");
  if (!modoBorrador && cantidad > getDisponibleParaAgregar(productId)) return alert(`Stock insuficiente. Disponible: ${getDisponibleParaAgregar(productId)}`);

  const pSin = getPrecioConDescuento();
  const pCon = priceWithIVA(pSin);

  // Si el producto ya está cargado en este pedido, no creamos una línea
  // repetida: le sumamos la cantidad nueva a la que ya tenía.
  const existente = currentItems.find(i => i.productId === prod.id);
  if (existente) {
    const cantidadAnterior = existente.cantidad;
    existente.cantidad += cantidad;
    existente.subtotalSinIVA += cantidad * pSin;
    existente.subtotalConIVA += cantidad * pCon;
    // Precio unitario promedio, por si esta vez lo cargó con otro descuento
    existente.precioVentaSinIVA = existente.subtotalSinIVA / existente.cantidad;
    existente.precioVentaConIVA = existente.subtotalConIVA / existente.cantidad;
    alert(`⚠️ "${prod.nombre}" ya estaba en este pedido con ${cantidadAnterior}. Le sumé ${cantidad} más → ahora quedó en ${existente.cantidad}.`);
  } else {
    currentItems.push({
      id: generarId(), productId: prod.id, nombre: prod.nombre, categoria: prod.categoria,
      cantidad, precioVentaSinIVA: pSin, precioVentaConIVA: pCon,
      subtotalSinIVA: cantidad * pSin, subtotalConIVA: cantidad * pCon
    });
  }

  renderPedido();

  // Limpiar todo para el próximo producto: así apretar "Agregar" de nuevo
  // no vuelve a cargar el mismo ítem por accidente.
  const prodSelect = document.getElementById("productoSelect");
  if (prodSelect) prodSelect.value = "";
  const precioInput = document.getElementById("precioVenta");
  if (precioInput) precioInput.value = "";
  const info = document.getElementById("infoPrecioProducto");
  if (info) info.innerHTML = "";
  const cantInput = document.getElementById("cantidad");
  if (cantInput) cantInput.value = "";
  const descInput = document.getElementById("descuentoPct");
  if (descInput) { descInput.value = ""; }
  const descResult = document.getElementById("precioConDescuento");
  if (descResult) descResult.innerHTML = "";

  // Dejamos listo el campo de código para el siguiente producto: escribís
  // el próximo código (101, 102...) sin tener que tocar nada más.
  const codigoInput = document.getElementById("codigoProducto");
  if (codigoInput) { codigoInput.value = ""; codigoInput.focus(); }
  const infoCodigo = document.getElementById("infoCodigoProducto");
  if (infoCodigo) infoCodigo.innerHTML = "";
}

function actualizarCantidadItem(id, nuevaCant) {
  const item = currentItems.find(i => i.id === id);
  if (!item) return;
  const cant = Math.max(1, Number(nuevaCant || 1));
  const prod = catalog.find(p => p.id === item.productId);
  if (!prod) return;

  const otros = currentItems.filter(i => i.productId === item.productId && i.id !== id).reduce((a, i) => a + i.cantidad, 0);
  if (cant > prod.stock - otros) { alert(`Stock insuficiente. Disponible: ${prod.stock - otros}`); renderPedido(); return; }

  currentItems = currentItems.map(i =>
    i.id !== id ? i : { ...i, cantidad: cant, subtotalSinIVA: cant * i.precioVentaSinIVA, subtotalConIVA: cant * i.precioVentaConIVA }
  );
  renderPedido();
}

function eliminarItem(id) {
  currentItems = currentItems.filter(i => i.id !== id);
  renderPedido();
}

function aplicarStock(items, signo) {
  items.forEach(item => {
    const prod = catalog.find(p => p.id === item.productId);
    if (prod) {
      prod.stock += signo * item.cantidad;
      if (prod.stock < 0) prod.stock = 0;
      prod.actualizadoEn = Date.now();
    }
  });
}

function renderPedido() {
  const body = document.getElementById("pedidoBody");
  if (!body) return;
  const modo = document.getElementById("modoPrecio")?.value || "sin";

  body.innerHTML = currentItems.length === 0
    ? `<tr><td colspan="4" class="empty-row">Todavía no agregaste productos.</td></tr>`
    : currentItems.map(item => {
        const precio = modo === "sin" ? formatCurrency(item.subtotalSinIVA)
          : modo === "con" ? formatCurrency(item.subtotalConIVA)
          : `<small>s/${formatCurrency(item.subtotalSinIVA)}<br>c/${formatCurrency(item.subtotalConIVA)}</small>`;
        return `
          <tr>
            <td>${item.nombre}</td>
            <td><input type="number" min="1" value="${item.cantidad}" onchange="actualizarCantidadItem('${item.id}', this.value)" style="width:55px;" /></td>
            <td>${precio}</td>
            <td><button class="btn-danger btn-sm" onclick="eliminarItem('${item.id}')">✕</button></td>
          </tr>`;
      }).join("");

  const tSin  = currentItems.reduce((a, i) => a + i.subtotalSinIVA, 0);
  const tCon  = currentItems.reduce((a, i) => a + i.subtotalConIVA, 0);
  const tCant = currentItems.reduce((a, i) => a + i.cantidad, 0);
  if (document.getElementById("totalSinIva"))  document.getElementById("totalSinIva").textContent  = formatCurrency(tSin);
  if (document.getElementById("totalConIva"))  document.getElementById("totalConIva").textContent  = formatCurrency(tCon);
  if (document.getElementById("totalCantidad")) document.getElementById("totalCantidad").textContent = tCant;
}

// ── Si un potencial compra, deja de ser potencial automáticamente ────────────
function promoverPotencial(clienteId) {
  const c = clients.find(x => x.id === clienteId);
  if (c && c.potencial) {
    c.potencial = false;
    c.seguimiento = "";
    c.actualizadoEn = Date.now();
  }
}

function guardarPedido() {
  const client = clients.find(c => c.id === clienteActivoId);
  if (!client) return alert("No hay cliente seleccionado");
  if (currentItems.length === 0) return alert("Agregá al menos un producto");

  if (!modoBorrador) aplicarStock(currentItems, -1);
  const tSin  = currentItems.reduce((a, i) => a + i.subtotalSinIVA, 0);
  const tCon  = currentItems.reduce((a, i) => a + i.subtotalConIVA, 0);
  const tCant = currentItems.reduce((a, i) => a + i.cantidad, 0);

  orders.unshift({
    id: generarId(), fecha: (() => {
      const d = document.getElementById("fechaPedido");
      if (d && d.value) {
        const [y,m,day] = d.value.split("-");
        return `${day}/${m}/${y}`;
      }
      return new Date().toLocaleString("es-AR");
    })(), client,
    items: [...currentItems],
    notas: document.getElementById("notasPedido").value.trim(),
    modoPrecio: document.getElementById("modoPrecio").value,
    pagado: false,
    pagos: [],
    borrador: modoBorrador,
    actualizadoEn: Date.now(),
    totals: { totalSinIVA: tSin, totalConIVA: tCon, totalCantidad: tCant }
  });

  if (!modoBorrador) promoverPotencial(client.id);

  guardarStorage();
  currentItems   = [];
  editingOrderId = null;
  setVista("historial");
}

function editarPedido(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;
  // Si ya era un pedido confirmado, el stock estaba descontado de verdad y
  // hay que devolverlo mientras se edita. Si todavía es borrador, nunca se
  // tocó el stock, así que no hay nada que devolver.
  if (!order.borrador) aplicarStock(order.items, +1);
  editingOrderId  = id;
  currentItems    = order.items.map(i => ({ ...i }));
  clienteActivoId = order.client.id;
  modoBorrador    = !!order.borrador;   // el switch muestra si este pedido es borrador o no
  setVista("pedido");
}

function guardarCambiosPedido() {
  if (!editingOrderId) return;
  const client = clients.find(c => c.id === clienteActivoId);
  if (!client) return alert("No hay cliente seleccionado");
  if (currentItems.length === 0) return alert("Agregá al menos un producto");

  const idx = orders.findIndex(o => o.id === editingOrderId);
  if (idx === -1) return;

  // Solo se toca el stock real si el pedido ya estaba confirmado. Si sigue
  // en borrador, el stock real no se mueve — se sigue "reservando" nomás.
  // Si estaba confirmado y le prendiste "Ignorar stock", pasa a borrador: el
  // stock que se devolvió al entrar a editar queda devuelto, y el pedido te
  // queda en "Pedidos pendientes de entregar" para Confirmar entrega.
  const eraConfirmado = !orders[idx].borrador;
  const pasaABorrador = eraConfirmado && modoBorrador;
  if (eraConfirmado && !pasaABorrador) aplicarStock(currentItems, -1);
  const tSin  = currentItems.reduce((a, i) => a + i.subtotalSinIVA, 0);
  const tCon  = currentItems.reduce((a, i) => a + i.subtotalConIVA, 0);
  const tCant = currentItems.reduce((a, i) => a + i.cantidad, 0);

  orders[idx] = {
    ...orders[idx], client, items: [...currentItems],
    notas: document.getElementById("notasPedido").value.trim(),
    modoPrecio: document.getElementById("modoPrecio").value,
    totals: { totalSinIVA: tSin, totalConIVA: tCon, totalCantidad: tCant },
    borrador: pasaABorrador ? true : orders[idx].borrador,
    actualizadoEn: Date.now()
  };

  guardarStorage();
  currentItems   = [];
  editingOrderId = null;
  setVista("historial");
}

// Para pedidos en borrador: guarda los cambios que le hiciste (por si sumaste
// o sacaste algo mientras armabas el reparto) Y lo confirma como entregado
// en un solo paso — ahí sí se descuenta el stock real.
function guardarYEntregarPedido() {
  if (!editingOrderId) return;
  const client = clients.find(c => c.id === clienteActivoId);
  if (!client) return alert("No hay cliente seleccionado");
  if (currentItems.length === 0) return alert("Agregá al menos un producto");

  const idx = orders.findIndex(o => o.id === editingOrderId);
  if (idx === -1) return;

  for (const item of currentItems) {
    const prod = catalog.find(p => p.id === item.productId);
    if (prod && prod.stock < item.cantidad) {
      if (!confirm(`Stock insuficiente para ${item.nombre}. Disponible: ${prod.stock}. ¿Confirmás igual?`)) return;
    }
  }

  aplicarStock(currentItems, -1);
  const tSin  = currentItems.reduce((a, i) => a + i.subtotalSinIVA, 0);
  const tCon  = currentItems.reduce((a, i) => a + i.subtotalConIVA, 0);
  const tCant = currentItems.reduce((a, i) => a + i.cantidad, 0);

  // Al confirmar entrega de un borrador, la fecha pasa a ser HOY para que
  // la venta quede en el mes/periodo en que realmente se entregó.
  const fechaEntrega = (() => { const [y,m,d] = fechaHoyLocal().split("-"); return `${d}/${m}/${y}`; })();

  orders[idx] = {
    ...orders[idx], client, items: [...currentItems],
    notas: document.getElementById("notasPedido").value.trim(),
    modoPrecio: document.getElementById("modoPrecio").value,
    totals: { totalSinIVA: tSin, totalConIVA: tCon, totalCantidad: tCant },
    borrador: false,
    fecha: fechaEntrega,
    actualizadoEn: Date.now()
  };

  promoverPotencial(client.id);
  guardarStorage();
  // En vez de volver al Resumen, te muestra el pedido recién entregado (en
  // los pedidos del cliente) para que elijas qué hacer: cobrar, WhatsApp,
  // PDF o remito.
  const idEntregado = orders[idx].id;
  currentItems   = [];
  editingOrderId = null;
  pedidoRecienEntregadoId = idEntregado;
  setVista("historial", client.id);
  setTimeout(() => {
    const card = document.getElementById("order-card-" + idEntregado);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 80);
}

function cancelarEdicionPedido() {
  if (editingOrderId) {
    const order = orders.find(o => o.id === editingOrderId);
    if (order && !order.borrador) aplicarStock(order.items, -1);
  }
  currentItems   = [];
  editingOrderId = null;
  setVista("clientes");
}

function toggleModoBorrador() {
  modoBorrador = document.getElementById("switchBorrador").checked;
  const aviso = document.getElementById("avisoBorrador");
  if (aviso) aviso.style.display = modoBorrador ? "block" : "none";
}

function confirmarEntrega(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  // Verificar stock
  for (const item of order.items) {
    const prod = catalog.find(p => p.id === item.productId);
    if (prod && prod.stock < item.cantidad) {
      if (!confirm(`Stock insuficiente para ${item.nombre}. Disponible: ${prod.stock}. ¿Confirmás igual?`)) return;
    }
  }
  aplicarStock(order.items, -1);
  order.borrador = false;
  order.actualizadoEn = Date.now();
  promoverPotencial(order.client.id);
  guardarStorage();
  renderVistaHistorial();
}

// ── Sistema de pagos parciales ────────────────────────────────────────────────
// ── WhatsApp directo desde la lista de clientes ────────────────────────────
function abrirWhatsAppCliente(clienteId) {
  const c = clients.find(c => c.id === clienteId);
  if (!c || !c.telefono) return;
  const tel = c.telefono.replace(/\D/g, "");
  window.open(`https://wa.me/54${tel}`, "_blank");
}

function abrirWhatsAppCliente2(clienteId) {
  const c = clients.find(c => c.id === clienteId);
  if (!c || !c.telefono2) return;
  const tel = c.telefono2.replace(/\D/g, "");
  window.open(`https://wa.me/54${tel}`, "_blank");
}

// Costo de un producto: primero busca el que Joel cargó a mano en Stock
// (prod.costo). Si todavía no lo cargó, usa el valor viejo fijo como
// respaldo, para no perder el cálculo de golpe mientras carga todos.
function costoDeProducto(item) {
  if (!item) return 0;
  const id = item.productId || item.id;
  let prod = id ? catalog.find(p => p.id === id) : null;
  if (!prod && item.nombre) prod = catalog.find(p => p.nombre === item.nombre);
  if (prod && prod.costo != null && prod.costo !== "") return Number(prod.costo) || 0;
  const nombre = (prod && prod.nombre) || item.nombre || "";
  return PRECIOS_DISTRIBUIDOR[nombre] || 0;
}

function calcularGananciaPedidos(lista) {
  let ganancia = 0;
  lista.forEach(o => {
    o.items.forEach(i => {
      const costo = costoDeProducto(i);
      ganancia += (i.precioVentaSinIVA - costo) * i.cantidad;
    });
  });
  return ganancia;
}

// Ganancia proporcional a lo que realmente se cobró: por cada pago
// registrado, se le aplica el mismo % de margen que tiene el pedido
// completo. Si un pedido tiene 20% de margen y pagaron la mitad del
// total, esa mitad aporta el 20% de margen sobre lo que se cobró.
// ── Costos del vehículo y operación ────────────────────────────────────────
function toggleCostosVehiculo() {
  costosVehiculoAbierto = !costosVehiculoAbierto;
  renderVistaResumen();
}

// Nafta y Km del mes: arrancan cerrados (como Gastos extraordinarios) para
// que el Resumen no quede tan largo; se abren tocando el título.
let naftaAbierto = false;
let kmAbierto = false;
function toggleNafta() { naftaAbierto = !naftaAbierto; renderVistaResumen(); }
function toggleKm() { kmAbierto = !kmAbierto; renderVistaResumen(); }

function toggleGastosExtra() {
  gastosExtraAbierto = !gastosExtraAbierto;
  renderVistaResumen();
}

function guardarConfigVehiculo() {
  configVehiculo = {
    ...configVehiculo, // preserva km y metas ya cargadas, no las pisa
    seguro: parseNumber(document.getElementById("cfgSeguro").value) || 0,
    celular: parseNumber(document.getElementById("cfgCelular").value) || 0,
    monotributo: parseNumber(document.getElementById("cfgMonotributo").value) || 0,
    servicioCosto: parseNumber(document.getElementById("cfgServicioCosto").value) || 0,
    servicioKm: parseNumber(document.getElementById("cfgServicioKm").value) || 1,
    cubiertasCosto: parseNumber(document.getElementById("cfgCubiertasCosto").value) || 0,
    cubiertasKm: parseNumber(document.getElementById("cfgCubiertasKm").value) || 1,
    bateriaCosto: parseNumber(document.getElementById("cfgBateriaCosto").value) || 0,
    bateriaAnios: parseNumber(document.getElementById("cfgBateriaAnios").value) || 1,
    actualizadoEn: Date.now()
  };
  setItemSeguro("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
  // La mandamos a Drive para que se vea igual en todos tus dispositivos
  fetchConTimeout(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "vehiculo", payload: [configVehiculo] }) });
  kmPorMes = configVehiculo.kmPorMes;
  metaPorMes = configVehiculo.metaPorMes;
  renderVistaResumen();
}// Si hay una versión más nueva de la config del vehículo guardada en Drive
// (por ejemplo, la cargaste desde el celu), la trae y la usa acá también.
async function sincronizarConfigVehiculo() {
  try {
    const r = await fetchConTimeout(API_URL + "?tipo=vehiculo");
    const filas = await r.json();
    if (filas.length === 0) return;
    const remoto = JSON.parse(filas[0][0]);
    if ((remoto.actualizadoEn || 0) > (configVehiculo.actualizadoEn || 0)) {
      if (!remoto.kmPorMes) remoto.kmPorMes = {};
      if (!remoto.metaPorMes) remoto.metaPorMes = {};
      configVehiculo = remoto;
      kmPorMes = configVehiculo.kmPorMes;
      metaPorMes = configVehiculo.metaPorMes;
      setItemSeguro("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
      if (vistaActual === "resumen") renderVistaResumen();
    }
  } catch (e) {
    console.log("No se pudo sincronizar la config del vehículo:", e);
  }
}

function calcularGastosExtraMes(mes, anio) {
  return inversiones.filter(i => {
    if (i.eliminado || i.marca !== "Imprevistos") return false;
    const [yi, mi] = (i.fecha || "").split("-");
    return parseInt(mi) === mes && parseInt(yi) === anio;
  }).reduce((a, i) => a + i.monto, 0);
}

function calcularCostosVehiculo(kmDelMes, naftaDelMes, extraordinariosDelMes) {
  const cv = configVehiculo;
  const costoServicioPorKm  = cv.servicioCosto / cv.servicioKm;
  const costoCubiertasPorKm = cv.cubiertasCosto / cv.cubiertasKm;
  const costoNaftaPorKm     = kmDelMes > 0 ? naftaDelMes / kmDelMes : 0;
  const costoPorKm = costoServicioPorKm + costoCubiertasPorKm + costoNaftaPorKm;

  const bateriaMensual = cv.bateriaCosto / (cv.bateriaAnios * 12);
  const gastosFijosMes = cv.seguro + cv.celular + (cv.monotributo || 0) + bateriaMensual;

  const costoVehiculoMes = costoPorKm * kmDelMes;
  const gastosExtraMes = extraordinariosDelMes || 0;
  const costoTotalMes = gastosFijosMes + costoVehiculoMes + gastosExtraMes;

  return { costoServicioPorKm, costoCubiertasPorKm, costoNaftaPorKm, costoPorKm, bateriaMensual, gastosFijosMes, costoVehiculoMes, gastosExtraMes, costoTotalMes };
}

function exportarCierreMes() {
  if (!window.ExcelJS) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    s.onload = () => generarCierreMes();
    document.head.appendChild(s);
  } else {
    generarCierreMes();
  }
}

async function generarCierreMes() {
  const [anioActual, mesActual] = mesResumen.split("-").map(Number);
  const hoyReal = new Date(anioActual, mesActual - 1, 1);

  const pedidosMes = orders.filter(o => {
    if (o.borrador || o.eliminado) return false;
    const partes = o.fecha.replace(/,.*/, '').split('/');
    return parseInt(partes[1]) === mesActual && parseInt(partes[2]) === anioActual;
  });
  const totalVentas = pedidosMes.reduce((a, o) => a + o.totals.totalSinIVA, 0);
  const gananciaMes = calcularGananciaCobrada((dia, mes, anio) => mes === mesActual && anio === anioActual);

  const gastosNafta = inversiones.filter(i => {
    if (i.eliminado || i.marca !== "Combustible") return false;
    const [yi, mi] = (i.fecha || "").split("-");
    return parseInt(mi) === mesActual && parseInt(yi) === anioActual;
  }).reduce((a, i) => a + i.monto, 0);

  const kmDelMes = kmPorMes[mesResumen] || 0;
  const gastosExtra = calcularGastosExtraMes(mesActual, anioActual);
  const gastosExtraDetalle = inversiones.filter(i => {
    if (i.eliminado || i.marca !== "Imprevistos") return false;
    const [yi, mi] = (i.fecha || "").split("-");
    return parseInt(mi) === mesActual && parseInt(yi) === anioActual;
  });
  const res = calcularCostosVehiculo(kmDelMes, gastosNafta, gastosExtra);
  const gananciaNeta = gananciaMes - res.costoTotalMes;

  const totalDeuda = clients.filter(c => !c.eliminado).reduce((a, c) => a + deudaTotalCliente(c.id), 0);

  const marcas = ["Alunexa", "Fungimania", "Vita"];
  const inversionPorMarca = {};
  marcas.forEach(m => {
    inversionPorMarca[m] = inversiones.filter(i => !i.eliminado && i.marca === m).reduce((a, i) => a + i.monto, 0);
  });

  const nombreMes = hoyReal.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  // ── Estilos reutilizables ──────────────────────────────────────────────
  const FMT_MONEDA = '"$" #,##0';
  const bordeFino = { style: "thin", color: { argb: "FFD1D5DB" } };
  const bordeCelda = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino };

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cierre de mes");
  sheet.columns = [{ width: 46 }, { width: 20 }];

  function titulo(texto) {
    const row = sheet.addRow([texto, ""]);
    sheet.mergeCells(`A${row.number}:B${row.number}`);
    row.height = 28;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
      cell.alignment = { vertical: "middle" };
    });
  }
  function espacio() { sheet.addRow([]); }
  function seccion(texto) {
    const row = sheet.addRow([texto, ""]);
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } };
      cell.border = bordeCelda;
    });
  }
  function dato(label, valor, destacado) {
    const row = sheet.addRow([label, valor]);
    const c1 = row.getCell(1), c2 = row.getCell(2);
    c1.border = bordeCelda; c2.border = bordeCelda;
    c2.numFmt = FMT_MONEDA;
    c2.alignment = { horizontal: "right" };
    if (destacado) {
      const esPositivo = valor >= 0;
      const colorTexto = esPositivo ? "FF059669" : "FFDC2626";
      const colorFondo = esPositivo ? "FFDCFCE7" : "FFFEE2E2";
      c1.font = { bold: true, size: 12 };
      c2.font = { bold: true, size: 12, color: { argb: colorTexto } };
      c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorFondo } };
      c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorFondo } };
    } else {
      c1.font = { size: 11 };
      c2.font = { size: 11 };
    }
  }

  titulo(`Cierre de mes — ${nombreMes}`);
  espacio();

  seccion("VENTAS Y GANANCIA");
  dato("Ventas del mes (s/IVA)", totalVentas);
  dato("Ganancia cobrada del mes", gananciaMes);
  espacio();

  seccion("VEHÍCULO Y OPERACIÓN");
  dato("Gastado en nafta", gastosNafta);
  dato("Km recorridos", kmDelMes);
  dato("Costo por km estimado", res.costoPorKm);
  dato("Gastos fijos del mes (seguro + celular + monotributo + batería)", res.gastosFijosMes);
  const descripcionesExtra = gastosExtraDetalle.map(i => i.nota || "sin descripción").join(", ");
  dato(`GASTOS EXTRAORDINARIOS${descripcionesExtra ? ": " + descripcionesExtra : ""}`, res.gastosExtraMes);
  dato("Costo total estimado del mes", res.costoTotalMes);
  espacio();

  dato("GANANCIA NETA ESTIMADA (ganancia − costos)", gananciaNeta, true);
  espacio();

  seccion("INVERSIÓN POR MARCA");
  dato("Alunexa", inversionPorMarca["Alunexa"]);
  dato("Fungimania", inversionPorMarca["Fungimania"]);
  dato("Vita", inversionPorMarca["Vita"]);
  espacio();

  seccion("DEUDA");
  dato("Deuda total pendiente de clientes", totalDeuda);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Cierre_del_mes_Distribuidora_Chaque_${String(mesActual).padStart(2,"0")}-${anioActual}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}


function guardarMetaMes() {
  const val = parseNumber(document.getElementById("inputMetaMes")?.value) || 0;
  metaPorMes[mesResumen] = val;
  configVehiculo.actualizadoEn = Date.now();
  setItemSeguro("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
  fetchConTimeout(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "vehiculo", payload: [configVehiculo] }) });
  renderVistaResumen();
}

// Ventas (sin IVA) de los últimos 6 meses, terminando en el mes/año dado.
function calcularVentasUltimosMeses(mesFin, anioFin, cantidad) {
  const resultado = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    let m = mesFin - i, a = anioFin;
    while (m <= 0) { m += 12; a -= 1; }
    const total = orders.filter(o => {
      if (o.borrador || o.eliminado) return false;
      const partes = o.fecha.replace(/,.*/, '').split('/');
      return parseInt(partes[1]) === m && parseInt(partes[2]) === a;
    }).reduce((acc, o) => acc + o.totals.totalSinIVA, 0);
    const nombreMes = new Date(a, m - 1, 1).toLocaleString("es-AR", { month: "short" });
    const claveMes = `${a}-${String(m).padStart(2, "0")}`;
    const meta = metaPorMes[claveMes] || 0;
    resultado.push({ mes: m, anio: a, nombreMes: nombreMes.replace(".", ""), total, meta });
  }
  return resultado;
}

// Ranking de lo que más se vende dentro de una marca puntual — pensado para
// saber qué reponer. Se ordena por CANTIDAD vendida (no por plata), que es
// lo que importa a la hora de hacer el pedido al distribuidor.
const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Las ventas se agrupan por el NOMBRE ACTUAL del producto: si le cambiaste
// el nombre, sus ventas viejas se suman con las nuevas. Y las ventas viejas
// cuyo producto ya no existe con ese código interno (la app antes los
// regeneraba) se juntan con el producto que tiene el mismo nombre, así no
// aparece dos veces.
function productoVendido(i) {
  let prod = i.productId ? catalog.find(p => p.id === i.productId) : null;
  if (!prod) {
    const n = normalizarNombreProducto(i.nombre);
    prod = catalog.find(p => !p.eliminado && normalizarNombreProducto(p.nombre) === n) || null;
  }
  const nombre = prod ? prod.nombre : i.nombre;
  return { clave: normalizarNombreProducto(nombre), nombre };
}

function calcularRankingVentasMarca(marca, soloEsteMes) {
  const porProducto = {};
  orders.forEach(o => {
    if (o.borrador || o.eliminado) return;
    if (soloEsteMes) {
      const partes = o.fecha.replace(/,.*/, "").split("/");
      if (parseInt(partes[1]) !== mesRankingStock.mes || parseInt(partes[2]) !== mesRankingStock.anio) return;
    }
    o.items.forEach(i => {
      if (i.categoria !== marca) return;
      const { clave, nombre } = productoVendido(i);
      if (!porProducto[clave]) porProducto[clave] = { nombre, cantidad: 0, total: 0 };
      porProducto[clave].cantidad += i.cantidad;
      porProducto[clave].total += i.subtotalSinIVA;
    });
  });
  return Object.values(porProducto)
    .sort((a, b) => b.cantidad - a.cantidad);
}

let modoRankingStock = "mes";
let mesRankingStock = (() => { const h = new Date(); return { mes: h.getMonth()+1, anio: h.getFullYear() }; })();

function cambiarModoRankingStock(modo) {
  modoRankingStock = modo;
  if (modo === "mes") {
    const h = new Date();
    mesRankingStock = { mes: h.getMonth()+1, anio: h.getFullYear() };
  }
  renderVistaStock();
}

function navegarMesRanking(delta) {
  let { mes, anio } = mesRankingStock;
  mes += delta;
  if (mes > 12) { mes = 1; anio++; }
  if (mes < 1)  { mes = 12; anio--; }
  const hoy = new Date();
  if (anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes > hoy.getMonth()+1)) return;
  mesRankingStock = { mes, anio };
  renderVistaStock();
}

function calcularTopClientes(limite) {

  const porCliente = {};
  orders.forEach(o => {
    if (o.borrador || o.eliminado || esPedidoWeb(o)) return;
    const id = o.client.id;
    if (!porCliente[id]) porCliente[id] = { nombre: o.client.nombre, total: 0, pedidos: 0 };
    porCliente[id].total += o.totals.totalSinIVA;
    porCliente[id].pedidos += 1;
  });
  return Object.values(porCliente)
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

// Ranking de clientes y productos de un mes puntual (para el Resumen)
function calcularTopClientesDelMes(mes, anio, limite) {
  const porCliente = {};
  orders.forEach(o => {
    if (o.borrador || o.eliminado || esPedidoWeb(o)) return;
    const partes = o.fecha.replace(/,.*/, '').split('/');
    if (parseInt(partes[1]) !== mes || parseInt(partes[2]) !== anio) return;
    const id = o.client.id;
    if (!porCliente[id]) porCliente[id] = { nombre: o.client.nombre, total: 0, pedidos: 0 };
    porCliente[id].total += o.totals.totalSinIVA;
    porCliente[id].pedidos += 1;
  });
  return Object.values(porCliente).sort((a, b) => b.total - a.total).slice(0, limite);
}

function calcularTopProductosDelMes(mes, anio, limite) {
  const porProducto = {};
  orders.forEach(o => {
    if (o.borrador || o.eliminado) return;
    const partes = o.fecha.replace(/,.*/, '').split('/');
    if (parseInt(partes[1]) !== mes || parseInt(partes[2]) !== anio) return;
    o.items.forEach(i => {
      const { clave, nombre } = productoVendido(i);
      if (!porProducto[clave]) porProducto[clave] = { nombre, cantidad: 0, total: 0 };
      porProducto[clave].cantidad += i.cantidad;
      porProducto[clave].total += i.subtotalSinIVA;
    });
  });
  return Object.values(porProducto)
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

function calcularGananciaCobrada(filtroFecha) {
  let ganancia = 0;
  orders.forEach(o => {
    if (o.eliminado || !o.pagos || o.pagos.length === 0) return;
    const totalPedido = o.totals.totalSinIVA;
    if (!totalPedido) return;
    const margenTotal = calcularGananciaPedidos([o]);
    const ratio = margenTotal / totalPedido;
    o.pagos.forEach(p => {
      const partes = (p.fecha || "").replace(/,.*/, "").split("/");
      const dia = parseInt(partes[0]), mes = parseInt(partes[1]), anio = parseInt(partes[2]);
      if (filtroFecha(dia, mes, anio)) ganancia += p.monto * ratio;
    });
  });
  return ganancia;
}

function calcularSaldo(order) {
  const total = order.totals.totalSinIVA;
  const pagado = (order.pagos || []).reduce((a, p) => a + p.monto, 0);
  return total - pagado;
}

function deudaTotalCliente(clienteId) {
  return orders
    .filter(o => o.client.id === clienteId && !o.pagado && !o.eliminado)
    .reduce((a, o) => a + calcularSaldo(o), 0);
}

const ALIAS_PAGO = "Chaco.corzuela.mp";

// ── Recordatorio de cobro con fecha ────────────────────────────────────────
function toggleFormRecordatorio(id) {
  const form = document.getElementById("form-recordatorio-" + id);
  if (!form) return;
  form.style.display = form.style.display === "none" ? "block" : "none";
}

function guardarRecordatorioPago(id) {
  const fecha = document.getElementById("input-recordatorio-" + id).value;
  const c = clients.find(c => c.id === id);
  if (!c) return;
  c.recordatorioPago = fecha;
  c.actualizadoEn = Date.now();
  guardarStorage();
  renderVistaDeudores();
}

function borrarRecordatorioPago(id) {
  const c = clients.find(c => c.id === id);
  if (!c) return;
  c.recordatorioPago = "";
  c.actualizadoEn = Date.now();
  guardarStorage();
  renderVistaDeudores();
}

// ── Recordatorio de pago por WhatsApp ──────────────────────────────────────
function enviarRecordatorioPago(clienteId) {
  const client = clients.find(c => c.id === clienteId);
  if (!client) return;
  const deuda = deudaTotalCliente(clienteId);
  if (deuda <= 0) return alert("Este cliente no tiene deuda pendiente.");

  const msg = `Hola ${client.nombre} 👋\n\nTe escribo para recordarte que tenés un saldo pendiente de *${formatCurrency(deuda)}* con Distribuidora Chaque.\n\nPodés transferir al alias: *${ALIAS_PAGO}*\n\nCuando puedas, coordinamos el pago. ¡Gracias! 🙌`;
  const tel = client.telefono ? client.telefono.replace(/\D/g, "") : "";
  const url = tel ? `https://wa.me/54${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  if (!tel) alert("Este cliente no tiene teléfono cargado — vas a tener que elegir el contacto a mano en WhatsApp.");
  window.open(url, "_blank");
}

function copiarAlias() {
  navigator.clipboard.writeText(ALIAS_PAGO).then(() => {
    alert("✅ Alias copiado: " + ALIAS_PAGO);
  }).catch(() => {
    alert("No se pudo copiar automáticamente. Tu alias es: " + ALIAS_PAGO);
  });
}

function abrirFormPago(orderId) {
  ordenConFormPago = ordenConFormPago === orderId ? null : orderId;
  renderVistaHistorial();
}

function completarPagoTotal(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  const input = document.getElementById("inputMontoPago-" + orderId);
  if (input) input.value = montoParaInput(calcularSaldo(order));
}

function elegirMedioPago(orderId, medio) {
  document.getElementById("medioPago-" + orderId).value = medio;
  document.getElementById("medioEfectivo-" + orderId).classList.toggle("active", medio === "Efectivo");
  document.getElementById("medioTransferencia-" + orderId).classList.toggle("active", medio === "Transferencia");
}

function confirmarPago(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  const input = document.getElementById("inputMontoPago-" + orderId);
  const monto = parseNumber(input.value);
  if (!monto || monto <= 0) return alert("Ingresá un monto válido");
  const saldo = calcularSaldo(order);
  if (monto > saldo) return alert(`El monto supera el saldo. Saldo pendiente: ${formatCurrency(saldo)}`);
  const medioInput = document.getElementById("medioPago-" + orderId);
  const medio = medioInput ? medioInput.value : "Efectivo";
  if (!order.pagos) order.pagos = [];
  order.pagos.push({ id: generarId(), fecha: new Date().toLocaleString("es-AR"), monto, medio });
  if (calcularSaldo(order) <= 0) order.pagado = true;
  order.actualizadoEn = Date.now();
  ordenConFormPago = null;

  // Si con este pago el cliente quedó sin deuda, el recordatorio de cobro
  // ya no tiene sentido — lo borramos para que no quede colgado y confunda
  // la próxima vez que vuelva a deber.
  if (deudaTotalCliente(order.client.id) <= 0) {
    const c = clients.find(c => c.id === order.client.id);
    if (c && c.recordatorioPago) {
      c.recordatorioPago = "";
      c.actualizadoEn = Date.now();
    }
  }

  guardarStorage();
  renderVistaHistorial();
}

function resetearPagos(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  order.pagos = [];
  order.pagado = false;
  order.actualizadoEn = Date.now();
  guardarStorage();
  renderVistaHistorial();
}

function clienteTieneDeuda(clienteId) {
  return orders.some(o => o.client.id === clienteId && !o.pagado);
}

function eliminarPedido(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;
  if (!confirm(`¿Eliminás este pedido de ${order.client.nombre} (${formatCurrency(order.totals.totalSinIVA)})?`)) return;
  // Solo se devuelve stock si el pedido estaba entregado: un borrador nunca
  // lo había descontado.
  if (!order.borrador) aplicarStock(order.items, +1);
  order.eliminado = true;
  order.actualizadoEn = Date.now();
  guardarStorage();
  renderVistaHistorial();
}

// Eliminar desde la pantalla del pedido (mientras lo estás editando).
// Al entrar a editar un pedido entregado su stock ya se devolvió, así que
// acá no se vuelve a sumar: solo se marca eliminado (borrado suave).
function eliminarPedidoEnEdicion() {
  const order = orders.find(o => o.id === editingOrderId);
  if (!order) return;
  if (!confirm(`¿Eliminás este pedido de ${order.client.nombre}? ${order.borrador ? "" : "Se devuelve el stock de los productos."}`)) return;
  order.eliminado = true;
  order.actualizadoEn = Date.now();
  const clienteId = order.client.id;
  const eraBorrador = !!order.borrador;
  currentItems = [];
  editingOrderId = null; // así salir de la pantalla no vuelve a descontar stock
  guardarStorage();
  if (eraBorrador) setVista("resumen");
  else setVista("historial", clienteId);
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
function construirMensajeWhatsApp(order, modo) {
  let msg = `Hola ${order.client.nombre} 👋\nTe paso el detalle de tu pedido:\n\n`;
  order.items.forEach(i => {
    const precioUnit = modo === "con" ? i.precioVentaConIVA : i.precioVentaSinIVA;
    const subtotal   = modo === "con" ? i.subtotalConIVA    : i.subtotalSinIVA;
    const esBlister12 = BLISTER_12.includes(i.nombre) && i.categoria === "Vita";
    if (esBlister12) {
      msg += `▪️ ${i.nombre}\n   ${i.cantidad} u x ${formatCurrency(precioUnit)} = ${formatCurrency(precioUnit / 12)} c/u\n`;
    } else {
      msg += `▪️ ${i.nombre}\n   ${i.cantidad} u x ${formatCurrency(precioUnit)} = ${formatCurrency(subtotal)}\n`;
    }
  });
  const total = modo === "con" ? order.totals.totalConIVA : order.totals.totalSinIVA;
  msg += `\n💰 *Total: ${formatCurrency(total)}*`;
  if (order.notas) msg += `\n\n📝 ${order.notas}`;
  msg += `\n\nGracias 🙌`;
  return msg;
}

function enviarWhatsAppPedidoActual() {
  const client = clients.find(c => c.id === clienteActivoId);
  if (!client) return alert("No hay cliente seleccionado");
  if (currentItems.length === 0) return alert("Agregá productos al pedido");

  const tSin  = currentItems.reduce((a, i) => a + i.subtotalSinIVA, 0);
  const tCon  = currentItems.reduce((a, i) => a + i.subtotalConIVA, 0);
  const tCant = currentItems.reduce((a, i) => a + i.cantidad, 0);
  const modo  = document.getElementById("modoPrecio").value;

  const pedido = { client, items: [...currentItems], notas: document.getElementById("notasPedido").value.trim(), totals: { totalSinIVA: tSin, totalConIVA: tCon, totalCantidad: tCant } };
  const msg = construirMensajeWhatsApp(pedido, modo);
  const tel = client.telefono ? client.telefono.replace(/\D/g, "") : "";
  const url = tel ? `https://wa.me/54${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

function enviarWhatsAppPedidoGuardado(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;
  const msg = construirMensajeWhatsApp(order, order.modoPrecio || "sin");
  const tel = order.client.telefono ? order.client.telefono.replace(/\D/g, "") : "";
  const url = tel ? `https://wa.me/54${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

// ── Medio de pago para "Vender y cobrar" ─────────────────────────────────────
function elegirMedioVC(medio) {
  document.getElementById("medioVC").value = medio;
  document.getElementById("medioEfectivoVC").classList.toggle("active", medio === "Efectivo");
  document.getElementById("medioTransferenciaVC").classList.toggle("active", medio === "Transferencia");
}

// ── Vender y cobrar al mismo tiempo (un solo mensaje) ──────────────────────
// Para cuando el cliente te compra Y te paga en el momento: guarda el pedido
// ya marcado como PAGADO y manda UN SOLO mensaje de WhatsApp con el detalle
// del pedido + la confirmación del pago, en vez de dos mensajes separados.
function construirMensajeVentaCobrada(order, modo) {
  let msg = `Hola ${order.client.nombre} 👋\nTe paso el detalle de tu compra:\n\n`;
  order.items.forEach(i => {
    const precioUnit = modo === "con" ? i.precioVentaConIVA : i.precioVentaSinIVA;
    const subtotal   = modo === "con" ? i.subtotalConIVA    : i.subtotalSinIVA;
    const esBlister12 = BLISTER_12.includes(i.nombre) && i.categoria === "Vita";
    if (esBlister12) {
      msg += `▪️ ${i.nombre}\n   ${i.cantidad} u x ${formatCurrency(precioUnit)} = ${formatCurrency(precioUnit / 12)} c/u\n`;
    } else {
      msg += `▪️ ${i.nombre}\n   ${i.cantidad} u x ${formatCurrency(precioUnit)} = ${formatCurrency(subtotal)}\n`;
    }
  });
  const total = modo === "con" ? order.totals.totalConIVA : order.totals.totalSinIVA;
  msg += `\n💰 *Total: ${formatCurrency(total)}*`;
  if (order.notas) msg += `\n\n📝 ${order.notas}`;

  // Miramos la deuda TOTAL del cliente (ya con esta venta contada como pagada).
  // Si no debe nada más, queda al día; si tenía otra deuda, le avisamos el saldo.
  const deudaCliente = deudaTotalCliente(order.client.id);
  if (deudaCliente <= 0) {
    msg += `\n\n✅ *Pago recibido* — ¡tu cuenta quedó al día! Gracias 🙌`;
  } else {
    msg += `\n\n✅ *Pago recibido* de esta compra. Tu saldo pendiente actual es *${formatCurrency(deudaCliente)}*. ¡Gracias! 🙌`;
  }
  return msg;
}

function venderYCobrar() {
  const client = clients.find(c => c.id === clienteActivoId);
  if (!client) return alert("No hay cliente seleccionado");
  if (currentItems.length === 0) return alert("Agregá al menos un producto");

  // Leer medio de pago elegido en el selector del formulario
  const medioVC = document.getElementById("medioVC")?.value || "Efectivo";

  // Es una venta real entregada: se descuenta el stock siempre (no es borrador).
  aplicarStock(currentItems, -1);

  const tSin  = currentItems.reduce((a, i) => a + i.subtotalSinIVA, 0);
  const tCon  = currentItems.reduce((a, i) => a + i.subtotalConIVA, 0);
  const tCant = currentItems.reduce((a, i) => a + i.cantidad, 0);
  const modo  = document.getElementById("modoPrecio").value;
  const total = modo === "con" ? tCon : tSin;

  const fecha = (() => {
    const d = document.getElementById("fechaPedido");
    if (d && d.value) { const [y, m, day] = d.value.split("-"); return `${day}/${m}/${y}`; }
    return new Date().toLocaleString("es-AR");
  })();

  const nuevoPedido = {
    id: generarId(), fecha, client,
    items: [...currentItems],
    notas: document.getElementById("notasPedido").value.trim(),
    modoPrecio: modo,
    pagado: true,
    pagos: [{ id: generarId(), fecha: new Date().toLocaleString("es-AR"), monto: total, medio: medioVC }],
    borrador: false,
    actualizadoEn: Date.now(),
    totals: { totalSinIVA: tSin, totalConIVA: tCon, totalCantidad: tCant }
  };
  orders.unshift(nuevoPedido);
  promoverPotencial(client.id);

  // Abrimos WhatsApp en el MISMO toque (antes de guardar y redibujar), para que
  // el celu abra la app directo y los emojis salgan bien.
  const msg = construirMensajeVentaCobrada(nuevoPedido, modo);
  const tel = client.telefono ? client.telefono.replace(/\D/g, "") : "";
  const url = tel ? `https://wa.me/54${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  if (!tel) alert("Este cliente no tiene teléfono cargado — vas a tener que elegir el contacto a mano en WhatsApp.");
  window.open(url, "_blank");

  guardarStorage();
  currentItems   = [];
  editingOrderId = null;
  setVista("historial");
}

// ── Confirmación de pago por WhatsApp ──────────────────────────────────────
function enviarConfirmacionPago(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;
  if (!order.pagos || order.pagos.length === 0) return alert("Este pedido todavía no tiene ningún pago registrado.");

  const ultimoPago = order.pagos[order.pagos.length - 1];
  // Miramos la deuda TOTAL del cliente (todas sus facturas pendientes), no la de
  // este pedido suelto. Así, si pagó un pedido pero le queda otro sin pagar, el
  // mensaje le avisa el saldo que le queda — igual que en Deudores — en vez de
  // decir "quedó al día" por error.
  const deudaCliente = deudaTotalCliente(order.client.id);
  const nombre = order.client.nombre;

  const msg = deudaCliente <= 0
    ? `Hola ${nombre} 👋\n\nConfirmo que recibí tu pago de *${formatCurrency(ultimoPago.monto)}*. Tu cuenta quedó al día. ¡Gracias! 🙌`
    : `Hola ${nombre} 👋\n\nConfirmo que recibí tu pago de *${formatCurrency(ultimoPago.monto)}*. Tu saldo pendiente actual es *${formatCurrency(deudaCliente)}*. ¡Gracias! 🙌`;

  const tel = order.client.telefono ? order.client.telefono.replace(/\D/g, "") : "";
  const url = tel ? `https://wa.me/54${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  if (!tel) alert("Este cliente no tiene teléfono cargado — vas a tener que elegir el contacto a mano en WhatsApp.");
  window.open(url, "_blank");
}

// ── Impresión de remito en impresora térmica Bluetooth (vía RawBT) ─────────
// RawBT es una app gratis de Android que hace de "puente" entre el navegador
// y la impresora Bluetooth (la mayoría de las térmicas chinas no se pueden
// conectar directo desde un sitio web). Hace falta tenerla instalada y la
// impresora ya emparejada y elegida adentro de RawBT para que esto funcione.
function imprimirRemito(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;

  const modo = order.modoPrecio === "con" ? "con" : "sin";
  const lineas = [];
  lineas.push("--------------------------------");
  lineas.push(`Cliente: ${order.client.nombre}`);
  lineas.push(`Fecha: ${order.fecha}`);
  lineas.push("--------------------------------");

  order.items.forEach(i => {
    const precio = modo === "con" ? i.precioVentaConIVA : i.precioVentaSinIVA;
    const subtotal = modo === "con" ? i.subtotalConIVA : i.subtotalSinIVA;
    const esBlister12 = BLISTER_12.includes(i.nombre) && i.categoria === "Vita";
    lineas.push(`${i.cantidad} x ${i.nombre}`);
    if (esBlister12) {
      lineas.push(`   ${formatCurrency(precio)} la caja = ${formatCurrency(precio / 12)} c/u`);
    } else {
      lineas.push(`   ${formatCurrency(precio)} c/u = ${formatCurrency(subtotal)}`);
    }
  });

  lineas.push("--------------------------------");
  const total = modo === "con" ? order.totals.totalConIVA : order.totals.totalSinIVA;
  lineas.push(`TOTAL: ${formatCurrency(total)}`);
  lineas.push("");
  lineas.push("Comprobante no válido como factura");
  if (order.notas) { lineas.push(""); lineas.push(`Notas: ${order.notas}`); }
  lineas.push("");
  lineas.push("¡Gracias por su compra!");

  // Armamos el logo + todo el texto como UNA sola imagen (con el canvas del
  // navegador) y la mandamos a imprimir en un único envío. Antes lo
  // mandábamos en dos partes (logo y después texto) y el celular bloqueaba
  // la segunda por seguridad, por eso a veces salía solo el logo.
  const logoImg = new Image();
  logoImg.onload = () => {
    const anchoCanvas = 384;
    const anchoLogo = 220;
    const altoLogo = Math.round(anchoLogo * (logoImg.height / logoImg.width));
    const lineHeight = 20;
    const paddingSup = 14;
    const margenLogoTexto = 12;
    const alturaTexto = lineas.length * lineHeight;
    const altoCanvas = paddingSup + altoLogo + margenLogoTexto + alturaTexto + paddingSup;

    const canvas = document.createElement("canvas");
    canvas.width = anchoCanvas;
    canvas.height = altoCanvas;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, anchoCanvas, altoCanvas);

    ctx.drawImage(logoImg, (anchoCanvas - anchoLogo) / 2, paddingSup, anchoLogo, altoLogo);

    ctx.fillStyle = "#000000";
    ctx.font = "15px monospace";
    ctx.textBaseline = "top";
    let y = paddingSup + altoLogo + margenLogoTexto;
    lineas.forEach(linea => {
      ctx.fillText(linea, 8, y);
      y += lineHeight;
    });

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    window.location.href = "intent:data:image/png;base64," + base64 + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
  };
  logoImg.src = "data:image/png;base64," + LOGO_TICKET_BASE64;
}

function toggleFormPrecio(id) {
  const form = document.getElementById("form-precio-" + id);
  if (!form) return;
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// Para productos que vendés a comisión (por ejemplo le ganás 10% y el resto
// es del proveedor): en vez de calcular el costo a mano, ponés tu % y esto
// completa el campo de Costo solo, para que la ganancia del sistema termine
// mostrando justo tu comisión.
function calcularCostoPorComision(id) {
  const precioInput = document.getElementById("input-precio-" + id);
  const comisionInput = document.getElementById("input-comision-" + id);
  const costoInput = document.getElementById("input-costo-" + id);
  if (!precioInput || !comisionInput || !costoInput) return;
  const precio = parseNumber(precioInput.value);
  const comision = parseNumber(comisionInput.value);
  if (!precio || comisionInput.value.trim() === "") return;
  const costo = precio * (1 - comision / 100);
  costoInput.value = Math.round(costo * 100) / 100;
}

function toggleFormNuevoProducto() {
  const form = document.getElementById("form-nuevo-producto");
  if (!form) return;
  form.style.display = form.style.display === "none" ? "block" : "none";
}

function calcularCostoNuevoProductoPorComision() {
  const precio = parseNumber(document.getElementById("nuevoProductoPrecio")?.value);
  const comisionInput = document.getElementById("nuevoProductoComision");
  const costoInput = document.getElementById("nuevoProductoCosto");
  if (!precio || !comisionInput || !costoInput || comisionInput.value.trim() === "") return;
  const comision = parseNumber(comisionInput.value);
  costoInput.value = Math.round(precio * (1 - comision / 100) * 100) / 100;
}

function guardarNuevoProducto() {
  const nombre = document.getElementById("nuevoProductoNombre").value.trim();
  const categoria = document.getElementById("nuevoProductoCategoria").value.trim();
  const precio = parseNumber(document.getElementById("nuevoProductoPrecio").value);
  const codigo = document.getElementById("nuevoProductoCodigo").value.trim();
  const costoVal = document.getElementById("nuevoProductoCosto").value;
  const stock = parseInt(document.getElementById("nuevoProductoStock").value) || 0;
  const precioPublicoVal = document.getElementById("nuevoProductoPrecioPublico")?.value || "";

  if (!nombre) return alert("Escribí el nombre del producto");
  if (!categoria) return alert("Escribí la marca / categoría del producto");
  if (!precio || precio <= 0) return alert("Ingresá un precio de venta válido");

  const yaExiste = catalogActivo().find(p => p.nombre.trim().toLowerCase() === nombre.toLowerCase());
  if (yaExiste) {
    if (!confirm(`Ya tenés cargado "${yaExiste.nombre}". ¿Igual querés crear otro producto con ese nombre?`)) return;
  }

  if (codigo) {
    const repetido = catalogActivo().find(p => codigoDeProducto(p) === codigo);
    if (repetido) return alert(`El código ${codigo} ya lo tiene "${repetido.nombre}". Elegí otro.`);
  }

  const nuevo = {
    id: generarId(), nombre, categoria, precioVentaSinIVA: precio, stock,
    actualizadoEn: Date.now()
  };
  if (codigo) nuevo.codigo = codigo;
  if (costoVal.trim() !== "") nuevo.costo = parseNumber(costoVal);
  if (precioPublicoVal.trim() !== "") {
    const pp = parseNumber(precioPublicoVal);
    if (pp > 0) nuevo.precioPublico = pp;
  }

  catalog.push(nuevo);
  guardarStorage();

  ["nuevoProductoNombre", "nuevoProductoCategoria", "nuevoProductoPrecio", "nuevoProductoCodigo", "nuevoProductoCosto", "nuevoProductoComision", "nuevoProductoStock", "nuevoProductoPrecioPublico"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  const form = document.getElementById("form-nuevo-producto");
  if (form) form.style.display = "none";

  filtroStock = categoria;
  renderVistaStock();
  alert(`✅ "${nombre}" agregado a ${categoria}.`);
}

function guardarPrecio(id) {
  const prod = catalog.find(p => p.id === id);
  if (!prod) return;

  const nombreInput = document.getElementById("input-nombre-" + id);
  const nuevoNombre = nombreInput ? nombreInput.value.trim() : prod.nombre;
  if (!nuevoNombre) return alert("El nombre no puede quedar vacío");

  const categoriaInput = document.getElementById("input-categoria-" + id);
  const nuevaCategoria = categoriaInput ? categoriaInput.value.trim() : prod.categoria;
  if (!nuevaCategoria) return alert("La marca / categoría no puede quedar vacía");

  const nuevoPrecio = parseNumber(document.getElementById("input-precio-" + id).value);
  if (!nuevoPrecio || nuevoPrecio <= 0) return alert("Ingresá un precio de venta válido");
  const costoInput = document.getElementById("input-costo-" + id);
  const nuevoCosto = costoInput ? parseNumber(costoInput.value) : null;
  if (costoInput && costoInput.value.trim() !== "" && nuevoCosto < 0) return alert("El costo no puede ser negativo");

  const codigoInput = document.getElementById("input-codigo-" + id);
  const nuevoCodigo = codigoInput && codigoInput.value.trim() !== "" ? codigoInput.value.trim() : "";
  if (nuevoCodigo) {
    const repetido = catalogActivo().find(p => p.id !== id && codigoDeProducto(p) === nuevoCodigo);
    if (repetido) return alert(`El código ${nuevoCodigo} ya lo tiene "${repetido.nombre}". Elegí otro.`);
  }

  const otroConMismoNombre = catalogActivo().find(p => p.id !== id && p.nombre.trim().toLowerCase() === nuevoNombre.toLowerCase());
  if (otroConMismoNombre) {
    if (!confirm(`Ya tenés otro producto llamado "${otroConMismoNombre.nombre}". ¿Igual querés dejarlo así?`)) return;
  }

  const precioPublicoInput = document.getElementById("input-preciopublico-" + id);
  const categoriaVieja = prod.categoria;
  prod.nombre = nuevoNombre;
  prod.categoria = nuevaCategoria;
  prod.precioVentaSinIVA = nuevoPrecio;
  if (costoInput && costoInput.value.trim() !== "") prod.costo = nuevoCosto;
  prod.codigo = nuevoCodigo;
  if (precioPublicoInput) {
    const pp = parseNumber(precioPublicoInput.value);
    if (precioPublicoInput.value.trim() !== "" && pp > 0) prod.precioPublico = pp;
    else delete prod.precioPublico;
  }
  prod.actualizadoEn = Date.now();
  guardarStorage();
  if (nuevaCategoria !== categoriaVieja) filtroStock = nuevaCategoria;
  renderVistaStock();
}

// Borrado "suave": el producto desaparece de Stock, de los pedidos nuevos y
// de los códigos, pero los pedidos VIEJOS que ya lo tenían cargado siguen
// mostrando todo bien (cada pedido guarda una foto de los datos de venta).
// Junta dos productos repetidos en uno solo (el que queda = destino):
// suma el stock, pasa las ventas (también las de pedidos viejos) al que
// queda, y el repetido se elimina "suave" (eliminado: true, sigue en el
// historial). Todo con fecha de cambio, para que se sincronice bien.
function unificarProducto(idDestino) {
  const sel = document.getElementById("unificar-" + idDestino);
  const idOrigen = sel ? sel.value : "";
  if (!idOrigen) return alert("Elegí el producto repetido.");
  const destino = catalog.find(p => p.id === idDestino);
  const origen = catalog.find(p => p.id === idOrigen);
  if (!destino || !origen || destino.id === origen.id) return;

  const esDelOrigen = i => i.productId === origen.id || (!catalog.some(p => p.id === i.productId) && i.nombre === origen.nombre);
  const afectados = orders.filter(o => (o.items || []).some(esDelOrigen));
  const stockFinal = (Number(destino.stock) || 0) + (Number(origen.stock) || 0);
  if (!confirm(`Va a quedar un solo producto: "${destino.nombre}".\n\n` +
    `• Stock: ${destino.stock} + ${origen.stock} = ${stockFinal}\n` +
    `• ${afectados.length} pedido${afectados.length === 1 ? "" : "s"} con "${origen.nombre}" pasan a figurar como "${destino.nombre}"\n` +
    `• "${origen.nombre}" se elimina (queda en el historial)\n\n¿Seguimos?`)) return;

  const ahora = Date.now();
  destino.stock = stockFinal;
  destino.actualizadoEn = ahora;
  origen.stock = 0;
  origen.eliminado = true;
  origen.actualizadoEn = ahora;
  afectados.forEach(o => {
    o.items = o.items.map(i => esDelOrigen(i) ? { ...i, productId: destino.id, nombre: destino.nombre, categoria: destino.categoria } : i);
    o.actualizadoEn = ahora;
  });
  guardarStorage();
  renderVistaStock();
  alert(`✅ Listo: quedó solo "${destino.nombre}" con ${stockFinal} de stock.`);
}

function eliminarProducto(id) {
  const prod = catalog.find(p => p.id === id);
  if (!prod) return;
  if (!confirm(`¿Eliminar "${prod.nombre}"? No vas a poder cargarlo en pedidos nuevos, pero tus ventas viejas de este producto quedan intactas en el historial.`)) return;
  prod.eliminado = true;
  prod.actualizadoEn = Date.now();
  guardarStorage();
  renderVistaStock();
}

// ── Stock ─────────────────────────────────────────────────────────────────────
// Fecha de la última carga de stock hecha A MANO (Sumar o Fijar stock), para
// acordarse si ya se cargó. Las ventas no la cambian.
function marcarCargaStock(prod, detalle) {
  prod.stockCargadoEn = Date.now();
  prod.stockCargadoDetalle = detalle;
}

function textoUltimaCargaStock(p) {
  if (!p.stockCargadoEn) return "";
  const f = new Date(p.stockCargadoEn);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diaCarga = new Date(f); diaCarga.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy - diaCarga) / 86400000);
  const hora = f.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const cuando = dias === 0 ? `hoy ${hora}` : dias === 1 ? `ayer ${hora}` : f.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) + ` ${hora}`;
  const color = dias === 0 ? "#059669" : "#6b7280";
  return `<div style="font-size:11px; color:${color}; margin-top:2px;">📦 Stock cargado: ${cuando}${p.stockCargadoDetalle ? ` (${p.stockCargadoDetalle})` : ""}</div>`;
}

function cargarStock() {
  const id   = document.getElementById("stockProductoSelect").value;
  const cant = Math.max(0, Number(document.getElementById("stockAgregar").value || 0));
  const prod = catalog.find(p => p.id === id);
  if (!prod) return alert("Seleccioná un producto");
  if (cant <= 0) return alert("Ingresá una cantidad mayor a 0");
  prod.stock += cant;
  prod.actualizadoEn = Date.now();
  marcarCargaStock(prod, "+" + cant);
  guardarStorage();
  document.getElementById("stockAgregar").value = 0;
  renderVistaStock();
}

function fijarStock() {
  const id   = document.getElementById("stockProductoSelect").value;
  const cant = Math.max(0, Number(document.getElementById("stockAgregar").value || 0));
  const prod = catalog.find(p => p.id === id);
  if (!prod) return alert("Seleccioná un producto");
  prod.stock = cant;
  prod.actualizadoEn = Date.now();
  marcarCargaStock(prod, "fijado en " + cant);
  guardarStorage();
  document.getElementById("stockAgregar").value = 0;
  renderVistaStock();
}

// ── Backup ────────────────────────────────────────────────────────────────────
function exportarDatos() {
  const blob = new Blob([JSON.stringify({ fecha: new Date().toISOString(), clients, catalog, orders, inversiones, configVehiculo }, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "backup-pedidos-distribuidora-chaque.json"; a.click();
  URL.revokeObjectURL(url);
}

function importarDatos(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const bk = JSON.parse(e.target.result);
      if (!bk.clients || !bk.catalog || !bk.orders) return alert("Archivo no válido");
      // Fusiona el backup con lo que ya tenés ahora, en vez de reemplazarlo:
      // si algo de hoy ya no está en el backup, se conserva igual; si el
      // backup tiene algo que ya no está ahora (ej: un cliente borrado por
      // error), se recupera. En caso de mismo ID en los dos, gana lo actual.
      clients = fusionarPorId(clients, bk.clients);
      catalog = fusionarCatalogoPorNombre(catalog, bk.catalog);
      orders  = fusionarPorId(orders, bk.orders);
      // Los backups nuevos traen también inversiones/gastos y la config del
      // vehículo (km y metas por mes). Los backups viejos no las tienen: en
      // ese caso no se toca nada de eso.
      if (Array.isArray(bk.inversiones)) inversiones = fusionarPorId(inversiones, bk.inversiones);
      if (bk.configVehiculo && typeof bk.configVehiculo === "object") {
        const cfgBk = bk.configVehiculo;
        // Km y metas: se recuperan los meses que hoy no tenés cargados, sin
        // pisar los que ya tenés.
        let cambio = false;
        ["kmPorMes", "metaPorMes"].forEach(campo => {
          Object.keys(cfgBk[campo] || {}).forEach(mes => {
            if (configVehiculo[campo][mes] === undefined) { configVehiculo[campo][mes] = cfgBk[campo][mes]; cambio = true; }
          });
        });
        // Los costos fijos (seguro, celular, etc.) solo se toman del backup
        // si son más nuevos que los que tenés ahora.
        if ((cfgBk.actualizadoEn || 0) > (configVehiculo.actualizadoEn || 0)) {
          const { kmPorMes: _k, metaPorMes: _m, ...costos } = cfgBk;
          Object.assign(configVehiculo, costos);
          cambio = true;
        }
        if (cambio) {
          configVehiculo.actualizadoEn = Date.now();
          kmPorMes = configVehiculo.kmPorMes;
          metaPorMes = configVehiculo.metaPorMes;
          setItemSeguro("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
          fetchConTimeout(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "vehiculo", payload: [configVehiculo] }) });
        }
      }
      guardarStorage();
      setVista("clientes");
      alert("Backup combinado con tus datos actuales — no se borró nada de lo que ya tenías.");
    } catch { alert("No se pudo importar el archivo"); }
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════════════════════════════

function renderApp() {
  const inactivosCount = contarClientesInactivos();
  document.getElementById("app").innerHTML = `
    <div id="screen">
      <div id="vista-contenido"></div>
    </div>

    <!-- Modal: opciones del cliente -->
    <div class="modal-overlay" id="modalCliente" style="display:none;" onclick="cerrarModal()">
      <div class="modal-card" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="cerrarModal()">✕</button>
        <div class="modal-header">
          <strong id="modalClienteNombre"></strong>
          <div class="muted" id="modalClienteInfo"></div>
        </div>
        <div class="modal-grid">
          <button class="modal-btn" onclick="irACargarPedido()">
            <span class="modal-icon">📋</span>
            <span>Cargar Pedido</span>
          </button>
          <button class="modal-btn" onclick="verHistorial()">
            <span class="modal-icon">📄</span>
            <span>Últimos Pedidos</span>
          </button>
          <button class="modal-btn" onclick="verDatosCliente()">
            <span class="modal-icon">👁️</span>
            <span>Ver Datos</span>
          </button>
          <button class="modal-btn" onclick="abrirFormCliente(clienteActivoId)">
            <span class="modal-icon">✏️</span>
            <span>Editar Cliente</span>
          </button>
          <button class="modal-btn" onclick="abrirMaps()">
            <span class="modal-icon">📍</span>
            <span>Cómo llegar</span>
          </button>
          <button class="modal-btn" onclick="marcarVisitado()">
            <span class="modal-icon">👋</span>
            <span>Visitado hoy</span>
          </button>
          <button class="modal-btn" id="btnModalTelefono2" style="display:none;" onclick="abrirWhatsAppCliente2(clienteActivoId)">
            <span class="modal-icon">💬</span>
            <span>WhatsApp Tel. 2</span>
          </button>
          <button class="modal-btn modal-btn-danger" onclick="confirmarEliminarCliente()">
            <span class="modal-icon">🗑️</span>
            <span>Eliminar</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: ver datos del cliente (solo lectura) -->
    <div class="modal-overlay" id="modalVerCliente" style="display:none;" onclick="cerrarModalVerCliente()">
      <div class="modal-card" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="cerrarModalVerCliente()">✕</button>
        <div class="modal-header">
          <strong id="verClienteNombre"></strong>
        </div>
        <div id="verClienteDatos" style="text-align:left; padding:6px 0 14px;"></div>
        <button class="btn-primary btn-full" onclick="cerrarModalVerCliente(); abrirFormCliente(clienteActivoId);">✏️ Editar estos datos</button>
      </div>
    </div>

    <!-- Modal: confirmar eliminar -->
    <div class="modal-overlay" id="modalConfirmar" style="display:none;">
      <div class="modal-card confirm-card">
        <p>¿Eliminás a <strong id="confirmarNombre"></strong>?</p>
        <div class="confirm-btns">
          <button class="btn-danger" onclick="eliminarClienteActivo()">Sí, eliminar</button>
          <button class="btn-gray" onclick="cerrarModalConfirmar()">Cancelar</button>
        </div>
      </div>
    </div>

    <!-- Modal: ver imagen del producto -->
    <div class="modal-overlay" id="modalImagenProducto" style="display:none;" onclick="cerrarModalImagen()">
      <div class="modal-card" style="text-align:center;" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="cerrarModalImagen()">✕</button>
        <img id="imgProductoModal" style="max-width:100%; border-radius:10px; margin-top:10px;" />
      </div>
    </div>

    <!-- Bottom nav -->
    <nav class="bottom-nav">
      <button class="nav-btn ${['clientes','form-cliente'].includes(vistaActual) ? 'active' : ''}" onclick="setVista('clientes')">
  <span class="nav-icon">👥</span><span class="nav-label">Clientes</span>
  ${inactivosCount > 0 ? `<span class="nav-badge">${inactivosCount}</span>` : ''}
</button>
      <button class="nav-btn ${vistaActual === 'deudores' ? 'active' : ''}" onclick="setVista('deudores')">
        <span class="nav-icon">💰</span><span class="nav-label">Deudores</span>
      </button>
      <button class="nav-btn ${vistaActual === 'resumen' ? 'active' : ''}" onclick="setVista('resumen')">
        <span class="nav-icon">📊</span><span class="nav-label">Resumen</span>
      </button>
      <button class="nav-btn ${vistaActual === 'stock' ? 'active' : ''}" onclick="abrirStock()">
  <span class="nav-icon">📦</span><span class="nav-label">Stock</span>
  ${contarStockBajo() > 0 ? `<span class="nav-badge">${contarStockBajo()}</span>` : ''}
</button>
      <button class="nav-btn ${vistaActual === 'backup' ? 'active' : ''}" onclick="setVista('backup')">
        <span class="nav-icon">💾</span><span class="nav-label">Backup</span>
      </button>
    </nav>
  `;

  switch (vistaActual) {
    case "clientes":    renderVistaClientes();    break;
    case "form-cliente":renderVistaFormCliente(); break;
    case "pedido":      renderVistaPedido();      break;
    case "historial":   renderVistaHistorial();   break;
    case "deudores":    renderVistaDeudores();    break;
    case "resumen":     renderVistaResumen();     break;
    case "stock":       renderVistaStock();       break;
    case "lista-precios": renderVistaListaPrecios(); break;
    case "backup":      renderVistaBackup();      break;
    case "carga-masiva": renderVistaCargaMasiva(); break;
    case "inactivos":   renderVistaInactivos();   break;
    case "potenciales": renderVistaPotenciales(); break;
    case "aviso-marca": renderVistaAvisoMarca();  break;
    case "mapa-rutas": renderVistaMapaRutas(); break;
    case "pedido-web": renderVistaPedidoWeb(); break;
  }
}

// ── Vista: CLIENTES ───────────────────────────────────────────────────────────
// Umbral de inactividad según la frecuencia de visita de cada cliente
// (7 = semanal, 14 = quincenal). Si no tiene, usa el umbral general.
function umbralInactividad(c) {
  return Number(c && c.frecuencia) || DIAS_INACTIVIDAD_UMBRAL;
}

// Solo los clientes "de ruta" cuentan para inactividad: los potenciales no,
// y los de tipo "Otro" (familia, amigos) tampoco.
// "Sin frecuencia" (0): el cliente no tiene día fijo de visita, así que
// nunca se marca como que pasó sus días sin comprar.
function sinFrecuencia(c) {
  return !!c && (c.frecuencia === 0 || c.frecuencia === "0");
}
function cuentaInactividad(c) {
  return c && !c.potencial && (c.tipo || "Otro") !== "Otro" && !sinFrecuencia(c);
}

function contarClientesInactivos() {
  return clients.filter(c => {
    if (c.eliminado || !cuentaInactividad(c)) return false;
    const dias = diasSinComprar(c.id);
    return dias !== null && dias >= umbralInactividad(c);
  }).length;
}

// Cuenta productos agotados o con stock bajo, para la alertita en la barra de abajo
function contarStockBajo() {
  return catalogActivo().filter(p => p.stock <= STOCK_BAJO_UMBRAL).length;
}

function diasSinComprar(clienteId) {
  const c = clients.find(x => x.id === clienteId);
  const pedidosCliente = orders.filter(o => o.client.id === clienteId && !o.borrador && !o.eliminado);

  let fechaUltimo = null;
  pedidosCliente.forEach(o => {
    const partes = o.fecha.split(/[\/,\s]/).filter(Boolean);
    const f = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
    if (!fechaUltimo || f > fechaUltimo) fechaUltimo = f;
  });

  // Si lo visité y todavía tenía mercadería, la visita cuenta como contacto
  // y el contador arranca de nuevo desde ese día.
  if (c && c.ultimaVisita) {
    const fv = new Date(c.ultimaVisita + "T00:00:00");
    if (!fechaUltimo || fv > fechaUltimo) fechaUltimo = fv;
  }

  if (!fechaUltimo) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoy - fechaUltimo) / (1000 * 60 * 60 * 24));
  return diff;
}

// ── Marcar visita sin compra (resetea el contador de inactividad) ────────────
function marcarVisitado() {
  const c = clients.find(x => x.id === clienteActivoId);
  if (!c) return;
  c.ultimaVisita = fechaHoyLocal();
  c.actualizadoEn = Date.now();
  guardarStorage();
  cerrarModal();
  renderApp();
  alert("👋 Listo. El contador de " + c.nombre + " arranca de nuevo desde hoy.");
}

// ── Vista: CARGA MASIVA DE CLIENTES ───────────────────────────────────────────
function renderVistaCargaMasiva() {
  const cont = document.getElementById("vista-contenido");
  cont.innerHTML = `
    <div class="page-header">
      <h2 class="page-title2">📋 Carga masiva de clientes</h2>
    </div>

    <div class="form-card">
      <p class="muted" style="margin-bottom:10px;">
        Escribí un cliente por línea, separando los datos con comas, en este orden:<br>
        <strong>Nombre, Teléfono, Tipo, Día de visita</strong><br><br>
        Teléfono, Tipo y Día son opcionales (podés dejarlos vacíos, pero no te olvides de las comas).
        Tipo tiene que ser uno de: ${TIPOS_CLIENTE.join(", ")}.
        Día tiene que ser uno de: ${DIAS_VISITA.join(", ")}.
      </p>
      <div class="form-group">
        <textarea id="textoCargaMasiva" rows="14" placeholder="Farmacia San Martín, 3415551234, Farmacia, Lunes
Dietética Vida Sana, , Dietética, Martes
Kiosco Don Pepe, 3415559999, Kiosco, Lunes"></textarea>
      </div>
      <button class="btn-primary btn-full" onclick="procesarCargaMasiva()">✅ Cargar todos</button>
      <div id="resultadoCargaMasiva" class="muted" style="margin-top:10px;"></div>
    </div>
  `;
}

function procesarCargaMasiva() {
  const texto = document.getElementById("textoCargaMasiva").value;
  const lineas = texto.split("\n").map(l => l.trim()).filter(l => l);
  if (lineas.length === 0) return alert("No hay nada para cargar.");

  let cargados = 0;
  let conAvisos = [];

  lineas.forEach((linea, i) => {
    const partes = linea.split(",").map(p => p.trim());
    const nombre = partes[0] || "";
    if (!nombre) return; // sin nombre, se ignora la línea

    const telefono = partes[1] || "";
    let tipoTexto = (partes[2] || "").trim();
    let diaTexto  = (partes[3] || "").trim();

    let tipo = TIPOS_CLIENTE.find(t => t.toLowerCase() === tipoTexto.toLowerCase());
    if (!tipo) {
      if (tipoTexto) conAvisos.push(`Línea ${i + 1}: tipo "${tipoTexto}" no reconocido, quedó como "Otro"`);
      tipo = "Otro";
    }

    let diaVisita = DIAS_VISITA.find(d => d.toLowerCase() === diaTexto.toLowerCase());
    if (!diaVisita) {
      if (diaTexto) conAvisos.push(`Línea ${i + 1}: día "${diaTexto}" no reconocido, quedó sin asignar`);
      diaVisita = "";
    }

    clients.push({
      id: generarId(), nombre, tipo, diaVisita, telefono,
      email: "", direccion: "", notas: "", potencial: false, seguimiento: "", lat: null, lng: null
    });
    cargados++;
  });

  guardarStorage();

  const resultado = document.getElementById("resultadoCargaMasiva");
  if (resultado) {
    resultado.innerHTML = `✅ Se cargaron ${cargados} clientes.` +
      (conAvisos.length ? `<br><br>⚠️ Avisos:<br>${conAvisos.join("<br>")}` : "");
  }
  document.getElementById("textoCargaMasiva").value = "";
}

function renderVistaClientes() {
  const cont = document.getElementById("vista-contenido");
  const lista = clientesFiltrados();

  cont.innerHTML = `
    <div class="page-header" style="flex-direction:column; align-items:stretch; gap:10px;">
      <div>
        <h1 class="page-title">🪵 Distribuidora Chaque</h1>
        <div class="muted page-sub">Sistema de pedidos</div>
      </div>
      <div class="tipo-tabs">
        <button class="tipo-tab" onclick="abrirFormCliente(null)">+ Nuevo</button>
        <button class="tipo-tab" onclick="abrirPedidoWeb()">🌐 Pedido web</button>
        <button id="btnGuardarAhora" class="tipo-tab" onclick="guardarAhora()">☁️ Guardar</button>
        <button class="tipo-tab" onclick="forzarRecargaDrive()" title="Recargar desde Google Drive">🔄 Recargar</button>
      </div>
    </div>

    <div class="tipo-tabs" style="margin-bottom:4px;">
      ${(() => {
        const cantPotenciales = clients.filter(c => !c.eliminado && c.potencial).length;
        return cantPotenciales > 0
          ? `<button class="tipo-tab" style="border-left:3px solid #16a34a;" onclick="setVista('potenciales')">🌱 Potenciales (${cantPotenciales})</button>`
          : "";
      })()}
      <button class="tipo-tab" style="border-left:3px solid #7c3aed;" onclick="setVista('mapa-rutas')">🗺️ Mapa</button>
      ${contarClientesInactivos() > 0
        ? `<button class="tipo-tab" style="border-left:3px solid #dc2626;" onclick="setVista('inactivos')">⏰ Inactivos (${contarClientesInactivos()})</button>`
        : ""}
    </div>

    <div class="search-box">
      <input id="inputBusquedaCliente" type="text" placeholder="🔍 Buscar por nombre, dirección o teléfono" value="${busquedaCliente}" oninput="buscarClientes(this.value)" />
      ${busquedaCliente ? `<button class="search-clear" onclick="buscarClientes('')">✕</button>` : ""}
    </div>

    <div class="tipo-tabs">
      ${["Todas", ...TIPOS_CLIENTE].map(t => `
        <button class="tipo-tab ${(t === "Todas" && tiposSeleccionados.size === 0) || tiposSeleccionados.has(t) ? "active" : ""}" onclick="toggleFiltroTipo('${t}')">${t}</button>
      `).join("")}
    </div>

    <div class="tipo-tabs">
      ${["Todos", ...DIAS_VISITA, "Sin asignar"].map(d => `
        <button class="tipo-tab ${filtroDiaCliente === d ? "active" : ""}" onclick="setFiltroDia('${d}')">${d}</button>
      `).join("")}
    </div>

    ${(() => {
      const zonasUsadas = [...new Set(clients.filter(c => !c.eliminado).map(c => c.zona).filter(Boolean))].sort();
      if (zonasUsadas.length === 0) return "";
      return `
      <div class="tipo-tabs">
        ${["Todas", ...zonasUsadas, "Sin zona"].map(z => `
          <button class="tipo-tab ${filtroZonaCliente === z ? "active" : ""}" onclick="setFiltroZona('${z}')">${z}</button>
        `).join("")}
      </div>`;
    })()}

    <div class="client-list">
      ${lista.length === 0
        ? `<div class="empty-state">No hay clientes en esta categoría.<br>Tocá <strong>+ Nuevo</strong> para agregar uno.</div>`
        : lista.map(c => {
            const pedidosCliente = orders.filter(o => o.client.id === c.id && !o.eliminado).length;
            const montoDeuda = deudaTotalCliente(c.id);
            const dias = diasSinComprar(c.id);
const sinComprar = cuentaInactividad(c) && dias !== null && dias >= umbralInactividad(c);

            // Seguimiento para potenciales
            let badgeSeguimiento = "";
            if (c.potencial && c.seguimiento) {
              const hoy = new Date(); hoy.setHours(0,0,0,0);
              const fechaSeg = new Date(c.seguimiento + "T00:00:00");
              const diffSeg = Math.floor((fechaSeg - hoy) / (1000 * 60 * 60 * 24));
              if (diffSeg <= 0) badgeSeguimiento = `<span class="badge-seguimiento vencido">🔔 Visitar hoy</span>`;
              else if (diffSeg <= 3) badgeSeguimiento = `<span class="badge-seguimiento proximo">🔔 En ${diffSeg}d</span>`;
            }

            return `
              <div class="client-item" onclick="abrirModalCliente('${c.id}')">
                <div class="client-tipo-dot tipo-${(c.tipo || 'Otro').toLowerCase().replace('é','e').replace('ú','u')}"></div>
                <div class="client-info">
                  <div class="client-name">
                    ${c.potencial ? '🌱 ' : ''}${c.nombre}
                    ${montoDeuda > 0 ? ` <span class="badge-deuda">💰 ${formatCurrency(montoDeuda)}</span>` : ''}
                   ${sinComprar && !c.potencial ? ` <span class="badge-sin-comprar">⏰ ${dias}d</span>` : ''}
                    ${badgeSeguimiento}
                  </div>
                  <div class="client-sub">${c.tipo || "Otro"}${c.zona ? " · 📍 " + c.zona : ""}${c.horario ? " · 🕐 " + c.horario : ""}${c.telefono ? " · " + c.telefono : ""}${pedidosCliente > 0 ? " · " + pedidosCliente + " pedido" + (pedidosCliente > 1 ? "s" : "") : ""}${c.potencial ? " · Potencial" : ""}</div>
                </div>
                ${c.telefono ? `<button class="btn-recordatorio" onclick="event.stopPropagation(); abrirWhatsAppCliente('${c.id}')" title="Escribirle por WhatsApp">💬</button>` : ''}
                <span class="client-arrow">›</span>
              </div>
            `;
          }).join("")}
    </div>
  `;
}

// ── Vista: CLIENTES INACTIVOS ─────────────────────────────────────────────────
let filtroDiaInactivos = "Todos";

function cambiarFiltroDiaInactivos(d) {
  filtroDiaInactivos = d;
  renderVistaInactivos();
}

function renderVistaInactivos() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  const inactivosTodos = clients
    .filter(c => !c.eliminado && cuentaInactividad(c))
    .map(c => ({ ...c, dias: diasSinComprar(c.id) }))
    .filter(c => c.dias !== null && c.dias >= umbralInactividad(c))
    .sort((a, b) => b.dias - a.dias);

  const inactivos = inactivosTodos.filter(c => {
    if (filtroDiaInactivos === "Todos") return true;
    if (filtroDiaInactivos === "Sin asignar") return !c.diaVisita;
    return c.diaVisita === filtroDiaInactivos;
  });

  cont.innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="setVista('clientes')">← Volver</button>
      <h2 class="page-title2">⏰ Clientes inactivos</h2>
    </div>

    <div class="tipo-tabs">
      ${["Todos", ...DIAS_VISITA, "Sin asignar"].map(d => `
        <button class="tipo-tab ${filtroDiaInactivos === d ? "active" : ""}" onclick="cambiarFiltroDiaInactivos('${d}')">${d}</button>
      `).join("")}
    </div>

    ${inactivos.length === 0
      ? `<div class="empty-state">${filtroDiaInactivos === "Todos"
          ? "🎉 No tenés clientes que hayan pasado su frecuencia de visita sin comprarte."
          : "🎉 No hay clientes inactivos con visita de " + filtroDiaInactivos.toLowerCase() + "."}</div>`
      : `
        <p class="muted" style="margin:0 0 10px;">${inactivos.length} cliente${inactivos.length > 1 ? "s" : ""}${filtroDiaInactivos !== "Todos" ? " (" + filtroDiaInactivos + ")" : ""} pasaron su frecuencia de visita (7 o 14 días) sin comprarte, ordenados de más a menos tiempo.</p>
        ${inactivos.map(c => `
          <div class="client-item" onclick="abrirModalCliente('${c.id}')">
            <div class="client-tipo-dot tipo-${(c.tipo || 'Otro').toLowerCase().replace('é','e').replace('ú','u')}"></div>
            <div class="client-info">
              <div class="client-name">
                ${c.nombre}
                <span class="badge-sin-comprar">⏰ ${c.dias}d</span>
              </div>
              <div class="client-sub">${c.tipo || "Otro"}${c.diaVisita ? " · 📆 " + c.diaVisita : ""}${c.horario ? " · 🕐 " + c.horario : ""}${c.telefono ? " · " + c.telefono : ""}</div>
            </div>
            ${c.telefono ? `<button class="btn-recordatorio" onclick="event.stopPropagation(); abrirWhatsAppCliente('${c.id}')" title="Escribirle por WhatsApp">💬</button>` : ''}
            <span class="client-arrow">›</span>
          </div>
        `).join("")}
      `
    }
  `;
}

// ── Vista: CLIENTES POTENCIALES ─────────────────────────────────────────────
function renderVistaPotenciales() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  const potenciales = clients
    .filter(c => !c.eliminado && c.potencial)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  cont.innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="setVista('clientes')">← Volver</button>
      <h2 class="page-title2">🌱 Clientes potenciales</h2>
    </div>

    ${potenciales.length === 0
      ? `<div class="empty-state">No tenés clientes potenciales cargados por ahora.</div>`
      : `
        <p class="muted" style="margin:0 0 10px;">${potenciales.length} cliente${potenciales.length > 1 ? "s" : ""} potencial${potenciales.length > 1 ? "es" : ""}, todos juntos acá para que no se te pierdan entre el resto. En cuanto le cargues el primer pedido, pasa a ser cliente normal automáticamente.</p>
        ${potenciales.map(c => `
          <div class="client-item" onclick="abrirModalCliente('${c.id}')">
            <div class="client-tipo-dot tipo-${(c.tipo || 'Otro').toLowerCase().replace('é','e').replace('ú','u')}"></div>
            <div class="client-info">
              <div class="client-name">${c.nombre}</div>
              <div class="client-sub">${c.tipo || "Otro"}${c.diaVisita ? " · 📆 " + c.diaVisita : " · sin día asignado"}${c.horario ? " · 🕐 " + c.horario : ""}${c.telefono ? " · " + c.telefono : ""}</div>
              ${c.seguimiento ? `<div class="muted" style="font-size:12px; margin-top:2px;">📝 ${c.seguimiento}</div>` : ""}
            </div>
            ${c.telefono ? `<button class="btn-recordatorio" onclick="event.stopPropagation(); abrirWhatsAppCliente('${c.id}')" title="Escribirle por WhatsApp">💬</button>` : ''}
            <span class="client-arrow">›</span>
          </div>
        `).join("")}
      `
    }
  `;
}

// ── Organizar recorridos con un mapa real (Leaflet + OpenStreetMap) ─────────
const DIAS_COLOR = {
  "": "#9ca3af",
  "Lunes": "#3b82f6",
  "Martes": "#10b981",
  "Miércoles": "#f59e0b",
  "Jueves": "#8b5cf6",
  "Viernes": "#ef4444"
};

// Clientes "de ruta" con ubicación cargada: los únicos que tiene sentido
// mostrar en el mapa (a los de tipo "Otro" y los potenciales no los
// visitás en ruta fija).
function clientesConUbicacionParaRuta() {
  return clients.filter(c => !c.eliminado && (c.tipo || "Otro") !== "Otro" && !c.potencial && c.lat != null && c.lng != null && c.lat !== "" && c.lng !== "");
}

// Convierte una dirección escrita a mano en coordenadas GPS, usando el
// servicio gratuito de OpenStreetMap (Nominatim). Le agregamos "Santa Fe,
// Argentina" para que ubique mejor, ya que las direcciones sueltas sin
// ciudad suelen confundir al buscador.
async function geocodificarDireccion(direccion) {
  try {
    // "Santa Fe" es nombre de ciudad Y de provincia a la vez, así que una
    // búsqueda de texto suelto a veces devuelve una calle con el mismo
    // nombre en OTRA ciudad de la provincia (por ejemplo Rosario). Para
    // evitarlo, acotamos la búsqueda a un rectángulo geográfico alrededor
    // de Santa Fe capital y le pedimos que NO devuelva nada fuera de esa zona.
    const viewboxSantaFeCapital = "-60.85,-31.55,-60.55,-31.75"; // izq,arriba,der,abajo
    const query = encodeURIComponent(direccion + ", Santa Fe, Argentina");
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}&viewbox=${viewboxSantaFeCapital}&bounded=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.log("Error geocodificando dirección:", e);
  }
  return null;
}

let geocodificandoDirecciones = false;

// Detecta clientes cuya ubicación quedó FUERA de la zona de Santa Fe
// capital — probablemente geolocalizados mal por la confusión entre la
// ciudad y la provincia (por ejemplo, terminaron en Rosario).
function clientesConUbicacionSospechosa() {
  const [lonMin, latMax, lonMax, latMin] = "-60.85,-31.55,-60.55,-31.75".split(",").map(Number);
  return clients.filter(c =>
    !c.eliminado && (c.tipo || "Otro") !== "Otro" && !c.potencial &&
    !c.ubicacionManual && // el GPS capturado a mano nunca se toca, esté donde esté
    c.lat != null && c.lng != null && c.lat !== "" && c.lng !== "" &&
    (Number(c.lat) < latMin || Number(c.lat) > latMax || Number(c.lng) < lonMin || Number(c.lng) > lonMax)
  );
}

async function corregirUbicacionesSospechosas() {
  if (geocodificandoDirecciones) return;
  const sospechosos = clientesConUbicacionSospechosa();
  if (sospechosos.length === 0) return alert("No encontré clientes con ubicación fuera de Santa Fe capital.");
  if (!confirm(`Encontré ${sospechosos.length} cliente${sospechosos.length > 1 ? "s" : ""} con ubicación fuera de Santa Fe capital (puede que hayan quedado mal ubicados por la confusión ciudad/provincia). ¿Los vuelvo a ubicar?`)) return;

  geocodificandoDirecciones = true;
  let corregidos = 0;
  const noEncontrados = [];

  for (let i = 0; i < sospechosos.length; i++) {
    const c = sospechosos[i];
    const progresoEl = document.getElementById("progresoGeocoding");
    if (progresoEl) progresoEl.textContent = `Corrigiendo ${i + 1} de ${sospechosos.length}: ${c.nombre}...`;

    if (!c.direccion || !c.direccion.trim()) {
      noEncontrados.push(c.nombre + " (sin dirección cargada)");
    } else {
      const coords = await geocodificarDireccion(c.direccion);
      if (coords) {
        c.lat = coords.lat;
        c.lng = coords.lng;
        c.actualizadoEn = Date.now();
        corregidos++;
      } else {
        noEncontrados.push(c.nombre);
      }
    }
    if (i < sospechosos.length - 1) await new Promise(r => setTimeout(r, 1100));
  }

  geocodificandoDirecciones = false;
  guardarStorage();
  alert(`✅ Se corrigieron ${corregidos} de ${sospechosos.length}.${noEncontrados.length > 0 ? `\n\nNo se pudieron corregir solas (revisalas a mano o usá "Usar mi ubicación" estando ahí): ${noEncontrados.join(", ")}` : ""}`);
  renderVistaMapaRutas();
}

async function geocodificarDireccionesFaltantes() {
  if (geocodificandoDirecciones) return;
  const pendientes = clients.filter(c =>
    !c.eliminado && (c.tipo || "Otro") !== "Otro" && !c.potencial &&
    c.direccion && c.direccion.trim() && !(c.lat != null && c.lng != null && c.lat !== "" && c.lng !== "")
  );
  if (pendientes.length === 0) return alert("No tenés direcciones escritas pendientes de ubicar (o ya tienen GPS, o no tienen dirección cargada).");

  geocodificandoDirecciones = true;
  let encontrados = 0;
  const noEncontrados = [];

  for (let i = 0; i < pendientes.length; i++) {
    const c = pendientes[i];
    const progresoEl = document.getElementById("progresoGeocoding");
    if (progresoEl) progresoEl.textContent = `Ubicando ${i + 1} de ${pendientes.length}: ${c.nombre}...`;

    const coords = await geocodificarDireccion(c.direccion);
    if (coords) {
      c.lat = coords.lat;
      c.lng = coords.lng;
      c.actualizadoEn = Date.now();
      encontrados++;
    } else {
      noEncontrados.push(c.nombre);
    }

    // Este servicio gratuito pide como máximo 1 pedido por segundo, por eso
    // esta pausa entre cliente y cliente.
    if (i < pendientes.length - 1) await new Promise(r => setTimeout(r, 1100));
  }

  geocodificandoDirecciones = false;
  guardarStorage();
  alert(`✅ Se ubicaron ${encontrados} de ${pendientes.length} direcciones.${noEncontrados.length > 0 ? `\n\nNo se encontraron (revisalas o cargales el GPS a mano estando ahí): ${noEncontrados.join(", ")}` : ""}`);
  renderVistaMapaRutas();
}

// Carga Leaflet (librería de mapas gratuita, sin necesitar API key) solo la
// primera vez que hace falta.
function cargarLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("No se pudo cargar el mapa"));
    document.head.appendChild(script);
  });
}

let clientesSeleccionadosMapa = new Set();
let mapaRutasInstancia = null;
let mapaRutasMarkers = {};

function inicializarMapaRutas() {
  const contenedor = document.getElementById("mapaRutasContenedor");
  if (!contenedor || !window.L) return;

  if (mapaRutasInstancia) {
    try { mapaRutasInstancia.remove(); } catch (e) { /* ya estaba destruido, no pasa nada */ }
    mapaRutasInstancia = null;
  }
  mapaRutasMarkers = {};

  const routeClients = clientesConUbicacionParaRuta();
  if (routeClients.length === 0) return;

  const lats = routeClients.map(c => Number(c.lat));
  const lngs = routeClients.map(c => Number(c.lng));
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  mapaRutasInstancia = L.map("mapaRutasContenedor").setView([centerLat, centerLng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  }).addTo(mapaRutasInstancia);

  routeClients.forEach(c => {
    const seleccionado = clientesSeleccionadosMapa.has(c.id);
    const color = seleccionado ? '#fbbf24' : (DIAS_COLOR[c.diaVisita || ""] || DIAS_COLOR[""]);
    const marker = L.circleMarker([Number(c.lat), Number(c.lng)], {
      radius: seleccionado ? 11 : 8,
      fillColor: color,
      color: '#1a1a2e',
      weight: seleccionado ? 2 : 1,
      fillOpacity: 0.9
    }).addTo(mapaRutasInstancia);
    marker.bindPopup(`<strong>${c.nombre}</strong><br>${c.direccion || ""}<br>${c.diaVisita ? "Día actual: " + c.diaVisita : "Sin día asignado"}`);
    marker.on("click", () => toggleClienteMapa(c.id));
    mapaRutasMarkers[c.id] = marker;
  });

  const bounds = L.latLngBounds(routeClients.map(c => [Number(c.lat), Number(c.lng)]));
  mapaRutasInstancia.fitBounds(bounds, { padding: [30, 30] });
}

function toggleClienteMapa(clienteId) {
  if (clientesSeleccionadosMapa.has(clienteId)) clientesSeleccionadosMapa.delete(clienteId);
  else clientesSeleccionadosMapa.add(clienteId);
  actualizarMarcadorMapa(clienteId);
  actualizarPanelSeleccionMapa();
}

function actualizarMarcadorMapa(clienteId) {
  const marker = mapaRutasMarkers[clienteId];
  const c = clients.find(x => x.id === clienteId);
  if (!marker || !c) return;
  const seleccionado = clientesSeleccionadosMapa.has(clienteId);
  const color = seleccionado ? '#fbbf24' : (DIAS_COLOR[c.diaVisita || ""] || DIAS_COLOR[""]);
  marker.setStyle({ fillColor: color, radius: seleccionado ? 11 : 8, weight: seleccionado ? 2 : 1 });
}

function renderPanelSeleccionMapaHTML() {
  const seleccionados = [...clientesSeleccionadosMapa].map(id => clients.find(c => c.id === id)).filter(Boolean);
  return `
    <h3 class="section-title">🟡 Seleccionados: ${seleccionados.length}</h3>
    ${seleccionados.length === 0
      ? `<p class="muted">Tocá los puntitos del mapa para ir armando el grupo del día.</p>`
      : `
        <p class="muted" style="margin:0 0 8px;">${seleccionados.map(c => c.nombre).join(", ")}</p>
        <div class="row-2">
          <select id="selectDiaMapa">
            <option value="">Elegí un día</option>
            ${DIAS_VISITA.map(d => `<option value="${d}">${d}</option>`).join("")}
          </select>
          <button class="btn-success" onclick="aplicarDiaSeleccionMapa()">✅ Aplicar día</button>
        </div>
        <button class="btn-sm btn-outline" style="margin-top:8px;" onclick="limpiarSeleccionMapa()">✕ Limpiar selección</button>
      `
    }
  `;
}

function actualizarPanelSeleccionMapa() {
  const panel = document.getElementById("panelSeleccionMapa");
  if (panel) panel.innerHTML = renderPanelSeleccionMapaHTML();
}

function limpiarSeleccionMapa() {
  const idsPrevios = [...clientesSeleccionadosMapa];
  clientesSeleccionadosMapa = new Set();
  idsPrevios.forEach(id => actualizarMarcadorMapa(id));
  actualizarPanelSeleccionMapa();
}

function aplicarDiaSeleccionMapa() {
  const dia = document.getElementById("selectDiaMapa")?.value;
  if (!dia) return alert("Elegí un día para este grupo.");
  if (clientesSeleccionadosMapa.size === 0) return alert("Todavía no tildaste ningún cliente en el mapa.");

  const idsPrevios = [...clientesSeleccionadosMapa];
  idsPrevios.forEach(id => {
    const c = clients.find(x => x.id === id);
    if (c) { c.diaVisita = dia; c.actualizadoEn = Date.now(); }
  });
  guardarStorage();

  clientesSeleccionadosMapa = new Set();
  idsPrevios.forEach(id => actualizarMarcadorMapa(id));
  actualizarPanelSeleccionMapa();
  alert(`✅ Listo, se asignó "${dia}" a ${idsPrevios.length} cliente${idsPrevios.length > 1 ? "s" : ""}.`);
}

function renderVistaMapaRutas() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  clientesSeleccionadosMapa = new Set();
  const routeClients = clientesConUbicacionParaRuta();
  const sinUbicacion = clients.filter(c => !c.eliminado && (c.tipo || "Otro") !== "Otro" && !c.potencial && !(c.lat != null && c.lng != null && c.lat !== "" && c.lng !== ""));
  const sospechosos = clientesConUbicacionSospechosa();

  cont.innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="setVista('clientes')">← Volver</button>
      <h2 class="page-title2">🗺️ Mapa de recorridos</h2>
    </div>

    <div class="form-card">
      <p class="muted" style="margin:0 0 8px;">Tocá los puntos del mapa para ir armando un grupo — se ponen 🟡 dorados. Elegí el día abajo y aplicalo. Los puntos que ya tienen día asignado se ven con su color.</p>

      ${sospechosos.length > 0 ? `
      <div style="background:#fee2e2; border-radius:10px; padding:10px; margin-bottom:10px;">
        <p class="muted" style="margin:0 0 8px; color:#991b1b;">🚨 ${sospechosos.length} cliente${sospechosos.length > 1 ? "s" : ""} con ubicación fuera de Santa Fe capital (puede que hayan quedado mal ubicados, por ejemplo en Rosario, por una calle con el mismo nombre): ${sospechosos.map(c => c.nombre).join(", ")}</p>
        <button class="btn-primary btn-full" onclick="corregirUbicacionesSospechosas()">🔧 Corregir estas ubicaciones</button>
      </div>` : ""}

      ${sinUbicacion.length > 0 ? `
      <div style="background:#fef3c7; border-radius:10px; padding:10px; margin-bottom:10px;">
        <p class="muted" style="margin:0 0 8px; color:#92400e;">⚠️ ${sinUbicacion.length} cliente${sinUbicacion.length > 1 ? "s" : ""} sin ubicación GPS, no aparecen en el mapa. Si les cargaste la dirección escrita a mano, puedo intentar ubicarlos:</p>
        <button class="btn-primary btn-full" onclick="geocodificarDireccionesFaltantes()">📮 Ubicar direcciones cargadas a mano</button>
        <p id="progresoGeocoding" class="muted" style="margin-top:6px;"></p>
      </div>` : ""}

      <div style="display:flex; gap:10px; flex-wrap:wrap; font-size:12px; margin-bottom:8px;">
        ${DIAS_VISITA.map(d => `<span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; border-radius:50%; background:${DIAS_COLOR[d]}; display:inline-block;"></span>${d}</span>`).join("")}
        <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; border-radius:50%; background:${DIAS_COLOR[""]}; display:inline-block;"></span>Sin día</span>
        <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; border-radius:50%; background:#fbbf24; display:inline-block;"></span>Seleccionado</span>
      </div>

      <div id="mapaRutasContenedor" style="width:100%; height:360px; border-radius:12px; overflow:hidden; background:#f1f5f9; display:flex; align-items:center; justify-content:center;">
        ${routeClients.length === 0 ? `<span class="muted">Todavía no tenés clientes con ubicación cargada.</span>` : `<span class="muted">Cargando mapa...</span>`}
      </div>
    </div>

    <div class="form-card" id="panelSeleccionMapa">
      ${renderPanelSeleccionMapaHTML()}
    </div>
  `;

  if (routeClients.length > 0) {
    cargarLeaflet().then(() => {
      inicializarMapaRutas();
    }).catch(() => {
      const el = document.getElementById("mapaRutasContenedor");
      if (el) el.innerHTML = `<span class="muted">No se pudo cargar el mapa. Revisá tu conexión e intentá de nuevo.</span>`;
    });
  }
}

// ── Vista: FORMULARIO CLIENTE ─────────────────────────────────────────────────
function renderVistaFormCliente() {
  const cont = document.getElementById("vista-contenido");
  const c    = editandoClienteId ? clients.find(x => x.id === editandoClienteId) : null;

  cont.innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="setVista('clientes')">← Volver</button>
      <h2 class="page-title2">${c ? "Editar cliente" : "Nuevo cliente"}</h2>
    </div>

    <div class="form-card">
      <div class="form-group">
        <label>Nombre *</label>
        <input id="formClienteNombre" placeholder="Ej: Farmacia del Sol" value="${c ? c.nombre : ""}" />
      </div>
      <div class="form-group">
        <label>Tipo de cliente</label>
        <select id="formClienteTipo">
          <option value="">-- Elegí un tipo --</option>
          ${TIPOS_CLIENTE.map(t => `<option value="${t}" ${c && c.tipo === t ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Zona</label>
        <input id="formClienteZona" list="listaZonas" placeholder="Ej: Centro, Guadalupe..." value="${c ? c.zona || "" : ""}" />
        <datalist id="listaZonas">
          ${[...new Set(clients.map(x => x.zona).filter(Boolean))].sort().map(z => `<option value="${z}"></option>`).join("")}
        </datalist>
      </div>
      <div class="form-group">
        <label>Día de visita</label>
        <select id="formClienteDia">
          <option value="" ${!c || !c.diaVisita ? "selected" : ""}>Sin asignar</option>
          ${DIAS_VISITA.map(d => `<option value="${d}" ${c && c.diaVisita === d ? "selected" : ""}>${d}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Horario de visita</label>
        <select id="formClienteHorario">
          <option value="" ${!c || !c.horario ? "selected" : ""}>Sin asignar</option>
          ${HORARIOS_CLIENTE.map(h => `<option value="${h}" ${c && c.horario === h ? "selected" : ""}>${h}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Frecuencia de visita</label>
        <select id="formClienteFrecuencia">
          <option value="7" ${!c || (Number(c.frecuencia) !== 14 && Number(c.frecuencia) !== 21 && !sinFrecuencia(c)) ? "selected" : ""}>Semanal (cada 7 días)</option>
          <option value="14" ${c && Number(c.frecuencia) === 14 ? "selected" : ""}>Quincenal (cada 14 días)</option>
          <option value="21" ${c && Number(c.frecuencia) === 21 ? "selected" : ""}>Cada 21 días</option>
          <option value="0" ${sinFrecuencia(c) ? "selected" : ""}>Sin frecuencia (no avisar días sin comprar)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Teléfono</label>
        <input id="formClienteTelefono" placeholder="Ej: 3415001234" value="${c ? c.telefono || "" : ""}" />
      </div>
      <div class="form-group">
        <label>Teléfono 2 (opcional)</label>
        <input id="formClienteTelefono2" placeholder="Ej: 3415005678" value="${c ? c.telefono2 || "" : ""}" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input id="formClienteEmail" placeholder="correo@ejemplo.com" value="${c ? c.email || "" : ""}" />
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <div class="input-row">
          <input id="formClienteDireccion" placeholder="Calle y número" value="${c ? c.direccion || "" : ""}" />
          <button type="button" id="btnUbicacion" class="btn-ubicacion" onclick="usarMiUbicacion()">📡 Mi ubicación</button>
        </div>
        <input type="hidden" id="formClienteLat" value="${c && c.lat ? c.lat : ""}" />
        <input type="hidden" id="formClienteLng" value="${c && c.lng ? c.lng : ""}" />
        <input type="hidden" id="formClienteUbicacionManual" value="${c && c.ubicacionManual ? "1" : ""}" />
      </div>

      <div class="form-group potencial-box">
        <label class="switch-label">
          <input type="checkbox" id="formClientePotencial" onchange="togglePotencial()" ${c && c.potencial ? "checked" : ""} />
          <span>🌱 Cliente potencial (todavía no compró)</span>
        </label>
      </div>

      <div id="formSeguimientoBox" class="form-group" style="display:${c && c.potencial ? 'block' : 'none'}">
        <label>📅 Fecha de seguimiento</label>
        <input type="date" id="formClienteSeguimiento" value="${c && c.seguimiento ? c.seguimiento : ''}" />
      </div>

      <button class="btn-primary btn-full" onclick="guardarCliente()">
        ${c ? "💾 Guardar cambios" : "✅ Agregar cliente"}
      </button>
    </div>
  `;

  // Fuerza el estado correcto del checkbox (algunos navegadores retienen el
  // "checked" del formulario anterior al reescribir el innerHTML).
  const chkPotencial = document.getElementById("formClientePotencial");
  if (chkPotencial) chkPotencial.checked = !!(c && c.potencial);
  const boxSeg = document.getElementById("formSeguimientoBox");
  if (boxSeg) boxSeg.style.display = (c && c.potencial) ? "block" : "none";
}

// ── Vista: PEDIDO ─────────────────────────────────────────────────────────────
function renderVistaPedido() {
  const cont   = document.getElementById("vista-contenido");
  const client = clients.find(c => c.id === clienteActivoId);
  const cats   = obtenerCategorias();

  cont.innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="cancelarEdicionPedido()">← Volver</button>
      <h2 class="page-title2">${editingOrderId ? "Editar pedido" : "Nuevo pedido"}</h2>
    </div>

    ${client
      ? `<div class="client-banner"><span class="banner-nombre">${client.nombre}</span><span class="badge-tipo">${client.tipo || "Otro"}</span></div>`
      : `<div class="alert-warning">⚠️ Seleccioná un cliente primero desde Clientes.</div>`
    }

    <div class="form-card">
      <h3 class="section-title">Agregar producto</h3>

      <form onsubmit="event.preventDefault(); agregarItem();">
      <div class="form-group">
        <label>Código</label>
        <input id="codigoProducto" type="number" placeholder="Ej: 100" inputmode="numeric" autocomplete="off"
               oninput="buscarPorCodigo()"
               onkeydown="if(event.key==='Enter'){ event.preventDefault(); confirmarCodigoConEnter(); }" />
        <div id="infoCodigoProducto" style="margin-top:6px;"></div>
      </div>

      <details style="margin-bottom:14px;">
        <summary class="muted" style="cursor:pointer; font-size:13px;">¿No sabés el código? Buscar por nombre</summary>

      <div class="form-group">
        <label>Marca / categoría</label>
        <select id="filtroCategoria" onchange="cambiarFiltroCategoria()">
          ${cats.map(cat => `<option value="${cat}" ${filtroCategoria === cat ? "selected" : ""}>${cat}</option>`).join("")}
        </select>
      </div>

      <div class="form-group">
        <label>Producto</label>
        <select id="productoSelect" onchange="autocompletarProducto()"></select>
        <div id="infoPrecioProducto" class="price-hints"></div>
      </div>
      </details>

      <div class="row-2">
        <div class="form-group">
          <label>Cantidad</label>
          <input id="cantidad" type="number" min="0" placeholder="Cant." inputmode="numeric" enterkeyhint="done" />
        </div>
        <div class="form-group">
          <label>Precio sin IVA</label>
          <input id="precioVenta" oninput="aplicarDescuento()" />
        </div>
      </div>

      <div id="descuentoBoxContainer" class="descuento-box" style="display:${filtroCategoria === "Vita" ? "block" : "none"};">
        <label>🏷️ Descuento Vita (%)</label>
        <div class="row-2" style="margin-top:6px;">
          <input id="descuentoPct" type="number" min="0" max="100" placeholder="Ej: 10" oninput="aplicarDescuento()" />
          <div id="precioConDescuento" class="precio-descuento-resultado"></div>
        </div>
      </div>

      <button type="submit" class="btn-primary btn-full">+ Agregar al pedido</button>
      </form>

      <div class="borrador-switch">
        <label class="switch-label">
          <input type="checkbox" id="switchBorrador" onchange="toggleModoBorrador()" ${modoBorrador ? 'checked' : ''} />
          <span>📋 Ignorar stock (modo borrador)</span>
        </label>
        <div id="avisoBorrador" class="aviso-borrador" style="display:${modoBorrador ? 'block' : 'none'}">
          ${editingOrderId && orders.find(o => o.id === editingOrderId && !o.borrador)
            ? "⚠️ Al guardar, este pedido pasa a borrador: se devuelve el stock y te queda en Pedidos pendientes para Confirmar entrega."
            : "⚠️ No va a descontar stock. Usá este modo para anotar pedidos futuros."}
        </div>
      </div>
    </div>

    <div class="form-card">
      <div class="table-header-row">
        <h3 class="section-title" style="margin:0;">Items del pedido</h3>
        <select id="modoPrecio" onchange="renderPedido()" class="select-sm">
          <option value="sin">Sin IVA</option>
          <option value="con">Con IVA</option>
          <option value="ambos">Ambos</option>
        </select>
      </div>

      <table>
        <thead>
          <tr><th>Producto</th><th>Cant.</th><th>Precio</th><th></th></tr>
        </thead>
        <tbody id="pedidoBody"></tbody>
      </table>

      <div class="totals-row">
        <div class="total-box"><div class="muted">Sin IVA</div><strong id="totalSinIva">$ 0</strong></div>
        <div class="total-box"><div class="muted">Con IVA</div><strong id="totalConIva">$ 0</strong></div>
        <div class="total-box"><div class="muted">Unidades</div><strong id="totalCantidad">0</strong></div>
      </div>
    </div>

    <div class="form-card">
      <div class="form-group">
        <label>Fecha del pedido</label>
        <input type="date" id="fechaPedido" value="${fechaHoyLocal()}" />
      </div>
      <div class="form-group">
        <label>Notas del pedido</label>
        <textarea id="notasPedido" placeholder="Forma de pago, entrega, observaciones..."></textarea>
      </div>
      <div class="actions-col">
        ${editingOrderId
          ? (orders.find(o => o.id === editingOrderId)?.borrador
              ? `<button class="btn-success btn-full" onclick="guardarYEntregarPedido()">🚚 Confirmar entrega</button>
                 <button class="btn-outline btn-full" onclick="guardarCambiosPedido()">💾 Guardar sin entregar</button>`
              : `<button class="btn-success btn-full" onclick="guardarCambiosPedido()">💾 Guardar cambios</button>`)
          : `<button class="btn-success btn-full" onclick="guardarPedido()">💾 Guardar pedido</button>
             <div style="margin-top:10px;padding:10px 0 4px">
               <span class="muted" style="font-size:0.85rem;display:block;margin-bottom:6px">Medio de pago para "Vender y cobrar":</span>
               <div style="display:flex;gap:6px">
                 <button type="button" class="medio-pago-tab active" id="medioEfectivoVC" onclick="elegirMedioVC('Efectivo')">💵 Efectivo</button>
                 <button type="button" class="medio-pago-tab" id="medioTransferenciaVC" onclick="elegirMedioVC('Transferencia')">🏦 Transferencia</button>
               </div>
               <input type="hidden" id="medioVC" value="Efectivo" />
             </div>
             <button class="btn-whatsapp btn-full" onclick="venderYCobrar()">💵 Vender y cobrar (1 mensaje)</button>`
        }
        <button class="btn-whatsapp btn-full" onclick="enviarWhatsAppPedidoActual()">📱 Enviar por WhatsApp</button>
        <button class="btn-pdf btn-full" onclick="generarPDFPedidoActual()">📄 Descargar PDF</button>
        ${editingOrderId ? `<button class="btn-danger btn-full" style="margin-top:14px;" onclick="eliminarPedidoEnEdicion()">🗑️ Eliminar pedido</button>` : ""}
      </div>
    </div>
  `;

  renderSelectProductos();
  renderPedido();
}

// ── Vista: HISTORIAL ──────────────────────────────────────────────────────────
// ── Volver a la ficha del cliente activo (en vez de perderse en la lista) ────
function volverAlCliente() {
  setVista("clientes");
  if (clienteActivoId) abrirModalCliente(clienteActivoId);
}

function renderOrderCard(order) {
  const saldo = calcularSaldo(order);
  const totalPagado = (order.pagos || []).reduce((a, p) => a + p.monto, 0);
  const formAbierto = ordenConFormPago === order.id;
  return `
  <div id="order-card-${order.id}" class="order-card ${order.pagado ? 'order-pagada' : 'order-pendiente'}"${order.id === pedidoRecienEntregadoId ? ' style="box-shadow:0 0 0 3px #059669;"' : ""}>
    <div class="order-top">
      <div>
        <div class="order-cliente">${order.client.nombre}</div>
        <div class="muted order-fecha">${order.fecha}</div>
      </div>
      <div style="text-align:right;">
        <div class="order-total-label">${formatCurrency(order.totals.totalSinIVA)}</div>
        <div class="muted" style="font-size:11px;">total s/IVA</div>
        ${order.borrador
          ? `<span class="badge-estado badge-borrador">📋 Borrador</span>`
          : `<span class="badge-estado ${order.pagado ? 'badge-pagado' : 'badge-pendiente'}">${order.pagado ? '✅ Pagado' : '🔴 Pendiente'}</span>`
        }
      </div>
    </div>

    ${!order.pagado ? `
      <div class="saldo-row">
        ${totalPagado > 0 ? `<span class="saldo-pagado">Pagado: ${formatCurrency(totalPagado)}</span>` : ''}
        <span class="saldo-debe">Saldo: ${formatCurrency(saldo)}</span>
      </div>` : ''}

    ${(order.pagos || []).length > 0 ? `
      <div class="pagos-lista">
        ${order.pagos.map(p => `
          <div class="pago-item">${p.medio === "Transferencia" ? "🏦" : "💵"} ${formatCurrency(p.monto)} <span class="muted">· ${p.medio || "Efectivo"} · ${p.fecha}</span></div>
        `).join('')}
      </div>` : ''}

    <div class="order-items">
      ${order.items.map(i => `<span class="order-item-tag">${i.cantidad}× ${i.nombre}</span>`).join("")}
    </div>
    ${order.notas ? `<div class="order-nota">📝 ${order.notas}</div>` : ""}

    ${formAbierto ? `
      <div class="form-pago">
        <div class="row-2" style="margin-bottom:8px;">
          <input id="inputMontoPago-${order.id}" type="text" inputmode="decimal" placeholder="Monto recibido" />
          <button class="btn-ubicacion" onclick="completarPagoTotal('${order.id}')">💯 Total (${formatCurrency(calcularSaldo(order))})</button>
        </div>
        <div class="medio-pago-tabs" style="margin-bottom:8px;">
          <button type="button" class="medio-pago-tab active" id="medioEfectivo-${order.id}" onclick="elegirMedioPago('${order.id}', 'Efectivo')">💵 Efectivo</button>
          <button type="button" class="medio-pago-tab" id="medioTransferencia-${order.id}" onclick="elegirMedioPago('${order.id}', 'Transferencia')">🏦 Transferencia</button>
          <input type="hidden" id="medioPago-${order.id}" value="Efectivo" />
        </div>
        <div class="row-2">
          <button class="btn-success" onclick="confirmarPago('${order.id}')">✅ Confirmar pago</button>
          <button class="btn-gray" onclick="abrirFormPago('${order.id}')">Cancelar</button>
        </div>
      </div>` : ''}

    <div class="order-actions">
      ${order.borrador ? `
        <button class="btn-sm btn-confirmar" onclick="confirmarEntrega('${order.id}')">🚚 Confirmar entrega</button>
      ` : `
        ${!order.pagado ? `<button class="btn-sm btn-pago" onclick="abrirFormPago('${order.id}')">💵 Registrar pago</button>` : ''}
        ${order.pagado || (order.pagos || []).length > 0 ? `<button class="btn-sm btn-pago-deshacer" onclick="resetearPagos('${order.id}')">↩ Resetear</button>` : ''}
        ${(order.pagos || []).length > 0 ? `<button class="btn-sm btn-outline" onclick="enviarConfirmacionPago('${order.id}')">💬 Avisar pago</button>` : ''}
      `}
      ${botonFacturadoPedido(order)}
      <button class="btn-sm btn-outline" onclick="editarPedido('${order.id}')">✏️ Editar</button>
      <button class="btn-sm btn-outline" onclick="enviarWhatsAppPedidoGuardado('${order.id}')">📱 WA</button>
      <button class="btn-sm btn-outline" onclick="generarPDFPedidoGuardado('${order.id}')">📄 PDF</button>
      <button class="btn-sm btn-outline" onclick="imprimirRemito('${order.id}')">🖨️ Remito</button>
      <button class="btn-sm btn-danger" onclick="eliminarPedido('${order.id}')">🗑️</button>
    </div>
  </div>`;
}

const NOMBRES_MES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function ordenarPorFechaDesc(a, b) {
  return ordenarPorFechaAsc(b, a);
}

// Arma el historial de un cliente agrupado por año y mes, plegado como
// acordeón — así no hay que scrollear kilómetros para llegar a lo viejo,
// y de paso queda armado para comparar un mismo mes entre años distintos.
function renderHistorialAgrupado(lista) {
  const ordenada = [...lista].sort(ordenarPorFechaDesc);
  const porAnio = {};
  ordenada.forEach(o => {
    const partes = o.fecha.replace(/,.*/, "").split("/");
    const anio = partes[2], mes = parseInt(partes[1]);
    if (!porAnio[anio]) porAnio[anio] = {};
    if (!porAnio[anio][mes]) porAnio[anio][mes] = [];
    porAnio[anio][mes].push(o);
  });

  const anios = Object.keys(porAnio).sort((a, b) => b - a);
  // Si se acaba de entregar un pedido, su año y su mes quedan abiertos.
  const recien = pedidoRecienEntregadoId ? lista.find(o => o.id === pedidoRecienEntregadoId) : null;
  const pRecien = recien ? recien.fecha.replace(/,.*/, "").split("/") : null;
  const anioRecien = pRecien ? pRecien[2] : null, mesRecien = pRecien ? parseInt(pRecien[1]) : null;

  return anios.map((anio, idxAnio) => {
    const meses = Object.keys(porAnio[anio]).map(Number).sort((a, b) => b - a);
    const totalAnio = meses.reduce((acc, m) => acc + porAnio[anio][m].reduce((a, o) => a + o.totals.totalSinIVA, 0), 0);
    const cantAnio = meses.reduce((acc, m) => acc + porAnio[anio][m].length, 0);

    return `
    <details ${idxAnio === 0 || anio === anioRecien ? "open" : ""} style="margin-bottom:10px; background:#fff; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;">
      <summary style="padding:14px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; list-style:none; font-size:16px;">
        <strong>📅 ${anio}</strong>
        <span class="muted" style="font-size:13px;">${cantAnio} pedido${cantAnio > 1 ? "s" : ""} · ${formatCurrency(totalAnio)}</span>
      </summary>
      <div style="padding:0 10px 10px;">
        ${meses.map((mes, idxMes) => {
          const pedidosMes = porAnio[anio][mes];
          const totalMes = pedidosMes.reduce((a, o) => a + o.totals.totalSinIVA, 0);
          return `
          <details ${(idxAnio === 0 && idxMes === 0) || (anio === anioRecien && mes === mesRecien) ? "open" : ""} style="margin-bottom:8px; background:#f8fafc; border-radius:10px; overflow:hidden;">
            <summary style="padding:10px 12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; list-style:none; font-weight:600; font-size:14px;">
              <span>${NOMBRES_MES[mes - 1]}</span>
              <span class="muted" style="font-size:12px; font-weight:400;">${pedidosMes.length} pedido${pedidosMes.length > 1 ? "s" : ""} · ${formatCurrency(totalMes)}</span>
            </summary>
            <div style="padding:0 8px 8px;">
              ${pedidosMes.map(renderOrderCard).join("")}
            </div>
          </details>`;
        }).join("")}
      </div>
    </details>`;
  }).join("");
}

function renderVistaHistorial() {
  const cont   = document.getElementById("vista-contenido");
  if (!cont) return;

  const client = clients.find(c => c.id === clienteActivoId);
  const lista  = (clienteActivoId
    ? orders.filter(o => o.client.id === clienteActivoId)
    : orders).filter(o => !o.eliminado);

  cont.innerHTML = `
    <div class="page-header">
      ${client ? `<button class="btn-back" onclick="volverAlCliente()">← Volver</button>` : ""}
      <h2 class="page-title2">${client ? "Pedidos de " + client.nombre : "Todos los pedidos"}</h2>
    </div>

    ${pedidoRecienEntregadoId && lista.some(o => o.id === pedidoRecienEntregadoId) ? `
    <div style="background:#dcfce7; border:1px solid #86efac; border-radius:12px; padding:12px 14px; margin-bottom:12px;">
      <strong style="color:#065f46;">✅ Pedido entregado</strong>
      <div style="font-size:14px; color:#065f46; margin-top:2px;">Elegí qué querés hacer en el pedido marcado en verde: cobrar, WhatsApp, PDF o remito.</div>
      <button class="btn-sm btn-outline" style="margin-top:8px;" onclick="setVista('resumen')">← Volver a pendientes</button>
    </div>` : ""}

    ${lista.length === 0
      ? `<div class="empty-state">No hay pedidos ${client ? "para este cliente" : "guardados"} aún.</div>`
      : (client ? renderHistorialAgrupado(lista) : lista.map(renderOrderCard).join(""))
    }
  `;
}

// ── Vista: DEUDORES ───────────────────────────────────────────────────────────
// ── Pago del total adeudado por un cliente (reparte el monto entre sus
// pedidos pendientes, del más viejo al más nuevo) ──────────────────────────
function toggleFormPagoDeuda(id) {
  const form = document.getElementById("form-pagodeuda-" + id);
  if (!form) return;
  const abrir = form.style.display === "none";
  form.style.display = abrir ? "block" : "none";
  if (abrir) {
    const input = document.getElementById("inputMontoPagoDeuda-" + id);
    if (input) input.value = montoParaInput(deudaTotalCliente(id));
  }
}

function elegirMedioPagoDeuda(id, medio) {
  document.getElementById("medioPagoDeuda-" + id).value = medio;
  document.getElementById("medioEfectivoDeuda-" + id).classList.toggle("active", medio === "Efectivo");
  document.getElementById("medioTransferenciaDeuda-" + id).classList.toggle("active", medio === "Transferencia");
}

// Lista de pedidos pendientes de entregar, respetando el orden que Joel
// armó a mano (con las flechitas). Los que todavía no tienen un orden
// asignado (recién tomados) van al final, ordenados por fecha.
function pedidosBorradorOrdenados() {
  return orders
    .filter(o => o.borrador && !o.eliminado)
    .sort((a, b) => {
      const oa = a.ordenEntrega, ob = b.ordenEntrega;
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return ordenarPorFechaAsc(a, b);
    });
}

function moverPedidoBorrador(orderId, direccion) {
  const lista = pedidosBorradorOrdenados();
  // La primera vez que se mueve algo, les asignamos a todos un número de
  // orden fijo según como estaban, para poder intercambiarlos entre sí.
  lista.forEach((o, i) => { if (o.ordenEntrega == null) o.ordenEntrega = i; });

  const idx = lista.findIndex(o => o.id === orderId);
  const idxVecino = idx + direccion;
  if (idx < 0 || idxVecino < 0 || idxVecino >= lista.length) return;

  const a = lista[idx], b = lista[idxVecino];
  const tmp = a.ordenEntrega;
  a.ordenEntrega = b.ordenEntrega;
  b.ordenEntrega = tmp;
  a.actualizadoEn = Date.now();
  b.actualizadoEn = Date.now();

  guardarStorage();
  renderVistaResumen();
}

function ordenarPorFechaAsc(a, b) {
  const pa = a.fecha.replace(/,.*/, '').split('/');
  const pb = b.fecha.replace(/,.*/, '').split('/');
  const fa = new Date(parseInt(pa[2]), parseInt(pa[1]) - 1, parseInt(pa[0]));
  const fb = new Date(parseInt(pb[2]), parseInt(pb[1]) - 1, parseInt(pb[0]));
  return fa - fb;
}

function confirmarPagoTotalCliente(clienteId) {
  const client = clients.find(c => c.id === clienteId);
  if (!client) return;

  const deudaAntes = deudaTotalCliente(clienteId);
  if (deudaAntes <= 0) return alert("Este cliente no tiene deuda pendiente.");

  const montoInput = document.getElementById("inputMontoPagoDeuda-" + clienteId);
  const monto = parseNumber(montoInput.value);
  if (!monto || monto <= 0) return alert("Ingresá un monto válido");
  if (monto > deudaAntes) return alert(`El monto supera la deuda total. Deuda actual: ${formatCurrency(deudaAntes)}`);

  const medioInput = document.getElementById("medioPagoDeuda-" + clienteId);
  const medio = medioInput ? medioInput.value : "Efectivo";

  // Repartimos el pago entre los pedidos pendientes, empezando por el más
  // viejo, hasta que se termine el monto que cargaste.
  const ordenesPendientes = orders
    .filter(o => o.client.id === clienteId && !o.eliminado && !o.pagado)
    .sort(ordenarPorFechaAsc);

  let restante = monto;
  ordenesPendientes.forEach(o => {
    if (restante <= 0) return;
    const saldo = calcularSaldo(o);
    if (saldo <= 0) return;
    const aPagar = Math.min(restante, saldo);
    if (!o.pagos) o.pagos = [];
    o.pagos.push({ id: generarId(), fecha: new Date().toLocaleString("es-AR"), monto: aPagar, medio });
    if (calcularSaldo(o) <= 0) o.pagado = true;
    o.actualizadoEn = Date.now();
    restante -= aPagar;
  });

  const deudaDespues = deudaTotalCliente(clienteId);
  if (deudaDespues <= 0 && client.recordatorioPago) {
    client.recordatorioPago = "";
    client.actualizadoEn = Date.now();
  }

  // Preguntamos y, si dice que sí, abrimos WhatsApp en el MISMO toque —
  // antes de guardar y de redibujar la pantalla. Si primero redibujábamos,
  // el celular perdía el "toque" del usuario y abría la versión web de
  // WhatsApp (y después la app, con los emojis rotos). Abriéndolo directo,
  // el celu abre la app de una y los emojis salen bien, igual que el resto
  // de los botones de WhatsApp.
  const avisar = confirm(deudaDespues <= 0
    ? `✅ Pago de ${formatCurrency(monto)} registrado. La cuenta de ${client.nombre} quedó al día.\n\n¿Le avisamos por WhatsApp?`
    : `✅ Pago de ${formatCurrency(monto)} registrado. Todavía le queda un saldo de ${formatCurrency(deudaDespues)}.\n\n¿Le avisamos por WhatsApp?`);
  if (avisar) enviarAvisoPagoRegistrado(clienteId, monto, medio, deudaDespues);

  guardarStorage();
  renderVistaDeudores();
}

function enviarAvisoPagoRegistrado(clienteId, monto, medio, deudaRestante) {
  const client = clients.find(c => c.id === clienteId);
  if (!client) return;
  const msg = deudaRestante <= 0
    ? `Hola ${client.nombre} 👋\n\nRegistramos tu pago de *${formatCurrency(monto)}* (${medio}). ¡Tu cuenta quedó al día! Gracias 🙌`
    : `Hola ${client.nombre} 👋\n\nRegistramos tu pago de *${formatCurrency(monto)}* (${medio}). Tu saldo pendiente ahora es *${formatCurrency(deudaRestante)}*. ¡Gracias! 🙌`;
  const tel = client.telefono ? client.telefono.replace(/\D/g, "") : "";
  const url = tel ? `https://wa.me/54${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  if (!tel) alert("Este cliente no tiene teléfono cargado — vas a tener que elegir el contacto a mano en WhatsApp.");
  window.open(url, "_blank");
}

// ── Buscador de Deudores ──
// Filtra la lista sin volver a dibujar la pantalla, así no se pierde el foco
// del teclado ni se cierran los formularios de pago que tengas abiertos.
let busquedaDeudores = "";

function normalizarTextoBusqueda(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function filtrarDeudores(valor) {
  busquedaDeudores = valor;
  const q = normalizarTextoBusqueda(valor).trim();
  const items = document.querySelectorAll("#listaDeudores .deudor-item");
  let visibles = 0;
  items.forEach(el => {
    const coincide = !q || (el.dataset.busqueda || "").includes(q);
    el.style.display = coincide ? "" : "none";
    if (coincide) visibles++;
  });
  const info = document.getElementById("infoBusquedaDeudores");
  if (info) info.textContent = q ? (visibles === 0 ? "Ningún deudor coincide con la búsqueda." : `Mostrando ${visibles} de ${items.length}`) : "";
  const btnX = document.getElementById("btnLimpiarBusquedaDeudores");
  if (btnX) btnX.style.display = q ? "" : "none";
}

function limpiarBusquedaDeudores() {
  const input = document.getElementById("inputBusquedaDeudores");
  if (input) { input.value = ""; input.focus(); }
  filtrarDeudores("");
}

function renderVistaDeudores() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  const deudores = clients
    .filter(c => !c.eliminado)
    .map(c => ({ ...c, deuda: deudaTotalCliente(c.id) }))
    .filter(c => c.deuda > 0)
    .sort((a, b) => b.deuda - a.deuda);

  const totalGeneral = deudores.reduce((a, c) => a + c.deuda, 0);

  cont.innerHTML = `
    <div class="page-header">
      <h2 class="page-title2">💰 Deudores</h2>
      <button class="btn-ubicacion" onclick="copiarAlias()">📋 Copiar alias</button>
    </div>

    ${deudores.length === 0
      ? `<div class="empty-state">🎉 No hay deudas pendientes.</div>`
      : `
        <div class="resumen-total-box">
          <div class="muted">Total pendiente de cobro</div>
          <strong>${formatCurrency(totalGeneral)}</strong>
        </div>
        <div class="search-box">
          <input id="inputBusquedaDeudores" type="text" placeholder="🔍 Buscar deudor por nombre, teléfono o zona" value="${busquedaDeudores.replace(/"/g, "&quot;")}" oninput="filtrarDeudores(this.value)" />
          <button id="btnLimpiarBusquedaDeudores" class="search-clear" onclick="limpiarBusquedaDeudores()" style="${busquedaDeudores ? "" : "display:none;"}">✕</button>
        </div>
        <p id="infoBusquedaDeudores" class="muted" style="margin:2px 0 8px; font-size:13px;"></p>
        <div id="listaDeudores">
        ${deudores.map(c => {
          let badgeRecordatorio = "";
          if (c.recordatorioPago) {
            const hoy = new Date(); hoy.setHours(0,0,0,0);
            const fechaRec = new Date(c.recordatorioPago + "T00:00:00");
            const diffRec = Math.floor((fechaRec - hoy) / (1000 * 60 * 60 * 24));
            if (diffRec <= 0) badgeRecordatorio = `<span class="badge-seguimiento vencido">🔔 Cobrar hoy</span>`;
            else if (diffRec <= 3) badgeRecordatorio = `<span class="badge-seguimiento proximo">🔔 En ${diffRec}d</span>`;
          }
          return `
          <div class="client-item deudor-item" data-busqueda="${normalizarTextoBusqueda([c.nombre, c.telefono, c.telefono2, c.zona, c.direccion, c.tipo].filter(Boolean).join(" ")).replace(/"/g, "")}" onclick="abrirModalCliente('${c.id}')">
            <div class="client-tipo-dot tipo-${(c.tipo||'Otro').toLowerCase().replace('é','e').replace('ú','u')}"></div>
            <div class="client-info">
              <div class="client-name">${c.nombre} ${badgeRecordatorio}</div>
              <div class="client-sub">${c.tipo || 'Otro'}</div>
              <div id="form-recordatorio-${c.id}" style="display:none; margin-top:8px;" onclick="event.stopPropagation()">
                <input type="date" id="input-recordatorio-${c.id}" value="${c.recordatorioPago || ''}" style="margin-bottom:6px; width:100%;" />
                <div class="row-2">
                  <button class="btn-success" onclick="guardarRecordatorioPago('${c.id}')">Guardar</button>
                  <button class="btn-danger" onclick="borrarRecordatorioPago('${c.id}')">🗑️ Borrar</button>
                </div>
              </div>
              <div id="form-pagodeuda-${c.id}" style="display:none; margin-top:8px; background:#f0fdf4; border-radius:10px; padding:10px;" onclick="event.stopPropagation()">
                <div class="muted" style="margin-bottom:6px;">Deuda total: ${formatCurrency(c.deuda)}</div>
                <input type="text" inputmode="decimal" id="inputMontoPagoDeuda-${c.id}" placeholder="Monto pagado" value="${montoParaInput(c.deuda)}" style="margin-bottom:6px;" />
                <input type="hidden" id="medioPagoDeuda-${c.id}" value="Efectivo" />
                <div class="row-2" style="margin-bottom:8px;">
                  <button type="button" id="medioEfectivoDeuda-${c.id}" class="medio-pago-tab active" onclick="elegirMedioPagoDeuda('${c.id}','Efectivo')">💵 Efectivo</button>
                  <button type="button" id="medioTransferenciaDeuda-${c.id}" class="medio-pago-tab" onclick="elegirMedioPagoDeuda('${c.id}','Transferencia')">🏦 Transferencia</button>
                </div>
                <button class="btn-success btn-full" onclick="confirmarPagoTotalCliente('${c.id}')">✅ Confirmar pago y avisarle</button>
              </div>
            </div>
            <strong style="color:#dc2626;">${formatCurrency(c.deuda)}</strong>
            <button class="btn-recordatorio" onclick="event.stopPropagation(); toggleFormPagoDeuda('${c.id}')" title="Registrar el pago de toda la deuda">💵</button>
            <button class="btn-recordatorio" onclick="event.stopPropagation(); toggleFormRecordatorio('${c.id}')" title="Poner fecha para recordar cobrar">📅</button>
            <button class="btn-recordatorio" onclick="event.stopPropagation(); enviarRecordatorioPago('${c.id}')" title="Mandar recordatorio de pago por WhatsApp">💬</button>
          </div>
        `;
        }).join("")}
        </div>
      `
    }
  `;
  // Si había una búsqueda escrita (por ejemplo, después de registrar un pago
  // la pantalla se vuelve a dibujar), la volvemos a aplicar.
  if (busquedaDeudores) filtrarDeudores(busquedaDeudores);
}

// ── Monotributo: control de lo facturado ─────────────────────────────────────
// Cada pedido entregado se puede marcar como "Facturado" (con el número de
// factura, opcional). En el Resumen se ve cuánto se facturó y cuánto quedó
// sin factura, y lo facturado en los últimos 12 meses contra el tope de la
// categoría. Solo cuentan los pedidos desde la fecha de alta en el
// monotributo. La categoría, el tope y la fecha de alta los carga uno mismo
// y viajan a Google junto con la config del vehículo.
let monotributoConfigAbierto = false;
let monotributoAbierto = false; // el cuadro arranca cerrado; se abre tocando el título

function toggleMonotributo() {
  monotributoAbierto = !monotributoAbierto;
  renderVistaResumen();
}

function fechaPedidoComoDate(o) {
  const p = String(o.fecha || "").replace(/,.*/, "").split("/");
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}

function fechaAltaMonotributo() {
  if (!configVehiculo.monoAlta) return null;
  const [y, m, d] = configVehiculo.monoAlta.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Pedidos entregados (no borrador, no eliminados) desde el alta.
function pedidosDesdeAltaMonotributo() {
  const alta = fechaAltaMonotributo();
  if (!alta) return [];
  return orders.filter(o => !o.borrador && !o.eliminado && fechaPedidoComoDate(o) >= alta);
}

function botonFacturadoPedido(order) {
  const alta = fechaAltaMonotributo();
  if (!alta || order.borrador || fechaPedidoComoDate(order) < alta) return "";
  return order.facturado
    ? `<button class="btn-sm" style="background:#059669; color:#fff; border:none;" onclick="toggleFacturado('${order.id}')">🧾 Facturado${order.nroFactura ? " Nº " + order.nroFactura : ""}</button>`
    : `<button class="btn-sm btn-outline" style="border-color:#f59e0b; color:#92400e;" onclick="toggleFacturado('${order.id}')">🧾 Sin factura</button>`;
}

function toggleFacturado(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  if (order.facturado) {
    if (!confirm("¿Le sacás la marca de facturado a este pedido?")) return;
    order.facturado = false;
    order.nroFactura = "";
  } else {
    const nro = prompt("🧾 Número de factura (opcional, podés dejarlo vacío):", "");
    if (nro === null) return; // tocó Cancelar
    order.facturado = true;
    order.nroFactura = nro.trim();
  }
  order.actualizadoEn = Date.now();
  guardarStorage();
  renderVistaHistorial();
}

function toggleMonotributoConfig() {
  monotributoConfigAbierto = !monotributoConfigAbierto;
  renderVistaResumen();
}

function guardarConfigMonotributo() {
  const alta = document.getElementById("monoAlta").value;
  if (!alta) return alert("Cargá la fecha de alta en el monotributo");
  configVehiculo = {
    ...configVehiculo,
    monoCategoria: document.getElementById("monoCategoria").value.trim().toUpperCase(),
    monoTope: parseNumber(document.getElementById("monoTope").value) || 0,
    monoAlta: alta,
    actualizadoEn: Date.now()
  };
  setItemSeguro("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
  fetchConTimeout(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "vehiculo", payload: [configVehiculo] }) });
  kmPorMes = configVehiculo.kmPorMes;
  metaPorMes = configVehiculo.metaPorMes;
  monotributoConfigAbierto = false;
  renderVistaResumen();
}

// Borra la fecha de alta: el control queda apagado (como si nunca se hubiera
// cargado). La categoría y el tope quedan guardados para la próxima vez.
function desactivarMonotributo() {
  if (!confirm("¿Borrás la fecha de alta? El control del monotributo se apaga hasta que cargues una fecha nueva.")) return;
  configVehiculo = { ...configVehiculo, monoAlta: "", actualizadoEn: Date.now() };
  setItemSeguro("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
  fetchConTimeout(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "vehiculo", payload: [configVehiculo] }) });
  kmPorMes = configVehiculo.kmPorMes;
  metaPorMes = configVehiculo.metaPorMes;
  monotributoConfigAbierto = false;
  renderVistaResumen();
}

// Excel con los pedidos facturados de un mes, para mandarle al contador.
// Solo van los facturados (lo sin factura no se incluye).
function exportarExcelContador(mes, anio) {
  const correr = () => generarExcelContador(mes, anio);
  if (window.XLSX) return correr();
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  s.onload = correr;
  s.onerror = () => alert("No se pudo cargar la herramienta de Excel. Revisá la conexión a internet.");
  document.head.appendChild(s);
}

function generarExcelContador(mes, anio) {
  const nombreMes = MESES_ES[mes - 1];
  const facturados = pedidosDesdeAltaMonotributo()
    .filter(o => {
      if (!o.facturado) return false;
      const f = fechaPedidoComoDate(o);
      return f.getMonth() + 1 === mes && f.getFullYear() === anio;
    })
    .sort(ordenarPorFechaAsc);
  if (facturados.length === 0) return alert(`No hay pedidos marcados como facturados en ${nombreMes} ${anio}.`);

  const FORMATO_PESOS = '"$" #,##0.00';
  const filas = [["Fecha", "Nº de factura", "Cliente", "Monto"]];
  facturados.forEach(o => {
    filas.push([String(o.fecha).replace(/,.*/, ""), o.nroFactura || "(sin número)", o.client.nombre, o.totals.totalSinIVA]);
  });
  const ultima = filas.length;
  filas.push(["TOTAL", "", `${facturados.length} factura${facturados.length === 1 ? "" : "s"}`, null]);
  const ws1 = XLSX.utils.aoa_to_sheet(filas);
  ws1["D" + (ultima + 1)] = { t: "n", f: `SUM(D2:D${ultima})`, v: facturados.reduce((a, o) => a + o.totals.totalSinIVA, 0) };
  for (let r = 2; r <= ultima + 1; r++) if (ws1["D" + r]) ws1["D" + r].z = FORMATO_PESOS;
  ws1["!cols"] = [12, 18, 32, 16].map(w => ({ wch: w }));

  // Hoja 2: resumen del mes y de los últimos 12 meses
  const totalMes = facturados.reduce((a, o) => a + o.totals.totalSinIVA, 0);
  const hoy = new Date();
  const hace12 = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate() + 1);
  const fact12 = pedidosDesdeAltaMonotributo()
    .filter(o => o.facturado && fechaPedidoComoDate(o) >= hace12)
    .reduce((a, o) => a + o.totals.totalSinIVA, 0);
  const tope = configVehiculo.monoTope || 0;
  const resumen = [
    ["Distribuidora Chaque — Monotributo"],
    [],
    ["Mes", `${nombreMes} ${anio}`],
    ["Categoría", configVehiculo.monoCategoria || "-"],
    ["Fecha de alta", fechaAltaMonotributo() ? fechaAltaMonotributo().toLocaleDateString("es-AR") : "-"],
    ["Cantidad de facturas del mes", facturados.length],
    ["Total facturado del mes", totalMes],
    ["Facturado en los últimos 12 meses (al " + hoy.toLocaleDateString("es-AR") + ")", fact12],
    ["Tope anual de la categoría", tope || "-"],
    ["Porcentaje del tope usado", tope ? fact12 / tope : "-"]
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(resumen);
  ["B7", "B8", "B9"].forEach(c => { if (ws2[c] && ws2[c].t === "n") ws2[c].z = FORMATO_PESOS; });
  if (ws2.B10 && ws2.B10.t === "n") ws2.B10.z = "0%";
  ws2["!cols"] = [{ wch: 52 }, { wch: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Facturas");
  XLSX.utils.book_append_sheet(wb, ws2, "Resumen");
  XLSX.writeFile(wb, `Facturado_${nombreMes}_${anio}_Distribuidora_Chaque.xlsx`);
}

function renderCardMonotributo(mesSel, anioSel, mesNombre) {
  const alta = fechaAltaMonotributo();
  const tope = configVehiculo.monoTope || 0;
  const cat = configVehiculo.monoCategoria || "";
  const abierto = monotributoConfigAbierto || !alta;
  const estiloInput = "width:100%; box-sizing:border-box; border:1.5px solid #d1d5db; border-radius:8px; padding:8px; font-size:14px; margin-bottom:8px;";
  const titulo = `🧾 Monotributo${cat ? " — Categoría " + cat : ""}`;
  if (!monotributoAbierto) {
    // Cerrado: solo el título y una línea con lo facturado del mes (como Gastos extraordinarios)
    const factMesCerrado = alta ? pedidosDesdeAltaMonotributo()
      .filter(o => { const f = fechaPedidoComoDate(o); return o.facturado && f.getMonth() + 1 === mesSel && f.getFullYear() === anioSel; })
      .reduce((a, o) => a + o.totals.totalSinIVA, 0) : 0;
    return `
    <div class="form-card" style="border-left:4px solid #2563eb;">
      <h3 class="section-title" style="cursor:pointer;" onclick="toggleMonotributo()">${titulo} ▼</h3>
      ${alta
        ? `<div class="stock-row"><strong>Facturado en ${mesNombre}</strong><strong style="color:#059669;">${formatCurrency(factMesCerrado)}</strong></div>`
        : `<p class="muted" style="margin:0; font-size:13px;">Tocá el título para cargar tu fecha de alta, categoría y tope.</p>`}
    </div>`;
  }

  const formConfig = `
    <div style="margin-top:10px; padding-top:10px; border-top:1px solid #e5e7eb;">
      <label class="muted" style="font-size:13px;">Fecha de alta en el monotributo</label>
      <input type="date" id="monoAlta" value="${configVehiculo.monoAlta || ""}" style="${estiloInput}" />
      <label class="muted" style="font-size:13px;">Categoría (ej: A, B, C…)</label>
      <input type="text" id="monoCategoria" value="${cat}" maxlength="2" style="${estiloInput}" />
      <label class="muted" style="font-size:13px;">Tope anual de facturación de tu categoría ($)</label>
      <input type="text" inputmode="decimal" id="monoTope" value="${tope ? montoParaInput(tope).toLocaleString("es-AR") : ""}" placeholder="Ej: 10.000.000" style="${estiloInput}" />
      <button class="btn-primary btn-full" onclick="guardarConfigMonotributo()">💾 Guardar</button>
      ${configVehiculo.monoAlta ? `<button class="btn-gray btn-full" style="margin-top:8px;" onclick="desactivarMonotributo()">🗑️ Borrar fecha de alta (desactivar)</button>` : ""}
    </div>`;

  if (!alta) {
    return `
    <div class="form-card" style="border-left:4px solid #2563eb;">
      <h3 class="section-title" style="cursor:pointer;" onclick="toggleMonotributo()">${titulo} ▲</h3>
      <p class="muted" style="margin:0;">Cargá tu fecha de alta, la categoría y el tope anual. Desde esa fecha vas a poder marcar cada pedido como facturado y ver acá cuánto llevás facturado.</p>
      ${formConfig}
    </div>`;
  }

  const desdeAlta = pedidosDesdeAltaMonotributo();
  const delMes = desdeAlta.filter(o => { const f = fechaPedidoComoDate(o); return f.getMonth() + 1 === mesSel && f.getFullYear() === anioSel; });
  const factMes = delMes.filter(o => o.facturado).reduce((a, o) => a + o.totals.totalSinIVA, 0);
  const totalMes = delMes.reduce((a, o) => a + o.totals.totalSinIVA, 0);

  // Últimos 12 meses hasta hoy (o desde el alta, si es más reciente)
  const hoy = new Date();
  const hace12 = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate() + 1);
  const ult12 = desdeAlta.filter(o => fechaPedidoComoDate(o) >= hace12);
  const fact12 = ult12.filter(o => o.facturado).reduce((a, o) => a + o.totals.totalSinIVA, 0);
  const total12 = ult12.reduce((a, o) => a + o.totals.totalSinIVA, 0);
  const desdeTexto = alta > hace12 ? `desde tu alta (${alta.toLocaleDateString("es-AR")})` : "últimos 12 meses";

  const pct = tope > 0 ? Math.round((fact12 / tope) * 100) : 0;
  const pctTodo = tope > 0 ? Math.round((total12 / tope) * 100) : 0;
  const color = pct >= 100 ? "#dc2626" : pct >= 80 ? "#f59e0b" : "#059669";

  return `
    <div class="form-card" style="border-left:4px solid #2563eb;">
      <h3 class="section-title" style="cursor:pointer;" onclick="toggleMonotributo()">${titulo} ▲</h3>
      <div class="muted" style="margin-bottom:6px;">${mesNombre} ${anioSel}</div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="muted">Facturado</div>
          <strong style="font-size:13px; color:#059669;">${formatCurrency(factMes)}</strong>
        </div>
        <div class="stat-box">
          <div class="muted">Sin factura</div>
          <strong style="font-size:13px; color:#92400e;">${formatCurrency(totalMes - factMes)}</strong>
        </div>
        <div class="stat-box">
          <div class="muted">Total vendido</div>
          <strong style="font-size:13px;">${formatCurrency(totalMes)}</strong>
        </div>
      </div>

      <button class="btn-success btn-full" style="margin-top:10px; color:#fff;" onclick="exportarExcelContador(${mesSel}, ${anioSel})">📥 Excel para el contador (${mesNombre})</button>

      <div style="margin-top:14px;">
        <div class="muted" style="margin-bottom:4px;">📈 Facturado ${desdeTexto}</div>
        ${tope > 0 ? `
          <div style="background:#e5e7eb; border-radius:6px; height:14px; overflow:hidden;">
            <div style="background:${color}; height:100%; width:${Math.min(100, pct)}%;"></div>
          </div>
          <p style="margin:6px 0 0; font-size:14px;"><strong>${formatCurrency(fact12)}</strong> de ${formatCurrency(tope)} (${pct}%)</p>
          ${pct >= 100 ? `<p style="margin:4px 0 0; color:#dc2626; font-size:13px;">🔴 Ya pasaste el tope de tu categoría. Consultalo con tu contador.</p>`
            : pct >= 80 ? `<p style="margin:4px 0 0; color:#92400e; font-size:13px;">🟡 Estás cerca del tope de tu categoría.</p>` : ""}
          <p class="muted" style="margin:8px 0 0; font-size:13px;">Si facturaras todo lo vendido: ${formatCurrency(total12)} (${pctTodo}% del tope)${pctTodo >= 100 && pct < 100 ? " — 🔴 te pasarías del tope" : ""}</p>
        ` : `
          <p style="margin:0; font-size:14px;"><strong>${formatCurrency(fact12)}</strong> facturado · ${formatCurrency(total12)} vendido en total</p>
          <p class="muted" style="margin:4px 0 0; font-size:13px;">Cargá el tope de tu categoría para ver cuánto te falta.</p>
        `}
      </div>

      <p class="muted" style="margin:10px 0 0; font-size:13px; cursor:pointer;" onclick="toggleMonotributoConfig()">⚙️ Cambiar categoría, tope o fecha de alta ${abierto ? "▲" : "▼"}</p>
      ${abierto ? formConfig : ""}
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// VENTA WEB: pedidos que llegan por WhatsApp desde la página web
// ═══════════════════════════════════════════════════════════════
// Se pega el mensaje tal cual llega ("• 3x Producto — $72.000", "Nombre:",
// "Entrega/Notas:") y se arma el pedido con los precios del mensaje. Todos
// van al cliente especial "🌐 Venta web" (id fijo, igual en todos los
// dispositivos) y se cuentan aparte en el Resumen.
const CLIENTE_WEB_ID = "cliente-venta-web";
let textoPedidoWeb = "";
let pedidoWebLeido = null; // { lineas: [{cantidad, nombreWeb, subtotal, productId}], nombre, notas, totalMensaje }
let ventaWebAbierto = false;

function esPedidoWeb(o) {
  return !!o && (o.canal === "web" || (o.client && o.client.id === CLIENTE_WEB_ID));
}

function asegurarClienteWeb() {
  let c = clients.find(x => x.id === CLIENTE_WEB_ID);
  if (!c) {
    c = { id: CLIENTE_WEB_ID, nombre: "🌐 Venta web", tipo: "Otro", telefono: "", email: "", direccion: "", notas: "Pedidos de la página web", actualizadoEn: Date.now() };
    clients.push(c);
  } else if (c.eliminado) {
    c.eliminado = false;
    c.actualizadoEn = Date.now();
  }
  return c;
}

function normalizarNombreWeb(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ").trim();
}

// Lee el mensaje. Devuelve null si no encuentra ningún producto.
function leerMensajePedidoWeb(texto) {
  const lineas = [];
  String(texto || "").split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*[•·\-*]\s*(\d+)\s*[xX×]\s*(.+)\s+[—–-]\s*\$\s*([\d.,]+)\s*$/);
    if (m) lineas.push({ cantidad: parseInt(m[1], 10), nombreWeb: m[2].trim(), subtotal: parseNumber(m[3]) });
  });
  if (lineas.length === 0) return null;
  const nombre = (String(texto).match(/^\s*Nombre:\s*(.*)$/mi) || [])[1] || "";
  const notas = (String(texto).match(/^\s*Entrega\s*\/\s*Notas:\s*(.*)$/mi) || [])[1] || "";
  const total = (String(texto).match(/Total:\s*\$\s*([\d.,]+)/i) || [])[1];
  return { lineas, nombre: nombre.trim(), notas: notas.trim(), totalMensaje: total ? parseNumber(total) : null };
}

// Producto de la lista que corresponde al nombre de la web: solo si coincide
// exacto con el nombre o con un nombre web ya aprendido (aliasWeb).
function productoParaNombreWeb(nombreWeb) {
  const n = normalizarNombreWeb(nombreWeb);
  return catalogActivo().find(p => normalizarNombreWeb(p.nombre) === n || (p.aliasWeb || []).includes(n)) || null;
}

// Sugerencias ordenadas por parecido (palabras en común).
function sugerenciasParaNombreWeb(nombreWeb) {
  const palabras = new Set(normalizarNombreWeb(nombreWeb).split(" ").filter(w => w.length > 2));
  return catalogActivo()
    .map(p => {
      const pp = normalizarNombreWeb(p.nombre + " " + p.categoria).split(" ").filter(w => w.length > 2);
      return { p, puntos: pp.filter(w => palabras.has(w)).length };
    })
    .filter(x => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 3)
    .map(x => x.p);
}

function abrirPedidoWeb() {
  textoPedidoWeb = "";
  pedidoWebLeido = null;
  setVista("pedido-web");
}

function procesarMensajeWeb() {
  const ta = document.getElementById("textoPedidoWeb");
  textoPedidoWeb = ta ? ta.value : textoPedidoWeb;
  const leido = leerMensajePedidoWeb(textoPedidoWeb);
  if (!leido) return alert("No encontré productos en el mensaje. Pegá el mensaje completo, con las líneas que empiezan con •");
  leido.lineas.forEach(l => { const p = productoParaNombreWeb(l.nombreWeb); l.productId = p ? p.id : ""; });
  pedidoWebLeido = leido;
  renderVistaPedidoWeb();
}

function elegirProductoWeb(idx, productId) {
  if (!pedidoWebLeido) return;
  pedidoWebLeido.lineas[idx].productId = productId;
  renderVistaPedidoWeb();
}

function guardarPedidoWeb(entregado) {
  const leido = pedidoWebLeido;
  if (!leido) return;
  const faltan = leido.lineas.filter(l => !l.productId);
  if (faltan.length) return alert("Elegí a qué producto de tu lista corresponde: " + faltan.map(l => l.nombreWeb).join(", "));
  const notasInput = document.getElementById("notasPedidoWeb");
  const notas = notasInput ? notasInput.value.trim() : "";

  // Ítems con los precios del mensaje (sin IVA). Si un producto viene dos
  // veces, se junta en una sola línea.
  const items = [];
  leido.lineas.forEach(l => {
    const prod = catalog.find(p => p.id === l.productId);
    const existente = items.find(i => i.productId === prod.id);
    if (existente) {
      existente.cantidad += l.cantidad;
      existente.subtotalSinIVA += l.subtotal;
      existente.subtotalConIVA = priceWithIVA(existente.subtotalSinIVA);
      existente.precioVentaSinIVA = existente.subtotalSinIVA / existente.cantidad;
      existente.precioVentaConIVA = priceWithIVA(existente.precioVentaSinIVA);
    } else {
      const unit = l.cantidad ? l.subtotal / l.cantidad : 0;
      items.push({
        id: generarId(), productId: prod.id, nombre: prod.nombre, categoria: prod.categoria,
        cantidad: l.cantidad, precioVentaSinIVA: unit, precioVentaConIVA: priceWithIVA(unit),
        subtotalSinIVA: l.subtotal, subtotalConIVA: priceWithIVA(l.subtotal)
      });
    }
  });

  if (entregado) {
    for (const it of items) {
      const prod = catalog.find(p => p.id === it.productId);
      if (prod && prod.stock < it.cantidad && !confirm(`Stock insuficiente para ${it.nombre}. Disponible: ${prod.stock}. ¿Confirmás igual?`)) return;
    }
  }

  // Aprende los nombres de la web para la próxima vez.
  const ahora = Date.now();
  leido.lineas.forEach(l => {
    const prod = catalog.find(p => p.id === l.productId);
    const n = normalizarNombreWeb(l.nombreWeb);
    if (prod && normalizarNombreWeb(prod.nombre) !== n && !(prod.aliasWeb || []).includes(n)) {
      prod.aliasWeb = [...(prod.aliasWeb || []), n];
      prod.actualizadoEn = ahora;
    }
  });

  const cliente = asegurarClienteWeb();
  if (entregado) aplicarStock(items, -1);
  const [y, m, d] = fechaHoyLocal().split("-");
  const pedido = {
    id: generarId(), fecha: `${d}/${m}/${y}`, client: { ...cliente },
    items, notas, modoPrecio: "sin", pagado: false, pagos: [],
    borrador: !entregado, canal: "web", actualizadoEn: ahora,
    totals: {
      totalSinIVA: items.reduce((a, i) => a + i.subtotalSinIVA, 0),
      totalConIVA: items.reduce((a, i) => a + i.subtotalConIVA, 0),
      totalCantidad: items.reduce((a, i) => a + i.cantidad, 0)
    }
  };
  orders.unshift(pedido);
  guardarStorage();
  pedidoWebLeido = null;
  textoPedidoWeb = "";

  if (entregado) {
    pedidoRecienEntregadoId = pedido.id;
    setVista("historial", CLIENTE_WEB_ID);
    setTimeout(() => {
      const card = document.getElementById("order-card-" + pedido.id);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  } else {
    setVista("resumen");
    setTimeout(() => document.getElementById("pedidosBorradorCard")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
}

function renderVistaPedidoWeb() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;
  const leido = pedidoWebLeido;
  const esc = t => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  let detalle = "";
  if (leido) {
    const totalItems = leido.lineas.reduce((a, l) => a + l.subtotal, 0);
    const notasDefecto = [leido.nombre, leido.notas].filter(Boolean).join(" — ");
    detalle = `
    <div class="form-card">
      <h3 class="section-title">Revisá el pedido</h3>
      ${leido.lineas.map((l, idx) => {
        const sugeridos = sugerenciasParaNombreWeb(l.nombreWeb);
        const resto = catalogActivo().filter(p => !sugeridos.includes(p));
        const opcion = p => `<option value="${p.id}" ${p.id === l.productId ? "selected" : ""}>${esc(p.nombre)} · ${esc(p.categoria)}</option>`;
        return `
        <div style="padding:10px 0; border-bottom:1px solid #e5e7eb;">
          <div style="display:flex; justify-content:space-between; gap:8px;">
            <div><strong>${l.cantidad}×</strong> ${esc(l.nombreWeb)}</div>
            <strong>${formatCurrency(l.subtotal)}</strong>
          </div>
          <div class="muted" style="font-size:12px; margin:2px 0 6px;">${formatCurrency(l.cantidad ? l.subtotal / l.cantidad : 0)} c/u (sin IVA)</div>
          <select onchange="elegirProductoWeb(${idx}, this.value)" style="width:100%; ${l.productId ? "" : "border:2px solid #f59e0b;"}">
            <option value="">${l.productId ? "" : "⚠️ "}Elegí a qué producto de tu lista corresponde</option>
            ${sugeridos.length ? `<optgroup label="Parecidos">${sugeridos.map(opcion).join("")}</optgroup><optgroup label="Todos">${resto.map(opcion).join("")}</optgroup>` : resto.map(opcion).join("")}
          </select>
          ${l.productId ? "" : `<div style="font-size:12px; color:#92400e; margin-top:4px;">La primera vez lo elegís vos; después se acuerda solo. Si no está en tu lista, cargalo antes en 📦 Stock → ➕ Nuevo.</div>`}
        </div>`;
      }).join("")}
      <div class="stock-row" style="border-top:2px solid #e5e7eb; margin-top:4px; padding-top:10px;">
        <strong>Total</strong>
        <strong>${formatCurrency(totalItems)}</strong>
      </div>
      ${leido.totalMensaje != null && Math.abs(leido.totalMensaje - totalItems) > 0.5
        ? `<p style="color:#dc2626; font-size:13px; margin:4px 0 0;">⚠️ El mensaje dice Total ${formatCurrency(leido.totalMensaje)}, pero los productos suman ${formatCurrency(totalItems)}. Revisalo.</p>` : ""}
      <div class="form-group" style="margin-top:12px;">
        <label>Notas (comprador y entrega)</label>
        <textarea id="notasPedidoWeb" rows="2">${esc(notasDefecto)}</textarea>
      </div>
      <button class="btn-primary btn-full" onclick="guardarPedidoWeb(false)">📋 Guardar como pendiente de entrega</button>
      <button class="btn-success btn-full" style="margin-top:8px;" onclick="guardarPedidoWeb(true)">✅ Ya lo entregué (descuenta stock)</button>
    </div>`;
  }

  cont.innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="setVista('clientes')">← Volver</button>
      <h2 class="page-title2">🌐 Pedido web</h2>
    </div>
    <div class="form-card">
      <p class="muted" style="margin:0 0 8px;">Copiá el mensaje del pedido de WhatsApp y pegalo acá.</p>
      <textarea id="textoPedidoWeb" rows="7" placeholder="¡Hola Distribuidora Chaque! 👋 Quiero hacer este pedido:&#10;• 3x Producto — $72.000&#10;...">${esc(textoPedidoWeb)}</textarea>
      <button class="btn-primary btn-full" style="margin-top:8px;" onclick="procesarMensajeWeb()">🔍 Leer mensaje</button>
    </div>
    ${detalle}
  `;
}

// Resumen: lo vendido por la web en el mes, comparado con el reparto.
function toggleVentaWeb() { ventaWebAbierto = !ventaWebAbierto; renderVistaResumen(); }

function renderCardVentaWeb(mesSel, anioSel, mesNombre) {
  const delMes = orders.filter(o => {
    if (o.borrador || o.eliminado) return false;
    const p = o.fecha.replace(/,.*/, "").split("/");
    return parseInt(p[1]) === mesSel && parseInt(p[2]) === anioSel;
  });
  const web = delMes.filter(esPedidoWeb);
  const totalWeb = web.reduce((a, o) => a + o.totals.totalSinIVA, 0);
  const totalMes = delMes.reduce((a, o) => a + o.totals.totalSinIVA, 0);
  const pct = totalMes > 0 ? Math.round((totalWeb / totalMes) * 100) : 0;
  const pendientes = orders.filter(o => o.borrador && !o.eliminado && esPedidoWeb(o)).length;

  let detalle = "";
  if (ventaWebAbierto) {
    const porProducto = {};
    web.forEach(o => o.items.forEach(i => {
      const { clave, nombre } = productoVendido(i);
      if (!porProducto[clave]) porProducto[clave] = { nombre, cantidad: 0, total: 0 };
      porProducto[clave].cantidad += i.cantidad;
      porProducto[clave].total += i.subtotalSinIVA;
    }));
    const top = Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
    detalle = `
      <div class="stats-grid" style="margin-top:8px;">
        <div class="stat-box"><div class="muted">Pedidos web</div><strong>${web.length}</strong></div>
        <div class="stat-box"><div class="muted">Reparto</div><strong style="font-size:13px;">${formatCurrency(totalMes - totalWeb)}</strong></div>
        <div class="stat-box"><div class="muted">Web del total</div><strong>${pct}%</strong></div>
      </div>
      ${pendientes ? `<p class="muted" style="margin:8px 0 0; font-size:13px;">📋 ${pendientes} pedido${pendientes === 1 ? "" : "s"} web pendiente${pendientes === 1 ? "" : "s"} de entregar (no cuentan hasta que los confirmes).</p>` : ""}
      ${top.length ? `<div class="muted" style="margin:10px 0 4px;">Lo que más salió por la web:</div>` + top.map(t => `
        <div class="stock-row">
          <div><div class="stock-nombre">${t.nombre}</div><div class="muted">${formatCurrency(t.total)}</div></div>
          <div class="ventas-cant">${t.cantidad} u</div>
        </div>`).join("") : `<p class="muted" style="margin:8px 0 0;">Todavía no hay ventas web entregadas en ${mesNombre}.</p>`}
      <button class="btn-primary btn-full" style="margin-top:10px;" onclick="abrirPedidoWeb()">🌐 Pegar pedido web</button>`;
  }
  return `
    <div class="form-card">
      <h3 class="section-title" style="cursor:pointer;" onclick="toggleVentaWeb()">🌐 Venta web de ${mesNombre} ${ventaWebAbierto ? "▲" : "▼"}</h3>
      <div class="stock-row">
        <strong>Vendido por la web</strong>
        <strong style="color:#2563eb;">${formatCurrency(totalWeb)}</strong>
      </div>
      ${detalle}
    </div>`;
}

// ── Vista: RESUMEN ────────────────────────────────────────────────────────────
let fechaResumen = fechaHoyLocal();
let mesResumen = claveMesActual();

function cambiarFechaResumen() {
  const input = document.getElementById("inputFechaResumen");
  if (input) fechaResumen = input.value;
  renderVistaResumen();
}

let mostrarClientesHoy = false;
function toggleClientesHoy() {
  mostrarClientesHoy = !mostrarClientesHoy;
  renderVistaResumen();
}

function cambiarMesResumen() {
  const input = document.getElementById("inputMesResumen");
  if (input) mesResumen = input.value;
  renderVistaResumen();
}

function renderVistaResumen() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  const [y, m, d] = fechaResumen.split("-");
  const fechaSinCero = `${parseInt(d)}/${parseInt(m)}/${y}`;
  const fechaConCero = `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
  const pedidosHoy = orders.filter(o => !o.borrador && !o.eliminado && (
    o.fecha.startsWith(fechaSinCero) || o.fecha.startsWith(fechaConCero)
  ));
  const fechaMostrar = fechaConCero;
  const totalHoy = pedidosHoy.reduce((a, o) => a + o.totals.totalSinIVA, 0);

  const totalDeuda = clients.filter(c => !c.eliminado).reduce((a, c) => a + deudaTotalCliente(c.id), 0);
  const [anioResumenSel, mesResumenSel] = mesResumen.split("-").map(Number);
  const mesResumenNombre = new Date(anioResumenSel, mesResumenSel - 1, 1).toLocaleString("es-AR", { month: "long" });
  const mesResumenCapital = mesResumenNombre.charAt(0).toUpperCase() + mesResumenNombre.slice(1);
  const pedidosMes = orders.filter(o => {
    if (o.borrador || o.eliminado) return false;
    const partes = o.fecha.replace(/,.*/, '').split('/');
    return parseInt(partes[1]) === mesResumenSel && parseInt(partes[2]) === anioResumenSel;
  });
  const totalVentas = pedidosMes.reduce((a, o) => a + o.totals.totalSinIVA, 0);
  const gananciaHoy = calcularGananciaCobrada((dia, mes, anio) => dia === parseInt(d) && mes === parseInt(m) && anio === parseInt(y));
  const gananciaMes = calcularGananciaCobrada((dia, mes, anio) => mes === mesResumenSel && anio === anioResumenSel);
  const pedidosBorrador = orders.filter(o => o.borrador && !o.eliminado).length;

  // Agrupar productos vendidos hoy
  const productosHoy = {};
  pedidosHoy.forEach(o => {
    o.items.forEach(i => {
      const nombreActual = productoVendido(i).nombre;
      if (!productosHoy[nombreActual]) productosHoy[nombreActual] = { cantidad: 0, subtotal: 0, categoria: i.categoria };
      productosHoy[nombreActual].cantidad += i.cantidad;
      productosHoy[nombreActual].subtotal += i.subtotalSinIVA;
    });
  });
  const productosOrdenados = Object.entries(productosHoy).sort((a, b) => b[1].cantidad - a[1].cantidad);
  const totalUnidadesHoy = productosOrdenados.reduce((a, [, p]) => a + p.cantidad, 0);

  cont.innerHTML = `
    <div class="page-header">
      <h2 class="page-title2">📊 Resumen</h2>
      <input type="date" id="inputFechaResumen" value="${fechaResumen}" onchange="cambiarFechaResumen()" style="border:1.5px solid #d1d5db; border-radius:8px; padding:6px 8px; font-size:13px;" />
    </div>

    <div style="display:flex; align-items:center; gap:8px; margin:-6px 0 12px;">
      <label class="muted" style="font-size:13px;">📅 Mes del resumen (ventas, ganancia, gastos, km):</label>
      <input type="month" id="inputMesResumen" value="${mesResumen}" onchange="cambiarMesResumen()" style="border:1.5px solid #d1d5db; border-radius:8px; padding:6px 8px; font-size:13px;" />
    </div>

    <div class="form-card">
      <h3 class="section-title">Ventas del ${fechaMostrar}</h3>
      <div class="stats-grid">
        <div class="stat-box" onclick="toggleClientesHoy()" style="cursor:pointer;">
          <div class="muted">Pedidos hoy ${mostrarClientesHoy ? "▲" : "▼"}</div>
          <strong>${pedidosHoy.length}</strong>
        </div>
        <div class="stat-box">
          <div class="muted">Vendido hoy</div>
          <strong style="font-size:14px;">${formatCurrency(totalHoy)}</strong>
        </div>
        <div class="stat-box">
          <div class="muted">Ganancia cobrada hoy</div>
          <strong style="font-size:14px; color:#059669;">${formatCurrency(gananciaHoy)}</strong>
        </div>
      </div>
      ${mostrarClientesHoy ? (
        pedidosHoy.length === 0
          ? `<p class="muted" style="margin:10px 0 0;">Todavía no cargaste pedidos hoy.</p>`
          : `<div style="margin-top:10px; border-top:1px solid #e5e7eb; padding-top:8px;">
              ${pedidosHoy.map(o => `
                <div class="client-item" onclick="abrirModalCliente('${o.client.id}')">
                  <div class="client-info">
                    <div class="client-name">${o.client.nombre}</div>
                    <div class="client-sub">${formatCurrency(o.modoPrecio === "con" ? o.totals.totalConIVA : o.totals.totalSinIVA)}</div>
                  </div>
                  <span class="client-arrow">›</span>
                </div>
              `).join("")}
            </div>`
      ) : ""}
    </div>

    ${productosOrdenados.length > 0 ? `
    <div class="form-card">
      <div class="table-header-row">
        <h3 class="section-title" style="margin:0;">📦 Productos vendidos</h3>
        <div style="display:flex;gap:6px;">
          <button class="btn-sm btn-outline" onclick="exportarExcelDia('${fechaMostrar}')">📥 Día</button>
          <button class="btn-sm btn-success" onclick="generarExcelModelo()" style="color:#fff;">📊 Mensual</button>
        </div>
      </div>
      ${productosOrdenados.map(([nombre, p]) => `
        <div class="stock-row">
          <div>
            <div class="stock-nombre">${nombre}</div>
            <div class="muted">${p.categoria} · ${formatCurrency(p.subtotal)}</div>
          </div>
          <div class="ventas-cant">${p.cantidad} u</div>
        </div>
      `).join("")}
      <div class="stock-row" style="border-top:2px solid #e5e7eb; margin-top:4px; padding-top:10px;">
        <strong>Total unidades</strong>
        <strong>${totalUnidadesHoy} u</strong>
      </div>
    </div>` : ""}

    <div class="form-card">
      <h3 class="section-title">General — ${mesResumenCapital} ${anioResumenSel}</h3>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="muted">Ventas de ${mesResumenCapital}</div>
          <strong style="font-size:13px;">${formatCurrency(totalVentas)}</strong>
        </div>
        <div class="stat-box">
          <div class="muted">Ganancia cobrada de ${mesResumenCapital}</div>
          <strong style="font-size:13px; color:#059669;">${formatCurrency(gananciaMes)}</strong>
        </div>
        <div class="stat-box">
          <div class="muted">Total deuda</div>
          <strong style="font-size:13px; color:#dc2626;">${formatCurrency(totalDeuda)}</strong>
        </div>
        <div class="stat-box">
  <div class="muted">Clientes</div>
  <strong>${clients.filter(c => !c.eliminado && (c.tipo || "Otro") !== "Otro").length}</strong>
</div>
        <div class="stat-box" ${pedidosBorrador > 0 ? `onclick="document.getElementById('pedidosBorradorCard')?.scrollIntoView({behavior:'smooth', block:'start'})" style="cursor:pointer;"` : ""}>
          <div class="muted">Borradores ${pedidosBorrador > 0 ? "↓" : ""}</div>
          <strong style="color:#92400e;">${pedidosBorrador}</strong>
        </div>
      </div>

      ${(() => {
        const meta = metaPorMes[mesResumen] || 0;
        const pctReal = meta > 0 ? Math.round((totalVentas / meta) * 100) : 0;
        const pctBarra = Math.min(100, pctReal);
        const superado = pctReal > 100;

        // Semáforo: arranca en rojo y va virando a verde a medida que te
        // acercás a la meta. Si la superás, se pone dorado como festejo.
        let color;
        if (superado) color = '#d4af37';
        else if (pctBarra < 30) color = '#dc2626';
        else if (pctBarra < 60) color = '#f97316';
        else if (pctBarra < 90) color = '#eab308';
        else if (pctBarra < 100) color = '#84cc16';
        else color = '#059669';

        return `
        <div style="margin-top:14px; border-top:1px solid #e5e7eb; padding-top:12px;">
          <div class="row-2">
            <div class="form-group" style="margin:0;">
              <label>🎯 Meta de ventas de ${mesResumenCapital}</label>
              <input id="inputMetaMes" type="text" inputmode="decimal" min="0" placeholder="Ej: 500000" value="${meta || ""}" onchange="guardarMetaMes()" />
            </div>
          </div>
          ${meta > 0 ? `
            <div style="margin-top:10px; background:#e5e7eb; border-radius:10px; overflow:hidden; height:30px; position:relative;">
              <div style="width:${pctBarra}%; background:${color}; height:100%; transition:width 0.3s, background 0.3s;"></div>
              <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; color:${pctBarra > 45 ? '#fff' : '#1a1a2e'};">
                ${pctReal}%
              </div>
            </div>
            <p class="muted" style="margin:6px 0 0;">Llevás ${formatCurrency(totalVentas)} de ${formatCurrency(meta)}${superado ? ` — 🏆 ¡Superaste la meta en ${formatCurrency(totalVentas - meta)}!` : (pctReal >= 100 ? " 🎉 ¡Meta cumplida!" : "")}</p>
          ` : ""}
        </div>`;
      })()}

      ${(() => {
        const serie = calcularVentasUltimosMeses(mesResumenSel, anioResumenSel, 6);
        const maxVal = Math.max(1, ...serie.map(s => s.total));
        return `
        <div style="margin-top:14px; border-top:1px solid #e5e7eb; padding-top:12px;">
          <div class="muted" style="margin-bottom:8px;">📈 Ventas de los últimos 6 meses</div>
          <div style="display:flex; align-items:flex-end; gap:8px; height:110px;">
            ${serie.map(s => {
              const esMesActual = s.mes === mesResumenSel && s.anio === anioResumenSel;
              let color;
              if (s.meta > 0) color = s.total >= s.meta ? '#059669' : '#dc2626';
              else color = esMesActual ? '#3b82f6' : '#93c5fd';
              const borde = esMesActual ? 'border:2px solid #1a1a2e;' : '';
              return `
              <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%;">
                <div style="font-size:10px; color:#6b7280; margin-bottom:2px;">${s.total > 0 ? formatCurrency(s.total).replace("$", "").trim() : ""}</div>
                <div style="width:100%; max-width:34px; background:${color}; ${borde} border-radius:4px 4px 0 0; height:${Math.max(4, Math.round((s.total / maxVal) * 80))}px;"></div>
                <div style="font-size:11px; color:#374151; margin-top:4px;">${s.nombreMes}</div>
              </div>
            `;
            }).join("")}
          </div>
          <p class="muted" style="margin:8px 0 0; font-size:11px;">🟢 Llegó a la meta del mes · 🔴 No llegó · Celeste: sin meta cargada ese mes</p>
        </div>`;
      })()}
    </div>

    ${(() => {
      const topClientesMes = calcularTopClientesDelMes(mesResumenSel, anioResumenSel, 5);
      const topProductosMes = calcularTopProductosDelMes(mesResumenSel, anioResumenSel, 5);
      const medallas = ["🥇", "🥈", "🥉", "4.", "5."];
      if (topClientesMes.length === 0 && topProductosMes.length === 0) return "";
      return `
      <div class="form-card">
        <h3 class="section-title">🏆 Top clientes de ${mesResumenCapital}</h3>
        ${topClientesMes.length === 0 ? `<p class="muted">Todavía no hay ventas en ${mesResumenCapital}.</p>` : topClientesMes.map((c, i) => `
          <div class="stock-row">
            <div>
              <div class="stock-nombre">${medallas[i]} ${c.nombre}</div>
              <div class="muted">${c.pedidos} pedido${c.pedidos > 1 ? "s" : ""}</div>
            </div>
            <strong>${formatCurrency(c.total)}</strong>
          </div>
        `).join("")}
      </div>
      <div class="form-card">
        <h3 class="section-title">📦 Productos más vendidos de ${mesResumenCapital}</h3>
        ${topProductosMes.length === 0 ? `<p class="muted">Todavía no hay ventas en ${mesResumenCapital}.</p>` : topProductosMes.map((p, i) => `
          <div class="stock-row">
            <div>
              <div class="stock-nombre">${medallas[i]} ${p.nombre}</div>
              <div class="muted">${p.cantidad} u vendidas</div>
            </div>
            <strong>${formatCurrency(p.total)}</strong>
          </div>
        `).join("")}
      </div>`;
    })()}

    ${(() => {
      const top = calcularTopClientes(5);
      const medallas = ["🥇", "🥈", "🥉", "4.", "5."];
      if (top.length === 0) return "";
      return `
      <div class="form-card">
        <h3 class="section-title">🏆 Top clientes (histórico)</h3>
        ${top.map((c, i) => `
          <div class="stock-row">
            <div>
              <div class="stock-nombre">${medallas[i]} ${c.nombre}</div>
              <div class="muted">${c.pedidos} pedido${c.pedidos > 1 ? "s" : ""}</div>
            </div>
            <strong>${formatCurrency(c.total)}</strong>
          </div>
        `).join("")}
      </div>`;
    })()}

    ${(() => {
      const bajos = catalogActivo().filter(p => p.stock > 0 && p.stock <= STOCK_BAJO_UMBRAL);
      const agotados = catalogActivo().filter(p => p.stock === 0);
      if (bajos.length === 0 && agotados.length === 0) return "";
      return `
      <div class="form-card">
        <h3 class="section-title" style="cursor:pointer;" onclick="abrirStock()">⚠️ Alerta de stock ›</h3>
        ${agotados.length > 0 ? `<p class="muted" style="margin:4px 0;">⛔ Sin stock: ${agotados.map(p => p.nombre).join(", ")}</p>` : ""}
        ${bajos.length > 0 ? `<p class="muted" style="margin:4px 0;">⚠️ Stock bajo: ${bajos.map(p => p.nombre + " (" + p.stock + ")").join(", ")}</p>` : ""}
      </div>`;
    })()}

    ${pedidosBorrador > 0 ? `
    <div class="form-card" id="pedidosBorradorCard" style="border-left:4px solid #92400e;">
      <h3 class="section-title">📋 Pedidos pendientes de entregar (${pedidosBorrador})</h3>
      <p class="muted" style="margin:0 0 10px;">Acomodalos con las flechitas en el orden que vas a repartir. Tocá el cliente para ver el pedido, armarlo y confirmar la entrega.</p>
      ${pedidosBorradorOrdenados().map((o, i, lista) => `
        <div class="stock-row">
          <div style="display:flex; flex-direction:column; gap:2px; margin-right:6px;">
            <button class="btn-sm btn-outline" style="padding:2px 8px; ${i === 0 ? 'visibility:hidden;' : ''}" onclick="moverPedidoBorrador('${o.id}', -1)">▲</button>
            <button class="btn-sm btn-outline" style="padding:2px 8px; ${i === lista.length - 1 ? 'visibility:hidden;' : ''}" onclick="moverPedidoBorrador('${o.id}', 1)">▼</button>
          </div>
          <div style="cursor:pointer; flex:1;" onclick="editarPedido('${o.id}')">
            <div class="stock-nombre">${i + 1}. ${o.client.nombre}</div>
            <div class="muted">${o.fecha} · ${o.items.length} producto${o.items.length > 1 ? "s" : ""}</div>
          </div>
          <div style="text-align:right; margin-left:auto; cursor:pointer;" onclick="editarPedido('${o.id}')">
            <div style="font-weight:600;">${formatCurrency(o.totals.totalSinIVA)}</div>
            <div class="muted" style="font-size:12px;">Ver / Armar ›</div>
          </div>
        </div>
      `).join("")}
    </div>` : ""}

    ${renderCardMonotributo(mesResumenSel, anioResumenSel, mesResumenCapital)}

    ${renderCardVentaWeb(mesResumenSel, anioResumenSel, mesResumenCapital)}

    ${(() => {
      const gastosMes = inversiones.filter(i => {
        if (i.eliminado) return false;
        if (i.marca !== "Combustible") return false;
        const [yi, mi] = (i.fecha || "").split("-");
        return parseInt(mi) === mesResumenSel && parseInt(yi) === anioResumenSel;
      }).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      const totalNafta = gastosMes.reduce((a, i) => a + i.monto, 0);
      return `
      <div class="form-card">
        <h3 class="section-title" style="cursor:pointer;" onclick="toggleNafta()">⛽ Nafta de ${mesResumenCapital} ${naftaAbierto ? "▲" : "▼"}</h3>
        <div class="stock-row">
          <strong>Gastado en nafta</strong>
          <strong style="color:#dc2626;">${formatCurrency(totalNafta)}</strong>
        </div>
        ${naftaAbierto ? `

        <div class="row-2" style="margin-top:14px;">
          <div class="form-group">
            <label>Monto en nafta</label>
            <input id="vehiculoMonto" type="text" inputmode="decimal" min="0" placeholder="Ej: 15000" />
          </div>
          <div class="form-group">
            <label>Litros cargados</label>
            <input id="vehiculoLitros" type="number" min="0" step="0.01" placeholder="Ej: 10" />
          </div>
        </div>
        <div class="form-group">
          <label>Fecha</label>
          <input id="vehiculoFecha" type="date" value="${fechaHoyLocal()}" />
        </div>
        <button class="btn-primary btn-full" onclick="registrarGastoVehiculo()">+ Registrar</button>

        ${gastosMes.length > 0 ? gastosMes.map(i => `
          <div class="stock-row">
            <div>
              <div class="stock-nombre">${formatCurrency(i.monto)}${i.litros ? " · " + i.litros + " L" : ""}</div>
              <div class="muted">${i.fecha}${i.litros ? " · " + formatCurrency(i.monto / i.litros) + " x litro" : ""}</div>
            </div>
            <button class="btn-sm btn-outline" onclick="eliminarInversion('${i.id}'); setVista('resumen')">🗑️</button>
          </div>
        `).join("") : `<div class="muted" style="margin-top:8px;">Todavía no registraste gastos en ${mesResumenCapital}.</div>`}
        ` : ""}
      </div>

      <div class="form-card">
        <h3 class="section-title" style="cursor:pointer;" onclick="toggleKm()">🛣️ Km recorridos en ${mesResumenCapital} ${kmAbierto ? "▲" : "▼"}</h3>
        <div class="stock-row">
          <strong>Km del mes</strong>
          <strong>${kmPorMes[mesResumen] ? Number(kmPorMes[mesResumen]).toLocaleString("es-AR") + " km" : '<span style="color:#d97706;">Sin cargar</span>'}</strong>
        </div>
        ${kmAbierto ? `
        <div class="form-group" style="margin-top:10px;">
          <label>Km del mes</label>
          <input id="inputKmMes" type="number" min="0" value="${kmPorMes[mesResumen] || ""}" placeholder="Ej: 1200" />
        </div>
        <button class="btn-primary btn-full" onclick="guardarKmMes()">💾 Guardar km del mes</button>
        ` : ""}
      </div>`;
    })()}

    ${(() => {
      const mesN = mesResumenSel, anioN = anioResumenSel;
      const gastosExtraMes = inversiones.filter(i => {
        if (i.eliminado || i.marca !== "Imprevistos") return false;
        const [yi, mi] = (i.fecha || "").split("-");
        return parseInt(mi) === mesN && parseInt(yi) === anioN;
      }).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      const totalExtra = gastosExtraMes.reduce((a, i) => a + i.monto, 0);
      return `
      <div class="form-card">
        <h3 class="section-title" style="cursor:pointer;" onclick="toggleGastosExtra()">🔧 Gastos extraordinarios de ${mesResumenCapital} ${gastosExtraAbierto ? "▲" : "▼"}</h3>
        <div class="stock-row">
          <strong>Total del mes</strong>
          <strong style="color:#dc2626;">${formatCurrency(totalExtra)}</strong>
        </div>

        ${gastosExtraAbierto ? `
          <p class="muted" style="margin:8px 0;">Taller, gomería, imprevistos — vuelve a $0 solo cada mes nuevo.</p>
          <div class="row-2">
            <div class="form-group">
              <label>Monto</label>
              <input id="extraMonto" type="text" inputmode="decimal" min="0" placeholder="Ej: 25000" />
            </div>
            <div class="form-group">
              <label>Fecha</label>
              <input id="extraFecha" type="date" value="${fechaHoyLocal()}" />
            </div>
          </div>
          <div class="form-group">
            <label>¿Qué fue?</label>
            <input id="extraNota" placeholder="Ej: Gomería, cambio de pastillas" />
          </div>
          <button class="btn-primary btn-full" onclick="registrarGastoExtra()">+ Registrar</button>

          ${gastosExtraMes.length > 0 ? gastosExtraMes.map(i => `
            <div class="stock-row">
              <div>
                <div class="stock-nombre">${formatCurrency(i.monto)}${i.nota ? " · " + i.nota : ""}</div>
                <div class="muted">${i.fecha}</div>
              </div>
              <button class="btn-sm btn-outline" onclick="eliminarInversion('${i.id}'); setVista('resumen')">🗑️</button>
            </div>
          `).join("") : `<div class="muted" style="margin-top:8px;">Sin gastos extraordinarios en ${mesResumenCapital}.</div>`}
        ` : ""}
      </div>`;
    })()}

    ${(() => {
      const gastosMesCV = inversiones.filter(i => {
        if (i.eliminado || i.marca !== "Combustible") return false;
        const [yi, mi] = (i.fecha || "").split("-");
        return parseInt(mi) === mesResumenSel && parseInt(yi) === anioResumenSel;
      });
      const kmDelMes = kmPorMes[mesResumen] || 0;
      const naftaDelMes = gastosMesCV.reduce((a, i) => a + i.monto, 0);
      const gastosExtra = calcularGastosExtraMes(mesResumenSel, anioResumenSel);
      const cv = configVehiculo;
      const res = calcularCostosVehiculo(kmDelMes, naftaDelMes, gastosExtra);
      return `
      <div class="form-card">
        <h3 class="section-title" style="cursor:pointer;" onclick="toggleCostosVehiculo()">📊 Costos del vehículo y operación — ${mesResumenCapital} ${costosVehiculoAbierto ? "▲" : "▼"}</h3>
        ${costosVehiculoAbierto ? `
          <div class="stock-row">
            <strong>Costo por km (nafta + cubiertas + service)</strong>
            <strong>${formatCurrency(res.costoPorKm)}</strong>
          </div>
          <div class="stock-row">
            <strong>Gastos fijos del mes</strong>
            <strong>${formatCurrency(res.gastosFijosMes)}</strong>
          </div>
          <div class="stock-row">
            <strong>Gastos extraordinarios</strong>
            <strong>${formatCurrency(res.gastosExtraMes)}</strong>
          </div>
          <div class="stock-row" style="border-top:2px solid #e5e7eb; padding-top:10px; margin-top:6px;">
            <strong>Costo total estimado del mes</strong>
            <strong style="color:#dc2626;">${formatCurrency(res.costoTotalMes)}</strong>
          </div>

          <h4 style="margin-top:16px; margin-bottom:8px;">Editar valores</h4>
          <div class="row-2">
            <div class="form-group"><label>Seguro mensual</label><input id="cfgSeguro" type="text" inputmode="decimal" value="${cv.seguro}" /></div>
            <div class="form-group"><label>Celular mensual</label><input id="cfgCelular" type="text" inputmode="decimal" value="${cv.celular}" /></div>
          </div>
        <div class="row-2">
  <div class="form-group"><label>Monotributo mensual</label><input id="cfgMonotributo" type="text" inputmode="decimal" value="${cv.monotributo || 0}" /></div>
  <div></div>
</div>
          <div class="row-2">
            <div class="form-group"><label>Costo del service</label><input id="cfgServicioCosto" type="text" inputmode="decimal" value="${cv.servicioCosto}" /></div>
            <div class="form-group"><label>Cada cuántos km</label><input id="cfgServicioKm" type="number" value="${cv.servicioKm}" /></div>
          </div>
          <div class="row-2">
            <div class="form-group"><label>Costo cubiertas</label><input id="cfgCubiertasCosto" type="text" inputmode="decimal" value="${cv.cubiertasCosto}" /></div>
            <div class="form-group"><label>Duran cuántos km</label><input id="cfgCubiertasKm" type="number" value="${cv.cubiertasKm}" /></div>
          </div>
          <div class="row-2">
            <div class="form-group"><label>Costo batería</label><input id="cfgBateriaCosto" type="text" inputmode="decimal" value="${cv.bateriaCosto}" /></div>
            <div class="form-group"><label>Duración (años)</label><input id="cfgBateriaAnios" type="number" value="${cv.bateriaAnios}" /></div>
          </div>
          <button class="btn-primary btn-full" onclick="guardarConfigVehiculo()">💾 Guardar valores</button>
        ` : `<div class="muted">Tocá para ver el detalle y editar los valores (seguro, service, cubiertas, batería).</div>`}
      </div>

      <div class="form-card">
        <h3 class="section-title">💰 Ganancia neta de ${mesResumenCapital}</h3>
        <p class="muted" style="margin:0 0 10px;">Lo mismo que te muestra el Excel de cierre de mes, pero acá en pantalla, sin tener que bajarlo.</p>
        <div class="stock-row">
          <div>Ganancia cobrada</div>
          <strong>${formatCurrency(gananciaMes)}</strong>
        </div>
        <div class="stock-row">
          <div>− Costo del vehículo y operación</div>
          <strong style="color:#dc2626;">${formatCurrency(res.costoTotalMes)}</strong>
        </div>
        <div class="stock-row" style="border-top:2px solid #e5e7eb; padding-top:10px; margin-top:6px;">
          <strong>GANANCIA NETA ESTIMADA</strong>
          <strong style="color:${(gananciaMes - res.costoTotalMes) >= 0 ? '#059669' : '#dc2626'}; font-size:16px;">
            ${formatCurrency(gananciaMes - res.costoTotalMes)}
          </strong>
        </div>
        ${kmDelMes === 0 ? `<p class="muted" style="margin-top:8px;">⚠️ Todavía no cargaste los km de ${mesResumenCapital}, así que el costo del vehículo puede estar incompleto (falta la parte de nafta y desgaste por km).</p>` : ""}
      </div>

      <div class="form-card">
        <h3 class="section-title">📊 Cierre de mes — ${mesResumenCapital}</h3>
        <p class="muted" style="margin-bottom:10px;">Un Excel con todo junto: ventas, ganancia cobrada, gastos del vehículo, inversión por marca, y la ganancia neta real de ${mesResumenCapital}.</p>
        <button class="btn-primary btn-full" onclick="exportarCierreMes()">📥 Exportar cierre de mes</button>
      </div>`;
    })()}
  `;
}
// ── Vista: STOCK ──────────────────────────────────────────────────────────────
// ── Vista: LISTA DE PRECIOS ───────────────────────────────────────────────────
const BLISTER_12 = ["Almendra", "Chocolate", "Proteína"];

// Logo de Distribuidora Chaque, ya procesado en blanco y negro puro y
// redimensionado a 384px de ancho (el ancho estándar de una térmica de 58mm),
// listo para mandarlo a RawBT antes del texto del remito.
const LOGO_TICKET_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAYAAAAF/AQAAAABoeCPeAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAU5ElEQVR4nL2cz48mx1nHP11vZ94OmUx3ggQj5Ozbkg+RUA4TLhhY9u0kF9/gyCmMxD+wASF8WPzW2otsAZL9B1jK3DhzgwN2rdeKc8KLkBAnXLM2yqBgucaekJ51Tz8cqqp/vT2zM0rgOcy83VXffn7UU089VV3VyCxpSOZLmLvZAsDm2gDtAbM85gCWQMvrARo6Wl8LYHrA4jqABmAlUs+z2AYYCDdnWWwB2v65zZxptwAO8rnfkRQTepPExd+55rNp+ZRDA6v+qt5Wewpw4/bVWzJNAZMabss/JoDWy9h0bbAl0wTgWEpoM6+Mnco0ARjWnXfDRqSZtt0EACJivOCaRbxzKaBhKdJERTVrETs08xbAshYxnT+wCM+4FKARaXo1a9YiE8OOAC0LETuooJdDhtuAhpXI2DUCm0sAjo3UY9dYSTtuiRHAJCJmVOwWInpxKYClyFjiFhHLZYCGldSThjWriRLDDtRwyMlz4+7ywgk72OGdAdgmU4m8THrYdEOAWUqzFSbMWuziEgC5uHwKcLm4YaWBDhcc8PjutM/vnbFLNatDjUjXam4Vf+lx4w8ANpGmU683vl2PtB4AzLJ/btvHvDofaT3Qwezz+ND/fKjgH7X/vXPGfjunQ8u6U0F3UUNEtDSD1ukBDdJGWbugISJiNzJwjh5QJ1KvIhb6OFyvROddtV6Hkx1ODqNTDWnnhMN6RgeTiwk/HTAYEhfiFjMcTMH3ws9szOefyAZm6o20afJ5Dm7d9mbqAA2dzmGg7hStVwMzdSI1SafzRen/Vb3W2m6J5JadztEkHYuF2HyLg8t4xJTOPa+3KXq7RqRe+XZ2f9JxWIr1ittNH606AOtmJSJikg7AvTA41OumqxdFEkxTAhh52jdNUDx9vEBPRGoSsZ4TbEyvhbf0UvR6wqFRHAOcA+Z5zZjuUXV27a36amzkjbB8s1NcRORhb9cIsHmbi/iusxby4cAo4jZuOQGYlTeSlzv5YZdmrb2ZupgbdTClN5IGHO6QcqhDatPIMgJ0VVex+LTa6+taAOWUjJVuEzmWqANr6TM/L/trojcjkVrFE6JIXsbw/xyA21TxhsfVS1mKxKzhzjoEjtvRTFbsamQlF6zapSW+f653wxPdJsb1IJIr2gKg8zsPsJ8tTwHITFaPrGS9VeWxv/yY1/1zErsX7dqMAMZb9WlnWq98zX6o5lRsiKDKxg5UgJf9g5I6doNly1DpFnkoMsjrn/u+/38YrC+vxuEyiJTwLiBlBHDL/zuK1v9+10IiItIsZCnDicC9TrhgfidmPeDQpJIxDMI/7Vra+X+ZLu3ASnXWFgxagbeW6BSAwt9ITeEGAFc0Zf80AN7nrxmSDS3nAbaMzr0TxXoxOQDgo9LXc6HlgpUqpwELX14YgLQ+CFq0nwCQ1KGm/2dIwoOLbtT/RmjaMz9a3CNch+Z7FHx77W9/TS7eihr5KPkotLECkIT3gBYwPu6tXmq/HdX1vfAWWnccmoXkwZPEwWGxqP/s80edzZbDlvM6pFIAKVA5+LdvsXztQdkBGoBMl73SDW0JLCzUFl6soHXY2wHQAqQmZHK+g9Yb8ZEityRybyntNz9PYsMvRETale+kKhgTIFj0Ft87ITm52BmM5hAHY0RE7NqJiDRkJJbPRT4V+cCtxnbNfTKlACy+q1OgSj6p7M+B7LCzKwAveeUVgKmeeN0PkYTSuj2o0Z2ZCoDbvld7Hbwr17sP7qkdcPvpCb8BH70SADXAraTXIZHXRETcWtrdPXZ+/fP2D+TUyaNlACxFRI5FRx0EH4ZODcm7v0lykiUG4L3f3vGABiAPsUdE2kW7EhH5XMTPDc/lDTk9lbzNTW+memM2gUOb+uFj9yIrccjvL6jA3S8A7sCpBUgpTVC6Ca4ufOGwsPhu8gJKdJkUZfbQJHtfB8D7hgLImgrgqW5rvgXVIY0feuzip5SKXQBli2glt3I+9sBS2n2EvYV8DnIh7/9ELJ/60JTXuYwnHAW8TvLx7c/cD97mE9Zgs384LmNAju0uYtfHEnqoiIh8KmLFspHmh/+81l0u91qzDBysH99akt+LnIqKhUYdfWb6R9+miUpXsXne60qtvQ1UD2sNL4V7Kv4x+j0IHiP6CGDXmQpg5wu6AfVW0gYdtLwhIgKsRdYffiEi7RIRae+sHJ0Op5KEASWRPOi8EHnng3PvYyIiL6zd13Sc7jrREdCuAgCRD39yISKiExGRQpwQ5x71RnsriaIEngJo+BUBqBTADzhFw328M1XaK+0zlacl8AAkBShTbxKfUPwWAKY0oKD1dv2qAVo5GOQbpKSnGvigsyoKmqwfqiT5939tjiAElQzzuG85W1hApM4734OV82mKz/G6TG4jIpK7lQgibnUaXQnyeiWvdoBV5J2LiLxR58FbHdFKFH9juQMxGJ4tulW/4AoKXKm6Sw7vQUnI3DgvbkMFqgao0jqobju9DEDemeCECg4IA1qMfLZKo1m+/TsayKIQLRjIoDUApWpiqIyPfHGn41UCDeVj+C8DLwS8B+gQyFn8lQZITXzG4sMz+LUSqQCKxAOMb9oTuJdoABV1qnd5G7IiaCm0oCDxJvT3OhsCuIIDr53zWmpQoCUa6HUSA5y7XpHl0IZaQIH3btHACRYuvhzHKluRasxOaMaUCpSXDH4EZG8dn8AZ50GwSsPRsU1inmPQfdRoAP68PC94DEdU+CxafVwatB/SFCUoWp/XVACp6DMqcGAhSyC5UI/frEIfsRjPQYeB7+7P4OIvOfB+de5j0Df+/s3nfbt4B5Emd8G59zfvS2JYiEnE5GJYisjpqs6l9BOV3K1F0XS5EvJHsnfALi+IVzEDlja9y39422osqksDYJ/D9mCXA3bQJaIpgFQvDPCf+KYDcatjEWlgUYvUG0lEWtZ2WfuO2ebyjkjJRkReq3NB3OojEal9DuJni8LKLl2IX+/Lh2HFUN6vc1FQWrqU9Tj4gAPnPZEDspgKNimkOFJgB+4B797xiBps6BsZX4Ps4R2gpEaFJgtd4kHwiQZM7CUsYfkCvq1920AceEOlsgXdWQ+Cb+4BCssgTz8Y1CmHAJ+I06Dw6aVXuq38/UKQ0ToXMV0FMbISEce+iDTeqlJzmM68N6hlISp098d886LsJhApl1CLIgmOUy10mEeCwjTJTH3tO1AJ6EP4Qx53RXbu+SmgwvCRaMjku6EkiWpOSUAWzVpEFv8tYvsFH2ZfhzRrIwrf1M/9Khz1aYj2/C+CP3WqQZiJSwm80xxOJHjAA+6PMFr5Rm4ruKgaPa5/obkY3bKgSNFe50aPLJnBGXA0uJVQRlso4Jx+VaYC4DFwMpFStd107+s0F0mSJGVXaGDwEMBhFFlMkdMQDkKvK7xLj+K5LgbNk9j4K7IYLmn2IvU/O8DH4f94QTECmm4G+uN4rw1MahbDN2FAjVUUkUkRb0exHc/50bCjKhuIdHHU/TRRxkN2mFAP+FnV/bQRpxk7E6DqWPw/GhYN0oTxpvReXg1rNzgVcq8uMrGoY1PqHSaxo0wHIhXxx7KzZza8vaVDTyZOJ4aMrwKUcbWqYBJAWlCuT00GwhVASzl9YkGtqKZMfYoQaRxt1KxIXRytZgrnAGokpR4XXhoUu7qbwQ2fnOhpvWQ+7gX2dqtpItXb0TWjUdsMZngOmM9G0NGqzlSky4tuAKiuBMgVZVukUROP91TDrCIprTJXsJ8hreaGsqvol2Ol8v+cw9WA2RgNUMyUmBty8PlSdTOMnrlphxc/HhVt7xPYQj0d354H+Mjj3fKdkQyVupxFjFfmGhwC6ZFs1wAMUFcDvBApBpCJZ/2SfKnw/yzbo/ssQOPAKRzbIflKkeqZe3OAoGcSQPraHPRTGGSmlwNaKi+PACZ5NiCsqFGhfVb4LEAUu+SIi+mQMwdwgU/BCWfTgXoOYBPvHBnnm2I63swBKgBaUnhlK0jNAM5jBq8G8KsAmddTQsvpqwAXKUkCWRgzNLDgKkCgIlQ/ZHsgnwUctgCGfZgsVF7q3gCWHbbnNnOARUzJEstyWqhmIu5z3Ri3ur/VJWZb2jtHDbw8LTMzgFUQfDb1JtXDq0VoAAOXJPeJmoZCIJhpvBIUadasFwM+I2ovyfrO/L/H2yXVPIdQ87PriuRXxPr/zwQ8iT/evR7guCT43NyAprbTpXIg3FbWjKqmdy6GqPNkwkSrLQf2HtH1m8GbTGhQimnCdALsUnXPGU1G9YzSR8ABqotHUx/0yxqRcr+wW9PS4Fdqh+sbtSzGHB6eFq8AizpJWGj+RcxKprHSbDoOQeq1zd1CtFiWUi/jzjjPoV2osk83vT0SY++6FHRhG9KGg4GL1KRpH9rCsske32kfZlTvZG+1LC7Ixm470OFkZdc1HMgOpqA06UJAV6k0Z7FKMp5PW8yypmr30SUFyhjN4WP04uV5Dt/j74BEnx0KhszCgaE4VYY/HlrJrl8L6yi55CJ2IU7qRKRZtus6l+ZuvpJ6Hax02izT7t3sewcXB/D835JLtoTFU+AMlf/pHjtRa/eVrBPp4jvmzHD+XIEo9oF3NOlFBX/xEskPdK+AW7/vW20lj0SsrMV5b6hX65aVrGUh3e6ij5q8c+OVlXuGb/684jFrgKUmab7CIZ9APvBAt3oUV49E2k0jEheWPvhA5CP5QNqossijOqdefTRcczqVblOSiMi5/HxY+n69mvaHPRZucLlzrQn4laRwl6b322RqVHrpXHSGMsr/jxlKfflUcYu0Q6ktw11BRXgpdjORmivm2xMSQD1jHWFMpeWmc1EdV6WvRS2gaBVwmmQk6+SNJPlyUpwukvRUHX8peZiUXCT6OClJMoDKdAu0PIXW/z6jG6k54YyjQcj3qw4WQHQM7ENnbHC4LuQ3vqKsRNpcr4/dvb1beZ6bdvXQvpw369fqlxFzb9ms7otdi0gtiagQZYqXLLxKWWgOoNz3hkgsD19tFFV8XeUTBwehNbw+um+bQr/C21D6Fc8av5ijAZSLo93QtzKTsoLw1ET8y6Da6z+3wpHGkTqN/+KqNNSg74LemvkUAEYHLn2Cpf0AqnEa/Gt9wBagsUH+FhRFvw74JDHcPS2BF0c8jr/r9zZYMhTYshNYR22M9rdUCxmkXu40vITst7kdAdsrppD5VjaAIuviTGJcKJ1OAg7ktAIyCtRwleeFGv8aNalNx5WaWzZc1X5lvbP/Mt4lDVV6R2wB7VfWa982ms+8IJpBuCoBkhBOCxdKdBS9gWn64nzx+tPgCQo1iAJV9yf4VeNfQL4U2VUoaMJUHpnJuauaY0LLt/51QljrawvCbpjSgxqAE+5h4LZ/pVz5jKzFAmdl8DAEaMqaCjjSF7wSuQVR5L6sxMGGu7u5S+rEFUtY37cvY0jEsLQLy8rkUst9vxPBN53GxKzlC6ikfBlQ/v2dpxodlos0sIBEH0T7JvowAdgl69+gJeB7ks6Ae1BV4mPtl8732N9RsHAsMafB29xXYySuyAUE1jS0fAqwrBEaQMgbBJy3poLSzE+Ptsi2aXCN8nqAsMGCwl5zpDZNFjgU1wOEda1uN8UzKXersDki06fJM6mUIuiQ1ulVq8qRHLgydi1zHRXaMnBQjbqe2pWtIIWkxebXyB/OMTqI1J8xuopqDQz3/jyLnCQSd0jNrW1tkd8vp4BK3766qqcnogLg+qlAAJRxc+rV9F7r12z6bWHPcqWtbWHwUA8uLslzRKQOexilYS8n0bSQS00uJHqHsCm2XblV5FCnXu0zzvon/Xh4AbR+o6UiDr6AG8ZV06U0garuVZVqwtTWDsv1ZNxqsFUA0AZnMkPdJtfU2kSl455EITe5y91SLNJwh7XN3drm/tTCYE9ifPskHBxA6OwNDwdHEoCw2curG52pf9WmWVC5YfUnvssogMrcgi7nA2xFPY1v77WqA5Rhj1PSDXca0onXv95FPihspoFmMNzi+vi2tIAUw23DQVjVd1aznfT78dwHsugbAKcFPCwBwoa00xKgLV3RAdJ+j9Ol1HjPCCI1W3Fj6wF1aBVvqrbbd+hJb3M4xW86TAESYRwGpFwNrhzAk1taepG07v06d12lQAWAkaQXiSpks2GpLsTN0G65BXgQqoaWMkUQ+2go2WCyI/HAjgeUNjNASxtnCvU0GhZNOgAULh09cFlT9Hqcl9CWIXHzgKxWFsJIDm2WQjNK25vKN3QApE3iQKHrWKfJfFYUudQ65MNB9dByJpYDQlUU3bL3aezgKpb+LiQ8KgugboCUb1BS2wB/gg5QHzcRKyIa1iQag+EOsHF+TXclsoxnMQIHrQsN1WDhPcHnRdo/NgsNHUWqTGagHLqdJiGNEbktWjUClDa1UAwj9iE7dKuxTRnaLd4onHKwx+CIy3Psk+jd8K6m6gzuVQnnUC4G48fo0GV/DiVwSBvuMQwacDJcZD7u5jFRlZbvMybLm/3Fj0J/60QSNm4zHtLM8HRe3h0cikJok5kxh+dtb7K2uIgXEVDZOCnprDR489CUjZoASqfcRIllb4K6qvsVW0/x1NSQHnW/Bqem4lOyJqyuDqgPPe8Sdof3IqUtqymgpweYciJSi7j1VKZITd4fPN06vTZHc6fX0FZNN0N1dFIN9q1FpM23zdQbqT+oOHfGb4tmz/hlTyn1vESSclT0V9ESg3OKU51nzykqdOrmOdTlcPtg9xy9kpn9ciIiZtj7Zk9zbuk8e5qzrC/RWlJcH9h7QPGU/aM5wNN9jgZxvOM1PPM6ovGZ156DokqezjDgSF8MX132T9IrMZttBu1iFKIuORk8oMtPBpdP2Z1x2JMDjoZrh4NHDU83DyS99HRzw3pGiXYhzfDU+C9yQhtds3s2VeHxAW6U5w/ANpn5MMRVp8xrNt0w0N1bSjv6BMGNT8r/Qmfxb37a/8bfE7jkiwWrYZ3RLEtxAvZJf+P1JZxwyCXtEL+6sOoZrK/+6kL8rkNX+MzvOtQ3/XKE5z/6NoWe1hhf3vjrFzf+vkYT3jLF+s/8gkf3jZAwftXP+kaI2OlXSKaxbQq48XdORA9Z6C2JfgnfatmD0yq4WQF3twLb9Ak3/t7Mzb9oc+Nv5tz8qzxXf/cnmVuJiqFxrmzLrNAtAm/mymY5eB7zJf8Ll4sE1Gig/EgAAAAASUVORK5CYII=";

// Imágenes de productos para mostrarle al cliente mientras armás el pedido.
// Cada foto es un archivo en la carpeta img/productos (se baja solo cuando
// tocás "Ver imagen"). Para agregar otra: subí el archivo a esa carpeta y
// sumá acá una línea: "NombreExacto": "img/productos/archivo.webp"
const IMAGENES_PRODUCTO = {
  "Almendra": "img/productos/almendra.webp",
  "Chocolate": "img/productos/chocolate.webp",
  "Proteína": "img/productos/proteina.webp",
  "Bites": "img/productos/bites.webp",
  "Bisglicinato de Magnesio": "img/productos/bisglicinato-de-magnesio.webp",
  "Multimagnesio": "img/productos/multimagnesio.webp",
  "Citrato de Magnesio": "img/productos/citrato-de-magnesio.webp",
  "Magnesio": "img/productos/magnesio.webp",
  "Calcio, Magnesio y Vitamina D3": "img/productos/calcio-magnesio-y-vitamina-d3.webp",
  "Vitamina C, Zinc y Vitamina D": "img/productos/vitamina-c-zinc-y-vitamina-d.webp",
  "Vitamina B12": "img/productos/vitamina-b12.webp",
  "Colágeno Hidrolizado": "img/productos/colageno-hidrolizado.webp",
  "Resveratrol": "img/productos/resveratrol.webp"
};

function precioPorUnidadTexto(p) {
  if (BLISTER_12.includes(p.nombre) && p.categoria === "Vita") {
    return ` <span class="precio-unidad">(${formatCurrency(p.precioVentaSinIVA / 12)} c/u)</span>`;
  }
  return "";
}

// ── Avisar aumento de precio a los clientes que compran cada marca ──────────
function abrirAvisoMarca() {
  marcaAvisoSeleccionada = null;
  mensajeAvisoMarca = "";
  enviadosAvisoMarca = new Set();
  setVista("aviso-marca");
}

// Clientes que alguna vez compraron algo de esa marca (mirando su historial
// real de pedidos, no listas armadas a mano).
function clientesQueComprenMarca(marca) {
  const idsQueCompraron = new Set();
  orders.forEach(o => {
    if (o.borrador || o.eliminado) return;
    if (o.items.some(i => i.categoria === marca)) idsQueCompraron.add(o.client.id);
  });
  return clients
    .filter(c => !c.eliminado && c.id !== CLIENTE_WEB_ID && idsQueCompraron.has(c.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function mensajeAvisoMarcaPorDefecto(marca) {
  return `Hola {nombre} 👋\n\nTe contamos que a partir de la semana que viene los precios de *${marca}* van a tener un ajuste. Cualquier consulta, quedo a disposición.\n\n¡Gracias! 🙌`;
}

function elegirMarcaAviso(marca) {
  marcaAvisoSeleccionada = marca;
  mensajeAvisoMarca = mensajeAvisoMarcaPorDefecto(marca);
  enviadosAvisoMarca = new Set();
  renderVistaAvisoMarca();
}

function actualizarMensajeAvisoMarca() {
  const el = document.getElementById("textareaAvisoMarca");
  if (el) mensajeAvisoMarca = el.value;
}

function restablecerMensajeAvisoMarca() {
  if (!marcaAvisoSeleccionada) return;
  mensajeAvisoMarca = mensajeAvisoMarcaPorDefecto(marcaAvisoSeleccionada);
  renderVistaAvisoMarca();
}

function enviarAvisoMarcaCliente(clienteId) {
  const c = clients.find(x => x.id === clienteId);
  if (!c) return;
  actualizarMensajeAvisoMarca();
  const msg = mensajeAvisoMarca.replace(/\{nombre\}/g, c.nombre);
  const tel = c.telefono ? c.telefono.replace(/\D/g, "") : "";
  if (!tel) return alert(`${c.nombre} no tiene teléfono cargado — tenés que avisarle por otro medio.`);
  window.open(`https://wa.me/54${tel}?text=${encodeURIComponent(msg)}`, "_blank");
  enviadosAvisoMarca.add(clienteId);
  renderVistaAvisoMarca();
}

function renderVistaAvisoMarca() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  const marcasDisponibles = [...new Set(catalogActivo().map(p => p.categoria))].sort();

  if (!marcaAvisoSeleccionada) {
    cont.innerHTML = `
      <div class="page-header">
        <button class="btn-back" onclick="abrirStock()">← Volver</button>
        <h2 class="page-title2">📢 Avisar aumento</h2>
      </div>
      <div class="form-card">
        <h3 class="section-title">¿A qué marca le subiste el precio?</h3>
        <p class="muted" style="margin-bottom:10px;">Elegí la marca y el sistema arma solo la lista de los clientes que alguna vez te compraron algo de esa marca, mirando su historial de pedidos.</p>
        <div class="marcas-check-grid">
          ${marcasDisponibles.map(m => `
            <button class="tipo-tab" style="width:100%;" onclick="elegirMarcaAviso('${m}')">${m}</button>
          `).join("")}
        </div>
      </div>
    `;
    return;
  }

  const clientesMarca = clientesQueComprenMarca(marcaAvisoSeleccionada);
  const conTelefono = clientesMarca.filter(c => c.telefono);
  const sinTelefono = clientesMarca.filter(c => !c.telefono);

  cont.innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="marcaAvisoSeleccionada=null; renderVistaAvisoMarca();">← Cambiar marca</button>
      <h2 class="page-title2">📢 ${marcaAvisoSeleccionada}</h2>
    </div>

    <div class="form-card">
      <h3 class="section-title">Mensaje</h3>
      <p class="muted" style="margin:0 0 8px;">Usá <strong>{nombre}</strong> donde quieras que aparezca el nombre de cada cliente — se completa solo al mandarlo.</p>
      <textarea id="textareaAvisoMarca" rows="6" onchange="actualizarMensajeAvisoMarca()" style="width:100%; font-family:inherit; font-size:14px; padding:10px; border-radius:10px; border:1px solid #e5e7eb;">${mensajeAvisoMarca}</textarea>
      <button class="btn-sm btn-outline" style="margin-top:8px;" onclick="restablecerMensajeAvisoMarca()">↺ Restablecer mensaje</button>
    </div>

    <div class="form-card">
      <h3 class="section-title">Clientes que compran ${marcaAvisoSeleccionada} (${clientesMarca.length})</h3>
      ${clientesMarca.length === 0
        ? `<div class="empty-state">Todavía no le vendiste ${marcaAvisoSeleccionada} a ningún cliente.</div>`
        : `
        <p class="muted" style="margin:0 0 10px;">Tocá "Enviar" en cada uno para abrirle WhatsApp con el mensaje ya escrito — solo te queda apretar mandar. Se van marcando ✅ a medida que los vas tocando.</p>
        ${conTelefono.map(c => `
          <div class="stock-row">
            <div>
              <div class="stock-nombre">${enviadosAvisoMarca.has(c.id) ? "✅ " : ""}${c.nombre}</div>
              <div class="muted">${c.telefono}</div>
            </div>
            <button class="btn-sm ${enviadosAvisoMarca.has(c.id) ? 'btn-outline' : 'btn-success'}" onclick="enviarAvisoMarcaCliente('${c.id}')">${enviadosAvisoMarca.has(c.id) ? "Reenviar" : "💬 Enviar"}</button>
          </div>
        `).join("")}
        ${sinTelefono.length > 0 ? `
          <p class="muted" style="margin-top:12px;">⚠️ Sin teléfono cargado (avisales por otro medio): ${sinTelefono.map(c => c.nombre).join(", ")}</p>
        ` : ""}
      `}
    </div>
  `;
}

function abrirListaPrecios() {
  marcasListaPrecios = new Set();
  setVista("lista-precios");
}

function toggleMarcaListaPrecios(marca) {
  if (marcasListaPrecios.has(marca)) marcasListaPrecios.delete(marca);
  else marcasListaPrecios.add(marca);
  renderVistaListaPrecios();
}

function renderVistaListaPrecios() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  const marcasDisponibles = [...new Set(catalogActivo().map(p => p.categoria))].sort();
  const productosSeleccionados = catalogActivo().filter(p => marcasListaPrecios.has(p.categoria));

  cont.innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="abrirStock()">← Volver</button>
      <h2 class="page-title2">📋 Lista de precios</h2>
    </div>

    <div class="form-card">
      <h3 class="section-title">Elegí las marcas a incluir</h3>
      <div class="marcas-check-grid">
        ${marcasDisponibles.map(m => `
          <label class="marca-check ${marcasListaPrecios.has(m) ? 'active' : ''}">
            <input type="checkbox" ${marcasListaPrecios.has(m) ? 'checked' : ''} onchange="toggleMarcaListaPrecios('${m}')" />
            <span>${m}</span>
          </label>
        `).join("")}
      </div>
    </div>

    <div class="form-card">
      <h3 class="section-title">Vista previa (${productosSeleccionados.length} productos)</h3>
      ${productosSeleccionados.length === 0
        ? `<div class="empty-state">Elegí al menos una marca.</div>`
        : marcasDisponibles.filter(m => marcasListaPrecios.has(m)).map(m => `
          <div class="lista-precio-marca">
            <div class="lista-precio-marca-titulo">${m}</div>
            ${catalogActivo().filter(p => p.categoria === m).map(p => `
              <div class="lista-precio-item">
                <span>${p.nombre}${precioPorUnidadTexto(p)}</span>
                <strong>${formatCurrency(p.precioVentaSinIVA)}</strong>
              </div>
            `).join("")}
          </div>
        `).join("")
      }
    </div>

    ${productosSeleccionados.length > 0 ? `
    <div class="actions-col">
      <button class="btn-whatsapp btn-full" onclick="enviarListaPreciosWhatsApp()">📱 Enviar por WhatsApp</button>
      <button class="btn-pdf btn-full" onclick="generarPDFListaPrecios()">📄 Descargar PDF</button>
    </div>` : ""}
  `;
}

function construirMensajeListaPrecios() {
  const marcasDisponibles = [...new Set(catalogActivo().map(p => p.categoria))].sort();
  let msg = `📋 *Lista de precios*\n\n`;
  marcasDisponibles.filter(m => marcasListaPrecios.has(m)).forEach(m => {
    msg += `*${m}*\n`;
    catalogActivo().filter(p => p.categoria === m).forEach(p => {
      const xUnidad = BLISTER_12.includes(p.nombre) && p.categoria === "Vita"
        ? ` (${formatCurrency(p.precioVentaSinIVA / 12)} c/u)` : "";
      msg += `▪️ ${p.nombre}: ${formatCurrency(p.precioVentaSinIVA)}${xUnidad}\n`;
    });
    msg += `\n`;
  });
  msg += `Precios sin IVA. Cualquier consulta, escribime 🙌`;
  return msg;
}

function enviarListaPreciosWhatsApp() {
  const msg = construirMensajeListaPrecios();
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}

async function generarPDFListaPrecios() {
  try { await cargarJsPDF(); } catch (e) { return alert("No se pudo cargar la librería de PDF."); }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("Distribuidora Chaque", margin, y - 2);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("Lista de Precios", pageW - margin, y - 2, { align: "right" });
  y += 10;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString("es-AR"), margin, y);
  y += 10;

  const marcasDisponibles = [...new Set(catalogActivo().map(p => p.categoria))].sort();
  marcasDisponibles.filter(m => marcasListaPrecios.has(m)).forEach(m => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(m, margin, y);
    y += 7;

    const filas = catalogActivo().filter(p => p.categoria === m).map(p => {
      const nombreConUnidad = BLISTER_12.includes(p.nombre) && p.categoria === "Vita"
        ? `${p.nombre} (${formatCurrency(p.precioVentaSinIVA / 12)} c/u)` : p.nombre;
      return [nombreConUnidad, formatCurrency(p.precioVentaSinIVA)];
    });
    doc.autoTable({
      startY: y,
      head: [["Producto", "Precio s/IVA"]],
      body: filas,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: "bold", fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right", cellWidth: 40 } }
    });
    y = doc.lastAutoTable.finalY + 10;
  });

  doc.save(`Lista_Precios_${new Date().toLocaleDateString("es-AR").replace(/\//g,"-")}.pdf`);
}

function abrirStock() {
  filtroStock = "Todas";
  setVista("stock");
}

function filtrarStock(cat) {
  filtroStock = cat;
  renderVistaStock();
}

// ── Inversión por marca ─────────────────────────────────────────────────────
function registrarGastoExtra() {
  const monto = parseNumber(document.getElementById("extraMonto").value) || 0;
  const fecha = document.getElementById("extraFecha").value;
  const nota  = document.getElementById("extraNota").value.trim();
  if (monto <= 0) return alert("Ingresá un monto válido");
  if (!fecha) return alert("Elegí una fecha");

  inversiones.push({
    id: generarId(),
    marca: "Imprevistos",
    monto,
    fecha,
    nota,
    actualizadoEn: Date.now()
  });

  guardarStorage();
  document.getElementById("extraMonto").value = "";
  document.getElementById("extraNota").value = "";
  renderVistaResumen();
}

function registrarGastoVehiculo() {
  const monto = parseNumber(document.getElementById("vehiculoMonto").value) || 0;
  const litros = parseNumber(document.getElementById("vehiculoLitros")?.value) || 0;
  const fecha = document.getElementById("vehiculoFecha").value;
  if (monto <= 0) return alert("Ingresá un monto válido");
  if (!fecha) return alert("Elegí una fecha");

  inversiones.push({
    id: generarId(),
    marca: "Combustible",
    monto,
    litros: litros > 0 ? litros : null,
    fecha,
    nota: "",
    actualizadoEn: Date.now()
  });

  guardarStorage();
  document.getElementById("vehiculoMonto").value = "";
  const litrosInput = document.getElementById("vehiculoLitros");
  if (litrosInput) litrosInput.value = "";
  renderVistaResumen();
}

function guardarKmMes() {
  kmPorMes[mesResumen] = parseInt(document.getElementById("inputKmMes").value) || 0;
  configVehiculo.actualizadoEn = Date.now();
  setItemSeguro("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
  fetchConTimeout(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "vehiculo", payload: [configVehiculo] }) });
  renderVistaResumen();
}

function registrarInversion() {
  const monto = parseNumber(document.getElementById("inversionMonto").value);
  const fecha = document.getElementById("inversionFecha").value;
  const nota  = document.getElementById("inversionNota").value.trim();
  if (!monto || monto <= 0) return alert("Ingresá un monto válido");
  if (!fecha) return alert("Elegí una fecha");

  inversiones.push({
    id: generarId(),
    marca: filtroStock,
    monto,
    fecha,
    nota,
    actualizadoEn: Date.now()
  });

  guardarStorage();
  renderVistaStock();
}

function eliminarInversion(id) {
  const inv = inversiones.find(i => i.id === id);
  if (!inv) return;
  inv.eliminado = true;
  inv.actualizadoEn = Date.now();
  guardarStorage();
  renderVistaStock();
}

function renderVistaStock() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  const categorias = [...new Set(catalogActivo().map(p => p.categoria))].sort();
  const catalogFiltrado = filtroStock === "Todas" ? catalogActivo() : catalogActivo().filter(p => p.categoria === filtroStock);

  cont.innerHTML = `
    <div class="page-header">
      <h2 class="page-title2">Stock</h2>
      <div style="display:flex; gap:4px;">
        <button class="btn-guardar-ahora" style="padding:5px 8px; font-size:11px;" onclick="toggleFormNuevoProducto()">➕ Nuevo</button>
        <button class="btn-guardar-ahora" style="padding:5px 8px; font-size:11px;" onclick="abrirListaPrecios()">📋 Precios</button>
        <button class="btn-guardar-ahora" style="padding:5px 8px; font-size:11px;" onclick="abrirAvisoMarca()">📢 Aumento</button>
      </div>
    </div>

    <div id="form-nuevo-producto" class="form-card" style="display:none;">
      <h3 class="section-title">➕ Nuevo producto</h3>
      <div class="form-group">
        <label>Nombre</label>
        <input id="nuevoProductoNombre" placeholder="Ej: Yerba Mate 1kg" />
      </div>
      <div class="form-group">
        <label>Marca / categoría</label>
        <input id="nuevoProductoCategoria" list="listaCategoriasProducto" placeholder="Ej: Yerbas, Alunexa..." value="${filtroStock !== "Todas" ? filtroStock : ""}" />
        <datalist id="listaCategoriasProducto">
          ${categorias.map(c => `<option value="${c}"></option>`).join("")}
        </datalist>
      </div>
      <div class="row-2">
        <div class="form-group" style="margin:0;">
          <label>Precio de venta (s/IVA)</label>
          <input id="nuevoProductoPrecio" type="text" inputmode="decimal" placeholder="Ej: 5000" />
        </div>
        <div class="form-group" style="margin:0;">
          <label>Código (opcional)</label>
          <input id="nuevoProductoCodigo" type="number" placeholder="Ej: 400" />
        </div>
      </div>
      <div class="form-group">
        <label>Precio público (s/IVA, opcional)</label>
        <input id="nuevoProductoPrecioPublico" type="text" inputmode="decimal" placeholder="Para clientes tipo Otro" />
      </div>
      <div class="row-2">
        <div class="form-group" style="margin:0;">
          <label>Costo (opcional)</label>
          <input id="nuevoProductoCosto" type="text" inputmode="decimal" placeholder="Costo de compra" oninput="document.getElementById('nuevoProductoComision').value=''" />
        </div>
        <div class="form-group" style="margin:0;">
          <label>o % Comisión</label>
          <input id="nuevoProductoComision" type="number" min="0" max="100" placeholder="Ej: 10" oninput="calcularCostoNuevoProductoPorComision()" />
        </div>
      </div>
      <div class="form-group">
        <label>Stock inicial</label>
        <input id="nuevoProductoStock" type="number" min="0" placeholder="0" />
      </div>
      <button class="btn-primary btn-full" onclick="guardarNuevoProducto()">Guardar producto</button>
    </div>

    <div class="tipo-tabs">
      ${["Todas", ...categorias].map(c => `
        <button class="tipo-tab ${filtroStock === c ? 'active' : ''}" onclick="filtrarStock('${c}')">${c}</button>
      `).join("")}
    </div>

    <div class="form-card">
      <h3 class="section-title">Actualizar stock</h3>
      <div class="form-group">
        <label>Producto</label>
        <select id="stockProductoSelect">
          <option value="">Seleccionar producto</option>
          ${catalogFiltrado.map(p => {
            const aviso = p.stock === 0 ? " ⛔" : (p.stock <= STOCK_BAJO_UMBRAL ? " ⚠️" : "");
            return `<option value="${p.id}">${p.nombre} · Stock actual: ${p.stock}${aviso}</option>`;
          }).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Cantidad</label>
        <input id="stockAgregar" type="number" min="0" value="0" />
      </div>
      <div class="row-2">
        <button class="btn-primary" onclick="cargarStock()">+ Sumar stock</button>
        <button class="btn-secondary" onclick="fijarStock()">= Fijar stock</button>
      </div>
    </div>

    <div class="form-card">
      <h3 class="section-title">Productos y precios</h3>
      ${(() => {
        const bajos = catalogFiltrado.filter(p => p.stock > 0 && p.stock <= STOCK_BAJO_UMBRAL).length;
        const agotados = catalogFiltrado.filter(p => p.stock === 0).length;
        if (!bajos && !agotados) return "";
        const partes = [];
        if (agotados) partes.push(`${agotados} sin stock`);
        if (bajos) partes.push(`${bajos} con stock bajo`);
        return `<div class="aviso-stock-bajo">⚠️ ${partes.join(" · ")} — revisá la reposición</div>`;
      })()}
      ${catalogFiltrado.map(p => {
        const claseStock = p.stock === 0 ? 'text-red' : (p.stock <= STOCK_BAJO_UMBRAL ? 'text-orange' : 'text-green');
        const costoActual = costoDeProducto(p);
        const codigoActual = codigoDeProducto(p);
        return `
        <div class="stock-row">
          <div style="flex:1;">
            <div class="stock-nombre">${codigoActual ? `#${codigoActual} · ` : ""}${p.nombre}</div>
            <div class="muted">${p.categoria} · s/IVA: ${formatCurrency(p.precioVentaSinIVA)}${p.precioPublico > 0 ? ` · 🏷️ Público: ${formatCurrency(p.precioPublico)}` : ""} · Costo: ${costoActual > 0 ? formatCurrency(costoActual) : "sin cargar ⚠️"}</div>
            ${textoUltimaCargaStock(p)}
            <div id="form-precio-${p.id}" style="display:none; margin-top:8px;">
              <div class="row-2">
                <div class="form-group" style="margin:0;">
                  <label>Nombre</label>
                  <input id="input-nombre-${p.id}" placeholder="Nombre del producto" value="${p.nombre}" />
                </div>
                <div class="form-group" style="margin:0;">
                  <label>Marca / categoría</label>
                  <input id="input-categoria-${p.id}" list="listaCategoriasProducto" placeholder="Marca" value="${p.categoria}" />
                </div>
              </div>
              <div class="row-2" style="margin-top:8px;">
                <div class="form-group" style="margin:0;">
                  <label>Código</label>
                  <input id="input-codigo-${p.id}" type="number" placeholder="Ej: 100" value="${codigoActual}" />
                </div>
                <div class="form-group" style="margin:0;">
                  <label>Precio de venta (s/IVA)</label>
                  <input id="input-precio-${p.id}" type="text" inputmode="decimal" placeholder="Precio de venta" value="${montoParaInput(p.precioVentaSinIVA)}" />
                </div>
              </div>
              <div class="form-group" style="margin:8px 0 0;">
                <label>Precio público (s/IVA, para clientes Otro)</label>
                <input id="input-preciopublico-${p.id}" type="text" inputmode="decimal" placeholder="Sin cargar" value="${p.precioPublico > 0 ? p.precioPublico : ''}" />
              </div>
              <div class="form-group" style="margin:8px 0 0;">
                <label>Costo (lo que pagás vos, o le corresponde al proveedor)</label>
                <input id="input-costo-${p.id}" type="text" inputmode="decimal" placeholder="Costo de compra" value="${costoActual || ""}" />
              </div>
              <div class="form-group" style="margin:8px 0 0;">
                <label>¿O trabajás a comisión? Poné tu % y te calculo el costo solo</label>
                <input id="input-comision-${p.id}" type="number" min="0" max="100" placeholder="Ej: 10 (tu comisión)" oninput="calcularCostoPorComision('${p.id}')" />
              </div>
              <div class="row-2" style="margin-top:6px;">
                <button class="btn-success" onclick="guardarPrecio('${p.id}')">Guardar</button>
                <button class="btn-outline" style="color:#dc2626;" onclick="eliminarProducto('${p.id}')">🗑️ Eliminar</button>
              </div>
              <details style="margin-top:10px;">
                <summary style="cursor:pointer; font-size:13px; color:#2563eb;">🔀 ¿Está repetido? Unificar con otro producto</summary>
                <p class="muted" style="font-size:12px; margin:6px 0;">Elegí el repetido: su stock se suma a "${p.nombre}", sus ventas pasan a este y el repetido se elimina.</p>
                <select id="unificar-${p.id}" style="width:100%; margin-bottom:6px;">
                  <option value="">Elegí el producto repetido</option>
                  ${catalogActivo().filter(x => x.id !== p.id).map(x => `<option value="${x.id}">${x.nombre} · ${x.categoria} · stock ${x.stock}</option>`).join("")}
                </select>
                <button class="btn-outline btn-full" onclick="unificarProducto('${p.id}')">🔀 Unificar en "${p.nombre}"</button>
              </details>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <strong class="${claseStock}">${p.stock}${p.stock > 0 && p.stock <= STOCK_BAJO_UMBRAL ? ' ⚠️' : ''}</strong>
            <button class="btn-sm btn-outline" onclick="toggleFormPrecio('${p.id}')">✏️ Editar</button>
          </div>
        </div>
      `;
      }).join("")}
    </div>

    ${filtroStock !== "Todas" ? (() => {
      const ranking = calcularRankingVentasMarca(filtroStock, modoRankingStock === "mes");
      const medallas = ["🥇", "🥈", "🥉"];
      const hoy = new Date();
      const esMesActual = mesRankingStock.mes === hoy.getMonth()+1 && mesRankingStock.anio === hoy.getFullYear();
      const nombreMes = `${MESES_ES[mesRankingStock.mes-1]} ${mesRankingStock.anio}`;
      return `
      <div class="form-card">
        <h3 class="section-title">🏆 Lo que más vendés de ${filtroStock}</h3>
        <div class="tipo-tabs" style="margin-bottom:10px;">
          <button class="tipo-tab ${modoRankingStock === "mes" ? "active" : ""}" onclick="cambiarModoRankingStock('mes')">Por mes</button>
          <button class="tipo-tab ${modoRankingStock === "acumulado" ? "active" : ""}" onclick="cambiarModoRankingStock('acumulado')">Acumulado</button>
        </div>
        ${modoRankingStock === "mes" ? `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          <button class="btn-sm btn-outline" onclick="navegarMesRanking(-1)" style="padding:4px 10px; font-size:1rem;">←</button>
          <span style="flex:1; text-align:center; font-weight:600;">${nombreMes}</span>
          <button class="btn-sm btn-outline" onclick="navegarMesRanking(1)" style="padding:4px 10px; font-size:1rem;" ${esMesActual ? "disabled" : ""}>→</button>
        </div>` : ""}
        ${ranking.length === 0
          ? `<div class="muted">Todavía no hay ventas de ${filtroStock} ${modoRankingStock === "mes" ? `en ${nombreMes}` : "registradas"}.</div>`
          : ranking.map((p, i) => `
            <div class="stock-row">
              <div>
                <div class="stock-nombre">${medallas[i] || (i + 1) + "."} ${p.nombre}</div>
                <div class="muted">${formatCurrency(p.total)}</div>
              </div>
              <strong>${p.cantidad} u</strong>
            </div>
          `).join("")
        }
      </div>`;
    })() : ""}

    ${filtroStock !== "Todas" ? (() => {
      const inversionesMarca = inversiones.filter(i => i.marca === filtroStock && !i.eliminado).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      const totalInvertido = inversionesMarca.reduce((a, i) => a + i.monto, 0);
      return `
      <div class="form-card">
        <h3 class="section-title">💵 Inversión en ${filtroStock}</h3>
        <div class="form-group">
          <label>Monto invertido</label>
          <input id="inversionMonto" type="text" inputmode="decimal" min="0" placeholder="Ej: 50000" />
        </div>
        <div class="form-group">
          <label>Fecha</label>
          <input id="inversionFecha" type="date" value="${fechaHoyLocal()}" />
        </div>
        <div class="form-group">
          <label>Nota (opcional)</label>
          <input id="inversionNota" placeholder="Ej: Reposición mensual" />
        </div>
        <button class="btn-primary btn-full" onclick="registrarInversion()">+ Registrar inversión</button>

        <div class="stock-row" style="border-top:2px solid #e5e7eb; margin-top:14px; padding-top:10px;">
          <strong>Total invertido en ${filtroStock}</strong>
          <strong style="color:#dc2626;">${formatCurrency(totalInvertido)}</strong>
        </div>

        ${inversionesMarca.length > 0 ? inversionesMarca.map(i => `
          <div class="stock-row">
            <div>
              <div class="stock-nombre">${formatCurrency(i.monto)}</div>
              <div class="muted">${i.fecha}${i.nota ? " · " + i.nota : ""}</div>
            </div>
            <button class="btn-sm btn-outline" onclick="eliminarInversion('${i.id}')">🗑️</button>
          </div>
        `).join("") : `<div class="muted" style="margin-top:8px;">Todavía no registraste ninguna inversión en ${filtroStock}.</div>`}
      </div>`;
    })() : ""}
  `;
}

// ── Vista: BACKUP ─────────────────────────────────────────────────────────────
// Ganancia neta de un mes: lo cobrado (ganancia) menos los costos del
// vehículo y operación — la misma cuenta que "Ganancia neta" en Resumen.
// Queda "final" recién cuando están cargados los km de ese mes.
function gananciaNetaDelMes(mes, anio) {
  const clave = `${anio}-${String(mes).padStart(2, "0")}`;
  const ganancia = calcularGananciaCobrada((d, m, a) => m === mes && a === anio);
  const nafta = inversiones
    .filter(i => !i.eliminado && i.marca === "Combustible")
    .filter(i => { const [yi, mi] = (i.fecha || "").split("-"); return parseInt(mi) === mes && parseInt(yi) === anio; })
    .reduce((a, i) => a + i.monto, 0);
  const km = kmPorMes[clave] || 0;
  const costos = calcularCostosVehiculo(km, nafta, calcularGastosExtraMes(mes, anio)).costoTotalMes;
  return { ganancia, costos, neta: ganancia - costos, final: km > 0 };
}

// Todos los meses con ventas o cobros, desde el primero hasta el actual.
function mesesConActividad() {
  const claves = new Set();
  const agregar = (fecha) => {
    const partes = (fecha || "").replace(/,.*/, "").split("/");
    const m = parseInt(partes[1]), a = parseInt(partes[2]);
    if (m >= 1 && m <= 12 && a > 2000) claves.add(a * 100 + m);
  };
  orders.forEach(o => {
    if (o.eliminado) return;
    if (!o.borrador) agregar(o.fecha);
    (o.pagos || []).forEach(p => agregar(p.fecha));
  });
  const hoy = new Date();
  const actual = hoy.getFullYear() * 100 + hoy.getMonth() + 1;
  return [...claves].filter(k => k <= actual).sort((a, b) => a - b).map(k => ({ anio: Math.floor(k / 100), mes: k % 100 }));
}

function renderVistaBackup() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  const totalVentas = orders.filter(o => !o.eliminado).reduce((a, o) => a + o.totals.totalSinIVA, 0);

  cont.innerHTML = `
    <div class="page-header">
      <h2 class="page-title2">Backup / Restaurar</h2>
    </div>

    <div class="form-card">
      <p class="muted">Exportá un backup para no perder clientes, pedidos y stock. Importalo cuando necesites restaurar.</p>
      <div class="actions-col">
        <button class="btn-primary btn-full" onclick="exportarDatos()">📤 Exportar backup</button>
        <button class="btn-secondary btn-full" onclick="document.getElementById('importBackupInput').click()">📥 Importar backup</button>
      </div>
      <input id="importBackupInput" type="file" accept=".json" style="display:none;" onchange="importarDatos(event)" />
    </div>

    ${renderCardEspacio()}

    ${renderCardClaveGoogle()}

    ${renderCardBloqueo()}

    <div class="form-card">
      <h3 class="section-title">Resumen</h3>
      <div class="stats-grid">
       <div class="stat-box"><div class="muted">Clientes</div><strong>${clients.filter(c => !c.eliminado && (c.tipo || "Otro") !== "Otro").length}</strong></div>
        <div class="stat-box"><div class="muted">Pedidos</div><strong>${orders.length}</strong></div>
        <div class="stat-box"><div class="muted">Productos</div><strong>${catalog.length}</strong></div>
        <div class="stat-box"><div class="muted">Total ventas</div><strong style="font-size:14px;">${formatCurrency(totalVentas)}</strong></div>
        ${(() => {
          const hoy = new Date();
          const mesAct = hoy.getMonth() + 1, anioAct = hoy.getFullYear();
          const gm = gananciaNetaDelMes(mesAct, anioAct);
          const meses = mesesConActividad();
          const total = meses.reduce((a, x) => a + gananciaNetaDelMes(x.mes, x.anio).neta, 0);
          const faltanKm = meses
            .filter(x => !(x.mes === mesAct && x.anio === anioAct) && !gananciaNetaDelMes(x.mes, x.anio).final)
            .map(x => MESES_ES[x.mes - 1] + (x.anio !== anioAct ? " " + x.anio : ""));
          const color = v => v >= 0 ? "#059669" : "#dc2626";
          return `
        <div class="stat-box">
          <div class="muted">Ganancia de ${MESES_ES[mesAct - 1]}</div>
          <strong style="font-size:14px; color:${color(gm.neta)};">${formatCurrency(gm.neta)}</strong>
          <div style="font-size:11px; margin-top:2px; color:${gm.final ? "#059669" : "#d97706"};">${gm.final ? "✅ Final" : "⏳ Parcial — falta cargar los km"}</div>
        </div>
        <div class="stat-box">
          <div class="muted">Ganancia total</div>
          <strong style="font-size:14px; color:${color(total)};">${formatCurrency(total)}</strong>
          <div class="muted" style="font-size:11px; margin-top:2px;">Desde que usás la app</div>
        </div>
        ${faltanKm.length ? `<p class="muted" style="grid-column:1 / -1; font-size:12px; margin:2px 0 0;">⚠️ Faltan los km de: ${faltanKm.join(", ")}. Hasta que los cargues, esos meses no descuentan la nafta ni el desgaste.</p>` : ""}`;
        })()}
      </div>
      <p class="muted" style="font-size:12px; margin:8px 0 0;">Ganancia = lo cobrado menos los costos del vehículo y operación (igual que la ganancia neta del Resumen).</p>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// PDF (igual que antes, sin cambios)
// ═══════════════════════════════════════════════════════════════

function cargarJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) return resolve();
    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
      s2.onload = resolve;
      s2.onerror = () => reject(new Error("No se pudo cargar autotable"));
      document.head.appendChild(s2);
    };
    s1.onerror = () => reject(new Error("No se pudo cargar jsPDF"));
    document.head.appendChild(s1);
  });
}

function obtenerNroFactura() {
  const n = parseInt(localStorage.getItem("alunexa_nro_factura") || "0") + 1;
  setItemSeguro("alunexa_nro_factura", n);
  return n;
}

// Logo de Distribuidora Chaque en color, para el encabezado del PDF de venta.
// El logo está en un archivo aparte (antes iba metido acá adentro y hacía
// que la app tarde más en abrir). Se baja recién cuando se arma un PDF.
const LOGO_FACTURA_URL = "img/logo-factura.png";
let logoFacturaCache = null;
async function cargarLogoFactura() {
  if (logoFacturaCache) return logoFacturaCache;
  try {
    const blob = await (await fetch(LOGO_FACTURA_URL)).blob();
    logoFacturaCache = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    console.log("No se pudo cargar el logo del PDF:", e);
    return null;
  }
  return logoFacturaCache;
}

async function generarFacturaPDF(order, modo) {
  try { await cargarJsPDF(); } catch (e) { return alert("No se pudo cargar la librería de PDF."); }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = 18;

  // Logo de Distribuidora Chaque, arriba a la izquierda
  const logoFactura = await cargarLogoFactura();
  if (logoFactura) doc.addImage(logoFactura, "PNG", margin, y - 6, 20, 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Distribuidora Chaque", margin + 24, y + 4);

  // Título arriba derecha
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("Remito", pageW - margin, y - 2, { align: "right" });

  // Datos de contacto debajo del logo
  y += 20;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Santa Fe, Argentina", margin, y); y += 4;
  doc.text("Tel: 342-5040728", margin, y); y += 4;
  doc.text("distribuidorachaque@gmail.com", margin, y); y += 6;

  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageW - margin, y); y += 6;

  const nro = order.nroFactura || obtenerNroFactura();
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(`Número de Remito: ${nro}`, margin, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${order.fecha || new Date().toLocaleString("es-AR")}`, margin, y); y += 5;
  doc.text(`Cliente: ${order.client.nombre}`, margin, y); y += 5;
  if (order.client.telefono) { doc.text(`Teléfono: ${order.client.telefono}`, margin, y); y += 5; }
  if (order.client.direccion) { doc.text(`Dirección: ${order.client.direccion}`, margin, y); y += 5; }
  y += 2;

  doc.line(margin, y, pageW - margin, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Descripción de Productos:", margin, y); y += 4;

  const filas = order.items.map(item => {
    const precio   = formatCurrency(modo === "con" ? item.precioVentaConIVA : item.precioVentaSinIVA);
    const subtotal = formatCurrency(modo === "con" ? item.subtotalConIVA : item.subtotalSinIVA);
    return [item.nombre, String(item.cantidad), precio, subtotal];
  });

  doc.autoTable({
    startY: y,
    head: [["Producto", "Cant.", "Precio Unit.", "Total"]],
    body: filas,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "center", cellWidth: 18 }, 2: { halign: "right", cellWidth: 42 }, 3: { halign: "right", cellWidth: 42 } }
  });

  y = doc.lastAutoTable.finalY + 8;
  const rightX = pageW - margin;
  doc.setFontSize(10);

  if (modo === "sin" || modo === "ambos") {
    doc.setFont("helvetica", "normal");
    doc.text(`Total a Pagar: ${formatCurrency(order.totals.totalSinIVA)}`, rightX, y, { align: "right" }); y += 5;
  } else {
    const iva = order.totals.totalConIVA - order.totals.totalSinIVA;
    doc.setFont("helvetica", "normal");
    doc.text(`Subtotal s/IVA: ${formatCurrency(order.totals.totalSinIVA)}`, rightX, y, { align: "right" }); y += 5;
    doc.text(`IVA (21%): ${formatCurrency(iva)}`, rightX, y, { align: "right" }); y += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Total a Pagar: ${formatCurrency(order.totals.totalConIVA)}`, rightX, y, { align: "right" }); y += 5;
  }

  y += 4;
  doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text("Comprobante no válido como factura", rightX, y, { align: "right" }); y += 2;
  doc.setTextColor(0, 0, 0);

  if (order.notas) { y += 3; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Notas: ${order.notas}`, margin, y); y += 6; }

  y += 12;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("¡Gracias por tu compra, vuelve pronto!", pageW / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
  doc.text("Para más información, visite nuestro sitio web o síganos en nuestras redes sociales", pageW / 2, pageH - 14, { align: "center" });
  doc.text("Distribuidora Chaque · Santa Fe, Argentina", pageW / 2, pageH - 9, { align: "center" });

  doc.save(`Remito_${nro}_${order.client.nombre.replace(/\s+/g, "_")}.pdf`);
}

async function generarPDFPedidoActual() {
  const client = clients.find(c => c.id === clienteActivoId);
  if (!client) return alert("No hay cliente seleccionado");
  if (currentItems.length === 0) return alert("Agregá productos al pedido");

  const tSin  = currentItems.reduce((a, i) => a + i.subtotalSinIVA, 0);
  const tCon  = currentItems.reduce((a, i) => a + i.subtotalConIVA, 0);
  const tCant = currentItems.reduce((a, i) => a + i.cantidad, 0);

  await generarFacturaPDF({
    client, items: [...currentItems],
    notas: document.getElementById("notasPedido").value.trim(),
    fecha: new Date().toLocaleString("es-AR"),
    totals: { totalSinIVA: tSin, totalConIVA: tCon, totalCantidad: tCant }
  }, document.getElementById("modoPrecio").value);
}

async function generarPDFPedidoGuardado(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;
  await generarFacturaPDF(order, order.modoPrecio || "sin");
}

// ── Scroll horizontal con mouse wheel en tabs ─────────────────────────────────
document.addEventListener("wheel", function(e) {
  const tabs = e.target.closest(".tipo-tabs");
  if (tabs) {
    e.preventDefault();
    tabs.scrollLeft += e.deltaY * 1.5;
  }
}, { passive: false });

// ── Precios distribuidor por producto ────────────────────────────────────────
const PRECIOS_DISTRIBUIDOR = {
  "Bisglicinato de Magnesio": 7935,
  "Citrato de Magnesio": 7375,
  "Multimagnesio": 7046,
  "Magnesio": 5550,
  "Calcio, Magnesio y Vitamina D3": 6000,
  "Vitamina C, Zinc y Vitamina D": 6900,
  "Vitamina B12": 6180,
  "Colágeno Hidrolizado": 6800,
  "Resveratrol": 8750,
  "Almendra": 15000,
  "Chocolate": 15000,
  "Proteína": 17250,
  "Bites": 3150,
  "Cardo Mariano": 9500,
  "Tremella": 9500,
  "Ashwagandha": 9500,
  "Cordyceps": 9500,
  "Melena de León": 9500,
  "Reishi": 9500,
};

function generarExcelModelo() {
  if (!window.XLSX) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => _crearExcelModelo();
    document.head.appendChild(s);
  } else {
    _crearExcelModelo();
  }
}

function _crearExcelModelo() {
  const [y, m] = fechaResumen.split("-");
  const mesNombre = new Date(parseInt(y), parseInt(m)-1, 1)
    .toLocaleString("es-AR", { month: "long" });
  const mesCapital = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

  // Filtrar pedidos del mes seleccionado
  const pedidosMes = orders.filter(o => {
    if (o.borrador || o.eliminado) return false;
    const partes = o.fecha.replace(/,.*/, '').split('/');
    return parseInt(partes[1]) === parseInt(m) && partes[2] === y;
  });

  // Sumar cantidades por producto
  const cantidades = {};
  pedidosMes.forEach(o => {
    o.items.forEach(i => {
      cantidades[i.nombre] = (cantidades[i.nombre] || 0) + i.cantidad;
    });
  });

  const wb = XLSX.utils.book_new();
  const marcas = [...new Set(catalogActivo().map(p => p.categoria))].sort();

  marcas.forEach(marca => {
    const productos = catalogActivo().filter(p => p.categoria === marca);
    if (productos.length === 0) return;

    const dataRow = 7;
    const lastRow = dataRow + productos.length - 1;

    const rows = [];
    rows.push([`${marca} - Margen de ganancia por producto`,"","","","","","","","","Resumen",""]);
    rows.push(["Distribuidora Chaque","","","","","","","","","Costo total",{f:`SUM(F${dataRow}:F${lastRow})`}]);
    rows.push(["","","","","","","","","","Venta total",{f:`SUM(G${dataRow}:G${lastRow})`}]);
    rows.push([`${mesCapital} ${y}`,"","","","","","","","","Ganancia total",{f:`SUM(H${dataRow}:H${lastRow})`}]);
    rows.push(["Producto","Precio distribuidor","Precio comercio","Ganancia por unidad","Cantidad","Costo total","Venta total","Ganancia total","","Stock inicial","Stock actual"]);
    rows.push(["","","","","","","","","","",""]);

    productos.forEach((p, idx) => {
      const r = dataRow + idx;
      rows.push([
        p.nombre,
        costoDeProducto(p),
        p.precioVentaSinIVA,
        {f:`C${r}-B${r}`},
        cantidades[p.nombre] || 0,
        {f:`B${r}*E${r}`},
        {f:`C${r}*E${r}`},
        {f:`D${r}*E${r}`},
        "",
        "",
        p.stock
      ]);
    });

    rows.push(["TOTAL","","","",
      {f:`SUM(E${dataRow}:E${lastRow})`},
      {f:`SUM(F${dataRow}:F${lastRow})`},
      {f:`SUM(G${dataRow}:G${lastRow})`},
      {f:`SUM(H${dataRow}:H${lastRow})`},
      "","",""
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [28,16,14,16,10,14,14,14,4,12,12].map(w => ({wch:w}));
    XLSX.utils.book_append_sheet(wb, ws, `${marca} - ${mesCapital}`);
  });

  XLSX.writeFile(wb, `Ventas_${mesCapital}_${y}_Chaque.xlsx`);
}

function exportarExcelDia(fecha) {
  if (!window.XLSX) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => generarExcel(fecha);
    document.head.appendChild(s);
  } else {
    generarExcel(fecha);
  }
}

function generarExcel(fecha) {
  const pedidosDia = orders.filter(o => !o.borrador && !o.eliminado && o.fecha.startsWith(fecha));
  if (pedidosDia.length === 0) return alert("No hay ventas para esa fecha.");

  // Hoja 1: Detalle
  const detalle = [["Fecha","Cliente","Tipo","Producto","Marca","Cantidad","Precio s/IVA","Subtotal s/IVA"]];
  pedidosDia.forEach(o => {
    o.items.forEach(i => {
      detalle.push([o.fecha, o.client.nombre, o.client.tipo||"", i.nombre, i.categoria, i.cantidad, i.precioVentaSinIVA, i.subtotalSinIVA]);
    });
  });

  // Hoja 2: Resumen por producto
  const agg = {};
  pedidosDia.forEach(o => {
    o.items.forEach(i => {
      if (!agg[i.nombre]) agg[i.nombre] = { marca: i.categoria, cantidad: 0, total: 0 };
      agg[i.nombre].cantidad += i.cantidad;
      agg[i.nombre].total += i.subtotalSinIVA;
    });
  });
  const resumen = [["Producto","Marca","Unidades vendidas","Total s/IVA"]];
  Object.entries(agg).sort((a,b) => b[1].cantidad - a[1].cantidad)
    .forEach(([nombre, p]) => resumen.push([nombre, p.marca, p.cantidad, p.total]));
  const lastRow = resumen.length + 1;
  resumen.push(["TOTAL", "", `=SUM(C2:C${lastRow-1})`, `=SUM(D2:D${lastRow-1})`]);

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(resumen);
  const ws2 = XLSX.utils.aoa_to_sheet(detalle);
  ws1['!cols'] = [28,12,18,16].map(w => ({wch:w}));
  ws2['!cols'] = [18,20,12,28,12,10,16,16].map(w => ({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen del día");
  XLSX.utils.book_append_sheet(wb, ws2, "Detalle ventas");

  const [d,m,y] = fecha.split("/");
  XLSX.writeFile(wb, `Ventas_${d}-${m}-${y}_Distribuidora_Chaque.xlsx`);
}

// ── Indicador online/offline ──────────────────────────────────────────────
function initOfflineIndicator() {
  const bar = document.createElement("div");
  bar.id = "offline-bar";
  document.body.appendChild(bar);

  function actualizarEstado() {
    if (!navigator.onLine) {
      bar.textContent = "🔴 Sin conexión — los cambios se guardan en este dispositivo";
      bar.classList.remove("offline-bar-ok");
      bar.classList.add("offline-bar-visible");
    } else if (bar.classList.contains("offline-bar-visible")) {
      bar.textContent = "🟢 Conexión restaurada";
      bar.classList.add("offline-bar-ok");
      setTimeout(() => bar.classList.remove("offline-bar-visible", "offline-bar-ok"), 2500);
    }
  }

  window.addEventListener("online", actualizarEstado);
  window.addEventListener("offline", actualizarEstado);
  actualizarEstado();
}

// ── Bloqueo con huella / PIN ──────────────────────────────────────────────
// Se activa desde Backup y vale solo para ESTE dispositivo (no viaja a
// Google). La huella usa el sistema del propio celular (WebAuthn): la app
// nunca ve la huella, solo le pregunta al teléfono "¿es el dueño?". El PIN
// es de repuesto y se guarda como huella digital (hash), nunca el número.
// Se pide al abrir la app, o al volver a ella después de más de 5 minutos
// fuera.
const BLOQUEO_KEY = "alunexa_bloqueo_v1";
const BLOQUEO_ULTIMO_KEY = "alunexa_bloqueo_ultimo_v1";
const BLOQUEO_MINUTOS = 5;
let appBloqueada = false;
let pinIntentosFallidos = 0;
let pinEsperaHasta = 0;

function leerConfigBloqueo() {
  try { return JSON.parse(localStorage.getItem(BLOQUEO_KEY) || "null"); } catch { return null; }
}
function guardarConfigBloqueo(cfg) {
  if (cfg) localStorage.setItem(BLOQUEO_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(BLOQUEO_KEY);
}

function bytesABase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ABytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
async function hashPin(pin, salt) {
  const datos = new TextEncoder().encode(salt + ":" + pin);
  return bytesABase64(await crypto.subtle.digest("SHA-256", datos));
}

async function huellaDisponible() {
  try {
    return !!(window.PublicKeyCredential && navigator.credentials &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

async function registrarHuella() {
  const cfg = leerConfigBloqueo();
  if (!cfg) return;
  if (!(await huellaDisponible())) return alert("Este dispositivo no tiene huella disponible para la app. Vas a entrar con el PIN.");
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Distribuidora Chaque" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "Distribuidora Chaque", displayName: "Distribuidora Chaque" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000
    }});
    cfg.credId = bytesABase64(cred.rawId);
    guardarConfigBloqueo(cfg);
    alert("✅ Huella registrada. La próxima vez que abras la app te la va a pedir.");
  } catch (e) {
    console.log("No se pudo registrar la huella:", e);
    alert("No se pudo registrar la huella. Podés probar de nuevo más tarde; mientras tanto entrás con el PIN.");
  }
  if (vistaActual === "backup") renderVistaBackup();
}

async function activarBloqueo() {
  const pin = document.getElementById("bloqueoPin").value.trim();
  const pin2 = document.getElementById("bloqueoPin2").value.trim();
  if (!/^\d{4,6}$/.test(pin)) return alert("El PIN tiene que tener de 4 a 6 números.");
  if (pin !== pin2) return alert("Los dos PIN no coinciden.");
  const salt = bytesABase64(crypto.getRandomValues(new Uint8Array(16)));
  guardarConfigBloqueo({ activo: true, salt, pinHash: await hashPin(pin, salt), credId: null });
  marcarUltimaActividad();
  if (await huellaDisponible()) await registrarHuella();
  else alert("✅ Bloqueo activado con PIN. Este dispositivo no tiene huella disponible para la app.");
  renderVistaBackup();
}

async function pedirPinActual(mensaje) {
  const cfg = leerConfigBloqueo();
  const pin = prompt(mensaje);
  if (pin === null) return false;
  if ((await hashPin(pin.trim(), cfg.salt)) !== cfg.pinHash) { alert("PIN incorrecto."); return false; }
  return true;
}

async function desactivarBloqueo() {
  if (!(await pedirPinActual("Para desactivar el bloqueo, escribí tu PIN:"))) return;
  guardarConfigBloqueo(null);
  alert("Bloqueo desactivado en este dispositivo.");
  renderVistaBackup();
}

async function cambiarPinBloqueo() {
  if (!(await pedirPinActual("Escribí tu PIN actual:"))) return;
  const nuevo = prompt("PIN nuevo (de 4 a 6 números):");
  if (nuevo === null) return;
  if (!/^\d{4,6}$/.test(nuevo.trim())) return alert("El PIN tiene que tener de 4 a 6 números.");
  const cfg = leerConfigBloqueo();
  cfg.salt = bytesABase64(crypto.getRandomValues(new Uint8Array(16)));
  cfg.pinHash = await hashPin(nuevo.trim(), cfg.salt);
  guardarConfigBloqueo(cfg);
  alert("✅ PIN cambiado.");
}

function marcarUltimaActividad() {
  try { localStorage.setItem(BLOQUEO_ULTIMO_KEY, String(Date.now())); } catch {}
}

function debeBloquear() {
  const cfg = leerConfigBloqueo();
  if (!cfg || !cfg.activo) return false;
  const ultimo = Number(localStorage.getItem(BLOQUEO_ULTIMO_KEY) || 0);
  return Date.now() - ultimo > BLOQUEO_MINUTOS * 60000;
}

function mostrarPantallaBloqueo() {
  const cfg = leerConfigBloqueo();
  appBloqueada = true;
  const app = document.getElementById("app");
  if (app) app.style.visibility = "hidden";
  let pant = document.getElementById("pantallaBloqueo");
  if (!pant) {
    pant = document.createElement("div");
    pant.id = "pantallaBloqueo";
    document.body.appendChild(pant);
  }
  pant.style.cssText = "position:fixed; inset:0; z-index:99999; background:#f3f4f6; display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;";
  pant.innerHTML = `
    <div style="background:#fff; border-radius:16px; padding:28px 20px; width:100%; max-width:340px; text-align:center; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <div style="font-size:44px;">🔒</div>
      <h2 style="margin:8px 0 4px; font-size:20px;">Distribuidora Chaque</h2>
      <p style="margin:0 0 18px; color:#6b7280; font-size:14px;">La app está bloqueada</p>
      ${cfg.credId ? `<button onclick="desbloquearConHuella()" style="width:100%; padding:14px; font-size:16px; border:none; border-radius:10px; background:#2563eb; color:#fff; margin-bottom:14px;">👆 Entrar con huella</button>` : ""}
      <input id="bloqueoPinEntrada" type="password" inputmode="numeric" maxlength="6" placeholder="PIN" autocomplete="off"
        onkeydown="if(event.key==='Enter') desbloquearConPin()"
        style="width:100%; box-sizing:border-box; padding:12px; font-size:20px; letter-spacing:6px; text-align:center; border:1.5px solid #d1d5db; border-radius:10px; margin-bottom:8px;" />
      <button onclick="desbloquearConPin()" style="width:100%; padding:12px; font-size:15px; border:1.5px solid #2563eb; border-radius:10px; background:#fff; color:#2563eb;">Entrar con PIN</button>
      <p id="bloqueoMensaje" style="margin:10px 0 0; color:#dc2626; font-size:13px; min-height:18px;"></p>
    </div>`;
  // Al aparecer, intenta la huella sola. Algunos celulares (iPhone) solo la
  // permiten después de tocar un botón: si este intento automático falla, no
  // se muestra error, queda el botón "Entrar con huella".
  if (cfg.credId) setTimeout(() => desbloquearConHuella(true), 300);
}

function desbloquear() {
  appBloqueada = false;
  pinIntentosFallidos = 0;
  marcarUltimaActividad();
  const pant = document.getElementById("pantallaBloqueo");
  if (pant) pant.remove();
  const app = document.getElementById("app");
  if (app) app.style.visibility = "";
}

let huellaEnCurso = false;
async function desbloquearConHuella(automatico) {
  const cfg = leerConfigBloqueo();
  if (!cfg || !cfg.credId || huellaEnCurso) return;
  huellaEnCurso = true;
  try {
    const resp = await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: base64ABytes(cfg.credId) }],
      userVerification: "required",
      timeout: 60000
    }});
    // Byte 32 del authenticatorData: el bit 0x04 confirma que el teléfono
    // verificó al dueño (huella / cara / bloqueo de pantalla).
    const flags = new Uint8Array(resp.response.authenticatorData)[32];
    if (flags & 0x04) desbloquear();
    else throw new Error("sin verificación del usuario");
  } catch (e) {
    console.log("Huella no verificada:", e);
    const msg = document.getElementById("bloqueoMensaje");
    if (msg && automatico !== true) msg.textContent = "No se pudo leer la huella. Tocá el botón para probar de nuevo o usá el PIN.";
  } finally {
    huellaEnCurso = false;
  }
}

async function desbloquearConPin() {
  const cfg = leerConfigBloqueo();
  const input = document.getElementById("bloqueoPinEntrada");
  const msg = document.getElementById("bloqueoMensaje");
  if (!cfg || !input) return;
  if (Date.now() < pinEsperaHasta) {
    if (msg) msg.textContent = `Demasiados intentos. Esperá ${Math.ceil((pinEsperaHasta - Date.now()) / 1000)} segundos.`;
    return;
  }
  if ((await hashPin(input.value.trim(), cfg.salt)) === cfg.pinHash) return desbloquear();
  pinIntentosFallidos++;
  input.value = "";
  if (pinIntentosFallidos >= 5) {
    pinEsperaHasta = Date.now() + 30000;
    pinIntentosFallidos = 0;
    if (msg) msg.textContent = "Demasiados intentos. Esperá 30 segundos.";
  } else if (msg) msg.textContent = "PIN incorrecto.";
}

function renderCardBloqueo() {
  const cfg = leerConfigBloqueo();
  const estiloInput = "width:100%; box-sizing:border-box; border:1.5px solid #d1d5db; border-radius:8px; padding:10px; font-size:18px; letter-spacing:4px; text-align:center; margin-bottom:8px;";
  if (!cfg || !cfg.activo) {
    return `
    <div class="form-card">
      <h3 class="section-title">🔒 Bloquear la app</h3>
      <p class="muted" style="margin:0 0 10px;">Pide tu huella (o un PIN) para abrir la app, o al volver después de más de ${BLOQUEO_MINUTOS} minutos. Vale solo para este dispositivo.</p>
      <input id="bloqueoPin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN de repuesto (4 a 6 números)" autocomplete="new-password" style="${estiloInput}" />
      <input id="bloqueoPin2" type="password" inputmode="numeric" maxlength="6" placeholder="Repetí el PIN" autocomplete="new-password" style="${estiloInput}" />
      <button class="btn-primary btn-full" onclick="activarBloqueo()">🔒 Activar bloqueo</button>
    </div>`;
  }
  return `
    <div class="form-card">
      <h3 class="section-title">🔒 Bloqueo activado</h3>
      <p class="muted" style="margin:0 0 10px;">${cfg.credId ? "👆 Con huella y PIN de repuesto." : "Solo con PIN (sin huella registrada)."} Se pide al abrir la app o al volver después de más de ${BLOQUEO_MINUTOS} minutos.</p>
      <div class="actions-col">
        ${cfg.credId ? "" : `<button class="btn-primary btn-full" onclick="registrarHuella()">👆 Registrar huella</button>`}
        <button class="btn-secondary btn-full" onclick="cambiarPinBloqueo()">🔑 Cambiar PIN</button>
        <button class="btn-gray btn-full" onclick="desactivarBloqueo()">🔓 Desactivar bloqueo</button>
      </div>
    </div>`;
}

function initBloqueo() {
  if (debeBloquear()) mostrarPantallaBloqueo();
  else if (leerConfigBloqueo()) marcarUltimaActividad();
  document.addEventListener("visibilitychange", () => {
    if (!leerConfigBloqueo()) return;
    if (document.visibilityState === "hidden") {
      if (!appBloqueada) marcarUltimaActividad();
    } else if (!appBloqueada && debeBloquear()) {
      mostrarPantallaBloqueo();
    }
  });
  // Mientras la usás, se va anotando que está activa (por si el celu cierra
  // la app de golpe sin avisar).
  setInterval(() => {
    if (!appBloqueada && document.visibilityState === "visible" && leerConfigBloqueo()) marcarUltimaActividad();
  }, 30000);
}

// ═══════════════════════════════════════════════════════════════
initBloqueo();
initOfflineIndicator();
cargarDatos();