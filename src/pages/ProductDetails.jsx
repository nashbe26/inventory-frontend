import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService, inventoryService } from '../services';
import { toast } from 'react-toastify';
import { 
  FaArrowLeft, 
  FaBarcode, 
  FaDownload, 
  FaPlus, 
  FaMinus,
  FaEdit 
} from 'react-icons/fa';
import Modal from '../components/Modal';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState('increase');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await productService.getOne(id);
      return response.data.data;
    }
  });

  
  const adjustMutation = useMutation({
    mutationFn: inventoryService.adjust,
    onSuccess: () => {
      queryClient.invalidateQueries(['product', id]);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['inventory-stats']);
      toast.success('Inventory adjusted successfully');
      setIsAdjustModalOpen(false);
      setAdjustmentQuantity(0);
      setAdjustmentReason('');
      setSelectedVariantId(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to adjust inventory');
    }
  });

  const handleAdjustment = (e) => {
    e.preventDefault();
    if (!selectedVariantId) {
        toast.error('Please select a variant to adjust');
        return;
    }
    adjustMutation.mutate({
      productId: id,
      variantId: selectedVariantId,
      quantity: parseInt(adjustmentQuantity),
      type: adjustmentType,
      reason: adjustmentReason
    });
  };

  const downloadDochette = async () => {
    try {
      const response = await productService.fetchDochette(id);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `dochette-${product.name.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Dochette downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download dochette');
    }
  };

  const getStockStatus = (qty, threshold) => {
    if (qty === 0) {
      return { text: 'Out of Stock', className: 'badge-danger' };
    } else if (qty <= threshold) {
      return { text: 'Low Stock', className: 'badge-warning' };
    } else {
      return { text: 'In Stock', className: 'badge-success' };
    }
  };

  if (isLoading) return <div className="loading">Loading product details...</div>;
  if (!product) return <div>Product not found</div>;

  const totalStockStatus = getStockStatus(product.totalQuantity, product.lowStockThreshold);

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-secondary" onClick={() => navigate('/products')}>
          <FaArrowLeft /> Back to Products
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={downloadDochette}>
            <FaDownload /> Download Labels
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Product Information */}
        <div className="card">
          <h2 style={{ marginBottom: '20px' }}>Product Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <strong>Name:</strong>
              <p style={{ marginTop: '5px', fontSize: '1.2rem' }}>{product.name}</p>
            </div>
            <div>
              <strong>Description:</strong>
              <p style={{ marginTop: '5px' }}>{product.description || 'No description'}</p>
            </div>
            <div>
              <strong>Category:</strong>
              <p style={{ marginTop: '5px' }}>{product.categoryId?.name} ({product.categoryId?.code})</p>
            </div>
            <div>
              <strong>Rayon:</strong>
              <p style={{ marginTop: '5px' }}>{product.rayonId?.name} ({product.rayonId?.code})</p>
              {product.rayonId?.location && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Location: {product.rayonId.location}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="card">
          <h2 style={{ marginBottom: '20px' }}>Inventory Summary</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div>
              <strong>Total Price:</strong>
              <p style={{ marginTop: '5px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                {product.price.toFixed(2)} TND
              </p>
            </div>
            <div>
              <strong>Total Quantity:</strong>
              <p style={{ marginTop: '5px', fontSize: '2rem', fontWeight: 'bold' }}>
                {product.totalQuantity}
              </p>
            </div>
            <div>
              <strong>Stock Status:</strong>
              <p style={{ marginTop: '5px' }}>
                <span className={`badge ${totalStockStatus.className}`}>
                  {totalStockStatus.text}
                </span>
              </p>
            </div>
            <div>
              <strong>Low Stock Threshold:</strong>
              <p style={{ marginTop: '5px' }}>{product.lowStockThreshold}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Variants Table */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h2 style={{ marginBottom: '20px' }}>Variants</h2>
        <div className="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Color</th>
                        <th>Size</th>
                        <th>SKU</th>
                        <th>Barcode</th>
                        <th>Stock</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {product.variants?.map(variant => (
                        <tr key={variant._id}>
                             <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                    width: '20px',
                                    height: '20px',
                                    backgroundColor: variant.colorId?.hexCode,
                                    borderRadius: '50%',
                                    border: '1px solid var(--border-color)'
                                    }} />
                                    {variant.colorId?.name}
                                </div>
                             </td>
                             <td>{variant.sizeId?.label}</td>
                             <td><code>{variant.sku}</code></td>
                             <td><code>{variant.barcode || '-'}</code></td>
                             <td>
                                <strong>{variant.quantity}</strong>
                             </td>
                             <td>
                                <button className="btn btn-sm btn-success" style={{ marginRight: '5px' }} onClick={() => {
                                    setAdjustmentType('increase');
                                    setSelectedVariantId(variant._id);
                                    setIsAdjustModalOpen(true);
                                }}>+</button>
                                <button className="btn btn-sm btn-danger" onClick={() => {
                                    setAdjustmentType('decrease');
                                    setSelectedVariantId(variant._id);
                                    setIsAdjustModalOpen(true);
                                }}>-</button>
                             </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Adjust Inventory Modal */}
      <Modal 
        isOpen={isAdjustModalOpen} 
        onClose={() => setIsAdjustModalOpen(false)} 
        title={`${adjustmentType === 'increase' ? 'Increase' : 'Decrease'} Inventory`}
      >
        <form onSubmit={handleAdjustment}>
           <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <strong>Selected Variant:</strong><br/>
                {(() => {
                    const v = product.variants?.find(v => v._id === selectedVariantId);
                    return v ? `${v.colorId?.name} - ${v.sizeId?.label}` : 'None';
                })()}
           </div>

          <div className="form-group">
            <label>Quantity *</label>
            <input
              type="number"
              className="form-control"
              value={adjustmentQuantity}
              onChange={(e) => setAdjustmentQuantity(e.target.value)}
              min="1"
              required
            />
          </div>
          <div className="form-group">
            <label>Reason (Optional)</label>
            <textarea
              className="form-control"
              rows="3"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="e.g., Stock received, Damaged, Correction..."
            />
          </div>
          <button 
            type="submit" 
            className={`btn btn-${adjustmentType === 'increase' ? 'success' : 'danger'}`}
            style={{ width: '100%' }}
            disabled={adjustMutation.isPending}
          >
            {adjustMutation.isPending ? 'Saving...' : `Confirm ${adjustmentType === 'increase' ? 'Increase' : 'Decrease'}`}
          </button>
        </form>
      </Modal>
    </div>
  );
}
