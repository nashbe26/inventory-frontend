import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { FaBoxOpen, FaCheckCircle, FaQrcode, FaMapMarkerAlt, FaPhone, FaTimesCircle, FaUser, FaClock } from 'react-icons/fa';
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
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {myDeliveries.length === 0 && <p className="text-gray-500 col-span-3">No active deliveries. Pick some up!</p>}
               {myDeliveries.map(order => (
                 <div key={order._id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <span className="font-bold text-lg text-indigo-700 block">#{order.orderNumber}</span>
                                <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                            </div>
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">{order.status}</span>
                        </div>
                        
                        <div className="space-y-3 mb-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-1 text-gray-400"><FaUser /></div>
                                <div>
                                    <p className="font-medium text-gray-900">{order.customer.name || 'Unknown Customer'}</p>
                                    <a href={`tel:${order.customer.telephone}`} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                                        <FaPhone size={12} /> {order.customer.telephone}
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-1 text-gray-400"><FaMapMarkerAlt /></div>
                                <div>
                                    <p className="text-sm text-gray-800 font-medium">{order.customer.ville}, {order.customer.gouvernerat}</p>
                                    <p className="text-xs text-gray-500">{order.customer.adresse}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
                                <span className="text-sm text-gray-500">{order.paymentMethod}</span>
                                <span className="font-bold text-gray-800 text-lg">{order.total} DT</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-gray-100">
                        <button 
                            onClick={() => markDelivered(order._id)} 
                            className="col-span-2 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium transition-colors"
                        >
                            <FaCheckCircle /> delivered
                        </button>
                        <button 
                            onClick={() => updateStatus(order._id, 'NRP')} 
                            className="bg-orange-100 text-orange-700 py-2 rounded-lg hover:bg-orange-200 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                            title="Not Responding / Postpone"
                        >
                            <FaClock /> Decline
                        </button>
                        <button 
                            onClick={() => updateStatus(order._id, 'Retour')} 
                            className="bg-red-100 text-red-700 py-2 rounded-lg hover:bg-red-200 flex items-center justify-center gap-2 text-sm font-medium transition-colors" 
                            title="Return / Cancelled"
                        >
                            <FaTimesCircle /> Reject
                        </button>
                    </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      )}
    </div>
  );
}
