import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Modal from '../../components/Modal';
import { Badge, Button } from '../../components/ui/Primitives';
import { stockService } from '../../services';
import SkuPicker from './SkuPicker';
import {
  dt,
  allocateBundle,
  compareWithStock,
  lineFromOrderItem,
  normalisePhone,
  EMPTY_CUSTOMER,
  GOVERNORATES,
  GOVERNORATE_UNAVAILABLE,
  SOURCES
} from './orderModel';

/** Form state for a new order, or one seeded from an existing order. */
function initialState(order, catalogById, deliveryFee) {
  if (!order) {
    return {
      lines: [],
      customer: { ...EMPTY_CUSTOMER },
      source: 'Direct',
      notes: '',
      isExchange: false,
      shipping: deliveryFee,
      bundle: false,
      bundleSubtotal: ''
    };
  }
  const lines = (order.items || []).map((i) => lineFromOrderItem(i, catalogById));
  const legacyBundle = lines.length > 0 && order.items.every((i) => i.isBundleLine);
  const bundle = Boolean(order.isBundleOrder) || legacyBundle;
  return {
    lines,
    customer: { ...EMPTY_CUSTOMER, ...(order.customer || {}) },
    source: order.source || 'Direct',
    notes: order.notes || '',
    isExchange: Boolean(order.isExchange),
    shipping: order.shipping ?? deliveryFee,
    bundle,
    bundleSubtotal: bundle ? String(order.bundleSubtotal ?? order.subtotal ?? '') : ''
  };
}

/**
 * Create or edit an order.
 *
 * Lines are SKUs. Once picking has taken stock for any line, the server will
 * not accept a new line list (the deducted line would be lost along with the
 * record that its stock must come back), so the lines lock and only the
 * customer, shipping and notes stay editable.
 *
 * Every line is compared with what can still be promised: on hand minus what
 * other open orders hold. A short line does not stop the order, but saving it
 * takes a second, deliberate click. The server repeats the check, because stock
 * can move while the form is open.
 */
