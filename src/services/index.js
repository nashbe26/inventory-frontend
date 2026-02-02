import api from './api';

export const categoryService = {
  getAll: () => api.get('/categories'),
  getOne: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`)
};

export const colorService = {
  getAll: () => api.get('/colors'),
  getOne: (id) => api.get(`/colors/${id}`),
  create: (data) => api.post('/colors', data),
  update: (id, data) => api.put(`/colors/${id}`, data),
  delete: (id) => api.delete(`/colors/${id}`)
};

export const sizeService = {
  getAll: () => api.get('/sizes'),
  getOne: (id) => api.get(`/sizes/${id}`),
  create: (data) => api.post('/sizes', data),
  update: (id, data) => api.put(`/sizes/${id}`, data),
  delete: (id) => api.delete(`/sizes/${id}`)
};

export const rayonService = {
  getAll: () => api.get('/rayons'),
  getOne: (id) => api.get(`/rayons/${id}`),
  create: (data) => api.post('/rayons', data),
  update: (id, data) => api.put(`/rayons/${id}`, data),
  delete: (id) => api.delete(`/rayons/${id}`)
};

export const productService = {
  getAll: (params) => api.get('/products', { params }),
  getOne: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getBarcode: (id) => `/api-inventory/products/${id}/barcode`,
  getDochette: (id) => `/api-inventory/products/${id}/dochette`,
  // Add methods to fetch the blobs directly (with Auth header)
  fetchBarcode: (id) => api.get(`/products/${id}/barcode`, { responseType: 'blob' }),
  fetchDochette: (id) => api.get(`/products/${id}/dochette`, { responseType: 'blob' })
};

export const fournisseurService = {
  getAll: () => api.get('/fournisseurs'),
  getOne: (id) => api.get(`/fournisseurs/${id}`),
  create: (data) => api.post('/fournisseurs', data),
  update: (id, data) => api.put(`/fournisseurs/${id}`, data),
  delete: (id) => api.delete(`/fournisseurs/${id}`)
};

export const materialService = {
  getAll: () => api.get('/materials'),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
  delete: (id) => api.delete(`/materials/${id}`)
};

export const inventoryService = {
  adjust: (data) => api.post('/inventory/adjust', data),
  getLowStock: () => api.get('/inventory/low-stock'),
  getStats: () => api.get('/inventory/stats')
};
