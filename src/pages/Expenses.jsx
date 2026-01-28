import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaWallet } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import api from '../services/api';

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

const formatCategory = (category) => {
  if (!category) return '';
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function Expenses() {
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
    <div>
      <div className="page-header">
        <h1 className="page-title"><FaWallet style={{ marginRight: '10px' }} /> Expenses</h1>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FaPlus style={{ marginRight: '8px' }} /> Add Expense
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>All Time</h3>
          <div className="stat-value">{(stats?.allTime?.total || 0).toFixed(2)} dt</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>{stats?.allTime?.count || 0} expenses</p>
        </div>
        <div className="stat-card">
          <h3>This Month</h3>
          <div className="stat-value">{(stats?.thisMonth?.total || 0).toFixed(2)} dt</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>{stats?.thisMonth?.count || 0} expenses</p>
        </div>
        <div className="stat-card">
          <h3>Last Month</h3>
          <div className="stat-value">{(stats?.lastMonth?.total || 0).toFixed(2)} dt</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>{stats?.lastMonth?.count || 0} expenses</p>
        </div>
        <div className="stat-card">
          <h3>Top Category</h3>
          <div className="stat-value" style={{ textTransform: 'capitalize', fontSize: '1.125rem' }}>
            {formatCategory(stats?.byCategory?.[0]?.category) || 'N/A'}
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>
            {(stats?.byCategory?.[0]?.total || 0).toFixed(2)} dt
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '25px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Search</label>
            <div style={{ position: 'relative' }}>
              <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '38px' }}
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Category</label>
            <select className="form-control" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{formatCategory(cat)}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>From Date</label>
            <input
              type="date"
              className="form-control"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>To Date</label>
            <input
              type="date"
              className="form-control"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card">
        <div className="table-container">
          {isLoading ? (
            <div className="loading">Loading expenses...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Paid By</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center' }}>No expenses found</td></tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense._id}>
                      <td>{new Date(expense.date).toLocaleDateString()}</td>
                      <td>
                        <strong>{expense.title}</strong>
                        {expense.isRecurring && <span className="badge badge-info" style={{ marginLeft: '8px' }}>Recurring</span>}
                        {expense.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{expense.description}</p>}
                      </td>
                      <td>
                        <span className={`badge ${categoryColors[expense.category] || 'badge-secondary'}`}>
                          {formatCategory(expense.category)}
                        </span>
                      </td>
                      <td>
                        {expense.paidBy ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ 
                              width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#e0e7ff', 
                              color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 'bold'
                            }}>
                              {expense.paidBy.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '0.85rem' }}>{expense.paidBy.name}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                      <td style={{ fontWeight: '700' }}>{expense.amount.toFixed(2)} dt</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{expense.reference || '-'}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => openModal(expense)} style={{ marginRight: '5px' }}>
                          <FaEdit />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(expense._id)}>
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

      {/* Category Breakdown */}
      {stats?.byCategory?.length > 0 && (
        <div className="card" style={{ marginTop: '25px' }}>
          <h3>Expenses by Category (This Month)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
            {stats.byCategory.map((cat) => (
              <div key={cat.category} style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${categoryColors[cat.category] || 'badge-secondary'}`}>{formatCategory(cat.category)}</span>
                  <span style={{ fontWeight: '700' }}>{cat.total.toFixed(2)} dt</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: 0 }}>
                  {cat.count} expense{cat.count !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={editingExpense ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              className="form-control"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label>Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select
                className="form-control"
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
              <label>Paid By</label>
              <select
                className="form-control"
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
          <div className="form-group">
            <label>Date *</label>
            <input
              type="date"
              className="form-control"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Reference / Receipt #</label>
            <input
              type="text"
              className="form-control"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Invoice or receipt number"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-control"
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
              />
              Recurring Expense
            </label>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
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
