import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  FaUser, 
  FaBox, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaTruck, 
  FaChartLine,
  FaSearch,
  FaPhone
} from 'react-icons/fa';

import { useOutletContext } from 'react-router-dom';

export default function DeliveryAnalytics() {
  const { token } = useAuth();
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTeamStats();
  }, []);

  const fetchTeamStats = async () => {
    try {
      const response = await api.get('/internal-delivery/analytics');
      // Sort by active deliveries (pending) descending by default
      const sortedData = response.data.sort((a, b) => b.pending - a.pending);
      setTeamStats(sortedData);
    } catch (error) {
      console.error('Error fetching delivery team stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSuccessRate = (delivered, returned, total) => {
    if (total === 0) return 0;
    const completed = delivered + returned;
    if (completed === 0) return 0;
    return Math.round((delivered / completed) * 100);
  };

  const filteredTeam = teamStats.filter(item => 
    item.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FaTruck className="text-indigo-600" /> Delivery Team Management
          </h1>
          <p className="text-gray-500">Monitor performance and active deliveries</p>
        </div>
        
        <div className="relative">
          <input
            type="text"
            placeholder="Search delivery man..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="text-gray-500 text-sm font-medium">Total Active Agents</div>
              <div className="text-2xl font-bold text-gray-800">{teamStats.length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="text-gray-500 text-sm font-medium">Total Pending Deliveries</div>
              <div className="text-2xl font-bold text-blue-600">
                {teamStats.reduce((sum, item) => sum + item.pending, 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="text-gray-500 text-sm font-medium">Total Delivered</div>
              <div className="text-2xl font-bold text-green-600">
                {teamStats.reduce((sum, item) => sum + item.delivered, 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="text-gray-500 text-sm font-medium">Total Cash Pending</div>
              <div className="text-2xl font-bold text-indigo-600">
                {(teamStats.reduce((sum, item) => sum + (item.totalCashCollected || 0), 0)).toLocaleString()} DT
              </div>
            </div>
          </div>

          {/* Detailed Team List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-600">Delivery Man</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-center">Pending</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-center">Delivered</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-center">Earnings (7DT)</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-center">Cash Collected</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-center">Returned</th>
                  <th className="px-6 py-4 font-semibold text-gray-600 text-center">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTeam.map((stat) => {
                  const successRate = getSuccessRate(stat.delivered, stat.returned, stat.totalAssigned);
                  const isBusy = stat.pending > 0;
                  
                  return (
                    <tr key={stat.user._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                {stat.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-gray-900">{stat.user.name}</div>
                                <div className="text-xs text-gray-500">{stat.user.email}</div>
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isBusy ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {isBusy ? 'On Route' : 'Available'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-blue-600 text-lg">{stat.pending}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-green-600">{stat.delivered}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-semibold text-gray-700">{stat.totalShippingEarnings || 0} DT</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-gray-800">{(stat.totalCashCollected || 0).toLocaleString()} DT</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-red-500">{stat.returned}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2.5 dark:bg-gray-200">
                                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${successRate}%` }}></div>
                            </div>
                            <span className="text-xs font-medium text-gray-600">{successRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredTeam.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No delivery team members found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
