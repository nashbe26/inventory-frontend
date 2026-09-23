import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { stockService, styleService } from '../services';
import { FaHistory, FaBalanceScale } from 'react-icons/fa';
import {
  PageHeader,
  Button,
  Toolbar,
  Select,
  DataTable,
  EmptyState,
  Badge,
  Card
} from '../components/ui/Primitives';

/** Movement types, grouped the way someone reading the ledger thinks about them. */
const TYPES = [
  { value: 'receipt', label: 'Receipt' },
  { value: 'sale', label: 'Sale' },
  { value: 'return_in', label: 'Return in' },
  { value: 'return_out', label: 'Return out' },
  { value: 'adjustment_in', label: 'Adjustment in' },
  { value: 'adjustment_out', label: 'Adjustment out' },
  { value: 'transfer_in', label: 'Transfer in' },
  { value: 'transfer_out', label: 'Transfer out' }
];

const TYPE_TONE = {
  receipt: 'success',
  return_in: 'success',
  transfer_in: 'neutral',
  adjustment_in: 'info',
  sale: 'neutral',
  return_out: 'warning',
  transfer_out: 'neutral',
  adjustment_out: 'warning'
};

const label = (t) => TYPES.find((x) => x.value === t)?.label || t.replace(/_/g, ' ');

const when = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-TN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

export default function StockMovements() {
  const [type, setType] = useState('');
  const [styleId, setStyleId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements', type, styleId, from, to, page],
    queryFn: async () =>
      (await stockService.movements({ type, styleId, from, to, page, limit: 50 })).data
  });

  const { data: styles } = useQuery({
    queryKey: ['styles', 'picker'],
    queryFn: async () => (await styleService.getAll({ limit: 100 })).data.data
  });

  /* Reconciling compares the cached balances against the ledger. The ledger is
     authoritative, so a non-empty result means something wrote a quantity
     outside stockService — worth surfacing rather than silently repairing. */
  const reconcile = useMutation({
    mutationFn: () => stockService.reconcile({}),
    onSuccess: (res) => {
      const d = res.data.data;
      if (d.drifted.length === 0) toast.success('All balances match the ledger');
      else toast.warning(`${d.drifted.length} SKU(s) drifted from the ledger`);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not reconcile')
  });

  const movements = data?.data || [];
  const pagination = data?.pagination;
  const isFiltered = Boolean(type || styleId || from || to);

  const clear = () => {
    setType(''); setStyleId(''); setFrom(''); setTo(''); setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Stock movements"
        description="Every change to stock, in order. This ledger is the source of truth; the quantity on each SKU is a cached rollup of it."
      >
        <Button
          icon={FaBalanceScale}
          onClick={() => reconcile.mutate()}
          disabled={reconcile.isPending}
          title="Compare cached balances against the ledger"
        >
          {reconcile.isPending ? 'Checking…' : 'Reconcile'}
        </Button>
      </PageHeader>

      {reconcile.data?.data?.drifted?.length ? (
        <Card title="Balances that disagree with the ledger">
          <p className="mb-3 text-base text-content-secondary">
            These were written outside the stock service. The ledger figure is
            the correct one.
          </p>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>SKU</th><th className="num">Cached</th><th className="num">Ledger</th></tr>
              </thead>
              <tbody>
                {reconcile.data.data.drifted.map((d) => (
                  <tr key={d.skuId}>
                    <td className="mono">{d.code}</td>
                    <td className="num text-danger">{d.cached}</td>
                    <td className="num font-medium">{d.ledger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Toolbar>
        <Select
          value={type}
          onChange={(v) => { setType(v); setPage(1); }}
          placeholder="Any type"
          options={TYPES}
        />
        <Select
          value={styleId}
          onChange={(v) => { setStyleId(v); setPage(1); }}
          placeholder="Any style"
          options={(styles || []).map((s) => ({ value: s._id, label: `${s.code} · ${s.name}` }))}
        />
        <input
          type="date"
          className="form-control w-auto"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          title="From"
        />
        <input
          type="date"
          className="form-control w-auto"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
          title="To"
        />
        {isFiltered ? <Button variant="ghost" size="sm" onClick={clear}>Clear</Button> : null}
      </Toolbar>

      <DataTable
        loading={isLoading}
        rows={movements}
        page={pagination?.page}
        pages={pagination?.pages}
        total={pagination?.total}
        onPage={setPage}
        columns={[
          { key: 'when', header: 'When', render: (m) => (
            <span className="whitespace-nowrap text-content-secondary">{when(m.createdAt)}</span>
          ) },
          { key: 'type', header: 'Type', render: (m) => (
            <Badge tone={TYPE_TONE[m.type] || 'neutral'}>{label(m.type)}</Badge>
          ) },
          { key: 'sku', header: 'SKU', mono: true, render: (m) => m.skuId?.code || '—' },
          { key: 'style', header: 'Style', render: (m) =>
            m.styleId ? `${m.styleId.code} · ${m.styleId.name}` : '—'
          },
          { key: 'qty', header: 'Change', align: 'right', render: (m) => (
            <span className={`font-medium ${m.quantity > 0 ? 'text-success' : 'text-danger'}`}>
              {m.quantity > 0 ? '+' : ''}{m.quantity}
            </span>
          ) },
          /* The balance after each movement is what makes the ledger auditable
             — you can follow a SKU down the page and see how it got here. */
          { key: 'after', header: 'Balance', align: 'right', render: (m) => m.balanceAfter },
          { key: 'why', header: 'Reason', render: (m) => (
            <span className="text-content-secondary">
              {m.reason || m.reference?.label || '—'}
            </span>
          ) },
          { key: 'who', header: 'By', render: (m) => m.user?.name || '—' }
        ]}
        empty={
          isFiltered ? (
            <EmptyState
              icon={FaHistory}
              title="No movements match those filters"
              description="Try a wider date range, or clear the filters."
              action={<Button onClick={clear}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={FaHistory}
              title="No stock has moved yet"
              description="Receiving a delivery, picking an order or recording a count all write here. Nothing changes stock without leaving a row."
            />
          )
        }
      />
    </div>
  );
}
