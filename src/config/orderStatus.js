/**
 * The order status vocabulary, mirroring the server's `config/orderStatus.js`
 * (AUDIT M-2).
 *
 * Three states used to be spelled two ways each — `Confirmé`/`Confirmée`,
 * `Livré`/`Livrée`, `Annulé`/`Annulée` — so this package carried the same
 * defensive lists the server did (`['Livré', 'Livrée']` and friends), plus a
 * hand-written canonicaliser in `Orders.jsx`. One spelling per state now.
 *
 * `normaliseOrderStatus` is kept because this code also renders orders fetched
 * from a database that may not have been migrated yet.
 */

export const ORDER_STATUS = {
  PENDING: 'En Attente',
  CONFIRMED: 'Confirmé',
  READY_TO_PICK: 'Prêt à préparer',
  PICKED: 'Préparé',
  PRINTED: 'Imprimé',
  HANDED_TO_CARRIER: 'Remis au transporteur',
  SHIPPED: 'Expédié',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Livré',
  CANCELLED: 'Annulé',
  NO_ANSWER: 'NRP',
  RETURNED: 'Retour',
  EXCHANGE: 'Echange'
};

export const ORDER_STATUSES = Object.values(ORDER_STATUS);

const LEGACY = {
  'Confirmée': ORDER_STATUS.CONFIRMED,
  'confirmé': ORDER_STATUS.CONFIRMED,
  'confirmée': ORDER_STATUS.CONFIRMED,
  'Livrée': ORDER_STATUS.DELIVERED,
  'Annulée': ORDER_STATUS.CANCELLED,
  'Remboursée': ORDER_STATUS.CANCELLED,
  'En cours': ORDER_STATUS.OUT_FOR_DELIVERY
};

export function normaliseOrderStatus(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (ORDER_STATUSES.includes(trimmed)) return trimmed;
  return LEGACY[trimmed] ?? value;
}

export const DELIVERED_STATUSES = [ORDER_STATUS.DELIVERED];
export const CANCELLED_STATUSES = [ORDER_STATUS.CANCELLED];
export const CONFIRMED_STATUSES = [ORDER_STATUS.CONFIRMED];

/** Arrived, or never will. */
export const COMPLETED_STATUSES = [
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.RETURNED,
  ORDER_STATUS.NO_ANSWER
];
