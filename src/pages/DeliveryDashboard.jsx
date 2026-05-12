import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  FaBoxOpen, FaCheckCircle, FaQrcode, FaMapMarkerAlt,
  FaPhone, FaTimesCircle, FaUser, FaClock, FaDirections, FaTimes, FaChevronDown, FaChevronUp,
  FaTruck, FaMoneyBillWave, FaHandHoldingUsd
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const DELIVERY_FEE = 7;
const DELIVERED = ['Livré', 'Livrée'];

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function computeTodayStats(history) {
  const todayDelivered = history.filter(o =>
    DELIVERED.includes(o.status) && isToday(o.deliveredAt || o.updatedAt)
  );
  const cashCollected = todayDelivered.reduce(
    (sum, o) => sum + (o.paymentMethod === 'Espèces' ? (o.total || 0) : 0),
    0
  );
  return {
    delivered: todayDelivered.length,
    earnings: todayDelivered.length * DELIVERY_FEE,
    cashCollected,
  };
}

// ─── Delivery confirmation modal ────────────────────────────────────────────

function DeliverModal({ order, onConfirm, onClose }) {
  const isCOD = order.paymentMethod === 'Espèces';
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaCheckCircle className="text-green-600 text-3xl" />
          </div>
          <h2 className="font-bold text-xl text-gray-800 mb-1">Confirm Delivery</h2>
          <p className="text-gray-500 text-sm">
            Order <span className="font-bold text-indigo-700">#{order.orderNumber}</span> — {order.customer.name}
          </p>
          {isCOD && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
              Collect <span className="font-bold text-base">{order.total} DT</span> cash from customer
            </div>
          )}
        </div>
        <div className="flex gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700"
          >
            Mark Delivered
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NRP / Retour / Annulé modal ────────────────────────────────────────────

const STATUS_STYLES = {
  NRP:    'bg-yellow-100 border-yellow-400 text-yellow-800',
  Retour: 'bg-orange-100 border-orange-400 text-orange-800',
  Annulé: 'bg-red-100 border-red-400 text-red-800',
};

