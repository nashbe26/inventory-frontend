import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FaBarcode, FaCheck, FaTimes, FaBox } from 'react-icons/fa';
import api from '../services/api';

export default function BarcodeScanner() {
  const [barcode, setBarcode] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scanMutation = useMutation({
    mutationFn: async (barcodeValue) => {
      const response = await api.post('/scan', { barcode: barcodeValue });
      return response.data;
    },
    onSuccess: (data) => {
      setScannedProduct(data.data);
      toast.success(data.message, { autoClose: 2000 });
      
      // Add to history
      setScanHistory(prev => [{
        id: Date.now(),
        product: data.data,
        timestamp: new Date(),
        success: true
      }, ...prev.slice(0, 19)]); // Keep last 20 scans
      
      // Invalidate queries to update inventory counts
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['inventory-stats']);
      
      // Clear input and refocus
      setBarcode('');
      inputRef.current?.focus();
      
      // Clear scanned product after 3 seconds
      setTimeout(() => setScannedProduct(null), 3000);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Scan failed';
      toast.error(message);
      
      // Add failed scan to history
      setScanHistory(prev => [{
        id: Date.now(),
        barcode: barcode,
        timestamp: new Date(),
        success: false,
        error: message
      }, ...prev.slice(0, 19)]);
      
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
    } else if (quantity <= threshold) {
      return <span className="badge badge-warning">Low Stock</span>;
    } else {
      return <span className="badge badge-success">In Stock</span>;
    }
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: scannedProduct.colorId?.hexCode || '#ccc',
                  border: '1px solid #ddd',
                  borderRadius: '3px'
                }}></div>
                {scannedProduct.colorId?.name || 'N/A'}
              </div>
            </div>
            <div>
              <strong>Size:</strong><br />
              {scannedProduct.sizeId?.label || 'N/A'}
            </div>
            <div>
              <strong>New Quantity:</strong><br />
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#155724' }}>
                {scannedProduct.quantity}
              </span>
              {' '}
              {getStockBadge(scannedProduct.quantity, scannedProduct.lowStockThreshold)}
            </div>
          </div>
        </div>
      )}

      {/* Scan History */}
      <div className="card">
        <h3>Scan History ({scanHistory.length})</h3>
        
        {scanHistory.length === 0 ? (
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
                  <th>Color</th>
                  <th>New Qty</th>
                  <th>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {scanHistory.map((scan) => (
                  <tr key={scan.id} style={{ 
                    backgroundColor: scan.success ? '#f8f9fa' : '#fff3cd' 
                  }}>
                    <td>
                      {scan.success ? (
                        <FaCheck style={{ color: '#28a745' }} />
                      ) : (
                        <FaTimes style={{ color: '#dc3545' }} />
                      )}
                    </td>
                    <td>{scan.timestamp.toLocaleTimeString()}</td>
                    <td>
                      {scan.success ? scan.product.name : scan.error || 'Failed'}
                    </td>
                    <td>{scan.success ? scan.product.sku : scan.barcode || '-'}</td>
                    <td>{scan.success ? scan.product.categoryId?.name : '-'}</td>
                    <td>
                      {scan.success && scan.product.colorId ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            backgroundColor: scan.product.colorId.hexCode,
                            border: '1px solid #ddd',
                            borderRadius: '3px'
                          }}></div>
                          {scan.product.colorId.name}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {scan.success ? (
                        <strong>{scan.product.quantity}</strong>
                      ) : '-'}
                    </td>
                    <td>
                      {scan.success && getStockBadge(
                        scan.product.quantity, 
                        scan.product.lowStockThreshold
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <li><strong>History:</strong> View all your scans in the history table below.</li>
        </ol>
        <p style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
          ⚠️ <strong>Note:</strong> If a product is out of stock, the scan will fail and show an error message.
        </p>
      </div>
    </div>
  );
}
