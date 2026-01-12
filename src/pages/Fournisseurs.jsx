import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fournisseurService } from '../services';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import Modal from '../components/Modal';

export default function Fournisseurs() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    email: '', 
    phone: '', 
    address: '' 
  });
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['fournisseurs'],
    queryFn: async () => {
      const response = await fournisseurService.getAll();
      return response.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: fournisseurService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['fournisseurs']);
      toast.success('Supplier created successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create supplier');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => fournisseurService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['fournisseurs']);
      toast.success('Supplier updated successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update supplier');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: fournisseurService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['fournisseurs']);
      toast.success('Supplier deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete supplier');
    }
  });

  const openModal = (fournisseur = null) => {
    if (fournisseur) {
      setEditingFournisseur(fournisseur);
      setFormData({ 
        name: fournisseur.name, 
        code: fournisseur.code || '', 
        email: fournisseur.email || '',
        phone: fournisseur.phone || '',
        address: fournisseur.address || ''
      });
    } else {
      setEditingFournisseur(null);
      setFormData({ name: '', code: '', email: '', phone: '', address: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingFournisseur(null);
    setFormData({ name: '', code: '', email: '', phone: '', address: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingFournisseur) {
      updateMutation.mutate({ id: editingFournisseur._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <div className="loading">Loading suppliers...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FaPlus /> Add Supplier
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((f) => (
                <tr key={f._id}>
                  <td><strong>{f.name}</strong></td>
                  <td>{f.code || '-'}</td>
                  <td>{f.email || '-'}</td>
                  <td>{f.phone || '-'}</td>
                  <td>{f.address || '-'}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-secondary" 
                      onClick={() => openModal(f)}
                      style={{ marginRight: '8px' }}
                    >
                      <FaEdit /> Edit
                    </button>
                    <button 
                      className="btn btn-sm btn-danger" 
                      onClick={() => handleDelete(f._id)}
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingFournisseur ? 'Edit Supplier' : 'Add Supplier'}>
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
            <label>Code</label>
            <input
              type="text"
              className="form-control"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="form-control"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
             <input
              type="text"
              className="form-control"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea
              className="form-control"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {editingFournisseur ? 'Update' : 'Create'} Supplier
          </button>
        </form>
      </Modal>
    </div>
  );
}
