"use strict";
/* Alquiler al Día — lógica de cálculo (pura) + interfaz */

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MES3 = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const ym = d => d.getFullYear() + "-" + pad(d.getMonth() + 1);
const fmt = n => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtPct = n => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + "%";
const fshort = d => pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
const fdate = d => d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear();

function num(s) {
  s = String(s || "").trim().replace(/\$/g, "").replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  const v = parseFloat(s);
  return isFinite(v) ? v : NaN;
}
function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function addMonths(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), last));
  return r;
}

/* ICL: valor del día; si ese día falta, el último publicado dentro de los 7 días previos */
function iclAt(icl, d) {
  for (let i = 0; i < 8; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    const v = icl[ymd(x)];
    if (typeof v === "number") return v;
  }
  return null;
}

/* IPC: mes M se publica a mediados de M+1. Para un ajuste en fecha D se usan
   los últimos `freq` meses ya publicados (día >= 15 → mes anterior; si no, dos meses antes). */
function factorIPC(ipc, d, freq) {
  const off = d.getDate() >= 15 ? 1 : 2;
  const L = new Date(d.getFullYear(), d.getMonth() - off, 1);
  let factor = 1; const parts = [];
  for (let i = freq - 1; i >= 0; i--) {
    const m = new Date(L.getFullYear(), L.getMonth() - i, 1);
    const v = ipc[ym(m)];
    if (typeof v !== "number") return { missing: MESES[m.getMonth()] + " " + m.getFullYear() };
    factor *= 1 + v / 100;
    parts.push(MES3[m.getMonth()] + " " + String(m.getFullYear()).slice(2) + " " + fmtPct(v));
  }
  return { factor, label: "IPC " + parts.join(" · ") };
}

/**
 * Cálculo puro. p = {monto, inicio(Date), freq, dur, indice, pct, icl0, icl1, hoy(Date)}
 * data = {ipc:{"AAAA-MM":pct}, icl:{"AAAA-MM-DD":valor}}
 */
function calcular(p, data) {
  if (!(p.monto > 0) || !p.inicio) return { error: "Completá el alquiler inicial y la fecha de inicio." };
  const rows = [{ date: p.inicio, amount: p.monto, label: "Monto inicial", pct: null, ok: true }];
  const iclOk = Object.keys(data.icl || {}).length > 0;
  let cur = p.monto, blocked = false, prevDate = p.inicio;
  for (let k = 1; k * p.freq < p.dur; k++) {
    const d = addMonths(p.inicio, k * p.freq);
    if (blocked) { rows.push({ date: d, amount: null, label: "Pendiente", pct: null, ok: false }); continue; }
    let r = null;
    if (p.indice === "fijo") {
      if (!(p.pct >= 0)) return { error: "Ingresá el porcentaje de ajuste." };
      r = { factor: 1 + p.pct / 100, label: "Ajuste pactado de " + fmtPct(p.pct) };
    } else if (p.indice === "icl") {
      if (iclOk) {
        const a = iclAt(data.icl, prevDate), b = iclAt(data.icl, d);
        if (a === null) return { error: "No hay valor del ICL para la fecha de inicio (" + fshort(prevDate) + "). El ICL existe desde julio de 2020." };
        r = b === null ? { missing: "ICL del " + fshort(d) } :
          { factor: b / a, label: "ICL " + b.toLocaleString("es-AR") + " ÷ " + a.toLocaleString("es-AR") };
      } else {
        const a = p.icl0, b = p.icl1;
        if (k > 1 || !(a > 0 && b > 0)) r = { missing: "ICL", manual: true };
        else r = { factor: b / a, label: "ICL " + b.toLocaleString("es-AR") + " ÷ " + a.toLocaleString("es-AR") };
      }
    } else {
      r = factorIPC(data.ipc, d, p.freq);
      if (r.missing) r.missing = "IPC de " + r.missing;
    }
    if (r.missing) {
      rows.push({ date: d, amount: null, label: r.manual ? "Cargá el ICL a mano para calcular este ajuste" : "Falta el " + r.missing + " (todavía no publicado)", pct: null, ok: false });
      blocked = true; continue;
    }
    cur = Math.round(cur * r.factor);
    rows.push({ date: d, amount: cur, label: r.label, pct: (r.factor - 1) * 100, ok: true });
    prevDate = d;
  }
  const hoy = new Date(p.hoy); hoy.setHours(0, 0, 0, 0);
  let nowIdx = 0;
  rows.forEach((r, i) => { if (r.date <= hoy && r.ok) nowIdx = i; });
  const next = rows.find(r => r.date > hoy) || null;
  return { rows, nowIdx, next, hoy, fin: addMonths(p.inicio, p.dur), inicio: p.inicio };
}

