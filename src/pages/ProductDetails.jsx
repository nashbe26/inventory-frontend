import { useState } from 'react';
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
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to adjust inventory');
    }
  });

  const handleAdjustment = (e) => {
    e.preventDefault();
    adjustMutation.mutate({
      productId: id,
      quantity: parseInt(adjustmentQuantity),
      type: adjustmentType,
      reason: adjustmentReason
    });
  };

  const downloadBarcode = () => {
    const url = productService.getBarcode(id);
    const link = document.createElement('a');
    link.href = url;
    link.download = `barcode-${product.sku}.png`;
    link.click();
    toast.success('Barcode downloaded');
  };

  const downloadDochette = () => {
    const url = productService.getDochette(id);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dochette-${product.sku}.pdf`;
    link.click();
    toast.success('Dochette downloaded');
  };

  const getStockStatus = () => {
    if (!product) return null;
    
    if (product.quantity === 0) {
      return { text: 'Out of Stock', className: 'badge-danger' };
    } else if (product.quantity <= product.lowStockThreshold) {
      return { text: 'Low Stock', className: 'badge-warning' };
    } else {
      return { text: 'In Stock', className: 'badge-success' };
    }
  };

  if (isLoading) return <div className="loading">Loading product details...</div>;
  if (!product) return <div>Product not found</div>;

  const stockStatus = getStockStatus();

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-secondary" onClick={() => navigate('/products')}>
          <FaArrowLeft /> Back to Products
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={downloadBarcode}>
            <FaBarcode /> Download Barcode
          </button>
          <button className="btn btn-primary" onClick={downloadDochette}>
            <FaDownload /> Download Dochette
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
              <strong>SKU:</strong>
              <p style={{ marginTop: '5px' }}><code>{product.sku}</code></p>
            </div>
            <div>
              <strong>Barcode:</strong>
              <p style={{ marginTop: '5px' }}><code>{product.barcode || 'Not generated'}</code></p>
            </div>
            <div>
              <strong>Description:</strong>
              <p style={{ marginTop: '5px' }}>{product.description || 'No description'}</p>
            </div>
          </div>
        </div>

        {/* Attributes */}
        <div className="card">
          <h2 style={{ marginBottom: '20px' }}>Attributes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <strong>Category:</strong>
              <p style={{ marginTop: '5px' }}>{product.categoryId?.name} ({product.categoryId?.code})</p>
            </div>
            <div>
              <strong>Color:</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  backgroundColor: product.colorId?.hexCode,
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)'
                }} />
                {product.colorId?.name}
              </div>
            </div>
            <div>
              <strong>Size:</strong>
              <p style={{ marginTop: '5px' }}>{product.sizeId?.label} ({product.sizeId?.value})</p>
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

        {/* Inventory */}
        <div className="card">
          <h2 style={{ marginBottom: '20px' }}>Inventory</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <strong>Current Quantity:</strong>
              <p style={{ marginTop: '5px', fontSize: '2rem', fontWeight: 'bold' }}>
                {product.quantity}
              </p>
            </div>
            <div>
              <strong>Stock Status:</strong>
              <p style={{ marginTop: '5px' }}>
                <span className={`badge ${stockStatus.className}`}>
                  {stockStatus.text}
                </span>
              </p>
            </div>
            <div>
              <strong>Low Stock Threshold:</strong>
              <p style={{ marginTop: '5px' }}>{product.lowStockThreshold}</p>
            </div>
            {product.price && (
              <div>
                <strong>Price:</strong>
                <p style={{ marginTop: '5px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  ${product.price.toFixed(2)}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                className="btn btn-success" 
                onClick={() => {
                  setAdjustmentType('increase');
                  setIsAdjustModalOpen(true);
                }}
                style={{ flex: 1 }}
              >
                <FaPlus /> Increase
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => {
                  setAdjustmentType('decrease');
                  setIsAdjustModalOpen(true);
                }}
                style={{ flex: 1 }}
              >
                <FaMinus /> Decrease
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Display */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h2 style={{ marginBottom: '20px' }}>Barcode Preview</h2>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <img 
            src={productService.getBarcode(id)} 
            alt="Product Barcode" 
            style={{ maxWidth: '400px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}
          />
        </div>
      </div>

      {/* Adjust Inventory Modal */}
      <Modal 
        isOpen={isAdjustModalOpen} 
        onClose={() => setIsAdjustModalOpen(false)} 
        title={`${adjustmentType === 'increase' ? 'Increase' : 'Decrease'} Inventory`}
      >
        <form onSubmit={handleAdjustment}>
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
            <label>Reason</label>
            <textarea
              className="form-control"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="e.g., Received shipment, Damaged goods, Sale, etc."
            />
          </div>
          <div style={{ 
            padding: '15px', 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '8px', 
            marginBottom: '20px' 
          }}>
            <p style={{ margin: 0 }}>
              Current Quantity: <strong>{product.quantity}</strong>
            </p>
            <p style={{ margin: '10px 0 0 0' }}>
              New Quantity: <strong>
                {adjustmentType === 'increase' 
                  ? product.quantity + parseInt(adjustmentQuantity || 0)
                  : product.quantity - parseInt(adjustmentQuantity || 0)
                }
              </strong>
            </p>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Confirm {adjustmentType === 'increase' ? 'Increase' : 'Decrease'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
