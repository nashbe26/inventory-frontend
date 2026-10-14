import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FaBan, FaBoxOpen, FaCheck, FaCopy, FaEdit, FaFileExcel, FaPlus, FaShippingFast, FaSync, FaTrash, FaTruck, FaReceipt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api, { organizationAPI } from '../services/api';
import { stockService } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { DELIVERY_FEE } from '../config/constants';
import { ORDER_STATUS } from '../config/orderStatus';
import {
  PageHeader,
  Button,
  Badge,
  Toolbar,
  SearchInput,
  Select,
  Tabs,
  StatTile,
  DataTable,
  EmptyState
} from '../components/ui/Primitives';
import {
  dt,
  idOf,
  lineLabel,
  statusOf,
  statusTone,
  needsGovernorate,
  matchesSearch,
  SETTABLE_STATUSES,
  STATUS_TABS
} from './orders/orderModel';
import { useOrderActions } from './orders/useOrderActions';
import OrderFormModal from './orders/OrderFormModal';
import OrderDetailModal from './orders/OrderDetailModal';
import OrderBulkBar from './orders/OrderBulkBar';

const PAGE_SIZE = 25;

const SHELF = {
  ready: { tone: 'success', label: 'Can be packed' },
  short: { tone: 'danger', label: 'Short' },
  unknown: { tone: 'neutral', label: '?' }
};

/**
 * Orders — intake, the status pipeline, and the hand-off to delivery.
 *
 * Lines are SKUs (Style → Colourway → Size). For « Confirmé » orders the list
 * shows whether they can be packed from the shelf now. The server decides
 * (GET /orders/stock-check) across every confirmed order, whatever tab or
 * search is showing, so two orders are never both promised the last unit.
 */
