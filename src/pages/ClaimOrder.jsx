import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaBox, FaUser, FaCheckCircle, FaArrowLeft, FaExclamationTriangle } from 'react-icons/fa';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function ClaimOrder() {
  const { id } = useParams(); // Should be OrderNumber or ID
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState('');
  
  // 1. Fetch Order Details to preview
  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
        // Try to find by ID or OrderNumber. Since API usually takes ID, 
        // we might need a lookup if 'id' is orderNumber.
        // Assuming scanned value is what we have.
        // If the scan is OrderID, great. If OrderNumber, we need a lookup.
        // Let's assume the QR contains the Order ID or a searchable field.
        // Or we can use the /internal-delivery/assign endpoint logic which searches by OrderNumber OR ID.
        // For preview, let's try to fetch by ID. If it fails, maybe we need a dedicated lookup endpoint?
        // Actually, let's use the standard getOrder if it's an ID.
        
        try {
            const res = await api.get(`/orders/${id}`);
            return res.data?.data || res.data;
        } catch (e) {
            // If ID fetch failed, maybe it is a custom Order Number string?
            // Usually getOrder requires ObjectID.
            // Let's implement a lookup wrapper or assume we scan MongoDB Ids.
            // But usually barcodes are OrderNumbers (strings).
            // Let's use a search API or `getOrders?search=id`?
            throw e;
        }
    },
    retry: false
  });

  // Assign Mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
        // Use the existing assign endpoint
        const res = await api.post('/internal-delivery/assign', { orderIdentifier: id });
        return res.data;
    },
    onSuccess: (data) => {
        toast.success(`Order ${data.order?.orderNumber} claimed!`);
        queryClient.invalidateQueries(['my-deliveries']);
        // Redirect to dashboard after brief delay
        setTimeout(() => navigate('/delivery-dashboard'), 1500);
    },
    onError: (err) => {
        setErrorMsg(err.response?.data?.message || 'Assignment failed');
        toast.error('Failed to claim order');
    }
  });

  // Lookup by Search if direct ID fetch fails (Optional/To Do if QR is OrderNumber)
  // For now, assuming the QR Code logic embedded the ID or a lookup-able string.
  // The 'assign' endpoint supports OrderNumber. 'get /orders/:id' requires ID.
  // We need a way to GET order by OrderNumber to preview it before claiming.
  // Let's add a "Preview" state via a new effect or separate component flow?
  // Quick Fix: If we can't load details by ID, we might show "Confirm Claim for Order #{id}" blindly.
  // Better: Add an endpoint to lookup by OrderIdentifier.

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
         <div className="bg-indigo-600 p-4 text-white flex items-center">
             <button onClick={() => navigate('/delivery-scan')} className="mr-4 hover:text-gray-200">
                 <FaArrowLeft />
             </button>
             <h1 className="text-lg font-bold">Confirm Delivery Assignment</h1>
         </div>

         <div className="p-6">
            {isLoading && <div className="text-center py-8">Loading order details...</div>}
            
            {isError && (
                 <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4 flex items-start">
                    <FaExclamationTriangle className="mt-1 mr-2" />
                    <div>
                        <p className="font-bold">Error loading order</p>
                        <p className="text-sm">{error?.response?.data?.message || 'Order verification failed. It might not exist or ID is invalid.'}</p>
                        <p className="text-xs mt-2 text-gray-500">Scanned ID: {id}</p>
                    </div>
                </div>
            )}

            {!isLoading && !isError && order && (
                <div className="space-y-4">
                    <div className="text-center mb-6">
                        <div className="inline-block p-4 bg-indigo-50 rounded-full text-indigo-600 text-3xl mb-3">
                            <FaBox />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">{order.orderNumber}</h2>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${
                            order.status === 'Expédié' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                            Current Status: {order.status}
                        </span>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Customer Info</h3>
                        <p className="font-bold text-lg">{order.customer?.nom || 'Unknown'}</p>
                        <p className="text-gray-600">{order.customer?.adresse}</p>
                        <p className="text-gray-600">{order.customer?.ville}, {order.customer?.gouvernerat}</p>
                        <p className="text-indigo-600 font-medium mt-1">{order.customer?.telephone}</p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start">
                         <FaUser className="text-blue-500 mt-1 mr-3" />
                         <div>
                             <h3 className="text-sm font-bold text-blue-800">Assign to Myself</h3>
                             <p className="text-sm text-blue-700">
                                 You are logged in as <strong>{user.name}</strong>.
                                 Confirming will mark this order as <strong>En cours de livraison</strong> linked to your account.
                             </p>
                         </div>
                    </div>

                    {assignMutation.isError && (
                        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                            {errorMsg}
                        </div>
                    )}

                    {assignMutation.isSuccess ? (
                         <div className="bg-green-100 text-green-800 p-4 rounded-lg text-center font-bold">
                             <FaCheckCircle className="inline mr-2 mb-1" /> Requested Successfully!
                         </div>
                    ) : (
                        <button 
                            onClick={() => assignMutation.mutate()}
                            disabled={assignMutation.isPending}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-lg shadow-md transition-transform transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {assignMutation.isPending ? 'Confirming...' : 'CONFIRM ASSIGNMENT'}
                        </button>
                    )}
                </div>
            )}
            
            {/* Fallback if order load fails but we want to force try? */}
            {isError && (
                 <button 
                    onClick={() => assignMutation.mutate()}
                    className="w-full mt-4 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold"
                >
                    Try to Claim Anyway (Use Identifier)
                </button>
            )}
         </div>
      </div>
    </div>
  );
}
