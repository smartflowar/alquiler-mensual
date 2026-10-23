// ICL diario (Banco Central, variable 40). Vercel lo guarda en caché 12 h.
module.exports = async (req, res) => {
  try {
    const anioActual = new Date().getFullYear();
    const anios = [];
    for (let y = 2020; y <= anioActual; y++) anios.push(y);
    // La API devuelve hasta 3000 registros por pedido: se pide año por año, en paralelo.
    const respuestas = await Promise.all(anios.map(async y => {
      const r = await fetch(`https://api.bcra.gob.ar/estadisticas/v3.0/monetarias/40?desde=${y}-01-01&hasta=${y}-12-31&limit=3000`);
      if (!r.ok) throw new Error("HTTP " + r.status + " en " + y);
      return r.json();
    }));
    const valores = {};
    for (const j of respuestas) {
      // admite el formato v3 ({results:[{detalle:[...]}]}) y el v2 ({results:[{fecha,valor}]})
      const filas = (j.results || []).flatMap(x => x.detalle || [x]);
      for (const f of filas) if (f.fecha && typeof f.valor === "number") valores[f.fecha.slice(0, 10)] = f.valor;
    }
    if (!Object.keys(valores).length) throw new Error("sin datos");
    res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=604800");
    res.status(200).json({ fuente: "BCRA", valores: Object.fromEntries(Object.entries(valores).sort()) });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: String(e.message || e) });
  }
};