export default function OrderFormModal({ isOpen, order, catalogById, deliveryFee, onClose, actions }) {
  const [form, setForm] = useState(() => initialState(order, catalogById, deliveryFee));

  // Re-seed whenever the modal opens on a different order (or a blank one).
  useEffect(() => {
    if (isOpen) setForm(initialState(order, catalogById, deliveryFee));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, order?._id]);

  const editing = Boolean(order);
  const linesLocked = editing && (order.items || []).some((i) => i.stockDeductedAtPrepare);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setCustomer = (patch) => setForm((f) => ({ ...f, customer: { ...f.customer, ...patch } }));

  const catalogTotal = useMemo(
    () => form.lines.reduce((s, l) => s + l.catalogPrice * l.quantity, 0),
    [form.lines]
  );

  /** What will be sent: bundle orders split the one subtotal across the lines. */
  const pricedLines = useMemo(
    () => (form.bundle ? allocateBundle(form.lines, form.bundleSubtotal) : form.lines),
    [form.bundle, form.bundleSubtotal, form.lines]
  );

  /* --------------------------------------------------- stock comparison */

  const skuIds = useMemo(() => [...new Set(form.lines.map((l) => l.skuId))].sort(), [form.lines]);
  const excludeOrder = editing ? order._id : undefined;
  const { data: availability, isFetching: checkingStock, refetch: recheckStock } = useQuery({
    queryKey: ['skuAvailability', skuIds, excludeOrder],
    queryFn: async () => {
      const rows = (await stockService.availability(skuIds, excludeOrder)).data.data;
      return new Map(rows.map((r) => [r.skuId, r]));
    },
    enabled: isOpen && skuIds.length > 0 && !linesLocked,
    placeholderData: (prev) => prev
  });
  const stock = useMemo(() => compareWithStock(form.lines, availability), [form.lines, availability]);

  /** Shortages awaiting the operator's "save anyway". Cleared whenever the lines change. */
  const [review, setReview] = useState(null);
  useEffect(() => setReview(null), [form.lines]);

  const subtotal = form.bundle
    ? Number(form.bundleSubtotal) || 0
    : pricedLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const total = subtotal + (Number(form.shipping) || 0);

  const addLine = (line) =>
    setForm((f) => {
      const existing = f.lines.find((l) => l.skuId === line.skuId);
      const lines = existing
        ? f.lines.map((l) => (l.skuId === line.skuId ? { ...l, quantity: l.quantity + 1 } : l))
        : [...f.lines, line];
      return { ...f, lines };
    });

  const patchLine = (skuId, patch) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.skuId === skuId ? { ...l, ...patch } : l)) }));

  const removeLine = (skuId) => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.skuId !== skuId) }));

  const toggleBundle = (on) =>
    set({
      bundle: on,
      bundleSubtotal: on ? String(Math.round(catalogTotal * 100) / 100) : '',
      // Leaving bundle mode goes back to catalog prices.
      ...(on ? {} : { lines: form.lines.map((l) => ({ ...l, unitPrice: l.catalogPrice })) })
    });

  const pending = actions.create.isPending || actions.update.isPending;

  const submit = (e) => {
    e.preventDefault();
    if (!form.lines.length) return toast.error('Add at least one line');
    if (form.bundle) {
      const b = Number(form.bundleSubtotal);
      if (form.bundleSubtotal === '' || !Number.isFinite(b) || b < 0) {
        return toast.error('Enter the bundle subtotal');
      }
    }
    const phone = form.customer.telephone;
    if (phone && phone.length !== 8) return toast.error('The phone number must have 8 digits');

    const payload = {
      customer: form.customer,
      shipping: Number(form.shipping) || 0,
      source: form.source,
      notes: form.notes,
      isExchange: form.isExchange,
      isBundleOrder: form.bundle,
      bundleSubtotal: form.bundle ? Number(form.bundleSubtotal) : undefined
    };
    if (!linesLocked) {
      payload.items = pricedLines.map((l) => ({
        skuId: l.skuId,
        quantity: l.quantity,
        unitPrice: Math.round(l.unitPrice * 1000) / 1000,
        isBundleLine: form.bundle
      }));
    }

    if (!linesLocked) {
      // First click on a short order: show what is short and wait for a second.
      if (stock.shortages.length && !review) return setReview(stock.shortages);
      if (review) payload.acceptShortage = true;
    }

    const opts = {
      onSuccess: onClose,
      onError: (error) => {
        const data = error?.response?.data;
        if (data?.code !== 'STOCK_SHORTAGE') return;
        // Stock moved since the form loaded: show the server's figures and ask.
        recheckStock();
        setReview(
          data.shortages.map((s) => {
            const line = form.lines.find((l) => l.skuId === s.skuId);
            return { ...s, label: line ? [line.styleName, line.colorName, line.sizeLabel].filter(Boolean).join(' · ') : s.code };
          })
        );
      }
    };
    if (editing) actions.update.mutate({ id: order._id, payload }, opts);
    else actions.create.mutate(payload, opts);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit order ${order.orderNumber}` : 'New order'}>
      <form onSubmit={submit} className="space-y-6">
        {/* ------------------------------------------------------------ lines */}
        <section>
          <h3 className="mb-2 text-base font-medium">Articles</h3>
          {linesLocked ? (
            <p className="mb-3 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm">
              Picking has started — stock has been taken for this order, so its articles can no longer
              change. Cancel the order to return the stock.
            </p>
          ) : (
            <SkuPicker onAdd={addLine} />
          )}

          {form.lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-content-muted">No articles yet.</p>
          ) : (
            <div className="table-container mt-3">
              <table>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th style={{ width: 90 }}>Qty</th>
                    <th className="num" style={{ width: 130 }}>Unit price</th>
                    <th className="num">Total</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {pricedLines.map((l) => {
                    const st = stock.bySku.get(l.skuId);
                    return (
                      <tr key={l.skuId}>
                        <td>
                          <div className="font-medium">{l.styleName}</div>
                          <div className="text-sm text-content-secondary">
                            {[l.colorName, l.sizeLabel].filter(Boolean).join(' · ')}
                            <span className="ml-2 font-mono text-xs text-content-muted">{l.code}</span>
                          </div>
                          {!linesLocked ? <StockReadout entry={st} checking={checkingStock} /> : null}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={l.quantity}
                            disabled={linesLocked}
                            onChange={(e) =>
                              patchLine(l.skuId, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                            }
                          />
                        </td>
                        <td className="num">
                          {form.bundle || linesLocked ? (
                            <span className="tabular-nums">{dt(l.unitPrice)}</span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="form-control text-right"
                              value={l.unitPrice}
                              onChange={(e) => patchLine(l.skuId, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                            />
                          )}
                        </td>
                        <td className="num tabular-nums font-medium">{dt(l.unitPrice * l.quantity)}</td>
                        <td>
                          {!linesLocked && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-label={`Remove ${l.styleName}`}
                              onClick={() => removeLine(l.skuId)}
                            >
                              <FaTimes />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!linesLocked && (
            <div className="mt-3 rounded-lg border border-border bg-surface-sunken p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.bundle} onChange={(e) => toggleBundle(e.target.checked)} />
                Bundle — one negotiated price for all articles
              </label>
              {form.bundle && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    style={{ maxWidth: 180 }}
                    value={form.bundleSubtotal}
                    onChange={(e) => set({ bundleSubtotal: e.target.value })}
                    aria-label="Bundle subtotal"
                  />
                  <span className="text-sm text-content-secondary">
                    Catalog value {dt(catalogTotal)} ·{' '}
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => set({ bundleSubtotal: String(Math.round(catalogTotal * 100) / 100) })}
                    >
                      use it
                    </button>
                  </span>
                  <p className="w-full text-xs text-content-muted">
                    Unit prices are this subtotal split by catalog value, so per-article revenue stays meaningful.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* --------------------------------------------------------- customer */}
        <section>
          <h3 className="mb-2 text-base font-medium">Customer</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className="form-control"
              placeholder="Name"
              value={form.customer.nom}
              onChange={(e) => setCustomer({ nom: e.target.value })}
            />
            <input
              type="tel"
              className="form-control"
              placeholder="Phone (8 digits)"
              value={form.customer.telephone}
              onChange={(e) => setCustomer({ telephone: normalisePhone(e.target.value) })}
            />
            <select
              className="form-control"
              value={form.customer.gouvernerat}
              onChange={(e) => setCustomer({ gouvernerat: e.target.value })}
            >
              <option value="">Governorate…</option>
              <option value={GOVERNORATE_UNAVAILABLE}>{GOVERNORATE_UNAVAILABLE}</option>
              {GOVERNORATES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <input
              className="form-control"
              placeholder="City"
              value={form.customer.ville}
              onChange={(e) => setCustomer({ ville: e.target.value })}
            />
            <input
              className="form-control sm:col-span-2"
              placeholder="Address"
              value={form.customer.adresse}
              onChange={(e) => setCustomer({ adresse: e.target.value })}
            />
            <input
              type="tel"
              className="form-control"
              placeholder="Second phone (optional)"
              value={form.customer.telephone2 || ''}
              onChange={(e) => setCustomer({ telephone2: normalisePhone(e.target.value) })}
            />
            <select className="form-control" value={form.source} onChange={(e) => set({ source: e.target.value })}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              {form.source === 'Shopify' ? <option value="Shopify">Shopify</option> : null}
            </select>
          </div>
          <p className="mt-2 text-xs text-content-muted">
            Leave it blank for an in-store sale. A real governorate is required before the order can be confirmed.
          </p>
        </section>

        {/* ------------------------------------------------------------ extra */}
        <section className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.isExchange} onChange={(e) => set({ isExchange: e.target.checked })} />
            Exchange (replacement for a returned article)
          </label>
          <textarea
            className="form-control"
            rows={2}
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </section>

        {/* ----------------------------------------------------------- totals */}
        <section className="rounded-lg border border-border p-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="tabular-nums">{dt(subtotal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <label htmlFor="order-shipping">Shipping</label>
            <input
              id="order-shipping"
              type="number"
              min="0"
              step="0.01"
              className="form-control text-right"
              style={{ maxWidth: 120 }}
              value={form.shipping}
              onChange={(e) => set({ shipping: e.target.value })}
            />
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{dt(total)}</span>
          </div>
        </section>

        {review ? (
          <section className="rounded-lg border border-danger-border bg-danger-bg p-3" role="alert">
            <p className="font-medium">
              {review.length === 1 ? '1 article is' : `${review.length} articles are`} short on stock
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {review.map((s) => (
                <li key={s.skuId} className="flex flex-wrap justify-between gap-2">
                  <span>{s.label}</span>
                  <span className="tabular-nums">
                    need {s.need} · available {s.available}
                    <span className="text-content-secondary"> ({s.onHand} on hand, {s.reserved} in other open orders)</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-content-secondary">
              Save anyway if stock is on its way or this is a pre-order. The order will be marked short.
            </p>
          </section>
        ) : !linesLocked && stock.shortages.length ? (
          <p className="text-sm text-danger">
            {stock.shortages.length} article(s) exceed available stock.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={review ? 'danger' : 'primary'}
            type="submit"
            disabled={pending || form.lines.length === 0}
          >
            {pending ? 'Saving…' : review ? 'Save anyway' : editing ? 'Save changes' : 'Create order'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * One line's stock picture: what is available to promise, and how that
 * figure is made up, so "2 available" is never mistaken for "2 on the shelf".
 */
function StockReadout({ entry, checking }) {
  if (!entry || entry.state === 'unknown') {
    return <div className="text-xs text-content-muted">{checking ? 'Checking stock…' : 'Stock unknown'}</div>;
  }
  const short = entry.state === 'short';
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
      <Badge tone={short ? 'danger' : entry.available - entry.need <= 2 ? 'warning' : 'success'}>
        {short ? `Short by ${entry.need - entry.available}` : `${entry.available} available`}
      </Badge>
      <span className="text-content-secondary tabular-nums">
        {entry.onHand} on hand
        {entry.reserved ? ` · ${entry.reserved} in other open orders` : ''}
      </span>
    </div>
  );
}
