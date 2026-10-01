import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import Barcode from './Barcode';
import { Button } from './ui/Primitives';
import { stockService } from '../services';

const MAX_LABELS = 3000;

/** Common thermal label sizes (width × height, mm). First is the default. */
const LABEL_SIZES = [
  { id: '65x40', label: '65 × 40 mm', w: 65, h: 40 },
  { id: '58x40', label: '58 × 40 mm', w: 58, h: 40 },
  { id: '50x30', label: '50 × 30 mm', w: 50, h: 30 },
  { id: '40x30', label: '40 × 30 mm', w: 40, h: 30 },
  { id: '100x50', label: '100 × 50 mm', w: 100, h: 50 }
];

const money = (v) =>
  v == null || v === ''
    ? null
    : `${Number(v).toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;

/**
 * A full-screen overlay that lays out barcode tickets and prints them, one
 * ticket per page.
 *
 * Rendered through a portal on <body>, so printing is simple and reliable: on
 * @media print we hide #root (the whole app) and let the ticket list flow
 * normally, one 58×40mm page per ticket (break-after: page). The old
 * visibility-hidden + absolute-position trick paginated badly and emitted a
 * blank page after every label.
 *
 * Each ticket shows the name, colour · size, the EAN-13 barcode, and the price
 * (plain text, no box). `labels` is [{ barcode, name, color, size, qty, price }],
 * with two quantity modes: one per unit in stock (default), or a fixed number.
 */
export default function PrintLabels({ open, onClose, title, labels = [] }) {
  const [mode, setMode] = useState('stock');
  const [copies, setCopies] = useState(1);
  const [sizeId, setSizeId] = useState('65x40');
  const [downloading, setDownloading] = useState(false);
  if (!open) return null;

  const size = LABEL_SIZES.find((s) => s.id === sizeId) || LABEL_SIZES[0];

  const n = Math.min(Math.max(parseInt(copies, 10) || 1, 1), 200);
  const printable = labels.filter((l) => l.barcode);
  const countFor = (l) => (mode === 'stock' ? Math.max(0, Math.floor(Number(l.qty) || 0)) : n);

  const requested = printable.reduce((sum, l) => sum + countFor(l), 0);
  const capped = requested > MAX_LABELS;
  let remaining = MAX_LABELS;
  const expanded = [];
  for (const l of printable) {
    let c = countFor(l);
    if (capped) c = Math.min(c, remaining);
    for (let i = 0; i < c; i++) expanded.push(l);
    remaining -= c;
    if (capped && remaining <= 0) break;
  }

  // Download a server-rendered PDF (reliable for thermal label printers, where
  // the browser's @page is overridden by the driver). Sends base rows + a count
  // each, so the request stays small even for hundreds of labels.
  const downloadPdf = async () => {
    const rows = printable
      .map((l) => ({
        name: l.name, color: l.color, size: l.size, code: l.code,
        barcode: l.barcode, price: l.price, count: countFor(l)
      }))
      .filter((r) => r.count > 0);
    if (rows.length === 0) return;
    setDownloading(true);
    try {
      const res = await stockService.dochettes({ labels: rows, widthMm: size.w, heightMm: size.h });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dochettes-${size.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not generate the PDF');
    } finally {
      setDownloading(false);
    }
  };

  const overlay = (
    <div className="pl-overlay">
      <style>{`
        @media screen {
          .pl-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 1000; display: flex; flex-direction: column; }
          .pl-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; }
          .pl-bar .pl-title { font-weight: 600; margin-right: auto; }
          .pl-bar label { font-size: 14px; color: #475569; display: flex; align-items: center; gap: 6px; }
          .pl-bar input { width: 64px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
          .pl-bar select { padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
          .pl-warn { font-size: 13px; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 6px; }
          .pl-scroll { flex: 1; overflow: auto; padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
          .pl-label { box-shadow: 0 1px 6px rgba(0,0,0,.12); }
          .pl-empty { padding: 40px; text-align: center; color: #64748b; background:#fff; border-radius: 8px; }
        }
        /* The ticket: matches the chosen label, centred content, no border box. */
        .pl-label {
          width: ${size.w}mm; height: ${size.h}mm; background: #fff; box-sizing: border-box;
          padding: 2mm 3mm; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 0.5mm; text-align: center; overflow: hidden;
        }
        .pl-label .pl-name { font-size: 9pt; font-weight: 700; line-height: 1.05; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-label .pl-meta { font-size: 7pt; color: #333; }
        .pl-label .pl-price { font-size: 11pt; font-weight: 700; margin-top: 0.5mm; }
        .pl-label svg { max-width: 100%; height: auto; }
        .pl-empty { }
        @media print {
          @page { size: ${size.w}mm ${size.h}mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          #root { display: none !important; }
          .pl-overlay { position: static !important; background: none !important; display: block !important; }
          .pl-bar { display: none !important; }
          .pl-scroll { display: block !important; padding: 0 !important; gap: 0 !important; overflow: visible !important; }
          /* height:auto so a hair of overflow can't push a blank page; content
             sits under the label height. One page per ticket. */
          .pl-label { box-shadow: none !important; height: auto; min-height: ${size.h - 4}mm; break-after: page; page-break-after: always; }
          .pl-label:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>

      <div className="pl-bar">
        <span className="pl-title">{title}</span>
        <label>
          Label
          <select value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
            {LABEL_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label>
          Quantity
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="stock">One per unit in stock</option>
            <option value="fixed">Fixed number each</option>
          </select>
        </label>
        {mode === 'fixed' ? (
          <label>
            Copies each
            <input type="number" min="1" max="200" value={copies} onChange={(e) => setCopies(e.target.value)} />
          </label>
        ) : null}
        {capped ? (
          <span className="pl-warn" title={`${requested} tickets requested`}>capped at {MAX_LABELS}</span>
        ) : null}
        <Button variant="primary" onClick={downloadPdf} disabled={expanded.length === 0 || downloading}>
          {downloading ? 'Generating…' : `Download PDF (${expanded.length})`}
        </Button>
        <Button onClick={() => window.print()} disabled={expanded.length === 0} title="Browser print — for a normal printer. For a label roll, use Download PDF.">
          Print
        </Button>
        <Button onClick={onClose}>Close</Button>
      </div>

      <div className="pl-scroll">
        {expanded.length === 0 ? (
          <div className="pl-empty">
            {mode === 'stock'
              ? 'Nothing in stock to label. Switch to “Fixed number each”, or receive stock first.'
              : 'No barcodes to print.'}
          </div>
        ) : (
          expanded.map((l, i) => (
            <div className="pl-label" key={i}>
              {l.name ? <div className="pl-name" title={l.name}>{l.name}</div> : null}
              {(l.color || l.size) ? (
                <div className="pl-meta">{[l.color, l.size].filter(Boolean).join(' · ')}</div>
              ) : null}
              <Barcode value={l.barcode} height={40} fontSize={12} />
              {money(l.price) ? <div className="pl-price">{money(l.price)}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
