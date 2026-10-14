import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FaArrowLeft, FaCheck, FaFileExcel, FaPlus, FaSearch, FaSync, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';
import { ORDER_STATUSES } from '../config/orderStatus';
import { PageHeader, Button, Badge, Tabs, StatTile, EmptyState } from '../components/ui/Primitives';
import SkuPicker from './orders/SkuPicker';
import { dt, statusTone } from './orders/orderModel';
import { FIELDS, readOrderSheet, buildRows, columnsReady, columnSamples, columnLetter } from './orders/sheetReader';

const VERDICT = {
  missing: { tone: 'warning', label: 'Missing' },
  possible: { tone: 'info', label: 'Possible match' },
  exists: { tone: 'success', label: 'Already in the app' }
};

const CONFIDENCE = {
  exact: { tone: 'success', label: 'Exact' },
  likely: { tone: 'info', label: 'Likely' },
  unsure: { tone: 'warning', label: 'Choose' },
  none: { tone: 'danger', label: 'Not found' },
  manual: { tone: 'accent', label: 'Chosen' }
};

/** '2026-10-13' or '2026-10-13 20:47', as the preview returns it. */
const formatDay = (value) => {
  const [day, time] = String(value).split(' ');
  const d = new Date(`${day}T12:00:00`).toLocaleDateString('fr-TN');
  return time ? `${d} ${time}` : d;
};

/** Why a sheet order cannot be added yet, or null when it can. */
function blockedReason(g) {
  if (g.verdict === 'exists') return 'Already in the app';
  if (!g.customer.telephone || g.customer.telephone.length !== 8) return 'Needs an 8-digit phone number';
  if (g.lines.some((l) => !l.skuId)) return 'Choose a SKU for every article';
  return null;
}

/**
 * Import the hand-kept order sheet, compare it with the orders already here,
 * and add the ones that are missing.
 *
 * 1. Read the file in the browser and map its columns.
 * 2. The server groups rows into orders (same phone, same day), matches each
 *    Désignation to a SKU, and says whether each order is already here.
 * 3. A person fixes article matches, ticks what to add, and adds it.
 */
