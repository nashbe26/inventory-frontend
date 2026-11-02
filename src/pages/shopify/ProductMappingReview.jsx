import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FaCheck, FaExchangeAlt, FaSyncAlt, FaTimes, FaUndo } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { Badge, Button, EmptyState, SearchInput, Tabs, Toolbar } from '../../components/ui/Primitives';
import SkuPicker from '../orders/SkuPicker';

const QUERY_KEY = ['shopify-product-mapping'];
const PAGE_SIZE = 25;

const HOW_MATCHED = {
  link: { tone: 'success', label: 'Validated' },
  code: { tone: 'info', label: 'Same barcode or SKU code' },
  name: { tone: 'info', label: 'Same name, colour and size' },
  similar_name: { tone: 'warning', label: 'Similar name: check it' }
};

const skuFromLine = (line) => ({
  skuId: line.skuId,
  code: line.code,
  styleName: line.styleName,
  colorName: line.colorName,
  sizeLabel: line.sizeLabel
});

const skuLabel = (sku) => [sku.styleName, sku.colorName, sku.sizeLabel].filter(Boolean).join(' · ');

/**
 * Review Shopify products against the catalog. Each variant gets a proposed SKU;
 * nothing is saved until a person validates the product. Until then, its orders
 * land on the "Unmapped items" placeholder.
 */