function StatusModal({ order, initialStatus, onConfirm, onClose }) {
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-gray-800">Update Delivery Status</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <FaTimes />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
            <span className="font-bold text-indigo-700">#{order.orderNumber}</span> — {order.customer.name}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Reason</label>
            <div className="grid grid-cols-3 gap-2">
              {['NRP', 'Retour', 'Annulé'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                    status === s ? STATUS_STYLES[s] : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Customer not home, will retry tomorrow…"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(status, note)}
            className="flex-1 py-2.5 rounded-xl bg-gray-800 text-white font-medium hover:bg-gray-900"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order card ─────────────────────────────────────────────────────────────

function OrderCard({ order, onDeliver, onStatus }) {
  const [showItems, setShowItems] = useState(false);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${order.customer.adresse}, ${order.customer.ville}, Tunisie`
  )}`;

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <span className="font-bold text-lg text-indigo-700 block">#{order.orderNumber}</span>
            <span className="text-xs text-gray-500">
              Assigned {new Date(order.assignedAt || order.createdAt).toLocaleDateString()}
            </span>
          </div>
          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
            {order.status}
          </span>
        </div>

        <div className="space-y-3 mb-4">
          {/* Customer + phones */}
          <div className="flex items-start gap-3">
            <FaUser className="mt-1 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{order.customer.name || 'Unknown'}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                <a
                  href={`tel:${order.customer.telephone}`}
                  className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <FaPhone size={11} /> {order.customer.telephone}
                </a>
                {order.customer.telephone2 && (
                  <a
                    href={`tel:${order.customer.telephone2}`}
                    className="text-sm text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <FaPhone size={11} /> {order.customer.telephone2}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Address + navigate */}
          <div className="flex items-start gap-3">
            <FaMapMarkerAlt className="mt-1 text-gray-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800 font-medium">
                {order.customer.ville}, {order.customer.gouvernerat}
              </p>
              <p className="text-xs text-gray-500 truncate">{order.customer.adresse}</p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <FaDirections size={11} /> Navigate
              </a>
            </div>
          </div>

          {/* Order items (collapsible) */}
          {order.items?.length > 0 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowItems(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                {showItems ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
              </button>
              {showItems && (
                <div className="divide-y divide-gray-50">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between px-3 py-2 text-xs text-gray-600">
                      <span className="truncate mr-2">
                        {item.name || item.designation || item.productName || 'Item'}
                      </span>
                      <span className="shrink-0 font-medium text-gray-800">×{item.quantity || item.qty || 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment */}
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-sm text-gray-500">{order.paymentMethod}</span>
            <span className="font-bold text-gray-800 text-lg">{order.total} DT</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-100">
        <button
          onClick={() => onDeliver(order)}
          className="col-span-2 bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 flex items-center justify-center gap-2 font-medium transition-colors"
        >
          <FaCheckCircle /> Delivered
        </button>
        <button
          onClick={() => onStatus(order, 'NRP')}
          className="bg-orange-100 text-orange-700 py-2 rounded-xl hover:bg-orange-200 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
        >
          <FaClock /> NRP
        </button>
        <button
          onClick={() => onStatus(order, 'Retour')}
          className="bg-red-100 text-red-700 py-2 rounded-xl hover:bg-red-200 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
        >
          <FaTimesCircle /> Return
        </button>
      </div>
    </div>
  );
}

// ─── Main dashboard ──────────────────────────────────────────────────────────

export default function DeliveryDashboard() {
  const { user } = useAuth();
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deliverModal, setDeliverModal] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [deliveriesRes, historyRes] = await Promise.all([
        api.get('/internal-delivery/my-deliveries'),
        api.get('/internal-delivery/my-history'),
      ]);
      setMyDeliveries(deliveriesRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const todayStats = computeTodayStats(history);

  const confirmDelivered = async () => {
    try {
      await api.put(`/internal-delivery/${deliverModal._id}/deliver`);
      setDeliverModal(null);
      fetchAll();
    } catch {
      alert('Error updating status');
    }
  };

  const confirmStatusUpdate = async (status, note) => {
    try {
      await api.put(`/internal-delivery/${statusModal.order._id}/status`, { status, note });
      setStatusModal(null);
      fetchAll();
    } catch {
      alert('Error updating status');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Delivery Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome, {user.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/delivery-scan')}
            className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-xl hover:bg-indigo-50 font-medium text-sm"
            title="Scan to pick up / assign an order"
          >
            <FaQrcode /> Pick up
          </button>
          <button
            onClick={() => navigate('/delivery-handover-scan')}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 font-medium text-sm"
            title="Scan before handing the package to the customer"
          >
            <FaQrcode /> Deliver
          </button>
        </div>
      </div>

      {/* Today's strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <FaTruck />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800 leading-tight">{myDeliveries.length}</div>
            <div className="text-xs text-gray-500">Active</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
            <FaCheckCircle />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800 leading-tight">{todayStats.delivered}</div>
            <div className="text-xs text-gray-500">Delivered today</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <FaMoneyBillWave />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800 leading-tight">{todayStats.earnings} DT</div>
            <div className="text-xs text-gray-500">Earnings today</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
            <FaHandHoldingUsd />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800 leading-tight">{todayStats.cashCollected} DT</div>
            <div className="text-xs text-gray-500">Cash collected today</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : myDeliveries.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FaBoxOpen className="text-5xl mx-auto mb-3 opacity-40" />
          <p className="text-sm">No active deliveries. Scan an order to get started.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {myDeliveries.length} active order{myDeliveries.length !== 1 ? 's' : ''}
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myDeliveries.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                onDeliver={setDeliverModal}
                onStatus={(order, status) => setStatusModal({ order, initialStatus: status })}
              />
            ))}
          </div>
        </>
      )}

      {deliverModal && (
        <DeliverModal
          order={deliverModal}
          onConfirm={confirmDelivered}
          onClose={() => setDeliverModal(null)}
        />
      )}

      {statusModal && (
        <StatusModal
          order={statusModal.order}
          initialStatus={statusModal.initialStatus}
          onConfirm={confirmStatusUpdate}
          onClose={() => setStatusModal(null)}
        />
      )}
    </div>
  );
}
