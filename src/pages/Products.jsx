import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { productService, categoryService, colorService, sizeService, rayonService } from '../services';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaEye } from 'react-icons/fa';

export default function Products() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    categoryId: '',
    colorId: '',
    sizeId: '',
    rayonId: ''
  });
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', searchTerm, filters, page],
    queryFn: async () => {
      const response = await productService.getAll({
        search: searchTerm,
        ...filters,
        page,
        limit: 20
      });
      return response.data;
    }
  });

  // Fetch dropdown data for filters
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

  const deleteMutation = useMutation({
    mutationFn: productService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      toast.success('Product deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete product');
    }
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      deleteMutation.mutate(id);
    }
  };

  const getStockBadge = (product) => {
    const totalQty = product.totalQuantity || 0;
    if (totalQty === 0) {
      return <span className="badge badge-danger">Out of Stock</span>;
    } else if (totalQty <= (product.lowStockThreshold || 10)) {
      return <span className="badge badge-warning">Low Stock</span>;
    } else {
      return <span className="badge badge-success">In Stock</span>;
    }
  };

  if (isLoading) return <div className="loading">Loading products...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Products</h1>
        <button className="btn btn-primary" onClick={() => navigate('/products/new')}>
          <FaPlus /> Add Product
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, SKU, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="form-control"
            value={filters.categoryId}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
          >
            <option value="">All Categories</option>
            {categories?.map(cat => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
          <select
            className="form-control"
            value={filters.colorId}
            onChange={(e) => setFilters({ ...filters, colorId: e.target.value })}
          >
            <option value="">All Colors (Any Variant)</option>
            {colors?.map(color => (
              <option key={color._id} value={color._id}>{color.name}</option>
            ))}
          </select>
          <select
            className="form-control"
            value={filters.sizeId}
            onChange={(e) => setFilters({ ...filters, sizeId: e.target.value })}
          >
            <option value="">All Sizes (Any Variant)</option>
            {sizes?.map(size => (
              <option key={size._id} value={size._id}>{size.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Rayon</th>
                <th>Variants</th>
                <th>Tot. Qty</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {productsData?.data?.map((product) => (
                <tr key={product._id}>
                  <td><strong>{product.name}</strong></td>
                  <td>{product.categoryId?.name}</td>
                  <td>{product.rayonId?.name}</td>
                  <td>{product.variants?.length || 0} variants</td>
                  <td>{product.totalQuantity}</td>
                  <td>{getStockBadge(product)}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-primary" 
                      onClick={() => navigate(`/products/${product._id}`)}
                      style={{ marginRight: '5px' }}
                    >
                      <FaEye />
                    </button>
                    <button 
                      className="btn btn-sm btn-secondary" 
                      onClick={() => navigate(`/products/edit/${product._id}`)}
                      style={{ marginRight: '5px' }}
                    >
                      <FaEdit />
                    </button>
                    <button 
                      className="btn btn-sm btn-danger" 
                      onClick={() => handleDelete(product._id)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {productsData?.pagination && (
          <div className="pagination">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>Page {page} of {productsData.pagination.pages}</span>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={page >= productsData.pagination.pages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
