import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services';
import { FaBoxes, FaExclamationTriangle, FaTimesCircle, FaDollarSign } from 'react-icons/fa';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const response = await inventoryService.getStats();
      return response.data.data;
    }
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => {
      const response = await inventoryService.getLowStock();
      return response.data.data;
    }
  });

  if (isLoading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600' }}>Total Products</h3>
          <div className="stat-value" style={{ color: 'var(--primary-color)' }}>
            <FaBoxes style={{ display: 'inline', marginRight: '10px' }} />
            {stats?.totalProducts || 0}
          </div>
        </div>

        <div className="stat-card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600' }}>Total Quantity</h3>
          <div className="stat-value" style={{ color: 'var(--success-color)' }}>
            {stats?.totalQuantity || 0}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Units in stock
          </p>
        </div>

        <div className="stat-card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600' }}>Low Stock Alert</h3>
          <div className="stat-value" style={{ color: 'var(--warning-color)' }}>
            <FaExclamationTriangle style={{ display: 'inline', marginRight: '10px' }} />
            {stats?.lowStockCount || 0}
          </div>
        </div>

        <div className="stat-card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600' }}>Out of Stock</h3>
          <div className="stat-value" style={{ color: 'var(--danger-color)' }}>
            <FaTimesCircle style={{ display: 'inline', marginRight: '10px' }} />
            {stats?.outOfStockCount || 0}
          </div>
        </div>

        <div className="stat-card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600' }}>Total Value</h3>
          <div className="stat-value" style={{ color: 'var(--primary-color)' }}>
            {stats?.totalValue?.toFixed(2) || '0.00'} dt
          </div>
        </div>
      </div>

      {lowStockData && (
        <>
          {lowStockData.lowStock?.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: '20px', color: 'var(--warning-color)', fontSize: '1rem', fontWeight: '600' }}>
                ⚠️ Low Stock Products
              </h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Quantity</th>
                      <th>Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockData.lowStock.map(product => (
                      <tr key={product._id}>
                        <td>{product.sku}</td>
                        <td>{product.name}</td>
                        <td>{product.categoryId?.name}</td>
                        <td>
                          <span className="badge badge-warning">
                            {product.quantity}
                          </span>
                        </td>
                        <td>{product.lowStockThreshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {lowStockData.outOfStock?.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: '20px', color: 'var(--danger-color)', fontSize: '1rem', fontWeight: '600' }}>
                ❌ Out of Stock Products
              </h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockData.outOfStock.map(product => (
                      <tr key={product._id}>
                        <td>{product.sku}</td>
                        <td>{product.name}</td>
                        <td>{product.categoryId?.name}</td>
                        <td>
                          <span className="badge badge-danger">
                            Out of Stock
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
