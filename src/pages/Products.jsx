import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { productService, categoryService, colorService, sizeService, rayonService } from '../services';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaEye, FaBoxes, FaTshirt } from 'react-icons/fa';
import {
  PageHeader,
  Button,
  Toolbar,
  SearchInput,
  Select,
  DataTable,
  EmptyState,
  StockBadge
} from '../components/ui/Primitives';

export default function Products() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ categoryId: '', colorId: '', sizeId: '', rayonId: '' });
  const [page, setPage] = useState(1);

  const setFilter = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', searchTerm, filters, page],
    queryFn: async () =>
      (await productService.getAll({ search: searchTerm, ...filters, page, limit: 20 })).data
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoryService.getAll()).data.data
  });
  const { data: colors } = useQuery({
    queryKey: ['colors'],
    queryFn: async () => (await colorService.getAll()).data.data
  });
  const { data: sizes } = useQuery({
    queryKey: ['sizes'],
    queryFn: async () => (await sizeService.getAll()).data.data
  });
  const { data: rayons } = useQuery({
    queryKey: ['rayons'],
    queryFn: async () => (await rayonService.getAll()).data.data
  });

  const deleteMutation = useMutation({
    mutationFn: productService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
    },
    onError: (error) =>
      toast.error(error.response?.data?.message || 'Failed to delete product')
  });

  const handleDelete = (product) => {
    if (window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(product._id);
    }
  };

  const products = productsData?.data || [];
  const pagination = productsData?.pagination;
  const isFiltered = Boolean(searchTerm || Object.values(filters).some(Boolean));

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ categoryId: '', colorId: '', sizeId: '', rayonId: '' });
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="The legacy catalogue. New textile work belongs under Styles, where stock is tracked per SKU through the movement ledger."
      >
        <Button variant="primary" icon={FaPlus} onClick={() => navigate('/products/new')}>
          Add product
        </Button>
      </PageHeader>

      <Toolbar>
        <SearchInput
          value={searchTerm}
          onChange={(v) => { setSearchTerm(v); setPage(1); }}
          placeholder="Search by name, SKU or barcode…"
        />
        <Select
          value={filters.categoryId}
          onChange={setFilter('categoryId')}
          placeholder="Any category"
          options={(categories || []).map((c) => ({ value: c._id, label: c.name }))}
        />
        <Select
          value={filters.rayonId}
          onChange={setFilter('rayonId')}
          placeholder="Any rayon"
          options={(rayons || []).map((r) => ({ value: r._id, label: r.name }))}
        />
        <Select
          value={filters.colorId}
          onChange={setFilter('colorId')}
          placeholder="Any colour"
          options={(colors || []).map((c) => ({ value: c._id, label: c.name }))}
        />
        <Select
          value={filters.sizeId}
          onChange={setFilter('sizeId')}
          placeholder="Any size"
          options={(sizes || []).map((s) => ({
            value: s._id,
            label: s.scale ? `${s.label} · ${s.scale}` : s.label
          }))}
        />
        {isFiltered ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
        ) : null}
      </Toolbar>

      <DataTable
        loading={isLoading}
        rows={products}
        page={pagination?.page}
        pages={pagination?.pages}
        total={pagination?.total}
        onPage={setPage}
        columns={[
          {
            key: 'name',
            header: 'Product',
            render: (p) => (
              <div className="min-w-0">
                <div className="font-medium text-content truncate">{p.name}</div>
                {p.sku ? (
                  <div className="font-mono text-sm text-content-muted truncate">{p.sku}</div>
                ) : null}
              </div>
            )
          },
          { key: 'category', header: 'Category', render: (p) => p.categoryId?.name || '—' },
          { key: 'rayon', header: 'Rayon', render: (p) => p.rayonId?.name || '—' },
          {
            key: 'variants',
            header: 'Variants',
            align: 'right',
            render: (p) => p.variants?.length || 0
          },
          {
            key: 'qty',
            header: 'On hand',
            align: 'right',
            render: (p) => (
              <span className={p.totalQuantity === 0 ? 'text-content-muted' : 'font-medium'}>
                {Number(p.totalQuantity || 0).toLocaleString('fr-TN')}
              </span>
            )
          },
          {
            key: 'status',
            header: 'Status',
            render: (p) => (
              <StockBadge quantity={p.totalQuantity} threshold={p.lowStockThreshold || 10} />
            )
          },
          {
            key: 'actions',
            header: '',
            width: '120px',
            render: (p) => (
              /* Row actions are quiet until hovered — a column of coloured
                 buttons on every row competed with the data itself. */
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn-icon"
                  title="View"
                  onClick={(e) => { e.stopPropagation(); navigate(`/products/${p._id}`); }}
                >
                  <FaEye />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn-icon"
                  title="Edit"
                  onClick={(e) => { e.stopPropagation(); navigate(`/products/edit/${p._id}`); }}
                >
                  <FaEdit />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn-icon text-danger"
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                >
                  <FaTrash />
                </Button>
              </div>
            )
          }
        ]}
        empty={
          isFiltered ? (
            <EmptyState
              icon={FaBoxes}
              title="No products match those filters"
              description="Try widening the search, or clear the filters to see the whole catalogue."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={FaTshirt}
              title="No products here"
              description="This is the legacy catalogue. For textile work, create a Style instead — it generates a SKU per size with its own barcode, and tracks stock through the movement ledger."
              action={
                <div className="flex gap-2">
                  <Button variant="primary" icon={FaTshirt} onClick={() => navigate('/styles')}>
                    Go to Styles
                  </Button>
                  <Button icon={FaPlus} onClick={() => navigate('/products/new')}>
                    Add a product anyway
                  </Button>
                </div>
              }
            />
          )
        }
      />
    </div>
  );
}
