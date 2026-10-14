import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { FaBarcode, FaCheck, FaPrint } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { stockService } from '../../services';
import { Button } from '../../components/ui/Primitives';
import { styleGrid, pdfRows } from '../labels/labelQueue';
import { currentLabelSize, downloadLabelsPdf } from '../labels/labelPrint';

/**
 * Receive a delivery for one style straight on its grid, then print its labels.
 *
 * Type how many arrived in each colour and size — Rouge: 39 × 2, 38 × 5,
 * 37 × 10; Bleu: 40 × 10, 36 × 3, 37 × 9 — and « Receive & print labels »
 * records it as one delivery and downloads exactly those labels, one per unit,
 * at the label size chosen on the Print labels page. Enter moves to the next
 * box, so a delivery can be typed without touching the mouse.
 */
export default function ReceiveGrid({ style, onReceived, onCancel }) {
  const navigate = useNavigate();
  const [qty, setQty] = useState({});
  const [reference, setReference] = useState('');
  const [done, setDone] = useState(null); // { label, units, counts, printed }
  const [printing, setPrinting] = useState(false);
  const gridRef = useRef(null);

  const { sizes, rows } = useMemo(() => styleGrid(style), [style]);
  const units = Object.values(qty).reduce((a, b) => a + b, 0);
  const lines = Object.entries(qty).filter(([, n]) => n > 0);

  const set = (skuId, v) =>
    setQty((cur) => {
      const n = Math.max(0, Math.min(100000, Math.floor(Number(v) || 0)));
      const next = { ...cur };
      if (n) next[skuId] = n;
      else delete next[skuId];
      return next;
    });

  /** Labels for a set of received quantities: one per unit, SKUs without a barcode left out. */
  const labelRows = (counts) => pdfRows({ counts }, [style]);

  const print = async (counts) => {
    const rowsToPrint = labelRows(counts);
    if (!rowsToPrint.length) {
      toast.warning('None of these SKUs has a barcode to print');
      return false;
    }
    setPrinting(true);
    try {
      const n = await downloadLabelsPdf(rowsToPrint);
      toast.success(`${n} label(s) downloaded (${currentLabelSize().label}) — print at 100 %`);
      return true;
    } catch {
      toast.error('Stock received, but the labels PDF could not be built — use « Print labels » below');
      return false;
    } finally {
      setPrinting(false);
    }
  };

  const receive = useMutation({
    mutationFn: () =>
      stockService.receiveBulk({
        reference: { kind: 'purchase', label: reference.trim() || `Delivery — ${style.name}` },
        lines: lines.map(([skuId, quantity]) => ({ skuId, quantity }))
      }),
    onSuccess: async (_res, { andPrint }) => {
      const counts = { ...qty };
      const label = reference.trim() || 'Delivery';
      toast.success(`${units} unit(s) received`);
      setQty({});
      setReference('');
      onReceived?.();
      const printed = andPrint ? await print(counts) : false;
      setDone({ label, units, counts, printed });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not receive the stock')
  });

  // Enter jumps to the next box, row by row — typing a delivery off a packing list.
  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const boxes = [...(gridRef.current?.querySelectorAll('input[data-cell]') || [])];
    const next = boxes[boxes.indexOf(e.target) + 1];
    if (next) next.focus();
    else e.target.blur();
  };

  const missingBarcodes = lines.filter(([skuId]) => {
    for (const r of rows) for (const sku of r.cells.values()) if (String(sku._id) === skuId) return !sku.barcode;
    return false;
  }).length;

  return (
    <div>
      {done ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-success-border bg-success-bg px-4 py-3">
          <FaCheck className="text-success" aria-hidden="true" />
          <span className="mr-auto">
            {done.units} unit(s) received{done.printed ? ' and their labels downloaded' : ''}.
          </span>
          <Button size="sm" icon={FaPrint} disabled={printing} onClick={() => print(done.counts)}>
            {done.printed ? 'Download labels again' : `Print ${done.units} label(s)`}
          </Button>
          <Button
            size="sm"
            icon={FaBarcode}
            onClick={() =>
              navigate('/labels', {
                state: {
                  addSkus: Object.entries(done.counts).map(([skuId, count]) => ({ skuId, styleId: String(style._id), count })),
                  message: `${done.units} label(s) added to the basket`
                }
              })
            }
          >
            Add to label basket
          </Button>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="form-control max-w-xs"
          placeholder="Delivery note / reference (optional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <span className="text-sm text-content-secondary">
          Type how many arrived in each colour and size. Grey number: in stock now.
        </span>
      </div>

      <div className="table-container" ref={gridRef}>
        <table className="text-sm">
          <thead>
            <tr>
              <th className="text-left">Colour</th>
              {sizes.map((s) => <th key={s.key} className="text-center">{s.label}</th>)}
              <th className="text-right">Units</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ colorway, cells }) => {
              const rowUnits = [...cells.values()].reduce((a, sku) => a + (qty[String(sku._id)] || 0), 0);
              return (
                <tr key={colorway._id}>
                  <td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded border border-border" style={{ background: colorway.colorId?.hexCode || '#ccc' }} aria-hidden="true" />
                      {colorway.colorId?.name || 'Colour'}
                    </span>
                  </td>
                  {sizes.map((s) => {
                    const sku = cells.get(s.key);
                    if (!sku) return <td key={s.key} className="text-center text-content-muted">·</td>;
                    const value = qty[String(sku._id)] || '';
                    return (
                      <td key={s.key} className="text-center">
                        <input
                          data-cell
                          type="number"
                          min="0"
                          inputMode="numeric"
                          className={`form-control !h-9 !w-16 !px-1 !py-0 text-center tabular-nums ${value ? '!border-success font-semibold' : ''}`}
                          value={value}
                          placeholder="0"
                          onChange={(e) => set(String(sku._id), e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={onKeyDown}
                          aria-label={`Received ${colorway.colorId?.name} ${s.label}`}
                          title={sku.barcode ? sku.code : `${sku.code} — no barcode, no label will print`}
                        />
                        <span className="block text-[10px] text-content-muted tabular-nums">{sku.quantityOnHand ?? 0}</span>
                      </td>
                    );
                  })}
                  <td className="text-right tabular-nums font-medium">{rowUnits || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-content-secondary">
          <strong className="text-content">{units}</strong> unit(s) in {lines.length} size(s)
          {missingBarcodes ? <span className="text-warning"> · {missingBarcodes} without a barcode (no label)</span> : null}
          {' · '}labels at {currentLabelSize().label}
        </span>
        <Button onClick={onCancel}>Done</Button>
        <Button disabled={!units || receive.isPending} onClick={() => receive.mutate({ andPrint: false })}>
          Receive only
        </Button>
        <Button
          variant="primary"
          icon={FaPrint}
          disabled={!units || receive.isPending || printing}
          onClick={() => receive.mutate({ andPrint: true })}
        >
          {receive.isPending ? 'Receiving…' : `Receive & print ${units || ''} label(s)`}
        </Button>
      </div>
    </div>
  );
}
