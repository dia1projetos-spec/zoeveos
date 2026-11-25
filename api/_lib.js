// api/_lib.js — utilidades compartidas por las funciones del servidor (Vercel).
// Leen Firestore por su API REST pública (las reglas permiten lectura pública).
const PROJECT_ID = "monkeyzoeveos";
const API_KEY = "AIzaSyAd5JuDF61emOfhgyJpL7LRNfF58FDt6cE"; // clave pública de la app web (la misma de js/firebase-config.js)
const SITE_URL = "https://www.zoeveos.com";
const SITE_NAME = "Zoë νέος";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function fromValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}
function fromFields(fields) {
  const o = {};
  for (const k of Object.keys(fields)) o[k] = fromValue(fields[k]);
  return o;
}
function fromDoc(d) {
  const id = d.name.split("/").pop();
  return { id, ...fromFields(d.fields || {}), _updateTime: d.updateTime };
}

async function getDocument(path) {
  const res = await fetch(`${BASE}/${path}?key=${API_KEY}`);
  if (!res.ok) return null;
  return fromDoc(await res.json());
}

// where: [{ field, op, value }] — op: EQUAL
async function queryCollection(collectionId, where = [], limit = 500) {
  const filters = where.map((w) => ({
    fieldFilter: {
      field: { fieldPath: w.field },
      op: "EQUAL",
      value: typeof w.value === "boolean" ? { booleanValue: w.value } : { stringValue: String(w.value) },
    },
  }));
  const structuredQuery = { from: [{ collectionId }], limit };
  if (filters.length === 1) structuredQuery.where = filters[0];
  else if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: "AND", filters } };
  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error("Firestore " + res.status);
  const rows = await res.json();
  return rows.filter((r) => r.document).map((r) => fromDoc(r.document));
}

async function getSiteConfig() {
  try {
    return (await getDocument("config/site")) || {};
  } catch (e) {
    return {};
  }
}

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Imagen de Cloudinary optimizada (formato y calidad automáticos)
function cld(url, w = 900) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${w}/`);
}
function cldCover(url, w = 1200, h = 630) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,c_fill,w_${w},h_${h}/`);
}

const money = (n) => "$" + Number(n || 0).toLocaleString("es-AR");
const truncate = (s, n) => {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
};

module.exports = { PROJECT_ID, API_KEY, SITE_URL, SITE_NAME, getDocument, queryCollection, getSiteConfig, esc, cld, cldCover, money, truncate };
