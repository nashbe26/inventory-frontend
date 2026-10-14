import { QRCodeCanvas } from 'qrcode.react';
import { FaBan, FaCopy, FaEdit, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Modal from '../../components/Modal';
import { Badge, Button } from '../../components/ui/Primitives';
import { dt, idOf, lineLabel, statusOf, statusTone } from './orderModel';
import { ORDER_STATUS } from '../../config/orderStatus';

const copy = (text, what) => {
  navigator.clipboard.writeText(text);
  toast.success(`${what} copied`, { autoClose: 1500 });
};

const LINE_STATE = {
  ok: { tone: 'success', label: 'In stock' },
  short: { tone: 'danger', label: 'Short' },
  unknown: { tone: 'neutral', label: 'Unknown' },
  picked: { tone: 'info', label: 'Picked' }
};

function Row({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="w-28 shrink-0 text-content-secondary">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/**
 * One order in full: customer, articles with their shelf state, carrier
 * details, the internal-delivery QR, and the totals.
 */
export default function OrderDetailModal({ order, stockByLine, canOps, onEdit, onClose, actions }) {
  if (!order) return null;
  const c = order.customer || {};
  // The stock check covers confirmed orders: the ones to pack next.
  const ready = statusOf(order) === ORDER_STATUS.CONFIRMED;

  return (
    <Modal isOpen onClose={onClose} title={`Order ${order.orderNumber}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(order.status)}>{statusOf(order)}</Badge>
          {order.isExchange ? <Badge tone="warning">Exchange</Badge> : null}
          {order.isBundleOrder ? <Badge tone="accent">Bundle</Badge> : null}
          {order.shortOnStock ? <Badge tone="danger">Saved short on stock</Badge> : null}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded bg-surface-sunken px-2 py-0.5 font-mono text-sm"
            onClick={() => copy(order.orderNumber, 'Order number')}
            title="Copy order number"
          >
            {order.orderNumber} <FaCopy size={11} aria-hidden="true" />
          </button>
          <span className="ml-auto text-sm text-content-secondary">
            {new Date(order.createdAt).toLocaleString('fr-TN')}
          </span>
        </div>

        <section>
          <h3 className="mb-1 text-base font-medium">Customer</h3>
          <Row label="Name">{c.nom}</Row>
          <Row label="Phone">
            {c.telephone ? (
              <button type="button" className="font-mono" onClick={() => copy(c.telephone, 'Phone number')}>
                {c.telephone} <FaCopy size={11} className="inline" aria-hidden="true" />
              </button>
            ) : null}
          </Row>
          <Row label="Phone 2">{c.telephone2}</Row>
          <Row label="Address">{[c.adresse, c.ville, c.gouvernerat].filter(Boolean).join(', ')}</Row>
          <Row label="Source">{order.shopifyOrderName ? `Shopify ${order.shopifyOrderName}` : order.source}</Row>
          <Row label="Notes">{order.notes}</Row>
        </section>

        <section>
          <h3 className="mb-1 text-base font-medium">Articles</h3>
          {ready ? (
            <p className="mb-2 text-xs text-content-muted">
              Stock is shared across confirmed orders in the list's priority, after what « Prêt à préparer » orders are taking.
            </p>
          ) : null}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit</th>
                  <th className="num">Total</th>
                  {ready ? <th>Stock</th> : null}
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item) => {
                  const s = stockByLine.get(idOf(item._id));
                  const meta = s ? LINE_STATE[s.state] : null;
                  return (
                    <tr key={idOf(item._id)}>
                      <td>
                        <div className="font-medium">{lineLabel(item)}</div>
                        <div className="font-mono text-xs text-content-muted">{item.sku}</div>
                        {item.availableAtOrder != null && item.availableAtOrder < item.quantity ? (
                          <div className="text-xs text-danger">
                            Only {item.availableAtOrder} available when ordered
                          </div>
                        ) : null}
                      </td>
                      <td className="num tabular-nums">{item.quantity}</td>
                      <td className="num tabular-nums">{dt(item.unitPrice)}</td>
                      <td className="num tabular-nums">{dt(item.totalPrice)}</td>
                      {ready ? (
                        <td>
                          {meta ? (
                            <Badge tone={meta.tone}>
                              {meta.label}
                              {s.state === 'short' ? ` · ${s.have} left, ${s.need} needed` : ''}
                            </Badge>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{dt(order.subtotal)}</span></div>
            {order.discount > 0 ? (
              <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">−{dt(order.discount)}</span></div>
            ) : null}
            {order.tax > 0 ? (
              <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{dt(order.tax)}</span></div>
            ) : null}
            <div className="flex justify-between"><span>Shipping</span><span className="tabular-nums">{dt(order.shipping)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span><span className="tabular-nums">{dt(order.total)}</span>
            </div>
          </div>
        </section>

        {order.deliveryBarcode ? (
          <section className="rounded-lg border border-border bg-surface-sunken p-3">
            <h3 className="mb-1 text-base font-medium">First Delivery</h3>
            <Row label="Barcode"><span className="font-mono">{order.deliveryBarcode}</span></Row>
            <Row label="Carrier state">{order.deliveryState != null ? String(order.deliveryState) : null}</Row>
            <Row label="Pickup">{order.pickupDate ? new Date(order.pickupDate).toLocaleDateString('fr-TN') : null}</Row>
            <Row label="Delivered">{order.deliveredDate ? new Date(order.deliveredDate).toLocaleDateString('fr-TN') : null}</Row>
            {canOps ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" icon={FaSync} disabled={actions.syncCarrierStatus.isPending}
                  onClick={() => actions.syncCarrierStatus.mutate(order._id)}>
                  Sync status
                </Button>
                {statusOf(order) !== ORDER_STATUS.CANCELLED ? (
                  <Button size="sm" icon={FaBan} disabled={actions.cancelCarrier.isPending}
                    onClick={() => window.confirm('Cancel this delivery at First Delivery?') && actions.cancelCarrier.mutate(order._id)}>
                    Cancel delivery
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="flex flex-col items-center rounded-lg border border-border p-4">
          <h3 className="mb-2 text-base font-medium">Internal delivery QR</h3>
          <QRCodeCanvas value={order.orderNumber} size={128} level="H" includeMargin />
          <p className="mt-1 text-sm text-content-secondary">Scan to assign this order to a driver.</p>
        </section>

        {canOps ? (
          <div className="flex justify-end">
            <Button variant="primary" icon={FaEdit} onClick={() => onEdit(order)}>Edit order</Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
