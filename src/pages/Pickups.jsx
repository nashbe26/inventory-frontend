import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FaFilePdf, FaBox, FaCalendar, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function Pickups() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const { data: deliveryData, isLoading, refetch } = useQuery({
    queryKey: ['delivery-filter', page, pageSize],
    queryFn: async () => {
      // Fetch recent orders or active pickups using filter
      const res = await api.post('/delivery/filter', {
        pagination: { pageNumber: page, limit: pageSize },
      });
      return res.data;
    },
    keepPreviousData: true
  });

  if (isLoading) return <div className="loading">Loading delivery data...</div>;

  const result = deliveryData?.data?.result || {};
  const items = deliveryData?.data?.reversedItems || [];
  const totalPages = result.TotalPages || 1;
  const currentPage = result.CurrentPage || 1;
  const totalCount = result.TotalCount || 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Delivery Status (External)</h1>
        <button className="btn btn-secondary" onClick={() => refetch()}>
            <FaSync /> Refresh
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Client</th>
                <th>Product</th>
                <th>Dates</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center' }}>No delivery records found</td></tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx}>
                    <td><strong>{item.barCode}</strong></td>
                    <td>
                        <div>{item.Client?.name}</div>
                        <small className="text-secondary">{item.Client?.city}</small>
                    </td>
                    <td>
                        <div>{item.Product?.designation}</div>
                        <small>{item.Product?.price} dt</small>
                    </td>
                    <td>
                        {item.pickupAt && <div className="text-sm"><span className="badge badge-info mb-1">Pickup: {new Date(item.pickupAt).toLocaleDateString()}</span></div>}
                        {item.deliveredAt && <div className="text-sm"><span className="badge badge-success">Delivered: {new Date(item.deliveredAt).toLocaleDateString()}</span></div>}
                    </td>
                    <td>
                        <span className="badge badge-secondary">{item.state}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderTop: '1px solid #eee' }}>
            <div>
              Showing {items.length} of {totalCount} records
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select 
                    value={pageSize} 
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="form-control" 
                    style={{ width: 'auto', padding: '4px 8px' }}
                >
                    <option value="10">10 / page</option>
                    <option value="20">20 / page</option>
                    <option value="50">50 / page</option>
                    <option value="100">100 / page</option>
                </select>
                
                <button 
                  className="btn btn-sm btn-secondary" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button 
                  className="btn btn-sm btn-secondary" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
