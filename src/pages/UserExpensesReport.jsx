import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FaUsers, 
  FaFilter, 
  FaCalendarAlt, 
  FaListAlt,
  FaChevronDown,
  FaChevronUp,
  FaMoneyBillWave,
  FaSearch,
  FaFileInvoice,
  FaDownload
} from 'react-icons/fa';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../services/api';

const UserExpenseCard = ({ userGroup }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 transition-all hover:shadow-md">
      {/* Header Summary */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl uppercase">
            {userGroup.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg">{userGroup.name}</h3>
            <p className="text-sm text-gray-500">{userGroup.count} transactions</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
           <div className="text-right">
             <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Dépensé</p>
             <p className="text-xl font-bold text-gray-900 font-mono">{userGroup.totalAmount.toLocaleString('fr-FR')} DA</p>
           </div>
           
           <div className="text-right hidden md:block">
             <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Moyenne / Achat</p>
             <p className="text-lg font-medium text-gray-600 font-mono">{Math.round(userGroup.avgTransaction).toLocaleString('fr-FR')} DA</p>
           </div>
           
           <div className="text-gray-400">
             {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
           </div>
        </div>
      </div>

      {/* Expanded Details Table */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-500 uppercase bg-gray-100/50 border-b border-gray-200">
                 <tr>
                   <th className="px-4 py-3 font-medium">Date</th>
                   <th className="px-4 py-3 font-medium">Fournisseur</th>
                   <th className="px-4 py-3 font-medium">Description / Produit</th>
                   <th className="px-4 py-3 font-medium text-right">Montant</th>
                   <th className="px-4 py-3 font-medium text-center">Statut</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 bg-white">
                 {userGroup.transactions.map((tx) => (
                   <tr key={tx._id} className="hover:bg-gray-50">
                     <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                       {format(new Date(tx.date), 'dd/MM/yyyy', { locale: fr })}
                     </td>
                     <td className="px-4 py-3 font-medium text-indigo-600">
                       {tx.supplierName}
                     </td>
                     <td className="px-4 py-3 text-gray-700">
                       {tx.title}
                       {tx.productRef && <span className="block text-xs text-gray-400 truncate">{tx.productRef}</span>}
                     </td>
                     <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                       {tx.amount.toLocaleString('fr-FR')} DA
                     </td>
                     <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          tx.paidAmount >= tx.amount ? 'bg-green-100 text-green-700 border-green-200' :
                          tx.paidAmount > 0 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                          'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          {tx.paidAmount >= tx.amount ? 'Payé' : 'Dette'}
                        </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default function UserExpensesReport() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch Grouped Data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['expenses-by-user', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      
      const res = await api.get(`/expenses/stats/by-user?${params.toString()}`);
      return res.data.data;
    }
  });

  const filteredData = useMemo(() => {
    if (!reportData) return [];
    if (!searchTerm) return reportData;
    const lowerTerm = searchTerm.toLowerCase();
    return reportData.filter(group => 
      group.name.toLowerCase().includes(lowerTerm) || 
      group.transactions.some(tx => tx.supplierName.toLowerCase().includes(lowerTerm))
    );
  }, [reportData, searchTerm]);

  // Calculate Totals
  const grandTotal = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + curr.totalAmount, 0);
  }, [filteredData]);

  const exportToCSV = () => {
    if (!filteredData.length) return;
    
    // CSV Header
    const headers = ["Utilisateur", "Date", "Fournisseur", "Description", "Montant Total", "Montant Payé"];
    
     // Helper to escape quotes
    const escape = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

    // Flatten data
    const rows = filteredData.flatMap(group => 
       group.transactions.map(tx => [
         escape(group.name),
         new Date(tx.date).toLocaleDateString(),
         escape(tx.supplierName),
         escape(tx.title + (tx.productRef ? ` - ${tx.productRef}` : '')),
         tx.amount,
         tx.paidAmount
       ])
    );
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rapport_utilisateurs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <FaUsers className="text-indigo-600" />
            Rapport par Utilisateur
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Analyse des dépenses fournisseurs groupées par membre de l'équipe.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-end min-w-[200px]">
           <span className="text-sm text-gray-400 font-semibold uppercase tracking-wider mb-1">Total Global</span>
           <span className="text-3xl font-bold text-indigo-600">{grandTotal.toLocaleString('fr-FR')} <span className="text-lg text-gray-400">DA</span></span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Date Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
           <FaCalendarAlt className="text-gray-400" />
           <div className="flex items-center gap-2">
             <input 
               type="date" 
               value={dateRange.start}
               onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
               className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
             />
             <span className="text-gray-400">-</span>
             <input 
               type="date" 
               value={dateRange.end}
               onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
               className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
             />
           </div>
           {(dateRange.start || dateRange.end) && (
             <button 
               onClick={() => setDateRange({ start: '', end: '' })}
               className="text-xs text-red-500 hover:underline"
             >
               Effacer
             </button>
           )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Rechercher un utilisateur ou fournisseur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors font-medium border border-indigo-200"
        >
          <FaDownload size={14} />
          <span>Exporter</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <FaFileInvoice className="mx-auto text-4xl text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Aucune donnée trouvée</h3>
            <p className="text-gray-500 mt-1">Ajustez vos filtres ou enregistrez des dépenses.</p>
          </div>
        ) : (
          filteredData.map(group => (
            <UserExpenseCard key={group._id} userGroup={group} />
          ))
        )}
      </div>
    </div>
  );
}
