import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaSearch, FaEye, FaTrash, FaTimes, FaTruck, FaSync, FaBan, FaFileDownload, FaCheck, FaBoxOpen, FaShippingFast } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';

const statuses = ['En Attente', 'Confirmé', 'Préparé', 'Expédié', 'Livré', 'Annulé'];

const getStatusBadge = (status) => {
    if (!status) return 'badge-secondary';
    switch (status.toLowerCase()) {
        case 'payé': return 'badge-success';
        case 'confirmé': return 'badge-warning';
        case 'préparé': return 'badge-info'; // light blue
        case 'expédié': return 'badge-primary';
        case 'livré': return 'badge-success';
        case 'annulé': return 'badge-danger';
        default: return 'badge-secondary';
    }
};

export default function Orders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [customer, setCustomer] = useState({ nom: '', telephone: '', adresse: '', gouvernerat: '', ville: '', telephone2: '' });
  const [source, setSource] = useState('Direct');
  const [notes, setNotes] = useState('');
  const [shipping, setShipping] = useState(8);
  const [productSearch, setProductSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());

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

  const orders = ordersData?.data || [];
  
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer?.telephone?.includes(searchTerm);
    return matchesSearch;
  });

  const filteredProducts = productSearch
    ? (productsData?.data || []).filter(p => 
        p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
        p.sku.toLowerCase().includes(productSearch.toLowerCase())
      )
    : [];

  const closeModal = () => {
    setIsModalOpen(false);
    setOrderItems([]);
    setCustomer({ nom: '', telephone: '', adresse: '', gouvernerat: '', ville: '', telephone2: '' });
    setSource('Direct');
    setNotes('');
    setShipping(8);
    setProductSearch('');
  };

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

  const sendToDeliveryMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/delivery/send/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      toast.success('Order sent to delivery service');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to send order to delivery');
    }
  });

  const syncStatusMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.put(`/delivery/sync/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orders']);
      toast.info(`Status synced: ${data.data?.status || 'Updated'}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to sync status');
    }
  });

  const cancelDeliveryMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/delivery/cancel/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      toast.success('Delivery cancelled successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to cancel delivery');
    }
  });

  const requestPickupMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await api.post('/delivery/pickup', { orderIds: ids });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Pickup requested successfully');
      setSelectedOrderIds(new Set()); 
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to request pickup');
    }
  });

  const sendBulkMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await api.post('/delivery/bulk-send', { orderIds: ids });
      return res.data;
    },
    onSuccess: (data) => {
        queryClient.invalidateQueries(['orders']);
        toast.success(`Sent ${data.count} orders to delivery`);
        setSelectedOrderIds(new Set());
    },
    onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to send bulk orders');
    }
  });

  const addItemToOrder = (product, variant) => {
    const itemKey = variant ? `${product._id}-${variant._id}` : product._id;
    const existingItem = orderItems.find(item => item.itemKey === itemKey);
    
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

  const removeItem = (itemKey) => {
    setOrderItems(orderItems.filter(item => item.itemKey !== itemKey));
  };

  const updateItemQuantity = (itemKey, quantity) => {
    if (quantity < 1) return;
    setOrderItems(orderItems.map(item =>
      item.itemKey === itemKey ? { ...item, quantity: parseInt(quantity) } : item
    ));
  };

  const calculateTotal = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    return subtotal + shipping;
  };

  const toggleOrderSelection = (id) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(id)) {
        newSelected.delete(id);
    } else {
        newSelected.add(id);
    }
    setSelectedOrderIds(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
        setSelectedOrderIds(new Set());
    } else {
        setSelectedOrderIds(new Set(filteredOrders.map(o => o._id)));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    createMutation.mutate({
        customer,
        items: orderItems.map(item => ({
            product: item.productId,
            variant: item.variantId,
            quantity: item.quantity,
            price: item.unitPrice
        })),
        shipping,
        source,
        notes
    });
  };

  if (isLoading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1 className="page-title">Orders</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
            {selectedOrderIds.size > 0 && (
                <>
                    <button className="btn btn-secondary" onClick={() => {
                        const confirmedOrders = orders.filter(o => selectedOrderIds.has(o._id) && o.status?.toLowerCase() === 'confirmée');
                        if (confirmedOrders.length === 0) {
                             toast.warning("Only 'confirmée' orders can be sent to delivery.");
                             return;
                        }
                        if (confirmedOrders.length < selectedOrderIds.size) {
                             toast.info(`Sending ${confirmedOrders.length} confirmed orders out of ${selectedOrderIds.size} selected.`);
                        }
                        sendBulkMutation.mutate(confirmedOrders.map(o => o._id));
                    }}>
                        <FaTruck /> Send Bulk ({selectedOrderIds.size})
                    </button>
                    <button className="btn btn-secondary" onClick={() => requestPickupMutation.mutate(Array.from(selectedOrderIds))}>
                        <FaFileDownload /> Request Pickup ({selectedOrderIds.size})
                    </button>
                </>
            )}
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <FaPlus /> New Order
            </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Orders</h3>
          <div className="stat-value">{ordersData?.pagination?.total || orders.length}</div>
        </div>
        <div className="stat-card">
          <h3>En attente</h3>
          <div className="stat-value" style={{ color: 'var(--warning-color)' }}>
            {orders.filter(o => o.status === 'En attente').length}
          </div>
        </div>
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <div className="stat-value" style={{ color: 'var(--success-color)' }}>
            {orders.reduce((sum, o) => sum + (o.status !== 'annulée' ? o.total : 0), 0).toFixed(2)} dt
          </div>
        </div>
      </div>

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

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                    <input 
                        type="checkbox" 
                        checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                        onChange={toggleAllSelection}
                    />
                </th>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center' }}>No orders found</td></tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order._id}>
                    <td>
                        <input 
                            type="checkbox" 
                            checked={selectedOrderIds.has(order._id)}
                            onChange={() => toggleOrderSelection(order._id)}
                        />
                    </td>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td>{order.customer?.nom || 'Walk-in Customer'}</td>
                    <td>{order.items?.length || 0} items</td>
                    <td><strong>{order.total?.toFixed(2)} dt</strong></td>
                    <td>
                      {(user.role === 'admin' || user.role === 'manager') ? (
                        <select
                          className={`badge ${getStatusBadge(order.status)}`}
                          value={order.status}
                          onChange={(e) => updateStatusMutation.mutate({ id: order._id, status: e.target.value })}
                          style={{ cursor: 'pointer', border: 'none' }}
                        >
                          {statuses.map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge ${getStatusBadge(order.status)}`}>
                            {order.status}
                        </span>
                      )}
                    </td>
                    <td>
                        {order.deliveryBarcode ? (
                            <span className="badge badge-info" title={order.deliveryBarcode}>
                                Sent <small>({order.deliveryState || 0})</small>
                            </span>
                        ) : (
                            <span className="badge badge-secondary">Not Sent</span>
                        )}
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}
                        style={{ marginRight: '5px' }}
                        title="View Details"
                      >
                        <FaEye />
                      </button>

                      {(user.role === 'admin' || user.role === 'manager') && (
                          <>
                              {!order.deliveryBarcode && order.status?.toLowerCase() === 'confirmé' ? (
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => {
                                        if(window.confirm(`Send Order ${order.orderNumber} to Delivery?`)) {
                                            sendToDeliveryMutation.mutate(order._id);
                                        }
                                    }}
                                    style={{ marginRight: '5px' }}
                                    title="Send to Delivery"
                                  >
                                    <FaTruck />
                                  </button>
                              ) : !order.deliveryBarcode ? null : (
                                  <>
                                    <button
                                        className="btn btn-sm btn-info"
                                        onClick={() => syncStatusMutation.mutate(order._id)}
                                        style={{ marginRight: '5px' }}
                                        title="Sync Status"
                                    >
                                        <FaSync />
                                    </button>
                                    {order.status !== 'Annulée' && order.status !== 'Annulé' && (
                                        <button
                                            className="btn btn-sm btn-warning"
                                            onClick={() => {
                                                if(window.confirm('Cancel delivery for this order?')) {
                                                    cancelDeliveryMutation.mutate(order._id);
                                                }
                                            }}
                                            style={{ marginRight: '5px' }}
                                            title="Cancel Delivery"
                                        >
                                            <FaBan />
                                        </button>
                                    )}
                                  </>
                              )}

                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => {
                                  if (window.confirm('Delete this order?')) deleteMutation.mutate(order._id);
                                }}
                                title="Delete Order"
                              >
                                <FaTrash />
                              </button>
                          </>
                      )}

                      {user.role === 'supplier' && order.status === 'Confirmé' && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => updateStatusMutation.mutate({ id: order._id, status: 'Préparé' })}
                            style={{ marginRight: '5px' }}
                            title="Mark as Prepared"
                          >
                            <FaBoxOpen className="mr-1" /> Ready
                          </button>
                      )}

                      {user.role === 'delivery_man' && (
                          <>
                            {(order.status === 'Préparé') && (
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => updateStatusMutation.mutate({ id: order._id, status: 'Expédié' })}
                                    style={{ marginRight: '5px' }}
                                    title="Pick Up Order"
                                >
                                    <FaShippingFast className="mr-1" /> Pick Up
                                </button>
                            )}
                            {order.status === 'Expédié' && (
                                <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => updateStatusMutation.mutate({ id: order._id, status: 'Livré' })}
                                    style={{ marginRight: '5px' }}
                                    title="Mark Delivered"
                                >
                                    <FaCheck className="mr-1" /> Delivered
                                </button>
                            )}
                          </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                      <td colSpan="2">{calculateTotal().toFixed(2)} dt</td>
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
              <input type="text" className="form-control" placeholder="Name (Nom)" value={customer.nom}
                onChange={(e) => setCustomer({ ...customer, nom: e.target.value })} />
              
              <select className="form-control" value={source}
                onChange={(e) => setSource(e.target.value)}>
                <option value="Direct">Direct</option>
                <option value="Website">Website</option>
                <option value="Phone">Phone</option>
                <option value="Social Media">Social Media</option>
                <option value="Autre">Autre</option>
              </select>

              <input type="text" className="form-control" placeholder="Governorate" value={customer.gouvernerat}
                onChange={(e) => setCustomer({ ...customer, gouvernerat: e.target.value })} />
                
              <input type="text" className="form-control" placeholder="City" value={customer.ville}
                onChange={(e) => setCustomer({ ...customer, ville: e.target.value })} />

              <input type="tel" className="form-control" placeholder="Phone" value={customer.telephone}
                onChange={(e) => setCustomer({ ...customer, telephone: e.target.value })} />
                
              <input type="tel" className="form-control" placeholder="Phone 2 (Optional)" value={customer.telephone2}
                onChange={(e) => setCustomer({ ...customer, telephone2: e.target.value })} />
                
              <input type="text" className="form-control" placeholder="Address" value={customer.adresse} style={{gridColumn: 'span 2'}}
                onChange={(e) => setCustomer({ ...customer, adresse: e.target.value })} />
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
            <p><strong>Name:</strong> {selectedOrder.customer?.nom || 'N/A'}</p>
            <p><strong>Source:</strong> {selectedOrder.source || 'Direct'}</p>
            {selectedOrder.customer?.telephone && <p><strong>Phone:</strong> {selectedOrder.customer.telephone}</p>}
            {selectedOrder.customer?.telephone2 && <p><strong>Phone 2:</strong> {selectedOrder.customer.telephone2}</p>}
            {selectedOrder.customer?.adresse && <p><strong>Address:</strong> {selectedOrder.customer.adresse}, {selectedOrder.customer.ville}, {selectedOrder.customer.gouvernerat}</p>}

            {selectedOrder.notes && <h4 style={{ marginTop: '15px' }}>Notes</h4>}
            {selectedOrder.notes && <p>{selectedOrder.notes}</p>}
            
            {selectedOrder.deliveryBarcode && (
                <div style={{ marginTop: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px' }}>
                    <h4 style={{marginTop: 0}}>Delivery Info</h4>
                    <p><strong>Barcode:</strong> {selectedOrder.deliveryBarcode}</p>
                    <p><strong>State Code:</strong> {selectedOrder.deliveryState}</p>
                    {selectedOrder.pickupDate && <p><strong>Pickup Date:</strong> {new Date(selectedOrder.pickupDate).toLocaleDateString()}</p>}
                    {selectedOrder.deliveredDate && <p><strong>Delivered Date:</strong> {new Date(selectedOrder.deliveredDate).toLocaleDateString()}</p>}
                    <div style={{ marginTop: '10px' }}>
                         <button className="btn btn-sm btn-info" onClick={() => syncStatusMutation.mutate(selectedOrder._id)} style={{marginRight: '5px'}}>
                            <FaSync /> Sync Status
                         </button>
                         <button className="btn btn-sm btn-warning" onClick={() => cancelDeliveryMutation.mutate(selectedOrder._id)}>
                            <FaBan /> Cancel Delivery
                         </button>
                    </div>
                </div>
            )}

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
