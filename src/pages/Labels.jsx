import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { FaBarcode, FaBoxOpen, FaFilePdf, FaTimes, FaTrash, FaTruckLoading } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { stockService, styleService } from '../services';
import { PageHeader, Button, Badge, EmptyState, Skeleton } from '../components/ui/Primitives';
import Barcode from '../components/Barcode';
import { downloadLabelsPdf } from './labels/labelPrint';
import {
  LABEL_SIZES,
  MAX_LABELS,
  loadQueue,
  saveQueue,
  loadSizeId,
  saveSizeId,
  addStyles,
  addSkus,
  setCount,
  setCounts,
  removeStyle,
  totalLabels,
  styleGrid,
  pdfRows
} from './labels/labelQueue';

const money = (v) =>
  v == null || v === '' ? null : `${Number(v).toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;

const idOf = (v) => String(v?._id ?? v ?? '');

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Print labels — one basket for every style, colour and size.
 *
 * Add styles by searching, a single SKU by scanning its barcode, or a whole
 * delivery from Receive stock. Each style appears as a grid (colours down,
 * sizes across) where each cell is how many labels that SKU gets, with one-click
 * fills for a row or the whole style. One PDF prints everything, one label per
 * page at the chosen size. The basket is kept in the browser, so other pages
 * can send work here and nothing is lost by navigating away.
 */
export default function Labels() {
  const location = useLocation();
  const navigate = useNavigate();

  const [queue, setQueueState] = useState(loadQueue);
  const setQueue = (update) =>
    setQueueState((q) => {
      const next = typeof update === 'function' ? update(q) : update;
      saveQueue(next);
      return next;
    });

  const [sizeId, setSizeIdState] = useState(loadSizeId);
  const size = LABEL_SIZES.find((s) => s.id === sizeId) || LABEL_SIZES[0];
  const [downloading, setDownloading] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);

  // Work sent from another page (a style, a SKU, a delivery): add it once, then
  // drop it from history so a refresh does not add it again.
  useEffect(() => {
    const st = location.state;
    if (!st || (!st.addStyles && !st.addSkus)) return;
    setQueue((q) => {
      let next = q;
      if (st.addStyles) next = addStyles(next, st.addStyles);
      if (st.addSkus) next = addSkus(next, st.addSkus);
      return next;
    });
    if (st.message) toast.info(st.message);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  /* ------------------------------------------------------------- styles */

  const styleQueries = useQueries({
    queries: queue.styleIds.map((id) => ({
      queryKey: ['style', id],
      queryFn: async () => (await styleService.getOne(id)).data.data,
      staleTime: 60 * 1000,
      retry: 1
    }))
  });
  const loaded = styleQueries.map((q) => q.data).filter(Boolean);
  const loading = styleQueries.some((q) => q.isLoading);

  // A style deleted since it was added: drop it quietly.
  useEffect(() => {
    styleQueries.forEach((q, i) => {
      if (q.isError && q.error?.response?.status === 404) {
        const id = queue.styleIds[i];
        setQueue((cur) => removeStyle(cur, id));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleQueries.map((q) => q.status).join()]);

  const rows = useMemo(() => pdfRows(queue, loaded), [queue, loaded]);
  const total = rows.reduce((a, r) => a + r.count, 0);
  const counted = totalLabels(queue);
  const noBarcode = counted - total; // labels asked for SKUs that have no barcode

  /* ----------------------------------------------------------- printing */

  const download = async () => {
    if (!rows.length) return;
    setDownloading(true);
    try {
      await downloadLabelsPdf(rows, size);
      toast.success(`${Math.min(total, MAX_LABELS)} label(s) ready — print the PDF at 100 % (actual size)`);
    } catch {
      toast.error('Could not build the labels PDF');
    } finally {
      setDownloading(false);
    }
  };

  const firstLabel = rows[0];

  return (
    <div className="pb-24">
      <PageHeader
        title="Print labels"
        description="Pick styles, set how many labels each colour and size needs, and print them all in one PDF."
      >
        <label className="flex items-center gap-2 text-sm text-content-secondary">
          Label size
          <select
            className="form-control !w-auto"
            value={sizeId}
            onChange={(e) => { setSizeIdState(e.target.value); saveSizeId(e.target.value); }}
          >
            {LABEL_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </PageHeader>

      {/* --------------------------------------------------------- add */}
      <section className="card mb-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[260px] flex-1">
            <Finder
              onAddStyle={(styleId, name) => {
                setQueue((q) => addStyles(q, [styleId]));
                toast.info(`${name} added — set the quantities below`, { autoClose: 1500 });
              }}
              onScanSku={(sku) => {
                setQueue((q) => addSkus(q, [{ skuId: idOf(sku._id), styleId: idOf(sku.styleId), count: 1 }]));
                toast.success(`+1 label · ${sku.styleId?.name || sku.code} ${sku.colorwayId?.colorId?.name || ''} ${sku.sizeId?.label || ''}`, { autoClose: 1200 });
              }}
            />
          </div>
          <Button icon={FaTruckLoading} onClick={() => setShowDeliveries((v) => !v)}>
            {showDeliveries ? 'Hide deliveries' : 'From a delivery'}
          </Button>
        </div>
        {showDeliveries ? (
          <Deliveries
            onAdd={(batch) => {
              setQueue((q) => addSkus(q, batch.lines.map((l) => ({ skuId: l.skuId, styleId: l.styleId, count: l.quantity }))));
              toast.success(`${batch.units} label(s) added from « ${batch.label} »`);
            }}
          />
        ) : null}
      </section>

      {/* ------------------------------------------------------ basket */}
      {queue.styleIds.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={FaBarcode}
            title="The basket is empty"
            description="Search for a style above, scan a barcode to add one label, or add the labels of a delivery you received."
          />
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 space-y-4">
            {styleQueries.map((q, i) =>
              q.data ? (
                <StyleCard
                  key={queue.styleIds[i]}
                  style={q.data}
                  counts={queue.counts}
                  onSet={(skuId, n) => setQueue((cur) => setCount(cur, skuId, n))}
                  onSetMany={(pairs) => setQueue((cur) => setCounts(cur, pairs))}
                  onRemove={(skuIds) => setQueue((cur) => removeStyle(cur, queue.styleIds[i], skuIds))}
                />
              ) : (
                <section key={queue.styleIds[i]} className="card"><Skeleton className="h-24 w-full" /></section>
              )
            )}
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <section className="card">
              <h3 className="mb-2 text-base font-medium">Preview</h3>
              {firstLabel ? (
                <LabelPreview label={firstLabel} size={size} />
              ) : (
                <p className="max-w-[220px] text-sm text-content-muted">Set a quantity to see what the label looks like.</p>
              )}
              <p className="mt-2 max-w-[260px] text-xs text-content-muted">
                One label per page, {size.label}. Print the PDF at 100 % (actual size), not « fit to page ».
              </p>
            </section>
          </aside>
        </div>
      )}

      {/* -------------------------------------------------- action bar */}
      {queue.styleIds.length ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-[var(--content-max)] flex-wrap items-center justify-end gap-3">
            <span className="mr-auto text-sm text-content-secondary">
              <strong className="text-content">{total.toLocaleString('fr-TN')}</strong> label(s) · {loaded.length} style(s)
              {noBarcode > 0 ? <span className="text-warning"> · {noBarcode} skipped: SKU without a barcode</span> : null}
              {total > MAX_LABELS ? <span className="text-danger"> · only the first {MAX_LABELS} are printed — split the basket</span> : null}
            </span>
            <Button icon={FaTrash} onClick={() => window.confirm('Empty the label basket?') && setQueue({ styleIds: [], counts: {} })}>
              Empty basket
            </Button>
            <Button variant="primary" icon={FaFilePdf} disabled={!total || downloading || loading} onClick={download}>
              {downloading ? 'Building PDF…' : `Download PDF (${Math.min(total, MAX_LABELS)})`}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- finder */

/**
 * Search the catalogue by style, colour, size or code and add a style; or scan
 * a barcode, which adds one label for that SKU (Enter, as a scanner sends it).
 */
function Finder({ onAddStyle, onScanSku }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const q = useDebounced(text.trim());

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ['skuCatalog', 'labels', q],
    queryFn: async () => (await stockService.catalog({ search: q, limit: 200 })).data.data,
    enabled: q.length >= 2,
    staleTime: 30 * 1000
  });

  // One row per style, with how much of it matched.
  const styles = useMemo(() => {
    const m = new Map();
    for (const s of hits) {
      const k = idOf(s.styleId);
      const cur = m.get(k) || { styleId: k, name: s.styleName, code: s.styleCode, skus: 0, stock: 0, colors: new Set() };
      cur.skus++;
      cur.stock += s.quantityOnHand || 0;
      if (s.colorName) cur.colors.add(s.colorName);
      m.set(k, cur);
    }
    return [...m.values()].slice(0, 12);
  }, [hits]);

  const scan = async () => {
    const raw = text.trim();
    if (!raw) return;
    setBusy(true);
    try {
      const sku = (await stockService.lookup(raw)).data.data;
      onScanSku(sku);
      setText('');
    } catch {
      // Not a barcode or code: if exactly one style matched, add it.
      if (styles.length === 1) {
        onAddStyle(styles[0].styleId, styles[0].name);
        setText('');
      } else {
        toast.info('No SKU with that barcode — pick a style from the list');
      }
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="form-control"
        placeholder="Search a style, colour, size — or scan a barcode to add one label"
        value={text}
        disabled={busy}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); scan(); }
          if (e.key === 'Escape') setText('');
        }}
        autoComplete="off"
        spellCheck={false}
      />
      {q.length >= 2 && text.trim().length >= 2 ? (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {isFetching && !styles.length ? (
            <p className="px-4 py-3 text-sm text-content-muted">Searching…</p>
          ) : !styles.length ? (
            <p className="px-4 py-3 text-sm text-content-muted">No style matches.</p>
          ) : (
            styles.map((s) => (
              <button
                key={s.styleId}
                type="button"
                className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-surface-hover"
                onClick={() => { onAddStyle(s.styleId, s.name); setText(''); inputRef.current?.focus(); }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-content-muted">
                    {s.code} · {[...s.colors].slice(0, 4).join(', ')}{s.colors.size > 4 ? '…' : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-content-secondary">
                  {s.skus} SKU(s)<br />{s.stock} in stock
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- deliveries */

/** Recent receipts, each addable as « one label per unit received ». */
function Deliveries({ onAdd }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['receiptBatches'],
    queryFn: async () => (await stockService.receiptBatches(30)).data.data,
    staleTime: 30 * 1000
  });
  if (isLoading) return <Skeleton className="mt-3 h-16 w-full" />;
  if (!data.length) return <p className="mt-3 text-sm text-content-muted">No stock received in the last 30 days.</p>;
  return (
    <ul className="mt-3 max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
      {data.map((b) => (
        <li key={b.key} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0">
            <span className="block font-medium">{b.label}</span>
            <span className="block text-xs text-content-muted">
              {new Date(b.receivedAt).toLocaleString('fr-TN', { dateStyle: 'short', timeStyle: 'short' })}
              {b.user ? ` · ${b.user}` : ''} · {b.skuCount} SKU(s)
            </span>
          </span>
          <Button size="sm" icon={FaBoxOpen} onClick={() => onAdd(b)}>Add {b.units} label(s)</Button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------- style card */

/**
 * One style as a grid of label counts: a row per colour, a column per size.
 * Quick fills work on the whole style or one colour row.
 */
function StyleCard({ style, counts, onSet, onSetMany, onRemove }) {
  const { sizes, rows } = useMemo(() => styleGrid(style), [style]);
  const allSkus = rows.flatMap((r) => [...r.cells.values()]);
  const styleTotal = allSkus.reduce((a, s) => a + (counts[String(s._id)] || 0), 0);
  const fill = (skus, how) =>
    onSetMany(
      skus.filter((s) => s.barcode).map((s) => [
        String(s._id),
        how === 'one' ? 1 : how === 'stock' ? s.quantityOnHand || 0 : 0
      ])
    );

  return (
    <section className="card">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <h3 className="!mb-0 truncate text-base font-semibold">{style.name}</h3>
          <p className="text-xs text-content-muted">
            {style.code}{money(style.retailPrice) ? ` · ${money(style.retailPrice)}` : ''} · {styleTotal} label(s)
          </p>
        </div>
        <Button size="sm" onClick={() => fill(allSkus, 'one')} title="One label for every colour and size">1 each</Button>
        <Button size="sm" onClick={() => fill(allSkus, 'stock')} title="One label per unit in stock">= stock</Button>
        <Button size="sm" onClick={() => fill(allSkus, 'clear')}>Clear</Button>
        <Button size="sm" variant="ghost" icon={FaTimes} aria-label={`Remove ${style.name}`}
          onClick={() => onRemove(allSkus.map((s) => String(s._id)))} />
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-content-muted">This style has no colourways yet.</p>
      ) : (
        <div className="table-container">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="text-left">Colour</th>
                {sizes.map((s) => <th key={s.key} className="text-center">{s.label}</th>)}
                <th className="text-right">Row</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ colorway, cells }) => {
                const rowSkus = [...cells.values()];
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
                      const value = counts[String(sku._id)] || '';
                      return (
                        <td key={s.key} className="text-center">
                          {sku.barcode ? (
                            <>
                              <input
                                type="number"
                                min="0"
                                max="2000"
                                inputMode="numeric"
                                className={`form-control !h-8 !w-14 !px-1 !py-0 text-center tabular-nums ${value ? '!border-accent font-semibold' : ''}`}
                                value={value}
                                placeholder="0"
                                onChange={(e) => onSet(String(sku._id), e.target.value)}
                                onFocus={(e) => e.target.select()}
                                aria-label={`Labels for ${colorway.colorId?.name} ${s.label}`}
                              />
                              <span className="block text-[10px] text-content-muted tabular-nums" title="In stock">{sku.quantityOnHand ?? 0}</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-warning" title="This SKU has no barcode">no barcode</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap text-right">
                      <span className="inline-flex gap-1">
                        <button type="button" className="rounded border border-border px-1.5 text-xs hover:bg-surface-hover" onClick={() => fill(rowSkus, 'one')} title="1 each in this colour">1</button>
                        <button type="button" className="rounded border border-border px-1.5 text-xs hover:bg-surface-hover" onClick={() => fill(rowSkus, 'stock')} title="Stock quantity for this colour">stock</button>
                        <button type="button" className="rounded border border-border px-1.5 text-xs hover:bg-surface-hover" onClick={() => fill(rowSkus, 'clear')} title="Clear this colour" aria-label="Clear row">×</button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-content-muted">Small grey number under each box: units in stock.</p>
    </section>
  );
}

/* ------------------------------------------------------------ preview */

/** One label drawn at its real size, so the layout is checked before printing. */
function LabelPreview({ label, size }) {
  return (
    <div
      className="flex flex-col items-center justify-center overflow-hidden bg-white text-center text-black shadow"
      style={{ width: `${size.w}mm`, height: `${size.h}mm`, padding: '2mm 3mm', gap: '0.5mm' }}
    >
      <div className="max-w-full truncate font-bold" style={{ fontSize: '9pt', lineHeight: 1.05 }}>{label.name}</div>
      <div style={{ fontSize: '7pt', color: '#333' }}>{[label.color, label.size].filter(Boolean).join(' · ')}</div>
      <div className="[&_svg]:h-auto [&_svg]:max-w-full"><Barcode value={label.barcode} height={40} fontSize={12} /></div>
      {money(label.price) ? <div className="font-bold" style={{ fontSize: '11pt' }}>{money(label.price)}</div> : null}
    </div>
  );
}
