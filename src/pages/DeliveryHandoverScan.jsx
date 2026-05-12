import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
  FaQrcode, FaArrowLeft, FaCheckCircle, FaExclamationTriangle,
  FaUser, FaPhone, FaMapMarkerAlt, FaDirections, FaTimesCircle,
  FaClock, FaTimes, FaBoxOpen, FaRedo
} from 'react-icons/fa';

const COMPLETED = ['Livré', 'Livrée', 'Annulé', 'Annulée', 'Retour', 'NRP'];

const STATUS_STYLES = {
  NRP:    'bg-yellow-100 border-yellow-400 text-yellow-800',
  Retour: 'bg-orange-100 border-orange-400 text-orange-800',
  Annulé: 'bg-red-100 border-red-400 text-red-800',
};

// ─── Not-delivered reason modal ─────────────────────────────────────────────

function NotDeliveredModal({ order, onConfirm, onClose }) {
  const [status, setStatus] = useState('NRP');
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-gray-800">Why not delivered?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <FaTimes />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
            <span className="font-bold text-indigo-700">#{order.orderNumber}</span> — {order.customer?.name}
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
              placeholder="e.g. Customer refused package…"
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

// ─── Main scan page ─────────────────────────────────────────────────────────

export default function DeliveryHandoverScan() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [scanInput, setScanInput] = useState('');
  const [phase, setPhase] = useState('scanning'); // scanning | loading | preview | done
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [doneResult, setDoneResult] = useState(null); // { type: 'delivered'|'not_delivered', label }
  const [showNotDelivered, setShowNotDelivered] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (phase === 'scanning') inputRef.current?.focus();
  }, [phase]);

  const extractIdentifier = (raw) => {
    const code = raw.trim();
    if (!code) return null;
    // If a claim URL was scanned, extract the trailing identifier
    if (code.includes('/claim-order/')) {
      const parts = code.split('/claim-order/');
      return parts[1]?.split('?')[0].split('#')[0] || code;
    }
    return code;
  };

  const handleScan = async (e) => {
    e.preventDefault();
    const identifier = extractIdentifier(scanInput);
    if (!identifier) return;

    setPhase('loading');
    setError('');

    try {
      const res = await api.get(`/internal-delivery/lookup/${encodeURIComponent(identifier)}`);
      setOrder(res.data.order);
      if (res.data.isCompleted) {
        setError(`This order is already marked as "${res.data.order.status}"`);
      }
      setPhase('preview');
    } catch (err) {
      setError(err.response?.data?.message || 'Order not found');
      setPhase('scanning');
      setScanInput('');
    }
  };

  const handleDelivered = async () => {
    setSubmitting(true);
    try {
      await api.put(`/internal-delivery/${order._id}/deliver`);
      setDoneResult({ type: 'delivered', label: 'Marked as delivered' });
      setPhase('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark as delivered');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotDelivered = async (status, note) => {
    setSubmitting(true);
    try {
      await api.put(`/internal-delivery/${order._id}/status`, { status, note });
      setDoneResult({ type: 'not_delivered', label: `Marked as ${status}` });
      setShowNotDelivered(false);
      setPhase('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForNextScan = () => {
    setScanInput('');
    setOrder(null);
    setError('');
    setDoneResult(null);
    setPhase('scanning');
  };

  const mapsUrl = order
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${order.customer?.adresse || ''}, ${order.customer?.ville || ''}, Tunisie`
      )}`
    : '#';

  const alreadyCompleted = order && COMPLETED.includes(order.status);

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/delivery-dashboard')}
          className="mb-4 text-gray-600 flex items-center hover:text-gray-900"
        >
          <FaArrowLeft className="mr-2" /> Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold mb-1 text-center">Scan to Deliver</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Scan the order before handing it to the customer
        </p>

        {/* ─── Scanning state ───────────────────────────────────────────────── */}
        {phase === 'scanning' && (
          <>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="mb-6 flex justify-center text-4xl text-indigo-500">
                <FaQrcode />
              </div>

              <form onSubmit={handleScan}>
                <input
                  ref={inputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Scan QR / Order #"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-center text-lg"
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" className="hidden">Submit</button>
              </form>

              <p className="mt-4 text-center text-xs text-gray-500">
                Auto-focused for hardware scanners
              </p>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
                <FaExclamationTriangle className="text-red-500 mt-0.5 mr-3 shrink-0" />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
          </>
        )}

        {/* ─── Loading state ────────────────────────────────────────────────── */}
        {phase === 'loading' && (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="animate-pulse text-gray-400">Looking up order…</div>
          </div>
        )}

        {/* ─── Preview state (show order, deliver buttons) ──────────────────── */}
        {phase === 'preview' && order && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between">
              <div>
                <div className="text-xl font-bold text-indigo-700">#{order.orderNumber}</div>
                <div className="text-xs text-gray-500">
                  Assigned {new Date(order.assignedAt || order.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                alreadyCompleted ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {order.status}
              </span>
            </div>

            <div className="p-5 space-y-4">
              {alreadyCompleted && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-sm text-amber-800">
                  <FaExclamationTriangle className="mt-0.5 shrink-0" />
                  <span>This order is already completed. You can't update it again.</span>
                </div>
              )}

              <div className="flex items-start gap-3">
                <FaUser className="mt-1 text-gray-400 shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">{order.customer?.name || 'Unknown'}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    {order.customer?.telephone && (
                      <a href={`tel:${order.customer.telephone}`} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                        <FaPhone size={11} /> {order.customer.telephone}
                      </a>
                    )}
                    {order.customer?.telephone2 && (
                      <a href={`tel:${order.customer.telephone2}`} className="text-sm text-indigo-400 hover:underline flex items-center gap-1">
                        <FaPhone size={11} /> {order.customer.telephone2}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FaMapMarkerAlt className="mt-1 text-gray-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 font-medium">
                    {order.customer?.ville}, {order.customer?.gouvernerat}
                  </p>
                  <p className="text-xs text-gray-500">{order.customer?.adresse}</p>
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

              {order.items?.length > 0 && (
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 flex items-center gap-2">
                    <FaBoxOpen size={11} /> {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </div>
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

              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-sm text-gray-500">{order.paymentMethod}</span>
                <span className="font-bold text-gray-800 text-lg">{order.total} DT</span>
              </div>

              {order.paymentMethod === 'Espèces' && !alreadyCompleted && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
                  Collect <span className="font-bold">{order.total} DT</span> cash from customer
                </div>
              )}
            </div>

            {/* Action buttons */}
            {!alreadyCompleted && (
              <div className="grid grid-cols-1 gap-2 p-5 border-t border-gray-100">
                <button
                  onClick={handleDelivered}
                  disabled={submitting}
                  className="bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
                >
                  <FaCheckCircle /> Delivered
                </button>
                <button
                  onClick={() => setShowNotDelivered(true)}
                  disabled={submitting}
                  className="bg-red-50 text-red-700 py-3 rounded-xl hover:bg-red-100 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors border border-red-200"
                >
                  <FaTimesCircle /> Not Delivered
                </button>
                <button
                  onClick={resetForNextScan}
                  className="text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  Cancel — scan another order
                </button>
              </div>
            )}

            {alreadyCompleted && (
              <div className="p-5 border-t border-gray-100">
                <button
                  onClick={resetForNextScan}
                  className="w-full bg-gray-800 text-white py-3 rounded-xl hover:bg-gray-900 flex items-center justify-center gap-2 font-medium"
                >
                  <FaQrcode /> Scan another order
                </button>
              </div>
            )}

            {error && !alreadyCompleted && (
              <div className="px-5 pb-5">
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {error}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Done state ───────────────────────────────────────────────────── */}
        {phase === 'done' && doneResult && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              doneResult.type === 'delivered' ? 'bg-green-100' : 'bg-orange-100'
            }`}>
              {doneResult.type === 'delivered'
                ? <FaCheckCircle className="text-green-600 text-4xl" />
                : <FaClock className="text-orange-600 text-4xl" />}
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">{doneResult.label}</h2>
            <p className="text-sm text-gray-500 mb-6">
              Order <span className="font-bold text-indigo-700">#{order?.orderNumber}</span>
            </p>
            <button
              onClick={resetForNextScan}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2 font-medium"
            >
              <FaRedo /> Scan next order
            </button>
          </div>
        )}
      </div>

      {showNotDelivered && order && (
        <NotDeliveredModal
          order={order}
          onConfirm={handleNotDelivered}
          onClose={() => setShowNotDelivered(false)}
        />
      )}
    </div>
  );
}
