import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { stockService } from '../services';
import { FaBarcode, FaTrash, FaCheck, FaClipboardList } from 'react-icons/fa';
import {
  PageHeader,
  Button,
  Card,
  Badge,
  EmptyState
} from '../components/ui/Primitives';

/**
 * Stocktake.
 *
 * The number that matters here is the VARIANCE, not the count — "you have 7,
 * the system thinks 10" is the finding. So each line shows expected, counted
 * and the difference, and the summary leads with how many lines disagree.
 *
 * Counts are applied through /stock/count, which writes the difference as an
 * adjustment rather than overwriting the balance. That keeps the ledger able
 * to explain the change, which a silent overwrite would destroy.
 *
 * Unlike receiving, these are applied per SKU rather than in one transaction:
 * a stocktake is a series of independent findings, and one bad line should not
 * discard the rest of an afternoon's counting. The result reports per line.
 */
export default function StockCount() {
  const queryClient = useQueryClient();
  const scanRef = useRef(null);
  const qtyRef = useRef(null);

  const [scan, setScan] = useState('');
  const [pending, setPending] = useState(null); // SKU awaiting a counted qty
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState([]); // { sku, expected, counted }
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => { scanRef.current?.focus(); }, []);
  useEffect(() => { if (pending) qtyRef.current?.focus(); }, [pending]);

  const onScan = async (e) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    try {
      const res = await stockService.lookup(code);
      setPending(res.data.data);
      setScan('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'No SKU matches that code');
      setScan('');
      scanRef.current?.focus();
    }
  };

  const commitLine = (e) => {
    e.preventDefault();
    const qty = Number(counted);
    if (!Number.isInteger(qty) || qty < 0) {
      setError('Counted quantity must be zero or a whole number');
      return;
    }
    setLines((prev) => {
      const at = prev.findIndex((l) => l.sku._id === pending._id);
      const line = { sku: pending, expected: pending.quantityOnHand ?? 0, counted: qty };
      if (at === -1) return [...prev, line];
      // Re-counting the same SKU replaces the earlier figure.
      const next = [...prev];
      next[at] = line;
      return next;
    });
    setPending(null);
    setCounted('');
    setError('');
    scanRef.current?.focus();
  };

  const removeLine = (i) => setLines((prev) => prev.filter((_, x) => x !== i));

  const apply = async () => {
    if (!reason.trim()) {
      setError('A stocktake needs a reason — it is recorded against every adjustment.');
      return;
    }
    setApplying(true);
    setError('');
    const out = { applied: 0, unchanged: 0, failed: [] };

    for (const line of lines) {
      try {
        const res = await stockService.count({
          skuId: line.sku._id,
          countedQuantity: line.counted,
          reason: reason.trim()
        });
        if (res.data.data?.unchanged) out.unchanged++;
        else out.applied++;
      } catch (err) {
        out.failed.push({
          code: line.sku.code,
          message: err.response?.data?.message || 'Failed'
        });
      }
    }

    setApplying(false);
    setResults(out);
    if (out.failed.length === 0) {
      toast.success(`Stocktake applied — ${out.applied} adjusted, ${out.unchanged} already correct`);
      setLines([]);
      setReason('');
    } else {
      toast.warning(`${out.failed.length} line(s) failed; the rest were applied`);
      setLines((prev) => prev.filter((l) => out.failed.some((f) => f.code === l.sku.code)));
    }
    queryClient.invalidateQueries({ queryKey: ['styles'] });
    scanRef.current?.focus();
  };

  const variances = lines.filter((l) => l.counted !== l.expected);
  const netUnits = lines.reduce((s, l) => s + (l.counted - l.expected), 0);

  return (
    <div>
      <PageHeader
        title="Stock count"
        description="Scan an item and enter what you actually counted. Differences are written as adjustments, so the ledger keeps explaining every change."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div>
          <Card title="Count">
            {!pending ? (
              <form onSubmit={onScan}>
                <div className="flex gap-2">
                  <div className="search-box flex-1">
                    <FaBarcode className="search-icon" />
                    <input
                      ref={scanRef}
                      className="form-control"
                      placeholder="Scan a barcode or type a SKU code…"
                      value={scan}
                      onChange={(e) => { setScan(e.target.value); setError(''); }}
                      autoComplete="off"
                    />
                  </div>
                  <Button variant="primary" type="submit" disabled={!scan.trim()}>Find</Button>
                </div>
              </form>
            ) : (
              /* Two steps on purpose: the expected figure is revealed only
                 once the item is identified, and the counter types what is in
                 front of them rather than adjusting a pre-filled number. */
              <form onSubmit={commitLine}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2.5">
                  <div>
                    <div className="font-medium text-content">{pending.styleId?.name}</div>
                    <div className="text-sm text-content-secondary">
                      {pending.colorwayId?.colorId?.name} · {pending.sizeId?.label}
                    </div>
                    <div className="font-mono text-xs text-content-muted">{pending.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-content-muted">System says</div>
                    <div className="text-2xl font-semibold tabular-nums leading-none">
                      {pending.quantityOnHand ?? 0}
                    </div>
                  </div>
                </div>

                <label className="mb-1.5 block text-base font-medium">Counted quantity</label>
                <div className="flex gap-2">
                  <input
                    ref={qtyRef}
                    type="number"
                    min="0"
                    step="1"
                    className="form-control"
                    placeholder="How many are actually there?"
                    value={counted}
                    onChange={(e) => setCounted(e.target.value)}
                  />
                  <Button variant="primary" type="submit" disabled={counted === ''}>Record</Button>
                  <Button onClick={() => { setPending(null); setCounted(''); scanRef.current?.focus(); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {error ? <p className="mt-2 text-base text-danger">{error}</p> : null}
          </Card>

          <Card title={`Counted${lines.length ? ` (${lines.length})` : ''}`} padded={false}>
            {lines.length === 0 ? (
              <EmptyState
                icon={FaClipboardList}
                title="Nothing counted yet"
                description="Scan an item to begin. Nothing is written until you apply the count."
              />
            ) : (
              <div className="table-container !border-0">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item</th>
                      <th className="num">Expected</th>
                      <th className="num">Counted</th>
                      <th className="num">Variance</th>
                      <th style={{ width: '48px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const diff = l.counted - l.expected;
                      return (
                        <tr key={l.sku._id}>
                          <td className="mono">{l.sku.code}</td>
                          <td>
                            <div className="font-medium text-content">{l.sku.styleId?.name}</div>
                            <div className="text-sm text-content-muted">
                              {l.sku.colorwayId?.colorId?.name} · {l.sku.sizeId?.label}
                            </div>
                          </td>
                          <td className="num text-content-secondary">{l.expected}</td>
                          <td className="num font-medium">{l.counted}</td>
                          <td className="num">
                            {diff === 0 ? (
                              <span className="text-content-muted">—</span>
                            ) : (
                              <Badge tone={diff > 0 ? 'success' : 'danger'}>
                                {diff > 0 ? '+' : ''}{diff}
                              </Badge>
                            )}
                          </td>
                          <td>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="btn-icon text-danger"
                              title="Remove"
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

          {results ? (
            <Card title="Result">
              <p className="text-base">
                {results.applied} adjusted · {results.unchanged} already correct
                {results.failed.length ? ` · ${results.failed.length} failed` : ''}
              </p>
              {results.failed.length ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {results.failed.map((f) => (
                    <li key={f.code} className="text-base text-danger">
                      <span className="font-mono">{f.code}</span> — {f.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-6">
          <Card title="Apply">
            <dl className="mb-4 flex flex-col gap-1.5 rounded-md border border-border bg-surface-sunken px-3 py-2.5">
              <div className="flex justify-between text-base">
                <dt className="text-content-secondary">Counted</dt>
                <dd className="font-medium tabular-nums">{lines.length}</dd>
              </div>
              {/* The finding, not the tally. */}
              <div className="flex justify-between text-base">
                <dt className="text-content-secondary">Discrepancies</dt>
                <dd className={`font-medium tabular-nums ${variances.length ? 'text-warning' : ''}`}>
                  {variances.length}
                </dd>
              </div>
              {netUnits !== 0 ? (
                <div className="flex justify-between text-base">
                  <dt className="text-content-secondary">Net change</dt>
                  <dd className={`font-medium tabular-nums ${netUnits > 0 ? 'text-success' : 'text-danger'}`}>
                    {netUnits > 0 ? '+' : ''}{netUnits} units
                  </dd>
                </div>
              ) : null}
            </dl>

            <label className="mb-1.5 block text-base font-medium">Reason</label>
            <input
              className="form-control mb-1"
              placeholder="e.g. Inventaire annuel 2026"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
            />
            <p className="mb-4 text-sm text-content-muted">
              Required. Recorded on every adjustment this count produces.
            </p>

            <Button
              variant="primary"
              icon={FaCheck}
              className="w-full"
              disabled={lines.length === 0 || applying}
              onClick={apply}
            >
              {applying ? 'Applying…' : `Apply count (${lines.length})`}
            </Button>

            {lines.length > 0 ? (
              <Button
                variant="ghost"
                className="mt-2 w-full"
                disabled={applying}
                onClick={() => { setLines([]); setResults(null); }}
              >
                Discard
              </Button>
            ) : null}

            <p className="mt-3 text-sm text-content-muted">
              Lines with no difference are left untouched rather than written as
              a zero adjustment.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
