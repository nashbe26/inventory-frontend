import { useQuery } from '@tanstack/react-query';
import { 
  FiDollarSign, 
  FiShoppingCart, 
  FiTrendingUp, 
  FiTrendingDown, 
  FiPackage, 
  FiAlertTriangle,
  FiCalendar
} from 'react-icons/fi';
import api from '../services/api';

const Analytics = () => {
  // Fetch dashboard analytics
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: async () => {
      const res = await api.get('/orders/analytics/dashboard');
      return res.data;
    }
  });

  // Fetch revenue stats
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['analytics-revenue'],
    queryFn: async () => {
      const res = await api.get('/orders/analytics/revenue-stats');
      return res.data;
    }
  });

  // Fetch daily revenue for chart
  const { data: dailyData } = useQuery({
    queryKey: ['analytics-daily'],
    queryFn: async () => {
      const res = await api.get('/orders/analytics/daily-revenue?days=14');
      return res.data;
    }
  });

  // Fetch top selling products
  const { data: topProductsData } = useQuery({
    queryKey: ['analytics-top-products'],
    queryFn: async () => {
      const res = await api.get('/orders/analytics/top-selling?period=30&limit=10');
      return res.data;
    }
  });

  const isLoading = dashboardLoading || revenueLoading;
  const dashboard = dashboardData?.data;
  const revenue = revenueData?.data;
  const daily = dailyData?.data || [];
  const topProducts = topProductsData?.data || [];

  // Find max revenue for chart scaling
  const maxRevenue = Math.max(...daily.map(d => d.revenue), 1);

  const formatChange = (change) => {
    if (change === undefined || change === null) return null;
    const isPositive = change >= 0;
    return (
      <span className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <FiTrendingUp className="w-4 h-4" /> : <FiTrendingDown className="w-4 h-4" />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600">Track your sales performance and insights</p>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FiDollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">Today's Revenue</p>
          <p className="text-2xl font-bold text-gray-900">${(dashboard?.today?.revenue || 0).toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">{dashboard?.today?.count || 0} orders</p>
        </div>

        {/* Weekly Revenue */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-green-100 rounded-lg">
              <FiCalendar className="w-6 h-6 text-green-600" />
            </div>
            {formatChange(revenue?.thisWeek?.change)}
          </div>
          <p className="mt-4 text-sm text-gray-600">This Week</p>
          <p className="text-2xl font-bold text-gray-900">${(revenue?.thisWeek?.totalRevenue || 0).toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">
            vs ${(revenue?.thisWeek?.previousWeek || 0).toFixed(2)} last week
          </p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FiTrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            {formatChange(revenue?.thisMonth?.change)}
          </div>
          <p className="mt-4 text-sm text-gray-600">This Month</p>
          <p className="text-2xl font-bold text-gray-900">${(revenue?.thisMonth?.totalRevenue || 0).toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">
            vs ${(revenue?.thisMonth?.previousMonth || 0).toFixed(2)} last month
          </p>
        </div>

        {/* Total Orders This Month */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-orange-100 rounded-lg">
              <FiShoppingCart className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">Orders This Month</p>
          <p className="text-2xl font-bold text-gray-900">{dashboard?.thisMonth?.count || 0}</p>
          <p className="text-sm text-gray-500 mt-1">
            Avg: ${(revenue?.thisMonth?.avgOrderValue || 0).toFixed(2)} per order
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Chart */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Revenue (Last 14 Days)</h2>
          {daily.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No data available</p>
          ) : (
            <div className="space-y-3">
              {daily.slice(-14).map((day, idx) => {
                const date = new Date(day.date);
                const width = (day.revenue / maxRevenue) * 100;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-gray-600 flex-shrink-0">
                      {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                      <div 
                        className="h-full bg-blue-500 rounded-lg transition-all duration-500"
                        style={{ width: `${Math.max(width, 2)}%` }}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-700">
                        ${day.revenue.toFixed(2)}
                      </span>
                    </div>
                    <span className="w-12 text-sm text-gray-500 text-right flex-shrink-0">
                      {day.orders} ord
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Selling Products */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products (Last 30 Days)</h2>
          {topProducts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No data available</p>
          ) : (
            <div className="space-y-4">
              {topProducts.map((product, idx) => (
                <div key={product._id} className="flex items-center gap-4">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                    idx === 1 ? 'bg-gray-100 text-gray-700' :
                    idx === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{product.productName}</p>
                    <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{product.totalQuantity} sold</p>
                    <p className="text-sm text-green-600">${product.totalRevenue.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
          {!dashboard?.recentOrders?.length ? (
            <p className="text-gray-500 text-center py-8">No orders yet</p>
          ) : (
            <div className="space-y-3">
              {dashboard.recentOrders.map((order) => (
                <div key={order._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-mono text-sm font-medium text-gray-900">{order.orderNumber}</p>
                    <p className="text-xs text-gray-500">
                      {order.items?.length || 0} items • {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${order.total?.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiAlertTriangle className="w-5 h-5 text-orange-500" />
            Low Stock Alert
          </h2>
          {!dashboard?.lowStockProducts?.length ? (
            <p className="text-gray-500 text-center py-8">All products are well stocked!</p>
          ) : (
            <div className="space-y-3">
              {dashboard.lowStockProducts.map((product) => (
                <div key={product._id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <FiPackage className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-600">{product.quantity} left</p>
                    <p className="text-xs text-gray-500">Min: {product.lowStockThreshold}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{dashboard?.thisWeek?.count || 0}</p>
            <p className="text-sm text-gray-600">Orders This Week</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">
              ${(dashboard?.thisWeek?.revenue || 0).toFixed(0)}
            </p>
            <p className="text-sm text-gray-600">Weekly Revenue</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-purple-600">{topProducts.length}</p>
            <p className="text-sm text-gray-600">Products Sold</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-orange-600">
              {dashboard?.lowStockProducts?.length || 0}
            </p>
            <p className="text-sm text-gray-600">Low Stock Items</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
