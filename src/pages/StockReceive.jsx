import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { stockService, styleService } from '../services';
import { FaBarcode, FaTrash, FaCheck, FaBoxOpen, FaPlus } from 'react-icons/fa';
import {
  PageHeader,
  Button,
  Card,
  Badge,
  EmptyState,
  Select
} from '../components/ui/Primitives';

/**
 * Receiving a delivery.
 *
 * Built around the scanner, because that is how stock actually arrives: scan a
 * barcode, type a quantity, scan the next. Lines accumulate into a draft and
 * commit as ONE transaction through /stock/receive-bulk, so a delivery either
 * lands whole or not at all — a half-applied delivery note is worse than a
 * rejected one.
 *
 * Nothing is written until Confirm, so a mis-scan is just a row you delete.
 */
export default function StockReceive() {
  const queryClient = useQueryClient();
  const scanRef = useRef(null);

  const [scan, setScan] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState([]); // { sku, quantity, unitCost }
  /** The delivery just received, so its labels are one click away. */
  const [justReceived, setJustReceived] = useState(null);
  const navigate = useNavigate();
  const [lookupError, setLookupError] = useState('');

  // Manual picker, for when a label is damaged or missing.
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
      if (at === -1) return [...prev, { sku, quantity: 1, unitCost: '' }];
      // Re-scanning the same SKU increments, which is how a picker counts.
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
      stockService.receiveBulk({
        reference: { kind: 'purchase', label: reference || 'Delivery' },
        lines: lines.map((l) => ({
          skuId: l.sku._id,
          quantity: Number(l.quantity),
          unitCost: l.unitCost === '' ? undefined : Number(l.unitCost)
        }))
      }),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Delivery received');
      setJustReceived({
        label: reference || 'Delivery',
        units: lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0),
        skus: lines.map((l) => ({
          skuId: l.sku._id,
          styleId: String(l.sku.styleId?._id ?? l.sku.styleId),
          count: Number(l.quantity) || 0
        }))
      });
      setLines([]);
      setReference('');
      queryClient.invalidateQueries({ queryKey: ['styles'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      scanRef.current?.focus();
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || 'Could not receive the delivery')
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
  const totalCost = lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0),
    0
  );
  const invalid = lines.some((l) => !Number.isInteger(Number(l.quantity)) || Number(l.quantity) < 1);

  return (
    <div>
      <PageHeader
        title="Receive stock"
        description="Scan each item, or pick sizes by hand. Nothing is written until you confirm, and the whole delivery commits as one transaction."
      />

      {justReceived ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-success-border bg-success-bg px-4 py-3">
          <FaCheck className="text-success" aria-hidden="true" />
          <span className="mr-auto">
            « {justReceived.label} » received — {justReceived.units} unit(s). Label them now?
          </span>
          <Button
            variant="primary"
            icon={FaBarcode}
            onClick={() => navigate('/labels', {
              state: { addSkus: justReceived.skus, message: `${justReceived.units} label(s) from « ${justReceived.label} » added` }
            })}
          >
            Print {justReceived.units} label(s)
          </Button>
          <button type="button" className="text-sm underline" onClick={() => setJustReceived(null)}>Dismiss</button>
        </div>
      ) : null}

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
                Scanning the same code twice adds one unit each time.
              </p>
            )}

            {/* Fallback for a damaged or missing label. */}
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

          <Card
            title={`Delivery lines${lines.length ? ` (${lines.length})` : ''}`}
            padded={false}
          >
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
                      <th className="num" style={{ width: '110px' }}>Quantity</th>
                      <th className="num" style={{ width: '130px' }}>Unit cost</th>
                      <th style={{ width: '48px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.sku._id}>
                        <td className="mono">{l.sku.code}</td>
                        <td>
                          <div className="font-medium text-content">
                            {l.sku.styleId?.name || '—'}
                          </div>
                          <div className="text-sm text-content-muted">
                            {l.sku.colorwayId?.colorId?.name || ''} · {l.sku.sizeId?.label || ''}
                            <span className="ml-2">on hand {l.sku.quantityOnHand ?? 0}</span>
                          </div>
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="form-control text-right"
                            value={l.quantity}
                            onChange={(e) => setLine(i, { quantity: e.target.value })}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="—"
                            className="form-control text-right"
                            value={l.unitCost}
                            onChange={(e) => setLine(i, { unitCost: e.target.value })}
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:sticky lg:top-6">
          <Card title="Confirm">
            <label className="mb-1.5 block text-base font-medium text-content">
              Reference
            </label>
            <input
              className="form-control mb-1"
              placeholder="Delivery note, e.g. BL-2026-014"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <p className="mb-4 text-sm text-content-muted">
              Recorded against every movement, so the ledger explains where the stock came from.
            </p>

            <dl className="mb-4 flex flex-col gap-1.5 rounded-md border border-border bg-surface-sunken px-3 py-2.5">
              <div className="flex justify-between text-base">
                <dt className="text-content-secondary">Lines</dt>
                <dd className="tabular-nums font-medium">{lines.length}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt className="text-content-secondary">Units</dt>
                <dd className="tabular-nums font-medium">{totalUnits.toLocaleString('fr-TN')}</dd>
              </div>
              {totalCost > 0 ? (
                <div className="flex justify-between text-base">
                  <dt className="text-content-secondary">Total cost</dt>
                  <dd className="tabular-nums font-medium">
                    {totalCost.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT
                  </dd>
                </div>
              ) : null}
            </dl>

            {invalid ? (
              <p className="mb-3 text-base text-danger">
                Every line needs a whole quantity of at least 1.
              </p>
            ) : null}

            <Button
              variant="primary"
              icon={FaCheck}
              className="w-full"
              disabled={lines.length === 0 || invalid || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Receiving…' : 'Confirm delivery'}
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
              All lines commit together. If any one fails, none are applied.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
