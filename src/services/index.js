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
  getAll: (scale) => api.get('/sizes', scale ? { params: { scale } } : undefined),
  /** Distinct size scales for the org, with a count of sizes in each. */
  getScales: () => api.get('/sizes/scales'),
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
  fetchDochette: (id) => api.get(`/products/${id}/dochette`, { responseType: 'blob' }),
  fetchCustomDochette: (id, items) => api.post(`/products/${id}/dochette-custom`, { items }, { responseType: 'blob' })
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

/**
 * Textile catalogue: Style -> Colorway -> Sku.
 * Stock never moves through these endpoints — it moves through stockService,
 * which is the only writer to the ledger.
 */
export const styleService = {
  getAll: (params) => api.get('/styles', { params }),
  getOne: (id) => api.get(`/styles/${id}`),
  create: (data) => api.post('/styles', data),
  update: (id, data) => api.put(`/styles/${id}`, data),
  delete: (id) => api.delete(`/styles/${id}`),

  addColorway: (styleId, data) => api.post(`/styles/${styleId}/colorways`, data),
  updateColorway: (styleId, colorwayId, data) =>
    api.put(`/styles/${styleId}/colorways/${colorwayId}`, data),
  deleteColorway: (styleId, colorwayId) =>
    api.delete(`/styles/${styleId}/colorways/${colorwayId}`)
};

/** Every call here appends to the append-only stock movement ledger. */
export const stockService = {
  summary: () => api.get('/stock/summary'),
  lowStock: () => api.get('/stock/low-stock'),
  movements: (params) => api.get('/stock/movements', { params }),
  skuMovements: (skuId, params) => api.get(`/stock/skus/${skuId}/movements`, { params }),
  lookup: (identifier) => api.get(`/stock/lookup/${encodeURIComponent(identifier)}`),

  receive: (data) => api.post('/stock/receive', data),
  receiveBulk: (data) => api.post('/stock/receive-bulk', data),
  pick: (data) => api.post('/stock/pick', data),
  returnStock: (data) => api.post('/stock/return', data),
  adjust: (data) => api.post('/stock/adjust', data),
  count: (data) => api.post('/stock/count', data),
  reconcile: (data) => api.post('/stock/reconcile', data)
};

/**
 * Fetch an authenticated file and hand it to the browser.
 *
 * The alternative — window.open(url + '?token=' + jwt) — puts a 30-day
 * credential in the URL, where it lands in server access logs, browser
 * history, and the Referer header of anything the page subsequently links to.
 * That query-string fallback is why `protect` accepted ?token= at all
 * (AUDIT H-3); fetching with the header and handing over a blob removes the
 * need for it.
 *
 * @param {string} path   API path, e.g. `/bordereaux/${id}/pdf`
 * @param {string} filename  suggested download name
 */
export async function downloadFile(path, filename) {
  const response = await api.get(path, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick: revoking synchronously can cancel the download
  // in some browsers before it has started reading the blob.
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
