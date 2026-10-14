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
import Fournisseurs from './pages/Fournisseurs'
import Products from './pages/Products'
import Styles from './pages/Styles'
import Labels from './pages/Labels'
import StyleForm from './pages/StyleForm'
import StyleDetail from './pages/StyleDetail'
import StockReceive from './pages/StockReceive'
import StockOut from './pages/StockOut'
import StockCount from './pages/StockCount'
import StockMovements from './pages/StockMovements'
import ProductForm from './pages/ProductForm'
import ProductDetails from './pages/ProductDetails'
import ReturnScanner from './pages/ReturnScanner'
import DispatchScan from './pages/DispatchScan'
import PrepareScan from './pages/PrepareScan'
import History from './pages/History'
import BulkGeneration from './pages/BulkGeneration'
import Orders from './pages/Orders'
import OrderImport from './pages/OrderImport'
import OrderAnalytics from './pages/OrderAnalytics'
import Materials from './pages/Materials'
import OrganizationSetup from './pages/OrganizationSetup'
import OrganizationManagement from './pages/OrganizationManagement'
import AcceptInvitation from './pages/AcceptInvitation'
import Pickups from './pages/Pickups'
import DeliveryDashboard from './pages/DeliveryDashboard'
import DeliveryHistory from './pages/DeliveryHistory'
import DeliveryPerformance from './pages/DeliveryPerformance'
import DeliveryScan from './pages/DeliveryScan'
import DeliveryHandoverScan from './pages/DeliveryHandoverScan'
import DeliveryTeam from './pages/DeliveryTeam'
import Bordereaux from './pages/Bordereaux'
import ClaimOrder from './pages/ClaimOrder'
import ClaimBordereau from './pages/ClaimBordereau'
import ShopifySettings from './pages/ShopifySettings'
import TimeClock from './pages/TimeClock'
import TeamChat from './pages/TeamChat'
import { ToastContainer } from 'react-toastify'
import { SocketProvider } from './contexts/SocketContext'
import 'react-toastify/dist/ReactToastify.css'

