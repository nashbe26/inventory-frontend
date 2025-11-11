import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
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
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scanner" element={<BarcodeScanner />} />
        <Route path="/bulk-generation" element={<BulkGeneration />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/colors" element={<Colors />} />
        <Route path="/sizes" element={<Sizes />} />
        <Route path="/rayons" element={<Rayons />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetails />} />
      </Routes>
    </Layout>
  )
}

export default App