export default function OrderImport() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInput = useRef(null);

  const [sheet, setSheet] = useState(null);
  const [reading, setReading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState(null); // { groups, rejected, summary }
  const [selected, setSelected] = useState(() => new Set());
  const [tab, setTab] = useState('missing');
  const [searching, setSearching] = useState(null); // `${key}:${lineKey}` of the line whose SKU is being searched, or `${key}:add`
  const [result, setResult] = useState(null);

  /* ----------------------------------------------------------- step 1 */

  const onFile = async (file) => {
    if (!file) return;
    setReading(true);
    setPreview(null);
    setResult(null);
    try {
      const data = await readOrderSheet(file);
      if (!data.dataRows) throw new Error('The sheet has no rows to import.');
      setSheet({ ...data, fileName: file.name });
    } catch (e) {
      setSheet(null);
      toast.error(e.message || 'Could not read this file');
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  /* ----------------------------------------------------------- step 2 */

  const compare = async () => {
    setComparing(true);
    setResult(null);
    try {
      const rows = buildRows(sheet.grid, sheet.headerIndex, sheet.columns);
      const { data } = await api.post('/orders/import/preview', { fileName: sheet.fileName, rows });
      const p = data.data;
      setPreview(p);
      // Ready-to-add missing orders start ticked; anything that needs a look does not.
      setSelected(new Set(p.groups.filter((g) => g.verdict === 'missing' && !blockedReason(g)).map((g) => g.key)));
      setTab(p.summary.missing ? 'missing' : p.summary.possible ? 'possible' : 'exists');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not compare the sheet');
    } finally {
      setComparing(false);
    }
  };

  /* ---------------------------------------------------------- editing */

  const patchGroup = (key, fn) =>
    setPreview((p) => ({ ...p, groups: p.groups.map((g) => (g.key === key ? fn(g) : g)) }));

  const patchLine = (key, lineKey, patch) =>
    patchGroup(key, (g) => ({ ...g, lines: g.lines.map((l) => (l.lineKey === lineKey ? { ...l, ...patch } : l)) }));

  const chooseSku = (key, lineKey, sku) => {
    patchLine(key, lineKey, {
      skuId: sku.skuId,
      skuLabel: sku.label,
      skuCode: sku.code,
      catalogPrice: sku.price ?? null,
      confidence: 'manual',
      // The preview's stock figure was for the old choice; it is rechecked when added.
      short: undefined,
      available: undefined
    });
    setSearching(null);
  };

  /** For a cell the split did not catch: one more article on this order. */
  const addLine = (key, line) => {
    patchGroup(key, (g) => ({
      ...g,
      lines: [
        ...g.lines,
        {
          lineKey: `added-${Date.now()}`,
          rowNumber: g.rowNumbers[0],
          designation: '(added by hand)',
          quantity: 1,
          unitPrice: line.catalogPrice ?? null,
          skuId: line.skuId,
          skuLabel: [line.styleName, line.colorName, line.sizeLabel].filter(Boolean).join(' · '),
          skuCode: line.code,
          catalogPrice: line.catalogPrice ?? null,
          confidence: 'manual',
          candidates: []
        }
      ]
    }));
    setSearching(null);
  };

  const removeLine = (key, lineKey) =>
    patchGroup(key, (g) => ({ ...g, lines: g.lines.filter((l) => l.lineKey !== lineKey) }));

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  /* ----------------------------------------------------------- step 3 */

  const chosen = useMemo(
    () => (preview?.groups || []).filter((g) => selected.has(g.key) && !blockedReason(g)),
    [preview, selected]
  );

  const commit = async () => {
    if (!chosen.length) return;
    setCommitting(true);
    try {
      const { data } = await api.post('/orders/import/commit', {
        fileName: sheet.fileName,
        orders: chosen.map((g) => ({
          key: g.key,
          date: g.date,
          rowNumbers: g.rowNumbers,
          customer: g.customer,
          status: g.status,
          source: g.source,
          shipping: g.shipping,
          notes: g.notes,
          lines: g.lines.map((l) => ({ skuId: l.skuId, quantity: l.quantity, unitPrice: l.unitPrice }))
        }))
      });
      setResult(data.data);
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orderStats'] });
      qc.invalidateQueries({ queryKey: ['skuCatalog'] });
      const { created, failed } = data.data;
      if (created.length) toast.success(`${created.length} order(s) added`);
      if (failed.length) toast.error(`${failed.length} order(s) could not be added — see below`);
      // Added orders are no longer selectable; a fresh comparison shows them as existing.
      setSelected(new Set());
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not add the orders');
    } finally {
      setCommitting(false);
    }
  };

  /* ----------------------------------------------------------- render */

  const groups = preview?.groups || [];
  const shown = tab === 'rejected' ? [] : groups.filter((g) => g.verdict === tab);
  const s = preview?.summary;

  return (
    <div className="pb-24">
      <PageHeader
        title="Import orders from a sheet"
        description="Compare your order sheet with the orders already here, and add the ones that are missing."
      >
        <Button icon={FaArrowLeft} onClick={() => navigate('/orders')}>Orders</Button>
      </PageHeader>

      {/* ------------------------------------------------------- file */}
      <section className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant={sheet ? 'secondary' : 'primary'} icon={FaFileExcel} disabled={reading}
            onClick={() => fileInput.current?.click()}>
            {reading ? 'Reading…' : sheet ? 'Choose another file' : 'Choose a sheet (.xlsx or .csv)'}
          </Button>
          {sheet ? (
            <span className="text-sm text-content-secondary">
              <strong className="text-content">{sheet.fileName}</strong> · {sheet.dataRows} row(s) ·{' '}
              {sheet.inferred ? 'no header row — columns recognised from their content' : `header on row ${sheet.headerIndex + 1}`}
            </span>
          ) : (
            <span className="text-sm text-content-secondary">
              One row per article — date, customer, phone, governorate, address, article (« SET FOLA - Noir / L »), total…
              With or without a header row.
            </span>
          )}
        </div>

        {sheet ? (
          <>
            <ColumnEditor
              sheet={sheet}
              onChange={(field, idx) => {
                setSheet((s) => {
                  const columns = { ...s.columns };
                  // A column holds one field: taking it here frees it elsewhere.
                  for (const [k, v] of Object.entries(columns)) if (v === idx) delete columns[k];
                  if (idx == null) delete columns[field];
                  else columns[field] = idx;
                  return { ...s, columns };
                });
                setPreview(null);
              }}
            />
            <p className="mt-2 text-xs text-content-muted">
              Check each column against its sample and change any that is wrong. The total is taken to include delivery.
              Rows with the same phone and the same time become one order; a sheet without times groups by day.
              An empty status means « En Attente ».
            </p>
            <div className="mt-3">
              <Button variant="primary" icon={comparing ? FaSync : FaSearch}
                disabled={comparing || !columnsReady(sheet.columns)} onClick={compare}
                title={!columnsReady(sheet.columns) ? 'Choose the date, article, and phone or name columns first' : undefined}>
                {comparing ? 'Comparing…' : preview ? 'Compare again' : 'Compare with orders'}
              </Button>
            </div>
          </>
        ) : null}
      </section>

      {/* ---------------------------------------------------- results */}
      {result ? (
        <section className="card mb-4" aria-live="polite">
          <h3 className="mb-2 text-base font-medium">Import result</h3>
          <p className="text-sm">
            <strong>{result.created.length}</strong> added
            {result.skipped.length ? <> · {result.skipped.length} skipped (already imported from this file)</> : null}
            {result.failed.length ? <> · <span className="text-danger">{result.failed.length} failed</span></> : null}
          </p>
          {result.created.length ? (
            <p className="mt-1 font-mono text-xs text-content-secondary">
              {result.created.map((c) => c.orderNumber).join(', ')}
            </p>
          ) : null}
          {result.failed.length ? (
            <ul className="mt-2 space-y-0.5 text-sm text-danger">
              {result.failed.map((f) => {
                const g = groups.find((x) => x.key === f.key);
                return <li key={f.key}>{g ? `${g.customer.nom} (${formatDay(g.date)})` : f.key}: {f.message}</li>;
              })}
            </ul>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button onClick={() => navigate('/orders')}>Go to orders</Button>
            <Button icon={FaSync} onClick={compare} disabled={comparing}>Compare again</Button>
          </div>
        </section>
      ) : null}

      {preview ? (
        <>
          <div className="stats-grid">
            <StatTile label="Missing" value={s.missing} hint="In the sheet, not in the app" tone={s.missing ? 'warning' : 'default'} />
            <StatTile label="Possible match" value={s.possible} hint="Same phone and day, different articles" />
            <StatTile label="Already in the app" value={s.exists} hint={`${s.orders} order(s) from ${s.rows} row(s)`} />
            <StatTile label="Rows skipped" value={s.rejectedRows} hint="Unreadable date or no article" tone={s.rejectedRows ? 'warning' : 'default'} />
          </div>

          <section className="card">
            <Tabs
              className="mb-4"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'missing', label: 'Missing', count: s.missing },
                { value: 'possible', label: 'Possible match', count: s.possible },
                { value: 'exists', label: 'Already in the app', count: s.exists },
                { value: 'rejected', label: 'Rows skipped', count: s.rejectedRows }
              ]}
            />

            {tab === 'rejected' ? (
              preview.rejected.length ? (
                <ul className="space-y-1 text-sm">
                  {preview.rejected.map((r) => (
                    <li key={r.rowNumber}><span className="font-mono">Row {r.rowNumber}</span> — {r.reason}</li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={FaCheck} title="Every row was read" />
              )
            ) : shown.length === 0 ? (
              <EmptyState icon={FaCheck} title="Nothing here" description={tab === 'missing' ? 'Every order in the sheet is already in the app.' : undefined} />
            ) : (
              <div className="space-y-3">
                {tab !== 'exists' ? (
                  <div className="flex flex-wrap gap-3 text-sm">
                    <button type="button" className="underline underline-offset-2"
                      onClick={() => setSelected((prev) => new Set([...prev, ...shown.filter((g) => !blockedReason(g)).map((g) => g.key)]))}>
                      Select all ready
                    </button>
                    <button type="button" className="underline underline-offset-2"
                      onClick={() => setSelected((prev) => new Set([...prev].filter((k) => !shown.some((g) => g.key === k))))}>
                      Clear
                    </button>
                  </div>
                ) : null}

                {shown.map((g) => (
                  <SheetOrder
                    key={g.key}
                    group={g}
                    selected={selected.has(g.key)}
                    onToggle={() => toggle(g.key)}
                    onStatus={(status) => patchGroup(g.key, (x) => ({ ...x, status }))}
                    searching={searching}
                    setSearching={setSearching}
                    onChooseSku={chooseSku}
                    onPatchLine={patchLine}
                    onAddLine={addLine}
                    onRemoveLine={removeLine}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ------------------------------------------- action bar */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg">
            <div className="mx-auto flex max-w-[var(--content-max)] flex-wrap items-center justify-end gap-3">
              <span className="text-sm text-content-secondary">
                {chosen.length} order(s) selected
                {chosen.some((g) => g.lines.some((l) => l.short)) ? ' · some are short on stock and will be marked so' : ''}
              </span>
              <Button variant="primary" icon={FaPlus} disabled={!chosen.length || committing} onClick={commit}>
                {committing ? 'Adding…' : `Add ${chosen.length} order(s)`}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** One order from the sheet: its rows, the article matches, and how it compares. */
function SheetOrder({ group: g, selected, onToggle, onStatus, searching, setSearching, onChooseSku, onPatchLine, onAddLine, onRemoveLine }) {
  const blocked = blockedReason(g);
  const editable = g.verdict !== 'exists';
  const verdict = VERDICT[g.verdict];
  const subtotal = g.lines.reduce((sum, l) => sum + (l.unitPrice ?? l.catalogPrice ?? 0) * l.quantity, 0);

  return (
    <article className={`rounded-lg border p-3 ${selected ? 'border-accent-border bg-accent-subtle' : 'border-border'}`}>
      <header className="flex flex-wrap items-start gap-3">
        {g.verdict !== 'exists' ? (
          <input
            type="checkbox"
            className="mt-1"
            checked={selected && !blocked}
            disabled={Boolean(blocked)}
            onChange={onToggle}
            aria-label={`Add the order of ${g.customer.nom} on ${formatDay(g.date)}`}
            title={blocked || undefined}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{g.customer.nom}</strong>
            <span className="font-mono text-sm">{g.customer.telephone || '—'}</span>
            <span className="text-sm text-content-secondary">{formatDay(g.date)}</span>
            <Badge tone={verdict.tone}>{verdict.label}</Badge>
          </div>
          <div className="text-xs text-content-muted">
            Sheet row(s) {g.rowNumbers.join(', ')}
            {g.customer.gouvernerat ? ` · ${g.customer.gouvernerat}` : ''}
            {g.source ? ` · ${g.source}` : ''}
            {g.notes ? ` · ${g.notes}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {g.verdict === 'exists' ? (
            <Badge tone={statusTone(g.status)}>{g.status}</Badge>
          ) : (
            <select
              className="form-control !h-8 !py-0 text-sm"
              value={g.status}
              onChange={(e) => onStatus(e.target.value)}
              aria-label="Status for this order"
              title={g.statusRaw ? `From the sheet: ${g.statusRaw}` : undefined}
            >
              {ORDER_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          )}
        </div>
      </header>

      {g.verdict === 'exists' && g.matchedOrder ? (
        <p className="mt-2 text-sm text-content-secondary">
          Matches <span className="font-mono">{g.matchedOrder.orderNumber}</span> ({g.matchedOrder.status}, {dt(g.matchedOrder.total)}).
        </p>
      ) : null}
      {g.verdict === 'possible' ? (
        <div className="mt-2 rounded border border-info-border bg-info-bg px-3 py-2 text-sm">
          Same phone and day as{' '}
          {g.possibleMatches.map((m, i) => (
            <span key={m._id}>
              {i ? ', ' : ''}
              <span className="font-mono">{m.orderNumber}</span> ({m.articles.join(', ') || 'no articles'})
            </span>
          ))}
          . Add it only if it is a separate order.
        </div>
      ) : null}

      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-xs text-content-muted">
          <tr>
            <th className="py-1 pr-2 font-medium">In the sheet</th>
            <th className="py-1 pr-2 font-medium">SKU</th>
            <th className="py-1 pr-2 text-right font-medium">Qty</th>
            <th className="py-1 pr-2 text-right font-medium">Price</th>
            <th className="py-1 pr-2 font-medium">Stock</th>
            {editable ? <th className="py-1" aria-label="Remove" /> : null}
          </tr>
        </thead>
        <tbody>
          {g.lines.map((l, i) => {
            const id = `${g.key}:${l.lineKey}`;
            const conf = CONFIDENCE[l.confidence] || CONFIDENCE.none;
            // A split cell shows its original text once, on its first line.
            const firstOfSplit = l.splitFrom && g.lines.findIndex((x) => x.splitFrom === l.splitFrom && x.rowNumber === l.rowNumber) === i;
            return (
              <tr key={l.lineKey} className="border-t border-border align-top">
                <td className="py-1.5 pr-2">
                  {l.splitFrom ? (
                    <>
                      <span>{l.designation}</span>
                      {firstOfSplit ? (
                        <span className="block text-xs text-content-muted">Split from « {l.splitFrom} »</span>
                      ) : null}
                    </>
                  ) : (
                    l.designation
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  {!editable ? (
                    <span>{l.skuLabel || '—'}</span>
                  ) : searching === id ? (
                    <div className="min-w-[260px]">
                      <SkuPicker
                        onAdd={(line) =>
                          onChooseSku(g.key, l.lineKey, {
                            skuId: line.skuId,
                            label: [line.styleName, line.colorName, line.sizeLabel].filter(Boolean).join(' · '),
                            code: line.code,
                            price: line.catalogPrice
                          })
                        }
                      />
                      <button type="button" className="mt-1 text-xs underline" onClick={() => setSearching(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={conf.tone}>{conf.label}</Badge>
                      <select
                        className="form-control !h-8 !py-0 text-sm"
                        value={l.skuId || ''}
                        onChange={(e) => {
                          if (e.target.value === '__search') return setSearching(id);
                          const c = l.candidates.find((x) => x.skuId === e.target.value);
                          if (c) onChooseSku(g.key, l.lineKey, c);
                        }}
                        aria-label={`SKU for « ${l.designation} »`}
                      >
                        <option value="" disabled>Choose a SKU…</option>
                        {l.skuId && !l.candidates.some((c) => c.skuId === l.skuId) ? (
                          <option value={l.skuId}>{l.skuLabel}</option>
                        ) : null}
                        {l.candidates.map((c) => (
                          <option key={c.skuId} value={c.skuId}>{c.label} — {c.code}</option>
                        ))}
                        <option value="__search">Search the catalogue…</option>
                      </select>
                    </div>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {editable ? (
                    <input
                      type="number"
                      min="1"
                      className="form-control !h-8 !w-16 !py-0 text-right text-sm"
                      value={l.quantity}
                      onChange={(e) => onPatchLine(g.key, l.lineKey, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      aria-label="Quantity"
                    />
                  ) : (
                    <span className="tabular-nums">{l.quantity}</span>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {editable ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control !h-8 !w-24 !py-0 text-right text-sm"
                      value={l.unitPrice ?? ''}
                      placeholder={l.catalogPrice != null ? String(l.catalogPrice) : ''}
                      title={l.unitPrice == null ? 'Empty: the catalogue price is used' : 'Unit price'}
                      onChange={(e) => onPatchLine(g.key, l.lineKey, { unitPrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) })}
                      aria-label="Unit price"
                    />
                  ) : (
                    <span className="tabular-nums">{dt(l.unitPrice ?? l.catalogPrice)}</span>
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  {!g.reserving || g.verdict === 'exists' ? (
                    <span className="text-xs text-content-muted">—</span>
                  ) : l.short === true ? (
                    <Badge tone="danger">Short · {l.available} left</Badge>
                  ) : l.short === false ? (
                    <Badge tone="success">OK</Badge>
                  ) : (
                    <span className="text-xs text-content-muted">checked on add</span>
                  )}
                </td>
                {editable ? (
                  <td className="py-1.5 text-right">
                    {g.lines.length > 1 ? (
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove « ${l.designation} »`}
                        onClick={() => onRemoveLine(g.key, l.lineKey)}>
                        <FaTimes />
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      {editable ? (
        searching === `${g.key}:add` ? (
          <div className="mt-2 max-w-md">
            <SkuPicker onAdd={(line) => onAddLine(g.key, line)} />
            <button type="button" className="mt-1 text-xs underline" onClick={() => setSearching(null)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-2"
            onClick={() => setSearching(`${g.key}:add`)}>
            <FaPlus size={11} aria-hidden="true" /> Add an article
          </button>
        )
      ) : null}

      <footer className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-danger">{blocked && g.verdict !== 'exists' ? blocked : g.problems.filter((p) => !/need a SKU/.test(p)).join(' · ')}</span>
        <span className="tabular-nums text-content-secondary">
          {dt(subtotal)} + delivery {g.shipping != null ? dt(g.shipping) : '(default)'}
        </span>
      </footer>
    </article>
  );
}

/** Which sheet column holds each field, with a sample of what it contains, editable. */
function ColumnEditor({ sheet, onChange }) {
  const width = Math.max(0, ...sheet.grid.slice(0, 200).map((r) => r?.length || 0));
  const headerRow = sheet.headerIndex >= 0 ? sheet.grid[sheet.headerIndex] : null;

  // Columns that hold anything at all, so sixty empty trailing columns are not offered.
  const options = Array.from({ length: width }, (_, i) => i)
    .map((i) => ({ i, samples: columnSamples(sheet.grid, sheet.headerIndex, i, 1) }))
    .filter((c) => c.samples.length);

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {FIELDS.map((f) => {
        const idx = sheet.columns[f.key];
        const samples = idx != null ? columnSamples(sheet.grid, sheet.headerIndex, idx, 2) : [];
        const missing = f.required && idx == null;
        return (
          <label key={f.key} className={`rounded-lg border px-3 py-2 text-sm ${missing ? 'border-danger-border bg-danger-bg' : 'border-border'}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {f.label}
                {f.required ? <span className="text-danger"> *</span> : null}
              </span>
              <select
                className="form-control !h-7 !w-auto !py-0 text-xs"
                value={idx ?? ''}
                onChange={(e) => onChange(f.key, e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">— none —</option>
                {options.map((c) => (
                  <option key={c.i} value={c.i}>
                    {columnLetter(c.i)}{headerRow?.[c.i] ? ` · ${String(headerRow[c.i]).slice(0, 18)}` : ''} — {c.samples[0].slice(0, 22)}
                  </option>
                ))}
              </select>
            </span>
            <span className="mt-1 block truncate text-xs text-content-muted" dir="auto">
              {samples.length ? samples.join('  ·  ') : idx == null ? 'Not in this sheet' : 'Empty so far'}
            </span>
          </label>
        );
      })}
    </div>
  );
}
