import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sizeService } from '../services';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import Modal from '../components/Modal';

export default function Sizes() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSize, setEditingSize] = useState(null);
  const [formData, setFormData] = useState({ label: '', value: '', sortOrder: 0 });
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sizes'],
    queryFn: async () => {
      const response = await sizeService.getAll();
      return response.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: sizeService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['sizes']);
      toast.success('Size created successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create size');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => sizeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sizes']);
      toast.success('Size updated successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update size');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: sizeService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['sizes']);
      toast.success('Size deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete size');
    }
  });

  const openModal = (size = null) => {
    if (size) {
      setEditingSize(size);
      setFormData({ label: size.label, value: size.value, sortOrder: size.sortOrder || 0 });
    } else {
      setEditingSize(null);
      setFormData({ label: '', value: '', sortOrder: 0 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSize(null);
    setFormData({ label: '', value: '', sortOrder: 0 });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSize) {
      updateMutation.mutate({ id: editingSize._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this size?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <div className="loading">Loading sizes...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sizes</h1>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FaPlus /> Add Size
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Value</th>
                <th>Sort Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((size) => (
                <tr key={size._id}>
                  <td>{size.label}</td>
                  <td><strong>{size.value}</strong></td>
                  <td>{size.sortOrder}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-secondary" 
                      onClick={() => openModal(size)}
                      style={{ marginRight: '8px' }}
                    >
                      <FaEdit /> Edit
                    </button>
                    <button 
                      className="btn btn-sm btn-danger" 
                      onClick={() => handleDelete(size._id)}
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingSize ? 'Edit Size' : 'Add Size'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Label *</label>
            <input
              type="text"
              className="form-control"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Value *</label>
            <input
              type="text"
              className="form-control"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <div className="form-group">
            <label>Sort Order</label>
            <input
              type="number"
              className="form-control"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {editingSize ? 'Update' : 'Create'} Size
          </button>
        </form>
      </Modal>
    </div>
  );
}
