import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaWallet, FaDownload } from 'react-icons/fa';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const CATEGORIES = [
  'inventory_purchase', 'shipping_delivery', 'packaging_supplies', 'marketing_ads',
  'website_hosting', 'payment_processing', 'rent_warehouse', 'utilities',
  'salaries_wages', 'software_subscriptions', 'office_supplies', 'returns_refunds',
  'taxes_fees', 'insurance', 'maintenance_repairs', 'professional_services', 'other'
];

const categoryColors = {
  inventory_purchase: 'badge-primary',
  shipping_delivery: 'badge-info',
  packaging_supplies: 'badge-secondary',
  marketing_ads: 'badge-warning',
  website_hosting: 'badge-info',
  payment_processing: 'badge-success',
  rent_warehouse: 'badge-info',
  utilities: 'badge-warning',
  salaries_wages: 'badge-primary',
  software_subscriptions: 'badge-info',
  office_supplies: 'badge-secondary',
  returns_refunds: 'badge-danger',
  taxes_fees: 'badge-danger',
  insurance: 'badge-secondary',
  maintenance_repairs: 'badge-warning',
  professional_services: 'badge-success',
  other: 'badge-light'
};

const CHART_COLORS = {
  inventory_purchase: '#6366f1', // primary-like
  shipping_delivery: '#3b82f6', // info-like
  packaging_supplies: '#ec4899', // pink
  marketing_ads: '#f59e0b', // warning
  website_hosting: '#06b6d4', // cyan
  payment_processing: '#22c55e', // success
  rent_warehouse: '#8b5cf6', // purple
  utilities: '#eab308', // yellow
  salaries_wages: '#3730a3', // indigo
  software_subscriptions: '#0ea5e9', // sky
  office_supplies: '#64748b', // slate
  returns_refunds: '#ef4444', // red
  taxes_fees: '#dc2626', // red-600
  insurance: '#94a3b8', // blue-gray
  maintenance_repairs: '#d97706', // amber
  professional_services: '#10b981', // emerald
  other: '#9ca3af' // gray
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const formatCategory = (category) => {
  if (!category) return '';
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function Expenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [formData, setFormData] = useState({
    title: '', amount: '', category: '', description: '',
    date: '', reference: '', isRecurring: false, paidBy: ''
  });

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('excludeSuppliers', 'true');
    if (search) params.append('search', search);
    if (categoryFilter) params.append('category', categoryFilter);
    if (dateRange.start) params.append('startDate', dateRange.start);
    if (dateRange.end) params.append('endDate', dateRange.end);
    return params.toString();
  };

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', search, categoryFilter, dateRange],
    queryFn: async () => {
      const params = buildQueryParams();
      const res = await api.get(`/expenses${params ? `?${params}` : ''}`);
      return res.data;
    }
  });

  const { data: statsData } = useQuery({
    queryKey: ['expense-stats'],
    queryFn: async () => {
      const res = await api.get('/expenses/stats/overview?excludeSuppliers=true');
      return res.data;
    }
  });

  const { data: usersList } = useQuery({
    queryKey: ['org-users'],
    queryFn: async () => {
      const res = await api.get('/organizations/my/organization');
      const owner = res.data.owner;
      const members = res.data.members?.map(m => m.user) || [];
      // Combine and dedup by ID just in case
      const uniqueUsers = [owner, ...members].filter((v,i,a)=>a.findIndex(v2=>(v2._id===v._id))===i);
      return uniqueUsers;
    }
  });

  const expenses = expensesData?.data || [];
  const stats = statsData?.data;

  // Pie Chart Data Preparation
  const pieData = useMemo(() => {
    if (!stats?.byCategory) return [];
    return stats.byCategory.map(item => ({
      name: formatCategory(item.category),
      value: item.total,
      rawCategory: item.category
    })).filter(item => item.value > 0);
  }, [stats]);

  const exportToCSV = () => {
    if (!expenses.length) return toast.warn("No expenses to export");
    
    const headers = ["Date", "Title", "Category", "Amount", "Paid By", "Reference", "Description"];
    
    // Helper to escape quotes
    const escape = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + expenses.map(e => [
            new Date(e.date).toLocaleDateString(),
            escape(e.title),
            formatCategory(e.category),
            e.amount,
            escape(e.paidBy?.name),
            escape(e.reference),
            escape(e.description)
        ].join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/expenses', data),
    onSuccess: () => {
      toast.success('Expense created successfully!');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create expense');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/expenses/${id}`, data),
    onSuccess: () => {
      toast.success('Expense updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update expense');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      toast.success('Expense deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete expense');
    }
  });

  const openModal = (expense = null) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        title: expense.title || '',
        amount: expense.amount || '',
        category: expense.category || '',
        description: expense.description || '',
        date: expense.date ? expense.date.split('T')[0] : '',
        reference: expense.reference || '',
        isRecurring: expense.isRecurring || false,
        paidBy: expense.paidBy?._id || ''
      });
    } else {
      setEditingExpense(null);
      setFormData({
        title: '', amount: '', category: '', description: '',
        date: new Date().toISOString().split('T')[0],
        reference: '', isRecurring: false,
        paidBy: '' // Default to empty (will use current user in backend if sent as undefined/null, but we want explicit selection or "Me")
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingExpense(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const payload = { ...formData, amount: parseFloat(formData.amount) };

    // Validate/Fix paidBy
    // If paidBy is empty (meaning "(Me)" was selected), explicitly set it to current user's ID
    if (!payload.paidBy && user) {
        payload.paidBy = user._id;
    }

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
             <FaWallet className="text-indigo-600" />
             Expenses Management
           </h1>
           <p className="text-gray-500 mt-1">Track and manage your operational expenses</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary flex items-center gap-2" onClick={exportToCSV}>
            <FaDownload /> Export CSV
          </button>
          <button className="btn btn-primary flex items-center gap-2" onClick={() => openModal()}>
            <FaPlus /> Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Stats Column */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <h3 className="text-gray-500 font-medium text-sm text-transform uppercase">All Time</h3>
              <div className="text-2xl font-bold text-gray-800 mt-2">{(stats?.allTime?.total || 0).toFixed(2)} dt</div>
              <p className="text-gray-400 text-sm mt-1">{stats?.allTime?.count || 0} expenses</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <h3 className="text-gray-500 font-medium text-sm text-transform uppercase">This Month</h3>
              <div className="text-2xl font-bold text-gray-800 mt-2">{(stats?.thisMonth?.total || 0).toFixed(2)} dt</div>
              <p className="text-gray-400 text-sm mt-1">{stats?.thisMonth?.count || 0} expenses</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <h3 className="text-gray-500 font-medium text-sm text-transform uppercase">Last Month</h3>
              <div className="text-2xl font-bold text-gray-800 mt-2">{(stats?.lastMonth?.total || 0).toFixed(2)} dt</div>
              <p className="text-gray-400 text-sm mt-1">{stats?.lastMonth?.count || 0} expenses</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <h3 className="text-gray-500 font-medium text-sm text-transform uppercase">Top Category</h3>
              <div className="text-xl font-bold text-gray-800 mt-2 capitalize text-ellipsis overflow-hidden whitespace-nowrap">
                {formatCategory(stats?.byCategory?.[0]?.category) || 'N/A'}
              </div>
              <p className="text-gray-400 text-sm mt-1">
                {(stats?.byCategory?.[0]?.total || 0).toFixed(2)} dt
              </p>
            </div>
        </div>

        {/* Right Chart Column */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:row-span-2 flex flex-col justify-center items-center">
            <h3 className="text-gray-600 font-semibold mb-4 w-full text-left">Expense Distribution</h3>
            {pieData.length > 0 ? (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={pieData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60}
                      outerRadius={80} 
                      paddingAngle={5}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[entry.rawCategory] || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => `${value.toLocaleString()} dt`} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
               <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <FaSearch className="text-3xl mb-2" />
                  <p>No data available</p>
               </div>
            )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="form-group mb-0">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Search</label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="form-control pl-10 w-full"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group mb-0">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
            <select className="form-control w-full" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{formatCategory(cat)}</option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="text-sm font-medium text-gray-700 mb-1 block">From Date</label>
            <input
              type="date"
              className="form-control w-full"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div className="form-group mb-0">
            <label className="text-sm font-medium text-gray-700 mb-1 block">To Date</label>
            <input
              type="date"
              className="form-control w-full"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading expenses...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No expenses found</td></tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(expense.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{expense.title}</div>
                        {expense.description && <div className="text-xs text-gray-500 truncate max-w-xs">{expense.description}</div>}
                        {expense.reference && <div className="text-xs text-mono text-gray-400 mt-0.5">Ref: {expense.reference}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${categoryColors[expense.category] === 'badge-primary' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}>
                          {formatCategory(expense.category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {expense.paidBy ? expense.paidBy.name : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {expense.amount.toFixed(2)} dt
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900 mr-4" onClick={() => openModal(expense)}>
                          <FaEdit />
                        </button>
                        <button className="text-red-600 hover:text-red-900" onClick={() => handleDelete(expense._id)}>
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={editingExpense ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              className="form-control w-full"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control w-full"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                className="form-control w-full"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">Select Category</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{formatCategory(cat)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid By</label>
              <select
                className="form-control w-full"
                value={formData.paidBy}
                onChange={(e) => setFormData({ ...formData, paidBy: e.target.value })}
              >
                <option value="">(Me)</option>
                {usersList?.map(u => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              className="form-control w-full"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div className="form-group mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Receipt #</label>
            <input
              type="text"
              className="form-control w-full"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Invoice or receipt number"
            />
          </div>
          <div className="form-group mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="form-control w-full"
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
            />
          </div>
          <div className="form-group mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Recurring Expense</span>
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingExpense ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

