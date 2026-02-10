import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { FaMapMarkerAlt, FaPhone, FaCalendarAlt } from 'react-icons/fa';

export default function DeliveryHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/internal-delivery/my-history');
      setOrders(res.data);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Livré': return 'bg-green-100 text-green-800';
      case 'Annulé': return 'bg-red-100 text-red-800';
      case 'Retour': return 'bg-orange-100 text-orange-800';
      case 'NRP': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Delivery History</h1>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             {orders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No history available.</div>
             ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="p-4 font-semibold text-gray-600">Reference</th>
                                <th className="p-4 font-semibold text-gray-600">Date</th>
                                <th className="p-4 font-semibold text-gray-600">Customer</th>
                                <th className="p-4 font-semibold text-gray-600">Location</th>
                                <th className="p-4 font-semibold text-gray-600">Payment</th>
                                <th className="p-4 font-semibold text-gray-600">Amount</th>
                                <th className="p-4 font-semibold text-gray-600">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {orders.map(order => (
                             <tr key={order._id} className="hover:bg-gray-50">
                                <td className="p-4 font-bold text-indigo-700">#{order.orderNumber}</td>
                                <td className="p-4 text-sm text-gray-500">
                                    {new Date(order.updatedAt).toLocaleDateString()} {new Date(order.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </td>
                                <td className="p-4">
                                    <div className="text-sm font-medium text-gray-900">{order.customer.name || 'N/A'}</div>
                                    <div className="text-xs text-gray-500">{order.customer.telephone}</div>
                                </td>
                                <td className="p-4 text-sm text-gray-600">
                                    {order.customer.ville}, {order.customer.gouvernerat}
                                </td>
                                <td className="p-4 text-sm text-gray-600">{order.paymentMethod}</td>
                                <td className="p-4 font-bold text-gray-800">{order.total} DT</td>
                                <td className="p-4">
                                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                                        {order.status}
                                    </span>
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
  );
}
