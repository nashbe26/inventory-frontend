import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  FaHome, 
  FaBoxes, 
  FaTags, 
  FaPalette, 
  FaRuler, 
  FaWarehouse,
  FaBarcode,
  FaFileDownload,
  FaUser,
  FaSignOutAlt,
  FaShoppingCart,
  FaChartBar,
  FaUsers,
  FaMoneyBillWave
} from 'react-icons/fa'

export default function Layout() {
  const { user, logout, isManager } = useAuth();

  return (
    <div className="app-container">
      <aside className="sidebar">
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

        <nav>
          <ul className="sidebar-nav">
            <li>
              <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaHome /> Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/scanner" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaBarcode /> Scanner
              </NavLink>
            </li>
            <li>
              <NavLink to="/orders" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaShoppingCart /> Orders
              </NavLink>
            </li>
            <li>
              <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaChartBar /> Analytics
              </NavLink>
            </li>
            <li>
              <NavLink to="/expenses" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaMoneyBillWave /> Expenses
              </NavLink>
            </li>
            {isManager && (
              <li>
                <NavLink to="/bulk-generation" className={({ isActive }) => isActive ? 'active' : ''}>
                  <FaFileDownload /> Bulk Generation
                </NavLink>
              </li>
            )}
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
          </ul>
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/organization" className={({ isActive }) => isActive ? 'active' : ''}>
            <FaUsers /> Organization
          </NavLink>
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
