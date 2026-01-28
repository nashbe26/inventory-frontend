import { useQuery } from '@tanstack/react-query';
import { 
  FaChartLine, 
  FaArrowUp, 
  FaArrowDown, 
  FaMoneyBillWave, 
  FaShoppingCart, 
  FaTruckLoading, 
  FaWallet 
} from 'react-icons/fa';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import api from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// --- Components ---

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, type = 'neutral' }) => {
  const types = {
    positive: 'text-green-600 bg-green-50 border-green-200',
    negative: 'text-red-600 bg-red-50 border-red-200',
    neutral: 'text-blue-600 bg-blue-50 border-blue-200',
    warning: 'text-orange-600 bg-orange-50 border-orange-200',
    info: 'text-indigo-600 bg-indigo-50 border-indigo-200'
  };

  return (
    <div className={`p-6 rounded-xl border ${types[type]} shadow-sm transition-all hover:shadow-md bg-white`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold mt-1 text-gray-800">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
          <Icon className={`text-xl ${colorClass.replace('bg-', 'text-')}`} />
        </div>
      </div>
      {subtext && <p className="text-sm text-gray-500 mt-2">{subtext}</p>}
    </div>
  );
};

const SectionTitle = ({ title }) => (
  <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 border-l-4 border-blue-500 pl-3">
    {title}
  </h2>
);

export default function Analytics() {
  
  // 1. General Dashboard Data (Orders, Revenue)
  const { data: dashboardData } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => api.get('/orders/analytics/dashboard').then(res => res.data.data)
  });

  // 2. Daily Revenue Trend
  const { data: dailyData } = useQuery({
    queryKey: ['analytics-daily'],
    queryFn: () => api.get('/orders/analytics/daily-revenue?days=14').then(res => res.data.data)
  });

  // 3. Operating Expenses (No Suppliers)
  const { data: opExpenses } = useQuery({
    queryKey: ['analytics-expenses-operating'],
    queryFn: () => api.get('/expenses/stats/overview?excludeSuppliers=true').then(res => res.data.data)
  });

  // 4. Supplier Expenses (Inventory/COGS)
  const { data: supExpenses } = useQuery({
    queryKey: ['analytics-expenses-suppliers'],
    queryFn: () => api.get('/expenses/stats/overview?onlySuppliers=true').then(res => res.data.data)
  });

  // 5. Top Products
  const { data: topProducts } = useQuery({
    queryKey: ['analytics-top-products'],
    queryFn: () => api.get('/orders/analytics/top-selling?period=30&limit=5').then(res => res.data.data)
  });

  // --- Calculations ---

  // Monthly Financial Overview
  const revenueMonth = dashboardData?.month?.revenue || 0;
  const opExMonth = opExpenses?.month?.total || 0;
  const supExMonth = supExpenses?.month?.total || 0;
  const totalCostMonth = opExMonth + supExMonth;
  const netProfitMonth = revenueMonth - totalCostMonth;
  const profitMargin = revenueMonth > 0 ? ((netProfitMonth / revenueMonth) * 100).toFixed(1) : 0;

  // Chart Data Preparation
  const costBreakdownData = [
    { name: 'Dépenses Opérationnelles', value: opExMonth },
    { name: 'Achats Fournisseurs', value: supExMonth }
  ].filter(d => d.value > 0);

  const profitCompositionData = [
    { name: 'Coûts (Op + Fourn)', value: totalCostMonth },
    { name: 'Marge Nette', value: Math.max(0, netProfitMonth) }
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FaChartLine className="text-blue-600" /> 
            Analytics Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Vue d'ensemble de la performance financière (Ce mois-ci)</p>
        </div>
        <div className="px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 text-sm font-medium text-gray-600">
           {new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* --- Key Metrics (Current Month) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        
        <StatCard 
          title="Chiffre d'Affaires" 
          value={`${revenueMonth.toLocaleString()} DA`}
          subtext={`${dashboardData?.month?.count || 0} commandes livrées`}
          icon={FaMoneyBillWave}
          colorClass="text-green-600 bg-green-100"
          type="positive" // Green
        />

        <StatCard 
          title="Coûts Fournisseurs" 
          value={`${supExMonth.toLocaleString()} DA`}
          subtext="Achats de stock & Matière première"
          icon={FaTruckLoading}
          colorClass="text-orange-600 bg-orange-100"
          type="warning" // Orange
        />

        <StatCard 
          title="Dépenses Opérationnelles" 
          value={`${opExMonth.toLocaleString()} DA`}
          subtext="Salaires, Loyer, Pub..."
          icon={FaWallet}
          colorClass="text-blue-600 bg-blue-100"
          type="neutral" // Blue
        />

        <StatCard 
          title="Bénéfice Net (Estimé)" 
          value={`${netProfitMonth.toLocaleString()} DA`}
          subtext={`Marge: ${profitMargin}%`}
          icon={FaChartLine}
          colorClass={netProfitMonth >= 0 ? "text-indigo-600 bg-indigo-100" : "text-red-600 bg-red-100"}
          type={netProfitMonth >= 0 ? "info" : "negative"} // Purple or Red
        />
      </div>

      {/* --- Visualizations Grid --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        
        {/* 1. Daily Revenue Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <SectionTitle title="Évolution du Chiffre d'Affaires (14 derniers jours)" />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="_id" tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} 
                  formatter={(value) => [`${value} DA`, 'Revenu']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Cost Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <SectionTitle title="Répartition des Coûts (Ce mois)" />
          <div className="h-80 flex items-center justify-center">
             {totalCostMonth > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                  <Pie
                    data={costBreakdownData}
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {costBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#3B82F6' : '#F97316'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toLocaleString()} DA`} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                 </PieChart>
               </ResponsiveContainer>
             ) : (
               <div className="text-gray-400 text-center">Aucune dépense enregistrée ce mois-ci.</div>
             )}
          </div>
        </div>
      </div>

      {/* --- Detailed Breakdowns --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Top Products */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <SectionTitle title="Top Produits (Ventes)" />
          <div className="overflow-x-auto">
             <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Produit</th>
                    <th className="px-4 py-3 text-center">Quantité</th>
                    <th className="px-4 py-3 text-right">Revenu Généré</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topProducts?.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{p.productInfo?.name || 'Produit Inconnu'}</td>
                      <td className="px-4 py-3 text-center text-gray-600 bg-gray-50 rounded mx-auto w-min whitespace-nowrap">{p.totalQuantity} unités</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600 font-semibold">{p.totalRevenue.toLocaleString()} DA</td>
                    </tr>
                  ))}
                  {(!topProducts || topProducts.length === 0) && (
                     <tr><td colSpan="3" className="text-center py-4 text-gray-400">Aucune donnée disponible.</td></tr>
                  )}
                </tbody>
             </table>
          </div>
        </div>

        {/* Operating Expenses Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <SectionTitle title="Détail Charges (Opérations)" />
          <div className="space-y-4">
             {opExpenses?.byCategory?.slice(0, 6).map((cat, idx) => (
               <div key={idx} className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-gray-600 text-sm capitalize">{cat.category.replace('_', ' ')}</span>
                 </div>
                 <span className="font-semibold text-gray-800 text-sm">{cat.total.toLocaleString()} DA</span>
               </div>
             ))}
             {opExpenses?.byCategory?.length === 0 && (
               <p className="text-gray-400 text-center py-4">Aucune charge opérationnelle.</p>
             )}
          </div>
        </div>

      </div>

    </div>
  );
}
