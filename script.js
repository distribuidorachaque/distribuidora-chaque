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
const HORARIOS_CLIENTE = ["Mañana", "Tarde", "Todo el día"];

function generarId() {
  return "id-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
}

// ── Catálogo por defecto ─────────────────────────────────────────────────────
const defaultCatalog = [
  { id: generarId(), nombre: "Bisglicinato de Magnesio", categoria: "Alunexa", precioVentaSinIVA: 10315, stock: 0 },
  { id: generarId(), nombre: "Citrato de Magnesio", categoria: "Alunexa", precioVentaSinIVA: 9590, stock: 0 },
  { id: generarId(), nombre: "Multimagnesio", categoria: "Alunexa", precioVentaSinIVA: 9150, stock: 0 },
  { id: generarId(), nombre: "Magnesio", categoria: "Alunexa", precioVentaSinIVA: 7215, stock: 0 },
  { id: generarId(), nombre: "Calcio, Magnesio y Vitamina D3", categoria: "Alunexa", precioVentaSinIVA: 7800, stock: 0 },
  { id: generarId(), nombre: "Vitamina C, Zinc y Vitamina D", categoria: "Alunexa", precioVentaSinIVA: 8970, stock: 0 },
  { id: generarId(), nombre: "Vitamina B12", categoria: "Alunexa", precioVentaSinIVA: 8000, stock: 0 },
  { id: generarId(), nombre: "Colágeno Hidrolizado", categoria: "Alunexa", precioVentaSinIVA: 8850, stock: 0 },
  { id: generarId(), nombre: "Resveratrol", categoria: "Alunexa", precioVentaSinIVA: 11375, stock: 0 },
  { id: generarId(), nombre: "Cardo Mariano", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0 },
  { id: generarId(), nombre: "Tremella", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0 },
  { id: generarId(), nombre: "Ashwagandha", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0 },
  { id: generarId(), nombre: "Cordyceps", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0 },
  { id: generarId(), nombre: "Melena de León", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0 },
  { id: generarId(), nombre: "Reishi", categoria: "Fungimania", precioVentaSinIVA: 14500, stock: 0 },
  { id: generarId(), nombre: "Almendra", categoria: "Vita", precioVentaSinIVA: 15000, stock: 0 },
  { id: generarId(), nombre: "Chocolate", categoria: "Vita", precioVentaSinIVA: 15000, stock: 0 },
  { id: generarId(), nombre: "Proteína", categoria: "Vita", precioVentaSinIVA: 17250, stock: 0 },
  { id: generarId(), nombre: "Bites", categoria: "Vita", precioVentaSinIVA: 3150, stock: 0 }
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
let marcasListaPrecios = new Set();

// ── Almacenamiento ───────────────────────────────────────────────────────────
function guardarLocal() {
  localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients));
  localStorage.setItem(STORAGE_KEYS.catalog, JSON.stringify(catalog));
  localStorage.setItem(STORAGE_KEYS.orders,  JSON.stringify(orders));
  localStorage.setItem(STORAGE_KEYS.inversiones, JSON.stringify(inversiones));
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
async function guardarEnDriveConVerificacion(onProgreso) {
  if (syncEnCurso) {
    // Ya hay otro guardado/sincronización en curso: esperamos un poco y
    // probamos de nuevo en vez de pisarlo.
    await new Promise(r => setTimeout(r, 800));
    return guardarEnDriveConVerificacion(onProgreso);
  }

  syncEnCurso = true;
  try {
    // Antes de guardar: traemos lo último de Drive y lo fusionamos con lo
    // local. El backend de Apps Script REEMPLAZA toda la hoja con lo que se
    // le manda — no fusiona solo. Si no hacemos este paso, un guardado desde
    // un dispositivo con datos un poco viejos puede borrar cambios más
    // nuevos hechos en otro dispositivo (ej: un pago confirmado en el celu).
    try {
      const [rC0, rCat0, rP0, rI0] = await Promise.all([
        fetch(API_URL + "?tipo=clientes"),
        fetch(API_URL + "?tipo=catalogo"),
        fetch(API_URL + "?tipo=pedidos"),
        fetch(API_URL + "?tipo=inversiones")
      ]);
      const [dC0, dCat0, dP0, dI0] = await Promise.all([rC0.json(), rCat0.json(), rP0.json(), rI0.json()]);
      if (dC0.length > 0)   clients = fusionarPorId(clients, dC0.map(r => JSON.parse(r[0])));
      if (dCat0.length > 0) catalog = fusionarCatalogoPorNombre(catalog, dCat0.map(r => JSON.parse(r[0])));
      if (dP0.length > 0)   orders  = fusionarPorId(orders, dP0.map(r => JSON.parse(r[0])));
      if (dI0.length > 0)   inversiones = fusionarPorId(inversiones, dI0.map(r => JSON.parse(r[0])));
      guardarLocal();
    } catch (e) {
      console.log("No se pudo repasar con Drive antes de guardar, sigue con lo local:", e);
    }

    const maxIntentos = 3;

    for (let intento = 1; intento <= maxIntentos; intento++) {
      if (onProgreso) onProgreso(intento, maxIntentos);

      try {
        await Promise.all([
          fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "clientes", payload: clients }) }),
          fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "catalogo", payload: catalog }) }),
          fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "pedidos",  payload: orders  }) }),
          fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "inversiones", payload: inversiones }) })
        ]);

        await new Promise(r => setTimeout(r, 1500 + intento * 1000)); // más margen en cada reintento

        const [rC, rCat, rP, rI] = await Promise.all([
          fetch(API_URL + "?tipo=clientes"),
          fetch(API_URL + "?tipo=catalogo"),
          fetch(API_URL + "?tipo=pedidos"),
          fetch(API_URL + "?tipo=inversiones")
        ]);
        const [dC, dCat, dP, dI] = await Promise.all([rC.json(), rCat.json(), rP.json(), rI.json()]);

        if (dC.length >= clients.length && dCat.length >= catalog.length && dP.length >= orders.length && dI.length >= inversiones.length) {
          return true;
        }
      } catch (e) {
        console.log(`Intento ${intento} de guardado falló:`, e);
      }
    }
    return false;
  } finally {
    syncEnCurso = false;
  }
}

async function guardarStorage() {
  guardarLocal();
  const ok = await guardarEnDriveConVerificacion();
  if (!ok) {
    alert("⚠️ No se pudo confirmar el guardado en Google Drive después de varios intentos. No perdiste nada — está guardado en este dispositivo. Tocá '☁️ Guardar ahora' más tarde con buena conexión.");
  }
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
      fetch(API_URL + "?tipo=clientes"),
      fetch(API_URL + "?tipo=catalogo"),
      fetch(API_URL + "?tipo=pedidos"),
      fetch(API_URL + "?tipo=inversiones")
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
      if (btn) { btn.textContent = "☁️ Guardar ahora"; btn.style.background = ""; btn.disabled = false; }
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
      fetch(API_URL + "?tipo=clientes"),
      fetch(API_URL + "?tipo=catalogo"),
      fetch(API_URL + "?tipo=pedidos"),
      fetch(API_URL + "?tipo=inversiones")
    ]);
    const [dC, dCat, dP, dI] = await Promise.all([rC.json(), rCat.json(), rP.json(), rI.json()]);

    const antesC = clients.length, antesCat = catalog.length, antesP = orders.length, antesI = inversiones.length;

    if (dC.length > 0) clients = fusionarPorId(clients, dC.map(r => JSON.parse(r[0])));
    if (dCat.length > 0) catalog = fusionarCatalogoPorNombre(catalog, dCat.map(r => JSON.parse(r[0])));
    if (dP.length > 0) orders = fusionarPorId(orders, dP.map(r => JSON.parse(r[0])));
    if (dI.length > 0) inversiones = fusionarPorId(inversiones, dI.map(r => JSON.parse(r[0])));

    necesitaPush = clients.length > antesC || catalog.length > antesCat || orders.length > antesP || inversiones.length > antesI;

    guardarLocal();
    renderApp();
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
    if (btn) { btn.textContent = "☁️ Guardar ahora"; btn.style.background = ""; btn.disabled = false; }
  }, 2500);
}

