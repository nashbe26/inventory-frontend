import { useQuery } from '@tanstack/react-query';
import { FaChartLine, FaArrowUp, FaArrowDown, FaExclamationTriangle } from 'react-icons/fa';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const StatCard = ({ title, value, change, subtext, isLoading, error }) => {
  const formatChange = (change) => {
    if (change === undefined || change === null) return null;
    const isPositive = change >= 0;
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: isPositive ? 'var(--success-color)' : 'var(--danger-color)' }}>
        {isPositive ? <FaArrowUp /> : <FaArrowDown />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{title}</h3>
        {change !== undefined && formatChange(change)}
      </div>
      {isLoading ? (
        <div className="loading-skeleton" style={{ height: '36px', width: '120px', marginTop: '5px' }}></div>
      ) : error ? (
        <div className="stat-value" style={{ color: 'var(--danger-color)', fontSize: '1rem' }}>Error</div>
      ) : (
        <div className="stat-value">{value}</div>
      )}
      {subtext && <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>{subtext}</p>}
    </div>
  );
};

export default function Analytics() {
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => api.get('/orders/analytics/dashboard').then(res => res.data)
  });

  const { data: revenueData, isLoading: revenueLoading, error: revenueError } = useQuery({
    queryKey: ['analytics-revenue'],
    queryFn: () => api.get('/orders/analytics/revenue-stats').then(res => res.data)
  });

  const { data: dailyData, isLoading: dailyLoading, error: dailyError } = useQuery({
    queryKey: ['analytics-daily'],
    queryFn: () => api.get('/orders/analytics/daily-revenue?days=14').then(res => res.data)
  });

  const { data: topProductsData, isLoading: topProductsLoading, error: topProductsError } = useQuery({
    queryKey: ['analytics-top-products'],
    queryFn: () => api.get('/orders/analytics/top-selling?period=30&limit=10').then(res => res.data)
  });

  const { data: expensesData, isLoading: expensesLoading, error: expensesError } = useQuery({
    queryKey: ['analytics-expenses'],
    queryFn: () => api.get('/expenses/stats/overview').then(res => res.data)
  });

  const { data: orderStatusData, isLoading: orderStatusLoading, error: orderStatusError } = useQuery({
    queryKey: ['analytics-order-status'],
    queryFn: () => api.get('/orders/analytics/daily-status?days=14').then(res => res.data),
    onError: (error) => {
      console.error('Order status error:', error);
    }
  });

  const dashboard = dashboardData?.data;
  const revenue = revenueData?.data;
  const daily = dailyData?.data || [];
  const topProducts = topProductsData?.data || [];
  const expenses = expensesData?.data;
  const orderStatus = orderStatusData?.data || [];

  // Debug logging
  console.log('Dashboard data:', dashboard);
  console.log('Daily revenue data:', daily);
  console.log('Order status data:', orderStatus);

  const maxRevenue = Math.max(...daily.map(d => d.revenue), 1);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><FaChartLine style={{ marginRight: '10px' }} /> Analytics Dashboard</h1>
      </div>

      {/* Revenue Stats */}
      <div className="stats-grid">
        <StatCard
          title="Today's Revenue (Delivered)"
          isLoading={dashboardLoading}
          error={dashboardError}
          value={`${(dashboard?.today?.revenue || 0).toFixed(2)}dt`}
          subtext={`${dashboard?.today?.count || 0} delivered orders`}
        />
        <StatCard
          title="This Week (Delivered)"
          isLoading={revenueLoading}
          error={revenueError}
          value={`${(revenue?.thisWeek?.totalRevenue || 0).toFixed(2)}dt`}
          change={revenue?.thisWeek?.change}
          subtext={`vs ${(revenue?.thisWeek?.previousWeek || 0).toFixed(2)}dt last week`}
        />
        <StatCard
          title="This Month Revenue (Delivered)"
          isLoading={revenueLoading}
          error={revenueError}
          value={`${(revenue?.thisMonth?.totalRevenue || 0).toFixed(2)}dt`}
          change={revenue?.thisMonth?.change}
          subtext={`${dashboard?.thisMonth?.count || 0} delivered orders`}
        />
        <StatCard
          title="This Month Expenses"
          isLoading={expensesLoading}
          error={expensesError}
          value={`${(expenses?.thisMonth?.total || 0).toFixed(2)}dt`}
          subtext={`${expenses?.thisMonth?.count || 0} expenses`}
        />
      </div>

      {/* Profit & Expenses */}
      <div className="stats-grid" style={{ marginTop: '20px' }}>
        <StatCard
          title="Net Profit (This Month)"
          isLoading={revenueLoading || expensesLoading}
          error={revenueError || expensesError}
          value={`${((revenue?.thisMonth?.totalRevenue || 0) - (expenses?.thisMonth?.total || 0)).toFixed(2)}dt`}
          subtext={`Revenue - Expenses`}
        />
        <StatCard
          title="Expenses Last Month"
          isLoading={expensesLoading}
          error={expensesError}
          value={`${(expenses?.lastMonth?.total || 0).toFixed(2)}dt`}
          subtext={`${expenses?.lastMonth?.count || 0} expenses`}
        />
        <StatCard
          title="Expenses This Year"
          isLoading={expensesLoading}
          error={expensesError}
          value={`${(expenses?.thisYear?.total || 0).toFixed(2)}dt`}
          subtext={`${expenses?.thisYear?.count || 0} expenses`}
        />
        <StatCard
          title="Top Expense Category"
          isLoading={expensesLoading}
          error={expensesError}
          value={expenses?.byCategory?.[0]?.category?.replace('_', ' ') || 'N/A'}
          subtext={`${(expenses?.byCategory?.[0]?.total || 0).toFixed(2)}dt`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
        {/* Daily Revenue Chart */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Revenue Trend - Delivered Orders Only (Last 14 Days)</h3>
          {dailyLoading ? <div className="loading">Loading chart...</div> :
           dailyError ? <p className="error-message">Could not load daily revenue data.</p> :
           daily.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily.slice(-14).map(d => ({
                date: new Date(d.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
                revenue: d.revenue,
                orders: d.orders
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#888" style={{ fontSize: '0.7rem' }} />
                <YAxis stroke="#888" style={{ fontSize: '0.7rem' }} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}
                  formatter={(value, name) => [name === 'revenue' ? `${value.toFixed(2)} dt` : value, name === 'revenue' ? 'Revenu' : 'Commandes']}
                />
                <Legend formatter={(value) => value === 'revenue' ? 'Revenu' : 'Commandes'} />
                <Line type="monotone" dataKey="revenue" stroke="#667eea" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Revenu" />
                <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Commandes" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Selling Products */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Top Selling Products (30 Days)</h3>
          {topProductsLoading ? <div className="loading">Loading products...</div> :
           topProductsError ? <p className="error-message">Could not load top products.</p> :
           topProducts.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>No data available</p>
          ) : (
            <div style={{ marginTop: '15px' }}>
              {topProducts.map((product, idx) => (
                <div key={product._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{
                    width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '0.85rem',
                    background: idx === 0 ? '#fef3c7' : idx === 1 ? '#e5e7eb' : idx === 2 ? '#fed7aa' : '#f3f4f6',
                    color: idx === 0 ? '#92400e' : idx === 1 ? '#374151' : idx === 2 ? '#9a3412' : '#6b7280'
                  }}>
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '600', margin: 0, fontSize: '0.875rem' }}>{product.productName}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>SKU: {product.sku}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: '700', margin: 0, fontSize: '0.875rem' }}>{product.totalQuantity} sold</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--success-color)', margin: 0 }}>{product.totalRevenue.toFixed(2)}dt</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Order Status Chart */}
      <div className="card" style={{ marginTop: '25px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Daily Order Status (Last 14 Days)</h3>
        {orderStatusLoading ? <div className="loading">Loading chart...</div> :
         orderStatusError ? <p className="error-message">Could not load order status data.</p> :
         orderStatus.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>No data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={orderStatus.slice(-14).map(d => {
              console.log('Order status data point:', d);
              return ({
              date: new Date(d.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
              pending: d.pending,
              processing: d.processing,
              shipped: d.shipped,
              delivered: d.delivered,
              cancelled: d.cancelled,
              refunded: d.refunded
            })}
            
            )}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#888" style={{ fontSize: '0.7rem' }} />
              <YAxis stroke="#888" style={{ fontSize: '0.7rem' }} />
              <Tooltip 
                contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}
              />
              <Legend />
              <Bar dataKey="pending" stackId="a" fill="#94a3b8" name="En attente" />
              <Bar dataKey="processing" stackId="a" fill="#3b82f6" name="En cours" />
              <Bar dataKey="shipped" stackId="a" fill="#f59e0b" name="Expédié" />
              <Bar dataKey="delivered" stackId="a" fill="#10b981" name="Livré" />
              <Bar dataKey="cancelled" stackId="a" fill="#ef4444" name="Annulé" />
              <Bar dataKey="refunded" stackId="a" fill="#8b5cf6" name="Remboursé" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginTop: '25px' }}>
        {/* Recent Orders */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Recent Orders</h3>
          {dashboardLoading ? <div className="loading">Loading orders...</div> :
           dashboardError ? <p className="error-message">Could not load recent orders.</p> :
           !dashboard?.recentOrders?.length ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>No orders yet</p>
          ) : (
            <div style={{ marginTop: '15px' }}>
              {dashboard.recentOrders.map((order) => (
                <div key={order._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', marginBottom: '10px' }}>
                  <div>
                    <p style={{ fontWeight: '600', margin: 0, fontFamily: 'monospace', fontSize: '0.875rem' }}>{order.orderNumber}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{order.items?.length || 0} items • {new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: '700', margin: 0, fontSize: '0.875rem' }}>{order.total?.toFixed(2)}dt</p>
                    <span className={`badge ${order.status === 'delivered' ? 'badge-success' : order.status === 'cancelled' ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: '0.75rem' }}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: '600' }}>
            <FaExclamationTriangle style={{ color: 'var(--warning-color)' }} /> Low Stock Alert
          </h3>
          {dashboardLoading ? <div className="loading">Loading stock alerts...</div> :
           dashboardError ? <p className="error-message">Could not load stock alerts.</p> :
           !dashboard?.lowStockProducts?.length ? (
            <p style={{ textAlign: 'center', color: 'var(--success-color)', padding: '40px' }}>All products well stocked!</p>
          ) : (
            <div style={{ marginTop: '15px' }}>
              {dashboard.lowStockProducts.map((product) => (
                <div key={product._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fef3c7', borderRadius: '10px', marginBottom: '10px', border: '1px solid #fde68a' }}>
                  <div>
                    <p style={{ fontWeight: '600', margin: 0, fontSize: '0.875rem' }}>{product.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>SKU: {product.sku}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: '700', margin: 0, color: 'var(--warning-color)', fontSize: '0.875rem' }}>{product.quantity} left</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Min: {product.lowStockThreshold}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expenses by Category */}
      {expenses?.byCategory?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginTop: '25px' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Expense Categories Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenses.byCategory.slice(0, 6).map(cat => ({
                    name: cat.category.replace('_', ' '),
                    value: cat.total
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  style={{ fontSize: '0.75rem' }}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expenses.byCategory.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value.toFixed(2)} dt`} labelFormatter={(label) => `Catégorie: ${label}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Top Expense Categories</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenses.byCategory.slice(0, 6).map(cat => ({
                category: cat.category.replace('_', ' '),
                amount: cat.total,
                count: cat.count
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="category" stroke="#888" style={{ fontSize: '0.7rem' }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#888" style={{ fontSize: '0.7rem' }} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}
                  formatter={(value, name) => [name === 'amount' ? `${value.toFixed(2)} dt` : value, name === 'amount' ? 'Montant' : 'Nombre']}
                />
                <Legend formatter={(value) => value === 'amount' ? 'Montant' : 'Nombre'} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[8, 8, 0, 0]} name="Montant" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Old expense categories cards - removed */}
      {/* Summary */}
      <div className="card" style={{ marginTop: '25px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Performance Summary</h3>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-color)', margin: 0 }}>{dashboard?.thisWeek?.count || 0}</p>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>Orders This Week</p>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--success-color)', margin: 0 }}>{(dashboard?.thisWeek?.revenue || 0).toFixed(0)}dt</p>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>Weekly Revenue</p>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--danger-color)', margin: 0 }}>{(expenses?.thisMonth?.total || 0).toFixed(0)} dt</p>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>Monthly Expenses</p>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--warning-color)', margin: 0 }}>{dashboard?.lowStockProducts?.length || 0}</p>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>Low Stock Items</p>
          </div>
        </div>
      </div>
    </div>
  );
}
