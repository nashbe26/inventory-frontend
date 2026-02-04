import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
import ProductDetails from './pages/ProductDetails'
import BarcodeScanner from './pages/BarcodeScanner'
import History from './pages/History'
import BulkGeneration from './pages/BulkGeneration'
import Orders from './pages/Orders'
import Analytics from './pages/Analytics'
import Expenses from './pages/Expenses'
import SupplierExpenses from './pages/SupplierExpenses'
import UserExpensesReport from './pages/UserExpensesReport'
import Recette from './pages/Recette'
import Materials from './pages/Materials'
import OrganizationSetup from './pages/OrganizationSetup'
import OrganizationManagement from './pages/OrganizationManagement'
import AcceptInvitation from './pages/AcceptInvitation'
import Pickups from './pages/Pickups'
import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Socket Manager Component
const SocketManager = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // Initialize Socket
        // Adjust URL for production/dev
        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000'); 

        newSocket.on('connect', () => {
            console.log('Socket Connected');
            
            // Join Rooms based on Role
            if (user.role === 'admin' || user.role === 'manager') {
                newSocket.emit('joinRoom', 'admin_group');
            } 
            
            if (user.role === 'supplier' && user.fournisseurId) {
                newSocket.emit('joinRoom', `supplier_${user.fournisseurId}`);
            }

            if (user.role === 'delivery_man') {
                newSocket.emit('joinRoom', 'delivery_group');
            }

            if (user.organization) {
                 newSocket.emit('joinRoom', `org_${user.organization._id || user.organization}`);
            }
        });

        // Listen for Events
        newSocket.on('newOrder', (data) => {
            toast.info(data.message, { autoClose: 10000 });
            // Optionally play sound
        });

        newSocket.on('orderReady', (data) => {
            toast.success(data.message, { autoClose: 10000 });
        });

        newSocket.on('orderStatusUpdated', (data) => {
            toast.info(data.message);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [user]);

    return null;
};

function App() {
  return (
    <AuthProvider>
      <SocketManager />
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
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="scanner" element={<BarcodeScanner />} />
          <Route path="history" element={<History />} />

          <Route path="categories" element={<Categories />} />
          <Route path="colors" element={<Colors />} />
          <Route path="sizes" element={<Sizes />} />
          <Route path="rayons" element={<Rayons />} />
          <Route path="materials" element={<Materials />} />
          <Route path="fournisseurs" element={<Fournisseurs />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetails />} />
          <Route path="orders" element={<Orders />} />
          <Route path="pickups" element={<Pickups />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="supplier-expenses" element={<SupplierExpenses />} />
          <Route path="user-expenses-report" element={<UserExpensesReport />} />
          <Route path="recettes" element={<Recette />} />
          <Route path="organization" element={<OrganizationManagement />} />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
