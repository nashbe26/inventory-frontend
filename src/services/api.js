import axios from 'axios';

const API_BASE_URL = 'https://tndeals/api-inventory';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    if (error.response?.status === 403 && error.response?.data?.requiresOrganization) {
      // User needs to create or join an organization
      window.location.href = '/setup-organization';
    }
    return Promise.reject(error);
  }
);

// Organization API
export const organizationAPI = {
  create: (data) => api.post('/organizations', data),
  getMy: () => api.get('/organizations/my/organization'),
  getMe: () => api.get('/users/me'), // Add this line
  get: (id) => api.get(`/organizations/${id}`),
  update: (id, data) => api.put(`/organizations/${id}`, data),
  delete: (id) => api.delete(`/organizations/${id}`),
  invite: (id, data) => api.post(`/organizations/${id}/invite`, data),
  getInvitations: (id) => api.get(`/organizations/${id}/invitations`),
  acceptInvitation: (token) => api.post(`/organizations/invitations/${token}/accept`),
  declineInvitation: (token) => api.post(`/organizations/invitations/${token}/decline`),
  removeMember: (orgId, userId) => api.delete(`/organizations/${orgId}/members/${userId}`),
  updateMemberRole: (orgId, userId, role) => api.put(`/organizations/${orgId}/members/${userId}/role`, { role })
};

export default api;
