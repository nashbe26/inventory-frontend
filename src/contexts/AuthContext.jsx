import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

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

  // Load user from token
  useEffect(() => {
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Load user from token
  const loadUser = async () => {
    try {
      const response = await api.get('/auth/me');
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
    const response = await api.post('/auth/login', { email, password });
    const { data } = response.data;
    const token = data.token;
    
    localStorage.setItem('token', token);
    setToken(token);
    setUser(data);
    
    return data;
  };

  // Register
  const register = async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    const { data } = response.data;
    const token = data.token;
    
    localStorage.setItem('token', token);
    setToken(token);
    setUser(data);
    
    return data;
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // Update profile
  const updateProfile = async (name, email) => {
    const response = await api.put('/auth/profile', { name, email });
    setUser(response.data.data);
    return response.data.data;
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    const response = await api.put('/auth/password', {
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

