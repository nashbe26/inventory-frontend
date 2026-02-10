import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FaMoneyBillWave, FaHistory, FaPlus, FaUser, FaCheckCircle, FaTimesCircle, FaClock } from 'react-icons/fa';

export default function AdminDeliveryFinance() {
  const [deliveryMen, setDeliveryMen] = useState([]);
  const [deposits, setDeposits] = useState([]); // All deposits including pending
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyUser, setHistoryUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  
  // Deposit Form State
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get deliveries and statuses
      const res = await api.get('/internal-delivery/analytics');
      
      // 2. Get All Deposits to find pending ones
      const depositsRes = await api.get('/deposits');
      setDeposits(depositsRes.data);

      if (Array.isArray(res.data)) {
        const enhancedData = await Promise.all(res.data.map(async (item) => {
            try {
                const statusRes = await api.get(`/deposits/status/${item.user._id}`);
                return { 
                    ...item, 
                    financials: statusRes.data 
                };
            } catch (e) {
                console.error(e);
                return item;
            }
        }));
        setDeliveryMen(enhancedData);
      }
      
    } catch (error) {
      console.error("Error fetching finance data:", error);
      toast.error('Failed to load delivery finance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserHistory = async (userId) => {
      try {
          const res = await api.get(`/deposits?deliveryManId=${userId}`);
          setUserHistory(res.data);
      } catch (error) {
          console.error("Error fetching history:", error);
          toast.error("Failed to fetch user history");
      }
  };

  const handleOpenHistory = (user) => {
      setHistoryUser(user);
      fetchUserHistory(user.user._id);
      setIsHistoryModalOpen(true);
  };

  const handleCreateDeposit = async (e) => {
    e.preventDefault();
    if (!selectedUser || !amount) return;

    try {
      await api.post('/deposits', {
        deliveryManId: selectedUser.user._id,
        amount: Number(amount),
        notes
      });
      toast.success('Deposit recorded successfully');
      setIsModalOpen(false);
      setAmount('');
      setNotes('');
      fetchData(); 
    } catch (error) {
      toast.error('Failed to create deposit');
    }
  };
  
  const handleConfirmDeposit = async (depositId, status) => {
      if(!window.confirm(`Are you sure you want to ${status} this deposit?`)) return;
      try {
          await api.put(`/deposits/${depositId}/confirm`, { status });
          toast.success(`Deposit ${status}`);
          fetchData();
          if (isHistoryModalOpen && historyUser) {
              fetchUserHistory(historyUser.user._id); // Refresh history if open
          }
      } catch(error) {
          toast.error('Operation failed');
      }
  };

  const openDepositModal = (user) => {
    setSelectedUser(user);
    setAmount('');
    setNotes('');
    setIsModalOpen(true);
  };
  
  // Filter pending deposits
  const pendingDeposits = deposits.filter(d => d.status === 'pending');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <FaMoneyBillWave className="mr-2 text-green-600" /> 
        Delivery Finance Management
      </h1>

      {/* Pending Requests Section */}
      {pendingDeposits.length > 0 && (
          <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 flex items-center text-orange-600">
                  <FaClock className="mr-2" /> Pending Deposit Approvals
              </h2>
              <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-orange-50">
                          <tr>
                              <th className="p-4">Delivery Man</th>
                              <th className="p-4">Amount</th>
                              <th className="p-4">Date</th>
                              <th className="p-4">Reference/Notes</th>
                              <th className="p-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody>
                          {pendingDeposits.map(deposit => (
                              <tr key={deposit._id} className="border-b border-gray-100 last:border-0 hover:bg-orange-50/30">
                                  <td className="p-4 font-medium">{deposit.deliveryMan.name}</td>
                                  <td className="p-4 font-bold text-green-600">{deposit.amount} DT</td>
                                  <td className="p-4 text-sm text-gray-500">{new Date(deposit.date).toLocaleDateString()}</td>
                                  <td className="p-4 text-sm">{deposit.notes || '-'}</td>
                                  <td className="p-4 flex justify-end gap-2">
                                      <button 
                                          onClick={() => handleConfirmDeposit(deposit._id, 'confirmed')}
                                          className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-1 text-sm font-medium"
                                      >
                                          <FaCheckCircle /> Confirm
                                      </button>
                                      <button 
                                          onClick={() => handleConfirmDeposit(deposit._id, 'rejected')}
                                          className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-1 text-sm font-medium"
                                      >
                                          <FaTimesCircle /> Reject
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                        <th className="p-4 font-semibold text-gray-600">Delivery Man</th>
                        <th className="p-4 font-semibold text-gray-600">Total Collected</th>
                        <th className="p-4 font-semibold text-gray-600">Confirmed Deposits</th>
                        <th className="p-4 font-semibold text-gray-600">Pending</th>
                        <th className="p-4 font-semibold text-gray-600">Cash on Hand</th>
                        <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deliveryMen.map((item) => {
                    const balance = item.financials?.balance || 0;
                    const collected = item.financials?.totalCollected || 0;
                    const deposited = item.financials?.totalDeposited || 0;
                    const pending = item.financials?.pendingAmount || 0;

                    return (
                      <tr key={item.user._id} className="hover:bg-gray-50">
                        <td className="p-4">
                            <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold mr-3 text-xs">
                                  {item.user.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-800">{item.user.name}</div>
                                  <div className="text-xs text-gray-500">{item.user.email}</div>
                                </div>
                            </div>
                        </td>
                        <td className="p-4 font-medium">{collected.toLocaleString()} DT</td>
                        <td className="p-4 font-medium text-green-600">-{deposited.toLocaleString()} DT</td>
                        <td className="p-4">
                            {pending > 0 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                   <FaClock className="mr-1" /> {pending.toLocaleString()} DT
                                </span>
                            ) : (
                                <span className="text-gray-400">-</span>
                            )}
                        </td>
                        <td className="p-4">
                            <span className={`font-bold ${balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {balance.toLocaleString()} DT
                            </span>
                        </td>
                        <td className="p-4 text-right">
                             <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => handleOpenHistory(item)}
                                    className="inline-flex items-center justify-center px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm transition-colors"
                                    title="View History"
                                >
                                    <FaHistory />
                                </button>
                                <button 
                                  onClick={() => openDepositModal(item)}
                                  className="inline-flex items-center justify-center px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 text-sm transition-colors"
                                  title="Add Deposit"
                                >
                                  <FaPlus /> Manual
                                </button>
                             </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && historyUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="p-6 border-b flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold">Deposit History</h2>
                        <p className="text-gray-500 text-sm">For {historyUser.user.name}</p>
                      </div>
                      <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                          <FaTimesCircle size={24} />
                      </button>
                  </div>
                  <div className="p-0 overflow-auto flex-1">
                      <table className="w-full text-left">
                          <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                  <th className="p-4 font-semibold text-gray-600">Date</th>
                                  <th className="p-4 font-semibold text-gray-600">Amount</th>
                                  <th className="p-4 font-semibold text-gray-600">Status</th>
                                  <th className="p-4 font-semibold text-gray-600">Notes</th>
                                  <th className="p-4 font-semibold text-gray-600">Collected By</th>
                                  <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {userHistory.length === 0 ? (
                                  <tr><td colSpan="6" className="p-8 text-center text-gray-500">No deposits found.</td></tr>
                              ) : (
                                  userHistory.map(deposit => (
                                      <tr key={deposit._id} className="hover:bg-gray-50">
                                          <td className="p-4 text-sm">{new Date(deposit.date).toLocaleDateString()} {new Date(deposit.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                          <td className="p-4 font-bold">{deposit.amount} DT</td>
                                          <td className="p-4">
                                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                  deposit.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                  deposit.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                                  'bg-red-100 text-red-800'
                                              }`}>
                                                  {deposit.status}
                                              </span>
                                          </td>
                                          <td className="p-4 text-sm text-gray-600 max-w-xs truncate">{deposit.notes || '-'}</td>
                                          <td className="p-4 text-sm text-gray-600">{deposit.collectedBy?.name || '-'}</td>
                                          <td className="p-4 text-right">
                                              {deposit.status === 'pending' && (
                                                  <div className="flex justify-end gap-2">
                                                      <button 
                                                          onClick={() => handleConfirmDeposit(deposit._id, 'confirmed')}
                                                          className="text-green-600 hover:bg-green-50 p-1 rounded"
                                                          title="Confirm"
                                                      >
                                                          <FaCheckCircle />
                                                      </button>
                                                      <button 
                                                          onClick={() => handleConfirmDeposit(deposit._id, 'rejected')}
                                                          className="text-red-600 hover:bg-red-50 p-1 rounded"
                                                          title="Reject"
                                                      >
                                                          <FaTimesCircle />
                                                      </button>
                                                  </div>
                                              )}
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
                  <div className="p-4 border-t bg-gray-50 flex justify-end">
                      <button onClick={() => setIsHistoryModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 font-medium text-gray-700">Close</button>
                  </div>
              </div>
          </div>
      )}

      {/* Manual Deposit Modal */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Record Deposit</h2>
            <p className="text-gray-600 mb-4">
              Receiving cash from <span className="font-semibold">{selectedUser.user.name}</span>
            </p>
            
            <form onSubmit={handleCreateDeposit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (DT)</label>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                  min="0"
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows="3"
                  placeholder="e.g. Cash handover for Monday deliveries"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
