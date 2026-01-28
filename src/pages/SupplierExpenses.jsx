import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FaPlus, 
  FaSearch,
  FaMoneyBillWave, 
  FaExchangeAlt,
  FaChevronDown, 
  FaChevronUp, 
  FaFileInvoiceDollar,
  FaHandHoldingUsd,
  FaCheckCircle,
  FaExclamationCircle,
  FaHistory,
  FaPhone,
  FaEnvelope
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Modal from '../components/Modal';
import api from '../services/api';

// --- Small UI Components ---

const Badge = ({ type, children }) => {
  const styles = {
    payé: 'bg-green-100 text-green-800 border-green-200',
    partiel: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'non payé': 'bg-red-100 text-red-800 border-red-200',
    avance: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    neutral: 'bg-gray-100 text-gray-800 border-gray-200'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${styles[type] || styles.neutral}`}>
      {children}
    </span>
  );
};

const StatCard = ({ title, amount, icon: Icon, colorClass }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between transition-all hover:shadow-md">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{amount.toLocaleString('fr-FR')} <span className="text-sm font-normal text-gray-400">DA</span></h3>
    </div>
    <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
      <Icon className={`text-xl ${colorClass.replace('bg-', 'text-')}`} />
    </div>
  </div>
);

const ProgressBar = ({ paid, total }) => {
  const percentage = total > 0 ? Math.min((paid / total) * 100, 100) : 100;
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
      <div 
        className={`h-full transition-all duration-500 rounded-full ${percentage >= 100 ? 'bg-indigo-500' : 'bg-green-500'}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// --- History Table Component ---

const SupplierHistory = ({ supplierId }) => {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['supplier-transactions', supplierId],
    queryFn: async () => {
      const res = await api.get(`/expenses/suppliers/${supplierId}/transactions`);
      return res.data.data;
    }
  });

  if (isLoading) return <div className="p-8 text-center text-gray-400 animate-pulse">Chargement de l'historique...</div>;

  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <FaHistory className="mx-auto text-gray-300 text-3xl mb-2" />
        <p className="text-gray-500">Aucune transaction trouvée.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg mt-4 border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
             <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
             <th className="px-4 py-3 text-left font-semibold text-gray-600">Produit / Description</th>
             <th className="px-4 py-3 text-right font-semibold text-gray-600">Montant Total</th>
             <th className="px-4 py-3 text-right font-semibold text-gray-600">Payé</th>
             <th className="px-4 py-3 text-center font-semibold text-gray-600">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {transactions.map((tx) => (
            <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">
                {format(new Date(tx.date), 'dd MMM yyyy', { locale: fr })}
              </td>
              <td className="px-4 py-3 font-medium text-gray-800">
                {tx.product?.reference || tx.description || 'N/A'}
                {tx.title === 'Règlement dette' && <span className="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">Règlement</span>}
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">
                {tx.amount > 0 ? tx.amount.toLocaleString('fr-FR') : '-'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-green-700 font-medium">
                {tx.paidAmount.toLocaleString('fr-FR')}
              </td>
              <td className="px-4 py-3 text-center">
                <Badge type={tx.paymentStatus}>{tx.paymentStatus}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Main Page Component ---

export default function SupplierExpenses() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  
  // 'achat' = Purchase (Cost + Payment), 'paiement' = Debt Settlement (Only Payment)
  const [transactionType, setTransactionType] = useState('achat'); 

  // Modal Form State
  const [formData, setFormData] = useState({
    fournisseur: '',
    product: '',
    description: '',
    quantity: 1,
    amount: '',
    paidAmount: '',
    paidBy: '', // Added field
    date: new Date().toISOString().split('T')[0]
  });

  const queryClient = useQueryClient();

  // 1. Fetch Suppliers Aggregated Data
  const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['supplier-financials'],
    queryFn: async () => {
      const res = await api.get('/expenses/suppliers/summary');
      return res.data.data.map(item => ({
        ...item,
        searchStr: item.fournisseur.name.toLowerCase()
      }));
    }
  });

  // 2. Fetch Helper Data (Lists for Modal)
  const { data: suppliersList } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/fournisseurs')).data.data
  });

  const { data: usersList } = useQuery({
    queryKey: ['org-users'],
    queryFn: async () => {
      const res = await api.get('/organizations/my/organization');
      const owner = res.data.owner;
      const members = res.data.members?.map(m => m.user) || [];
      // Combine and dedup by ID just in case
      const uniqueUsers = [owner, ...members].filter((v,i,a)=>a.findIndex(v2=>(v2._id===v._id))===i);
      return uniqueUsers;
    }
  });

  const { data: productsList } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products?limit=1000')).data.data
  });

  // Calculate Global Stats
  const stats = useMemo(() => {
    if (!suppliersData) return { totalDebt: 0, totalPaid: 0, netPosition: 0 };
    return suppliersData.reduce((acc, curr) => ({
      totalDebt: acc.totalDebt + curr.details.debt,
      totalPaid: acc.totalPaid + curr.totalPaid,
      netPosition: acc.netPosition + (curr.details.balance)
    }), { totalDebt: 0, totalPaid: 0, netPosition: 0 });
  }, [suppliersData]);

  // Filtered List
  const filteredSuppliers = useMemo(() => {
    if (!suppliersData) return [];
    if (!searchTerm) return suppliersData;
    return suppliersData.filter(s => s.searchStr.includes(searchTerm.toLowerCase()));
  }, [suppliersData, searchTerm]);

  // Expand Toggle
  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Mutation
  const createMutation = useMutation({
    mutationFn: async (newData) => api.post('/expenses', newData),
    onSuccess: () => {
      queryClient.invalidateQueries(['supplier-financials']);
      queryClient.invalidateQueries(['supplier-transactions']);
      toast.success('Dépense enregistrée avec succès');
      setIsModalOpen(false);
      setFormData({
        fournisseur: '', product: '', description: '', quantity: 1, amount: '', paidAmount: '', paidBy: '', date: new Date().toISOString().split('T')[0]
      });
    },
    onError: () => toast.error("Erreur lors de l'enregistrement")
  });

  // Form Handlers
  const handleProductChange = (productId) => {
    const product = productsList?.find(p => p._id === productId);
    if(product) {
      setFormData(prev => ({
        ...prev,
        product: productId,
        fournisseur: product.fournisseur?._id || prev.fournisseur,
        amount: (product.buyingPrice || 0) * prev.quantity, 
        description: `Achat: ${product.reference}`
      }));
    } else {
       setFormData(prev => ({ ...prev, product: productId }));
    }
  };

  const handleQuantityChange = (qty) => {
    const quantity = Number(qty);
    setFormData(prev => {
        const product = productsList?.find(p => p._id === prev.product);
        const newAmount = product ? (product.buyingPrice || 0) * quantity : prev.amount;
        return { ...prev, quantity, amount: newAmount };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // If Payment Only, Amount (Cost) is 0.
    const finalAmount = transactionType === 'paiement' ? 0 : Number(formData.amount);
    const finalPaid = Number(formData.paidAmount);
    
    const product = productsList?.find(p => p._id === formData.product);
    
    const payload = {
        title: formData.description || (transactionType === 'paiement' ? 'Règlement dette' : (product ? `Achat ${product.reference}` : 'Dépense Fournisseur')),
        amount: finalAmount,
        category: transactionType === 'paiement' ? 'payment_processing' : 'inventory_purchase',
        fournisseur: formData.fournisseur,
        paidAmount: finalPaid,
        paidBy: formData.paidBy || undefined, // Send if selected
        date: formData.date,
        description: formData.description,
        paymentStatus: transactionType === 'paiement' ? 'payé' : ((finalAmount - finalPaid) <= 0 ? 'payé' : finalPaid > 0 ? 'partiel' : 'non payé'),
        products: (transactionType === 'achat' && formData.product) ? [{
            product: formData.product,
            quantity: Number(formData.quantity),
            unitPrice: Number(formData.amount) / Number(formData.quantity)
        }] : []
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-slate-800">
      
      {/* Heavy Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestion Fournisseurs</h1>
          <p className="text-gray-500 mt-1">Suivi des achats, paiements et dettes par fournisseur.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Rechercher un fournisseur..." 
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 font-medium"
          >
            <FaPlus size={14} />
            <span>Nouveau</span>
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard 
          title="Dette Totale (Reste à payer)" 
          amount={stats.totalDebt} 
          icon={FaFileInvoiceDollar} 
          colorClass="text-red-600 bg-red-100" 
        />
        <StatCard 
          title="Total Payé (Sorties)" 
          amount={stats.totalPaid} 
          icon={FaMoneyBillWave} 
          colorClass="text-green-600 bg-green-100" 
        />
        <StatCard 
          title="Avances Totales" 
          amount={Math.max(0, suppliersData?.reduce((sum, s) => sum + s.details.advance, 0) || 0)} 
          icon={FaHandHoldingUsd} 
          colorClass="text-indigo-600 bg-indigo-100" 
        />
      </div>

      {/* Main List */}
      <div className="space-y-4">
        {loadingSuppliers ? (
           <div className="space-y-4 animate-pulse">
             {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl shadow-sm"></div>)}
           </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
               <FaSearch className="text-gray-400 text-xl" />
             </div>
             <h3 className="text-lg font-medium text-gray-900">Aucun fournisseur trouvé</h3>
             <p className="text-gray-500 mt-1">Essayez un autre terme de recherche ou ajoutez une dépense.</p>
          </div>
        ) : (
          filteredSuppliers.map((s) => (
            <div 
              key={s.fournisseur._id} 
              className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${expandedId === s.fournisseur._id ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-md'}`}
            >
              {/* Card Header (Clickable) */}
              <div 
                onClick={() => toggleExpand(s.fournisseur._id)}
                className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Supplier Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
                    {s.fournisseur.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{s.fournisseur.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                      <span>{s.count} transactions</span>
                      <span>•</span>
                      <span>Dernière: {format(new Date(s.lastTransaction), 'dd MMM', { locale: fr })}</span>
                    </div>
                  </div>
                </div>

                {/* Middle: Progress & Status */}
                <div className="flex-1 max-w-sm px-4">
                   <div className="flex justify-between text-xs font-semibold mb-1 uppercase tracking-wide">
                     <span className="text-green-600">Payé: {((s.totalPaid / s.totalAmount) * 100).toFixed(0)}%</span>
                     <span className="text-gray-400">Total: {s.totalAmount.toLocaleString()}</span>
                   </div>
                   <ProgressBar paid={s.totalPaid} total={s.totalAmount} />
                </div>

                {/* Right: Key Metric & Chevron */}
                <div className="flex items-center gap-6 justify-end flex-1">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">
                      {s.details.status === 'Dette' ? 'Reste à payer' : s.details.status === 'Avance' ? 'Avance (Solde)' : 'Solde'}
                    </p>
                    <p className={`text-xl font-bold ${
                      s.details.status === 'Dette' ? 'text-red-600' : 
                      s.details.status === 'Avance' ? 'text-indigo-600' : 'text-gray-800'
                    }`}>
                      {s.details.status === 'Dette' ? s.details.debt.toLocaleString() : 
                       s.details.status === 'Avance' ? s.details.advance.toLocaleString() : '0'} 
                       <span className="text-sm font-normal text-gray-400 ml-1">DA</span>
                    </p>
                  </div>
                  <div className={`text-gray-300 transition-transform duration-300 ${expandedId === s.fournisseur._id ? 'rotate-180' : ''}`}>
                    <FaChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === s.fournisseur._id && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-fadeIn">
                  
                  {/* Contact Info Section */}
                  <div className="flex gap-6 mb-6 text-sm text-gray-600 bg-white p-4 rounded-lg border border-gray-100 shadow-sm inline-flex">
                    <div className="flex items-center gap-2">
                       <FaPhone className="text-gray-400" />
                       <span>{s.fournisseur.phone || 'Aucun téléphone'}</span>
                    </div>
                    <div className="w-px h-4 bg-gray-300"></div>
                    <div className="flex items-center gap-2">
                       <FaEnvelope className="text-gray-400" />
                       <span>{s.fournisseur.email || 'Aucun email'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                      <FaExchangeAlt className="text-gray-400" />
                      Historique des transactions
                    </h4>
                  </div>
                  <SupplierHistory supplierId={s.fournisseur._id} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* --- MODAL --- */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Gestion Transaction"
      >
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button
             onClick={() => setTransactionType('achat')}
             className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
               transactionType === 'achat' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
             }`}
          >
            Nouvel Achat
          </button>
          <button
             onClick={() => setTransactionType('paiement')}
             className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
               transactionType === 'paiement' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
             }`}
          >
            Règlement dette
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {transactionType === 'achat' && (
            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 border border-blue-100">
              <FaExclamationCircle className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800 leading-relaxed">
                Si vous sélectionnez un produit, le fournisseur et le prix d'achat seront remplis automatiquement. 
                Sinon, vous pouvez saisir une dépense libre (ex: Transport).
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column: Who & What */}
            <div className="space-y-4">
               {transactionType === 'achat' && (
                 <div className="flex gap-4">
                   <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Produit concerné</label>
                      <div className="relative">
                        <select 
                          value={formData.product}
                          onChange={(e) => handleProductChange(e.target.value)}
                          className="w-full pl-3 pr-10 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        >
                          <option value="">-- Aucun --</option>
                          {productsList?.map(p => (
                            <option key={p._id} value={p._id}> {p.name}</option>
                          ))}
                        </select>
                      </div>
                   </div>
                   <div className="w-24">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qté</label>
                      <input 
                        type="number" 
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                   </div>
                 </div>
               )}

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur <span className="text-red-500">*</span></label>
                 <select 
                    required
                    value={formData.fournisseur}
                    onChange={(e) => setFormData({...formData, fournisseur: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Sélectionner...</option>
                    {suppliersList?.map(f => (
                      <option key={f._id} value={f._id}>{f.name}</option>
                    ))}
                  </select>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                 <input 
                   type="date" 
                   required
                   value={formData.date}
                   onChange={(e) => setFormData({...formData, date: e.target.value})}
                   className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                 />
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Effectué par</label>
                 <select 
                    value={formData.paidBy}
                    onChange={(e) => setFormData({...formData, paidBy: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                  >
                    <option value="">(Moi-même)</option>
                    {usersList?.map(u => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))}
                  </select>
               </div>
            </div>

            {/* Right Column: Financials */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
               {transactionType === 'achat' ? (
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Montant Total (Achat)</label>
                   <div className="relative">
                     <input 
                       type="number" 
                       required
                       min="0"
                       value={formData.amount}
                       onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                       className="w-full pl-3 pr-12 py-2 border rounded-lg font-mono text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                       placeholder="0.00"
                     />
                     <span className="absolute right-3 top-2 text-gray-400 text-sm">DA</span>
                   </div>
                 </div>
               ) : (
                <div className="bg-yellow-50 p-3 rounded mb-2 border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <strong>Note:</strong> Vous remboursez une dette existante. Ce montant sera déduit de la dette du fournisseur.
                    </p>
                </div>
               )}

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                    {transactionType === 'achat' ? 'Montant Payé (Avance)' : 'Montant du Règlement'}
                 </label>
                 <div className="relative">
                   <input 
                     type="number" 
                     required
                     min="0"
                     value={formData.paidAmount}
                     onChange={(e) => setFormData({...formData, paidAmount: Number(e.target.value)})}
                     className="w-full pl-3 pr-12 py-2 border rounded-lg font-mono text-green-700 font-bold focus:ring-2 focus:ring-green-500 outline-none bg-green-50 border-green-200"
                     placeholder="0.00"
                   />
                   <span className="absolute right-3 top-2 text-green-600 text-sm">DA</span>
                 </div>
               </div>

               {transactionType === 'achat' && (
                 <div className="pt-2 border-t border-gray-200 mt-2">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-gray-500">Reste (Dette):</span>
                     <span className={`font-bold font-mono text-lg ${(formData.amount - formData.paidAmount) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                       {(formData.amount - formData.paidAmount).toLocaleString()} DA
                     </span>
                   </div>
                 </div>
               )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
            <textarea 
               value={formData.description}
               onChange={(e) => setFormData({...formData, description: e.target.value})}
               className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
               placeholder={transactionType === 'achat' ? "Détails supplémentaires..." : "Référence virement, chèque..."}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            >
              Annuler
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow hover:shadow-lg transition-all transform active:scale-95 font-medium flex items-center gap-2"
            >
              <FaCheckCircle /> Confirmer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