async function cargarDatos() {
  syncEnCurso = true;
  sincronizarConfigVehiculo();
  let dC = [], dCat = [], dP = [], dI = [];
  try {
    const [rC, rCat, rP, rI] = await Promise.all([
      fetch(API_URL + "?tipo=clientes"),
      fetch(API_URL + "?tipo=catalogo"),
      fetch(API_URL + "?tipo=pedidos"),
      fetch(API_URL + "?tipo=inversiones")
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
  renderApp();
  syncEnCurso = false;

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
function parseNumber(v) {
  const n = Number(String(v || "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function priceWithIVA(p) { return Number(p || 0) * (1 + IVA_RATE); }

// ── Navegación ───────────────────────────────────────────────────────────────
function setVista(vista, clienteId) {
  vistaActual = vista;
  if (clienteId !== undefined) clienteActivoId = clienteId;
  cerrarModal();
  cerrarModalConfirmar();
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Modal cliente ────────────────────────────────────────────────────────────
function abrirModalCliente(id) {
  clienteActivoId = id;
  const client = clients.find(c => c.id === id);
  if (!client) return;

  document.getElementById("modalClienteNombre").textContent = client.nombre;
  document.getElementById("modalClienteInfo").textContent =
    [client.tipo || "Otro", client.horario ? "🕐 " + client.horario : "", Number(client.frecuencia) === 14 ? "📅 Quincenal" : "📅 Semanal", client.telefono, client.direccion].filter(Boolean).join(" · ");

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
  const horario    = document.getElementById("formClienteHorario")?.value || "";
  const frecuencia = Number(document.getElementById("formClienteFrecuencia")?.value) || 7;
  const telefono   = document.getElementById("formClienteTelefono").value.trim();
  const email      = document.getElementById("formClienteEmail").value.trim();
  const direccion  = document.getElementById("formClienteDireccion").value.trim();
  const potencial  = document.getElementById("formClientePotencial").checked;
  const seguimiento = document.getElementById("formClienteSeguimiento")?.value || "";
  const latVal = document.getElementById("formClienteLat")?.value;
  const lngVal = document.getElementById("formClienteLng")?.value;
  const lat = latVal ? parseFloat(latVal) : null;
  const lng = lngVal ? parseFloat(lngVal) : null;

  if (!nombre) return alert("Escribí el nombre del cliente");
  if (!tipo) return alert("Elegí un tipo de comercio");

  if (editandoClienteId) {
    const c = clients.find(c => c.id === editandoClienteId);
    if (c) Object.assign(c, { nombre, tipo, diaVisita, horario, frecuencia, telefono, email, direccion, potencial, seguimiento, lat, lng, actualizadoEn: Date.now() });
  } else {
    clients.unshift({ id: generarId(), nombre, tipo, diaVisita, horario, frecuencia, telefono, email, direccion, notas: "", potencial, seguimiento, lat, lng, actualizadoEn: Date.now() });
  }

  guardarStorage();
  editandoClienteId = null;
  setVista("clientes");
}

// ── Catálogo ──────────────────────────────────────────────────────────────────
function obtenerCategorias() {
  const cats = [...new Set(catalog.map(p => p.categoria || "Sin categoría"))];
  return ["Todas", ...cats.sort((a, b) => a.localeCompare(b))];
}

function obtenerCatalogoFiltrado() {
  if (filtroCategoria === "Todas") return catalog;
  return catalog.filter(p => (p.categoria || "Sin categoría") === filtroCategoria);
}

function renderSelectProductos() {
  const s = document.getElementById("productoSelect");
  if (!s) return;
  const prods = obtenerCatalogoFiltrado();
  s.innerHTML = `<option value="">Seleccionar producto</option>` +
    prods.map(p => {
      const aviso = p.stock === 0 ? " ⛔" : (p.stock <= STOCK_BAJO_UMBRAL ? " ⚠️" : "");
      return `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})${aviso}</option>`;
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

function autocompletarProducto() {
  const prod = catalog.find(p => p.id === document.getElementById("productoSelect").value);
  if (!prod) return;
  document.getElementById("precioVenta").value = prod.precioVentaSinIVA;
  const cantInput = document.getElementById("cantidad");
  if (cantInput) cantInput.value = "";
  const info = document.getElementById("infoPrecioProducto");
  const claseHint = prod.stock === 0 ? 'hint-agotado' : (prod.stock <= STOCK_BAJO_UMBRAL ? 'hint-bajo' : '');
  if (info) info.innerHTML = `
    <span class="price-hint">s/IVA: ${formatCurrency(prod.precioVentaSinIVA)}</span>
    <span class="price-hint">c/IVA: ${formatCurrency(priceWithIVA(prod.precioVentaSinIVA))}</span>
    <span class="price-hint stock-hint ${claseHint}">Stock: ${prod.stock}${prod.stock > 0 && prod.stock <= STOCK_BAJO_UMBRAL ? ' ⚠️' : ''}</span>
    ${IMAGENES_PRODUCTO[prod.nombre] ? `<button type="button" class="price-hint" style="border:none; cursor:pointer;" onclick="mostrarImagenProducto('${prod.nombre}')">📷 Ver imagen</button>` : ''}
  `;
}

function cambiarFiltroCategoria() {
  filtroCategoria = document.getElementById("filtroCategoria").value;
  renderVistaPedido();
}

// ── Items del pedido ──────────────────────────────────────────────────────────
function getDisponibleParaAgregar(productId) {
  const prod = catalog.find(p => p.id === productId);
  if (!prod) return 0;
  const usado = currentItems.filter(i => i.productId === productId).reduce((a, i) => a + i.cantidad, 0);
  return prod.stock - usado;
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

  currentItems.push({
    id: generarId(), productId: prod.id, nombre: prod.nombre, categoria: prod.categoria,
    cantidad, precioVentaSinIVA: pSin, precioVentaConIVA: pCon,
    subtotalSinIVA: cantidad * pSin, subtotalConIVA: cantidad * pCon
  });

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
  aplicarStock(order.items, +1);
  editingOrderId  = id;
  currentItems    = order.items.map(i => ({ ...i }));
  clienteActivoId = order.client.id;
  setVista("pedido");
}

function guardarCambiosPedido() {
  if (!editingOrderId) return;
  const client = clients.find(c => c.id === clienteActivoId);
  if (!client) return alert("No hay cliente seleccionado");
  if (currentItems.length === 0) return alert("Agregá al menos un producto");

  const idx = orders.findIndex(o => o.id === editingOrderId);
  if (idx === -1) return;

  aplicarStock(currentItems, -1);
  const tSin  = currentItems.reduce((a, i) => a + i.subtotalSinIVA, 0);
  const tCon  = currentItems.reduce((a, i) => a + i.subtotalConIVA, 0);
  const tCant = currentItems.reduce((a, i) => a + i.cantidad, 0);

  orders[idx] = {
    ...orders[idx], client, items: [...currentItems],
    notas: document.getElementById("notasPedido").value.trim(),
    modoPrecio: document.getElementById("modoPrecio").value,
    totals: { totalSinIVA: tSin, totalConIVA: tCon, totalCantidad: tCant }
  };

  guardarStorage();
  currentItems   = [];
  editingOrderId = null;
  setVista("historial");
}

function cancelarEdicionPedido() {
  if (editingOrderId) {
    const order = orders.find(o => o.id === editingOrderId);
    if (order) aplicarStock(order.items, -1);
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

function calcularGananciaPedidos(lista) {
  let ganancia = 0;
  lista.forEach(o => {
    o.items.forEach(i => {
      const costo = PRECIOS_DISTRIBUIDOR[i.nombre] || 0;
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

function toggleGastosExtra() {
  gastosExtraAbierto = !gastosExtraAbierto;
  renderVistaResumen();
}

function guardarConfigVehiculo() {
  configVehiculo = {
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
  localStorage.setItem("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
  // La mandamos a Drive para que se vea igual en todos tus dispositivos
  fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ tipo: "vehiculo", payload: [configVehiculo] }) });
  renderVistaResumen();
}// Si hay una versión más nueva de la config del vehículo guardada en Drive
// (por ejemplo, la cargaste desde el celu), la trae y la usa acá también.
async function sincronizarConfigVehiculo() {
  try {
    const r = await fetch(API_URL + "?tipo=vehiculo");
    const filas = await r.json();
    if (filas.length === 0) return;
    const remoto = JSON.parse(filas[0][0]);
    if ((remoto.actualizadoEn || 0) > (configVehiculo.actualizadoEn || 0)) {
      configVehiculo = remoto;
      localStorage.setItem("alunexa_config_vehiculo_v1", JSON.stringify(configVehiculo));
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
  a.download = `Cierre_${String(mesActual).padStart(2,"0")}-${anioActual}_Alunexa.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}


function calcularTopClientes(limite) {

  const porCliente = {};
  orders.forEach(o => {
    if (o.borrador || o.eliminado) return;
    const id = o.client.id;
    if (!porCliente[id]) porCliente[id] = { nombre: o.client.nombre, total: 0, pedidos: 0 };
    porCliente[id].total += o.totals.totalSinIVA;
    porCliente[id].pedidos += 1;
  });
  return Object.values(porCliente)
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
  if (input) input.value = calcularSaldo(order);
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
  if (order) {
    aplicarStock(order.items, +1);
    order.eliminado = true;
    order.actualizadoEn = Date.now();
  }
  guardarStorage();
  renderVistaHistorial();
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
function construirMensajeWhatsApp(order, modo) {
  let msg = `Hola ${order.client.nombre} 👋\nTe paso el detalle de tu pedido:\n\n`;
  order.items.forEach(i => {
    const precioUnit = modo === "con" ? i.precioVentaConIVA : i.precioVentaSinIVA;
    const subtotal   = modo === "con" ? i.subtotalConIVA    : i.subtotalSinIVA;
    const esBlister12 = BLISTER_12.includes(i.nombre) && i.categoria === "Vita";
    const xUnidad = esBlister12 ? ` (${formatCurrency(precioUnit / 12)} c/u)` : "";
    msg += `▪️ ${i.nombre}\n   ${i.cantidad} u x ${formatCurrency(precioUnit)}${xUnidad} = ${formatCurrency(subtotal)}\n`;
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

// ── Confirmación de pago por WhatsApp ──────────────────────────────────────
function enviarConfirmacionPago(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;
  if (!order.pagos || order.pagos.length === 0) return alert("Este pedido todavía no tiene ningún pago registrado.");

  const ultimoPago = order.pagos[order.pagos.length - 1];
  const saldo = calcularSaldo(order);
  const nombre = order.client.nombre;

  const msg = saldo <= 0
    ? `Hola ${nombre} 👋\n\nConfirmo que recibí tu pago de *${formatCurrency(ultimoPago.monto)}*. Tu cuenta quedó al día. ¡Gracias! 🙌`
    : `Hola ${nombre} 👋\n\nRecibí tu pago de *${formatCurrency(ultimoPago.monto)}*. Tu saldo pendiente actual es *${formatCurrency(saldo)}*. ¡Gracias!`;

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
  let texto = "";
  texto += "DISTRIBUIDORA CHAQUE\n";
  texto += "--------------------------------\n";
  texto += `Cliente: ${order.client.nombre}\n`;
  texto += `Fecha: ${order.fecha}\n`;
  texto += "--------------------------------\n";

  order.items.forEach(i => {
    const precio = modo === "con" ? i.precioVentaConIVA : i.precioVentaSinIVA;
    const subtotal = modo === "con" ? i.subtotalConIVA : i.subtotalSinIVA;
    texto += `${i.cantidad} x ${i.nombre}\n`;
    texto += `   ${formatCurrency(precio)} c/u = ${formatCurrency(subtotal)}\n`;
  });

  texto += "--------------------------------\n";
  const total = modo === "con" ? order.totals.totalConIVA : order.totals.totalSinIVA;
  texto += `TOTAL: ${formatCurrency(total)}\n`;
  if (order.notas) texto += `\nNotas: ${order.notas}\n`;
  texto += "\n¡Gracias por su compra!\n\n\n";

  const textoCodificado = encodeURI(texto);
  window.location.href = "intent:" + textoCodificado + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
}

function toggleFormPrecio(id) {
  const form = document.getElementById("form-precio-" + id);
  if (!form) return;
  form.style.display = form.style.display === "none" ? "block" : "none";
}

function guardarPrecio(id) {
  const prod = catalog.find(p => p.id === id);
  if (!prod) return;
  const nuevo = parseNumber(document.getElementById("input-precio-" + id).value);
  if (!nuevo || nuevo <= 0) return alert("Ingresá un precio válido");
  prod.precioVentaSinIVA = nuevo;
  prod.actualizadoEn = Date.now();
  guardarStorage();
  renderVistaStock();
}

// ── Stock ─────────────────────────────────────────────────────────────────────
function cargarStock() {
  const id   = document.getElementById("stockProductoSelect").value;
  const cant = Math.max(0, Number(document.getElementById("stockAgregar").value || 0));
  const prod = catalog.find(p => p.id === id);
  if (!prod) return alert("Seleccioná un producto");
  if (cant <= 0) return alert("Ingresá una cantidad mayor a 0");
  prod.stock += cant;
  prod.actualizadoEn = Date.now();
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
  guardarStorage();
  document.getElementById("stockAgregar").value = 0;
  renderVistaStock();
}

// ── Backup ────────────────────────────────────────────────────────────────────
function exportarDatos() {
  const blob = new Blob([JSON.stringify({ fecha: new Date().toISOString(), clients, catalog, orders }, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "backup-pedidos-alunexa.json"; a.click();
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
          <button class="modal-btn modal-btn-danger" onclick="confirmarEliminarCliente()">
            <span class="modal-icon">🗑️</span>
            <span>Eliminar</span>
          </button>
        </div>
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
function cuentaInactividad(c) {
  return c && !c.potencial && (c.tipo || "Otro") !== "Otro";
}

function contarClientesInactivos() {
  return clients.filter(c => {
    if (c.eliminado || !cuentaInactividad(c)) return false;
    const dias = diasSinComprar(c.id);
    return dias !== null && dias >= umbralInactividad(c);
  }).length;
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
        <button id="btnGuardarAhora" class="tipo-tab" onclick="guardarAhora()">☁️ Guardar</button>
        <button class="tipo-tab" onclick="forzarRecargaDrive()" title="Recargar desde Google Drive">🔄 Recargar</button>
      </div>
    </div>

    ${contarClientesInactivos() > 0 ? `
    <div class="form-card" style="cursor:pointer; border-left:4px solid #dc2626;" onclick="setVista('inactivos')">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>⏰ ${contarClientesInactivos()} cliente${contarClientesInactivos() > 1 ? "s" : ""} sin comprarte hace ${DIAS_INACTIVIDAD_UMBRAL}+ días</strong>
          <div class="muted" style="font-size:13px;">Tocá para ver la lista</div>
        </div>
        <span>›</span>
      </div>
    </div>` : ""}

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

    <div class="client-list">
      ${lista.length === 0
        ? `<div class="empty-state">No hay clientes en esta categoría.<br>Tocá <strong>+ Nuevo</strong> para agregar uno.</div>`
        : lista.map(c => {
            const pedidosCliente = orders.filter(o => o.client.id === c.id && !o.eliminado).length;
            const tieneDeuda = clienteTieneDeuda(c.id);
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
                    ${tieneDeuda ? ` <span class="badge-deuda">💰 ${formatCurrency(montoDeuda)}</span>` : ''}
                   ${sinComprar && !c.potencial ? ` <span class="badge-sin-comprar">⏰ ${dias}d</span>` : ''}
                    ${badgeSeguimiento}
                  </div>
                  <div class="client-sub">${c.tipo || "Otro"}${c.horario ? " · 🕐 " + c.horario : ""}${c.telefono ? " · " + c.telefono : ""}${pedidosCliente > 0 ? " · " + pedidosCliente + " pedido" + (pedidosCliente > 1 ? "s" : "") : ""}${c.potencial ? " · Potencial" : ""}</div>
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
function renderVistaInactivos() {
  const cont = document.getElementById("vista-contenido");
  if (!cont) return;

  const inactivos = clients
    .filter(c => !c.eliminado && cuentaInactividad(c))
    .map(c => ({ ...c, dias: diasSinComprar(c.id) }))
    .filter(c => c.dias !== null && c.dias >= umbralInactividad(c))
    .sort((a, b) => b.dias - a.dias);

  cont.innerHTML = `
    <div class="page-header">
      <button class="btn-back" onclick="setVista('clientes')">← Volver</button>
      <h2 class="page-title2">⏰ Clientes inactivos</h2>
    </div>

    ${inactivos.length === 0
      ? `<div class="empty-state">🎉 No tenés clientes que hayan pasado su frecuencia de visita sin comprarte.</div>`
      : `
        <p class="muted" style="margin:0 0 10px;">${inactivos.length} cliente${inactivos.length > 1 ? "s" : ""} pasaron su frecuencia de visita (7 o 14 días) sin comprarte, ordenados de más a menos tiempo.</p>
        ${inactivos.map(c => `
          <div class="client-item" onclick="abrirModalCliente('${c.id}')">
            <div class="client-tipo-dot tipo-${(c.tipo || 'Otro').toLowerCase().replace('é','e').replace('ú','u')}"></div>
            <div class="client-info">
              <div class="client-name">
                ${c.nombre}
                <span class="badge-sin-comprar">⏰ ${c.dias}d</span>
              </div>
              <div class="client-sub">${c.tipo || "Otro"}${c.horario ? " · 🕐 " + c.horario : ""}${c.telefono ? " · " + c.telefono : ""}</div>
            </div>
            ${c.telefono ? `<button class="btn-recordatorio" onclick="event.stopPropagation(); abrirWhatsAppCliente('${c.id}')" title="Escribirle por WhatsApp">💬</button>` : ''}
            <span class="client-arrow">›</span>
          </div>
        `).join("")}
      `
    }
  `;
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
          <option value="7" ${!c || Number(c.frecuencia) !== 14 ? "selected" : ""}>Semanal (cada 7 días)</option>
          <option value="14" ${c && Number(c.frecuencia) === 14 ? "selected" : ""}>Quincenal (cada 14 días)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Teléfono</label>
        <input id="formClienteTelefono" placeholder="Ej: 3415001234" value="${c ? c.telefono || "" : ""}" />
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

      <div class="row-2">
        <div class="form-group">
          <label>Cantidad</label>
          <input id="cantidad" type="number" min="0" placeholder="Cant." />
        </div>
        <div class="form-group">
          <label>Precio sin IVA</label>
          <input id="precioVenta" oninput="aplicarDescuento()" />
        </div>
      </div>

      ${filtroCategoria === "Vita" ? `
      <div class="descuento-box">
        <label>🏷️ Descuento Vita (%)</label>
        <div class="row-2" style="margin-top:6px;">
          <input id="descuentoPct" type="number" min="0" max="100" placeholder="Ej: 10" oninput="aplicarDescuento()" />
          <div id="precioConDescuento" class="precio-descuento-resultado"></div>
        </div>
      </div>` : ""}

      <button class="btn-primary btn-full" onclick="agregarItem()">+ Agregar al pedido</button>

      <div class="borrador-switch">
        <label class="switch-label">
          <input type="checkbox" id="switchBorrador" onchange="toggleModoBorrador()" ${modoBorrador ? 'checked' : ''} />
          <span>📋 Ignorar stock (modo borrador)</span>
        </label>
        <div id="avisoBorrador" class="aviso-borrador" style="display:${modoBorrador ? 'block' : 'none'}">
          ⚠️ No va a descontar stock. Usá este modo para anotar pedidos futuros.
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
          ? `<button class="btn-success btn-full" onclick="guardarCambiosPedido()">💾 Guardar cambios</button>`
          : `<button class="btn-success btn-full" onclick="guardarPedido()">💾 Guardar pedido</button>`
        }
        <button class="btn-whatsapp btn-full" onclick="enviarWhatsAppPedidoActual()">📱 Enviar por WhatsApp</button>
        <button class="btn-pdf btn-full" onclick="generarPDFPedidoActual()">📄 Descargar PDF</button>
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

    ${lista.length === 0
      ? `<div class="empty-state">No hay pedidos ${client ? "para este cliente" : "guardados"} aún.</div>`
      : lista.map(order => {
          const saldo = calcularSaldo(order);
          const totalPagado = (order.pagos || []).reduce((a, p) => a + p.monto, 0);
          const formAbierto = ordenConFormPago === order.id;
          return `
          <div class="order-card ${order.pagado ? 'order-pagada' : 'order-pendiente'}">
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
                  <input id="inputMontoPago-${order.id}" type="number" placeholder="Monto recibido" />
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
              <button class="btn-sm btn-outline" onclick="editarPedido('${order.id}')">✏️ Editar</button>
              <button class="btn-sm btn-outline" onclick="enviarWhatsAppPedidoGuardado('${order.id}')">📱 WA</button>
              <button class="btn-sm btn-outline" onclick="generarPDFPedidoGuardado('${order.id}')">📄 PDF</button>
              <button class="btn-sm btn-outline" onclick="imprimirRemito('${order.id}')">🖨️ Remito</button>
              <button class="btn-sm btn-danger" onclick="eliminarPedido('${order.id}')">🗑️</button>
            </div>
          </div>`;
        }).join("")}
  `;
}

// ── Vista: DEUDORES ───────────────────────────────────────────────────────────
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
          <div class="client-item" onclick="abrirModalCliente('${c.id}')">
            <div class="client-tipo-dot tipo-${(c.tipo||'Otro').toLowerCase().replace('é','e').replace('ú','u')}"></div>
            <div class="client-info">
              <div class="client-name">${c.nombre} ${badgeRecordatorio}</div>
              <div class="client-sub">${c.tipo || 'Otro'}</div>
              <div id="form-recordatorio-${c.id}" style="display:none; margin-top:8px;" onclick="event.stopPropagation()">
                <div class="row-2">
                  <input type="date" id="input-recordatorio-${c.id}" value="${c.recordatorioPago || ''}" />
                  <button class="btn-success" onclick="guardarRecordatorioPago('${c.id}')">Guardar</button>
                </div>
              </div>
            </div>
            <strong style="color:#dc2626;">${formatCurrency(c.deuda)}</strong>
            <button class="btn-recordatorio" onclick="event.stopPropagation(); toggleFormRecordatorio('${c.id}')" title="Poner fecha para recordar cobrar">📅</button>
            <button class="btn-recordatorio" onclick="event.stopPropagation(); enviarRecordatorioPago('${c.id}')" title="Mandar recordatorio de pago por WhatsApp">💬</button>
          </div>
        `;
        }).join("")}
      `
    }
  `;
}

// ── Vista: RESUMEN ────────────────────────────────────────────────────────────
let fechaResumen = fechaHoyLocal();
let mesResumen = claveMesActual();

function cambiarFechaResumen() {
  const input = document.getElementById("inputFechaResumen");
  if (input) fechaResumen = input.value;
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

  const totalDeuda = clients.reduce((a, c) => a + deudaTotalCliente(c.id), 0);
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
      if (!productosHoy[i.nombre]) productosHoy[i.nombre] = { cantidad: 0, subtotal: 0, categoria: i.categoria };
      productosHoy[i.nombre].cantidad += i.cantidad;
      productosHoy[i.nombre].subtotal += i.subtotalSinIVA;
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
        <div class="stat-box">
          <div class="muted">Pedidos hoy</div>
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
        <div class="stat-box">
          <div class="muted">Borradores</div>
          <strong style="color:#92400e;">${pedidosBorrador}</strong>
        </div>
      </div>
    </div>

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

    ${pedidosBorrador > 0 ? `
    <div class="form-card">
      <h3 class="section-title">📋 Pedidos pendientes de entregar</h3>
      ${orders.filter(o => o.borrador && !o.eliminado).map(o => `
        <div class="stock-row">
          <div>
            <div class="stock-nombre">${o.client.nombre}</div>
            <div class="muted">${o.fecha}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:600;">${formatCurrency(o.totals.totalSinIVA)}</div>
            <button class="btn-sm btn-confirmar" onclick="clienteActivoId='${o.client.id}'; confirmarEntrega('${o.id}'); setVista('resumen')">🚚 Entregar</button>
          </div>
        </div>
      `).join("")}
    </div>` : ""}

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
        <h3 class="section-title">⛽ Nafta de ${mesResumenCapital}</h3>
        <div class="stock-row">
          <strong>Gastado en nafta</strong>
          <strong style="color:#dc2626;">${formatCurrency(totalNafta)}</strong>
        </div>

        <div class="row-2" style="margin-top:14px;">
          <div class="form-group">
            <label>Monto en nafta</label>
            <input id="vehiculoMonto" type="number" min="0" placeholder="Ej: 15000" />
          </div>
          <div class="form-group">
            <label>Fecha</label>
            <input id="vehiculoFecha" type="date" value="${fechaHoyLocal()}" />
          </div>
        </div>
        <button class="btn-primary btn-full" onclick="registrarGastoVehiculo()">+ Registrar</button>

        ${gastosMes.length > 0 ? gastosMes.map(i => `
          <div class="stock-row">
            <div>
              <div class="stock-nombre">${formatCurrency(i.monto)}</div>
              <div class="muted">${i.fecha}</div>
            </div>
            <button class="btn-sm btn-outline" onclick="eliminarInversion('${i.id}'); setVista('resumen')">🗑️</button>
          </div>
        `).join("") : `<div class="muted" style="margin-top:8px;">Todavía no registraste gastos en ${mesResumenCapital}.</div>`}
      </div>

      <div class="form-card">
        <h3 class="section-title">🛣️ Km recorridos en ${mesResumenCapital}</h3>
        <div class="form-group">
          <label>Km del mes</label>
          <input id="inputKmMes" type="number" min="0" value="${kmPorMes[mesResumen] || ""}" placeholder="Ej: 1200" />
        </div>
        <button class="btn-primary btn-full" onclick="guardarKmMes()">💾 Guardar km del mes</button>
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
              <input id="extraMonto" type="number" min="0" placeholder="Ej: 25000" />
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
            <div class="form-group"><label>Seguro mensual</label><input id="cfgSeguro" type="number" value="${cv.seguro}" /></div>
            <div class="form-group"><label>Celular mensual</label><input id="cfgCelular" type="number" value="${cv.celular}" /></div>
          </div>
        <div class="row-2">
  <div class="form-group"><label>Monotributo mensual</label><input id="cfgMonotributo" type="number" value="${cv.monotributo || 0}" /></div>
  <div></div>
</div>
          <div class="row-2">
            <div class="form-group"><label>Costo del service</label><input id="cfgServicioCosto" type="number" value="${cv.servicioCosto}" /></div>
            <div class="form-group"><label>Cada cuántos km</label><input id="cfgServicioKm" type="number" value="${cv.servicioKm}" /></div>
          </div>
          <div class="row-2">
            <div class="form-group"><label>Costo cubiertas</label><input id="cfgCubiertasCosto" type="number" value="${cv.cubiertasCosto}" /></div>
            <div class="form-group"><label>Duran cuántos km</label><input id="cfgCubiertasKm" type="number" value="${cv.cubiertasKm}" /></div>
          </div>
          <div class="row-2">
            <div class="form-group"><label>Costo batería</label><input id="cfgBateriaCosto" type="number" value="${cv.bateriaCosto}" /></div>
            <div class="form-group"><label>Duración (años)</label><input id="cfgBateriaAnios" type="number" value="${cv.bateriaAnios}" /></div>
          </div>
          <button class="btn-primary btn-full" onclick="guardarConfigVehiculo()">💾 Guardar valores</button>
        ` : `<div class="muted">Tocá para ver el detalle y editar los valores (seguro, service, cubiertas, batería).</div>`}
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

// Imágenes de productos para mostrarle al cliente mientras armás el pedido.
// Para agregar otra: IMAGENES_PRODUCTO["NombreExacto"] = "data:image/webp;base64,...."
const IMAGENES_PRODUCTO = {
  "Almendra": "data:image/webp;base64,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",
  "Chocolate": "data:image/webp;base64,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",
  "Proteína": "data:image/webp;base64,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",
  "Bites": "data:image/webp;base64,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",
  "Bisglicinato de Magnesio": "data:image/webp;base64,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",
  "Multimagnesio": "data:image/webp;base64,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",
  "Citrato de Magnesio": "data:image/webp;base64,UklGRgBnAABXRUJQVlA4WAoAAAAQAAAAjwEANQIAQUxQSLkNAAABwMf/v/G3+d4HV1IzaTvbtr3dmM0+7qlIs9vobNtb0yGZba+zrbSzbUbf6+D9R9Kmv1+/1znXmRIRE3BFQ2NDQmxsuGJPJMY9G1WtSoi1qrEBGglRo+H3OQgBIQTEnAuIskX2VuneAgKAxJyrFfRsVHLWY06o2Yn/87kwYK7hmGsOHTPXSPx/VL2MHiGk1kr0jNm6yIorrDiLK624Y/NFzbPa0vxw5d63Kl/cWpljv2m+8rHmluZeb7DiLK6w4qLorRBSayUiRSjM+vDN/7z5lpufeNad02Z+37QuFn5lWs/3TDtp8y033wwzFVpEiAIwYKlJE46eMX3GjBmvzviEs9X30pneWm+d99bPucZYMxudn2X29vXWGZdOmLRpfwBaxIbEyC0e/KKTs2pnp2fhe9tL9vzljZMGASIqhMKWn5FkboybKUPYOWdN7km+3jQEKiKExhmkt94zyL23lnxiCERE4HTmnkHvKnyqTolYUPJ05gz+CpuhI0Hhj8wZgRW3HXQUCNXvcWdjwPCySJBYlPQx4PyX/SFiIJNHuJxRaOxuQsdALY5kLHAnZBEgsfjbzseB808Mhww+KUZ/RMdIdHx+lBShp3ARDaMx5yVaB57C4cwZj961DYAIO43LnYmKztUhA09ewZhgzkOQBZ3AmE76uPhP8M1tY+N/gQeV3UKbEoQY9S19UsDcLjXMlf/eicnJ4Z+JwfBU6KTg+IlAYngvObz/mz9jksM8iSHD/syZFo5JDkckhyN//UumhveQGPwnwyDC7ujIoO3aFCrsDooMx3dRiFVMie2djYwPlQi6DGcxjwoa9xfogFPYrNMyLr3/biEhw01jP5rIoOUE6JDbLT6Mvy3kJC6jjQ5eG3ICb9DFx/VBJ16KkWsDTmG9imV83KZCbkvGB2kXhgw1Iere9T4+uGi4QeAFutiwfKS/EuEmXokPx1eGyYDDy/FBVhaCTAtcNDks8jvqNP5Nkxj2TA7jksO+MeITg+GdWiMtXIvUcH3YjTcdxriZ+1DzrmeTm7wjvyHsxrKXNsw8e3lVyAE1Y8ePa3im9ZXW1tbW6a2GQe75wyvTW1tfaX3xb+PGjxs3bh6IkOvt8n9vdz64rJu2MAq3qmmttZg58C5dcBlegEz0qHsUgddLqd8PskulRtEWB0SYXYKIkWF2mYgXId4LsqnoJ5WIDqm1UsDHPrycf3k4ACiplBJRIKTGTNV13jK8HaefufrqdehZyuAT6HHpbbe59eGXGeaOJD9++JEHHzpwBAqyuiFb9cDX3nqzk91dmNEZ59jjp6+3LKtk0Am5zAzH7sZY6xjwzlprDcnHoIJO4yIa45zzjENn86+XEDLkVL/7nGFM+pybQQWcwLy0Lg6s6ZH8ZEEhQ07Ud5CuR+uDzrPn959fAhIBByFWvuxtRuF922/bfQAgEHTdh6y2ymqrrb7abj95H2yeu2CmQiL0pMJM/+1NwC0qanR3gWKsboBQ3bUa+iN9uK0IiSKtdj0LDPkh5JZLDismBsMzoRNDc3K4IDlc+KsrF0TJ0KBrETHS//tw8/xhNERsSCzW5gOuMlJGR438K3MGu3H7IouNDBfShJv3n68kdVxkWKvL+XCj42uAiggtse6P3jPknX9kJchMRIFQCuq0djqGvef3RwNQESABjH2Z9Ax9Sz79v+EQMvCERu1eV5LWM/y9I1/YLYMOOgVs9TJpHePQ5eTtSwIy3CQG/sPSWsajs+ycWAMVaFJhg3dJx7h05GvLQgWZBs4mjWds+pxfbgwlw0tj8YfoHWPUkccBMrQUtvuQhpHqDM+eByqsMhxMWsar4VvzQQWU1DiEuWPMVvjOfNDBJICDmXvGreFb80IFkhSj7qf1jF3DN+eFCiKha6fTMIIt35ofMoBEhiOYM4oN35lfyfDROJg5I7nCK5GJ0NE4mIbRbHgcVOAoHErDiLY8HjpoMhxCw6jO+Q/UBIzGTqz4uHLm6xWhgkVi8Q+MY2Q7frkQZKBIOeJjOka34XUyCxSFqTSMcMNTUBMkCpvRMsa96dwMKkCEHPSFdVFGz651pAoPjf/SMNIrPA1ZcEi5Uof1sUbTsS5UaGS4gZbRbnlvcCiMtYYRb936UEEh1Xwf0kUd74UOCo1LaRj1jhtBBYQUi3UaRp7/bLAQ4aDQwtij4WSpg0GKJTocY9/xbYhgUJhEG320nWOhAkHI4W97F3+OXwyVIgwU1qZjCWj4P+hQuMHbMsD6R6GCQGIN73wZQMdNoUIgkyf5nKVg7s9BFgACeJu+JOAxIgQUNuqyLAcdn5cyALSYQFMS0JkVIYtP4H66sqDCvyILgIFvlgeW1wpZeAob0rIsdPwA1XFOu6hEoG3fEKr47i0TDHeGLr7by4U/h8BtZYJlC1TBSbHwD96XCU8VH5ajZ5nwUAAs4suFhwtP4c90pcJDhZehhaZE8K5tOSGL7qxSgY5rQhWb1tfSlgp+9YITqK/Qlwosvrr25NDxe1fqk8PQxCCxbJdPDMuVDqsV3qoVVzKsUXAZDmbOMtGwCbrQBEZ10JcLVxfeyNLh8sKrKx2u6PNfn//6/Nfnvz7/9fmvz399/uvz36/4tKeGUT4tQNfcRpsShBjyJl1SQL2lTwt17cmho88P7amhvis1jPg2LSDDuTQpQYih79AlBdRb+rRQ154cOn53V3tqqHeJQQ6eTpcSkOFMmsQwNTmcnxympgWBEd/Qp4X6rtRQ154c2lJDvSsbriw4qNp7acuF5qLLcCZNmWD5UH8lCq6pXCC5AGRiWLDwzioXLB8doEShqZo7acsEw2ZoFJlAvaUvF64svLq21FCflw2XFBy0vp62TPD8crSQhZbhbJoygeQCKLqmssHOX3hTygZXfOelBtmSFgRG/kSfFuo6k0Nbahjl0gJUv/tok0KGM2kSw9Tk0JQczkoMquYO2pQgUG/p08LIn1JDvU0McvBrdCkBGc6kSQxNyWHKz524QGr4aZ60YHlXjUJKIN2CkIlhVGJwfluopFDh+ciSgvdrQyUFujGQiWGB5DD/r64smBxGJwbnN4BKCjlPR5YYjk0OpycG68dBJwXDA5Alhv0Tg/X7QCeGvRJDzhORJYbjC6+pdDih8M5LDfKStCAw8if6kuG4oqvrKB3OKLyuksFyT+hCEyO+Lhc8vxkmRJEhw1SacuHd+sI7v1wguSBkwU0pG+z8qcH9/OC81CBb0oIQwz6mSwnI0ESTGKb86kpTcjg7Mah+99MmBS0vo0kKGc5NDlP6PHdeahDNiUH1e4g2KWQ4hyYxNCWHKX3+6/Nfn/9+j8oCyWF0YnB+I6ik4N2qiYFuLsjEMF9yWCIxOL85VFKgmwsyMSyQHOb/xcMCyWHuxGC4P7KkkPPoxEC3IGShaUykLRnmK7gMU2hKhvl/a84mBy6QFizvrVVICYYt0InhyuRwxa8vnZ8cmsqGywpOiBFf05cLNxYd6jrLBct9oAqu3pULjssXnRz0Il25sGbBIUMTTbmwesEJ1Bv6lABdcxttUuiHk2hSgsboF7xLCBLbjG93LBX8akUmpbqQ0z6lLxW4doEpYCwdy0XvP1pAyKKSGH09K96XC5aPQqGgFNb7hp5lo2WLKCqFNdppWToaHgRdTEINfpw5y0fLqaq2mDIxkRWWkIbroirOCTU4yZsywvHsYw6qUQWksImzLCu7IEThKDHhO+dLCmt+/Btk4WjcxpylpePxUMVzpTflhc/b5xOicK5miUHLXaASw/RaKYrmylKDlrtAF83N5YbxVxbPobRlBg13gi4UhaWcKTVyP7FgoNRttKUGG4tGiBFP5LbEMF1/hioWZBhHU154fi4hCkbIYUfk9CVG/8IBBM63eXnxXRFpPYnelxTOP5PJ4oHof2AbTTnRyf2RoXggsEE7TRnhmS8gZBGhFhu+yryEqDy+BSQKCQrZLbS+ZLC8G3P+nAMFdbz3uS0TfFfXGjIrLgiJXUhaXxp4z4+VEAUGkWHtbU8hjS8HHLsmLq0kigyQACZ/SRobf976rj+hKs5hUEpj+Ru/IZ2NPEdW/oRMFh8ADdSPv5t0xngfa97w0xmbI0NVrAKQEsDG09jd+ihz5AujAIlQAISWwB+bL22rkCa6bJ7zrX8MhZQICABKABg996RvSGt9RFmSPH0gIFA1qwagtAaw3L+7SHpnjPPxY40nb9pnN0ALBAgAITSw3D/u+Ig9mjx38eK89yRvWROAFKim1QWA1ADql9lh6pS3O0nSuUhxJHn/1PUBqTWqa9UBpFLoPmDMvw45aDpprTXWuIiwxlrLTz74YAcAUqHqViEAQiqt0V2f8QZn6o2j96HnjWGP59fWaggtUYWrU49C6CwDajbacOtbbrvlPZK0ZN7dOh9c3rk8z3OSfPTmW/fdEACkQFWuYj0r9Dxsia3OfZpdnLlx1vpA8tZaw57zS45dEt2FgECVrnoQSimtNADIsYuuM/m/k/ef/Nj7XexunbXWGB8y1jp2t+8/O3ny/yYvBUBorRSquEZDo6pV1V6rrKamn8JMRc1K/37muee6GMbuueeePWjNGonutf1qtNKqqteqxj1R1COXWXrZZY68sKn1m6+/yUOk8s3XX107btl5ULh7XtHQ2FC4jfs1Njbuufvuu+2+8847HXzqaae+Qx8ajq+detqpe+2y+18aGxv3a2wozsaGKwAAVlA4ICBZAACwYAGdASqQATYCPmEskUakIqYhJdNssMAMCWdu0aCskYRbEZv65VzVy5wCb2JLLYv2V+Gfj93Bus9t6kOM12n/O8yborzlenHzEf2B6iPme/cj1c/+R+0Hva/s3qHf0n/cdbz+5XsUeXb7OP9r/7v7Ve2Bqd3pb+6fjR+wnzD+Nfu/+O/KH9wPXX8j+t/0H5Y/4L9rflUzf9qP/L6L/zH8V/lv8X+339+/bv6C/8H+e8t/mb/w/lx8B35P/Pv81/dv3R/w3H7bn/yvQL9pPpv+2/vn+j/8P+W9SH+69Jfsv/uPts+wP+Zf0f/I/3j91/7t////B+Cf7//w+Y1+A/4v7YfAJ/Kv6r/uP7l/n/2X+m3+9/8n+j/2v7me8X86/z3/m/0/wE/y7+v/8r/Efvp/oP///7Pvq///vP9EP9sjLtcvrjEczF8GP8KiYzNeh6RLZqKKH5DPlKtzJRB36VYTNAIMDP/IaESWbE/0nj7hdhZxS3O0BgJL1iIxc8euLBKOcGMDJ0xngxBsXOVDihhq0BaENQCkOQG2fUOtM/BL9Vd3KBSOmY4gbiKI4x+u78ZrxYuggUzPP7PX43w0EB946U1AcjMLcho+7buaDSMgrHpqUm0rNKc3bKRgmuPRad3QQ4rP0ccH/Wl3FRDI+AzFR4FKPTjkWrx7Nh/vasJBrpwbgROFAxyHZmMCHjPZP5Qe3CxKAA1gX7tvN0Hqi+OUJmBmLlfw+nKd0ZtFS0pYZ8SHfOtVFcAyTvqoP4yOE3tSlPQS+APuNLAoVRUO3/kb8CxGahRM2kkXAfRTLheHZAbj0imp1M+kDaJY/XIDN/6sPAkXJ3wW4DCD3MJK6q1fD4gIvwVZL69tnlQC795/ygEN9S3g/+NhaQzuJb2yHpH8tmU10LmjvI5JdvOeS+lZvAsg7pSZhSo/2j4C+Vo6rvQlVQDcQoUB7O6M2jqfD2Af0Kv3Tg9utD9sHw8vuJZHWXh6MCR+6jnD7vPQ/s+NN0hFhJD+jq5/VWHQOpp1lh7u9D65lvY0EoCe+BuMfr67Prsnm7QR0ZJkEiQI/Z9F5p6mmz7Y70CdkD6CYkqTe6GFXJOA2vannOYaSJIQihaNa2EE8iZh8pKcy7DrRIkfw22k4yiE9WfALBKLCkquP86MKOqOrMRldD8XxyCs/zPbO7wKp5WgbvbZ5TDeRKqoK9Yv7P/OpW+BiUkcT/cinJeU51XAya5neFfg15TRq66lonLiL15V35nIBpXiyhbeYJ9PAYO/+6kqtEhfANw3n+Lrv+LFtf8sY/YOvLKYekA+xEdOJebcipPlbCqlpIBY2RsBx2VHmGDPxn9xhjeqrpAVQkv42LWv2FqCjb77A6vJ/QM3m0aTuE8o9p7+6M6EbPDS9Bnv8WlVxl3IQbwJF+xAQNHU9/hmfMOzFCXAI69wsv64OPEwhJ1BkdhjJV+YkHe0PVUO3xgrJKnW5WWf9VFf3LStj4jL9ghfYYbJEM4+AY4FZyfJAoVhpmEqBtOjTsG5SU8G8bWql1cA+xElHdp1kYNlh44ejiU+qAt+YtMSNV3rhXHYezNN+8kDwcKnh8Gi7eCCldsfYsG+jzFXw7bvXT/Etz+6EbF//NzTIffMv/AZUdMEDvbvrm+LR8GFqLOQtLEgTCv8VLlK4b01N+zM6ms+Y8rZOFRyd0i1d4xZUnpGntcB9t/ZZkvyolqvDUKh1cB/OGSqtM6cUNe8zttyhOdFwcnHJ6CjlyIqti/AgpHD/rcSGk9JIuAHdJmw1zuWozbFP2ttVdamx94Owe8wouCwfS283tbOPWYtIcPurE75DpTXOQmxwNcxQXRX9yMhZ4kLXb5+tW/OfauAfYiSikeG6A9GmGDprBGyMdMy0ghTuXQ6bNDDyQijH2qOnbqUuqSAzYITjsT6fg7lVFQnTIr4VIL5/tPKnzEfdOboWMaXIeSZ1zTf4lx/7Sa7fNqwuLAFEtrDIxeDt86GY4Fc8dpL1kI019fiECLUKYZ8TUrtt6jH4DE56j14rvfEG8n0eDy9L66Grd9/VwNok59Oi4MITMe1P62XS099KRmqsTgR9Nnzm/+kP/Ui/5kPms7zpQFn3PADb47xntxbNdivrcaJPRqY6NixgAkSlTxsHIgPbU/dR3tpsQXVlzbHmDFd1A6xq9MAYnHYzEmnbExCDYiimpsiqrNmobZzISJ8M2YkOJCvKTmEVGTsO/nipZpfpUH0Vg+bZ4D7/mg0aEaOG1kSV9A7CFvUzRyqYahPaQY1jWOUWna4JFq+OCe1iIfgtKPhRk1lrsp6wkB4pfWccSnQLJkTjDCQCxXJb5Y3K/dHwjzDhOgxXfCAsmXe6wIOHCQor1/22WaieWutZQK/I7YRaEwQHsaaQyFnL5h3PzfNgx0HjWb0QElMK0U0nAIml/5bZbpu2gLd66W7ycU03uRZkr4KUB37RA20TbUBsswqn4CgJvpY5wWVcD/EkvQK/6QHyLBI+nKcEtmz1gDc3xaPgvgXCYvSRe5ZrRSzO/13Eb7UfeW0fTokzg1+ObSb4XfEdII3D3w4tR/t8FnvWZ3QSFXP//3WhX+v+IqrV7Kd0YW9wk3oE8ZdBctBakeegmpjjl5EulggsOnsGtRhJt0dwhRXaUd7heJQOWSLfCX/i4zDWh0ApR0x7OuCjfF5y4hSo7bre1CZJ6yxme/QE77O5y/x6K5Ed0UplRkCuAUWqQK/09tbqbKnI/L9FXJMtVUewGRHQXYfIc9M8qcJ/rqeatet68TMzhSl4LJnXxz0o/zwZ0f4FvX48zfwrhuseqkLDeCTJkczWbVcD/URMaeMOk5PxEAqFGMhvtIWNHFmLpbNQRl0RHHK/xaVWecisj/pjjnPAEP/dcgktVynXsIfPa2+doEdNmJhfbX8BTy+9MpKAsqrm8nGPdPmkLL2X3Myh+MNaFs6p+a/hfkouhPaOEQHP7rqTn3wkHP+adZWIF2O1KUs3HzEfo/0CFj8g3kLfqwHxYt6J/BEL3WAWaWOlvl4vz6b6KUSOHhQbQIX1c+w0vwa8Axnf1sB18QkeDO4VaUIMiCuesIXjzEkBdNH23UrlgS7gH2IjYiC9g7N5lgghRC8Dx5NOnroDm62sQnLyVcL9NH3v/cAFNMiCRbgUTzSjA4GhAZNAynuLE2jn8u35BGpe6cAPJOLkD20DVUz5+AyZCILDJUC/iiFKD5F2r42JZGHpTrtlGaqjMgH2Ij5WwvuCOmKsV01Ntotmtc+zaFIC/xrwnnqF+KW5uz1PGWpXp+h1smK07FTC5OylduHSa5JFTPudaKEtm15/tLW+32Y8Sq1KNQsgG646E2z36v9eusbIqevUCADF3bo0BFb9wxSPgZwD7ER7QBrdb/IaP2zbwASzU0igUrKqQaibwRRQkEPr2K2Kiw/mE0Wvd8bKtL1ehZ8WjoqyKsFOsCVSgRJndJ4IRmvPfV1dyY5o7RqZ6hs1WoiCABwWB62KC5XRSgHByYWoprYg9Ce+VXx/v1jnzq+Sk/5p1f51nr1tihW7jvzZV7jTj1z27OCmvFter3TRnd8q4ohLFu+g5ZCZIwjf8BTndEIfXltZ55QHsjnT+uc8YtdUWu0JA1d6QK3M2xF0UHw6FnDtystTCiIsT/tVgdWDRQfPt/1vBfIm/QC42ZWa+3oqW7A6hra3lm6vJilSh6D9PpLi7JP/XpGwM/vsaKij5OL8T9D3YkY/Dx3xynEQsRZ/8XkXfF/fruyo7YfVI0LOIqD4Ew2rmZoaIGUCiVHON4AAP3TDZ/YFm2YBijFYkcwA9jEHzQMLlDX7OpD78gKNPH/zWNoCsFHIOfNcQLTbKrixCHxVwOOxhhRThzbDUEQ0bu658VCpvq3txHHSMPcPkuuqtvcW6lP76vzNyo3bMhBm3ggQcM3+rkP6Ril796UZ6/U8zk+4BchgSYt/0IRR3ALisX6AQqaj2X7sSig89AWjudSkSG54CpJ/mWaRAWqrqAizN8mwliM3Snp+PxP31uL07E8RJipOuN0vFjoLjhEGPwmWKpNH7GlDw29Mo4T2wGRKOw2Zs7H8X398Yb3cxWUNkXw7kprNxUFUVVTHdj42t8rDHzhAYB93e/DOlbevu8N2AWbizFxDwLU7+gnx4QyVNxa1v5pR/pCxMOebhW1AF21QVI09G+Q4y2n7L6pP5CZKj/uY5/8X7PBs7qz+doK9+0y/UlYgKTPmojpF0esFBKuGtw8OFERIyb1Ybbuu55d/12jLkZbjw9ZhKACIHhD/yUqGmjufvGMKKL7ib46lK+fCRWiaLCOHn+cWQZjTP3ztkNpxva4JtwoJbSM2IkyvmJ/kqAPCgVqhNe2zWYhiwTiPmNzfv8c4D/lmiRj0kMdVFYEfiAzdMaDCxaEUWa2WTKp1Ky1yO9xkBIqXjQiSzWFES7XLSZHIPmYtSSM66/k+cOFTaU2byq0oD565+mn2vfN3Hbyv2FdbNbhZrjnWqxFFW1j7sfPR8QI2O4Hd2BPgP9hKi1DJi6SR0o48JeiTLzAkh9WYIB2zwfFhQRbvxzqw88TpS6v0V0Wzebm8c/bOGLYRKPAvFOvG1mdE5UkM/qkMCvCCdu+CdV6R5YKwd4Qwnn9LFnl1WjcM366Bqhz506Y0MRekPHc93WEzqnZL9ikLX2907rt0w5XRqlpp9z2cbm21187sKAmPUEREFzVg9SJhvgp+9waxhqXh676MX49PYnAkH9epYWL2wR9lAe3oMo8BJcVFU1Wp403o+Df/LfgyDLxLSTKyf/Z36tLDPUpdeFx/6J2vn5ncqg6j2+2wzU2jFPFq19Uz+Gia7JjvpsWCD2X6sCeO7spatfn7qiCsNii3rb4+93sBRby7+zfzuTvkSKhJFYBYr7HQQ/4NklVFS3wLCwNCySkk9x+WviziT/82A/5vjZs4wZzQZCQFSKCasi5Lhvx3nA22r6WFrK4CTZ45RdOkSxVk1xzHZx3pey+SF0L14I47sCfUfYJDTegwUCH9Ok+IdAZwtWAAqFvyCtmqJ9F3kuiqp6FboizMXE/E2LYcNJVZKVEUEjEsTrhu8oP3ghKhCztujAGFfHMbdY4zDDiPN7q7S9DEHn5bIyzMAWho2CzbYO4INrsbq/Ia8v4dj0Z0RiBEEhGa5A+rpEsMlIFJTq0VNqbKiRcoSWtMgUa6LCZD/igDmNTX8MfIzKBm5jN4CXE1I59frWP6+VrmXDzNSGdC7tcuIBp6Pg+5kbIUrV2NUbf2bqDkGVSsSO2gpbpQzrPBUZDyXeniotS3E+AD4v4bj1PSYwZhPiRIcHhkhJI9wBZPCEMNB4RPSrH/sHA5rWa/wCf6ogrsP7nVc3ISF/j2jCjYPN5aiw8BNiFm1uCc9YNmf+K9gCRQw48gs5vGY4oV/UHBt7otbfDRyKPKZ0l0P6EF4oC68CZ3E6/G3FGzRl5lA7v+D/1gp2/4uhvfFm0Uigddxfe4tSPTz5pu57mEV/mMGXKnTfSH1JTIv3yOQAcsT9lr+gxAG79G15B/EyBOfy/0Wk3q9n8eHnUck+HWRUq1Ex5Zjz0uBJ4QthWmX8+oOelGrhIMz1kUKNfONufrg9jmvICEeCx2bTEvoR/h7MSQOIUEBXOlI0G5RFTSEDOeHXYVsXekbU/Uk34AQ1KNtRu2QzhA2a1GrAb+Z9ZAdAJRpK2F5xiarD+H7yEVdrLVbKR/mXWFzG2GHUl5QCUMKmgACTcq95C1AAwnZ2CY0aYJMxtg85T65a2q09Spsq6BGt14s4AXy24L2o8mpntwkBdz7BmYDgaMXvobm9bi/VnBBchyr748szMqqGASY9Iw99AgiGpoh4Q9UQbTmDmKJjSK3XgCjR5oLxqD5cumtO7gGzaw3fNb+00vjlsek6YaoyOQD9CYXBYmV7rL91gqMTEkweZJe5Yr2h65/aoREn0lMhz8BTYmpYwykyr9WVYooEvXNY8TN2qA6EQV6e/b+iY6X/59d49/N+l9VkNlrZ/2yh+C8oh62Fk/e6heEAo/xc1uYb5KdyPtmIvckV/vLJeFfENJG4Ubhf/qBBYn/2XKnxeradBTKIAD47ufb53fanNocz6h0EcVmDX6Z+0tOxe49k/gNvAPeyI7n2LzQSyfq5gZ4F8o9tlsfJXvIWGxbErul1ubTenTcpDdhXFCXWKWDWvENEx3e5TLNvrMDcYyWworPi+Li8ueZ6SJ1mTmQcQSPdt76Ms8NczXMLn5PCQjZHkXxzTjrZb+fzu7efu9AloWAmS37hDiBfqN74yuszIdlQjyH7109r3NRYgQgsZZNGrmuaTW/O4OHo2r0t2Fg5m3PYAqgAfphx9UpYh4AAHIitske4jEkAhXlSIgXrWGDHRpgHF+8DcBP6Aeis8JhjhvrCysVCY3LDhRKi4hLoU5IdHWFwh+zYB6ckJdLnF8vWlz58ItGcP/XEmE5BeIYQkG/qzjC6Wi2L9dsC8PKuIBKpEC/X3c3qg44Dj3iXFTPE4cC3OWMm1fK0wY+M7m7sSbgP1zLdoRUtAim67cPMlQPuHJHGQR30kla0fb+4rMJw6LJhLn1Gd88SY31jFpPB7xAATUuSXK/ZErE37SB823GnoIOnEDVeCiVBDX4vXCU8a2EmcX2WWfXCze2tS1wgWXGxMFH9Ko/922/mzKjgOCzrKi+Du5Uxk9AK7uUQK3+3Lb8RmSbYWkZfUoF9HBPrVv8bvVzJonIsvM3beA/QqWGZe/DkEl+XRLA020cv98C4MVYbu0K33AHtBl/knPMs0oJCPMzYYLF67u1AmfkX7L3GGB9/JCUJ+MFJ8Vkxm01TnjcDddif8BOgMzdGKiqlxq/t4qfH0u60r1V00juQKu3jTieUMnJvcSps29pbswho2S0Hs+d9KW3DUOh8JzEMO+imABJik0DakONXykug5rXMzfy5Q9HoDHdsElea4gzqJ9Js6Vc4V7lromxmT1jwtDEc87v/XULWOsaAQaTDz3vV3z5b4HyjDvrELKNJFVsQISiSA/KmM2WXIfPKG0h1RHSNDLzYuBeYq3lGUp1rv+cb4pBO5TezLwN1in2Hn7KTxYd+rFDxpBLhhTj76flvcOiOc8lYcTHrU6vsxhogdpxa2NeTmvPYDaZPY/P8KN6QMoK+C8I8LqadXVLkJMmTeZwKJw0B9jVzTxkrPd9TWtZVyuFLfmqQ7hbTk1J15f2hhEken1WCQON6cwszJTBvaXctoHoTHi7uXe/dLGSB/o/wDql6xt4qpmY7Ikbb4rO2ceY10DMv5Mr0SgarCgKLzJykpCEU1caj9v7NbE/MpyssBreeqGRtWdqWCcTguNE5FtuVH/Ayy5+kUjiN+6P9pWY4PHcy2GQN+3OZgbXPI5IznAGjWyM4p17chsu1YRWf6k0MF0idVxB3Dyj86jwpXrLPhIOZ17Ew0zt8Mepu17dpvE6QJwxcfDkgTLEwlr3f8i23CTr03hjweCxUxpcyHc6Q2kLC3iDqjrUil2rbcl+JQ5tIdJkO62ggrxmZJp3X/zkayLP8IDtl48PBMlor5m3Sl/uRjo2r5GXs/m0AUKRjAy2I8IbFmnnLQVMkxiy4Vv9vproD9r44BVi3iSF31zPc9x39lOAAPQATHJpLPLfCyqExFoGegrUumUNhqZpRGjzPGA19P9CNRFLiGykQl5IMyWz47maP7U15zu7M8wa24pL5ebs6GfndoQb6N4Cu36EpeIQaN7AyzJict5ZYF2Q/PHoBu8LGKe4Ir+jDmCIKTqsAW/tYgvw513Btdts5OLBygvDreGUz86Y1NrP3K35MezLMkSvVS/dbEuLMUD9HsC4vFuGrxwyFNu4VTdWr0VdysS+9sPqVZXp2r923WcE5bTOg22ZGTiQCMqoOxZ6uNUKD2HfeFz6qVikIrcGDJkeRyDIB5alHhsVejL9p7jYFYvZDVru2y9hT52UXDJPXVmyq7m10KHBTpiHB6PDG4sYobraoLodYGmCJ44X5vMBsm1wR7o8Toud8zhdzIsuB11Q5KWjvzkgGPCvETVDIy0I+QaMlOdlhNCKy/kmUUrnQAfv6+A5tAnflyBQ3xOFno3tJbTqlaHaB1LSRhIDdtviwgYCVCQC6eDbsF8dY5YiFty6gwfMOebp8zB+tDpaVxUXjOFeKX4ZFPy80lWZnBxBcg4Hat/PiKOz9oQHwCYiMtjzlQmTa1F8bS4he0iD6HOh514yrQv8Rzk9xHgh4gLIsTUAra2RtgdgBDkFKwp2hhhc1xPn833/R1TirBKSlgkCQl9f/8Y17QHyinpfIbOCzoefhvSbz4AczwILLrN6WXNbxgFOH8/TAP6/q7T5j+OSSWyo158mVViXvUwE8f8dZAxcGksFSpiXRc7+DEGz5MdF+tAzDXe9C7EQ2pHdl2CPDb483h0/vZbpPC7H7oAW5OmxUw6vPYEO/eReRDbhXkDw6sRPrvu4v0/3GGh/tFKSlqiS/gyGpduc+wXgAVubZ+zwA2PxflfL8V75hcT24x0kyUfctmSorUdDzhJNapo2gaaKRssrSLpJdaXZmqZQVrzsfY6vXsx00T5ExIDK/W34QwfB5wC5Xsjt9i9dYEbL2LqOqy1rvT6Or3VHBLtuS5nCLDlrib2HNh+v9I64n6pGKfu4VdkCFrsqAs7bzB1QDRbmNp5He6nwPlW8X/h6uzI/osvXRsnjdxhAtSpXXNqOCT2bzFZ6w2P1WojqE0nRbTSBopJ7mKhpbk3r1N5wuHJQikfGqnB+ZqI+FcJmWm9PE0VE6Wq8jh1sfZHtNLID0E7esQQlNj6hv6mF6L11fsFB8csx3ADR6DNFrtgMFpxvQ7jTV74YpPzCq7+Pgyqvwx5g31ehh+3hE9dT/G0ZG27yS9kymBFlgMMRzQdQARf8pMU2nhDfHnCefT0/t7ctFOVAX3EtxjQ2uSE9HprDes/lUxWXpfkMpTu20QLnELKqiexdF5H/+Sczwvi1ZCkPt1jSV/zOB93A6/xvS0u72kG+mGLUi3cKwnTvQEt5Jyz4H7rjSy9AxeFu2E0C6vGVOsUkaBxDcDtk80cXhMDQncH8uOA2HVVktfwQq1UtFtNMmiXhzIrbRirABCFZDSiClgpTYFr5zyYcgmG9J1mfKJm725WbqvMOCpU6lf1aBxs9pLjcDPFyT0tXuZ19uqQ7eTN/98ve+0dFUDpc/gfGKvkEi1qUs/M24WyzHv5j4GaYoMYeXQvxht6ahy4GxPczl1+CWJfMAZTcUyBm3j2q0jThq+tqmesyx8Wkh3YZW60t/m+gjbxprqmXLw4DeN4YjAr4WTUKT/skzCdRFXdDhpONLQOQ6SbracRH6xTJZW7aRPckh4dhtLQKAsZvFcQc6Gif3pbWZwgkttqSAleOccjN9BJVFfxxWDoZt1ThJRYwiMlrWjyfNHiF2OKVP11ED1nId4QmCIVJqKYADrWug6WBkxemHZgZv00y45r2+U/0uhl4vOmT2S735CAlujqG9CBE7YR41PkmL+ORrhUEAz3L2NOi963qPZ1EQuLDi38sI2KaJY7yd/r4aFwkH/eGvhlJ/PTz+fjCvm3eYL9KrdV/esc0fldXoozScPHVg9oi/WTeqJ197kpiUF1qc8RaJSD8Q8SrWLkopbonXE2JhM6b5ZMWqglhOf2AfpM0/tkTzCAmw8wczV3QtYNZvLG4+q8rJzHIk+AnsRM/nMh4girzmDtSHz3j6rAnpx1y1IMh2T08a7a1EY5ZsEkdRZ7kUUWoCwty7eMEIo2ROW1G04l2mGXwb4F9MNTzhZOWoOflYJDoMo/evpb2eQOfKes4VYbcqI29wzSa6bUwwKtnOfuK02LBazIqLuSR2PVIPcANH5IyzIC5d0tEXvMThX2A2RzDNMhNlbOBS0FV8dasXarkDNJmfJXAktdDA874h6cAATBMKrDDcqkMu1+OqU2EG00hjR88TgScTFEscUxAE6kkmr7Qd3GK96ywajxNsUHWYwK/O48FGKYnmP5IH8FBq6WfOwevNSRkd5RIjRk7JugcaLua0IpJgtbIBkGEHhsRnwB3uByioFhRErZM9lJnW6xxM2GYRY8iu37bvW1fniORZGqNZs/5Xjm0UrWJtYTm5WpPKhX5PkAYiwPbfQraj1YLHmS72BnknH2Mef1L49TWqpKjN2ZPjkJNyV1fFXYWL+Yj9ghOEw6aQxdbfdrSB/Uo+j2SKIat3CJIBHkMxxZR4f5r16ybOGbl8cd+W0R66M5F4p6lElbXMSJZZ10Sdal8+hsrFrMVAG5bz8gQs4gLNggzkrK/4fn/Vq+vQUlU7xu3cRqVKoTgvG7S8Ud6k30jMPc/GNq9B7Xoc4Pi0nT2M1SUMrSSqYydneEx/k59OG6a6auhb5iPYC7B4xJzrQacjuOaTK+hwnv8a5WpTZr6eDYTXqiJCvy9wd158nmKj2yiOWRMeqzmobloFS9LNmpq4WPCo7BK3kjRk0xXYNCshHF7NFfIwPeT6ieKDxJ77yG1E5r4X8SyoVbPlde2SlyGpNuJFgDFxXDDNHM97GPnNnYmGBuHxG5zxfAqYpw0BQFlpTCr/JfgLE+Mm5iGzbkq5rHFp6FgxzRHqtbkui4bNpd7g+92BnsDQOMOs59tMO5Y8Kpwj5hja/uZWPlvvrp8zu1HoTXt0QhgigceK9FvIRVUfhX3f2sFNQHlJFpyb6Agcfw7uG8KIRSaSqaBRce1N3rzJn3TEDzOczR9tQyu2oYpYzueZhCqOc2lUxz91F226mFuytUyxZKm0i/OeMEFq+HNVl0kFzE7zq8p4kNZQMe4FARSq3r/kLc3rqGZkn4ZrmX9g3Br/Pi5uGuCjawAkk22LtxbhIDasFRLY3e11RLsCOz8bScjZobHjmrSSqCiyG1577I6UYZUIN10yYzIvQsNUAyD2kgAKxd+/0vddmj7IUVNqBqA5PNDJcD8+VC8gWN6hQOoGITf/LjHJgTwtniRHGmWAi2TL990CbgXnlDnW8AiinsqMbtvS9nZ3EP44UteOhz5PacyhxGTtbZUO7JRNODRxezAaUTGTocRljw032jutNOv2SyBOpbwyVz1VTW6oktD3+mWUzYJctZPhnGHTc6/2z9g7SxkpuJkrF57IXlRVtsYdFVxM0IRwYTmCHnMrFFHrThWxDUuHGS9DZ+QDclFhM3L6u2l5kWLp0kxmFzAJxnEDHBoYdmKQEDjG32N+2ed27uCqujVgBG7h4df9sDeFdwiEAhWQavdfIErg2bkNjv49p+T3hge58tP64qUrtDuACn0c+a/rF0S8Aer/bJAw/uiidNSciN3GdR1AzgeH8uz3xbjuG0H0Q6MfhfhSJ6WQtcsetAeltfAPrGgb4xUvrevHvg+g3PAjTfuKUCXjpFi2YQUwPQ2ZMPQGLXVStal/LuiEDXVn6xkr8BDTPKRXoTlwulqky2C7vFoRp1eIAwlw/F536bJPXYi7BXJ+HRq6IcAunAZXwlcNsjmWAHTzeiSZYVLeMo49kOHAs2mqRGaem6WQrPGRF//XKAFdhl01/Su4JuUldYWHQJkInUPETdzGKpeCBYdKb34ACP8wYYc4lM06u+o0PfJil+c0AaBymDmefELi/bL/wv2k7KFRoVG3Lye4ny/ayu4KhJZiwcM3gom4FwJuvy9/0Lkqwk+zGEfnqk54l3hmQhcqCeIDR+Qsz7oAIaOL4PfwpA+YgejQ81KCccb/idmpdso4Tc0lybiA8kuHH356KW9FfefguU7St+koC3FxX8/K3mvsErD/ctpAZdlCEHhTyK3+0jfoSvM5lCP+/jfH8pUW+bUeet8DJ68ReIJiXmFLccyilcnOEoO+9TBv5yyGhvmQTY+PjOyfPeenqt//+77r8a4poh4AA09FR8VlGUHFY65xt07BI09YuTHis3KQ7hFoGqG/T6AKlBR5gv/ecMFqSIgbI1anQe4N310bSLsT6RCwYXdoJNf6E8O5eYtDlMdTM3z9QMkvjOUrRWXDDlalJGyRn5GUdNESsRFeKtTZYzojWYTahKGkjHiKtN4YB9SWjzh7wGVzIvhntHxHMmfSfqZZ8xFvBh+twkccDdKS5hMPsi+tbfNbNw62jsRhGFFKY0l6GiQzrXeqCWL5Q/j7BrxY+UBYxTyVPK6m6plaKt5m04Vc987aFF+g882hAWxPmwtmPkAdAjjSnZ28tq4/hCogQgEyI3Lv2DaffsWMTfcv98HIFHTnMUThqnTGsn0Y2eik2NbUs+nFBCLSORcDaT4aHvathMqzhMWXSU6BC46PX8AAA2mnmHwdeUCpr5brzIK1UurkcwDmZys4iNXKyvNm4JEOQnPzD/zWUlft5A6TvNs84aM9SQ4hhyA7Nhenmit02GhktgzCUQlCIqDdjuQjiw5pi8b8JdQHjXyx3LRoSGbGyjdUs8bejdCzOp2323Hj4pAIXdetKpb0Bj0vlPvYJIrWKuOx5Y8QIxXl3g7v1swTRddg6ndCrrZM1r2hYznmWC1rGXE7XFVhPesmZzRH9m0YymQZ+78OmsnkEE1wuCFn1KxF9nLL6SWBqtLCcxhyPCE9J3o2AA3WgOp86RhBdRqP83xUu+OjGRxXlG7KAY8Md7DHW+PvzgdaN+7Q40wrv1xHe6PyUNixTO4q2eusmokD+wtBWMcB+TsHk6MPxWKtE+cD2HkNG5xQnzQAHvgB6UN39YLd5GpfLGlmgAYAisIK2eAMZsgXhKTbvjTdBawIirP/SUzk3Wz1ZRSCcj4k7wX0V3rViC4F/OAVfSgckGCA1ml897zDGAV4g8xVBG2EBKxs7PElXfn9/uv1746OAC/nAW10UcuyOIOeWc4LpomWb1ptnB0u1ger6m2zN+mjulkAsvArBEb/4skt7xCOFUcvshGQZCfsg907eDvPAlnG0pgjOI1WO91dbPP+b63XPcogCtEg2PyOCwtSgH0hGH/xEn6Obrvzkr3DpU8MT8ITqfrXzYAD05woPOOKcdodixbbFdnBx9mHqvaGN5bYUYiiW8VSpEN1cqaXxvQLugFmEVOu/MYj3KgB+fkXue0YtUEZpKfr5RXklvngkWMdyJyFFdWoPu3Atrf0HeeWS89J7jYActa+rX38HsPdVkfCZiGj40+BH9rOqDn6B+uoEINjFj9dqYTHqsZpnHcS5nYzIgPJXxMd55DzDEdedgipEk5SsH3MbzMMDV+FQRnMh/3rgV+9s6ZzNN2FwDP2ianfhZBSva+Rg0J6BC3AZsBTRm+bJM758rZXNFpsk0NVepChC4FkFu6OkeuIDjeaVPEO1Btaspfu5ezFkfl/1rqjo8TCHUwSQ+pRWd7T9uww2n/Jp7aPxpatDmU4tNlUKYy0lwMEUstLaX5hSMOs4WQ6rDKUkr0+cXSHwXrUIv5Jj5cuP6laNwRz7YHIJCK6lGclbZy0/+oOEAxoe8PXZXKavBUzLqyhjlHioF6PwFeQEEdn8ldbeg0htsUD0xLBYy4TfFOkku3bU1Si8SxFDMoScXexJ6DrRIkc1K1TMA26+3NqPG1rL6qok0p1io3lEHDyMRGI+RniyiHR5hgSpL0XXTNgFuIjwH/9Nh7i8gKTuFpHtM+5FnbXOj7NcO3oOa8NAhge/u0LrfxTp14JqtILEVYAuScOA7VxIntsowH2OxaTPQpPJWlhu0F/zk5e4enxCwdc4ppsiUgALJ4t4MWyjDzlMAZnP2stJvEFb/7Qd6XEZlhUnE6mcV7j6C5ZY2VYOXJwb7iEXVCDWbfXdeM6jF+qtn16U46Ck6thOt0oVIw9zdXLOxkQzu27PQWAdZeUspCKyF3pVvJNxwajw5n1o4fM782FQ5o0H+M5m92nuGgL7tJQYmNqNLE7+0nX+Prlog1+MZw3y1rd50PfRDyYG1LQDVp3G5dkfaw/Mmb9WnnY3ffD6FNj9LEDnUyoQexPT/JkfKxnrkqk5lXsG0gzk2t6Mv9XflpQboT3tkkkGkuSkTczylG7+t3CNzF81RShEwN4JTSDcWc0LfSVynxYmDiK6wPoLlbtxNIYVW0NHTWzR13VHxALgUZq0hymmm01EsnKzai+pSBrxV8ZQ6O6e25URsB9ZDrfqpL4v2xjrWfouGZVwnaswbNEXnrts1WBBy34jJ+ljdlh8G+OSSxu2JwtCawmNf9jhNKvvEHl8NglLBshhpX37DZHFiz5vbPJ61OnhbppD2umtkfkwpeyYTRqvoAChfvzHI9KbqCa7fwxxRCY5jEDzrFqZyvMoFZpyZxlez4wgQOxLF66N0N/YGbMv8XunGNuPzuQ/y4OuBetQ4iZP//aurAsR97S947IIErHjwDjmKXhkk6I7WiBXXC7+II733lQjAn8sa5vHJAhFczSxAjBYE5NiTUvEbHQsV97lCdr8Vs4PdxP9hqyHRi92qhlQCPfp5wh8t0vAPd3KoAaskW4rK2BxsGL3h4swfLCNXxqJVbxuZ2fSqWubSiN4FMsD9sfcFuZ+nAUyP+rLNpPWIINu8nT471ykVl7tUq/LfgVX8QY2AaGAbham2Ry9LTeIa1zGoM5m4eoKubCWijcdxKU+2/4t7W8X7wfEjtStiSysCP9GPKZ2IC7c2uLJwynak/J0Tjsj+beWgEPt8EQuX3gIrlsYSmFCDE8KWl9rqNJF/9wpThO7CufhwleCphrU2BL0RPr0nOoXyUIYGrma/mgNqEcXMrkcCLraOHkWilIagePFhlKoMZflo1nSHeWDbJhmoc9gn2W/kUob0OKqCVihoKgb3DhPUht6lKTviT0/wxQbAxGlGBRhKiQpay1nFeEXCE7GMxMSBcyL5D7PEx3fv8DCgfjK7gIe/1Kr9sg8P1szN54GAIaLX2+TAdKZRv4upbz9c5ZWaiULOb0JDTHHURg4Efgfrw/MeMvyTHXugAftIlumvHLRyOwN3kRVJ/TiA99kM9Q2I8/U4dgd/ewNXE7nUQr4tjfLDN3SKsuShcDqseRPw4Th9AaPwikGFcmOjfjBktmRDNLeR2m8JABCcd/zD7/h7VtvuvQQ+/j5bWWB1nDKgKtjqB0xAZN/KYazJJg/L/CzClaMkxAc6hyYXVxLbnXQsaJeyivwo6SpJLA7g4ytNff7+eKX9rxFjsqnR8znvJ7YMKrvlAqmohp6qRAzBm/GGakAKw2OC0rqQm446T0wMPSf7fY3EI67zNdAM8jn4i9+iwXaMFuaqr97YyH9bA2/yJWzqGfpHH3vKGDdO9jjXgHzaUDsUXfVbrGX+1aywNoeMz9xNRfh9UoLdoeXDz4cWExVuo+15qPTuiAb0/fz1Q7AaN4ElV09HGyw2jMIQz1kw5DCXLF6FMHo3k4KnYHtF7PtB/1kj/m1XdkJGfq0tsc3J+Lz40+5VTDjIV2XKDE8qh1LOc7lIyd0+vlePLULJoiLynnxP1JGC32b+rGvP+/v1qUz8jpScS78HRacwCN8Vp67PRt3bkILkc97RVVsWGsSzxxO86eZha42RwUtt6X+92OJ3OElOCgGAejBliKzkJXXsTjisivPO5XxbBoG4Y7xCn1P7WNPlzRPu7ANlkX2oICqyDAjRQY1HdjY4mKXECn8Fsu9isYaLFDGGWaf/7vkD3COME2g91eyQDUQ8vOXe31ymGSr296/r6iBFbxMvzZ63wTUGr2+MEcoA/QUJBudrM0RV6+JyLTbaake3KnybaK5rZzvf2dGgtD3d9QyfmfbTNGDKBYvu49/+9zgv49llBk43z8nyZtWDCYhVtEPXreuKG7XjM6z9MBGzCXZ/YYh20onqC1UF+wURO2ewlPa3vvekRnUL+SXEYJ2PXMaXypPgnAqFWh90EYJzjNqlF3bhNO6D60hGVhum2twje3ZasmjaL+5eisFMAN/vBUY3vXTh7+J/8nDU5sKEaZVXtQQ3HMwyT9HwJwwks0KoNnOw7+OFOfOIJ4wFxBpq0jsjl6D+lNAWIqPJtv30U5021NIxLb9WiDUXgVG9Ba8B2QBXgFH+TEEwB26ARJwwRz5rYCuIjY+0YjifUwTrwS3EYhJxajlhg03l5rkdSqnLL9X7sE6HKjexTkEjFCmLA+IZGcThf9feFwbQ3172f32EDNxdncgvdFEVP8X8zzyDMZMSn0R9mjmXzLud4W6DuNkSXpSqTA9AtJhP53y4BpTTezzLxyT6IIhXtA9umnh5YcS11WyAbZ4TbeRKE+E4XhtszGzM3H9ZPbyFQ0O3kGE+16pLfxQBVuzpnF4vVHBE8l8cDAFDo2HZTqPaCMIYJCdD2uQgkkegh1kLM37khPHYY8LdNos6wdGbT6XVrmdd31itgzp+j/py/JNBtLz0vni5RDBFw+Xr4+uW1AG7GYsZGK/ymeH39AOPbuRFWbhpOlXQ92ITgWyWquyZayccvf4FLnefEuZjGL+i83a1g/dsvmFxYkeRfvraAZmx+++JeXQeySWNmj1tFn2mc6HrIZfEtnZ4dxene11C9g6q7bFZDjgLNUIqpN4f93SStA3goUttLnOxqnjmYCbZcJitYe1uJ6wEHT5apUNxBiGu2FsZH9DNtxsFpMJWZS6LUNsCnH9xZ0Qs7gxdPNsPLcKqGtgqeOZqkZR47ycoX3cF3pT1NU9SDNGLjkpcqI8FyY6Dr1TbbRuZJzYiuWV4bX/iCbwm3Pdz8UflvFqYR2ENFEB2sBUMF09ewHKjqdVd9Gf84HOWJGnAf3YreSwmIQjMArOsM4vUeHSFfL7tiqXrq7O/YNg4SetH02Lo/OSdx1dufW2WBvG+lf+7uddImqN4J2wb19HaLUBNPTtfyeZjtwogDE0iTGNNvF49oXamx/InqWF7K69ghRGIUJr9Es4VRFDHDDaltQZT7aDjj07yWWDqUQZqnNmWCPPqduA7mcGmANkyd/pNvKv7FWvVoI6Dp0e9fBn+5TDE/4rD9ZXvIpqPNeLMhZxmRMuN4oE6tSIfiteGpQ1Z1XR/qfRdS738RDk8+zQS73+z9Lq4qKsN6OeebkneVnXJR1Y7WYywFMr1leFbdbrTDwCF7TpwlNe2vwwD4nuzfYUPz4+UENovd0XZLYMXTPEksg3+pd+vI76c6E0pgguB+EbNk3f1HfASD3KV3uPj+7CsoNZiG8auDRV+N8HtxpivBP4jx9+eUZu6ubH2ugH2tvjQo9xPDeVE1/yEVsXBnWfKFSKbPrzKOHLEZzfReyX45xRaEYV2skB5VPv15JvOywra4Dnf6Rfi/kd3c0iSrfBjKDMi90nyx8nxnZbMiSZBxmGvq+IoewLmK6/8VrO6IrY6o/I2DFU3dIbLytRXyElkEbuKIvzYnf/DG0DMJukaKMqhJ6IPooMNO53NLVJXBzY34fkYIvRkOpoG4tvR6ZVh+DbfagoPFYzkpbvlDd8nOCjinGEimedUKrtMPy84IvVYZMiDWIrpiv2kvR+vXrH/YIU1m4Ok06c1+QOk11Q9fmhFUMD1iq3ZFWfIK7gqP6ncjv+pziY55C2Pw1LFnXoGJbnxgPcYKxD32eDYCn/xwLBaovyo9IVNu9e/VOo7VYLXXxYWZVcv3PYRrlEOzxcTGbtIT2gafJD/x1Au3UNdNnhzzRxQHxNjw9y2F2mJJE5C7XSLf8654AfWRzSr2muEbjZyKU/GOxcrVyMOEYNtIL3cN6Xcf0Lgu6xhiObxA/phZlzImgF9ZWTxkxzU0R9mDfEkH/yAx77T7KQk7aFP8NmYAw5+B2l13hkpHfHeHU3522yLlP4lhyrUIDd/tUruhwQU5yX1NRcJYbaI46ZijER5XWhBhweRGHQx1GxEShamTk0HCZlFKnH9g7VxStQLttUKoFDdCw7f3agmpXVgvZGL7WYLH8CakMacQTj1yBl2pawbvxZYjxDl8YOgRl6g7YumGrrf+dzunrw/I3Rq2S6+tQz9+wi9k6/NiYr9svl/JVsa1CxszZJouJ+ttyIxFE/haGQYMvXJ7P3XngEdNE5wFJHjktRCw3AYFIEERwZVgtKlgJ5SiIbMy1yx7YMf3cxI3lnQqCMjjUZWfDqFiSlcVJwATaAUW4nSu08zLOuEqZjFAawmvneRti88wVMMUfwhnVrK8g0DJQNgvF6o/y/Gx6ogX1Ye4frNvhQbWGjgeAHZkLIqij8ERbbntgW+5LOzK2+winrggEgE2tmIPl5mBQukK7AW8Xx+KFKQ9WXZ+ba4qNtqQyDojdp9j8qKvFoTUnlE9AB0fk9Ooj5JCqYH0V8VwjvqUjjbdoRvkOqQEwD94tMmi1ee37NuQCSPTgJlChE3oDEKLsQBPfx6ulD6MCefjCD6Ws0sfogo7uu+LYCRIRZw4uS1hmUhtple5W2x37BIQq/CtBT1ygFqFunvfEV9Lzd0CEcHT4oCXV6l1KMkP1SRd1m+n5rz6RXaxK3mxdmeVxsYLSHvx6kl/UBsu0J6emLN4gNy44fL6pLihq7RGQseHFP8OKII4dgh+gS0a7+B1LCKakMHGdtGtkwebUYTrRqnHBeuS+xtWObf3DA91BoxGD1QApm1BQkvLRCNFxxdEMO9q6BEqtgHBFC+NY+RL0npxZCpfGtbgowdJiVK6vpeU6pB+YSP8m/45iVi+6NOQBk/FBZIIGqE1Fv2kRm/MQjNQgxE8Lp5q6+S97aVQrdnaBd+hrPNCKXTHMLx2ZzXz7vM48w3jb6XjTS4TFCK4mhgEFpqWSvodt5UAbPwE97o+Zjalt6ORWxRjc/1boOed+rcBDiJzcbFWRWXBbAQbgZL2BBfLdJgvshUqP9r4x8j1SOI+j53ZoY+/ye+bLPXT5pxSt9c1KGM3U/eIbXzUJB3OypLGGHcW4HPU/EUy4F/JWDJDHhDArN62ZR7DiihCPKwrP+uR+22e7AxAFPttnx9eBrAcHrAD1r/g5lGbPyjLO8Yf38OSXMc1YPzT2zjlc7gzz1ev0zAFHcP+VnC2KKK2SQf5QRv7NPrgQGx3QRXPLU+ynVOMv+U4/tGsnv1zPAAqfEFO47oovVR+dnl+DJBWVd4iY3+Am3gEtY+eDYNEL1iS7pPoM1ZNvBNZ228D7L8bUAPQbxOMaESCXBdgR+L7M08Nraxuh381eiQQICrrptg7Wzylo8xUOr1bR1862X6fOWvAGvt8lqx+jEbQUB54OycPg5l656AVCGwFOUBQ9m7LiyU5B8dV2QtXVt+w64TirIau6NmR4RuimehcIeAsi7SYju0JJUQ2naTF0nM/Hp4HtBUCLKbwZkhcNqzK5AO0a2xbyxMsbeOGki4E4/y5cgef5PGlM1qBkA3PSvCs2L4Ihpugv69U7pJs+nWR8+JWxZxo9cfOR83YwpUHok+tHogTdqdSrj3VLHr2djtravyAbIF1gXBCDvih04DJwcwegK6zTWt4PaptMrPeD2SsgohPH9en/hfzV2DIMqL8Coc2R3lvFM9F4XQSrzZInMhE9+A7K2tWbizom8SR/RG8KukGbvZZ7KXsGhayX0BElRaHK3eTJnwqRUYa28dib4qG+Mz59jZmwI8tCCOVVuYkHA3ZxV+evI4ryA/YK5b8jtUCcqnec06ieh+RQ0thWvTYiqFNVb4Hw3dMSG0ZLVE2heGs78kq/s1o9XobqNtk7W5kheA25V+DV84ad1BjAo/xNYdoZWWgpu7m5rBM6+7eAh7hBmzLqUJMagGAeHsnLi8K7t6kyTEkfXth29K0pSP6KIoqaPawgq15bXojCpcdwNSmFbgXfQYSdYcCNtlvtXM0z4CcWjzQJqAhlO1ssMC4+YinKwF8UMpqq9XwcCKsDEp4Wr6P65VbYbbMsWz/BUVPEDBJdAGZqCt0K54RK09BWOz5VWTzGxGmlvVst5+U7mzsShfwMErNZA/5F5pUZcj7D02B22a+wEWi37SfYD59h0586FgyysoK2gE4GuvkaSdtismPjpOevhqi4J+ZI3JFhQJEW2L6HrTXePG9Dp1A2nd/WYBSOrrDB2MaWsdpLDEqA3vqy11RI8j4vKhAjEgDBstt9+HQUFTekRXnFjJntiZDa2YbC8+6po3HWwTua/bL4CX/b63IL6Fjh1jhiP/x3osfowag3oMx5OZ6xGFtmoHR1AAEr3cAfFs+Y1rs0yaa75G1/iebbpdV29B6L/PGpVbE9HqkrbIsjv34ca3pKg6w/gmrcAWX015OaFrswE0eAOwUPIGpcIX5/uAixEY8SB5KqiSKjEUIUqi6n+4X3cz95/4lLKoglg1N2c/jpbYzOJy9AMVAOpcDS33nmQvBAWkdWw1B3+3pb9zJKfEhwzcnZ0IZg5UQ596ejeKbWjAexhUESJfy8Pa6/YRT7OhUMHuVU/qKkZCb7ViOFAsjDjNzl3fYNDAXzd9laCg4zOlQ9n7I1ehLktv+kjQIJ70hWvJ9+ATDxrl4IyQo9Ev4HLgt0Wowfmo2QpEQHvR8UKVy6c/vCAjOBTmgQ3Baskko1Zdlnv5JXPxfNJDqsF3XNu86pXuadEGlmICAXLnmrcJjg4fH40GQfiI1SeHyJU7IENRTtuHmOTt/NaFoo9bpTncXwOftmpbQqnuJulNc9IcofJbQPbzmxQAzBd69r2Wh97aD5miR2EjMH4f8xOO4jROKPOLf5aTfgbn6ea46Hd4vsOmZOxSdpKPZi7wvwwcpcOkYGOmt4yzKYhHyQ7EBlVBnwEpWWoQFNcqCqnJIfN2BFeRAsK2d3/wfIBfp0gDJmO0mF4dhh9J/u5o8am17GtFPzUWtBuxd4iSyJ7fTDnu/0CTfw4yX726EuqcqjFvABKHvLd/qWByG2IrpJeTDj4NYOjodTTIFPy3KWpYgXWLkcKk2llqAyyJIDCTa1M2MUKtsxmkohodFbJe9ICFg8UF60iwKpxxeOHdYd0zAjv4U3neiA9pXju0kt7VVDwffL1tgc1b1JZgPr5I5WpHscpd+SByiGJanz1Mp6cCAnMqlICsALSDwgQA+9gNzchVljCA1Lp0kuuABeVqymmdEO+51/cCuqTMpHgVP6iOWcVyoKIibieAHN+vhn0KlTrQFF4Tf3RLVpOLxHHigjY66MuBZ8Lu1t3dY2p0QtmdcjQ5LS7+XnqkZVVrRpK/WLryGAm181Rj6bQ+2cB6R01XjsEprhPbZpcxm7llbtqGpPaLMN5+w4b9TzlGtkmjqWPacFZoMCING/PpH0FbCYD4rpxdOxKab9ge+sLLczyp5pHot5Wv32XG2dUNJc/cqDe9SZRQ3BDJN/u0c0FBN5fGx3NeHFXPmSnBkXekmjYybzX80jbgqBa5G8IM5Vft7UUMazW4B2l7U3L9vhRNL/2e4oWKl+X73dXc8qTvrbFHNQv6oPpJxYxzeCnyyeG7F5XlqrS8uKdQF4Dfa8V+s6d016S641Yu2KuWeEV4jwL9kOlsfwSxlTHOOagWKIIwk28qf/mHHQSO9bQWUUYTa6U2Y3vZcrt+dcrgPxfzRw2fpb8q+ZU2M9y8d0wcSmwPxgLaFZGlEJ4/Y9ciHEjDv4Ec0CuaYbDEMmMnvsMWxkRhV/ywM5b4P08DgWx6riCYACogGXtlg5ytjDyUxAHak/g9ryHEHlBd8bvs5kkO8imj4qrbMQlef5LTlNQ3ne+IGWSHqoVjlxrG1I3cg49uNsb1n0fs/4m6HEr8b9xdwV+kGatuKUjSVhufIo9dBovNIrTahrwHRfjns/6cCiNmWWEVUa1d5CWpSVhlqSc6iKWMRb+fw1zIqr6iSh08FOxB/1A+tirU37lrWvFL0NX8HVK+ud//qzdOZRzkF3302RSHOYVBVnK/PtUZ+HiYqojdTIfp/U6yFf2q0YIydS1DqeyPd58E4zfSpHztURke8nX9k/r8M86JtC0ckwF8arGPKEPNgCKS3GKgv4aqIW8tdYI2DjvGdrLd8AfzHE+Awdszp0fa1EaN4ZOD4f0YO0vnFEgOdF6AZOUiejsS8UL9D5rQBgd17JYoj6QnMRR6AO5F4TzSMnBWrAs6jBdalnp0XWOMDIINAl+JQ+HQwE40hyug31lZBmP9xB00lF0nbBr/+dFlVpH57VauftWtR9NEcPxU//qTy6LXe+kpVgnKVe88OQ/mCqQ4A3nvB0CvjXjXLFIMBzZ9NDKJpyMCwVAJIV+pScCcjV5JB8f7zb+CW8OPdWYdeKmn+zo1HImgiTnGKzf8Thak5nkqlKWQKr1plEdN8+tfCbcupXyP6QU3UrsjA9aLTSdrzv5M5YSRbQCigHEaABHgmqK4FuKvL0RfyfXl5mWNESaBK4Gp6JnB4BFQJ6Qq7/2F7f3VolTBP1H742HoM84UWWBHBMw7OqyuaS71phTZ8uPBl7WSAvg78W2YrjydAFgwiGpLX05Bt3hRROeMqawF+Sldl/eT3NYUvdA1pSrDqLevvNQ6vzgk2SbVkU4+IuIvIu7drAI4su7qFCupCJ0F/dQpG5eC9x4Ph8vYcONJCnjkeJfeoJf/ZwRjPkcsizIwcPqGGnviKsHsPrhPFr9ZLfNKrTnEwrK7XHdgk4kiEJJV6kYcoHiTMFtv+cBAZDfb035F3kNlUUHEUBWP+gVZeMs9O2pSh/OhlJk0Q6AkRAEbWnwq/0kCEhtLUUeJ/laECgn5/gycj2PXP8/09FJftbO2pjQ0v8oZDwWwGbJsmv/WtDEyMHFIGM0gy06FZ9jzRsGrs+LH5xsqH3fT2hXWQ6pjpsyMQxIBtNKSlwQ8CQ3doTN1+CK+Zy7RD362mDUSzDkv8b7+JpgLw3spyf94waIc2RtNExtpsOHo33kz9Sj4QcZHVAzld37VFdaALSaQg7A8FA3pC4DMKbYZXBRLr3WNQ5fr+0IPUR0VGC28u8QVPK6qQLb19MbjP42mLuaEvOWhcYpG0CDKusgsZ1ct6jkbQwB/rusgIXoSMhcyx3uTJxnV2rPdVRj1ODO9V+srbn9ElJOSBO0SABCwCfxL56NtJS2JQk42BM2mGGAL784XFyPBAWJpMdu/v4LfQorcBdhfk4nFEKKBbj2172TIHIKBTkhXJcZpE42mei/JIDPtVLmVb7KU266myA9AeusBOTtHNvq2gjbphKTJIDu+EAUgtYbYxv2xeI/Zxq74t5JqqKhE4/6ScaHHY6tt7XfNp/Bo5pITMRCg6H6a0n3wJ1XWFwFNJtP60B4Wlvy4KVTlT5DjoMrcp1Mc9EhVR2tkdczyOiekpy+otMI5HP49ZX9bHt/dQ2QrHYwgju+yYID4YI6FqVff9J43xrYgz1NGOEvFV/utNsmCQl60hB0Fl7qxhaVl8buCq2hQLAUefvQq3VwD6+q6GZ/FssBlncWOO4cQU/2mh/AtR5aJOms5Po8OwsXbF1+EYo+Yn67y9YqLeF/EO5MOa7jGzpkszlIBOdq46fDcEtD3b1KzE26rfLwaOUynzRcHscgAGVEoPqfLxEnmwJoTt/lm+4hDlWYx7KGupULbMRxsqamirfxs4z+UIAULzksninZaYU674CUPGFUGqB+YEKnY8JDYMGee4LsL1Og2BNvuCtZY9WDLvDCGOKcZ+28KTW7c38WwOVtzcFM0UUbGSyx2UmfUxqFgRpuTaAQqQjhQUTwOC0L9MFWgCbvEz/o2dsTb5QG0keMx/MGpyujaiTMd1DTPTmKKmy7AzMfUa+sW7tX+niZ6LauPvaecH2SmhiO1MdUS+g7xmMQOm2KHB5q7CU+5LbbHq8op5hK08n39Ed98+KxpE5DqEy8OOE06XY2Mww6GbulD9upDft9ccIItlkayGwqCH44jPR1BmrHM26a5uxqjDLx1+qTojFda3bPm/pzYxYUYv1o7tt43VH1NnRB5ncq5pja0ZuGa7Z8mpBcBAktY7qQ60YILp+8pPX9VeWmFzuUnzW3crZ621knodewvWZFoGUcvJrpiTclnDyF3bzM96JQMmDheGtsOrlMRyEsG0uENmuUtt1LZgr6jUauwxqOi2ozK1kTRSvaaLs1eZEvyY6wJ4A1zH/Gg/OEzGZHnBq7zewWs+01wJXMFGPn0AQMA8Ub3PcxNwQmdpsXhtmBYBjMa0rtz++5jNGmWnckCK6tsCQj6YHNyZ6M1LRhKkDPwkPAQb/vLphxU447TknT7vy8u67YGHq0+/LjQ9lMHO3cgc7Qbl2eTEp8QtFjhKy7vRmixJdjwYRR+2MxI+vWZNyXquDMae5YM7Xcsrb0R3WM5OnNYKHS5lmUDWKyTREn8hcKuxFKiA31iDhm7Vtpg/8+KUXu+ctdD7a35oBtv4yTHIgu7tFCHMGbhStDeLo+r2p9PSDlfvoYp1SmtbXxDZjGU49cLADrgawwvAF6/5/Pj3+ZoFd6v2dxWjHpa9UwqKqlR8/DJG5pE3uGNwS7HX0lAK27yugyW/fsF2hZDGwIb8UMjZ5qPf0S2d3I1M8qsjDKxphJRjNjnuNOF3PueAOZ7BrJZiAd3CGg2U1cMG6T6jGD5tx2+Dipvx1PyL2edZyE7BdMpLwDpVk00OsQGzufwjmY99AHmvHdhgcl7OqgYEu3Lv/kKhaJq6o8uGntPqx26V5GQ2hf742dd7sc5r/9hKcymo7RMEAlXx0FF3MvG63w7wNhP7JFpsF9+L2T6kcmEu3ESzZmSZ8ZUn32P2r/7qpBazrTADfNHhjM6TKJI71XTZHG0D4uU0tWoT+NsFqssvT7yJ+O8uD5MRKiPlU0JUeLrDP0/WiO+i0s4I4BEt5zeAHUwM4OuaNeu7DMMv8T9k9vUbOy0xoEaFDkNzvuw6UbhjokVhLurt7IaiOL/xkUBDfUSxy+SOxLTw8m7FyDD6C+bVDmaVom/I/ZknSecG62eRfBZhkjQNooxNu/ioUsZ0pTCIm1Glz1/4nwmq0UByY1WlI1H0z4l3Ydm5b9Yxm9Orbh6vT6koV1ewAJ7P/mgSMby19IIaZMxbzpSKQnQ6M1ifiyb8a0GfYiqO5EmKd372gdunsvfGj+gB7ZwgsSs2AKktwiMisF1c6Dd7fB9iyd08ZAMStnSJHUCyDe56AEvhXXdIo0GS0sbt5kZDKy+os7NAmOIAYsvQ7UIIaqfguM6KIP4fcNpKNwK320X5DfA/sAY0kHevYnn06bffdax+S0zm9ZLc7ZGb/6vXwNxl1pQIrGK9xnhX0e/FnNrQGVU3qJuiB8tQ5Ti7F4QpxtjrrrNhM52Ec6TfXgw8CUrYXgq+UiPlFphPz0+te7E9o+hc9Fes46Fpkvl2NyPM7bx4kdMgHtCoLz8bWyRX+ektfuWoZz5Oqda1svhVLRmsGk4QECHK5JRKdRwsiRY8UFWdKGeEbMVMD+hvYoNv1RLctaC7lYviWXIHCVg+DnNeVVUMRJkIpnhDe65hVtih2HFintADH0nCiB2hUoSouWWUDdyZd4YSCM35zaMS9BM+7KdvWX5Kow/YKcMd3mlz7ydBQoA0ofeSpVvgjFPEOkxTfnUn8tXmG4hWIxfVZsvok20523i9n6UXVQ6LTAfggUNLXjFNP1o2yG38XzensgXs2B7NpmaPoH+UvFuXimt1sTVOMKNn0kucQq+y0G6fxKBy2FmzmWlqJEY9viluwnPCpYkGRcAuk1V7lQPlmnuXsFZTM20FhdvaQ6qBx1F2kg+eeharxzWnWjPQZRqDCe/MvpBGYk+eoGENeT0TfT5ZbZ7oUQAeKlksSdddj5jgXgFoJuyWcy+FQV6YQ+7uHB68lqzuIOR960EGi2Ips95dUiUuaYbLJ+I0CZtt8UA2duH8kvoe6bcNq1BbJbbtTNu9N4fbaRSRqSgX/hrQYT5jRfE/T+CCWzNieyy8/SAZlyA8Td1VFJTC/jKAwqW5hjpyCWeOySyEHEi4WLzqf3k8uiRxshdtvd3skO4IjkXyQzpg9rr89td+8VtcgknGRVSeHUH+2WukeP/SKCnntestVVEQEghIJSN+1nDbj1shTNqLzbs48xB3CbHaNBh4fwvavyo2x12PnEA+LSYJh3ogYiwf5VjMERZ4gApJVlCBlyWgfNj5y+qWn2m3OFTJW+BupQMwZck6QkyW/JzdFcroyqpVSfzWXPv1afc+480I4rL8c8ZVkMSUQ/YZM82DLfBhCPiO+SOJUvN3w/dUl+xYXrLhXKaxarkcZrby8IvjC5zyzkvrgk5GpwQ/zPNl5dIS+QKtHBbF0mjHPDKhdonW3wWGsYRL6Ikp7ywcCOYVrBkpD1Wnpw6fBXlXoR711/5ksOJYL44yg1h76nVv6lGjA8cMm6v8DzsFiaiMJcFr2lPPpeUIO2DOf0TcciVX56oda8V7sSUMOCY5BSpXEfpj07Ekl6hDEtmlb5LYAxo/3qbxnkatdc9nwwwmDvOPuDuDZf1V304z3ul4etVYfbHzSEqaFCa+eEZ4nTcIj1eeKx7RRFLX7ZqK1M7prjjNGfdXJAG0sowpvy0CZIyE2Rub06ktCABgLZO8LnjFVgHYDDAoROmcjofDd0akHyIwNYSdsYYSlh52i0SvYDQdpT6vOwF1hGi6SQEPMm88Hx9Asj9wzg0w2dL5T7L0x2CHVAeyE380Y5bRCEDmP4yxR5AwklUIovkeORNSu/C5l58MnqldVezsslLFe0v8Yq9o041t+YfHgZKnz8LjXsmi1UZ0lXI7skw3tACV5lQwHe4GaQWQuP5cw3DUWlzaR6YZygEkGawaeMV5luU5upGFrUd98UWhUWr3lc+GAdXv/41xVuPoFnF79EVJSQPjdUGGuZxyZr15BvZqYpvJ6GMs2CLVoSAelOXDppKRZVtquC87F5q0iSwZ48yY106cgkMNMn0QujzAYJ6iLB4yZp112s6n5/eDvHWYYvR+EZakThMLFMGNByWBengpVv0svOZjwZqTE5nJWnDnZnnsYNx2ns5g8A7LLXoaGCvdKdSFi5n9I57CpsHXWsSQW9XKe8aVW4RetgxQpE8qhQL/1SgAfqweexNCmHTQcH1e1xUnmfsZ990OyHqvZL53MuOA2JAm3O2BcuxJ6wjS/7tClp8TYn5JREq7esAoTUcz2cOYVFPmH0kZ5n++/KGR37u8utCbT0uvqmvf/NpZZLyXjT7tbMNT0/QbnWdpNZFDklSzmzwA7uxdEYR6eQvaB5OCTCrfyuyXqMWuFbll3YsFopbcQdg5w5L12YZ8F3ve5oInAN0bbtlyxBR3QKqCcvHYeStaRwQsPUQxwlcA/g+LuiOyJ8RRd6OEa/hL7iG9ZM8qvXr2QHeGBq4Wv6VQW16YWT/u3D0ER7G1BfetqweLUyNiKHzhaetHy29eAe+RLDkveq7GwTeR18sskYDraYiUP2/pshYR+dIueF1rhtWklbxB3YqhUcIlvCo+9NgEqoz7gjZyEjF3cuSNOV9paJjrsHiH7Dk8XGJCmy7+gVwP1qced+fxSjLtgRaEjsFprWluCGmb1qx8S4rl7s8uyiY2eVuJcIEvuhMsHRr9i+SAoppDtTIhQ/7+SEJB67eSAHId8SUTFTVHdiGFA+QCP8gWH7LSuVLlvT/zIcKCvnL8naRXBxq2DKdAEWV36VbMDz6MAtwGJDqjMPc+1iFzLY+3UJhpoTJamiyWyKZw98FndZK8Iag0pNKLWmDRch0CmjhgmxfFl4IO9Fzlzre0aT47D4DqUbRbNeOBYGvz5Cec9mbM+hdXxnGo/C6fghE3lPCWwL2++o1lQzemxP1JdpwXm1MIv4I5VrqnRCXvGrX44cqABxcaf536jTLoOefxZebWnvibXKq+kjcgJGVu94PwYkb2gHC6AI7VcIVyUGsLa38AE1lmrnF+RgdrqKCF3J9XEJdPYqw2RX+TvGjAUmjkn1/kPbmQ6CO2skCSYGsXCsk1108mfHI7nrWL0ck4Z7jfKatsb3/rfUVhuGoTIT7o1aZIeQOb+sOy4z1mJrPHZWVt+UvehxoGYwNUWig7pkB/bTc1ox908jEC5KbEfnI3EiNeB6AOXM8NAS5Cdxt/WHmLrIn75wmakmX17GMY+G4t+dc/vosBgQZoQA4jFul0UusL1Meo+xEsjnudEGAURu9xJ+Gt7bbJmFx2F8Lv5dcr+bQvgPxyb2Q/HHoPNm1ii4pCzj0ZWZhsF9S4LeYNjy8GLleFYZeCw0n7Dht98964mymic77edn73Mmyi/MUYIoS2D7bjqdzjnlI7evrpVLZJtx6/rWUBL3kQdaRJg1mcSDLK8N+ECx3Dv6MWvR8MsDQeLnUt2iPZEf4PkZAIF9AkSkYoY93wHLSsfNiaMExZayYr4lfy0XifbY1vaErb8bmZX2Qv/c4gyYgEtYinglBfFhCFZY7EU83oLUmz/tc965GWoTSxi1p0hAXURNE2lJRxJqVrUL9AJJPZI1MJL91l/5GDnEiyxwMu5JQIgBsAkXm7Usgz4s3vgDZR1ZYuuhJIqFuXHQ6K4akWom41g1U36UGoiabZ0BsHo+6RcTFVUlPZXfYB7krXT5UKRUb/knCjap/tmBRrUc3rnKT2BEENXTvxuJtx3YRhIPHPo9S0ByGr9IiAJMHGYRMyD1Zf/18NQUUm3zroboWl6nRCeKxOJaCsJmKgRzRiZMxUeuU5sZk0yDxD4zh1njzNTLU1xbML3UWRXJZnFTJ2P3BhvG1w2kOWgnfoLJkqKoJA0hT1og2dPSfkjwuLWKnGx3G4rupcsHdNAARVeGocYt7uH/H8XGiR0ZXmowpy9hEncIGnEndh7ezcDoEWRmitrKi3cw3kmPyI6mQ0f8D72nxhCEbqpNl8vTwrP09YgnVsa3m4YVnbikFjuiwKQkeQj/bnJAj+CxB5Riw7tIa1X5hOnzxPLwSVteXJ8gpB/fzsnTBEJNvUMxzADj/CeGEHJFwAHFPi2SlS8cSNvwlyBzEbADqZBlNtgcWfDqPdxBfNGIYj9d4+jv5IyxaP8GqiGe5V+DjVnc3VeJT49gOxG9yOgmz35lC5Wf/JoHobNcZjuyS/kTdiZFhOT7HEf1+1Jxi0Omvu5NL9fXh5uwX77oKnR531IHw+nxtaTUujRZCNTSLGNZbXpAViIEi1QDYCSM0ZAtMTdfuxQSDazgwmC/0DolcugLWoqCVmS80zfORiSx18Dnw8XfoiyQRBvT6bnDraxwL+KDndt9DjO9z+MWZWU9vw822xXpDbLrLfemwlP+YlQwvYHPfdI1zkIbgsj0V2w1UjfN6UkT/BIGQIQqPiCljWAzZo0rXqGBaGNbCX5fqK0l3uMkvkoCMjr2jWiIjOB7lbMl/ehSCTHFoBTVCYD/CvsIPk/l6szmxwTJamAPHACCv54/G8xcrzCRcWTHd/nn7DjPurfzEhpgWGMyn/nAEpGYpm34OXhFVNW9qL9WXvd51mrOLo0N7ReeDePjBc7FiufQcCKR96sSMU3cGATntFCVWIO4Ttefy65tiI53APAkpYMr4m2GCnjoDuT4inMy6QniqpPsXWjep3Lel110Vw3MFpnsXI/Ggzof160xIgvJ7Vg0m3eqDcKlm2LaWfJFCAUKa6f8EUkYWInFBlXmnpm6M6jYad2nrekU6qZcRbnNAhWnf0km8T614I3PaxPXbCFhxeZHTmB1OHn/NNYJDQXVOHQI6LQ+CTOKwrV1dAcctAV1o4RmZcmppxFkf9zGJ3D0EdWS1nS2DRTGNYOtzIKe3ovcLfy0rYe4jH6G3tcUGY1Psstf7R6jk7E1LQ+UaKPfCOtbs0AldItHjxIzEq4gsRKgAOlSzV2PdFj2mvL2x/adkfAM4y6MuBVoqCk/nsgktrK1joG7R+h5TMbBuRYwjZk8GdOV5Q7mwOXN7Id1ghKuEtebbnvse+Z4jseGWluhBvhJ0a8MDJdn4NuyIN5QRmEFM3rCIhpRR0iHpw6GY5iQCJC6mEeWVCi3nqRL++XgSR7gkvk7G3uIDkJYLZiAh42YDM4ulN13agryhFufl7mPriS1y2aDoCazpeGSfnefjVndz9s7XJct3PDcjV6zk5c3eGnc47cb0WM2yJLiMLIp3ghhOPbsgXJZf4sAP6F0I7QfnTtcbLPucC7oFgLLXaK9hJc7zUOhgEbmkKmy8xGD767KR08f1I9nKp4nxbOUvVXt50zeVQFLbENIAAlbTTs/EhnEoKenztM3SixwRSjch3NERvCzKLw7ToXDQFRdpx/mJZpJw8TfPdjOieKzsompb0mKAkzv0ND/wJ9fWAfHpTLLJdc5NcjMmi6FX/Ca1/yqAueEhPMRZ3AN+WfolSwOaJLiuGPA7a05K5OOhpYnXYOSO2Img1sh58j9iNeUe+OtpRMjMEHl00cvT9/tVZkUTwrB7n+qcvv/V67M46F1M98vtDm+AMbegnurt7uzJ8Nu2uMW1WJnhcIrLSo6HZYaiHTzVcCMRoSE5J6K8QgSAQCYdhWg51dJFL2kQTCxm0WCU7jjH4KNouvCS2gl2sIHnwcBGq2NQin9R4hYIB+KHK2OPwv/d6Tg4gd3FU2C7qoF7W27u07d6AJClq/axgcdgNZAd7T1GRc21fkb3eXllR9ovVlYxLY657HR/vC9r2eTAAAA",
  "Magnesio": "data:image/webp;base64,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",
  "Calcio, Magnesio y Vitamina D3": "data:image/webp;base64,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",
  "Vitamina C, Zinc y Vitamina D": "data:image/webp;base64,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",
  "Vitamina B12": "data:image/webp;base64,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",
  "Colágeno Hidrolizado": "data:image/webp;base64,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",
  "Resveratrol": "data:image/webp;base64,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"
};

function precioPorUnidadTexto(p) {
  if (BLISTER_12.includes(p.nombre) && p.categoria === "Vita") {
    return ` <span class="precio-unidad">(${formatCurrency(p.precioVentaSinIVA / 12)} c/u)</span>`;
  }
  return "";
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

  const marcasDisponibles = [...new Set(catalog.map(p => p.categoria))].sort();
  const productosSeleccionados = catalog.filter(p => marcasListaPrecios.has(p.categoria));

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
            ${catalog.filter(p => p.categoria === m).map(p => `
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
  const marcasDisponibles = [...new Set(catalog.map(p => p.categoria))].sort();
  let msg = `📋 *Lista de precios*\n\n`;
  marcasDisponibles.filter(m => marcasListaPrecios.has(m)).forEach(m => {
    msg += `*${m}*\n`;
    catalog.filter(p => p.categoria === m).forEach(p => {
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

  const marcasDisponibles = [...new Set(catalog.map(p => p.categoria))].sort();
  marcasDisponibles.filter(m => marcasListaPrecios.has(m)).forEach(m => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(m, margin, y);
    y += 7;

    const filas = catalog.filter(p => p.categoria === m).map(p => {
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
  const fecha = document.getElementById("vehiculoFecha").value;
  if (monto <= 0) return alert("Ingresá un monto válido");
  if (!fecha) return alert("Elegí una fecha");

  inversiones.push({
    id: generarId(),
    marca: "Combustible",
    monto,
    fecha,
    nota: "",
    actualizadoEn: Date.now()
  });

  guardarStorage();
  document.getElementById("vehiculoMonto").value = "";
  renderVistaResumen();
}

function guardarKmMes() {
  kmPorMes[mesResumen] = parseInt(document.getElementById("inputKmMes").value) || 0;
  localStorage.setItem("alunexa_km_por_mes_v1", JSON.stringify(kmPorMes));
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

  const categorias = [...new Set(catalog.map(p => p.categoria))].sort();
  const catalogFiltrado = filtroStock === "Todas" ? catalog : catalog.filter(p => p.categoria === filtroStock);

  cont.innerHTML = `
    <div class="page-header">
      <h2 class="page-title2">Stock</h2>
      <button class="btn-guardar-ahora" onclick="abrirListaPrecios()">📋 Lista precios</button>
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
        return `
        <div class="stock-row">
          <div style="flex:1;">
            <div class="stock-nombre">${p.nombre}</div>
            <div class="muted">${p.categoria} · s/IVA: ${formatCurrency(p.precioVentaSinIVA)}</div>
            <div id="form-precio-${p.id}" style="display:none; margin-top:8px;">
              <div class="row-2">
                <input id="input-precio-${p.id}" type="number" placeholder="Nuevo precio s/IVA" value="${p.precioVentaSinIVA}" />
                <button class="btn-success" onclick="guardarPrecio('${p.id}')">Guardar</button>
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <strong class="${claseStock}">${p.stock}${p.stock > 0 && p.stock <= STOCK_BAJO_UMBRAL ? ' ⚠️' : ''}</strong>
            <button class="btn-sm btn-outline" onclick="toggleFormPrecio('${p.id}')">✏️ Precio</button>
          </div>
        </div>
      `;
      }).join("")}
    </div>

    ${filtroStock !== "Todas" ? (() => {
      const inversionesMarca = inversiones.filter(i => i.marca === filtroStock && !i.eliminado).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      const totalInvertido = inversionesMarca.reduce((a, i) => a + i.monto, 0);
      return `
      <div class="form-card">
        <h3 class="section-title">💵 Inversión en ${filtroStock}</h3>
        <div class="form-group">
          <label>Monto invertido</label>
          <input id="inversionMonto" type="number" min="0" placeholder="Ej: 50000" />
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

    <div class="form-card">
      <h3 class="section-title">Resumen</h3>
      <div class="stats-grid">
       <div class="stat-box"><div class="muted">Clientes</div><strong>${clients.filter(c => !c.eliminado && (c.tipo || "Otro") !== "Otro").length}</strong></div>
        <div class="stat-box"><div class="muted">Pedidos</div><strong>${orders.length}</strong></div>
        <div class="stat-box"><div class="muted">Productos</div><strong>${catalog.length}</strong></div>
        <div class="stat-box"><div class="muted">Total ventas</div><strong style="font-size:14px;">${formatCurrency(totalVentas)}</strong></div>
      </div>
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
  localStorage.setItem("alunexa_nro_factura", n);
  return n;
}

async function generarFacturaPDF(order, modo) {
  try { await cargarJsPDF(); } catch (e) { return alert("No se pudo cargar la librería de PDF."); }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = 18;

  // Logo
  // Acá va a ir el logo nuevo de Distribuidora Chaque cuando esté listo.
  // Cuando lo tengas, se agrega de nuevo: const logoData = "data:image/...";
  // Mientras tanto, el nombre en texto arriba a la izquierda:
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Distribuidora Chaque", margin, y + 4);

  // Título arriba derecha
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("Comprobante de Venta", pageW - margin, y - 2, { align: "right" });

  // Datos de contacto debajo del logo
  y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Santa Fe, Argentina", margin, y); y += 4;
  doc.text("Tel: 342-5040728", margin, y); y += 4;
  doc.text("joelalunexa@gmail.com", margin, y); y += 4;
  doc.text("www.alunexa.com", margin, y); y += 6;

  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageW - margin, y); y += 6;

  const nro = order.nroFactura || obtenerNroFactura();
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(`Número de Factura: ${nro}`, margin, y); y += 5;
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

  if (order.notas) { y += 3; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Notas: ${order.notas}`, margin, y); y += 6; }

  y += 12;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("¡Gracias por tu compra, vuelve pronto!", pageW / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
  doc.text("Para más información, visite nuestro sitio web o síganos en nuestras redes sociales", pageW / 2, pageH - 14, { align: "center" });
  doc.text("Alunexa · Santa Fe, Argentina", pageW / 2, pageH - 9, { align: "center" });

  doc.save(`Factura_${nro}_${order.client.nombre.replace(/\s+/g, "_")}.pdf`);
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
  const marcas = ["Alunexa", "Fungimania", "Vita"];

  marcas.forEach(marca => {
    const productos = catalog.filter(p => p.categoria === marca);
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
        PRECIOS_DISTRIBUIDOR[p.nombre] || 0,
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
  XLSX.writeFile(wb, `Ventas_${d}-${m}-${y}_Alunexa.xlsx`);
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

// ═══════════════════════════════════════════════════════════════
initOfflineIndicator();
cargarDatos();