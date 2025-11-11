import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colorService } from '../services';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import Modal from '../components/Modal';

export default function Colors() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [formData, setFormData] = useState({ name: '', hexCode: '#000000' });
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['colors'],
    queryFn: async () => {
      const response = await colorService.getAll();
      return response.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: colorService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['colors']);
      toast.success('Color created successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create color');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => colorService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['colors']);
      toast.success('Color updated successfully');
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update color');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: colorService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['colors']);
      toast.success('Color deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete color');
    }
  });

  const openModal = (color = null) => {
    if (color) {
      setEditingColor(color);
      setFormData({ name: color.name, hexCode: color.hexCode });
    } else {
      setEditingColor(null);
      setFormData({ name: '', hexCode: '#000000' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingColor(null);
    setFormData({ name: '', hexCode: '#000000' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingColor) {
      updateMutation.mutate({ id: editingColor._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this color?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <div className="loading">Loading colors...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Colors</h1>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FaPlus /> Add Color
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Preview</th>
                <th>Name</th>
                <th>Hex Code</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((color) => (
                <tr key={color._id}>
                  <td>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: color.hexCode,
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }} />
                  </td>
                  <td>{color.name}</td>
                  <td><code>{color.hexCode}</code></td>
                  <td>
                    <button 
                      className="btn btn-sm btn-secondary" 
                      onClick={() => openModal(color)}
                      style={{ marginRight: '8px' }}
                    >
                      <FaEdit /> Edit
                    </button>
                    <button 
                      className="btn btn-sm btn-danger" 
                      onClick={() => handleDelete(color._id)}
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingColor ? 'Edit Color' : 'Add Color'}>
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
            <label>Hex Code *</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="color"
                value={formData.hexCode}
                onChange={(e) => setFormData({ ...formData, hexCode: e.target.value })}
                style={{ width: '60px', height: '40px', cursor: 'pointer' }}
              />
              <input
                type="text"
                className="form-control"
                value={formData.hexCode}
                onChange={(e) => setFormData({ ...formData, hexCode: e.target.value })}
                pattern="^#[0-9A-Fa-f]{6}$"
                required
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {editingColor ? 'Update' : 'Create'} Color
          </button>
        </form>
      </Modal>
    </div>
  );
}
