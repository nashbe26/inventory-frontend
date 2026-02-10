import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  FaHome, 
  FaBoxes, 
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
  FaMoneyBillWave,
  FaHandHoldingUsd,
  FaTruck,
  FaWallet,
  FaChevronDown,
  FaChevronRight,
  FaClipboardList,
  FaCogs,
  FaBars,
  FaTimes,
  FaQrcode
} from 'react-icons/fa'

export default function Layout() {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  const [expandedGroups, setExpandedGroups] = useState({
    operations: true,
    finance: true,
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
        <div className="sidebar-logo">
          📦 Inventory
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
                    <NavLink to="/delivery-deposits" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaMoneyBillWave /> My Deposits
                    </NavLink>
                  </li>
                </>
            ) : (
                <>
            <li>
              <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaHome /> Dashboard
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
                    <NavLink to="/scanner" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaBarcode /> Scanner
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/scanner-return" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaQrcode /> Return Scanner
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
                  <li>
                    <NavLink to="/delivery-deposits" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaMoneyBillWave /> My Deposits
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
            )}

            {/* Finance Group */}
            <li className="menu-group">
              <div className="menu-group-header" onClick={() => toggleGroup('finance')}>
                <span className="group-label">
                  <FaChartBar /> Finance
                </span>
                {expandedGroups.finance ? <FaChevronDown className="arrow" /> : <FaChevronRight className="arrow" />}
              </div>
              
              {expandedGroups.finance && (
                <ul className="submenu">
                   <li>
                    <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaChartBar /> Analytics
                    </NavLink>
                  </li>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <li>
                      <NavLink to="/delivery-finance-admin" className={({ isActive }) => isActive ? 'active' : ''}>
                        <FaHandHoldingUsd /> Delivery Finance
                      </NavLink>
                    </li>
                  )}
                  <li>
                    <NavLink to="/expenses" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaMoneyBillWave /> Expenses
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/supplier-expenses" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaHandHoldingUsd /> Supplier Expenses
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/user-expenses-report" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaUsers /> Expenses by User
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/recettes" className={({ isActive }) => isActive ? 'active' : ''}>
                      <FaWallet /> Recettes
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>

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
          {user?.role !== 'delivery_man' && (
            <NavLink to="/organization" className={({ isActive }) => isActive ? 'active' : ''}>
              <FaCogs /> Organization
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
