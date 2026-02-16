import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService, categoryService, rayonService, fournisseurService, materialService, colorService, sizeService } from '../services';
import { toast } from 'react-toastify';
import { FaSave, FaArrowLeft, FaPlus, FaTrash, FaBarcode } from 'react-icons/fa';
import Modal from '../components/Modal';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    rayonId: '',
    fournisseurId: '',
    materialId: '',
    price: '',
    buyingPrice: '',
    description: '',
    lowStockThreshold: 10,
    variants: []
  });

  const [variantColor, setVariantColor] = useState('');
  const [variantQuantities, setVariantQuantities] = useState({}); // { sizeId: quantity }

  // Print Modal State
  const [recentChanges, setRecentChanges] = useState(null);
  const [recentProduct, setRecentProduct] = useState(null);
  const [printCandidates, setPrintCandidates] = useState([]); 
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Fetch dropdown data
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: async () => (await categoryService.getAll()).data.data });
  const { data: fournisseurs } = useQuery({ queryKey: ['fournisseurs'], queryFn: async () => (await fournisseurService.getAll()).data.data });
  const { data: rayons } = useQuery({ queryKey: ['rayons'], queryFn: async () => (await rayonService.getAll()).data.data });
  const { data: materials } = useQuery({ queryKey: ['materials'], queryFn: async () => (await materialService.getAll()).data.data });
  const { data: colors } = useQuery({ queryKey: ['colors'], queryFn: async () => (await colorService.getAll()).data.data });
  const { data: sizes } = useQuery({ queryKey: ['sizes'], queryFn: async () => (await sizeService.getAll()).data.data });

  // Fetch product data if editing
  useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await productService.getById(id);
      return response.data;
    },
    enabled: isEditing,
    onSuccess: (data) => {
      setFormData({
        name: data.name,
        categoryId: data.categoryId?._id || '',
        rayonId: data.rayonId?._id || '',
        price: data.price || '',
        buyingPrice: data.buyingPrice || '',
        description: data.description || '',
        lowStockThreshold: data.lowStockThreshold || 10,
        fournisseurId: data.fournisseurId?._id || '',
        materialId: data.materialId?._id || '',
        variants: data.variants.map(v => ({
             colorId: v.colorId?._id || v.colorId,
             sizeId: v.sizeId?._id || v.sizeId,
             quantity: v.quantity,
             sku: v.sku,
             barcode: v.barcode,
             _id: v._id
        }))
      });
    }
  });

  const mutation = useMutation({
    mutationFn: (data) => isEditing ? productService.update(id, data) : productService.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['products']);
      toast.success(`Product ${isEditing ? 'updated' : 'created'} successfully`);
      
      // Check for print candidates
      const changes = response.data.recentChanges;
      const product = response.data.data;
      
      if (changes && changes.length > 0) {
          setRecentChanges(changes);
          setRecentProduct(product);
          
          const candidates = changes.map(change => {
             const variant = product.variants.find(v => v._id === change.variantId);
             if (!variant) return null;
             
             const totalQty = variant.quantity;
             const addedQty = change.quantity;
             const oldQty = Math.max(0, totalQty - addedQty);
             
             const colorName = variant.colorId?.name || (colors?.find(c => c._id === variant.colorId)?.name) || '';
             const sizeLabel = variant.sizeId?.label || (sizes?.find(s => s._id === variant.sizeId)?.label) || '';
             
             return {
                 variantId: change.variantId,
                 label: `${colorName} - ${sizeLabel}`,
                 oldQty,
                 addedQty,
                 totalQty,
                 printQty: addedQty // Default to added quantity
             };
          }).filter(c => c !== null);

          if (candidates.length > 0) {
            setPrintCandidates(candidates);
            setIsPrintModalOpen(true);
            // Don't navigate away yet if we have labels to print
            return;
          }
      }
      
      navigate('/products');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to save product');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
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
         navigate('/products'); // Navigate away after printing
     } catch (error) {
         console.error(error);
         toast.error('Failed to generate labels');
     }
  };
  
  const closePrintModal = () => {
      setIsPrintModalOpen(false);
      navigate('/products'); // User chose not to print or finished
  };

  const updatePrintQty = (variantId, newQty) => {
      setPrintCandidates(prev => prev.map(c => 
          c.variantId === variantId ? { ...c, printQty: parseInt(newQty) || 0 } : c
      ));
  };

  const handleAddVariants = () => {
    if (!variantColor) {
      toast.error("Color is required");
      return;
    }

    const variantsToAdd = [];
    Object.entries(variantQuantities).forEach(([sizeId, qty]) => {
      if (qty > 0) {
        // Check if already exists
        const exists = formData.variants.some(v => v.colorId === variantColor && v.sizeId === sizeId);
        if (!exists) {
            variantsToAdd.push({
                colorId: variantColor,
                sizeId: sizeId,
                quantity: qty,
                // Generate temporary unique ID for key if needed, or backend will handle
            });
        }
      }
    });

    if (variantsToAdd.length === 0) {
        toast.warning("Please enter quantity for at least one size");
        return;
    }

    setFormData({
        ...formData,
        variants: [...formData.variants, ...variantsToAdd]
    });
    
    // Reset
    setVariantQuantities({});
    setVariantColor('');
  };

  const setAllQuantities = (qty) => {
      const newQuantities = {};
      sizes?.forEach(s => {
          newQuantities[s._id] = qty;
      });
      setVariantQuantities(newQuantities);
  };

  const removeVariant = (index) => {
    const newVariants = [...formData.variants];
    newVariants.splice(index, 1);
    setFormData({ ...formData, variants: newVariants });
  };

  const updateVariantQuantity = (index, qty) => {
      const newVariants = [...formData.variants];
      newVariants[index].quantity = qty;
      setFormData({ ...formData, variants: newVariants });
  };

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('/products')} className="mr-4 text-gray-600 hover:text-gray-900">
          <FaArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">{isEditing ? 'Edit Product' : 'Add New Product'}</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Category</option>
                {categories?.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rayon</label>
              <select
                value={formData.rayonId}
                onChange={(e) => setFormData({ ...formData, rayonId: e.target.value })}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Rayon</option>
                {rayons?.map(r => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fournisseur</label>
              <select
                value={formData.fournisseurId}
                onChange={(e) => setFormData({ ...formData, fournisseurId: e.target.value })}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Fournisseur</option>
                {fournisseurs?.map(f => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>

             <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Material</label>
              <select
                value={formData.materialId}
                onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Material</option>
                {materials?.map(m => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Selling Price</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                required
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buying Price</label>
              <input
                type="number"
                value={formData.buyingPrice}
                onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
            </div>
            
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Low Stock Threshold</label>
              <input
                type="number"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500 h-24"
            />
          </div>

          {/* Variants Section - Improved UX */}
          <div className="border-t pt-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Product Variants</h3>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Add Variants by Color</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Color</label>
                        <select
                            value={variantColor}
                            onChange={(e) => setVariantColor(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">-- Choose a Color --</option>
                            {colors?.map(c => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    {variantColor && (
                        <div className="flex items-end pb-1">
                             <button
                                type="button"
                                onClick={() => setAllQuantities(0)}
                                className="text-sm text-gray-500 hover:text-gray-700 underline mr-4"
                            >
                                Reset All
                            </button>
                             {/* Helper to set all to 1 or 10 could go here */}
                        </div>
                    )}
                </div>

                {variantColor && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Enter Quantities for Sizes</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {sizes?.map(size => {
                                const currentQty = variantQuantities[size._id] || '';
                                return (
                                    <div key={size._id} className="bg-white p-2 border rounded flex flex-col items-center">
                                        <span className="text-xs font-semibold text-gray-600 mb-1 uppercase">{size.label}</span>
                                        <input
                                            type="number"
                                            value={currentQty}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setVariantQuantities(prev => ({
                                                    ...prev,
                                                    [size._id]: isNaN(val) ? 0 : val
                                                }));
                                            }}
                                            className="w-full p-1 border rounded text-center text-sm"
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={handleAddVariants}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center"
                            >
                                <FaPlus className="mr-2" /> Add Selection
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {formData.variants.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {formData.variants.map((variant, index) => (
                                <tr key={index}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {colors?.find(c => c._id === variant.colorId)?.name || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {sizes?.find(s => s._id === variant.sizeId)?.label || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                        <input 
                                            type="number" 
                                            value={variant.quantity} 
                                            onChange={(e) => updateVariantQuantity(index, parseInt(e.target.value) || 0)}
                                            className="w-20 p-1 border rounded text-sm text-center"
                                            min="0"
                                        />
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                        {variant.barcode ? (
                                            <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                                                {variant.barcode}
                                            </span>
                                        ) : (
                                            <span className="text-xs italic text-gray-400">Auto-generated</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                        <button
                                            type="button"
                                            onClick={() => removeVariant(index)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">
                    No variants added to this product yet.
                </div>
            )}
          </div>

          <div className="flex justify-end pt-6 border-t">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="px-4 py-2 border rounded text-gray-700 bg-white hover:bg-gray-50 mr-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            >
              {mutation.isPending ? 'Saving...' : <><FaSave className="mr-2" /> Save Product</>}
            </button>
          </div>
        </form>
      </div>

      {/* Print Changes Modal */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={closePrintModal}
        title="Generate Custom Labels"
      >
          <div style={{ textAlign: 'center' }}>
             <p style={{marginBottom: '10px'}}>Successfully updated <strong>{recentProduct?.name}</strong>.</p>
             <p style={{marginBottom: '20px', color: '#666'}}>The following stock changes were detected:</p>
             
             <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px', textAlign: 'left' }}>
                 <table style={{ width: '100%', fontSize: '0.9rem' }}>
                     <thead>
                         <tr>
                             <th>Variant</th>
                             <th style={{textAlign: 'center'}}>Old</th>
                             <th style={{textAlign: 'center', color: 'green'}}>+Added</th>
                             <th style={{textAlign: 'center'}}>Total</th>
                             <th style={{width: '80px'}}>Print Qty</th>
                         </tr>
                     </thead>
                     <tbody>
                         {printCandidates.map(candidate => (
                             <tr key={candidate.variantId}>
                                 <td>{candidate.label}</td>
                                 <td style={{textAlign: 'center'}}>{candidate.oldQty}</td>
                                 <td style={{textAlign: 'center', color: 'green', fontWeight: 'bold'}}>+{candidate.addedQty}</td>
                                 <td style={{textAlign: 'center', fontWeight: 'bold'}}>{candidate.totalQty}</td>
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
                 <button className="btn btn-secondary" onClick={closePrintModal}>Close</button>
                 <button className="btn btn-primary" onClick={handlePrintChanges}>
                    <FaBarcode style={{marginRight: '5px'}}/> Print Selected ({printCandidates.reduce((acc, c) => acc + c.printQty, 0)})
                 </button>
             </div>
          </div>
      </Modal>
    </div>
  );
}
