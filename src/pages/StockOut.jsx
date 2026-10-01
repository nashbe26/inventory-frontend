import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { stockService, styleService } from '../services';
import { FaBarcode, FaTrash, FaCheck, FaBoxOpen } from 'react-icons/fa';
import {
  PageHeader,
  Button,
  Card,
  EmptyState,
  Select
} from '../components/ui/Primitives';

/**
 * Stock going out — a counter sale, a wholesale dispatch, a write-off.
 *
 * The mirror of Receive: scan a barcode, type a quantity, scan the next. Lines
 * accumulate into a draft and commit as ONE transaction through /stock/pick-bulk,
 * so the whole dispatch leaves together or not at all. Overselling is refused by
 * the server — a line that exceeds stock on hand rolls back the entire lot,
 * rather than shipping more than you hold.
 *
 * Nothing is written until Confirm, so a mis-scan is just a row you delete.
 */
export default function StockOut() {
  const queryClient = useQueryClient();
  const scanRef = useRef(null);

  const [scan, setScan] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState([]); // { sku, quantity }
  const [lookupError, setLookupError] = useState('');

  const [styleId, setStyleId] = useState('');

  const { data: styles } = useQuery({
    queryKey: ['styles', 'picker'],
    queryFn: async () => (await styleService.getAll({ limit: 100, status: 'active' })).data.data
  });

  const { data: pickedStyle } = useQuery({
    queryKey: ['style', styleId],
    queryFn: async () => (await styleService.getOne(styleId)).data.data,
    enabled: Boolean(styleId)
  });

  useEffect(() => { scanRef.current?.focus(); }, []);

  const addSku = (sku) => {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.sku._id === sku._id);
      if (at === -1) return [...prev, { sku, quantity: 1 }];
      const next = [...prev];
      next[at] = { ...next[at], quantity: next[at].quantity + 1 };
      return next;
    });
  };

  const lookup = useMutation({
    mutationFn: (identifier) => stockService.lookup(identifier),
    onSuccess: (res) => {
      addSku(res.data.data);
      setScan('');
      setLookupError('');
      scanRef.current?.focus();
    },
    onError: (e) => {
      setLookupError(e.response?.data?.message || 'No SKU matches that code');
      setScan('');
      scanRef.current?.focus();
    }
  });

  const submit = useMutation({
    mutationFn: () =>
      stockService.pickBulk({
        reason: reason || undefined,
        reference: { kind: 'manual', label: reason || 'Stock out' },
        lines: lines.map((l) => ({ skuId: l.sku._id, quantity: Number(l.quantity) }))
      }),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Stock dispatched');
      setLines([]);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['styles'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      scanRef.current?.focus();
    },
    onError: (e) => {
      // The server names the SKU and the available quantity on an oversell.
      const d = e.response?.data;
      toast.error(
        d?.available != null
          ? `${d.message} (${d.sku})`
          : d?.message || 'Could not dispatch the stock'
      );
    }
  });

  const onScanSubmit = (e) => {
    e.preventDefault();
    const code = scan.trim();
    if (code) lookup.mutate(code);
  };

  const setLine = (index, patch) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const removeLine = (index) =>
    setLines((prev) => prev.filter((_, i) => i !== index));

  const totalUnits = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const invalidQty = lines.some((l) => !Number.isInteger(Number(l.quantity)) || Number(l.quantity) < 1);
  // Warn before submit when a line asks for more than is on hand.
  const overLines = lines.filter((l) => Number(l.quantity) > (l.sku.quantityOnHand ?? 0));

  return (
    <div>
      <PageHeader
        title="Stock out"
        description="Scan what is leaving — a sale, a dispatch, a write-off. Nothing is written until you confirm, and the whole lot commits as one transaction."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div>
          <Card title="Scan">
            <form onSubmit={onScanSubmit}>
              <div className="flex gap-2">
                <div className="search-box flex-1">
                  <FaBarcode className="search-icon" />
                  <input
                    ref={scanRef}
                    className="form-control"
                    placeholder="Scan a barcode or type a SKU code…"
                    value={scan}
                    onChange={(e) => { setScan(e.target.value); setLookupError(''); }}
                    autoComplete="off"
                  />
                </div>
                <Button variant="primary" type="submit" disabled={!scan.trim() || lookup.isPending}>
                  Add
                </Button>
              </div>
            </form>
            {lookupError ? (
              <p className="mt-2 text-base text-danger">{lookupError}</p>
            ) : (
              <p className="mt-2 text-sm text-content-muted">
                Scanning the same code twice takes out one unit each time.
              </p>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium text-content-secondary">
                No barcode? Pick by style
              </p>
              <Select
                value={styleId}
                onChange={setStyleId}
                placeholder="Select a style"
                options={(styles || []).map((s) => ({ value: s._id, label: `${s.code} · ${s.name}` }))}
                className="!w-full"
              />
              {pickedStyle ? (
                <div className="mt-3 flex flex-col gap-3">
                  {(pickedStyle.colorways || []).map((cw) => (
                    <div key={cw._id}>
                      <div className="mb-1.5 flex items-center gap-2 text-base">
                        <span
                          className="h-3 w-3 rounded border border-border-strong"
                          style={{ background: cw.colorId?.hexCode || '#ccc' }}
                        />
                        {cw.colorId?.name}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(cw.skus || []).map((sku) => (
                          <button
                            key={sku._id}
                            type="button"
                            onClick={() => addSku({ ...sku, colorwayId: cw, styleId: pickedStyle })}
                            className="rounded-md border border-border bg-surface px-2.5 py-1 text-sm transition hover:border-border-strong hover:bg-surface-hover"
                          >
                            {sku.sizeId?.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          <Card title={`Lines out${lines.length ? ` (${lines.length})` : ''}`} padded={false}>
            {lines.length === 0 ? (
              <EmptyState
                icon={FaBoxOpen}
                title="Nothing scanned yet"
                description="Scan an item's barcode above, or pick sizes from a style. Lines appear here before anything is written."
              />
            ) : (
              <div className="table-container !border-0">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item</th>
                      <th className="num" style={{ width: '90px' }}>On hand</th>
                      <th className="num" style={{ width: '110px' }}>Out</th>
                      <th style={{ width: '48px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const onHand = l.sku.quantityOnHand ?? 0;
                      const over = Number(l.quantity) > onHand;
                      return (
                        <tr key={l.sku._id}>
                          <td className="mono">{l.sku.code}</td>
                          <td>
                            <div className="font-medium text-content">{l.sku.styleId?.name || '—'}</div>
                            <div className="text-sm text-content-muted">
                              {l.sku.colorwayId?.colorId?.name || ''} · {l.sku.sizeId?.label || ''}
                            </div>
                          </td>
                          <td className="num tabular-nums">{onHand}</td>
                          <td className="num">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              className={`form-control text-right ${over ? '!border-danger' : ''}`}
                              value={l.quantity}
                              onChange={(e) => setLine(i, { quantity: e.target.value })}
                            />
                          </td>
                          <td>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="btn-icon text-danger"
                              title="Remove line"
                              onClick={() => removeLine(i)}
                            >
                              <FaTrash />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:sticky lg:top-6">
          <Card title="Confirm">
            <label className="mb-1.5 block text-base font-medium text-content">Reason</label>
            <input
              className="form-control mb-1"
              placeholder="e.g. Counter sale, Wholesale, Damaged"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="mb-4 text-sm text-content-muted">
              Recorded against every movement, so the ledger explains where the stock went.
            </p>

            <dl className="mb-4 flex flex-col gap-1.5 rounded-md border border-border bg-surface-sunken px-3 py-2.5">
              <div className="flex justify-between text-base">
                <dt className="text-content-secondary">Lines</dt>
                <dd className="tabular-nums font-medium">{lines.length}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt className="text-content-secondary">Units out</dt>
                <dd className="tabular-nums font-medium">{totalUnits.toLocaleString('fr-TN')}</dd>
              </div>
            </dl>

            {invalidQty ? (
              <p className="mb-3 text-base text-danger">Every line needs a whole quantity of at least 1.</p>
            ) : null}
            {!invalidQty && overLines.length > 0 ? (
              <p className="mb-3 text-base text-danger">
                {overLines.length} line{overLines.length === 1 ? '' : 's'} exceed stock on hand — the server will refuse the dispatch.
              </p>
            ) : null}

            <Button
              variant="primary"
              icon={FaCheck}
              className="w-full"
              disabled={lines.length === 0 || invalidQty || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Dispatching…' : 'Confirm stock out'}
            </Button>

            {lines.length > 0 ? (
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => setLines([])}
                disabled={submit.isPending}
              >
                Discard {lines.length} line{lines.length === 1 ? '' : 's'}
              </Button>
            ) : null}

            <p className="mt-3 text-sm text-content-muted">
              All lines commit together. If any one exceeds stock, none are applied.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
