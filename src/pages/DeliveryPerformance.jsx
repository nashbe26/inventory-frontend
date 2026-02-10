import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { FaCheckCircle, FaTimesCircle, FaBoxOpen, FaChartLine, FaMoneyBillWave, FaHandHoldingUsd } from 'react-icons/fa';

export default function DeliveryPerformance() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const res = await api.get('/internal-delivery/analytics');
        // The API might return an array if admin, or single object/array for user.
        // Based on controller, it returns array of stats for users found.
        // For delivery_man accessing own analytics, we expect an array with 1 item or we filter.
        
        let myStats = null;
        if (Array.isArray(res.data)) {
            // Find current user's stats
            myStats = res.data.find(s => s.user._id === user._id) || res.data[0]; 
        } else {
            myStats = res.data;
        }
        setStats(myStats);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading stats...</div>;
  if (!stats) return <div className="p-6">No performance data available.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">My Performance</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">Delivered</h3>
                <FaCheckCircle className="text-green-500 text-xl" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.delivered}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">Pending</h3>
                <FaBoxOpen className="text-blue-500 text-xl" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.pending}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">Returned/Failed</h3>
                <FaTimesCircle className="text-red-500 text-xl" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.returned}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">Success Rate</h3>
                <FaChartLine className="text-purple-500 text-xl" />
            </div>
            <p className="text-3xl font-bold text-gray-800">
                {stats.totalAssigned > 0 
                  ? ((stats.delivered / stats.totalAssigned) * 100).toFixed(1) + '%' 
                  : '0%'}
            </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">Earnings (7DT/Order)</h3>
                <FaMoneyBillWave className="text-green-600 text-xl" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.totalShippingEarnings || 0} DT</p>
            <p className="text-xs text-gray-400 mt-2">Based on delivered orders</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">Total Cash Collected</h3>
                <FaHandHoldingUsd className="text-orange-500 text-xl" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.totalCashCollected || 0} DT</p>
            <p className="text-xs text-gray-400 mt-2">Sum of order amounts</p>
        </div>
      </div>
    </div>
  );
}
