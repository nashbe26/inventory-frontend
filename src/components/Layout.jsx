import { NavLink } from 'react-router-dom'
import { 
  FaHome, 
  FaBoxes, 
  FaTags, 
  FaPalette, 
  FaRuler, 
  FaWarehouse,
  FaBarcode,
  FaFileDownload
} from 'react-icons/fa'

export default function Layout({ children }) {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          📦 Inventory
        </div>
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
              <NavLink to="/bulk-generation" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaFileDownload /> Bulk Generation
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
          </ul>
        </nav>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
