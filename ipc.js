// IPC mensual nacional (INDEC, vía datos.gob.ar). Vercel lo guarda en caché 12 h.
module.exports = async (req, res) => {
  try {
    const url = "https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26" +
      "&representation_mode=percent_change&start_date=2020-01-01&limit=1000&format=json";
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const valores = {};
    for (const [fecha, v] of j.data || []) if (v != null) valores[fecha.slice(0, 7)] = Math.round(v * 1000) / 10;
    if (!Object.keys(valores).length) throw new Error("sin datos");
    res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=604800");
    res.status(200).json({ fuente: "INDEC", valores });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: String(e.message || e) });
  }
};