export default function ProductMappingReview({ hasAccessToken }) {
  const queryClient = useQueryClient();
  /** variantId -> the SKU chosen here, or null for "no SKU". Overrides the proposal. */
  const [drafts, setDrafts] = useState({});
  const [cancelled, setCancelled] = useState(() => new Set());
  const [pickingVariantId, setPickingVariantId] = useState(null);
  const [savingProductId, setSavingProductId] = useState(null);
  const [tab, setTab] = useState('review');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);

  const { data: products, isFetching, refetch, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await api.get('/webhooks/shopify/product-mapping')).data.data,
    enabled: false,
    retry: false
  });

  const hasDraft = (row) => Object.prototype.hasOwnProperty.call(drafts, row.variantId);
  const currentSku = (row) => (hasDraft(row) ? drafts[row.variantId] : row.proposal);

  const statusOf = (product) => {
    if (cancelled.has(product.productId)) return 'cancelled';
    return product.variants.every((row) => row.via === 'link' && !hasDraft(row)) ? 'validated' : 'review';
  };

  /** What validating this product would write. Rows already saved as shown are left out. */
  const pendingLinks = (product) =>
    product.variants.flatMap((row) => {
      const sku = currentSku(row);
      if (sku) {
        return row.via === 'link' && sku.skuId === row.proposal?.skuId ? [] : [{ variantId: row.variantId, skuId: sku.skuId }];
      }
      return row.via === 'link' ? [{ variantId: row.variantId, skuId: null }] : [];
    });

  const counts = useMemo(() => {
    const c = { review: 0, validated: 0, cancelled: 0 };
    (products || []).forEach((p) => { c[statusOf(p)]++; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, drafts, cancelled]);

  const visible = (products || []).filter((p) => {
    if (statusOf(p) !== tab) return false;
    const q = search.trim().toLowerCase();
    return !q || p.title.toLowerCase().includes(q);
  });

  const setDraft = (variantId, sku) => {
    setDrafts((prev) => ({ ...prev, [variantId]: sku }));
    setPickingVariantId(null);
  };

  const discardDrafts = (product) => {
    setDrafts((prev) => {
      const next = { ...prev };
      product.variants.forEach((row) => { delete next[row.variantId]; });
      return next;
    });
    setPickingVariantId(null);
  };

  const load = async () => {
    setDrafts({});
    setCancelled(new Set());
    setPickingVariantId(null);
    setShown(PAGE_SIZE);
    await refetch();
  };

  const validate = async (product) => {
    const links = pendingLinks(product);
    setSavingProductId(product.productId);
    try {
      await api.post('/webhooks/shopify/product-mapping', { links });
      const saved = new Map(links.map((l) => [l.variantId, l.skuId]));
      queryClient.setQueryData(QUERY_KEY, (prev) =>
        prev.map((p) =>
          p.productId !== product.productId
            ? p
            : {
                ...p,
                variants: p.variants.map((row) => {
                  if (!saved.has(row.variantId)) return row;
                  return saved.get(row.variantId)
                    ? { ...row, proposal: currentSku(row), via: 'link', reason: null }
                    : { ...row, proposal: null, via: null, reason: 'Mapping removed' };
                })
              }
        )
      );
      discardDrafts(product);
      toast.success(`${product.title}: mapping saved`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not save this mapping');
    } finally {
      setSavingProductId(null);
    }
  };

  const cancel = (product) => {
    discardDrafts(product);
    setCancelled((prev) => new Set(prev).add(product.productId));
  };

  const reviewAgain = (product) => {
    setCancelled((prev) => {
      const next = new Set(prev);
      next.delete(product.productId);
      return next;
    });
  };

  const renderRow = (product, row) => {
    const sku = currentSku(row);
    const how = hasDraft(row) ? { tone: 'accent', label: 'Your choice' } : HOW_MATCHED[row.via];
    const isCancelled = statusOf(product) === 'cancelled';

    return (
      <div key={row.variantId} className="border-t border-border py-2.5">
        <div className="grid items-center gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-content">{row.title || 'One variant only'}</p>
            {row.shopifySku ? <p className="truncate font-mono text-xs text-content-muted">{row.shopifySku}</p> : null}
          </div>

          <div className="min-w-0">
            {sku ? (
              <>
                <p className="text-sm text-content">{skuLabel(sku)}</p>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-content-muted">{sku.code}</span>
                  {how ? <Badge tone={how.tone}>{how.label}</Badge> : null}
                </p>
              </>
            ) : (
              <>
                <Badge tone="danger">No variation selected</Badge>
                {row.reason && !hasDraft(row) ? <p className="mt-1 text-xs text-content-secondary">{row.reason}</p> : null}
              </>
            )}
          </div>

          {isCancelled ? null : (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                icon={FaExchangeAlt}
                onClick={() => setPickingVariantId(pickingVariantId === row.variantId ? null : row.variantId)}
              >
                {pickingVariantId === row.variantId ? 'Close' : 'Change'}
              </Button>
              {sku ? (
                <Button size="sm" variant="ghost" icon={FaTimes} aria-label="Clear this variation" title="Clear this variation"
                  onClick={() => setDraft(row.variantId, null)} />
              ) : null}
            </div>
          )}
        </div>

        {pickingVariantId === row.variantId ? (
          <div className="mt-2">
            <SkuPicker onAdd={(line) => setDraft(row.variantId, skuFromLine(line))} />
          </div>
        ) : null}
      </div>
    );
  };

  const renderProduct = (product) => {
    const status = statusOf(product);
    const links = pendingLinks(product);
    const chosen = product.variants.filter((row) => currentSku(row)).length;
    const total = product.variants.length;
    const edited = product.variants.some(hasDraft);

    return (
      <div key={product.productId} className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-content">{product.title}</p>
            <p className="text-xs text-content-muted">{chosen} of {total} variants have a variation</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status === 'cancelled' ? (
              <Button size="sm" icon={FaUndo} onClick={() => reviewAgain(product)}>Review again</Button>
            ) : (
              <>
                {status === 'review' ? (
                  <Button size="sm" icon={FaTimes} disabled={savingProductId === product.productId} onClick={() => cancel(product)}>
                    Cancel
                  </Button>
                ) : edited ? (
                  <Button size="sm" icon={FaUndo} onClick={() => discardDrafts(product)}>Discard changes</Button>
                ) : null}
                <Button
                  size="sm"
                  variant="primary"
                  icon={FaCheck}
                  disabled={links.length === 0 || savingProductId === product.productId}
                  onClick={() => validate(product)}
                >
                  {savingProductId === product.productId ? 'Saving…' : chosen < total ? `Validate ${chosen} of ${total}` : 'Validate'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="hidden gap-x-4 pb-1 text-xs font-medium text-content-muted md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
          <span>In Shopify</span>
          <span>In your catalog</span>
        </div>
        {product.variants.map((row) => renderRow(product, row))}
      </div>
    );
  };

  const EMPTY = {
    review: 'Nothing left to review.',
    validated: 'No products validated yet.',
    cancelled: 'No products cancelled.'
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">Map Shopify products to your catalog</h3>
          <p className="text-sm text-gray-500 mt-1">
            Each Shopify variant is matched to a saved variation by name, colour and size. Check each product, then
            validate it, change a variation, or cancel. Nothing is saved until you validate, and your names, prices
            and stock never change.
          </p>
        </div>
        <Button variant="primary" icon={FaSyncAlt} disabled={isFetching || !hasAccessToken} onClick={load}>
          {isFetching ? 'Loading products…' : products ? 'Reload from Shopify' : 'Load products from Shopify'}
        </Button>
      </div>

      {!hasAccessToken ? (
        <p className="text-xs text-orange-600">Save your Shopify Admin API token above first.</p>
      ) : null}

      {error ? (
        <p className="text-sm text-danger">{error.response?.data?.message || 'Could not load products from Shopify.'}</p>
      ) : null}

      {products ? (
        <>
          <Toolbar>
            <Tabs
              value={tab}
              onChange={(v) => { setTab(v); setShown(PAGE_SIZE); }}
              options={[
                { value: 'review', label: 'To review', count: counts.review },
                { value: 'validated', label: 'Validated', count: counts.validated },
                { value: 'cancelled', label: 'Cancelled', count: counts.cancelled }
              ]}
            />
            <SearchInput value={search} onChange={(v) => { setSearch(v); setShown(PAGE_SIZE); }} placeholder="Search Shopify products…" />
          </Toolbar>

          {counts.validated > 0 ? (
            <p className="text-xs text-content-secondary">
              New orders use a validated mapping straight away. Click <strong>Sync data</strong> above to move existing unpicked orders onto it.
            </p>
          ) : null}

          {visible.length === 0 ? (
            <EmptyState title={search ? 'No product matches this search.' : EMPTY[tab]} />
          ) : (
            <div className="space-y-3">
              {visible.slice(0, shown).map(renderProduct)}
              {visible.length > shown ? (
                <Button onClick={() => setShown((n) => n + PAGE_SIZE)}>
                  Show more ({visible.length - shown} left)
                </Button>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
