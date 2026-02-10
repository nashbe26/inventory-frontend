import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaQrcode, FaArrowLeft, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

export default function DeliveryScan() {
  const [scanInput, setScanInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [message, setMessage] = useState('');
  const [assignedBordereau, setAssignedBordereau] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Focus input automatically for hardware scanners
    const focusInput = () => inputRef.current?.focus();
    focusInput();
    window.addEventListener('click', focusInput);
    
    // Cleanup must be careful not to fight user interactions if they click elsewhere
    // For a dedicated scan page this is usually fine.
    return () => window.removeEventListener('click', focusInput);
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    const code = scanInput.trim();
    if (!code) return;

    setStatus('processing');
    setAssignedBordereau(null);
    
    // Check if it's a URL and extract 
    const isUrl = code.includes('/claim-');
    if (isUrl) {
        if (code.includes('/claim-bordereau/')) {
            const parts = code.split('/claim-bordereau/');
            if (parts[1]) {
                 // Remove any potential hash or query params
                 const cleanPart = parts[1].split('?')[0].split('#')[0];
                 navigate(`/claim-bordereau/${cleanPart}`);
                 return;
            }
        } else if (code.includes('/claim-order/')) {
             const parts = code.split('/claim-order/');
             if (parts[1]) {
                 const cleanPart = parts[1].split('?')[0].split('#')[0];
                 navigate(`/claim-order/${cleanPart}`);
                 return;
             }
        }
    }

    // Check if it's a Bordereau code (legacy text scan)
    const isBordereau = code.startsWith('BRD-') || code.startsWith('M-'); // Assuming Manifest prefix
    setMessage(isBordereau ? 'Locating Manifest...' : 'Locating Order...');

    // If text scan, redirect to appropriate claim page (don't auto-assign blindly)
    if (isBordereau) {
        navigate(`/claim-bordereau/${code}`);
    } else {
        navigate(`/claim-order/${code}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/delivery-dashboard')} className="mb-4 text-gray-600 flex items-center hover:text-gray-900">
           <FaArrowLeft className="mr-2" /> Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold mb-8 text-center">Scan Order or Bordereau</h1>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            <div className="mb-6 flex justify-center text-4xl text-indigo-500">
                <FaQrcode />
            </div>

            <form onSubmit={handleScan}>
                <input
                    ref={inputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Scan QR/Barcode..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-center text-lg"
                    autoComplete="off"
                />
                <button type="submit" className="hidden">Submit</button>
            </form>
            
            <p className="mt-4 text-center text-sm text-gray-500">
                Scan an Order ID to assign single order, or a Bordereau Code (BRD-...) to claim a batch.
            </p>
        </div>

        {status === 'success' && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start animate-fade-in-up">
                <FaCheckCircle className="text-green-500 mt-1 mr-3 text-xl flex-shrink-0" />
                <div>
                    <h3 className="font-bold text-green-800">Assign Success</h3>
                    <p className="text-green-700">{message}</p>
                    {assignedOrder && (
                        <div className="mt-2 text-sm text-green-800">
                            <p>Order: {assignedOrder.orderNumber}</p>
                            <p>Customer: {assignedOrder.customer?.nom}</p>
                        </div>
                    )}
                    {assignedBordereau && (
                        <div className="mt-2 text-sm text-green-800">
                            <p>Bordereau: {assignedBordereau.code}</p>
                            <p>Orders Count: {assignedBordereau.orders?.length}</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {status === 'error' && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start animate-fade-in-up">
                <FaExclamationTriangle className="text-red-500 mt-1 mr-3 text-xl flex-shrink-0" />
                <div>
                    <h3 className="font-bold text-red-800">Assignment Failed</h3>
                    <p className="text-red-700">{message}</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
