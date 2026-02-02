import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaEdit, FaTrash, FaLayerGroup } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import api from '../services/api';

export default function Materials() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [formData, setFormData] = useState({ name: '', status: 'active', description: '' });

  const queryClient = useQueryClient();

  // Fetch materials
  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const res = await api.get('/materials');
      return res.data.data;
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/materials', data),
    onSuccess: () => {
      toast.success('Material created successfully');
      queryClient.invalidateQueries(['materials']);
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create material');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/materials/${id}`, data),
    onSuccess: () => {
      toast.success('Material updated successfully');
      queryClient.invalidateQueries(['materials']);
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update material');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/materials/${id}`),
    onSuccess: () => {
      toast.success('Material deleted successfully');
      queryClient.invalidateQueries(['materials']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete material');
    }
  });

  const handleOpenModal = (material = null) => {
    if (material) {
      setEditingMaterial(material);
      setFormData({ 
        name: material.name, 
        status: material.status,
        description: material.description || '' 
      });
    } else {
      setEditingMaterial(null);
      setFormData({ name: '', status: 'active', description: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMaterial(null);
    setFormData({ name: '', status: 'active', description: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingMaterial) {
      updateMutation.mutate({ id: editingMaterial._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FaLayerGroup className="text-indigo-600" />
          Matières (Tissus)
        </h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <FaPlus /> Nouvelle Matière
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Nom</th>
              <th className="px-6 py-4 font-medium">Statut</th>
              <th className="px-6 py-4 font-medium">Description</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan="4" className="text-center py-8">Chargement...</td></tr>
            ) : materials?.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-8 text-gray-400">Aucune matière trouvée</td></tr>
            ) : (
              materials?.map((material) => (
                <tr key={material._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{material.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      material.status === 'active' ? 'bg-green-100 text-green-700' : 
                      material.status === 'out_of_stock' ? 'bg-red-100 text-red-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {material.status === 'active' ? 'Actif' : 
                       material.status === 'out_of_stock' ? 'En Rupture' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm max-w-xs truncate">{material.description || '-'}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button onClick={() => handleOpenModal(material)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                      <FaEdit />
                    </button>
                    <button onClick={() => handleDelete(material._id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingMaterial ? "Modifier Matière" : "Nouvelle Matière"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la matière</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: Coton, Soie..."
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
             <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
             >
                 <option value="active">Actif</option>
                 <option value="inactive">Inactif</option>
                 <option value="out_of_stock">En Rupture</option>
             </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optionnel)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              Annuler
            </button>
            <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
