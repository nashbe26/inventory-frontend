import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { styleService, colorService, stockService } from '../services';
import { FaArrowLeft, FaPlus, FaPen, FaBoxOpen, FaHistory } from 'react-icons/fa';
import {
  PageHeader,
  Button,
  Card,
  Badge,
  EmptyState,
  Skeleton
} from '../components/ui/Primitives';
import Modal from '../components/Modal';

const dt = (n) =>
  n == null
    ? '—'
    : `${Number(n).toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;

/**
 * One cell of the colourway x size grid.
 *
 * The number is the whole point of the screen, so it carries the weight;
 * the size label sits above it in small type. Colour appears only at zero
 * and below the reorder point, so scanning the grid for gaps is instant.
 */
function SkuCell({ sku, onClick, lowThreshold = 3 }) {
  const qty = sku.quantityOnHand ?? 0;
  const threshold = sku.reorderPoint ?? lowThreshold;
  const low = qty > 0 && qty <= threshold;

  /* The point of this grid is spotting broken size runs across many
     colourways at a glance, so an empty size has to be unmistakable. The
     badge-weight tints were far too pale at this size — an out-of-stock cell
     now carries a solid red left edge and a filled tint. */
  const tone = qty === 0
    ? 'border-[#f4bdb8] bg-[#fdecea] text-danger'
    : low
      ? 'border-[#f0d9a8] bg-[#fdf6e7] text-warning'
      : 'border-border bg-surface text-content hover:border-border-strong';

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${sku.code} · ${sku.barcode || 'no barcode'} · ${qty} on hand`}
      className={`flex min-w-[58px] flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 transition ${tone}`}
    >
      <span className="text-xs font-medium uppercase tracking-wide opacity-60">
        {sku.sizeId?.label || '—'}
      </span>
      <span className="text-md font-semibold tabular-nums leading-none">{qty}</span>
    </button>
  );
}

