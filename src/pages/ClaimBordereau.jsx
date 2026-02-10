import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaBox, FaUser, FaCheckCircle, FaArrowLeft, FaExclamationTriangle, FaList } from 'react-icons/fa';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function ClaimBordereau() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState('');
  
  // Fetch Bordereau Details
  const { data: bordereau, isLoading, isError, error } = useQuery({
    queryKey: ['bordereau', code],
    queryFn: async () => {
        const res = await api.get(`/bordereaux/code/${code}`);
        return res.data;
    },
    retry: 1
  });

  // Assign Mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
        const res = await api.post('/bordereaux/assign', { code });
        return res.data;
    },
    onSuccess: (data) => {
        toast.success(`Manifest ${code} assigned successfully!`);
        queryClient.invalidateQueries(['my-deliveries']);
        setTimeout(() => navigate('/delivery-dashboard'), 1500);
    },
    onError: (err) => {
        setErrorMsg(err.response?.data?.message || 'Assignment failed');
        toast.error('Failed to claim manifest');
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
         <div className="bg-purple-600 p-4 text-white flex items-center">
             <button onClick={() => navigate('/delivery-scan')} className="mr-4 hover:text-gray-200">
                 <FaArrowLeft />
             </button>
             <h1 className="text-lg font-bold">Confirm Manifest Assignment</h1>
         </div>

         <div className="p-6">
            {isLoading && <div className="text-center py-8">Loading manifest details...</div>}
            
            {isError && (
                 <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4 flex items-start">
                    <FaExclamationTriangle className="mt-1 mr-2" />
                    <div>
                        <p className="font-bold">Error loading manifest</p>
                        <p className="text-sm">{error?.response?.data?.message || 'Manifest not found.'}</p>
                        <p className="text-xs mt-2 text-gray-500">Code: {code}</p>
                    </div>
                </div>
            )}

            {!isLoading && !isError && bordereau && (
                <div className="space-y-4">
                    <div className="text-center mb-6">
                        <div className="inline-block p-4 bg-purple-50 rounded-full text-purple-600 text-3xl mb-3">
                            <FaList />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">{bordereau.code}</h2>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${
                            bordereau.status === 'Validé' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                            Status: {bordereau.status}
                        </span>
                        <p className="text-gray-500 mt-2">{bordereau.orders?.length || 0} Orders Included</p>
                        <p className="font-bold text-lg">{bordereau.totalAmount?.toFixed(2)} TND Total</p>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex items-start">
                         <FaUser className="text-purple-500 mt-1 mr-3" />
                         <div>
                             <h3 className="text-sm font-bold text-purple-800">Assign to Myself</h3>
                             <p className="text-sm text-purple-700">
                                 You are logged in as <strong>{user.name}</strong>.
                                 Clicking confirm will take responsibility for all orders in this manifest.
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
                             <FaCheckCircle className="inline mr-2 mb-1" /> Assigned Successfully!
                         </div>
                    ) : (
                        <button 
                            onClick={() => assignMutation.mutate()}
                            disabled={assignMutation.isPending || (bordereau.deliveryMan && bordereau.deliveryMan._id !== user._id)}
                            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-lg shadow-md transition-transform transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {assignMutation.isPending ? 'Confirming...' : 
                             bordereau.deliveryMan ? 'Already Assigned' : 'CONFIRM ASSIGNMENT'}
                        </button>
                    )}
                </div>
            )}
         </div>
      </div>
    </div>
  );
}
