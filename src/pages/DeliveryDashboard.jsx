import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { FaBoxOpen, FaCheckCircle, FaQrcode, FaMapMarkerAlt, FaPhone, FaTimesCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function DeliveryDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-deliveries');
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      
      if (activeTab === 'my-deliveries') {
        const res = await api.get('/internal-delivery/my-deliveries');
        setMyDeliveries(res.data);
      } else if (activeTab === 'analytics') {
         // Only fetch own analytics for now unless admin
         const res = await api.get('/internal-delivery/analytics');
         // Filter for current user if list returned
         const myStats = Array.isArray(res.data) ? res.data.find(s => s.user._id === user._id) : res.data;
         setAnalytics(myStats);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const markDelivered = async (orderId) => {
    if (!window.confirm('Confirm delivery?')) return;
    try {
      await api.put(`/internal-delivery/${orderId}/deliver`);
      fetchData();
    } catch (error) {
      alert('Error updating status');
    }
  };

  const updateStatus = async (orderId, status) => {
    const reason = prompt('Enter reason/note:');
    if (reason === null) return;
    try {
        await api.put(`/internal-delivery/${orderId}/status`, { status, note: reason });
      fetchData();
    } catch (error) {
       alert('Error updating status');
    }
  };

  // Quick Assign via simple prompt for now, or redirect to scanner
  const handleScanAssign = () => {
    navigate('/delivery-scan'); // We will create this route
  };


  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Delivery Dashboard <span className="text-sm font-normal text-gray-500">Welcome, {user.name}</span></h1>

      <div className="flex space-x-4 mb-6">
        <button 
          onClick={() => setActiveTab('my-deliveries')}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'my-deliveries' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          My Deliveries ({myDeliveries.length})
        </button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'my-deliveries' && (
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               {myDeliveries.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No active deliveries. Pick some up!</div>
               ) : (
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-gray-50 border-b border-gray-100">
                              <tr>
                                  <th className="p-4 font-semibold text-gray-600">Reference</th>
                                  <th className="p-4 font-semibold text-gray-600">Customer</th>
                                  <th className="p-4 font-semibold text-gray-600">Location</th>
                                  <th className="p-4 font-semibold text-gray-600">Payment</th>
                                  <th className="p-4 font-semibold text-gray-600">Amount</th>
                                  <th className="p-4 font-semibold text-gray-600">Status</th>
                                  <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {myDeliveries.map(order => (
                              <tr key={order._id} className="hover:bg-gray-50">
                                  <td className="p-4 font-bold text-indigo-700">
                                      #{order.orderNumber}
                                  </td>
                                  <td className="p-4">
                                      <div className="text-sm font-medium text-gray-900">{order.customer.name || 'Customer'}</div>
                                      <a href={`tel:${order.customer.telephone}`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                                          <FaPhone size={10} /> {order.customer.telephone}
                                      </a>
                                  </td>
                                  <td className="p-4 text-sm text-gray-600">
                                      <div>{order.customer.ville}, {order.customer.gouvernerat}</div>
                                      <div className="text-xs text-gray-400">{order.customer.adresse}</div>
                                  </td>
                                  <td className="p-4 text-sm text-gray-600">{order.paymentMethod}</td>
                                  <td className="p-4 font-bold text-gray-800">{order.total} DT</td>
                                  <td className="p-4">
                                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">{order.status}</span>
                                  </td>
                                  <td className="p-4 text-right">
                                      <div className="flex justify-end gap-2">
                                          <button 
                                              onClick={() => markDelivered(order._id)} 
                                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1 text-sm transition-colors"
                                              title="Mark as Delivered"
                                          >
                                              <FaCheckCircle /> Deliver
                                          </button>
                                          <button 
                                              onClick={() => updateStatus(order._id, 'NRP')} 
                                              className="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm transition-colors" 
                                              title="NRP / Return"
                                          >
                                              <FaTimesCircle />
                                          </button>
                                          <button 
                                              onClick={() => updateStatus(order._id, 'Retour')} 
                                              className="px-3 py-1 bg-orange-100 text-orange-600 rounded hover:bg-orange-200 text-sm transition-colors" 
                                              title="Return"
                                          >
                                              Retour
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                            ))}
                          </tbody>
                      </table>
                  </div>
               )}
             </div>
          )}
        </div>
      )}
    </div>
  );
}
