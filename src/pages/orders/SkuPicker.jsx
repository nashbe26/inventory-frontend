import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { stockService } from '../../services';
import { Badge } from '../../components/ui/Primitives';
import { dt, lineFromCatalogSku, lineFromLookupSku } from './orderModel';

/** Wait until typing pauses before asking the server. */
function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Find a SKU and add it to the order.
 *
 * Type to search style, colour, size, SKU code or barcode; click a row to add
 * one unit. Enter adds straight away when the text is an exact code or barcode,
 * so a handheld scanner (which types the code and presses Enter) works here
 * without touching the mouse.
 */
export default function SkuPicker({ onAdd, disabled }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const q = useDebounced(text.trim());

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['skuCatalog', 'search', q],
    queryFn: async () => (await stockService.catalog({ search: q, limit: 30, status: 'active' })).data.data,
    enabled: q.length >= 2,
    staleTime: 30 * 1000
  });

  const add = (line) => {
    onAdd(line);
    setText('');
    inputRef.current?.focus();
  };

  const onEnter = async () => {
    const raw = text.trim();
    if (!raw) return;
    const exact = results.find(
      (s) => s.code?.toUpperCase() === raw.toUpperCase() || (s.barcode && s.barcode === raw)
    );
    if (exact) return add(lineFromCatalogSku(exact));
    if (results.length === 1 && q === raw) return add(lineFromCatalogSku(results[0]));

    // Not in the current results (scanned before the search came back): ask directly.
    setBusy(true);
    try {
      const sku = (await stockService.lookup(raw)).data.data;
      add(lineFromLookupSku(sku));
    } catch {
      toast.error(`No SKU matches « ${raw} »`);
    } finally {
      setBusy(false);
    }
  };

  const showList = q.length >= 2 && text.trim().length >= 2;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className="form-control"
        placeholder="Search style, colour, size, SKU — or scan a barcode"
        value={text}
        disabled={disabled || busy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter();
          }
          if (e.key === 'Escape') setText('');
        }}
        autoComplete="off"
        spellCheck={false}
      />

      {showList && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {isFetching && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-content-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-content-muted">No SKU matches.</p>
          ) : (
            results.map((sku) => {
              // Available to promise, not shelf stock: other open orders hold some of it.
              const qty = Number(sku.available ?? sku.quantityOnHand) || 0;
              return (
                <button
                  key={sku._id}
                  type="button"
                  onClick={() => add(lineFromCatalogSku(sku))}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-surface-hover"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-content">{sku.styleName}</span>
                    <span className="block truncate text-sm text-content-secondary">
                      {sku.colorHex ? (
                        <span
                          className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border border-border align-middle"
                          style={{ background: sku.colorHex }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {[sku.colorName, sku.sizeLabel].filter(Boolean).join(' · ')}
                      <span className="ml-2 font-mono text-xs text-content-muted">{sku.code}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular-nums">{dt(sku.price)}</span>
                    <Badge tone={qty === 0 ? 'danger' : qty <= 3 ? 'warning' : 'success'}>
                      {qty} available
                    </Badge>
                    {sku.reserved ? (
                      <span className="block text-xs text-content-muted tabular-nums">
                        {sku.quantityOnHand} on hand · {sku.reserved} held
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
