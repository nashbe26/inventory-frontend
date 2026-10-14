import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { styleService, categoryService } from '../services';
import { FaBarcode, FaPlus, FaTshirt } from 'react-icons/fa';
import {
  PageHeader,
  Button,
  Toolbar,
  SearchInput,
  Select,
  DataTable,
  EmptyState,
  Badge
} from '../components/ui/Primitives';

const dt = (n) =>
  n == null
    ? '—'
    : `${Number(n).toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;

const STATUS_TONE = { active: 'success', draft: 'neutral', discontinued: 'warning' };

export default function Styles() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['styles', search, status, categoryId, page],
    queryFn: async () =>
      (await styleService.getAll({ search, status, categoryId, page, limit: 25 })).data
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoryService.getAll()).data.data
  });

  const styles = data?.data || [];
  const filtered = Boolean(search || status || categoryId);

  return (
    <div>
      <PageHeader
        title="Styles"
        description="Every design in the catalogue. Stock is held on the SKUs beneath each colourway."
      >
        <Button icon={FaBarcode} onClick={() => navigate('/labels')}>
          Print labels
        </Button>
        <Button variant="primary" icon={FaPlus} onClick={() => navigate('/styles/new')}>
          New style
        </Button>
      </PageHeader>

      <Toolbar>
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by name or style code…"
        />
        <Select
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          placeholder="Any status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'draft', label: 'Draft' },
            { value: 'discontinued', label: 'Discontinued' }
          ]}
        />
        <Select
          value={categoryId}
          onChange={(v) => { setCategoryId(v); setPage(1); }}
          placeholder="Any category"
          options={(categories || []).map((c) => ({ value: c._id, label: c.name }))}
        />
      </Toolbar>

      <DataTable
        loading={isLoading}
        rows={styles}
        onRowClick={(s) => navigate(`/styles/${s._id}`)}
        page={data?.pagination?.page}
        pages={data?.pagination?.pages}
        total={data?.pagination?.total}
        onPage={setPage}
        columns={[
          {
            key: 'code',
            header: 'Code',
            mono: true,
            width: '120px'
          },
          {
            key: 'name',
            header: 'Style',
            render: (s) => (
              <div className="min-w-0">
                <div className="font-medium text-content truncate">{s.name}</div>
                {s.materialId?.name ? (
                  <div className="text-sm text-content-muted truncate">
                    {s.materialId.name}
                    {s.materialId.weightGsm ? ` · ${s.materialId.weightGsm} g/m²` : ''}
                  </div>
                ) : null}
              </div>
            )
          },
          {
            key: 'category',
            header: 'Category',
            render: (s) => s.categoryId?.name || '—'
          },
          {
            key: 'season',
            header: 'Season',
            render: (s) => s.season || '—'
          },
          {
            key: 'scale',
            header: 'Size scale',
            render: (s) => <span className="text-content-secondary">{s.sizeScale}</span>
          },
          {
            key: 'skus',
            header: 'SKUs',
            align: 'right',
            render: (s) => s.stock?.skuCount || 0
          },
          {
            key: 'stock',
            header: 'On hand',
            align: 'right',
            render: (s) => {
              const units = s.stock?.totalStock || 0;
              /* A style with units but nothing in its core sizes is
                 commercially dead — worth seeing at a glance. */
              return (
                <span className={units === 0 ? 'text-content-muted' : 'font-medium'}>
                  {units.toLocaleString('fr-TN')}
                </span>
              );
            }
          },
          {
            key: 'price',
            header: 'Retail',
            align: 'right',
            render: (s) => dt(s.retailPrice)
          },
          {
            key: 'status',
            header: 'Status',
            render: (s) => (
              <Badge tone={STATUS_TONE[s.status] || 'neutral'}>{s.status}</Badge>
            )
          }
        ]}
        empty={
          filtered ? (
            <EmptyState
              icon={FaTshirt}
              title="No styles match those filters"
              description="Try widening the search, or clear the filters to see the whole catalogue."
              action={
                <Button
                  onClick={() => { setSearch(''); setStatus(''); setCategoryId(''); setPage(1); }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FaTshirt}
              title="No styles yet"
              description="A style is one design — a shirt, a pair of trousers. Add colourways to it and the size grid is generated from its size scale."
              action={
                <Button variant="primary" icon={FaPlus} onClick={() => navigate('/styles/new')}>
                  Create the first style
                </Button>
              }
            />
          )
        }
      />
    </div>
  );
}