if (typeof module !== "undefined") module.exports = { calcular, addMonths, factorIPC, iclAt };

/* ───────────── Interfaz ───────────── */
if (typeof document !== "undefined") (function () {
  const $ = id => document.getElementById(id);
  const data = { ipc: {}, icl: {}, ipcAct: null, iclAct: null };
  let indice = "ipc", calc = null;

  const KEYS = ["monto","inicio","duracion","freq","pct","icl0","icl1","locador","locatario","domicilio","periodo","nro"];
  function save() { try { const o = { indice }; KEYS.forEach(k => o[k] = $(k).value); localStorage.setItem("alquiler-al-dia", JSON.stringify(o)); } catch (e) {} }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem("alquiler-al-dia") || "null"); if (!o) return;
      KEYS.forEach(k => { if (o[k] != null) $(k).value = o[k]; });
      if (o.indice) indice = o.indice;
    } catch (e) {}
  }

  function params() {
    return { monto: num($("monto").value), inicio: parseDate($("inicio").value), freq: +$("freq").value, dur: +$("duracion").value,
      indice, pct: num($("pct").value), icl0: num($("icl0").value), icl1: num($("icl1").value), hoy: new Date() };
  }

  function lastKey(obj) { const k = Object.keys(obj).sort(); return k[k.length - 1] || null; }
  function dataHint() {
    const h = $("dataHint");
    if (indice === "ipc") {
      const k = lastKey(data.ipc);
      h.textContent = k ? "Usamos los últimos meses de IPC que el INDEC ya publicó al momento de cada ajuste. Hay datos hasta " + MESES[+k.slice(5) - 1] + " " + k.slice(0, 4) + "." : "No pudimos cargar los datos de IPC.";
    } else if (indice === "icl") {
      const k = lastKey(data.icl);
      h.textContent = k ? "Valores diarios del Banco Central, publicados hasta el " + fshort(parseDate(k)) + "." : "";
    } else h.textContent = "";
  }

  function render() {
    document.querySelectorAll("#indice button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === indice));
    $("f-fijo").hidden = indice !== "fijo";
    $("f-icl-manual").hidden = !(indice === "icl" && Object.keys(data.icl).length === 0);
    dataHint();
    calc = calcular(params(), data); save();
    const tb = $("tbody"); tb.innerHTML = ""; $("chips").innerHTML = "";
    if (calc.error) { $("heroTxt").textContent = calc.error; $("heroMonto").textContent = ""; renderTalon(); return; }
    const { rows, nowIdx, next, hoy, fin, inicio } = calc, now = rows[nowIdx];
    if (inicio > hoy) $("heroTxt").textContent = "El contrato empieza el " + fdate(inicio) + ". Arrancás pagando";
    else if (hoy >= fin) $("heroTxt").textContent = "El contrato terminó el " + fdate(fin) + ". El último monto fue";
    else $("heroTxt").textContent = "Desde el " + fdate(now.date) + " pagás";
    $("heroMonto").textContent = fmt(now.amount);
    const chip = (t, c) => { const s = document.createElement("span"); s.className = "chip " + (c || ""); s.textContent = t; $("chips").appendChild(s); };
    if (next && hoy < fin) {
      const days = Math.round((next.date - hoy) / 864e5);
      if (next.ok) chip("Próximo ajuste: " + fshort(next.date) + " → " + fmt(next.amount) + " (+" + fmtPct(next.pct) + ")", days <= 10 ? "warn" : "");
      else chip("Próximo ajuste: " + fshort(next.date) + " · todavía falta el dato del índice", "warn");
      chip(days === 0 ? "Ajusta hoy" : "Faltan " + days + " días", days <= 10 ? "warn" : "ok");
    }
    if (nowIdx > 0) chip("Subió " + fmtPct((now.amount / rows[0].amount - 1) * 100) + " desde el inicio");
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      if (i === nowIdx && inicio <= hoy && hoy < fin) tr.className = "now";
      tr.innerHTML = '<td style="white-space:nowrap"></td><td class="det"></td><td class="num money"></td><td class="num money"></td>';
      tr.children[0].textContent = fshort(r.date);
      tr.children[1].textContent = r.label;
      tr.children[2].textContent = r.pct !== null ? "+" + fmtPct(r.pct) : "—";
      tr.children[3].textContent = r.amount !== null ? fmt(r.amount) : "—";
      tb.appendChild(tr);
    });
    if (!$("periodo").value) $("periodo").value = ym(hoy);
    renderTalon();
  }

  function resumen() {
    if (!calc || calc.error) return "";
    const { rows, nowIdx, next, hoy, fin, inicio } = calc, now = rows[nowIdx];
    const f = +$("freq").value;
    const cada = f === 1 ? "todos los meses" : "cada " + f + " meses";
    const idx = { ipc: "IPC (inflación)", icl: "ICL", fijo: "% fijo de " + fmtPct(num($("pct").value)) }[indice];
    const L = [];

    L.push("🏠 *ALQUILER ACTUALIZADO*");
    const dom = $("domicilio").value.trim();
    if (dom) L.push(dom);

    L.push("", "📄 *Contrato*");
    L.push("• Inicio: " + fshort(inicio) + " (" + $("duracion").value + " meses)");
    L.push("• Ajuste: " + idx + ", " + cada);
    L.push("• Monto inicial: " + fmt(rows[0].amount));

    const estado = inicio > hoy ? "Arrancás pagando" : hoy >= fin ? "Último monto del contrato" : "Pagás hoy";
    L.push("", "💰 *" + estado + ": " + fmt(now.amount) + "*");
    L.push("Vigente desde el " + fshort(now.date));
    if (nowIdx > 0) L.push("Subió " + fmtPct((now.amount / rows[0].amount - 1) * 100) + " desde el inicio");

    if (next && hoy < fin) {
      L.push("", "📅 *Próximo ajuste: " + fshort(next.date) + "*");
      if (next.ok) L.push("Pasa a " + fmt(next.amount) + " (+" + fmtPct(next.pct) + ")");
      else L.push("Todavía no se publicó el índice para calcularlo");
    }

    L.push("", "📊 *Historial de ajustes*");
    rows.forEach((r, i) => {
      if (!r.ok) return;
      const det = r.pct !== null ? "+" + fmtPct(r.pct) : "inicial";
      L.push(fshort(r.date) + " → " + fmt(r.amount) + " (" + det + ")" + (i === nowIdx && inicio <= hoy && hoy < fin ? " ◀ actual" : ""));
    });

    L.push("", "_Calculado en " + (location.host || "Alquiler al Día") + "_");
    return L.join("\n");
  }

  function montoPeriodo() {
    if (!calc || calc.error) return null;
    const p = $("periodo").value; if (!p) return calc.rows[calc.nowIdx].amount;
    const [y, m] = p.split("-").map(Number), d = new Date(y, m - 1, 28);
    let a = calc.rows[0].amount; calc.rows.forEach(r => { if (r.ok && r.date <= d) a = r.amount; });
    return a;
  }
  function periodoTxt() { const p = $("periodo").value; if (!p) return ""; const [y, m] = p.split("-").map(Number); return MESES[m - 1] + " " + y; }
  const v = id => $(id).value.trim();
  const nroTxt = () => String(parseInt(v("nro")) || 1).padStart(4, "0");

  function renderTalon() {
    const t = $("talon"), a = montoPeriodo();
    t.innerHTML = '<div class="top"><span class="tt">RECIBO</span><span class="money" data-k="nro"></span></div>' +
      '<div class="line"><span>Recibí de</span><b data-k="locatario"></b></div>' +
      '<div class="line"><span>En concepto de</span><span data-k="concepto"></span></div>' +
      '<div class="line"><span>Inmueble</span><span data-k="domicilio"></span></div>' +
      '<div class="line"><span>Fecha</span><span data-k="fecha"></span></div>' +
      '<div><div class="hint">La suma de</div><div class="monto" data-k="monto"></div></div>' +
      '<div class="firma" data-k="locador"></div>';
    const set = (k, s) => { t.querySelector('[data-k="' + k + '"]').textContent = s; };
    set("nro", "N° " + nroTxt());
    set("locatario", v("locatario") || "Nombre del inquilino");
    set("concepto", "Alquiler de " + (periodoTxt() || "—"));
    set("domicilio", v("domicilio") || "Domicilio del inmueble");
    set("fecha", fdate(new Date()));
    set("monto", a !== null ? fmt(a) : "—");
    set("locador", v("locador") || "Firma del propietario");
  }

  function pdf() {
    const st = $("st2");
    if (!window.jspdf) { st.textContent = "No se pudo cargar el generador de PDF. Revisá tu conexión y recargá la página."; return; }
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a5", orientation: "landscape" });
    const W = 210, a = montoPeriodo();
    doc.setDrawColor(150); doc.setLineDashPattern([2, 1.5], 0); doc.roundedRect(8, 8, W - 16, 132, 3, 3); doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("RECIBO", 16, 24);
    doc.setFont("courier", "normal"); doc.setFontSize(12); doc.text("N° " + nroTxt(), W - 16, 24, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    const line = (y, l, val) => { doc.setTextColor(110); doc.text(l, 16, y); doc.setTextColor(20); doc.text(val || "—", 62, y); doc.setDrawColor(210); doc.line(16, y + 2.5, W - 16, y + 2.5); };
    line(42, "Recibí de", v("locatario"));
    line(54, "En concepto de", "Alquiler de " + (periodoTxt() || "—"));
    line(66, "Inmueble", v("domicilio"));
    line(78, "Fecha", fdate(new Date()));
    doc.setTextColor(110); doc.text("La suma de", 16, 94); doc.setTextColor(20);
    doc.setFont("courier", "bold"); doc.setFontSize(20); doc.text(a !== null ? "$ " + Math.round(a).toLocaleString("es-AR") : "—", 16, 104);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setDrawColor(120); doc.line(W - 86, 122, W - 16, 122);
    doc.setTextColor(110); doc.text(v("locador") || "Firma del propietario", W - 51, 128, { align: "center" });
    doc.save("recibo-alquiler-" + ($("periodo").value || "mes") + ".pdf");
    st.textContent = "Recibo descargado. ";
    const link = document.createElement("a");
    link.href = $("cafecito-link").href; link.target = "_blank"; link.rel = "noopener";
    link.textContent = "¿Te sirvió? Invitame un cafecito ☕";
    st.appendChild(link);
  }

  async function getJSON(url) {
    try { const r = await fetch(url, { cache: "no-cache" }); if (!r.ok) throw 0; return await r.json(); } catch (e) { return null; }
  }

  load();
  document.querySelectorAll("#indice button").forEach(b => b.addEventListener("click", () => { indice = b.dataset.v; render(); }));
  document.querySelectorAll("input,select").forEach(el => el.addEventListener("input", render));
  $("form").addEventListener("submit", e => e.preventDefault());
  $("pdf").addEventListener("click", pdf);
  $("copiar").addEventListener("click", () => {
    navigator.clipboard.writeText(resumen())
      .then(() => { $("st1").textContent = "Resumen copiado."; })
      .catch(() => { $("st1").textContent = "No se pudo copiar automáticamente. Usá el botón de WhatsApp."; });
  });
  $("wa").addEventListener("click", () => {
    const t = resumen();
    if (!t) { $("st1").textContent = "Completá los datos del contrato para poder mandarlo."; return; }
    const url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(t);
    const w = window.open(url, "_blank");
    if (w) w.opener = null;
    else location.href = url; // si el navegador bloquea la pestaña nueva, abre en la misma
  });

  Promise.all([getJSON("data/ipc.json"), getJSON("data/icl.json")]).then(([ipc, icl]) => {
    if (ipc && ipc.valores) data.ipc = ipc.valores;
    if (icl && icl.valores) data.icl = icl.valores;
    render();
  });
})();
