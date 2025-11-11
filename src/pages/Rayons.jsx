import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rayonService } from '../services';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import Modal from '../components/Modal';

export default function Rayons() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRayon, setEditingRayon] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', location: '', description: '' });
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['rayons'],
    queryFn: async () => {
      const response = await rayonService.getAll();
      return response.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: rayonService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['rayons']);
      toast.success('Rayon created successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create rayon');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => rayonService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rayons']);
      toast.success('Rayon updated successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update rayon');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: rayonService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['rayons']);
      toast.success('Rayon deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete rayon');
    }
  });

  const openModal = (rayon = null) => {
    if (rayon) {
      setEditingRayon(rayon);
      setFormData({ 
        name: rayon.name, 
        code: rayon.code, 
        location: rayon.location || '',
        description: rayon.description || '' 
      });
    } else {
      setEditingRayon(null);
      setFormData({ name: '', code: '', location: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRayon(null);
    setFormData({ name: '', code: '', location: '', description: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingRayon) {
      updateMutation.mutate({ id: editingRayon._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this rayon?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <div className="loading">Loading rayons...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rayons</h1>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FaPlus /> Add Rayon
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Location</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((rayon) => (
                <tr key={rayon._id}>
                  <td><strong>{rayon.code}</strong></td>
                  <td>{rayon.name}</td>
                  <td>{rayon.location || '-'}</td>
                  <td>{rayon.description || '-'}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-secondary" 
                      onClick={() => openModal(rayon)}
                      style={{ marginRight: '8px' }}
                    >
                      <FaEdit /> Edit
                    </button>
                    <button 
                      className="btn btn-sm btn-danger" 
                      onClick={() => handleDelete(rayon._id)}
                    >
                      <FaTrash /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingRayon ? 'Edit Rayon' : 'Add Rayon'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Code *</label>
            <input
              type="text"
              className="form-control"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              className="form-control"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {editingRayon ? 'Update' : 'Create'} Rayon
          </button>
        </form>
      </Modal>
    </div>
  );
}