// Role sets, named after the server's, so a gate here can be checked against
// the route file there. OFFICE mirrors the productEditors / handlers / editors
// constants in productRoutes, stockRoutes and styleRoutes; MANAGEMENT mirrors
// the admin+manager pairs on the shopify and organization routes; DELIVERY
// mirrors internalDeliveryRoutes.
//
// These stop a user landing on a page that can only 403 at them. The server is
// what actually enforces this (AUDIT H-6).
const OFFICE = ['admin', 'manager', 'staff']
const MANAGEMENT = ['admin', 'manager']
const DELIVERY = ['admin', 'manager', 'delivery_man']

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
      <ToastContainer position="top-right" />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup-organization" element={<OrganizationSetup />} />
        <Route path="/accept-invitation/:token" element={<AcceptInvitation />} />

        {/* Protected Routes with Layout */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<PrivateRoute deny={['staff']}><Dashboard /></PrivateRoute>} />
          <Route path="profile" element={<Profile />} />
          <Route path="time-clock" element={<TimeClock />} />
          <Route path="scanner" element={<Navigate to="/prepare-scan" replace />} />
          <Route path="scanner-return" element={<PrivateRoute allow={OFFICE}><ReturnScanner /></PrivateRoute>} />
          <Route path="prepare-scan" element={<PrivateRoute allow={OFFICE}><PrepareScan /></PrivateRoute>} />
          <Route path="dispatch-scan" element={<PrivateRoute allow={OFFICE}><DispatchScan /></PrivateRoute>} />
          <Route path="history" element={<PrivateRoute allow={OFFICE}><History /></PrivateRoute>} />

          <Route path="categories" element={<PrivateRoute allow={OFFICE}><Categories /></PrivateRoute>} />
          <Route path="colors" element={<PrivateRoute allow={OFFICE}><Colors /></PrivateRoute>} />
          <Route path="sizes" element={<PrivateRoute allow={OFFICE}><Sizes /></PrivateRoute>} />
          <Route path="rayons" element={<PrivateRoute allow={OFFICE}><Rayons /></PrivateRoute>} />
          <Route path="materials" element={<PrivateRoute allow={OFFICE}><Materials /></PrivateRoute>} />
          <Route path="fournisseurs" element={<PrivateRoute allow={OFFICE}><Fournisseurs /></PrivateRoute>} />
          <Route path="stock/receive" element={<PrivateRoute allow={OFFICE}><StockReceive /></PrivateRoute>} />
          <Route path="stock/out" element={<PrivateRoute allow={OFFICE}><StockOut /></PrivateRoute>} />
          <Route path="stock/count" element={<PrivateRoute allow={OFFICE}><StockCount /></PrivateRoute>} />
          <Route path="stock/movements" element={<PrivateRoute allow={OFFICE}><StockMovements /></PrivateRoute>} />
          <Route path="styles" element={<PrivateRoute allow={OFFICE}><Styles /></PrivateRoute>} />
          <Route path="labels" element={<PrivateRoute allow={OFFICE}><Labels /></PrivateRoute>} />
          <Route path="styles/new" element={<PrivateRoute allow={OFFICE}><StyleForm /></PrivateRoute>} />
          <Route path="styles/:id" element={<PrivateRoute allow={OFFICE}><StyleDetail /></PrivateRoute>} />
          <Route path="styles/:id/edit" element={<PrivateRoute allow={OFFICE}><StyleForm /></PrivateRoute>} />
          <Route path="products" element={<PrivateRoute allow={OFFICE}><Products /></PrivateRoute>} />
          <Route path="products/new" element={<PrivateRoute allow={OFFICE}><ProductForm /></PrivateRoute>} />
          <Route path="products/edit/:id" element={<PrivateRoute allow={OFFICE}><ProductForm /></PrivateRoute>} />
          <Route path="products/:id" element={<PrivateRoute allow={OFFICE}><ProductDetails /></PrivateRoute>} />
          <Route path="orders" element={<PrivateRoute allow={OFFICE}><Orders /></PrivateRoute>} />
          <Route path="orders/import" element={<PrivateRoute allow={OFFICE}><OrderImport /></PrivateRoute>} />
          <Route path="order-analytics" element={<PrivateRoute allow={OFFICE}><OrderAnalytics /></PrivateRoute>} />
          <Route path="pickups" element={<PrivateRoute allow={OFFICE}><Pickups /></PrivateRoute>} />
          <Route path="organization" element={<PrivateRoute allow={MANAGEMENT}><OrganizationManagement /></PrivateRoute>} />
          <Route path="delivery-dashboard" element={<PrivateRoute allow={DELIVERY}><DeliveryDashboard /></PrivateRoute>} />
          <Route path="delivery-history" element={<PrivateRoute allow={DELIVERY}><DeliveryHistory /></PrivateRoute>} />
          <Route path="delivery-performance" element={<PrivateRoute allow={DELIVERY}><DeliveryPerformance /></PrivateRoute>} />
          <Route path="delivery-analytics" element={<PrivateRoute allow={MANAGEMENT}><DeliveryTeam /></PrivateRoute>} />
          <Route path="delivery-scan" element={<PrivateRoute allow={DELIVERY}><DeliveryScan /></PrivateRoute>} />
          <Route path="delivery-handover-scan" element={<PrivateRoute allow={DELIVERY}><DeliveryHandoverScan /></PrivateRoute>} />
          <Route path="claim-order/:id" element={<PrivateRoute allow={DELIVERY}><ClaimOrder /></PrivateRoute>} />
          <Route path="claim-bordereau/:code" element={<PrivateRoute allow={DELIVERY}><ClaimBordereau /></PrivateRoute>} />
          <Route path="delivery-team" element={<PrivateRoute allow={MANAGEMENT}><DeliveryTeam /></PrivateRoute>} />
          <Route path="bordereaux" element={<PrivateRoute allow={OFFICE}><Bordereaux /></PrivateRoute>} />
          <Route path="shopify-settings" element={<PrivateRoute allow={MANAGEMENT}><ShopifySettings /></PrivateRoute>} />
          <Route path="chat" element={<TeamChat />} />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
