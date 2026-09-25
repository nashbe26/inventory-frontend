import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Route-level authorization.
 *
 * `allow` and `deny` deliberately mirror the server's two middlewares —
 * `authorize(...roles)` and `forbidRoles(...roles)` — so a route's gate here
 * can be read straight off the route file there. This is defence in depth and
 * a UX guard: it stops someone landing on a page whose every request will come
 * back 403. It is NOT the protection. The server is.
 *
 * The earlier `requireAdmin` / `requireManager` booleans could not express the
 * cases that actually exist here — the delivery pages admit `delivery_man`,
 * `admin` and `manager` but not `staff` — so they are gone. Nothing passed
 * them; all 46 routes shared one unparameterised gate (AUDIT H-6).
 */

/**
 * Where a role belongs when it is turned away. Every role's home must be a
 * route that role is allowed to reach, or the redirect loops.
 */
export function homeFor(role) {
  if (role === 'staff') return '/prepare-scan';
  if (role === 'delivery_man') return '/delivery-dashboard';
  return '/';
}

const PrivateRoute = ({ children, allow, deny }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const refused =
    (allow && !allow.includes(user.role)) || (deny && deny.includes(user.role));

  if (refused) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return children;
};

export default PrivateRoute;
