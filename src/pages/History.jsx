import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FaHistory, FaCheck, FaTimes, FaBox, FaSearch, FaFilter } from 'react-icons/fa';
import api from '../services/api';

export default function History() {
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch scan history from backend
  const { data: historyData, isLoading, isError } = useQuery({
    queryKey: ['scan-history-full', page, limit],
    queryFn: async () => {
      const response = await api.get('/scan/history/all', {
        params: { 
            limit, 
            skip: page * limit 
        }
      });
      return response.data;
    },
    keepPreviousData: true
  });

  const handleNextPage = () => {
    if (historyData?.pagination?.hasMore) {
        setPage(old => old + 1);
    }
  };

  const handlePrevPage = () => {
    setPage(old => Math.max(0, old - 1));
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

  return (
    <div>
      <div className="page-header">
        <h1><FaHistory /> Scan History</h1>
        <div className="header-actions">
           {/* Future: Add export button or date filters here */}
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading history...</p>
          </div>
        ) : isError ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>
                <p>Error loading history data.</p>
            </div>
        ) : !historyData?.data || historyData.data.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
            <FaBox style={{ fontSize: '3rem', opacity: 0.3 }} /><br />
            No scan history found.
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Time</th>
                    <th>User</th>
                    <th>Product</th>
                    <th>SKU / Barcode</th>
                    <th>Category</th>
                    <th>Color / Size</th>
                    <th>Quantity Change</th>
                    <th>Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.data.map((scan) => (
                    <tr key={scan._id} style={{ 
                        backgroundColor: scan.quantityAfter !== undefined ? '#fff' : '#fff3cd' 
                        // You can adjust background color logic based on success if backend returns it explicitly
                        // For now assuming all saved history is "attempted" scans, but usually we save successful ones.
                    }}>
                      <td>
                        <FaCheck style={{ color: '#28a745' }} title="Scan recorded" />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{new Date(scan.scannedAt).toLocaleDateString()}</span>
                            <small style={{ color: '#666' }}>{new Date(scan.scannedAt).toLocaleTimeString()}</small>
                        </div>
                      </td>
                      <td>
                        {scan.userId ? (
                            <span>{scan.userId.firstName} {scan.userId.lastName}</span>
                        ) : 'Unknown'}
                      </td>
                      <td>
                        <strong>{scan.productName}</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {scan.sku && <span>SKU: {scan.sku}</span>}
                            <small style={{ color: '#666' }}>{scan.barcode}</small>
                        </div>
                      </td>
                      <td>{scan.categoryName || '-'}</td>
                      <td>
                        {scan.color && scan.size 
                          ? `${scan.color} / ${scan.size}`
                          : scan.color || scan.size || '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ color: '#666' }}>{scan.quantityBefore}</span>
                            <span>→</span>
                            <strong>{scan.quantityAfter}</strong>
                            <span style={{ 
                                fontSize: '0.8em', 
                                padding: '2px 5px', 
                                borderRadius: '4px',
                                backgroundColor: scan.quantityAfter < scan.quantityBefore ? '#ffebee' : '#e8f5e9',
                                color: scan.quantityAfter < scan.quantityBefore ? '#c62828' : '#2e7d32'
                            }}>
                                {scan.quantityAfter - scan.quantityBefore > 0 ? '+' : ''}{scan.quantityAfter - scan.quantityBefore}
                            </span>
                        </div>
                      </td>
                      <td>
                        {getStockBadge(
                          scan.quantityAfter, 
                          10 // Default threshold as it's not stored in history currently
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: '20px',
                paddingTop: '20px',
                borderTop: '1px solid #eee'
            }}>
                <span style={{ color: '#666' }}>
                    Showing {page * limit + 1} to {Math.min((page + 1) * limit, historyData.pagination.total)} of {historyData.pagination.total} entries
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={handlePrevPage}
                        disabled={page === 0}
                    >
                        Previous
                    </button>
                    <button 
                        className="btn btn-primary" 
                        onClick={handleNextPage} 
                        disabled={!historyData.pagination.hasMore}
                    >
                        Next
                    </button>
                </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
