import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FaMoneyBillWave, FaWallet, FaHistory, FaCalendarAlt, FaPlus, FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';

export default function DeliveryDeposits() {
  const [status, setStatus] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, depositsRes] = await Promise.all([
        api.get('/deposits/my-status'),
        api.get('/deposits/my-deposits')
      ]);
      
      setStatus(statusRes.data);
      setDeposits(depositsRes.data);
    } catch (error) {
      console.error("Error fetching deposit data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDeposit = async (e) => {
    e.preventDefault();
    try {
        await api.post('/deposits', {
            amount: Number(amount),
            notes
        });
        toast.success('Deposit request submitted');
        setAmount('');
        setNotes('');
        setIsModalOpen(false);
        fetchData();
    } catch (error) {
        toast.error('Failed to submit deposit');
    }
  };

  if (loading) return <div className="p-6">Loading finance data...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-2xl font-bold">My Finances</h1>
         <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
            <FaPlus /> Declare Deposit
         </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500">Total Collected</span>
                <FaWallet className="text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{status?.totalCollected?.toLocaleString()} DT</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500">Total Deposited</span>
                <FaHistory className="text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{status?.totalDeposited?.toLocaleString()} DT</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500">Pending Approval</span>
                <FaClock className="text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-500">{status?.pendingAmount?.toLocaleString() || 0} DT</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500">Net Cash on Hand</span>
                <FaMoneyBillWave className="text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{status?.balance?.toLocaleString()} DT</p>
            <p className="text-xs text-red-400 mt-1">Amount owed to company</p>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Deposit History</h2>
      {deposits.length === 0 ? (
        <div className="text-gray-500 bg-white p-8 rounded-lg text-center">No deposits recorded yet.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-4 font-semibold text-gray-600">Date</th>
                <th className="p-4 font-semibold text-gray-600">Amount</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Status</th>
                <th className="p-4 font-semibold text-gray-600">Confirmed By</th>
                <th className="p-4 font-semibold text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deposits.map((deposit) => (
                <tr key={deposit._id} className="hover:bg-gray-50">
                  <td className="p-4 flex items-center gap-2">
                    <FaCalendarAlt className="text-gray-400" />
                    {new Date(deposit.date).toLocaleDateString()}
                  </td>
                  <td className="p-4 font-medium text-gray-800">
                    {deposit.amount.toLocaleString()} DT
                  </td>
                  <td className="p-4 text-center">
                    {deposit.status === 'confirmed' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><FaCheckCircle className="mr-1"/> Confirmed</span>}
                    {deposit.status === 'pending' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><FaClock className="mr-1"/> Pending</span>}
                    {deposit.status === 'rejected' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><FaTimesCircle className="mr-1"/> Rejected</span>}
                  </td>
                  <td className="p-4 text-gray-600">
                    {deposit.collectedBy?.name || '-'}
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {deposit.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Declare Deposit</h2>
            <p className="text-gray-600 mb-4 text-sm">
              Create a record that you have transferred cash to the administration.
            </p>
            
            <form onSubmit={handleSubmitDeposit}>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Method</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows="3"
                  placeholder="e.g. Handed to Manager, Bank Transfer Ref..."
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
