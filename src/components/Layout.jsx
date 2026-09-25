import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  FaHome, 
  FaBoxes,
  FaTshirt, 
  FaTags, 
  FaPalette, 
  FaRuler, 
  FaWarehouse,
  FaLayerGroup,
  FaBarcode,
  FaHistory,
  FaUser,
  FaSignOutAlt,
  FaShoppingCart,
  FaChartBar,
  FaUsers,
  FaTruck,
  FaChevronDown,
  FaChevronRight,
  FaClipboardList,
  FaCogs,
  FaBars,
  FaTimes,
  FaQrcode,
  FaShopify,
  FaBoxOpen,
  FaChartPie,
  FaClock,
  FaComments
} from 'react-icons/fa'

// Access used to be decided here, by matching the pathname against a list of
// prefixes a staff user was allowed to see. That list had to be kept in step
// with both App.jsx and the server's route files by hand, and the early return
// it drove sat between two useState calls — so a staff user navigating to a
// disallowed path rendered one hook where the previous render had four, which
// is the "rendered fewer hooks than expected" crash.
//
// Both problems go away by gating the routes themselves: see App.jsx, where
// every route now carries the role set its server counterpart enforces.
// Layout is back to deciding what to *show*, not what to permit.

export default function Layout() {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState({
    operations: true,
    inventory: true,
    delivery: true
  });

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  return (
    <div className="app-container">
      <button className="mobile-toggle" onClick={() => setSidebarOpen(!isSidebarOpen)}>
        {isSidebarOpen ? <FaTimes /> : <FaBars />}
      </button>
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        {/* A drawn mark rather than an emoji: emoji render differently on every
            OS and read as a placeholder. */}
        <div className="sidebar-logo">
          <span className="logo-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5 14 4.75v6.5L8 14.5 2 11.25v-6.5L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M2 4.75 8 8m0 0 6-3.25M8 8v6.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </span>
          Inventory
        </div>
        
        {user && (
          <div className="user-info">
            <div className="user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <p className="user-name">{user.name}</p>
              <span className={`user-role ${user.role}`}>{user.role}</span>
            </div>
          </div>
        )}

        <nav onClick={(e) => {
          if (e.target.closest('a')) setSidebarOpen(false);
        }}>
          <ul className="sidebar-nav">
            {user?.role === 'delivery_man' ? (
                <>
                    <li>
                        <NavLink to="/time-clock" className={({ isActive }) => isActive ? 'active' : ''}>
                          <FaClock /> Time clock
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/delivery-dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
                          <FaTruck /> My Dashboard
                        </NavLink>
                    </li>
                     <li>
                    <NavLink to="/delivery-history" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaHistory /> History
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/delivery-performance" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaChartBar /> Performance
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/chat" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaComments /> Team chat
                    </NavLink>
                  </li>
                </>
            ) : user?.role === 'staff' ? (
                <>
                  <li>
                    <NavLink to="/time-clock" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaClock /> Time clock
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/chat" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaComments /> Team chat
                    </NavLink>
                  </li>
                  <li className="menu-group">
                    <div className="menu-group-header" onClick={() => toggleGroup('operations')}>
                      <span className="group-label">
                        <FaClipboardList /> Daily Operations
                      </span>
                      {expandedGroups.operations ? <FaChevronDown className="arrow" /> : <FaChevronRight className="arrow" />}
                    </div>
                    {expandedGroups.operations && (
                      <ul className="submenu">
                        <li>
                          <NavLink to="/prepare-scan" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaBoxOpen /> Préparation (scan)
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/scanner-return" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaQrcode /> Return Scanner
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/dispatch-scan" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaTruck /> Expédition (scan)
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/history" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaHistory /> Scan History
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/orders" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaShoppingCart /> Orders
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/order-analytics" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaChartPie /> Order analytics
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/pickups" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaTruck /> Pickups
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/bordereaux" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaClipboardList /> Bordereaux
                          </NavLink>
                        </li>
                      </ul>
                    )}
                  </li>
                  <li className="menu-group">
                    <div className="menu-group-header" onClick={() => toggleGroup('inventory')}>
                      <span className="group-label">
                        <FaBoxes /> Inventory Management
                      </span>
                      {expandedGroups.inventory ? <FaChevronDown className="arrow" /> : <FaChevronRight className="arrow" />}
                    </div>
                    {expandedGroups.inventory && (
                      <ul className="submenu">
                        <li>
                          <NavLink to="/stock/receive" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaBoxOpen /> Receive stock
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/stock/count" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaClipboardList /> Stock count
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/stock/movements" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaHistory /> Stock movements
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/styles" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaTshirt /> Styles
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/products" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaBoxes /> Products
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/categories" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaTags /> Categories
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/colors" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaPalette /> Colors
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/sizes" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaRuler /> Sizes
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/rayons" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaWarehouse /> Rayons
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/materials" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaLayerGroup /> Matières
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/fournisseurs" className={({ isActive }) => isActive ? 'active' : ''}>
                            <FaTruck /> Suppliers
                          </NavLink>
                        </li>
                      </ul>
                    )}
                  </li>
                </>
            ) : (
                <>
            <li>
              <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaHome /> Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/time-clock" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaClock /> Time clock
              </NavLink>
            </li>
            <li>
              <NavLink to="/chat" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaComments /> Team chat
              </NavLink>
            </li>
            <li>
              <NavLink to="/organization" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaCogs /> Organization
              </NavLink>
            </li>

            {/* Operations Group */}
            <li className="menu-group">
              <div className="menu-group-header" onClick={() => toggleGroup('operations')}>
                <span className="group-label">
                  <FaClipboardList /> Daily Operations
                </span>
                {expandedGroups.operations ? <FaChevronDown className="arrow" /> : <FaChevronRight className="arrow" />}
              </div>
              
              {expandedGroups.operations && (
                <ul className="submenu">
                  <li>
                    <NavLink to="/prepare-scan" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaBoxOpen /> Préparation (scan)
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/scanner-return" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaQrcode /> Return Scanner
                    </NavLink>
                  </li>
                  {(user?.role === 'admin' ||
                    user?.role === 'manager' ||
                    user?.role === 'staff') && (
                    <li>
                      <NavLink to="/dispatch-scan" className={({ isActive }) => isActive ? 'active' : ''}>
                        <FaTruck /> Expédition (scan)
                      </NavLink>
                    </li>
                  )}
                  <li>
                    <NavLink to="/history" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaHistory /> Scan History
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/orders" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaShoppingCart /> Orders
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/order-analytics" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaChartPie /> Order analytics
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/pickups" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaTruck /> Pickups
                    </NavLink>
                  </li>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <li>
                        <NavLink to="/delivery-team" className={({ isActive }) => isActive ? 'active' : ''}>
                        <FaUsers /> Delivery Team
                        </NavLink>
                    </li>
                  )}
              
                </ul>
              )}
            </li>

            {/* Delivery Zone Group */}
            {(user?.role === 'delivery_man') && (
            <li className="menu-group">
              <div className="menu-group-header" onClick={() => toggleGroup('delivery')}>
                <span className="group-label">
                  <FaTruck /> Delivery Zone
                </span>
                {expandedGroups.delivery ? <FaChevronDown className="arrow" /> : <FaChevronRight className="arrow" />}
              </div>
              
              {expandedGroups.delivery && (
                <ul className="submenu">
                  <li>
                    <NavLink to="/delivery-scan" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaQrcode /> Scan QR
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/delivery-dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaTruck /> Dashboard
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/delivery-history" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaHistory /> History
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/delivery-performance" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaChartBar /> Performance
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
            )}

            {/* Inventory Group */}
            <li className="menu-group">
              <div className="menu-group-header" onClick={() => toggleGroup('inventory')}>
                <span className="group-label">
                  <FaBoxes /> Inventory Management
                </span>
                {expandedGroups.inventory ? <FaChevronDown className="arrow" /> : <FaChevronRight className="arrow" />}
              </div>
              
              {expandedGroups.inventory && (
                <ul className="submenu">
                  <li>
                    <NavLink to="/stock/receive" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaBoxOpen /> Receive stock
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/stock/count" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaClipboardList /> Stock count
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/stock/movements" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaHistory /> Stock movements
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/styles" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaTshirt /> Styles
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/products" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaBoxes /> Products
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/categories" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaTags /> Categories
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/colors" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaPalette /> Colors
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/sizes" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaRuler /> Sizes
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/rayons" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaWarehouse /> Rayons
                    </NavLink>
                  </li>
                   <li>
                    <NavLink to="/materials" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaLayerGroup /> Matières
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/fournisseurs" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaTruck /> Suppliers
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
            </>
          )}

          </ul>
        </nav>

        <div className="sidebar-footer">
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <NavLink to="/shopify-settings" className={({ isActive }) => isActive ? 'active' : ''}>
              <FaShopify /> Shopify
            </NavLink>
          )}
          <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
            <FaUser /> Profile
          </NavLink>
          <button onClick={logout} className="logout-btn">
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
