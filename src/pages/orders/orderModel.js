/**
 * Order management — vocabulary and pure logic.
 *
 * Nothing here touches React or the network, so the rules the screen applies
 * (stock allocation, bundle pricing, status gating) can be read in one place
 * rather than dug out of render code.
 */
import { ORDER_STATUS, normaliseOrderStatus } from '../../config/orderStatus';

/** Tunisian dinar, grouped, two decimals. */
export const dt = (n) =>
  `${Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;

export const idOf = (v) => (v == null ? '' : String(v?._id ?? v));

/* ------------------------------------------------------------- statuses */

/** Statuses an operator can set from the list. The rest are carrier-driven. */
export const SETTABLE_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.READY_TO_PICK,
  ORDER_STATUS.PICKED,
  ORDER_STATUS.PRINTED,
  ORDER_STATUS.HANDED_TO_CARRIER,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.NO_ANSWER,
  ORDER_STATUS.RETURNED
];

/** Tabs. `value` is what GET /orders?status= understands (groups or a literal). */
export const STATUS_TABS = [
  { label: 'All', value: '', statKey: 'total' },
  { label: 'Pending', value: 'Pending', statKey: 'pending' },
  { label: 'Confirmed', value: 'Confirmed', statKey: 'confirmed' },
  { label: 'Prêt à préparer', value: ORDER_STATUS.READY_TO_PICK, statKey: 'readyToPrepare' },
  { label: 'Processing', value: 'Processing', statKey: 'processing' },
  { label: 'Imprimé', value: ORDER_STATUS.PRINTED },
  { label: 'At carrier', value: ORDER_STATUS.HANDED_TO_CARRIER, statKey: 'atCarrier' },
  { label: 'Delivered', value: 'Completed', statKey: 'completed' },
  { label: 'Cancelled', value: 'Cancelled', statKey: 'cancelled' },
  { label: 'NRP', value: 'NRP', statKey: 'nrp' }
];

const STATUS_TONE = {
  [ORDER_STATUS.PENDING]: 'neutral',
  [ORDER_STATUS.CONFIRMED]: 'warning',
  [ORDER_STATUS.READY_TO_PICK]: 'info',
  [ORDER_STATUS.PICKED]: 'info',
  [ORDER_STATUS.PRINTED]: 'accent',
  [ORDER_STATUS.HANDED_TO_CARRIER]: 'warning',
  [ORDER_STATUS.SHIPPED]: 'accent',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'accent',
  [ORDER_STATUS.DELIVERED]: 'success',
  [ORDER_STATUS.CANCELLED]: 'danger',
  [ORDER_STATUS.NO_ANSWER]: 'neutral',
  [ORDER_STATUS.RETURNED]: 'danger',
  [ORDER_STATUS.EXCHANGE]: 'warning'
};

export const statusOf = (order) => normaliseOrderStatus(order?.status || '') || '';
export const statusTone = (status) => STATUS_TONE[normaliseOrderStatus(status)] || 'neutral';
export const isReadyToPick = (order) => statusOf(order) === ORDER_STATUS.READY_TO_PICK;

/* ------------------------------------------------------------- customer */

export const GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan',
  'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir', 'Nabeul',
  'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
];

/** Same sentinel as the server: such an order cannot be confirmed yet. */
export const GOVERNORATE_UNAVAILABLE = 'Adresse non disponible';

export const SOURCES = ['Direct', 'Website', 'Phone', 'Social Media', 'Autre'];

export const EMPTY_CUSTOMER = { nom: '', telephone: '', telephone2: '', gouvernerat: '', ville: '', adresse: '' };

export const needsGovernorate = (order) => {
  const g = String(order?.customer?.gouvernerat || '').trim();
  return !g || g === GOVERNORATE_UNAVAILABLE;
};

/** Local 8-digit number: digits only, a leading 216 country code dropped. */
export const normalisePhone = (raw) => {
  let v = String(raw || '').replace(/\D/g, '');
  if (v.startsWith('216') && v.length > 8) v = v.slice(3);
  return v.slice(0, 8);
};

/* ---------------------------------------------------------------- lines */

/** The display name without the "Pack " prefix the server adds to bundle lines. */
export const baseName = (name) => String(name || '').replace(/^Pack\s+/i, '').trim();

export const lineLabel = (line) =>
  [baseName(line.productName ?? line.styleName), line.colorName, line.sizeLabel].filter(Boolean).join(' · ');

/** A form line from a row of GET /stock/skus. */
export const lineFromCatalogSku = (sku) => ({
  skuId: idOf(sku._id),
  styleName: sku.styleName,
  colorName: sku.colorName || '',
  sizeLabel: sku.sizeLabel || '',
  code: sku.code,
  catalogPrice: Number(sku.price) || 0,
  unitPrice: Number(sku.price) || 0,
  quantity: 1
});

/** A form line from GET /stock/lookup (populated Sku document). */
export const lineFromLookupSku = (sku) => {
  const price = sku.colorwayId?.retailPrice ?? sku.styleId?.retailPrice ?? 0;
  return lineFromCatalogSku({
    _id: sku._id,
    styleName: sku.styleId?.name || sku.code,
    colorName: sku.colorwayId?.colorId?.name,
    sizeLabel: sku.sizeId?.label,
    code: sku.code,
    price,
    quantityOnHand: sku.quantityOnHand
  });
};

/** A form line from a stored order line, priced against today's catalog when known. */
export const lineFromOrderItem = (item, catalogById) => {
  const sku = catalogById.get(idOf(item.skuId));
  return {
    skuId: idOf(item.skuId),
    styleName: baseName(item.productName),
    colorName: item.colorName || '',
    sizeLabel: item.sizeLabel || '',
    code: item.sku,
    catalogPrice: sku ? Number(sku.price) || 0 : Number(item.unitPrice) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    quantity: Number(item.quantity) || 1
  };
};

/**
 * Split one negotiated subtotal across the lines in proportion to their
 * catalog value, so per-line revenue still means something. Falls back to an
 * even split per unit when nothing has a catalog price.
 */
export function allocateBundle(lines, subtotal) {
  const target = Number(subtotal);
  if (!lines.length || !Number.isFinite(target) || target < 0) return lines;
  const weights = lines.map((l) => l.catalogPrice * l.quantity);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const units = lines.reduce((s, l) => s + l.quantity, 0) || 1;
    return lines.map((l) => ({ ...l, unitPrice: target / units }));
  }
  return lines.map((l, i) => ({ ...l, unitPrice: (target * weights[i]) / sum / (l.quantity || 1) }));
}

/* ------------------------------------------------- intake vs stock */

/**
 * Compare the lines on the order form with what can still be promised.
 *
 * `availability` comes from GET /stock/availability: per SKU, on hand, units
 * held by other open orders, and the difference. Quantities of one SKU on
 * several lines are summed, as the server does.
 *
 * Returns { bySku: Map(skuId -> { state: 'ok'|'short'|'unknown', need, onHand,
 * reserved, available }), shortages: [...the 'short' entries, with code and name] }.
 */
export function compareWithStock(lines, availability) {
  const need = new Map();
  for (const l of lines) need.set(l.skuId, (need.get(l.skuId) || 0) + (Number(l.quantity) || 0));

  const bySku = new Map();
  const shortages = [];
  for (const [skuId, qty] of need) {
    const a = availability?.get(skuId);
    if (!a) {
      bySku.set(skuId, { state: 'unknown', need: qty });
      continue;
    }
    const entry = { state: qty > a.available ? 'short' : 'ok', need: qty, onHand: a.onHand, reserved: a.reserved, available: a.available };
    bySku.set(skuId, entry);
    if (entry.state === 'short') {
      const line = lines.find((l) => l.skuId === skuId);
      shortages.push({ ...entry, skuId, code: line?.code, label: lineLabel(line || {}) });
    }
  }
  return { bySku, shortages };
}

/* --------------------------------------------------------------- search */

export function matchesSearch(order, term) {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const has = (v) => v != null && String(v).toLowerCase().includes(q);
  return (
    has(order.orderNumber) ||
    has(order.deliveryBarcode) ||
    has(order.shopifyOrderName) ||
    has(order.customer?.nom) ||
    has(order.customer?.telephone) ||
    has(order.customer?.telephone2) ||
    (order.items || []).some((i) => has(i.productName) || has(i.sku) || has(i.colorName))
  );
}
