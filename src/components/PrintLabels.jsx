import { useState } from 'react';
import Barcode from './Barcode';
import { Button } from './ui/Primitives';

/**
 * A full-screen overlay that lays out barcode labels and prints them.
 *
 * Printing from an SPA reliably: on @media print we hide everything, then make
 * only .print-area visible and position it at the page origin, so the browser's
 * print (or "Save as PDF") produces just the label sheet — no app chrome. Each
 * label avoids breaking across a page.
 *
 * `labels` is [{ barcode, code, name, color, size }]. A copies control repeats
 * every label N times, for printing a run of the same SKU.
 */
export default function PrintLabels({ open, onClose, title, labels = [] }) {
  const [copies, setCopies] = useState(1);
  if (!open) return null;

  const n = Math.min(Math.max(parseInt(copies, 10) || 1, 1), 200);
  const printable = labels.filter((l) => l.barcode);
  const expanded = printable.flatMap((l) => Array.from({ length: n }, () => l));

  return (
    <div className="pl-overlay">
      <style>{`
        @media screen {
          .pl-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 1000; display: flex; flex-direction: column; }
          .pl-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; }
          .pl-bar .pl-title { font-weight: 600; margin-right: auto; }
          .pl-bar label { font-size: 14px; color: #475569; display: flex; align-items: center; gap: 6px; }
          .pl-bar input { width: 64px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
          .pl-scroll { flex: 1; overflow: auto; padding: 24px; display: flex; justify-content: center; }
          .pl-area { background: #fff; padding: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.15); }
        }
        .pl-grid { display: flex; flex-wrap: wrap; gap: 8px; width: 210mm; max-width: 100%; }
        .pl-label { width: 48mm; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 8px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .pl-label .pl-name { font-size: 11px; font-weight: 600; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-label .pl-meta { font-size: 10px; color: #64748b; }
        .pl-empty { padding: 40px; text-align: center; color: #64748b; }
        @media print {
          body * { visibility: hidden !important; }
          .pl-area, .pl-area * { visibility: visible !important; }
          .pl-area { position: absolute; inset: 0; box-shadow: none; padding: 0; }
          .pl-bar, .pl-overlay > style { display: none !important; }
          .pl-overlay { position: static; background: none; }
          .pl-scroll { overflow: visible; padding: 0; }
          .pl-label { page-break-inside: avoid; border-color: #cbd5e1; }
        }
      `}</style>

      <div className="pl-bar">
        <span className="pl-title">{title}</span>
        <label>
          Copies each
          <input type="number" min="1" max="200" value={copies} onChange={(e) => setCopies(e.target.value)} />
        </label>
        <Button variant="primary" onClick={() => window.print()} disabled={expanded.length === 0}>
          Print ({expanded.length})
        </Button>
        <Button onClick={onClose}>Close</Button>
      </div>

      <div className="pl-scroll">
        <div className="pl-area">
          {expanded.length === 0 ? (
            <div className="pl-empty">No barcodes to print.</div>
          ) : (
            <div className="pl-grid">
              {expanded.map((l, i) => (
                <div className="pl-label" key={i}>
                  {l.name ? <div className="pl-name" title={l.name}>{l.name}</div> : null}
                  {(l.color || l.size) ? (
                    <div className="pl-meta">{[l.color, l.size].filter(Boolean).join(' · ')}</div>
                  ) : null}
                  <Barcode value={l.barcode} height={40} fontSize={11} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
