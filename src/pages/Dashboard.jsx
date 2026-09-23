import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { inventoryService } from '../services';
import { FaBoxes, FaLayerGroup, FaArrowRight } from 'react-icons/fa';
import {
  PageHeader,
  StatTile,
  Card,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Skeleton
} from '../components/ui/Primitives';

/** Tunisian dinar, the currency this business actually trades in. */
const dt = (n) =>
  `${Number(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;

const count = (n) => Number(n || 0).toLocaleString('fr-TN');

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => (await inventoryService.getStats()).data.data
  });

  const { data: lowStockData, isLoading: loadingStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => (await inventoryService.getLowStock()).data.data
  });

  const lowStock = lowStockData?.lowStock || [];
  const outOfStock = lowStockData?.outOfStock || [];
  const needsAttention = lowStock.length + outOfStock.length;

  /* Gross margin is the number a brand actually runs on, and it was nowhere
     on the old dashboard despite both inputs already being fetched. */
  const retail = stats?.totalValue || 0;
  const cost = stats?.totalBuyingValue || 0;
  const marginPct = retail > 0 ? ((retail - cost) / retail) * 100 : null;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Stock position across the catalogue."
      />

      {isLoading ? (
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="stats-grid">
          <StatTile
            label="Products"
            value={count(stats?.totalProducts)}
            hint={`${count(stats?.totalQuantity)} units in stock`}
            icon={FaBoxes}
          />
          <StatTile
            label="Stock value at retail"
            value={dt(retail)}
            hint={marginPct !== null ? `${marginPct.toFixed(1)}% gross margin` : 'No prices set'}
          />
          <StatTile
            label="Stock value at cost"
            value={dt(cost)}
            hint="What the stock owes you"
          />
          {/* The only tile that carries colour, and only when it is non-zero —
              so red on this screen always means the same thing. */}
          <StatTile
            label="Needs attention"
            value={count(needsAttention)}
            hint={
              needsAttention === 0
                ? 'Everything above threshold'
                : `${outOfStock.length} out of stock · ${lowStock.length} low`
            }
            tone={outOfStock.length > 0 ? 'danger' : lowStock.length > 0 ? 'warning' : 'default'}
          />
        </div>
      )}

      <Card
        title="Needs restocking"
        actions={
          <Button size="sm" icon={FaArrowRight} onClick={() => navigate('/products')}>
            All products
          </Button>
        }
        padded={false}
        className="p-0"
      >
        <div className="px-5 pb-5">
          <DataTable
            loading={loadingStock}
            columns={[
              { key: 'name', header: 'Product', render: (p) => (
                <span className="font-medium text-content">{p.name}</span>
              ) },
              { key: 'sku', header: 'SKU', mono: true },
              { key: 'category', header: 'Category', render: (p) => p.categoryId?.name || '—' },
              { key: 'qty', header: 'On hand', align: 'right', render: (p) => (
                <span className="font-variant-numeric">{count(p.totalQuantity ?? p.quantity)}</span>
              ) },
              { key: 'status', header: 'Status', render: (p) =>
                (p.totalQuantity ?? p.quantity) === 0
                  ? <Badge tone="danger">Out of stock</Badge>
                  : <Badge tone="warning">Low stock</Badge>
              }
            ]}
            rows={[...outOfStock, ...lowStock]}
            empty={
              <EmptyState
                icon={FaLayerGroup}
                title="Nothing needs restocking"
                description="Every product is above its reorder threshold. Items will appear here as stock runs down."
              />
            }
          />
        </div>
      </Card>
    </div>
  );
}
