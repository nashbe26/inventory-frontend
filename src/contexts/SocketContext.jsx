import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

/** Socket.io must use the API origin, not a path like /api-inventory. */
function getSocketBaseUrl() {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:3009';
  try {
    const u = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return u.origin;
  } catch {
    return String(raw).replace(/\/api-inventory\/?.*$/, '').replace(/\/$/, '') || 'http://localhost:3009';
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

    /**
     * Rooms are no longer requested from here.
     *
     * The client used to emit joinRoom for admin_group, delivery_group,
     * org_<id> and supplier_<id>, and the server joined whatever it was asked
     * for — so the room a client received events from was decided by the
     * client. The server now assigns rooms on connection from the identity it
     * verified in the handshake (AUDIT C-6). These emits were also redundant:
     * every value above is derived from the same user the server already has.
     */

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
