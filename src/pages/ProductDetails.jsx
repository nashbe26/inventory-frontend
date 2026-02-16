import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService, inventoryService } from '../services';
import { toast } from 'react-toastify';
import { 
  FaArrowLeft, 
  FaBarcode, 
  FaEdit, 
  FaBoxOpen,
  FaTag,
  FaRulerCombined,
  FaWarehouse,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaCheckCircle,
  FaPlus,
  FaMinus,
  FaPrint
} from 'react-icons/fa';
import Modal from '../components/Modal';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State for Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState('increase'); // 'increase' | 'decrease'
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  // State for Print Modal
  const [selectedVariantsToPrint, setSelectedVariantsToPrint] = useState([]);
  const [printCandidates, setPrintCandidates] = useState([]); 
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalMode, setPrintModalMode] = useState('selection'); // 'changes' | 'selection'
  
  // State for 'Recent Changes' (after adjustment)
  const [recentChanges, setRecentChanges] = useState(null);
  const [recentProduct, setRecentProduct] = useState(null);

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

      setIsAdjustModalOpen(false);
      setAdjustmentQuantity(0);
      setAdjustmentReason('');
      setSelectedVariantId(null);

      if (changes && changes.length > 0 && adjustmentType === 'increase') {
          setRecentChanges(changes);
          setRecentProduct(updatedProduct);
          
          const candidates = changes.map(change => {
             const variant = updatedProduct.variants.find(v => v._id === change.variantId);
             if (!variant) return null;
             
             const totalQty = variant.quantity;
             const addedQty = change.quantity;
             const oldQty = Math.max(0, totalQty - addedQty);
             
             return {
                 variantId: change.variantId,
                 label: `${variant.colorId?.name || ''} - ${variant.sizeId?.label || ''}`,
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

  const openAdjustmentModal = (variantId, type) => {
      setSelectedVariantId(variantId);
      setAdjustmentType(type);
      setAdjustmentQuantity(1); // Default to 1
      setIsAdjustModalOpen(true);
  };

  const handleAdjustment = (e) => {
    e.preventDefault();
    if (!selectedVariantId) return;
    
    // Validate quantity
    const qty = parseInt(adjustmentQuantity);
    if (!qty || qty <= 0) {
        toast.error('Please enter a valid quantity');
        return;
    }

    adjustMutation.mutate({
      productId: id,
      variantId: selectedVariantId,
      quantity: qty,
      type: adjustmentType,
      reason: adjustmentReason
    });
  };

  const handleGenerateSelected = () => {
    if (selectedVariantsToPrint.length === 0) {
        toast.warning('No variants selected');
        return;
    }

    const candidates = selectedVariantsToPrint.map(vId => {
        const v = product.variants.find(item => item._id === vId);
        if (!v) return null;
        return {
            variantId: v._id,
            label: `${v.colorId?.name || ''} - ${v.sizeId?.label || ''}`,
            currentStock: v.quantity,
            printQty: v.quantity > 0 ? v.quantity : 1,
            addedQty: 0, 
            oldQty: 0,
            totalQty: v.quantity
        };
    }).filter(item => item !== null);

    setPrintCandidates(candidates);
    setRecentProduct(product);
    setPrintModalMode('selection');
    setIsPrintModalOpen(true);
  };

  const handlePrintChanges = async () => {
     try {
         const items = printCandidates
            .filter(c => c.printQty > 0)
            .map(c => ({ variantId: c.variantId, quantity: parseInt(c.printQty) }));

         if (items.length === 0) {
             toast.warning("No labels selected.");
             return;
         }

         // Use the product from state (either current or recently updated)
         const targetProduct = recentProduct || product;

         const response = await productService.fetchCustomDochette(targetProduct._id, items);
         const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
         const link = document.createElement('a');
         link.href = url;
         link.download = `labels-${targetProduct.name.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
         document.body.appendChild(link);
         link.click();
         link.remove();
         window.URL.revokeObjectURL(url);
         toast.success('Labels generated');
         
         setIsPrintModalOpen(false);
         setRecentChanges(null);
         setRecentProduct(null);
         setPrintCandidates([]);
         setSelectedVariantsToPrint([]); // Clear selection after print
     } catch (error) {
         console.error(error);
         toast.error('Failed to generate labels');
     }
  };

  const updatePrintCandidateQty = (variantId, newQty) => {
      setPrintCandidates(prev => prev.map(c => 
          c.variantId === variantId ? { ...c, printQty: parseInt(newQty) || 0 } : c
      ));
  };

  const toggleSelectVariant = (variantId) => {
      setSelectedVariantsToPrint(prev => {
          if (prev.includes(variantId)) return prev.filter(id => id !== variantId);
          return [...prev, variantId];
      });
  };

  const toggleSelectAll = () => {
      if (!product?.variants) return;
      if (selectedVariantsToPrint.length === product.variants.length) {
          setSelectedVariantsToPrint([]);
      } else {
          setSelectedVariantsToPrint(product.variants.map(v => v._id));
      }
  };

  const getStockStatus = (qty, threshold) => {
    if (qty === 0) return { text: 'Out of Stock', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: FaExclamationTriangle };
    if (qty <= threshold) return { text: 'Low Stock', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: FaExclamationTriangle };
    return { text: 'In Stock', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: FaCheckCircle };
  };

  if (isLoading) return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
  );
  
  if (!product) return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
          <div className="text-red-500 text-xl font-semibold mb-4">Product not found</div>
          <button onClick={() => navigate('/products')} className="text-indigo-600 hover:text-indigo-800 underline">Back to Products</button>
      </div>
  );

  const totalStatus = getStockStatus(product.totalQuantity, product.lowStockThreshold || 5);
  const StatusIcon = totalStatus.icon;

  // Sorting variants: Color Ascending -> Size Order Descending (Highest to Lowest)
  const sortedVariants = product?.variants ? [...product.variants].sort((a, b) => {
      const colorA = a.colorId?.name || '';
      const colorB = b.colorId?.name || '';
      const colorCompare = colorA.localeCompare(colorB);
      if (colorCompare !== 0) return colorCompare;

      const sizeOrderA = a.sizeId?.order ?? 0;
      const sizeOrderB = b.sizeId?.order ?? 0;
      return sizeOrderB - sizeOrderA;
  }) : [];

  return (
    <div className="bg-gray-50 min-h-screen pb-12 font-sans">
      {/* Header Section */}
      <div className="bg-white shadow border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {/* Title & Badge */}
                <div>
                     <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/products')} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <FaArrowLeft className="h-5 w-5" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{product.name}</h1>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${totalStatus.bg} ${totalStatus.color} ${totalStatus.border}`}>
                            <StatusIcon className="mr-1.5 h-3 w-3" /> {totalStatus.text}
                        </span>
                     </div>
                     <div className="mt-1 flex items-center text-sm text-gray-500 ml-8">
                        <span className="font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded mr-3 border border-gray-200">SKU: {product.sku}</span>
                        <span>Added on {new Date(product.createdAt).toLocaleDateString()}</span>
                     </div>
                </div>

                {/* Main Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                     <Link 
                        to={`/products/edit/${id}`}
                        className="flex-1 md:flex-none justify-center items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                     >
                        <FaEdit className="mr-2 text-gray-500" /> Edit
                     </Link>
                     <button 
                        onClick={() => navigate(`/scanner?sku=${product.sku}`)}
                        className="flex-1 md:flex-none justify-center items-center px-4 py-2 border border-blue-300 rounded-lg shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                     >
                        <FaBarcode className="mr-2" /> Scan Mode
                     </button>
                </div>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                    <FaBoxOpen className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">Total Stock</p>
                    <p className="text-2xl font-bold text-gray-900">{product.totalQuantity}</p>
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                    <FaMoneyBillWave className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">Stock Value</p>
                    <p className="text-2xl font-bold text-gray-900">{(product.price * product.totalQuantity).toFixed(2)} <span className="text-sm font-normal text-gray-500">TND</span></p>
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                    <FaTag className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">Selling Price</p>
                    <p className="text-2xl font-bold text-gray-900">{product.price?.toFixed(2)} <span className="text-sm font-normal text-gray-500">TND</span></p>
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg">
                    <FaWarehouse className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">Location</p>
                    <p className="text-lg font-bold text-gray-900 truncate max-w-[150px]" title={product.rayonId?.name}>{product.rayonId?.name || 'Unassigned'}</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Product Information */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Information</h3>
                    </div>
                    <div className="px-6 py-4 space-y-4">
                        <div className="flex justify-between py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Category</span>
                            <span className="text-sm font-medium text-gray-900">{product.categoryId?.name}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Supplier</span>
                            <span className="text-sm font-medium text-gray-900 text-right">{product.fournisseurId?.name || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Material</span>
                            <span className="text-sm font-medium text-gray-900">{product.materialId?.name || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Buying Price</span>
                            <span className="text-sm font-medium text-gray-900">
                                {product.buyingPrice ? `${product.buyingPrice.toFixed(2)} TND` : '-'}
                            </span>
                        </div>
                        <div className="pt-2">
                             <span className="text-xs font-semibold text-gray-400 uppercase">Description</span>
                             <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                                {product.description || 'No description provided.'}
                             </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Variants Table */}
            <div className="lg:col-span-2">
                 <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Variants Inventory</h3>
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{product.variants?.length}</span>
                        </div>
                        <div>
                             {selectedVariantsToPrint.length > 0 && (
                                <button
                                    onClick={handleGenerateSelected}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none shadow-sm transition-colors"
                                >
                                    <FaPrint className="mr-1.5" /> Print Selected ({selectedVariantsToPrint.length})
                                </button>
                             )}
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left w-10">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                            checked={product.variants?.length > 0 && selectedVariantsToPrint.length === product.variants.length}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Color / Size
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Barcodes
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Stock Level
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Adjust
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sortedVariants.map((variant) => (
                                    <tr key={variant._id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                                checked={selectedVariantsToPrint.includes(variant._id)}
                                                onChange={() => toggleSelectVariant(variant._id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <div className="flex items-center mb-1">
                                                    <span 
                                                        className="h-3 w-3 rounded-full border border-gray-300 mr-2 shadow-sm"
                                                        style={{ backgroundColor: variant.colorId?.hexCode || '#ccc' }}
                                                    ></span>
                                                    <span className="text-sm font-semibold text-gray-900">{variant.colorId?.name}</span>
                                                </div>
                                                <div className="flex items-center text-xs text-gray-500 ml-5">
                                                    <FaRulerCombined className="mr-1.5 h-3 w-3 text-gray-400" />
                                                    Size: <span className="font-medium text-gray-700 ml-1">{variant.sizeId?.label}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <div className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded w-fit mb-1 border border-gray-200">
                                                    {variant.barcode || 'NO BARCODE'}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono tracking-tight">
                                                    SKU: {variant.sku || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                variant.quantity === 0 ? 'bg-red-50 text-red-700 border-red-100' : 
                                                variant.quantity <= 5 ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                                                'bg-green-50 text-green-700 border-green-100'
                                            }`}>
                                                {variant.quantity} Units
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openAdjustmentModal(variant._id, 'increase')}
                                                    className="text-green-600 hover:text-green-800 p-1.5 border border-green-200 rounded-md hover:bg-green-50 transition-colors btn-sm"
                                                    title="Add Stock"
                                                >
                                                    <FaPlus className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() => openAdjustmentModal(variant._id, 'decrease')}
                                                    className="text-red-600 hover:text-red-800 p-1.5 border border-red-200 rounded-md hover:bg-red-50 transition-colors btn-sm"
                                                    title="Reduce Stock"
                                                >
                                                    <FaMinus className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!product.variants || product.variants.length === 0) && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500 italic">
                                            <div className="flex flex-col items-center justify-center">
                                                <FaBoxOpen className="h-8 w-8 text-gray-300 mb-2"/>
                                                No variants found. Add variants by editing the product.
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

      </div>

      {/* Adjustment Modal Styled */}
      <Modal 
        isOpen={isAdjustModalOpen} 
        onClose={() => setIsAdjustModalOpen(false)} 
        title={`${adjustmentType === 'increase' ? 'Stock In' : 'Stock Out'} Adjustment`}
      >
         <form onSubmit={handleAdjustment} className="px-1 py-1">
             <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-5 text-sm">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Selected Variant</p>
                {(() => {
                    const v = product?.variants?.find(v => v._id === selectedVariantId);
                    return v ? (
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 text-base">{v.colorId?.name} - {v.sizeId?.label}</span>
                            <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-xs text-gray-600">Current: {v.quantity}</span>
                        </div>
                    ) : (
                        <span className="text-gray-400 italic">None selected</span>
                    );
                })()}
             </div>

             <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                     Quantity to {adjustmentType === 'increase' ? 'Add' : 'Remove'}
                 </label>
                 <div className="relative rounded-md shadow-sm">
                    <input 
                        type="number"
                        min="1"
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-4 pr-12 sm:text-sm border-gray-300 rounded-md py-2"
                        value={adjustmentQuantity}
                        onChange={(e) => setAdjustmentQuantity(e.target.value)}
                        required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">Units</span>
                    </div>
                 </div>
             </div>

             <div className="mb-5">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Note</label>
                 <textarea
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3"
                    rows="2"
                    placeholder="Briefly explain the adjustment..."
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                 />
             </div>

             {adjustmentType === 'increase' && product?.fournisseurId && (
                 <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                     <div className="flex">
                         <div className="flex-shrink-0">
                             <FaMoneyBillWave className="h-5 w-5 text-blue-400" aria-hidden="true" />
                         </div>
                         <div className="ml-3">
                             <h3 className="text-sm font-medium text-blue-800">Financial Impact</h3>
                             <div className="mt-2 text-sm text-blue-700">
                                 <p>An expense record will be created for <strong>{product.fournisseurId.name}</strong>.</p>
                                 <p className="mt-1">Estimated Cost: <span className="font-bold">{(adjustmentQuantity * (product.buyingPrice || 0)).toFixed(2)} TND</span></p>
                             </div>
                         </div>
                     </div>
                 </div>
             )}

             <div className="flex justify-end gap-3 pt-2">
                 <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(false)}
                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md shadow-sm text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                 >
                     Cancel
                 </button>
                 <button
                    type="submit"
                    disabled={adjustMutation.isPending}
                    className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        adjustmentType === 'increase' 
                            ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                            : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    }`}
                 >
                     {adjustMutation.isPending ? 'Processing...' : 'Confirm'}
                 </button>
             </div>
         </form>
      </Modal>

      {/* Print Modal Styled */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={printModalMode === 'changes' ? "Changes Saved - Print Labels?" : "Print Labels Selection"}
      >
        <div className="p-1">
            {printModalMode === 'changes' ? (
                <div className="mb-4 bg-green-50 p-4 rounded-lg border border-green-100 flex items-start">
                    <FaCheckCircle className="h-5 w-5 text-green-400 mt-0.5 mr-3 flex-shrink-0"/>
                    <div className="text-sm text-green-800">
                        <p className="font-medium">Stock successfully updated!</p>
                        <p className="mt-1">Do you want to print labels for the newly added items?</p>
                    </div>
                </div>
            ) : (
                <p className="mb-4 text-sm text-gray-500">Review and adjust the quantity of labels to print for each variant.</p>
            )}

            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg mb-5 bg-white shadow-inner">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-500 first:rounded-tl-lg">Variant</th>
                            {printModalMode === 'changes' ? (
                                <>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Added</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Total</th>
                                </>
                            ) : (
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Current Stock</th>
                            )}
                            <th className="px-4 py-2 w-24 text-center font-medium text-gray-500 last:rounded-tr-lg">Print Qty</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {printCandidates.map(candidate => (
                            <tr key={candidate.variantId}>
                                <td className="px-4 py-2 text-gray-900 font-medium">{candidate.label}</td>
                                {printModalMode === 'changes' ? (
                                    <>
                                        <td className="px-4 py-2 text-center text-green-600 font-bold">+{candidate.addedQty}</td>
                                        <td className="px-4 py-2 text-center text-gray-600">{candidate.totalQty}</td>
                                    </>
                                ) : (
                                    <td className="px-4 py-2 text-center text-gray-600">{candidate.currentStock}</td>
                                )}
                                <td className="px-4 py-2 text-center">
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-16 p-1 border border-gray-300 rounded text-center text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        value={candidate.printQty}
                                        onChange={(e) => updatePrintCandidateQty(candidate.variantId, e.target.value)}
                                        onClick={(e) => e.target.select()}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button 
                    onClick={() => setIsPrintModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {printModalMode === 'changes' ? 'Skip Printing' : 'Cancel'}
                </button>
                <button 
                    onClick={handlePrintChanges}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
                >
                    <FaBarcode className="mr-2 h-4 w-4" /> 
                    Print {printCandidates.reduce((a,c) => a + (parseInt(c.printQty)||0), 0)} Labels
                </button>
            </div>
        </div>
      </Modal>
    </div>
  );
}
