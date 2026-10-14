/**
 * The label basket: which styles are on the print page and how many labels
 * each SKU gets. Kept in localStorage so it survives moving around the app —
 * open a style, send it to the basket, come back, add a delivery, print once.
 *
 *   { styleIds: string[], counts: { [skuId]: number } }
 *
 * Everything here is pure apart from load/save, which never throw (storage can
 * be unavailable in a private window).
 */

const KEY = 'labels.queue.v1';
const SIZE_KEY = 'labels.size.v1';

export const MAX_PER_SKU = 2000;
export const MAX_LABELS = 3000;

/** Common thermal label sizes (width × height, mm). First is the default. */
export const LABEL_SIZES = [
  { id: '65x40', label: '65 × 40 mm', w: 65, h: 40 },
  { id: '58x40', label: '58 × 40 mm', w: 58, h: 40 },
  { id: '50x30', label: '50 × 30 mm', w: 50, h: 30 },
  { id: '40x30', label: '40 × 30 mm', w: 40, h: 30 },
  { id: '100x50', label: '100 × 50 mm', w: 100, h: 50 }
];

export const EMPTY = { styleIds: [], counts: {} };

const clampCount = (v) => Math.max(0, Math.min(MAX_PER_SKU, Math.floor(Number(v) || 0)));

export function loadQueue() {
  try {
    const q = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (q && Array.isArray(q.styleIds) && q.counts && typeof q.counts === 'object') return q;
  } catch {
    /* unavailable or corrupt: start empty */
  }
  return EMPTY;
}

export function saveQueue(q) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    /* best effort */
  }
}

export function loadSizeId() {
  try {
    const id = localStorage.getItem(SIZE_KEY);
    return LABEL_SIZES.some((s) => s.id === id) ? id : LABEL_SIZES[0].id;
  } catch {
    return LABEL_SIZES[0].id;
  }
}

export function saveSizeId(id) {
  try {
    localStorage.setItem(SIZE_KEY, id);
  } catch {
    /* best effort */
  }
}

/** Put styles on the page (no labels yet), keeping order and skipping ones already there. */
export function addStyles(q, styleIds) {
  const ids = [...q.styleIds];
  for (const id of styleIds) if (id && !ids.includes(String(id))) ids.push(String(id));
  return { ...q, styleIds: ids };
}

/**
 * Add labels for SKUs: [{ skuId, styleId, count }]. Counts add to what is
 * already there — receiving two deliveries means two sets of labels.
 */
export function addSkus(q, lines) {
  const next = addStyles(q, lines.map((l) => l.styleId));
  const counts = { ...next.counts };
  for (const l of lines) {
    const k = String(l.skuId);
    counts[k] = clampCount((counts[k] || 0) + (Number(l.count) || 0));
  }
  return { ...next, counts };
}

export function setCount(q, skuId, value) {
  const counts = { ...q.counts };
  const n = clampCount(value);
  if (n) counts[skuId] = n;
  else delete counts[skuId];
  return { ...q, counts };
}

/** Set many at once: [[skuId, n]]. */
export function setCounts(q, pairs) {
  return pairs.reduce((acc, [skuId, n]) => setCount(acc, skuId, n), q);
}

export function removeStyle(q, styleId, skuIds = []) {
  const counts = { ...q.counts };
  for (const id of skuIds) delete counts[id];
  return { styleIds: q.styleIds.filter((s) => s !== styleId), counts };
}

export const totalLabels = (q) => Object.values(q.counts).reduce((a, b) => a + b, 0);

/**
 * A style as a size grid: colours down, sizes across (in the scale's order),
 * one cell per SKU. Colourways can use different scales, so the columns are
 * the union of every size the style's SKUs use.
 *
 * @param {object} style  GET /styles/:id (colourways with their SKUs)
 * @returns {{ sizes: Array<{ key, label }>, rows: Array<{ colorway, cells: Map<sizeKey, sku> }> }}
 */
export function styleGrid(style) {
  const sizes = new Map();
  for (const cw of style.colorways || []) {
    for (const sku of cw.skus || []) {
      const s = sku.sizeId;
      const key = String(s?._id ?? s ?? sku._id);
      if (!sizes.has(key)) sizes.set(key, { key, label: s?.label ?? '—', order: s?.order ?? 0 });
    }
  }
  const columns = [...sizes.values()].sort((a, b) => a.order - b.order || String(a.label).localeCompare(String(b.label), 'fr', { numeric: true }));
  const rows = (style.colorways || []).map((cw) => ({
    colorway: cw,
    cells: new Map((cw.skus || []).map((sku) => [String(sku.sizeId?._id ?? sku.sizeId ?? sku._id), sku]))
  }));
  return { sizes: columns, rows };
}

/** Label rows for the PDF endpoint, in grid order, from the loaded styles. */
export function pdfRows(q, styles) {
  const rows = [];
  for (const style of styles) {
    const { sizes, rows: grid } = styleGrid(style);
    for (const { colorway, cells } of grid) {
      for (const size of sizes) {
        const sku = cells.get(size.key);
        const count = sku ? q.counts[String(sku._id)] || 0 : 0;
        if (!count || !sku.barcode) continue;
        rows.push({
          name: style.name,
          color: colorway.colorId?.name || '',
          size: sku.sizeId?.label || '',
          code: sku.code,
          barcode: sku.barcode,
          price: colorway.retailPrice ?? style.retailPrice ?? null,
          count
        });
      }
    }
  }
  return rows;
}