export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const isManager = role === 'admin' || role === 'manager';
  const canOps = isManager || role === 'staff';

  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [shelfFilter, setShelfFilter] = useState('');
  const [priority, setPriority] = useState('oldest');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [form, setForm] = useState({ open: false, order: null });
  const [viewing, setViewing] = useState(null);

  const resetPage = (fn) => (v) => { fn(v); setPage(1); };
  const clearSelection = () => setSelectedIds(new Set());
  const actions = useOrderActions({ onSelectionDone: clearSelection });

  /* ---------------------------------------------------------------- data */

  const { data: stats } = useQuery({
    queryKey: ['orderStats'],
    queryFn: async () => (await api.get('/orders/stats')).data?.data
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', tab],
    queryFn: async () =>
      (await api.get('/orders', { params: { ...(tab ? { status: tab } : {}), page: 1, limit: 10000 } })).data.data
  });

  /** Every SKU with its balance: prices for editing, balances for the shelf check. */
  const { data: catalog = [] } = useQuery({
    queryKey: ['skuCatalog', 'all'],
    queryFn: async () => (await stockService.catalog({ limit: 5000 })).data.data,
    staleTime: 60 * 1000
  });

  const { data: org } = useQuery({
    queryKey: ['my-organization-settings'],
    queryFn: async () => (await organizationAPI.getMy()).data,
    staleTime: 5 * 60 * 1000
  });
  const deliveryFee = org?.settings?.deliveryFee ?? DELIVERY_FEE;
  /** Paused from Shopify settings; while off, only manual orders come in. */
  const shopifyOrdersOn = Boolean(org?.shopify?.shopDomain) && org?.shopify?.ordersEnabled !== false;

  const catalogById = useMemo(() => new Map(catalog.map((s) => [idOf(s._id), s])), [catalog]);

  const styleOptions = useMemo(() => {
    const seen = new Map();
    catalog.forEach((s) => seen.set(idOf(s.styleId), s.styleName));
    return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [catalog]);

  /** Which confirmed orders can be packed now, shared out in the chosen priority. */
  const { data: stockCheck } = useQuery({
    queryKey: ['orderStockCheck', priority],
    queryFn: async () => (await api.get('/orders/stock-check', { params: { priority } })).data.data,
    staleTime: 30 * 1000
  });

  /* -------------------------------------------------------- derived list */

  const sorted = useMemo(() => {
    const t = (o) => new Date(o.createdAt).getTime();
    return [...orders].sort((a, b) => (priority === 'oldest' ? t(a) - t(b) : t(b) - t(a)));
  }, [orders, priority]);

  const shelf = useMemo(() => {
    const byOrder = new Map();
    const byLine = new Map();
    for (const [id, o] of Object.entries(stockCheck?.orders || {})) {
      byOrder.set(id, o);
      for (const [lineId, l] of Object.entries(o.lines)) byLine.set(lineId, l);
    }
    return { byOrder, byLine };
  }, [stockCheck]);

  const visible = useMemo(
    () =>
      sorted.filter((o) => {
        if (!matchesSearch(o, search)) return false;
        if (styleFilter && !(o.items || []).some((i) => idOf(i.styleId) === styleFilter)) return false;
        if (shelfFilter && shelf.byOrder.get(idOf(o._id))?.state !== shelfFilter) return false;
        return true;
      }),
    [sorted, search, styleFilter, shelfFilter, shelf]
  );

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const selected = orders.filter((o) => selectedIds.has(o._id));

  /* ------------------------------------------------------------- actions */

  const toggle = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allOnPage = rows.length > 0 && rows.every((o) => selectedIds.has(o._id));
  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      rows.forEach((o) => (allOnPage ? next.delete(o._id) : next.add(o._id)));
      return next;
    });

  const changeStatus = (order, status) => {
    if (status === ORDER_STATUS.CONFIRMED && needsGovernorate(order)) {
      return toast.error('Set a real governorate (edit the order) before confirming.');
    }
    if (status === ORDER_STATUS.CANCELLED && !window.confirm(`Cancel ${order.orderNumber}? Any picked stock is returned.`)) {
      return;
    }
    actions.setStatus.mutate({ id: order._id, status });
  };

  const openEdit = (order) => {
    setViewing(null);
    setForm({ open: true, order });
  };

  const tabCounts = STATUS_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: t.statKey ? stats?.[t.statKey]?.count : undefined
  }));

  /* ------------------------------------------------------------- columns */

  const columns = [
    {
      key: 'select',
      width: 36,
      header: <input type="checkbox" aria-label="Select page" checked={allOnPage} onChange={toggleAll} />,
      render: (o) => (
        <input
          type="checkbox"
          aria-label={`Select ${o.orderNumber}`}
          checked={selectedIds.has(o._id)}
          onChange={() => toggle(o._id)}
          onClick={(e) => e.stopPropagation()}
        />
      )
    },
    {
      key: 'order',
      header: 'Order',
      render: (o) => (
        <button type="button" className="text-left" onClick={() => setViewing(o)}>
          <span className="block font-mono text-sm font-medium text-accent">{o.orderNumber}</span>
          <span className="block text-xs text-content-muted">
            {new Date(o.createdAt).toLocaleDateString('fr-TN')}
            {o.shopifyOrderName ? ` · Shopify ${o.shopifyOrderName}` : ''}
          </span>
        </button>
      )
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <div className="min-w-0">
          <div className="truncate">{o.customer?.nom || 'Walk-in'}</div>
          {o.customer?.telephone ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-mono text-xs text-content-secondary"
              title="Copy phone number"
              onClick={() => {
                navigator.clipboard.writeText(o.customer.telephone);
                toast.success('Phone number copied', { autoClose: 1500 });
              }}
            >
              {o.customer.telephone} <FaCopy size={10} aria-hidden="true" />
            </button>
          ) : null}
          {o.customer?.gouvernerat ? (
            <div className="text-xs text-content-muted">{o.customer.gouvernerat}</div>
          ) : null}
        </div>
      )
    },
    {
      key: 'items',
      header: 'Articles',
      render: (o) => (
        <ul className="max-w-[320px] space-y-0.5 text-sm">
          {(o.items || []).map((i) => {
            const s = shelf.byLine.get(idOf(i._id));
            return (
              <li key={idOf(i._id)} className="flex items-center gap-1.5">
                <span className="truncate">{lineLabel(i)}</span>
                {i.quantity > 1 ? <span className="text-xs text-content-muted">×{i.quantity}</span> : null}
                {s?.state === 'short' ? <span className="text-xs text-danger" title={`${s.have} left on the shelf for this order, ${s.need} needed`}>short</span> : null}
              </li>
            );
          })}
        </ul>
      )
    },
    { key: 'total', header: 'Total', align: 'right', render: (o) => <span className="tabular-nums">{dt(o.total)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (o) => {
        const status = statusOf(o);
        const options = SETTABLE_STATUSES.includes(status) ? SETTABLE_STATUSES : [status, ...SETTABLE_STATUSES];
        return (
          <div className="flex flex-col items-start gap-1">
            {canOps ? (
              <select
                className="form-control !h-8 !py-0 text-sm"
                value={status}
                disabled={actions.setStatus.isPending}
                onChange={(e) => changeStatus(o, e.target.value)}
                aria-label={`Status of ${o.orderNumber}`}
              >
                {options.map((s) => (
                  <option key={s} value={s} disabled={s === ORDER_STATUS.CONFIRMED && needsGovernorate(o)}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <Badge tone={statusTone(status)}>{status}</Badge>
            )}
            <div className="flex flex-wrap gap-1">
              {o.isExchange ? <Badge tone="warning">Exchange</Badge> : null}
              {o.shortOnStock && statusOf(o) !== ORDER_STATUS.CONFIRMED ? (
                <span title="Saved while an article exceeded available stock">
                  <Badge tone="danger">Saved short</Badge>
                </span>
              ) : null}
              {status === ORDER_STATUS.PENDING && needsGovernorate(o) ? (
                <span className="text-xs text-warning">Governorate missing</span>
              ) : null}
            </div>
          </div>
        );
      }
    },
    {
      key: 'shelf',
      header: 'Stock',
      render: (o) => {
        if (statusOf(o) !== ORDER_STATUS.CONFIRMED) return <span className="text-content-muted">—</span>;
        const check = shelf.byOrder.get(idOf(o._id));
        const meta = check ? SHELF[check.state] : null;
        return meta ? (
          <button type="button" onClick={() => setViewing(o)} title="Open for article-by-article stock">
            <Badge tone={meta.tone}>
              {meta.label}
              {check.state === 'short' && check.lineCount > 1 ? ` · ${check.covered}/${check.lineCount}` : ''}
            </Badge>
          </button>
        ) : (
          <span className="text-xs text-content-muted">…</span>
        );
      }
    },
    {
      key: 'carrier',
      header: 'Carrier',
      render: (o) =>
        o.deliveryBarcode ? (
          <span className="font-mono text-xs" title={`Carrier state ${o.deliveryState ?? '—'}`}>{o.deliveryBarcode}</span>
        ) : (
          <span className="text-content-muted">—</span>
        )
    },
    {
      key: 'actions',
      header: '',
      render: (o) => renderActions(o)
    }
  ];

  /** Per-row buttons, by role. */
  function renderActions(o) {
    const status = statusOf(o);
    const canSend = !o.deliveryBarcode && (status === ORDER_STATUS.CONFIRMED || status === ORDER_STATUS.PICKED);
    return (
      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
        {canOps && canSend ? (
          <Button size="sm" icon={FaTruck} title="Send to First Delivery" aria-label="Send to First Delivery"
            onClick={() => window.confirm(`Send ${o.orderNumber} to First Delivery?`) && actions.sendToCarrier.mutate(o._id)} />
        ) : null}
        {canOps && o.deliveryBarcode ? (
          <Button size="sm" icon={FaSync} title="Sync carrier status" aria-label="Sync carrier status"
            onClick={() => actions.syncCarrierStatus.mutate(o._id)} />
        ) : null}
        {canOps && o.deliveryBarcode && status !== ORDER_STATUS.CANCELLED ? (
          <Button size="sm" icon={FaBan} title="Cancel delivery" aria-label="Cancel delivery"
            onClick={() => window.confirm('Cancel this delivery at First Delivery?') && actions.cancelCarrier.mutate(o._id)} />
        ) : null}
        {canOps ? (
          <Button size="sm" icon={FaEdit} title="Edit" aria-label="Edit" onClick={() => openEdit(o)} />
        ) : null}
        {isManager ? (
          <Button size="sm" variant="ghost" icon={FaTrash} title="Delete" aria-label="Delete"
            onClick={() => window.confirm(`Delete ${o.orderNumber}? Any picked stock is returned.`) && actions.remove.mutate(o._id)} />
        ) : null}

        {role === 'supplier' && status === ORDER_STATUS.CONFIRMED ? (
          <Button size="sm" variant="primary" icon={FaBoxOpen}
            onClick={() => actions.setStatus.mutate({ id: o._id, status: ORDER_STATUS.PICKED })}>
            Prepared
          </Button>
        ) : null}
        {role === 'delivery_man' && status === ORDER_STATUS.PICKED ? (
          <Button size="sm" variant="primary" icon={FaShippingFast}
            onClick={() => actions.setStatus.mutate({ id: o._id, status: ORDER_STATUS.SHIPPED })}>
            Pick up
          </Button>
        ) : null}
        {role === 'delivery_man' && status === ORDER_STATUS.SHIPPED ? (
          <Button size="sm" variant="primary" icon={FaCheck}
            onClick={() => actions.setStatus.mutate({ id: o._id, status: ORDER_STATUS.DELIVERED })}>
            Delivered
          </Button>
        ) : null}
      </div>
    );
  }

  /* -------------------------------------------------------------- render */

  const filtered = Boolean(search || styleFilter || shelfFilter);

  return (
    <div>
      <PageHeader title="Orders" description="Every order from intake to delivery. Stock leaves the shelf when an order is picked.">
        {isManager && shopifyOrdersOn ? (
          <Button icon={FaSync} disabled={actions.syncShopify.isPending} onClick={() => actions.syncShopify.mutate()}
            title="Refresh Shopify orders from the store">
            {actions.syncShopify.isPending ? 'Syncing…' : 'Sync Shopify'}
          </Button>
        ) : null}
        {canOps ? (
          <Button icon={FaSync} disabled={actions.syncCarrierStatuses.isPending}
            onClick={() => actions.syncCarrierStatuses.mutate(undefined)}
            title="Fetch First Delivery status for every order at the carrier">
            {actions.syncCarrierStatuses.isPending ? 'Syncing…' : 'Sync carrier'}
          </Button>
        ) : null}
        {canOps ? (
          <Button icon={FaFileExcel} onClick={() => navigate('/orders/import')}
            title="Compare an order sheet with these orders and add the missing ones">
            Import sheet
          </Button>
        ) : null}
        <Button variant="primary" icon={FaPlus} onClick={() => setForm({ open: true, order: null })}>
          New order
        </Button>
      </PageHeader>

      <div className="stats-grid">
        <StatTile label="Total orders" value={(stats?.total?.count || 0).toLocaleString('fr-TN')} hint={dt(stats?.total?.amount)} />
        <StatTile
          label="Awaiting action"
          value={((stats?.pending?.count || 0) + (stats?.confirmed?.count || 0)).toLocaleString('fr-TN')}
          hint="Pending and confirmed"
          tone={(stats?.pending?.count || 0) > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="In progress"
          value={((stats?.readyToPrepare?.count || 0) + (stats?.processing?.count || 0)).toLocaleString('fr-TN')}
          hint="Being picked or with the carrier"
        />
        <StatTile label="Delivered" value={(stats?.completed?.count || 0).toLocaleString('fr-TN')} hint={dt(stats?.completed?.amount)} />
      </div>

      <div className="card">
        <div className="mb-4 min-w-0 space-y-3">
          <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); clearSelection(); }} options={tabCounts} />
          <Toolbar className="!mb-0">
            <SearchInput value={search} onChange={resetPage(setSearch)} placeholder="Order #, customer, phone, carrier barcode, SKU…" />
            <Select value={styleFilter} onChange={resetPage(setStyleFilter)} placeholder="Any style" options={styleOptions} />
            <Select
              value={shelfFilter}
              onChange={resetPage(setShelfFilter)}
              placeholder="Any stock state"
              options={[
                { value: 'ready', label: 'Can be packed now' },
                { value: 'short', label: 'Short on stock' }
              ]}
            />
            <Select
              value={priority}
              onChange={setPriority}
              options={[
                { value: 'oldest', label: 'Oldest first (FIFO)' },
                { value: 'newest', label: 'Newest first' }
              ]}
            />
          </Toolbar>
        </div>

        {stockCheck?.summary?.confirmed ? (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm">
            <span>
              <strong>{stockCheck.summary.ready}</strong> of {stockCheck.summary.confirmed} confirmed order(s) can be packed now
              {stockCheck.summary.short ? <> · <span className="text-danger">{stockCheck.summary.short} short on stock</span></> : null}
              {stockCheck.summary.unknown ? <> · {stockCheck.summary.unknown} with an unknown article</> : null}
            </span>
            {stockCheck.summary.ready ? (
              <button type="button" className="underline underline-offset-2"
                onClick={() => { setTab('Confirmed'); setShelfFilter('ready'); setPage(1); clearSelection(); }}>
                Show them
              </button>
            ) : null}
            <span className="text-xs text-content-muted">
              {priority === 'oldest' ? 'Oldest first' : 'Newest first'}; stock being packed for « Prêt à préparer » orders is set aside.
            </span>
          </div>
        ) : null}

        <OrderBulkBar selected={selected} onClear={clearSelection} canOps={canOps} isManager={isManager} actions={actions} />

        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          page={current}
          pages={pages}
          total={visible.length}
          onPage={setPage}
          empty={
            <EmptyState
              icon={FaReceipt}
              title={filtered ? 'No order matches these filters' : 'No orders here yet'}
              description={filtered ? 'Clear the search or filters to see more.' : shopifyOrdersOn ? 'New orders arrive from Shopify or can be entered by hand.' : 'Create an order by hand to get started.'}
              action={!filtered ? <Button variant="primary" icon={FaPlus} onClick={() => setForm({ open: true, order: null })}>New order</Button> : null}
            />
          }
        />
      </div>

      <OrderFormModal
        isOpen={form.open}
        order={form.order}
        catalogById={catalogById}
        deliveryFee={deliveryFee}
        onClose={() => setForm({ open: false, order: null })}
        actions={actions}
      />

      <OrderDetailModal
        order={viewing ? orders.find((o) => o._id === viewing._id) || viewing : null}
        stockByLine={shelf.byLine}
        canOps={canOps}
        onEdit={openEdit}
        onClose={() => setViewing(null)}
        actions={actions}
      />
    </div>
  );
}
