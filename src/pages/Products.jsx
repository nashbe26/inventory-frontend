import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { productService, categoryService, colorService, sizeService, rayonService, fournisseurService, materialService } from '../services';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaEye } from 'react-icons/fa';
import Modal from '../components/Modal';

export default function Products() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    categoryId: '',
    colorId: '',
    sizeId: '',
    rayonId: ''
  });
  const [page, setPage] = useState(1);
  const [formData, setFormData] = useState({
    name: '', categoryId: '', rayonId: '', fournisseurId: '', materialId: '',
    price: '', buyingPrice: '', description: '', lowStockThreshold: 10,
    variants: []
  });

  // State for new variant entry
  const [newVariant, setNewVariant] = useState({ colorId: '', sizeId: '', quantity: 0 });

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

  // Fetch dropdown data
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoryService.getAll()).data.data
  });

  const { data: fournisseurs } = useQuery({
      queryKey: ['fournisseurs'],
      queryFn: async () => (await fournisseurService.getAll()).data.data
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

  const { data: materials } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => (await materialService.getAll()).data.data
  });

  const createMutation = useMutation({
    mutationFn: productService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      toast.success('Product created successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create product');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      toast.success('Product updated successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update product');
    }
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

  const openModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        categoryId: product.categoryId?._id || '',
        rayonId: product.rayonId?._id || '',
        price: product.price || '',
        buyingPrice: product.buyingPrice || '',
        description: product.description || '',
        lowStockThreshold: product.lowStockThreshold || 10,
        fournisseurId: product.fournisseurId?._id || '',
        variants: product.variants.map(v => ({
             colorId: v.colorId?._id || v.colorId,
             sizeId: v.sizeId?._id || v.sizeId,
             quantity: v.quantity,
             sku: v.sku,
             barcode: v.barcode,
             _id: v._id
        }))
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '', categoryId: '', rayonId: '', fournisseurId: '',
        price: '', buyingPrice: '', description: '', lowStockThreshold: 10,
        variants: []
      });
    }
    setNewVariant({ colorId: '', sizeId: '', quantity: 0 });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const addVariant = () => {
      if(!newVariant.colorId || !newVariant.sizeId) {
          toast.error("Color and Size are required");
          return;
      }
      setFormData({
          ...formData,
          variants: [...formData.variants, { ...newVariant }]
      });
      setNewVariant({ colorId: '', sizeId: '', quantity: 0 }); // Reset
  };

  const removeVariant = (index) => {
      const newVariants = [...formData.variants];
      newVariants.splice(index, 1);
      setFormData({ ...formData, variants: newVariants });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      deleteMutation.mutate(id);
    }
  };

  const getStockBadge = (product) => {
    const totalQty = product.totalQuantity || 0;
    if (totalQty === 0) {
      return <span className="badge badge-danger">Out of Stock</span>;
    } else if (totalQty <= product.lowStockThreshold) {
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
        <button className="btn btn-primary" onClick={() => openModal()}>
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
                      onClick={() => openModal(product)}
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

      {/* Product Form Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingProduct ? 'Edit Product' : 'Add Product'}>
        <form onSubmit={handleSubmit} style={{maxWidth: '800px'}}>
          <div className="form-group">
            <label>Product Name *</label>
            <input
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label>Category *</label>
              <select
                className="form-control"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                required
              >
                <option value="">Select Category</option>
                {categories?.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Rayon *</label>
              <select
                className="form-control"
                value={formData.rayonId}
                onChange={(e) => setFormData({ ...formData, rayonId: e.target.value })}
                required
              >
                <option value="">Select Rayon</option>
                {rayons?.map(rayon => (
                  <option key={rayon._id} value={rayon._id}>{rayon.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Supplier</label>
              <select
                className="form-control"
                value={formData.fournisseurId}
                onChange={(e) => setFormData({ ...formData, fournisseurId: e.target.value })}
              >
                <option value="">Select Supplier</option>
                {fournisseurs?.map(f => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Material</label>
              <select
                className="form-control"
                value={formData.materialId}
                onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
              >
                <option value="">Select Material</option>
                {materials?.map(m => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label>Selling Price</label>
              <input
                type="number"
                className="form-control"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                step="0.01"
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Buying Price</label>
              <input
                type="number"
                className="form-control"
                value={formData.buyingPrice}
                onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                step="0.01"
                min="0"
              />
            </div>
             <div className="form-group">
                <label>Low Stock Threshold</label>
                <input
                type="number"
                className="form-control"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) })}
                min="0"
                />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <hr style={{margin: '20px 0'}}/>
          
          <h4>Variants (Color & Size)</h4>
          <div style={{background: '#f9f9f9', padding: '10px', borderRadius: '5px', marginBottom: '10px'}}>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                <div className="form-group" style={{marginBottom:0}}>
                    <label>Color</label>
                    <select className="form-control" value={newVariant.colorId} onChange={e => setNewVariant({...newVariant, colorId: e.target.value})}>
                        <option value="">Select Color</option>
                        {colors?.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                    <label>Size</label>
                    <select className="form-control" value={newVariant.sizeId} onChange={e => setNewVariant({...newVariant, sizeId: e.target.value})}>
                        <option value="">Select Size</option>
                        {sizes?.map(s => <option key={s._id} value={s._id}>{s.label}</option>)}
                    </select>
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                    <label>Quantity</label>
                     <input type="number" className="form-control" value={newVariant.quantity} onChange={e => setNewVariant({...newVariant, quantity: parseInt(e.target.value)})} min="0" />
                </div>
                <button type="button" className="btn btn-secondary" onClick={addVariant}>Add Variant</button>
             </div>
          </div>

          <div style={{maxHeight: '200px', overflowY: 'auto'}}>
            <table style={{width: '100%', fontSize: '0.9em'}}>
                <thead>
                    <tr style={{textAlign:'left'}}><th>Color</th><th>Size</th><th>Qty</th><th>Action</th></tr>
                </thead>
                <tbody>
                    {formData.variants.map((varItem, idx) => (
                        <tr key={idx}>
                            <td>{colors?.find(c => c._id === varItem.colorId)?.name || '...'}</td>
                            <td>{sizes?.find(s => s._id === varItem.sizeId)?.label || '...'}</td>
                            <td>{varItem.quantity}</td>
                            <td><button type="button" onClick={() => removeVariant(idx)} style={{color:'red'}}>Remove</button></td>
                        </tr>
                    ))}
                    {formData.variants.length === 0 && <tr><td colSpan="4" style={{textAlign:'center'}}>No variants added yet.</td></tr>}
                </tbody>
            </table>
          </div>

          <div style={{marginTop: '20px'}}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingProduct ? 'Update' : 'Create'} Product
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
