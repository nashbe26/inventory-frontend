import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FaBarcode, FaCheck, FaUndo, FaBox, FaHistory } from 'react-icons/fa';
import api from '../services/api';

export default function ReturnScanner() {
  const [barcode, setBarcode] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch scan history from backend (filtered for returns if possible, otherwise all)
  const { data: historyData } = useQuery({
    queryKey: ['scan-history', historyPage],
    queryFn: async () => {
      const response = await api.get('/scan/history/all', {
        params: { limit: 50, skip: historyPage * 50 }
      });
      return response.data;
    },
    staleTime: 30000
  });

  // Load backend history on component mount
  useEffect(() => {
    if (historyData?.data) {
      // Transform backend data to match frontend format
      const transformedHistory = historyData.data
        .filter(record => record.actionType === 'return') // Filter for returns only
        .map(record => ({
        id: record._id,
        product: {
          name: record.productName,
          sku: record.sku,
          categoryName: record.categoryName,
          color: record.color,
          size: record.size,
          remainingQuantity: record.quantityAfter
        },
        timestamp: new Date(record.scannedAt),
        success: true,
        quantityBefore: record.quantityBefore,
        user: record.userId?.firstName + ' ' + record.userId?.lastName || 'Unknown'
      }));
      setScanHistory(transformedHistory);
    }
  }, [historyData]);

  const scanMutation = useMutation({
    mutationFn: async (barcodeValue) => {
      // CALL THE NEW RETURN ENDPOINT
      const response = await api.post('/scan/return', { barcode: barcodeValue });
      return response.data;
    },
    onSuccess: (data) => {
      setScannedProduct(data.data);
      toast.success(data.message, { autoClose: 2000 });
      
      // Refresh scan history from backend
      queryClient.invalidateQueries({ queryKey: ['scan-history'] });
      setHistoryPage(0); // Reset to first page
      
      // Invalidate queries to update inventory counts
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      
      // Clear input and refocus
      setBarcode('');
      inputRef.current?.focus();
      
      // Clear scanned product after 3 seconds
      setTimeout(() => setScannedProduct(null), 3000);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Scan failed';
      toast.error(message);
      
      setBarcode('');
      inputRef.current?.focus();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (barcode.trim()) {
      scanMutation.mutate(barcode.trim());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-indigo-800 flex items-center">
        <FaUndo className="mr-3" /> Return Scanner
      </h1>
      
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8 border border-indigo-100">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <FaBarcode className="mx-auto text-5xl mb-4 opacity-80" />
          <h2 className="text-xl font-medium mb-1">Scan Product to Return</h2>
          <p className="text-indigo-200 text-sm">Inventory will safely increase by 1</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Click here and scan barcode/SKU..."
                className="w-full pl-6 pr-12 py-4 text-xl border-2 border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                autoFocus
              />
              <button 
                type="submit"
                className="absolute right-3 top-3 p-2 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 transition-colors"
              >
                <FaUndo />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500 text-center">
              Scanner ready • Accepts Barcodes & SKUs • Auto-submit enabled
            </p>
          </form>

          {scannedProduct && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 animate-fade-in-up">
              <div className="flex items-start">
                <div className="bg-white p-3 rounded-full shadow-sm text-indigo-600 mr-4">
                  <FaCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{scannedProduct.product}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-white text-gray-700 px-3 py-1 rounded-full text-sm border border-gray-200">
                      Variant: <span className="font-semibold">{scannedProduct.color} / {scannedProduct.size}</span>
                    </span>
                    <span className="bg-white text-gray-700 px-3 py-1 rounded-full text-sm border border-gray-200">
                      SKU: <span className="font-mono font-medium">{scannedProduct.sku}</span>
                    </span>
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm border border-green-200">
                      In Stock: {scannedProduct.remainingQuantity}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
            <FaHistory className="mr-2" /> Recent Returns
        </h3>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {scanHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Variant</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scanHistory.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{scan.product.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{scan.product.sku}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {scan.product.color} - {scan.product.size}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {scan.timestamp.toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                           {scan.quantityBefore} → {scan.product.remainingQuantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
             <div className="p-8 text-center text-gray-500 bg-gray-50">
                No recent returns found.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
