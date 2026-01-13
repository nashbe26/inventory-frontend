import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaSearch, FaEye, FaTrash, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';
import Modal from '../components/Modal';

export default function Orders() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [source, setSource] = useState('Direct');
  const [notes, setNotes] = useState('');
  const [shipping, setShipping] = useState(8);
  const [productSearch, setProductSearch] = useState('');

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/orders?${params}`);
      return res.data;
    }
  });

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (orderData) => {
      const res = await api.post('/orders', orderData);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['products']);
      toast.success(`Order ${data.data.orderNumber} created successfully`);
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create order');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await api.put(`/orders/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      toast.success('Order status updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update order');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/orders/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['products']);
      toast.success('Order deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete order');
    }
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setOrderItems([]);
    setCustomer({ name: '', phone: '', address: '' });
    setSource('Direct');
    setNotes('');
    setShipping(8);
    setProductSearch('');
  };

  // No changes to imports or top of file...

  const addItemToOrder = (product, variant) => {
    // Unique ID combining product and variant (if any)
    const itemKey = variant ? `${product._id}-${variant._id}` : product._id;
    
    // Find if already added
    const existingItem = orderItems.find(item => item.itemKey === itemKey);
    
    // Determine info to display
    const displayName = variant 
      ? `${product.name} (${variant.colorId?.name || 'N/A'}, ${variant.sizeId?.label || 'N/A'})` 
      : product.name;
    const sku = variant ? variant.sku : product.sku;
    const availableStock = variant ? variant.quantity : product.quantity;
    
    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.itemKey === itemKey ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setOrderItems([...orderItems, {
        itemKey,
        productId: product._id,
        variantId: variant?._id,
        productName: displayName,
        sku: sku,
        quantity: 1,
        unitPrice: product.price || 0,
        availableStock: availableStock
      }]);
    }
    setProductSearch('');
  };

  const updateItemQuantity = (itemKey, quantity) => {
    if (quantity < 1) return;
    setOrderItems(orderItems.map(item =>
      item.itemKey === itemKey ? { ...item, quantity: parseInt(quantity) } : item
    ));
  };

  const removeItem = (itemKey) => {
    setOrderItems(orderItems.filter(item => item.itemKey !== itemKey));
  };

  const calculateTotal = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    return subtotal + shipping;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    createMutation.mutate({
      items: orderItems.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })),
      shipping,
      notes,
      source,
      customer: customer.name ? customer : { name: 'Walk-in Customer' },
    });
  };

  const filteredProducts = productsData?.data?.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.sku?.toLowerCase().includes(productSearch.toLowerCase())
  ) || [];

  const filteredOrders = ordersData?.data?.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusBadge = (status) => {
    const badges = {
      'En attente': 'badge-warning',
      'Confirmée': 'badge-info',
      'En cours de préparation': 'badge-info',
      'En cours de livraison': 'badge-info',
      'Livrée': 'badge-success',
      'Annulée': 'badge-danger',
      'Remboursée': 'badge-secondary'
    };
    return badges[status] || 'badge-secondary';
  };

  const statuses = ['En attente', 'Confirmée', 'En cours de préparation', 'En cours de livraison', 'Livrée', 'Annulée', 'Remboursée'];

  if (isLoading) return <div className="loading">Loading orders...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Orders</h1>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <FaPlus /> New Order
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Orders</h3>
          <div className="stat-value">{ordersData?.pagination?.total || 0}</div>
        </div>
        <div className="stat-card">
          <h3>En attente</h3>
          <div className="stat-value" style={{ color: 'var(--warning-color)' }}>
            {ordersData?.data?.filter(o => o.status === 'En attente').length || 0}
          </div>
        </div>
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <div className="stat-value" style={{ color: 'var(--success-color)' }}>
            {ordersData?.data?.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.total : 0), 0).toFixed(2) || '0.00'} dt
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>No orders found</td></tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order._id}>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td>{order.customer?.name || 'Walk-in Customer'}</td>
                    <td>{order.items?.length || 0} items</td>
                    <td><strong>{order.total?.toFixed(2)} dt</strong></td>
                    <td>
                      <select
                        className={`badge ${getStatusBadge(order.status)}`}
                        value={order.status}
                        onChange={(e) => updateStatusMutation.mutate({ id: order._id, status: e.target.value })}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {statuses.map(status => (
                          <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}
                        style={{ marginRight: '5px' }}
                      >
                        <FaEye />
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          if (window.confirm('Delete this order?')) deleteMutation.mutate(order._id);
                        }}
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Order Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title="Create New Order">
        <form onSubmit={handleSubmit}>
          <div className="relative mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Add Products</label>
            <div className="relative">
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Search products by name or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <FaSearch className="absolute right-4 top-3.5 text-gray-400" />
            </div>
            
            {productSearch && filteredProducts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                {filteredProducts.slice(0, 10).map(product => {
                    const hasVariants = product.variants && product.variants.length > 0;
                    if (hasVariants) {
                        return product.variants.map((v) => (
                             <div
                                key={`${product._id}-${v._id}`}
                                onClick={() => addItemToOrder(product, v)}
                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 flex justify-between items-center group transition-colors"
                             >
                                <div>
                                  <div className="font-semibold text-gray-800">{product.name}</div>
                                  <div className="text-sm text-gray-500">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                                      {v.colorId?.name} / {v.sizeId?.label}
                                    </span>
                                    <span className="text-gray-400">{v.sku}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-gray-900">{product.price || 0} dt</div>
                                  <div className={`text-xs ${v.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Stock: {v.quantity}
                                  </div>
                                </div>
                             </div>
                        ));
                    } else {
                        // Old product without variants (legacy fallback)
                        return (
                            <div
                                key={product._id}
                                onClick={() => addItemToOrder(product, null)}
                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 flex justify-between items-center group transition-colors"
                            >
                                <div>
                                  <div className="font-semibold text-gray-800">{product.name}</div>
                                  <div className="text-sm text-gray-500">
                                    <span className="text-gray-400">{product.sku}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-gray-900">{product.price || 0} dt</div>
                                  <div className={`text-xs ${(product.quantity || product.totalQuantity) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Stock: {product.quantity || product.totalQuantity}
                                  </div>
                                </div>
                            </div>
                        );
                    }
                })}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Order Items</label>
            {orderItems.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No items added</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr>
                  </thead>
                  <tbody>
                    {orderItems.map(item => (
                      <tr key={item.itemKey}>
                        <td><strong>{item.productName}</strong><br /><small>{item.sku}</small></td>
                        <td>
                          <input
                            type="number" min="1" max={item.availableStock} value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.itemKey, e.target.value)}
                            className="form-control" style={{ width: '70px' }}
                          />
                        </td>
                        <td>{item.unitPrice.toFixed(2)} dt</td>
                        <td><strong>{(item.unitPrice * item.quantity).toFixed(2)} dt</strong></td>
                        <td>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(item.itemKey)}>
                            <FaTimes />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'right' }}>Subtotal:</td>
                      <td colSpan="2">{orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toFixed(2)} dt</td>
                    </tr>
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'right' }}>Shipping:</td>
                      <td colSpan="2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={shipping}
                          onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                          className="form-control"
                          style={{ width: '100px' }}
                        /> dt
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'right' }}><strong>Total:</strong></td>
                      <td colSpan="2"><strong style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>{calculateTotal().toFixed(2)} dt</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Customer Info (Optional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input type="text" className="form-control" placeholder="Name" value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              <select className="form-control" value={source}
                onChange={(e) => setSource(e.target.value)}>
                <option value="Direct">Direct</option>
                <option value="Website">Website</option>
                <option value="Phone">Phone</option>
                <option value="Social Media">Social Media</option>
                <option value="Autre">Autre</option>
              </select>
              <input type="tel" className="form-control" placeholder="Phone" value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
              <input type="text" className="form-control" placeholder="Address" value={customer.address}
                onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="Add any notes for the order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}
            disabled={orderItems.length === 0 || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Order'}
          </button>
        </form>
      </Modal>

      {/* View Order Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={`Order ${selectedOrder?.orderNumber || ''}`}>
        {selectedOrder && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span className={`badge ${getStatusBadge(selectedOrder.status)}`}>
                {selectedOrder.status}
              </span>
              <span>{new Date(selectedOrder.createdAt).toLocaleString()}</span>
            </div>

            <h4>Customer</h4>
            <p><strong>Name:</strong> {selectedOrder.customer?.name || 'N/A'}</p>
            <p><strong>Source:</strong> {selectedOrder.source || 'Direct'}</p>
            {selectedOrder.customer?.phone && <p><strong>Phone:</strong> {selectedOrder.customer.phone}</p>}
            {selectedOrder.customer?.address && <p><strong>Address:</strong> {selectedOrder.customer.address}</p>}

            {selectedOrder.notes && <h4 style={{ marginTop: '15px' }}>Notes</h4>}
            {selectedOrder.notes && <p>{selectedOrder.notes}</p>}

            <h4 style={{ marginTop: '15px' }}>Items</h4>
            {selectedOrder.items?.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div><strong>{item.productName}</strong><br /><small>{item.quantity} x {item.unitPrice?.toFixed(2)} dt</small></div>
                <strong>{item.totalPrice?.toFixed(2)} dt</strong>
              </div>
            ))}

            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{selectedOrder.subtotal?.toFixed(2)} dt</span></div>
              {selectedOrder.tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax</span><span>{selectedOrder.tax.toFixed(2)} dt</span></div>}
              {selectedOrder.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-color)' }}><span>Discount</span><span>-{selectedOrder.discount.toFixed(2)} dt</span></div>}
              {selectedOrder.shipping > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Shipping</span><span>{selectedOrder.shipping.toFixed(2)} dt</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 'bold', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <span>Total</span><span>{selectedOrder.total?.toFixed(2)} dt</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
