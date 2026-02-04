import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FaBarcode, FaCheck, FaTimes, FaBox, FaHistory } from 'react-icons/fa';
import api from '../services/api';

export default function BarcodeScanner() {
  const [barcode, setBarcode] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch scan history from backend
  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
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
      const transformedHistory = historyData.data.map(record => ({
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
        user: record.userId?.firstName + ' ' + record.userId?.lastName
      }));
      setScanHistory(transformedHistory);
    }
  }, [historyData]);

  const scanMutation = useMutation({
    mutationFn: async (barcodeValue) => {
      const response = await api.post('/scan', { barcode: barcodeValue });
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
    // Auto-submit when Enter is pressed (barcode scanners send Enter)
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const getStockBadge = (quantity, threshold) => {
    if (quantity === 0) {
      return <span className="badge badge-danger">Out of Stock</span>;
    } else if (quantity <= (threshold || 10)) {
      return <span className="badge badge-warning">Low Stock</span>;
    } else {
      return <span className="badge badge-success">In Stock</span>;
    }
  };

  const loadMoreHistory = () => {
    setHistoryPage(prev => prev + 1);
  };

  return (
    <div>
      <div className="page-header">
        <h1><FaBarcode /> Barcode Scanner</h1>
      </div>

      {/* Scanner Input */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Scan Product</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Barcode</label>
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Scan barcode or enter manually..."
              autoFocus
              style={{ 
                fontSize: '1.2rem', 
                padding: '15px',
                border: '2px solid #3498db'
              }}
            />
            <small>Focus this field and scan with your barcode scanner, or type manually and press Enter</small>
          </div>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={!barcode.trim() || scanMutation.isPending}
          >
            <FaBarcode /> {scanMutation.isPending ? 'Scanning...' : 'Scan'}
          </button>
        </form>
      </div>

      {/* Scanned Product Display */}
      {scannedProduct && (
        <div className="card" style={{ 
          marginBottom: '20px', 
          backgroundColor: '#d4edda',
          border: '2px solid #28a745'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <FaCheck style={{ color: '#28a745', fontSize: '2rem' }} />
            <h2 style={{ margin: 0, color: '#155724' }}>Scanned Successfully!</h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <strong>Product:</strong><br />
              {scannedProduct.name}
            </div>
            <div>
              <strong>SKU:</strong><br />
              {scannedProduct.sku}
            </div>
            <div>
              <strong>Category:</strong><br />
              {scannedProduct.categoryId?.name || 'N/A'}
            </div>
            <div>
              <strong>Color:</strong><br />
              {scannedProduct.color || 'N/A'}
            </div>
            <div>
              <strong>Size:</strong><br />
              {scannedProduct.size || 'N/A'}
            </div>
            <div>
              <strong>New Quantity:</strong><br />
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#155724' }}>
                {scannedProduct.remainingQuantity}
              </span>
              {' '}
              {getStockBadge(scannedProduct.remainingQuantity, scannedProduct.lowStockThreshold)}
            </div>
          </div>
        </div>
      )}

      {/* Scan History */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3><FaHistory /> Scan History ({historyData?.pagination?.total || scanHistory.length})</h3>
          <button 
            className="btn btn-sm btn-secondary"
            onClick={() => setShowFullHistory(!showFullHistory)}
          >
            {showFullHistory ? 'Show Recent Only' : 'Show All History'}
          </button>
        </div>
        
        {isLoadingHistory && scanHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>Loading history...</p>
          </div>
        ) : scanHistory.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            <FaBox style={{ fontSize: '3rem', opacity: 0.3 }} /><br />
            No scans yet. Start scanning products!
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Color / Size</th>
                  <th>Quantity</th>
                  <th>Stock Status</th>
                  {/* {historyData?.data[0]?.userId && <th>User</th>} */}
                </tr>
              </thead>
              <tbody>
                {scanHistory.slice(0, showFullHistory ? scanHistory.length : 10).map((scan) => (
                  <tr key={scan.id} style={{ 
                    backgroundColor: scan.success ? '#f8f9fa' : '#fff3cd' 
                  }}>
                    <td>
                      {scan.success ? (
                        <FaCheck style={{ color: '#28a745' }} title="Successful scan" />
                      ) : (
                        <FaTimes style={{ color: '#dc3545' }} title="Failed scan" />
                      )}
                    </td>
                    <td>
                      <small>{scan.timestamp.toLocaleString()}</small>
                    </td>
                    <td>
                      {scan.product.name}
                    </td>
                    <td>{scan.product.sku || '-'}</td>
                    <td>{scan.product.categoryName || '-'}</td>
                    <td>
                      {scan.product.color && scan.product.size 
                        ? `${scan.product.color} / ${scan.product.size}`
                        : scan.product.color || scan.product.size || '-'}
                    </td>
                    <td>
                      <strong>
                        {scan.quantityBefore !== undefined 
                          ? `${scan.quantityBefore} → ${scan.product.remainingQuantity}`
                          : scan.product.remainingQuantity}
                      </strong>
                    </td>
                    <td>
                      {scan.success && getStockBadge(
                        scan.product.remainingQuantity, 
                        10
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {!showFullHistory && scanHistory.length > 10 && (
              <div style={{ textAlign: 'center', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setShowFullHistory(true)}
                >
                  Show All {scanHistory.length} Scans
                </button>
              </div>
            )}

            {showFullHistory && historyData?.pagination?.hasMore && (
              <div style={{ textAlign: 'center', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={loadMoreHistory}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? 'Loading...' : 'Load More History'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="card" style={{ marginTop: '20px', backgroundColor: '#e7f3ff' }}>
        <h4>📖 How to Use</h4>
        <ol style={{ paddingLeft: '20px' }}>
          <li><strong>With a Barcode Scanner:</strong> Click in the barcode input field and scan. The scanner will automatically enter the barcode and submit.</li>
          <li><strong>Manual Entry:</strong> Type the barcode number and press Enter or click the Scan button.</li>
          <li><strong>Inventory Update:</strong> Each scan automatically decreases the product quantity by 1.</li>
          <li><strong>Real-time Feedback:</strong> See immediate confirmation and updated stock levels.</li>
          <li><strong>Complete History:</strong> All scans are saved to the database and displayed in the history table. Switch between recent scans and full history view.</li>
          <li><strong>Scan Details:</strong> The history shows quantity changes (before → after), product details, user info, and timestamp for every scan.</li>
        </ol>
        <p style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
          ⚠️ <strong>Note:</strong> If a product is out of stock, the scan will fail and show an error message. All scan records are permanently stored and can be accessed later.
        </p>
      </div>
    </div>
  );
}
