import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockService, styleService } from '../services';
import { FaBarcode, FaBoxOpen, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { PageHeader, Button, Card, EmptyState, Select } from '../components/ui/Primitives';

/**
 * Stock going out — point-of-sale style.
 *
 * Each scan immediately removes ONE unit, no draft and no confirm: scan, it's
 * out, scan the next. The server applies a guarded SALE per scan and refuses
 * (409) rather than going below zero, so you cannot scan out more than you hold.
 * A running log shows each deduction and the new balance; the input stays
 * focused for continuous scanning.
 */
export default function StockOut() {
  const queryClient = useQueryClient();
  const scanRef = useRef(null);

  const [scan, setScan] = useState('');
  const [reason, setReason] = useState('');
  const [log, setLog] = useState([]); // { ok, text, detail, at }
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

  const scanOut = useMutation({
    mutationFn: (identifier) => stockService.scanOut({ identifier, reason: reason || undefined }),
    onSuccess: (res) => {
      const d = res.data.data;
      setLog((prev) => [
        { ok: true, text: `−1  ${d.styleName}`, detail: `${[d.color, d.size].filter(Boolean).join(' · ')} · ${d.code} → ${d.quantityOnHand} left`, at: Date.now() },
        ...prev
      ].slice(0, 100));
      setScan('');
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['styles'] });
      scanRef.current?.focus();
    },
    onError: (e, identifier) => {
      const d = e.response?.data;
      const msg = d?.available != null
        ? `${d.message}`
        : d?.message || 'Could not take this out';
      setLog((prev) => [
        { ok: false, text: `✗  ${identifier}`, detail: msg, at: Date.now() },
        ...prev
      ].slice(0, 100));
      setScan('');
      scanRef.current?.focus();
    }
  });

  const onScanSubmit = (e) => {
    e.preventDefault();
    const code = scan.trim();
    if (code && !scanOut.isPending) scanOut.mutate(code);
  };

  const unitsOut = log.filter((l) => l.ok).length;

  return (
    <div>
      <PageHeader
        title="Stock out"
        description="Scan an item and it's out — one unit per scan, no confirmation. A sale, a dispatch, a write-off. Each scan is applied immediately."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div>
          <Card title="Scan to remove one">
            <form onSubmit={onScanSubmit}>
              <div className="flex gap-2">
                <div className="search-box flex-1">
                  <FaBarcode className="search-icon" />
                  <input
                    ref={scanRef}
                    className="form-control"
                    placeholder="Scan a barcode — each scan removes one unit…"
                    value={scan}
                    onChange={(e) => setScan(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <Button variant="primary" type="submit" disabled={!scan.trim() || scanOut.isPending}>
                  Remove 1
                </Button>
              </div>
            </form>
            <input
              className="form-control mt-2"
              placeholder="Reason (optional) — e.g. Counter sale, Damaged"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="mt-2 text-sm text-content-muted">
              Applied the instant you scan. The server refuses to go below zero.
            </p>

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium text-content-secondary">No barcode? Pick by style — each tap removes one</p>
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
                        <span className="h-3 w-3 rounded border border-border-strong" style={{ background: cw.colorId?.hexCode || '#ccc' }} />
                        {cw.colorId?.name}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(cw.skus || []).map((sku) => (
                          <button
                            key={sku._id}
                            type="button"
                            disabled={scanOut.isPending}
                            onClick={() => scanOut.mutate(sku.barcode || sku.code)}
                            title={`On hand ${sku.quantityOnHand ?? 0}`}
                            className="rounded-md border border-border bg-surface px-2.5 py-1 text-sm transition hover:border-border-strong hover:bg-surface-hover disabled:opacity-50"
                          >
                            {sku.sizeId?.label} <span className="text-content-muted">({sku.quantityOnHand ?? 0})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6">
          <Card title={`This session${unitsOut ? ` — ${unitsOut} out` : ''}`} padded={false}>
            {log.length === 0 ? (
              <EmptyState
                icon={FaBoxOpen}
                title="Nothing scanned yet"
                description="Each scan removes one unit and appears here, newest first."
              />
            ) : (
              <ul className="divide-y divide-border">
                {log.map((l) => (
                  <li key={l.at} className="flex items-start gap-2.5 px-3 py-2">
                    {l.ok ? (
                      <FaCheckCircle className="mt-0.5 flex-shrink-0 text-success" />
                    ) : (
                      <FaExclamationTriangle className="mt-0.5 flex-shrink-0 text-danger" />
                    )}
                    <div className="min-w-0">
                      <div className={`text-base font-medium ${l.ok ? '' : 'text-danger'}`}>{l.text}</div>
                      <div className="truncate text-sm text-content-muted">{l.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {log.length > 0 ? (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setLog([])}>
              Clear log
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
