import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Load user from token
  const loadUser = async () => {
    try {
      const response = await axios.get('/api-inventory/auth/me');
      setUser(response.data.data);
    } catch (error) {
      console.error('Failed to load user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Login
  const login = async (email, password) => {
    const response = await axios.post('/api-inventory/auth/login', { email, password });
    const { token, data } = response.data;
    
    localStorage.setItem('token', token);
    setToken(token);
    setUser(data);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    return data;
  };

  // Register
  const register = async (name, email, password) => {
    const response = await axios.post('/api-inventory/auth/register', { name, email, password });
    const { token, data } = response.data;
    
    localStorage.setItem('token', token);
    setToken(token);
    setUser(data);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    return data;
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  // Update profile
  const updateProfile = async (name, email) => {
    const response = await axios.put('/api-inventory/auth/profile', { name, email });
    setUser(response.data.data);
    return response.data.data;
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    const response = await axios.put('/api-inventory/auth/password', {
      currentPassword,
      newPassword
    });
    return response.data;
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager' || user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
