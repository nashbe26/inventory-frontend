import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import Colors from './pages/Colors'
import Sizes from './pages/Sizes'
import Rayons from './pages/Rayons'
import Products from './pages/Products'
import ProductDetails from './pages/ProductDetails'
import BarcodeScanner from './pages/BarcodeScanner'
import BulkGeneration from './pages/BulkGeneration'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes with Layout */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="scanner" element={<BarcodeScanner />} />
          <Route
            path="bulk-generation"
            element={
              <PrivateRoute requireManager>
                <BulkGeneration />
              </PrivateRoute>
            }
          />
          <Route path="categories" element={<Categories />} />
          <Route path="colors" element={<Colors />} />
          <Route path="sizes" element={<Sizes />} />
          <Route path="rayons" element={<Rayons />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetails />} />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
