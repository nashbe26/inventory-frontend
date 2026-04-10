import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

/** Socket.io must use the API origin, not a path like /api-inventory. */
function getSocketBaseUrl() {
  const raw = import.meta.env.VITE_API_URL || 'https://tndeals.store';
  try {
    const u = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return u.origin;
  } catch {
    return String(raw).replace(/\/api-inventory\/?.*$/, '').replace(/\/$/, '') || 'https://tndeals.store';
  }
}

const socketUrl = getSocketBaseUrl();

export function SocketProvider({ children }) {
  const { user, loading } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (loading || !user) {
      setSocket((prev) => {
        if (prev) prev.disconnect();
        return null;
      });
      return;
    }

    let token = localStorage.getItem('token');
    if (token) {
      token = token.trim();
      if (token.toLowerCase().startsWith('bearer ')) token = token.slice(7).trim();
    }
    if (!token) {
      setSocket(null);
      return;
    }

    const s = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      if (user.role === 'admin' || user.role === 'manager') {
        s.emit('joinRoom', 'admin_group');
      }
      if (user.role === 'supplier' && user.fournisseurId) {
        s.emit('joinRoom', `supplier_${user.fournisseurId}`);
      }
      if (user.role === 'delivery_man') {
        s.emit('joinRoom', 'delivery_group');
      }
      if (user.organization) {
        const oid = user.organization._id || user.organization;
        s.emit('joinRoom', `org_${oid}`);
      }
    });

    s.on('connect_error', (err) => {
      console.warn('Socket connect_error:', err.message);
    });

    s.on('newOrder', (data) => {
      toast.info(data.message, { autoClose: 10000 });
    });
    s.on('orderReady', (data) => {
      toast.success(data.message, { autoClose: 10000 });
    });
    s.on('orderStatusUpdated', (data) => {
      toast.info(data.message);
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [loading, user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
