import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaEdit, FaTrash, FaWallet, FaDownload, FaTruck, FaUser } from 'react-icons/fa';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import api from '../services/api';

const SOURCES = [
  { value: 'delivery_company', label: 'Société de Livraison', icon: FaTruck, color: '#3b82f6' },
  { value: 'personal_delivery', label: 'Livraison Personnelle', icon: FaUser, color: '#10b981' }
];

const COLORS = ['#3b82f6', '#10b981'];

export default function Recette() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingRecette, setEditingRecette] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [formData, setFormData] = useState({
    amount: '', source: 'personal_delivery', note: '', date: ''
  });

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (sourceFilter) params.append('source', sourceFilter);
    if (dateRange.start) params.append('startDate', dateRange.start);
    if (dateRange.end) params.append('endDate', dateRange.end);
    return params.toString();
  };

  const { data: recetteData, isLoading } = useQuery({
    queryKey: ['recettes', sourceFilter, dateRange],
    queryFn: async () => {
      const params = buildQueryParams();
      const res = await api.get(`/recettes${params ? `?${params}` : ''}`);
      return res.data;
    }
  });

  const { data: statsData } = useQuery({
    queryKey: ['recette-stats'],
    queryFn: async () => {
      const res = await api.get('/recettes/stats');
      return res.data;
    }
  });

  const recipes = recetteData?.data || [];
  const totalAmount = recetteData?.totalAmount || 0;

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!statsData?.data) return [];
    return statsData.data.map(item => ({
      name: item._id === 'delivery_company' ? 'Société Livraison' : 'Livraison Perso',
      value: item.total
    }));
  }, [statsData]);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/recettes', data),
    onSuccess: () => {
      toast.success('Recette ajoutée avec succès!');
      queryClient.invalidateQueries({ queryKey: ['recettes'] });
      queryClient.invalidateQueries({ queryKey: ['recette-stats'] });
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajout');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/recettes/${id}`),
    onSuccess: () => {
      toast.success('Recette supprimée!');
      queryClient.invalidateQueries({ queryKey: ['recettes'] });
      queryClient.invalidateQueries({ queryKey: ['recette-stats'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  });

  const openModal = (recette = null) => {
    if (recette) {
      setEditingRecette(recette); // Edit not fully implemented in backend yet, but UI is ready
      setFormData({
        amount: recette.amount,
        source: recette.source,
        note: recette.note || '',
        date: recette.date ? recette.date.split('T')[0] : ''
      });
    } else {
      setEditingRecette(null);
      setFormData({
        amount: '', source: 'personal_delivery', note: '',
        date: new Date().toISOString().split('T')[0]
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecette(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData, amount: parseFloat(formData.amount) };
    if (editingRecette) {
        // API doesn't support update yet, so mostly create for now
        // updateMutation.mutate({ id: editingRecette._id, data: payload });
        toast.info("Modification non disponible pour le moment");
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette recette?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestion des Recettes</h1>
          <p className="text-gray-600">Suivi des encaissements journaliers</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-md transition-all transform hover:scale-105"
        >
          <FaPlus /> Nouvelle Recette
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-green-100 text-green-600 rounded-full">
              <FaWallet size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase">Total Période</p>
              <h3 className="text-2xl font-bold text-gray-800">{totalAmount.toLocaleString('fr-FR')} DA</h3>
            </div>
          </div>
        </div>
        
        {/* Pie Chart */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => `${value.toLocaleString()} DA`} />
                    <Legend verticalAlign="middle" align="right" layout="vertical" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
             <div className="text-right">
                <span className="text-sm text-gray-400">Répartition par source</span>
            </div>
        </div>
      </div>

      {/* Filters converted to Tabs/Panels */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-2">
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                    onClick={() => setSourceFilter('')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        sourceFilter === '' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Tout
                </button>
                <button
                    onClick={() => setSourceFilter('personal_delivery')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        sourceFilter === 'personal_delivery' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FaUser size={12}/> Livraison Perso
                </button>
                <button
                    onClick={() => setSourceFilter('delivery_company')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        sourceFilter === 'delivery_company' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FaTruck size={12}/> Société Livraison
                </button>
            </div>
            
            <div className="flex items-center gap-2">
                <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-gray-400">-</span>
                <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Source</th>
                <th className="px-6 py-4 font-medium">Montant</th>
                <th className="px-6 py-4 font-medium">Note</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan="5" className="text-center py-8">Chargement...</td></tr>
              ) : recipes.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-8 text-gray-400">Aucune recette trouvée</td></tr>
              ) : (
                recipes.map((recette) => (
                  <tr key={recette._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600 decoration-gray-400 font-mono text-sm">
                      {new Date(recette.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        recette.source === 'delivery_company' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {recette.source === 'delivery_company' ? 'Société Livraison' : 'Livraison Perso'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-gray-800">
                      {recette.amount.toLocaleString('fr-FR')} DA
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm max-w-xs truncate">
                      {recette.note || '-'}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => handleDelete(recette._id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingRecette ? "Modifier Recette" : "Nouvelle Recette"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <div className="grid grid-cols-2 gap-4">
              {SOURCES.map((source) => (
                <button
                  key={source.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, source: source.value })}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    formData.source === source.value
                      ? `border-indigo-600 bg-indigo-50 text-indigo-700`
                      : 'border-gray-200 hover:border-gray-300 text-gray-500'
                  }`}
                >
                  <source.icon className="text-2xl mb-2" />
                  <span className="text-sm font-medium">{source.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant (DA)</label>
            <input
              type="number"
              required
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note / Description</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 resize-none"
              placeholder="Détails optionnels..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