/** Explains the two colours used in the grid, once, rather than per cell. */
function GridLegend() {
  return (
    <div className="flex items-center gap-4 text-sm text-content-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-[#f4bdb8] bg-[#fdecea]" />
        Out of stock
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-[#f0d9a8] bg-[#fdf6e7]" />
        Low
      </span>
    </div>
  );
}

export default function StyleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [addingColorway, setAddingColorway] = useState(false);
  const [newColorId, setNewColorId] = useState('');
  const [activeSku, setActiveSku] = useState(null);
  const [moveQty, setMoveQty] = useState('');
  const [moveReason, setMoveReason] = useState('');

  const { data: style, isLoading } = useQuery({
    queryKey: ['style', id],
    queryFn: async () => (await styleService.getOne(id)).data.data
  });

  const { data: colors } = useQuery({
    queryKey: ['colors'],
    queryFn: async () => (await colorService.getAll()).data.data
  });

  const { data: movements } = useQuery({
    queryKey: ['sku-movements', activeSku?._id],
    queryFn: async () => (await stockService.skuMovements(activeSku._id, { limit: 8 })).data.data,
    enabled: Boolean(activeSku)
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['style', id] });
    queryClient.invalidateQueries({ queryKey: ['sku-movements'] });
  };

  const addColorway = useMutation({
    mutationFn: () => styleService.addColorway(id, { colorId: newColorId }),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Colourway added');
      setAddingColorway(false);
      setNewColorId('');
      refresh();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not add the colourway')
  });

  const receive = useMutation({
    mutationFn: () =>
      stockService.receive({
        skuId: activeSku._id,
        quantity: Number(moveQty),
        reference: { kind: 'manual', label: 'Received from style page' }
      }),
    onSuccess: () => { toast.success('Stock received'); setMoveQty(''); refresh(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not receive stock')
  });

  const count = useMutation({
    mutationFn: () =>
      stockService.count({
        skuId: activeSku._id,
        countedQuantity: Number(moveQty),
        reason: moveReason || 'Stock count'
      }),
    onSuccess: (res) => { toast.success(res.data.message); setMoveQty(''); setMoveReason(''); refresh(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not record the count')
  });

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (!style) {
    return (
      <EmptyState
        title="Style not found"
        description="It may have been deleted."
        action={<Button onClick={() => navigate('/styles')}>Back to styles</Button>}
      />
    );
  }

  const colorways = style.colorways || [];
  const totalUnits = colorways.reduce((sum, cw) => sum + (cw.totalStock || 0), 0);
  const usedColorIds = new Set(colorways.map((cw) => String(cw.colorId?._id || cw.colorId)));
  const availableColors = (colors || []).filter((c) => !usedColorIds.has(String(c._id)));

  return (
    <div>
      <PageHeader
        title={style.name}
        description={`${style.code} · ${style.categoryId?.name || 'Uncategorised'} · ${style.sizeScale}${style.season ? ` · ${style.season}` : ''}`}
      >
        <Button icon={FaArrowLeft} onClick={() => navigate('/styles')}>Back</Button>
        <Button icon={FaPen} onClick={() => navigate(`/styles/${id}/edit`)}>Edit</Button>
      </PageHeader>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>On hand</h3>
          <div className="stat-value">{totalUnits.toLocaleString('fr-TN')}</div>
          <p className="stat-label">across {colorways.length} colourway{colorways.length === 1 ? '' : 's'}</p>
        </div>
        <div className="stat-card">
          <h3>Retail</h3>
          <div className="stat-value">{dt(style.retailPrice)}</div>
          <p className="stat-label">{style.costPrice != null ? `costs ${dt(style.costPrice)}` : 'no cost set'}</p>
        </div>
        <div className="stat-card">
          <h3>Stock value</h3>
          <div className="stat-value">{dt(totalUnits * (style.retailPrice || 0))}</div>
          <p className="stat-label">at retail</p>
        </div>
        <div className="stat-card">
          <h3>Fabric</h3>
          <div className="stat-value !text-lg">{style.materialId?.name || '—'}</div>
          <p className="stat-label">
            {style.materialId?.composition || 'No composition recorded'}
            {style.materialId?.weightGsm ? ` · ${style.materialId.weightGsm} g/m²` : ''}
          </p>
        </div>
      </div>

      <Card
        title="Colourways"
        actions={
          <div className="flex items-center gap-4">
            {colorways.length > 0 ? <GridLegend /> : null}
            <Button
              size="sm"
              variant="primary"
              icon={FaPlus}
              onClick={() => setAddingColorway(true)}
              disabled={availableColors.length === 0}
            >
              Add colourway
            </Button>
          </div>
        }
      >
        {colorways.length === 0 ? (
          <EmptyState
            icon={FaBoxOpen}
            title="No colourways yet"
            description={`Adding one generates a SKU for every size in the "${style.sizeScale}" scale, each with its own barcode.`}
            action={
              <Button variant="primary" icon={FaPlus} onClick={() => setAddingColorway(true)}>
                Add the first colourway
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-5">
            {colorways.map((cw) => (
              <div key={cw._id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className="h-4 w-4 flex-shrink-0 rounded border border-border-strong"
                    style={{ background: cw.colorId?.hexCode || '#ccc' }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-content">{cw.colorId?.name || 'Colour'}</span>
                  <span className="text-sm text-content-muted font-mono">{cw.code}</span>
                  {cw.status === 'discontinued' ? <Badge tone="warning">Discontinued</Badge> : null}
                  <span className="ml-auto text-sm text-content-secondary tabular-nums">
                    {(cw.totalStock || 0).toLocaleString('fr-TN')} units
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(cw.skus || []).map((sku) => (
                    <SkuCell
                      key={sku._id}
                      sku={sku}
                      onClick={() => { setActiveSku({ ...sku, colorName: cw.colorId?.name }); setMoveQty(''); setMoveReason(''); }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add colourway */}
      <Modal
        isOpen={addingColorway}
        onClose={() => setAddingColorway(false)}
        title="Add a colourway"
      >
        <p className="mb-4 text-base text-content-secondary">
          A SKU will be created for every size in the <strong>{style.sizeScale}</strong> scale,
          each with its own barcode.
        </p>
        <label className="mb-1.5 block text-base font-medium">Colour</label>
        <select className="form-control" value={newColorId} onChange={(e) => setNewColorId(e.target.value)}>
          <option value="">Select a colour</option>
          {availableColors.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        {availableColors.length === 0 ? (
          <p className="mt-2 text-sm text-content-muted">
            Every colour in the catalogue is already on this style.
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setAddingColorway(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!newColorId || addColorway.isPending}
            onClick={() => addColorway.mutate()}
          >
            {addColorway.isPending ? 'Creating…' : 'Create colourway'}
          </Button>
        </div>
      </Modal>

      {/* SKU detail: move stock, and see why the number is what it is */}
      <Modal
        isOpen={Boolean(activeSku)}
        onClose={() => setActiveSku(null)}
        title={activeSku ? `${activeSku.colorName} · ${activeSku.sizeId?.label}` : ''}
      >
        {activeSku ? (
          <>
            <div className="mb-4 flex items-baseline justify-between gap-4 rounded-md border border-border bg-surface-sunken px-3 py-2">
              <div>
                <div className="font-mono text-sm text-content-secondary">{activeSku.code}</div>
                <div className="font-mono text-xs text-content-muted">{activeSku.barcode || 'no barcode'}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums leading-none">
                  {activeSku.quantityOnHand ?? 0}
                </div>
                <div className="text-sm text-content-muted">on hand</div>
              </div>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                type="number"
                min="0"
                className="form-control"
                placeholder="Quantity"
                value={moveQty}
                onChange={(e) => setMoveQty(e.target.value)}
              />
              <Button
                disabled={!moveQty || receive.isPending}
                onClick={() => receive.mutate()}
              >
                Receive
              </Button>
              <Button
                disabled={moveQty === '' || count.isPending}
                onClick={() => count.mutate()}
                title="Set stock to a counted quantity; the difference is recorded as an adjustment"
              >
                Set count
              </Button>
            </div>
            <input
              className="form-control mb-5"
              placeholder="Reason (required when setting a count)"
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
            />

            <h4 className="mb-2 flex items-center gap-2 text-base font-medium">
              <FaHistory className="opacity-50" /> Recent movements
            </h4>
            {movements && movements.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border">
                {movements.map((m) => (
                  <li key={m._id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-base capitalize">{m.type.replace(/_/g, ' ')}</div>
                      <div className="truncate text-sm text-content-muted">
                        {m.reason || m.reference?.label || '—'}
                        {m.user?.name ? ` · ${m.user.name}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium tabular-nums ${m.quantity > 0 ? 'text-success' : 'text-danger'}`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </div>
                      <div className="text-sm text-content-muted tabular-nums">→ {m.balanceAfter}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-content-muted">No movements recorded yet.</p>
            )}
          </>
        ) : null}
      </Modal>
    </div>
  );
}
