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
  const [selectedVariantsToPrint, setSelectedVariantsToPrint] = useState([]);

  // State for printing labels after update
  const [recentChanges, setRecentChanges] = useState(null);
  const [recentProduct, setRecentProduct] = useState(null);
  const [printCandidates, setPrintCandidates] = useState([]); 
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalMode, setPrintModalMode] = useState('changes'); // 'changes' | 'selection'

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await productService.getOne(id);
      return response.data.data;
    }
  });

  
  const adjustMutation = useMutation({
    mutationFn: inventoryService.adjust,
    onSuccess: (response) => {
      queryClient.invalidateQueries(['product', id]);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['inventory-stats']);
      toast.success('Inventory adjusted successfully');
      
      const changes = response.data.recentChanges;
      const updatedProduct = response.data.data;

      // Reset form
      setIsAdjustModalOpen(false);
      setAdjustmentQuantity(0);
      setAdjustmentReason('');
      setSelectedVariantId(null);

      // Handle Label Printing for Increase
      if (changes && changes.length > 0) {
          setRecentChanges(changes);
          setRecentProduct(updatedProduct);
          
          const candidates = changes.map(change => {
             const variant = updatedProduct.variants.find(v => v._id === change.variantId);
             if (!variant) return null;
             
             const totalQty = variant.quantity;
             const addedQty = change.quantity;
             const oldQty = Math.max(0, totalQty - addedQty);
             
             const colorName = variant.colorId?.name || '';
             const sizeLabel = variant.sizeId?.label || '';
             
             return {
                 variantId: change.variantId,
                 label: `${colorName} - ${sizeLabel}`,
                 oldQty,
                 addedQty,
                 totalQty,
                 printQty: addedQty 
             };
          }).filter(c => c !== null);

          setPrintCandidates(candidates);
          setPrintModalMode('changes');
          setIsPrintModalOpen(true);
      }
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

  const handlePrintChanges = async () => {
     try {
         const items = printCandidates
            .filter(c => c.printQty > 0)
            .map(c => ({ variantId: c.variantId, quantity: c.printQty }));

         if (items.length === 0) {
             toast.warning("No labels selected to print.");
             return;
         }

         const response = await productService.fetchCustomDochette(recentProduct._id, items);
         const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
         const link = document.createElement('a');
         link.href = url;
         link.download = `dochette-custom-${recentProduct.name.replace(/\s+/g, '-')}.pdf`;
         document.body.appendChild(link);
         link.click();
         link.remove();
         window.URL.revokeObjectURL(url);
         toast.success('Labels generated');
         
         setIsPrintModalOpen(false);
         setRecentChanges(null);
         setRecentProduct(null);
         setPrintCandidates([]);
     } catch (error) {
         console.error(error);
         toast.error('Failed to generate labels');
     }
  };

  const updatePrintQty = (variantId, newQty) => {
      setPrintCandidates(prev => prev.map(c => 
          c.variantId === variantId ? { ...c, printQty: parseInt(newQty) || 0 } : c
      ));
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

  const handleGenerateSelected = () => {
    if (selectedVariantsToPrint.length === 0) {
        toast.warning('No variants selected');
        return;
    }

    const candidates = selectedVariantsToPrint.map(id => {
        const v = product.variants.find(v => v._id === id);
        return {
            variantId: v._id,
            label: `${v.colorId?.name || ''} - ${v.sizeId?.label || ''}`,
            currentStock: v.quantity,
            printQty: v.quantity > 0 ? v.quantity : 1,
            addedQty: 0, // Placeholder
            oldQty: 0,   // Placeholder
            totalQty: v.quantity
        };
    });
    setPrintCandidates(candidates);
    setRecentProduct(product);
    setPrintModalMode('selection');
    setIsPrintModalOpen(true);
  };

  const toggleSelectVariant = (variantId) => {
      setSelectedVariantsToPrint(prev => {
          if (prev.includes(variantId)) {
              return prev.filter(id => id !== variantId);
          } else {
              return [...prev, variantId];
          }
      });
  };

  const toggleSelectAll = () => {
      if (selectedVariantsToPrint.length === product.variants.length) {
          setSelectedVariantsToPrint([]);
      } else {
          setSelectedVariantsToPrint(product.variants.map(v => v._id));
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
          {selectedVariantsToPrint.length > 0 && (
            <button className="btn btn-warning" onClick={handleGenerateSelected}>
                <FaBarcode /> Generate Selected ({selectedVariantsToPrint.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={downloadDochette}>
            <FaDownload /> Download All Labels
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
                        <th style={{width: '40px'}}>
                            <input 
                                type="checkbox" 
                                checked={product.variants?.length > 0 && selectedVariantsToPrint.length === product.variants.length}
                                onChange={toggleSelectAll}
                            />
                        </th>
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
                                 <input 
                                    type="checkbox"
                                    checked={selectedVariantsToPrint.includes(variant._id)}
                                    onChange={() => toggleSelectVariant(variant._id)}
                                 />
                             </td>
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

          {adjustmentType === 'increase' && product.fournisseurId && product.buyingPrice > 0 && (
             <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '4px', fontSize: '0.9rem', color: '#2e7d32' }}>
                <strong>Note:</strong> Increasing stock will generate a supplier expense.
                <div style={{ marginTop: '5px' }}>
                    Estimated cost: <strong>{(adjustmentQuantity * product.buyingPrice).toFixed(2)} TND</strong>
                </div>
             </div>
          )}

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

      {/* Print Changes Modal */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={printModalMode === 'changes' ? "Stock Updated - Generate Labels" : "Generate Custom Labels"}
      >
          <div style={{ textAlign: 'center' }}>
             {printModalMode === 'changes' ? (
                 <>
                    <p style={{marginBottom: '10px'}}>Successfully updated <strong>{recentProduct?.name}</strong>.</p>
                    <p style={{marginBottom: '20px', color: '#666'}}>The following stock changes were detected:</p>
                 </>
             ) : (
                 <p style={{marginBottom: '20px'}}>Set quantity of labels to print for selected variants:</p>
             )}
             
             <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px', textAlign: 'left' }}>
                 <table style={{ width: '100%', fontSize: '0.9rem' }}>
                     <thead>
                         <tr>
                             <th>Variant</th>
                             {printModalMode === 'changes' && (
                                <>
                                    <th style={{textAlign: 'center'}}>Old</th>
                                    <th style={{textAlign: 'center', color: 'green'}}>+Added</th>
                                    <th style={{textAlign: 'center'}}>Total</th>
                                </>
                             )}
                             {printModalMode === 'selection' && (
                                 <th style={{textAlign: 'center'}}>Current Stock</th>
                             )}
                             <th style={{width: '80px'}}>Print Qty</th>
                         </tr>
                     </thead>
                     <tbody>
                         {printCandidates.map(candidate => (
                             <tr key={candidate.variantId}>
                                 <td>{candidate.label}</td>
                                 {printModalMode === 'changes' && (
                                    <>
                                        <td style={{textAlign: 'center'}}>{candidate.oldQty}</td>
                                        <td style={{textAlign: 'center', color: 'green', fontWeight: 'bold'}}>+{candidate.addedQty}</td>
                                        <td style={{textAlign: 'center', fontWeight: 'bold'}}>{candidate.totalQty}</td>
                                    </>
                                 )}
                                 {printModalMode === 'selection' && (
                                     <td style={{textAlign: 'center'}}>{candidate.currentStock}</td>
                                 )}
                                 <td>
                                     <input 
                                        type="number" 
                                        className="form-control" 
                                        value={candidate.printQty} 
                                        onChange={(e) => updatePrintQty(candidate.variantId, e.target.value)}
                                        min="0"
                                        style={{ width: '70px', padding: '2px 5px' }}
                                     />
                                 </td>
                             </tr> 
                         ))}
                     </tbody>
                 </table>
             </div>

             <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                 <button className="btn btn-secondary" onClick={() => setIsPrintModalOpen(false)}>Close</button>
                 <button className="btn btn-primary" onClick={handlePrintChanges}>
                    <FaBarcode style={{marginRight: '5px'}}/> Print Selected ({printCandidates.reduce((acc, c) => acc + c.printQty, 0)})
                 </button>
             </div>
          </div>
      </Modal>
    </div>
  );
}
