import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const DELIVERY_FEE = 7; // DT per delivered order
const DELIVERED = ['Livré', 'Livrée'];

function getOrderEarning(status) {
  return DELIVERED.includes(status) ? DELIVERY_FEE : 0;
}

// Only COD (Espèces) delivered orders involve physical cash collection
function getCashCollected(order) {
  if (!DELIVERED.includes(order.status)) return 0;
  if (order.paymentMethod === 'Espèces') return order.total || 0;
  return 0;
}

function getCompletionDate(order) {
  return order.deliveryCompletedAt || order.deliveredAt || order.updatedAt;
}

function getDateKey(order) {
  return new Date(getCompletionDate(order)).toLocaleDateString('fr-TN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function groupOrdersByDate(orders) {
  const map = new Map();
  for (const order of orders) {
    const key = getDateKey(order);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(order);
  }
  return map;
}

const statusColors = {
  Livré: 'bg-green-100 text-green-800',
  Livrée: 'bg-green-100 text-green-800',
  Annulé: 'bg-red-100 text-red-800',
  Annulée: 'bg-red-100 text-red-800',
  Retour: 'bg-orange-100 text-orange-800',
  NRP: 'bg-yellow-100 text-yellow-800',
};

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
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalEarnings = orders.reduce((sum, o) => sum + getOrderEarning(o.status), 0);
  const totalCashCollected = orders.reduce((sum, o) => sum + getCashCollected(o), 0);
  const totalToDeposit = totalCashCollected - totalEarnings;
  const deliveredCount = orders.filter(o => DELIVERED.includes(o.status)).length;
  const groupedByDate = groupOrdersByDate(orders);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Delivery History</h1>

      {loading ? (
        <div>Loading...</div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No history available.</div>
      ) : (
        <>
          {/* Summary banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-800">{orders.length}</div>
              <div className="text-sm text-gray-500 mt-1">Total orders</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{deliveredCount}</div>
              <div className="text-sm text-gray-500 mt-1">Delivered</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{totalEarnings} DT</div>
              <div className="text-sm text-gray-500 mt-1">Delivery earnings</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{totalCashCollected} DT</div>
              <div className="text-sm text-gray-500 mt-1">Cash collected</div>
              <div className="text-xs text-gray-400 mt-1">To deposit: {totalToDeposit} DT</div>
            </div>
          </div>

          {/* Per-date groups */}
          <div className="space-y-6">
            {[...groupedByDate.entries()].map(([date, dayOrders]) => {
              const dayEarnings = dayOrders.reduce((sum, o) => sum + getOrderEarning(o.status), 0);
              const dayCashCollected = dayOrders.reduce((sum, o) => sum + getCashCollected(o), 0);
              const dayToDeposit = dayCashCollected - dayEarnings;
              const dayDelivered = dayOrders.filter(o => DELIVERED.includes(o.status)).length;

              return (
                <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Date header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <span className="font-semibold text-gray-700">{date}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">
                        {dayDelivered} / {dayOrders.length} delivered
                      </span>
                      <span className="font-bold text-indigo-600">{dayEarnings} DT</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-gray-100">
                        <tr>
                          <th className="p-4 font-semibold text-gray-600">Reference</th>
                          <th className="p-4 font-semibold text-gray-600">Time</th>
                          <th className="p-4 font-semibold text-gray-600">Customer</th>
                          <th className="p-4 font-semibold text-gray-600">Location</th>
                          <th className="p-4 font-semibold text-gray-600">Payment</th>
                          <th className="p-4 font-semibold text-gray-600">Order Total</th>
                          <th className="p-4 font-semibold text-gray-600">Status</th>
                          <th className="p-4 font-semibold text-gray-600">Earning</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dayOrders.map(order => {
                          const earning = getOrderEarning(order.status);
                          const dateObj = new Date(order.deliveryCompletedAt || order.deliveredAt || order.updatedAt);
                          return (
                            <tr key={order._id} className="hover:bg-gray-50">
                              <td className="p-4 font-bold text-indigo-700">#{order.orderNumber}</td>
                              <td className="p-4 text-sm text-gray-500">
                                {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-4">
                                <div className="text-sm font-medium text-gray-900">{order.customer?.name || 'N/A'}</div>
                                <div className="text-xs text-gray-500">{order.customer?.telephone}</div>
                              </td>
                              <td className="p-4 text-sm text-gray-600">
                                {order.customer?.ville}, {order.customer?.gouvernerat}
                              </td>
                              <td className="p-4 text-sm text-gray-600">{order.paymentMethod}</td>
                              <td className="p-4 font-bold text-gray-800">{order.total} DT</td>
                              <td className="p-4">
                                <span className={`text-xs px-2 py-1 rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="p-4 font-bold">
                                {earning > 0
                                  ? <span className="text-green-600">{earning} DT</span>
                                  : <span className="text-gray-400">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Daily subtotal rows */}
                        <tr className="bg-indigo-50 border-t border-indigo-100">
                          <td colSpan={7} className="px-4 pt-3 pb-1 text-right text-sm font-semibold text-indigo-700">
                            Delivery earnings ({dayDelivered} × {DELIVERY_FEE} DT)
                          </td>
                          <td className="px-4 pt-3 pb-1 font-bold text-indigo-700">{dayEarnings} DT</td>
                        </tr>
                        <tr className="bg-indigo-50">
                          <td colSpan={7} className="px-4 pt-1 pb-1 text-right text-sm font-semibold text-orange-600">
                            Cash collected (Espèces)
                          </td>
                          <td className="px-4 pt-1 pb-1 font-bold text-orange-600">{dayCashCollected} DT</td>
                        </tr>
                        <tr className="bg-indigo-50 border-b border-indigo-100">
                          <td colSpan={7} className="px-4 pt-1 pb-3 text-right text-sm font-semibold text-gray-600">
                            To deposit
                          </td>
                          <td className="px-4 pt-1 pb-3 font-bold text-gray-700">{dayToDeposit} DT</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
