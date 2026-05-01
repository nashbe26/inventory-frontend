import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaSearch, FaEye, FaTrash, FaTimes, FaTruck, FaSync, FaBan, FaFileDownload, FaCheck, FaBoxOpen, FaShippingFast, FaQrcode, FaClipboardList, FaFileAlt, FaPrint, FaEdit, FaQuestionCircle, FaCopy, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api, { syncShopifyOrdersAllBatches } from '../services/api';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { QRCodeCanvas } from 'qrcode.react';

const statuses = [
  'En Attente',
  'Confirmé',
  'Préparé',
  'Prêt à préparer',
  'Imprimé',
  'Remis au transporteur',
  'Expédié',
  'Livré',
  'Annulé',
  'NRP'
];

const statusGroups = [
  { label: 'All', value: '', color: 'bg-gray-100 text-gray-800' },
  { label: 'Pending', value: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { label: 'Confirmed', value: 'Confirmed', color: 'bg-purple-100 text-purple-800' },
  { label: 'Processing', value: 'Processing', color: 'bg-blue-100 text-blue-800' },
  { label: 'Prêt à préparer', value: 'Prêt à préparer', color: 'bg-teal-100 text-teal-900' },
  { label: 'Imprimé', value: 'Imprimé', color: 'bg-indigo-100 text-indigo-800' },
  { label: 'Remis transporteur', value: 'Remis au transporteur', color: 'bg-amber-100 text-amber-900' },
  { label: 'Completed', value: 'Completed', color: 'bg-green-100 text-green-800' },
  { label: 'Cancelled', value: 'Cancelled', color: 'bg-red-100 text-red-800' },
  { label: 'NRP', value: 'NRP', color: 'bg-gray-300 text-gray-800' }
];

/** Canonical labels: DB may still store feminine / lowercase variants. */
const canonicalStatusLabel = (status) => {
  if (!status) return '';
  if (status === 'Confirmée' || status === 'confirmée' || status === 'confirmé') return 'Confirmé';
  if (status === 'Livrée') return 'Livré';
  if (status === 'Annulée') return 'Annulé';
  return status;
};

const getStatusBadge = (status) => {
    if (!status) return 'badge-secondary';
    switch (status.toLowerCase()) {
        case 'payé': return 'badge-success';
        case 'confirmé':
        case 'confirmée':
          return 'badge-warning';
        case 'préparé': return 'badge-info';
        case 'prêt à préparer': return 'badge-teal';
        case 'imprimé': return 'badge-dark';
        case 'remis au transporteur': return 'badge-warning';
        case 'expédié': return 'badge-primary';
        case 'livré':
        case 'livrée':
          return 'badge-success';
        case 'annulé':
        case 'annulée':
          return 'badge-danger';
        case 'nrp': return 'badge-secondary';
        default: return 'badge-secondary';
    }
};

const tunisiaGovernorates = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan',
  'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir', 'Nabeul',
  'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
];

/** Same sentinel as backend: order cannot be confirmed until a real governorate is set. */
const GOVERNORATE_ADDRESS_UNAVAILABLE = 'Adresse non disponible';

const stripPackProductNamePrefix = (name) => String(name || '').replace(/^Pack\s+/i, '').trim();

function isGovernorateIncompleteForConfirmation(gouvernerat) {
  const g = String(gouvernerat || '').trim();
  return !g || g === GOVERNORATE_ADDRESS_UNAVAILABLE;
}

export default function Orders() {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const isManagerish = user?.role === 'admin' || user?.role === 'manager';
  const canOpsOrders = isManagerish || isStaff;
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [customer, setCustomer] = useState({ nom: '', telephone: '', adresse: '', gouvernerat: '', ville: '', telephone2: '' });
  const [source, setSource] = useState('Direct');
  const [notes, setNotes] = useState('');
  const [isExchange, setIsExchange] = useState(false);
  const [shipping, setShipping] = useState(8);
  const [productSearch, setProductSearch] = useState('');
  const [variantPickerProduct, setVariantPickerProduct] = useState(null);
  const [variantFilter, setVariantFilter] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [isBordereauModalOpen, setIsBordereauModalOpen] = useState(false);
  const [selectedDeliveryMan, setSelectedDeliveryMan] = useState('');
  const [stockFilter, setStockFilter] = useState(''); // '' | 'available' | 'unavailable'
  const [outOfStockOrder, setOutOfStockOrder] = useState(null);
  /** One bundle price for the whole order (above line items). */
  const [bundleOrderEnabled, setBundleOrderEnabled] = useState(false);
  const [bundleSubtotalInput, setBundleSubtotalInput] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Fetch Order Stats
  const { data: statsData } = useQuery({
    queryKey: ['orderStats'],
    queryFn: async () => {
        const res = await api.get('/orders/stats');
        return res.data?.data; // { total, pending, processing, completed, cancelled }
    },
  });

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', 1);
      params.append('limit', 10000);
      const res = await api.get(`/orders?${params}`);
      return res.data;
    }
  });

  // Load enough products for stock checks (default API limit is 20, which breaks availability for most SKUs)
  const { data: productsData } = useQuery({
    queryKey: ['products', 'orders-stock'],
    queryFn: async () => {
      const res = await api.get('/products?page=1&limit=10000');
      return res.data;
    },
    staleTime: 60 * 1000
  });

  const getCatalogUnitForItem = (item) => {
    const pid = item.productId?._id || item.productId;
    const p = productsData?.data?.find((x) => String(x._id) === String(pid));
    return Number(p?.price) || 0;
  };

  const computeCatalogItemsSubtotal = (items) =>
    items.reduce((s, item) => s + getCatalogUnitForItem(item) * Number(item.quantity || 0), 0);

  const allocateBundleUnitPrices = (items, targetSubtotalRaw) => {
    const b = Number(targetSubtotalRaw);
    if (!items.length || !Number.isFinite(b) || b < 0) return items;
    const weights = items.map((it) => getCatalogUnitForItem(it) * Number(it.quantity || 0));
    const sumW = weights.reduce((a, c) => a + c, 0);
    if (sumW <= 0) {
      const qtySum = items.reduce((s, it) => s + Number(it.quantity || 0), 0) || 1;
      const per = b / qtySum;
      return items.map((it) => ({ ...it, unitPrice: per }));
    }
    return items.map((it, idx) => {
      const share = (b * weights[idx]) / sumW;
      const q = Number(it.quantity) || 1;
      return { ...it, unitPrice: share / q };
    });
  };

  const orderItemsDisplayed = useMemo(() => {
    if (!bundleOrderEnabled || !orderItems.length) return orderItems;
    return allocateBundleUnitPrices(orderItems, bundleSubtotalInput);
  }, [bundleOrderEnabled, bundleSubtotalInput, orderItems, productsData]);

  const { data: deliveryMenData } = useQuery({
    queryKey: ['deliveryMen'],
    queryFn: async () => {
        // Fetch users with delivery_man role. Assuming we have an endpoint or filtering in list
        // Since we don't have distinct endpoint validation for this, using analytics endpoint or generic users
        // Let's rely on internal delivery analytics endpoint which returns delivery men list effectively
        const res = await api.get('/internal-delivery/analytics');
        // Extract users from stats
        return res.data.map(stat => stat.user);
    },
    enabled: isBordereauModalOpen && isManagerish
  });

  const orders = ordersData?.data || [];

  const idStr = (v) => (v == null ? '' : String(v));

  const normSku = (s) => (s == null ? '' : String(s).trim().toUpperCase());

  /**
   * Aligné sur la logique backend (prepare scan) : variantId, puis SKU/barcode ligne vs variante, puis seule variante.
   */
  const resolveVariantForLineItem = (product, item) => {
    if (!product?.variants?.length) return null;
    const variants = product.variants;
    let variant = null;
    if (item.variantId) {
      const vId = item.variantId._id || item.variantId;
      const vid = idStr(vId);
      variant = variants.find((v) => v._id === vid) || null;
    }
    if (!variant && item.sku) {
      const skuU = normSku(item.sku);
      const s = String(item.sku).toLowerCase().trim();
      variant =
        variants.find((v) => normSku(v.sku) === skuU) ||
        variants.find((v) => v.barcode && String(v.barcode).toLowerCase().trim() === s) ||
        null;
    }
    if (!variant && variants.length === 1) {
      variant = variants[0];
    }
    return variant;
  };

  /** @returns {boolean|null} true/false if known, null if product/variant could not be resolved */
  const checkStockAvailability = (item) => {
    if (!productsData?.data) return null;

    const pId = item.productId?._id || item.productId || item.product;
    if (!pId) return null;

    const pid = idStr(pId);
    const product = productsData.data.find((p) => idStr(p._id) === pid);
    if (!product) return null;

    const needQty = Number(item.quantity);
    if (!Number.isFinite(needQty) || needQty < 0) return null;

    if (product.variants && product.variants.length > 0) {
      const variant = resolveVariantForLineItem(product, item);
      if (variant) {
        return Number(variant.quantity) >= needQty;
      }
      return null;
    }

    const availableStock =
      product.quantity !== undefined && product.quantity !== null
        ? Number(product.quantity)
        : product.totalQuantity !== undefined && product.totalQuantity !== null
          ? Number(product.totalQuantity)
          : NaN;
    if (!Number.isFinite(availableStock)) return null;
    return availableStock >= needQty;
  };

  const getItemStockDetail = (item) => {
    if (!productsData?.data) return { available: null, have: null, need: item.quantity };
    const pId = item.productId?._id || item.productId || item.product;
    if (!pId) return { available: null, have: null, need: item.quantity };
    const pid = idStr(pId);
    const product = productsData.data.find((p) => idStr(p._id) === pid);
    if (!product) return { available: null, have: null, need: item.quantity };
    const needQty = Number(item.quantity);
    if (product.variants && product.variants.length > 0) {
      const variant = resolveVariantForLineItem(product, item);
      if (variant) {
        const have = Number(variant.quantity);
        return { available: have >= needQty, have, need: needQty };
      }
      return { available: null, have: null, need: needQty };
    }
    const have =
      product.quantity !== undefined && product.quantity !== null ? Number(product.quantity)
      : product.totalQuantity !== undefined ? Number(product.totalQuantity) : NaN;
    if (!Number.isFinite(have)) return { available: null, have: null, need: needQty };
    return { available: have >= needQty, have, need: needQty };
  };

  /** Row-level shelf check only (no allocation order): ok | out | unknown | none */
  const getOrderStockDisplay = (order) => {
    const items = order?.items;
    if (!items?.length) return 'none';
    const checks = items.map((i) => checkStockAvailability(i));
    if (checks.some((c) => c === false)) return 'out';
    if (checks.every((c) => c === true)) return 'ok';
    return 'unknown';
  };

  const isPretAPreparerOrder = (order) =>
    String(order?.status || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim() === 'pret a preparer';

  /**
   * Shelf stock display for filters: only « Prêt à préparer » orders participate.
   * Other statuses return a sentinel so In stock / Out of stock filters do not match them.
   */
  const getOrderStockMapDisplay = (order) => {
    if (!isPretAPreparerOrder(order)) return '__not_prep__';
    return getOrderStockDisplay(order);
  };

  /** Per-line stock icons only for « Prêt à préparer » (catalog / shelf). */
  const getLineItemStockMapAvailability = (item, order) => {
    if (!isPretAPreparerOrder(order)) return undefined;
    return checkStockAvailability(item);
  };

  const allFilteredOrders = orders.filter((order) => {
    const sTerm = searchTerm.toLowerCase().trim();
    
    // Si la recherche est vide, on garde tout
    if (!sTerm) {
      // (la suite vérifie les autres filtres)
    }

    const matchesSearch = !sTerm ||
      order.orderNumber?.toLowerCase().includes(sTerm) ||
      order.deliveryBarcode?.toLowerCase().includes(sTerm) ||
      order.customer?.nom?.toLowerCase().includes(sTerm) ||
      order.customer?.telephone?.includes(sTerm) ||
      order.customer?.telephone2?.includes(sTerm) ||
      order.items?.some((item) => {
        // Recherche par nom ou SKU de la ligne
        if (item.productName?.toLowerCase().includes(sTerm)) return true;
        if (item.sku?.toLowerCase().includes(sTerm)) return true;

        // Recherche approfondie sur le code-barres / SKU depuis le catalogue (productsData)
        if (productsData?.data) {
          const pId = idStr(item.productId?._id || item.productId || item.product);
          const product = productsData.data.find((p) => idStr(p._id) === pId);
          if (product) {
            if (product.barcode?.toLowerCase().includes(sTerm)) return true;
            if (product.sku?.toLowerCase().includes(sTerm)) return true;
            if (product.variants?.some(v => 
              v.barcode?.toLowerCase().includes(sTerm) || 
              v.sku?.toLowerCase().includes(sTerm)
            )) return true;
          }
        }
        return false;
      });

    const matchesProduct =
      productFilter === '' ||
      order.items?.some((item) => {
        const pId = item.productId?._id || item.productId || item.product;
        return pId?.toString() === productFilter;
      });

    let matchesStock = true;
    if (stockFilter === 'available') {
      matchesStock = getOrderStockMapDisplay(order) === 'ok';
    } else if (stockFilter === 'unavailable') {
      matchesStock = getOrderStockMapDisplay(order) === 'out';
    }

    return matchesSearch && matchesProduct && matchesStock;
  });

  const pagination = { page, limit, total: allFilteredOrders.length, pages: Math.ceil(allFilteredOrders.length / limit) || 1 };
  const filteredOrders = allFilteredOrders.slice((page - 1) * limit, page * limit);

  const filteredProducts = useMemo(() => {
    const q = (productSearch || '').trim().toLowerCase();
    if (!q) return [];
    return (productsData?.data || []).filter((p) => {
      if ((p.name || '').toLowerCase().includes(q)) return true;
      if ((p.sku || '').toLowerCase().includes(q)) return true;
      return (p.variants || []).some((v) => {
        if ((v.sku || '').toLowerCase().includes(q)) return true;
        const c = typeof v.colorId === 'object' && v.colorId?.name ? v.colorId.name : '';
        const s = typeof v.sizeId === 'object' && v.sizeId?.label ? String(v.sizeId.label) : '';
        return c.toLowerCase().includes(q) || s.toLowerCase().includes(q);
      });
    });
  }, [productSearch, productsData?.data]);

  const variantPickerRows = useMemo(() => {
    if (!variantPickerProduct?.variants?.length) return [];
    const q = (variantFilter || '').trim().toLowerCase();
    const rows = variantPickerProduct.variants.filter((v) => {
      if (!q) return true;
      if ((v.sku || '').toLowerCase().includes(q)) return true;
      const color = typeof v.colorId === 'object' && v.colorId?.name ? v.colorId.name : '';
      const size = typeof v.sizeId === 'object' && v.sizeId?.label ? String(v.sizeId.label) : '';
      return color.toLowerCase().includes(q) || size.toLowerCase().includes(q);
    });
    rows.sort((a, b) => {
      const na =
        typeof a.colorId === 'object' && a.colorId?.name ? a.colorId.name : '';
      const nb =
        typeof b.colorId === 'object' && b.colorId?.name ? b.colorId.name : '';
      const c = na.localeCompare(nb, 'fr', { sensitivity: 'base' });
      if (c !== 0) return c;
      const sa =
        typeof a.sizeId === 'object' && a.sizeId?.label ? String(a.sizeId.label) : '';
      const sb =
        typeof b.sizeId === 'object' && b.sizeId?.label ? String(b.sizeId.label) : '';
      return sa.localeCompare(sb, 'fr', { numeric: true });
    });
    return rows;
  }, [variantPickerProduct, variantFilter]);

  const resetOrderForm = () => {
    setEditingOrder(null);
    setOrderItems([]);
    setCustomer({ nom: '', telephone: '', adresse: '', gouvernerat: '', ville: '', telephone2: '' });
    setSource('Direct');
    setNotes('');
    setIsExchange(false);
    setShipping(8);
    setProductSearch('');
    setVariantPickerProduct(null);
    setVariantFilter('');
    setBundleOrderEnabled(false);
    setBundleSubtotalInput('');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetOrderForm();
  };

  const openNewOrderModal = () => {
    resetOrderForm();
    setIsModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (orderData) => {
      const res = await api.post('/orders', orderData);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['products']);
      toast.success(`Order ${data.data.orderNumber} created successfully`);
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create order');
    }
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.patch(`/orders/${id}`, data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['products']);
      toast.success(`Order ${data.data.orderNumber} updated successfully`);
      closeModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update order');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await api.put(`/orders/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      toast.success('Order status updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update order');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/orders/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['products']);
      toast.success('Order deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete order');
    }
  });

  const sendToDeliveryMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/delivery/send/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['orderStats']);
      toast.success('First Delivery OK — statut « Prêt à préparer »');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to send order to delivery');
    }
  });

  const syncStatusMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.put(`/delivery/sync/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orders']);
      toast.info(`Status synced: ${data.data?.status || 'Updated'}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to sync status');
    }
  });

  const syncAllStatusesMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put('/delivery/sync-all-statuses', { intervalMs: 1000 });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['orderStats']);
      const stats = data?.stats || {};
      toast.success(
        `Sync complete: ${stats.statusUpdated || 0} status updated, ${stats.stateOnlyUpdated || 0} state-only, ${stats.errors || 0} errors`
      );
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to sync statuses');
    }
  });

  const syncSelectedStatusesMutation = useMutation({
    mutationFn: async (orderIds) => {
      const res = await api.put('/delivery/sync-all-statuses', { intervalMs: 1000, orderIds: Array.from(orderIds) });
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['orderStats']);
      const stats = data?.stats || {};
      toast.success(
        `Sync selected complete: ${stats.statusUpdated || 0} status updated, ${stats.errors || 0} errors`
      );
      setSelectedOrderIds(new Set()); // Clear selection
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to sync selected statuses');
    }
  });

  const shopifyOrdersSyncMutation = useMutation({
    mutationFn: () => syncShopifyOrdersAllBatches({ batchSize: 200 }),
    onSuccess: (r) => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['orderStats']);
      queryClient.invalidateQueries(['products']);
      toast.success(
        `Shopify orders synced: ${r.totalUpdated} updated${r.totalFailed ? `, ${r.totalFailed} failed` : ''} (${r.totalMatching} linked in DB)`
      );
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.message || 'Shopify sync failed');
    }
  });

  const cancelDeliveryMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/delivery/cancel/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      toast.success('Delivery cancelled successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to cancel delivery');
    }
  });

  const requestPickupMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await api.post('/delivery/pickup', { orderIds: ids });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Pickup requested successfully');
      setSelectedOrderIds(new Set()); 
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to request pickup');
    }
  });

  const sendBulkMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await api.post('/delivery/bulk-send', { orderIds: ids });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderStats'] });
      const saved = data.savedWithBarcode ?? data.count;
      const total = data.count ?? 0;
      if (data.saveErrors?.length) {
        toast.warning(
          `First Delivery: ${saved}/${total} commande(s) avec code-barres — statut Prêt à préparer. Certaines sans code — voir les logs serveur.`
        );
      } else {
        toast.success(`${saved} commande(s) — First Delivery OK, statut Prêt à préparer`);
      }
      setSelectedOrderIds(new Set());
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to send bulk orders');
    }
  });

  const printDeliveryPdfMutation = useMutation({
    mutationFn: async (ids) => {
        let openedCount = 0;
        
        ids.forEach(id => {
            const order = orders.find(o => o._id === id || o._id === id.toString());
            if (order && order.deliveryPdf) {
                window.open(order.deliveryPdf, '_blank');
                openedCount++;
            }
        });
        
        if (openedCount === 0) {
            throw new Error('No delivery PDFs found for the selected orders.');
        }

        // Notify backend to update status to 'Imprimé'
        await api.post('/delivery/bulk-mark-printed', { orderIds: ids });
        
        return openedCount;
    },
    onSuccess: (count) => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['orderStats'] });
        toast.success(`Opened ${count} delivery labels for printing and marked as printed.`);
        setSelectedOrderIds(new Set());
    },
    onError: (error) => {
        console.error(error);
        toast.error(error.message || 'Failed to open delivery labels');
    }
  });

  const downloadDeliveryPdfMutation = useMutation({
    mutationFn: async (ids) => {
        const res = await api.post('/delivery/bulk-convert-pdf', { orderIds: ids }, { responseType: 'blob' });
        return res.data;
    },
    onSuccess: (blob) => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['orderStats'] });
        const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `delivery-labels-${Date.now()}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Delivery labels downloaded successfully');
        setSelectedOrderIds(new Set());
    },
    onError: (error) => {
        console.error(error);
        toast.error('Failed to download delivery labels');
    }
  });

  const createBordereauMutation = useMutation({
    mutationFn: async () => {
        const orderIds = Array.from(selectedOrderIds);
        const payload = { 
            orderIds,
            // Only include deliveryManId if one is selected, otherwise send null
            deliveryManId: selectedDeliveryMan || null 
        };
        const res = await api.post('/bordereaux', payload);
        return res.data;
    },
    onSuccess: (data) => {
        setIsBordereauModalOpen(false);
        setSelectedOrderIds(new Set());
        toast.success(`Bordereau ${data.data.code} created!`);
        // Trigger download
        const token = localStorage.getItem('token');
        window.open(`${api.defaults.baseURL}/bordereaux/${data.data._id}/pdf?token=${token}`, '_blank');
        queryClient.invalidateQueries(['orders']);
    },
    onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create bordereau');
    }
  });

  const printOrdersMutation = useMutation({
    mutationFn: async (ids) => {
        const res = await api.post('/orders/print', { orderIds: ids }, { responseType: 'blob' });
        return res.data;
    },
    onSuccess: (blob) => {
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `orders-print-${Date.now()}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Orders printed successfully');
    },
    onError: (error) => {
        console.error(error);
        toast.error('Failed to print orders');
    }
  });

  const printPackagingManifestMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await api.post(
        '/orders/packaging-manifest',
        { orderIds: ids },
        { responseType: 'blob' }
      );
      return res.data;
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `manifest-preparation-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Manifest de préparation généré');
    },
    onError: (error) => {
      const d = error.response?.data;
      let msg = d?.message;
      if (typeof d === 'string') {
        try {
          msg = JSON.parse(d).message;
        } catch {
          msg = d;
        }
      }
      toast.error(msg || 'Échec du manifest de préparation');
    }
  });

  const addItemToOrder = (product, variant, fromVariantStep = false) => {
    const itemKey = variant ? `${product._id}-${variant._id}` : product._id;
    const existingItem = orderItems.find(item => item.itemKey === itemKey);

    const displayName = variant
      ? `${product.name} (${variant.colorId?.name || 'N/A'}, ${variant.sizeId?.label || 'N/A'})`
      : product.name;
    const sku = variant ? variant.sku : product.sku;
    const availableStock = variant ? variant.quantity : product.quantity;

    const oldSum = computeCatalogItemsSubtotal(orderItems);
    let newItems;
    if (existingItem) {
      newItems = orderItems.map((item) =>
        item.itemKey === itemKey ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newItems = [
        ...orderItems,
        {
          itemKey,
          productId: product._id,
          variantId: variant?._id,
          productName: displayName,
          sku,
          quantity: 1,
          unitPrice: Number(product.price) || 0,
          availableStock
        }
      ];
    }
    setOrderItems(newItems);

    if (bundleOrderEnabled) {
      const newSum = computeCatalogItemsSubtotal(newItems);
      setBundleSubtotalInput((prev) => {
        const p = Number(prev);
        if (oldSum > 0 && Number.isFinite(p) && p > 0 && newSum > 0) return String((p * newSum) / oldSum);
        return String(newSum || 0);
      });
    }

    if (!fromVariantStep) {
      setProductSearch('');
      setVariantPickerProduct(null);
      setVariantFilter('');
    }
  };

  const removeItem = (itemKey) => {
    const oldSum = computeCatalogItemsSubtotal(orderItems);
    const newItems = orderItems.filter((item) => item.itemKey !== itemKey);
    setOrderItems(newItems);
    if (bundleOrderEnabled) {
      if (!newItems.length) {
        setBundleSubtotalInput('0');
      } else {
        const newSum = computeCatalogItemsSubtotal(newItems);
        setBundleSubtotalInput((prev) => {
          const p = Number(prev);
          if (oldSum > 0 && newSum > 0 && Number.isFinite(p)) return String((p * newSum) / oldSum);
          return String(newSum || 0);
        });
      }
    }
  };

  const updateItemQuantity = (itemKey, quantity) => {
    if (quantity < 1) return;
    const oldSum = computeCatalogItemsSubtotal(orderItems);
    const newItems = orderItems.map((item) =>
      item.itemKey === itemKey ? { ...item, quantity: parseInt(quantity, 10) } : item
    );
    setOrderItems(newItems);
    if (bundleOrderEnabled) {
      const newSum = computeCatalogItemsSubtotal(newItems);
      setBundleSubtotalInput((prev) => {
        const p = Number(prev);
        if (oldSum > 0 && newSum > 0 && Number.isFinite(p)) return String((p * newSum) / oldSum);
        return String(newSum || 0);
      });
    }
  };

  const onToggleBundleOrder = (checked) => {
    setBundleOrderEnabled(checked);
    if (checked) {
      const sum = computeCatalogItemsSubtotal(orderItems);
      setBundleSubtotalInput(String(sum || 0));
    } else {
      setBundleSubtotalInput('');
      setOrderItems((prev) =>
        prev.map((item) => {
          const p = productsData?.data?.find((x) => String(x._id) === String(item.productId));
          const cat = Number(p?.price);
          return {
            ...item,
            productName: stripPackProductNamePrefix(item.productName),
            unitPrice: Number.isFinite(cat) ? cat : item.unitPrice
          };
        })
      );
    }
  };

  /** Sum of line totals (bundle mode = single negotiated subtotal). */
  const calculateItemsSubtotal = () => {
    if (bundleOrderEnabled && orderItems.length > 0) {
      return Number(bundleSubtotalInput) || 0;
    }
    return orderItems.reduce(
      (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0),
      0
    );
  };

  const calculateGrandTotal = () => calculateItemsSubtotal() + (Number(shipping) || 0);

  const toggleOrderSelection = (id) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(id)) {
        newSelected.delete(id);
    } else {
        newSelected.add(id);
    }
    setSelectedOrderIds(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
        setSelectedOrderIds(new Set());
    } else {
        setSelectedOrderIds(new Set(filteredOrders.map(o => o._id)));
    }
  };

  const openEditModal = (order) => {
    setEditingOrder(order);
    setCustomer(order.customer || { nom: '', telephone: '', adresse: '', gouvernerat: '', ville: '', telephone2: '' });
    setSource(order.source || 'Direct');
    setNotes(order.notes || '');
    setIsExchange(Boolean(order.isExchange));
    setShipping(order.shipping || 8);
    setVariantPickerProduct(null);
    setVariantFilter('');

    // Map existing order items to the state format
    const mappedItems = order.items.map((item) => {
      const pid = item.productId?._id || item.productId;
      const vid = item.variantId?._id || item.variantId;
      return {
        itemKey: vid ? `${pid}-${vid}` : pid,
        productId: pid,
        variantId: vid,
        productName: stripPackProductNamePrefix(item.productName),
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice) || 0,
        availableStock: 9999
      };
    });

    const legacyAllBundle =
      order.items?.length > 0 && order.items.every((i) => Boolean(i.isBundleLine));
    const bundleOn = Boolean(order.isBundleOrder) || legacyAllBundle;
    const catSum = mappedItems.reduce((s, item) => {
      const p = productsData?.data?.find((x) => String(x._id) === String(item.productId));
      return s + Number(p?.price || 0) * Number(item.quantity || 0);
    }, 0);

    setBundleOrderEnabled(bundleOn);
    {
      let init = '';
      if (bundleOn) {
        init = order.bundleSubtotal ?? order.subtotal ?? catSum;
      }
      setBundleSubtotalInput(init === '' || init == null ? '' : String(init));
    }

    setOrderItems(mappedItems);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    if (bundleOrderEnabled) {
      const b = Number(bundleSubtotalInput);
      if (!Number.isFinite(b) || b < 0) {
        toast.error('Enter a valid bundle subtotal (≥ 0).');
        return;
      }
    }

    const itemsForApi = bundleOrderEnabled
      ? allocateBundleUnitPrices(orderItems, bundleSubtotalInput)
      : orderItems;

    const orderData = {
        customer,
        isBundleOrder: bundleOrderEnabled,
        bundleSubtotal: bundleOrderEnabled ? Number(bundleSubtotalInput) : undefined,
        items: itemsForApi.map((item) => ({
            product: item.productId,
            variantId: item.variantId,
            variant: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            price: item.unitPrice,
            isBundleLine: bundleOrderEnabled
        })),
        shipping,
        source,
        notes,
        isExchange
    };

    if (editingOrder) {
        updateOrderMutation.mutate({ id: editingOrder._id, data: orderData });
    } else {
        createMutation.mutate(orderData);
    }
  };

  if (isLoading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1 className="page-title">Orders</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
            {selectedOrderIds.size > 0 && (
                <>
                    <button className="btn btn-secondary" onClick={() => {
                        const confirmedOrders = orders.filter(o => selectedOrderIds.has(o._id) && ['confirmé', 'confirmée'].includes(o.status?.toLowerCase()));
                        if (confirmedOrders.length === 0) {
                             toast.warning("Only 'confirmé' orders can be sent to delivery.");
                             return;
                        }
                        if (confirmedOrders.length < selectedOrderIds.size) {
                             toast.info(`Sending ${confirmedOrders.length} confirmed orders out of ${selectedOrderIds.size} selected.`);
                        }
                        sendBulkMutation.mutate(confirmedOrders.map(o => o._id));
                    }}>
                        <FaTruck /> Send Bulk ({selectedOrderIds.size})
                    </button>
                    {canOpsOrders && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        title="PDF pour l’équipe préparation : articles + code-barres First Delivery à scanner"
                        disabled={printPackagingManifestMutation.isPending}
                        onClick={() => {
                          const withBc = orders.filter(
                            (o) =>
                              (selectedOrderIds.has(o._id) ||
                                selectedOrderIds.has(String(o._id))) &&
                              o.deliveryBarcode
                          );
                          if (withBc.length === 0) {
                            toast.warning(
                              'Sélectionnez des commandes déjà envoyées à First Delivery (code-barres requis pour le manifest).'
                            );
                            return;
                          }
                          if (withBc.length < selectedOrderIds.size) {
                            toast.info(
                              `${withBc.length} commande(s) avec code-barres dans le PDF (${selectedOrderIds.size - withBc.length} sans code ignorée(s)).`
                            );
                          }
                          printPackagingManifestMutation.mutate(
                            withBc.map((o) => String(o._id))
                          );
                        }}
                      >
                        <FaClipboardList />{' '}
                        {printPackagingManifestMutation.isPending
                          ? 'Manifest…'
                          : 'Manifest préparation'}
                      </button>
                    )}
                    {canOpsOrders && (
                        <>
                           <button className="btn btn-secondary" onClick={() => printOrdersMutation.mutate(Array.from(selectedOrderIds))} disabled={printOrdersMutation.isPending}>
                                <FaPrint /> {printOrdersMutation.isPending ? 'Printing...' : `Print Invoices (${selectedOrderIds.size})`}
                           </button>
                           <button className="btn btn-secondary" onClick={() => {
                               const selectedWithPdfs = Array.from(selectedOrderIds).filter(id => orders.find(o => o._id === id)?.deliveryPdf);
                               if (selectedWithPdfs.length === 0) {
                                   toast.warning("None of the selected orders have delivery PDFs.");
                                   return;
                               }
                               if (selectedWithPdfs.length < selectedOrderIds.size) {
                                   toast.info(`Opening ${selectedWithPdfs.length} orders with PDFs out of ${selectedOrderIds.size} selected.`);
                               }
                               printDeliveryPdfMutation.mutate(selectedWithPdfs);
                           }} disabled={printDeliveryPdfMutation.isPending}>
                                <FaPrint /> Open Delivery PDFs ({selectedOrderIds.size})
                           </button>
                           <button className="btn btn-secondary" onClick={() => {
                               const selectedWithPdfs = Array.from(selectedOrderIds).filter(id => orders.find(o => o._id === id)?.deliveryPdf);
                               if (selectedWithPdfs.length === 0) {
                                   toast.warning("None of the selected orders have delivery PDFs.");
                                   return;
                               }
                               if (selectedWithPdfs.length < selectedOrderIds.size) {
                                   toast.info(`Downloading ${selectedWithPdfs.length} orders with PDFs out of ${selectedOrderIds.size} selected.`);
                               }
                               downloadDeliveryPdfMutation.mutate(selectedWithPdfs);
                           }} disabled={downloadDeliveryPdfMutation.isPending}>
                                <FaFileDownload /> {downloadDeliveryPdfMutation.isPending ? 'Generating PDFs...' : `Download Delivery PDFs (${selectedOrderIds.size})`}
                           </button>
                           {isManagerish && (
                           <button className="btn btn-secondary" onClick={() => setIsBordereauModalOpen(true)}>
                                <FaFileAlt /> Create Bordereau ({selectedOrderIds.size})
                           </button>
                           )}
                        </>
                    )}
                    <button className="btn btn-secondary" onClick={() => requestPickupMutation.mutate(Array.from(selectedOrderIds))}>
                        <FaFileDownload /> Request Pickup ({selectedOrderIds.size})
                    </button>
                    {(canOpsOrders) && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => syncSelectedStatusesMutation.mutate(selectedOrderIds)}
                        disabled={syncSelectedStatusesMutation.isPending}
                        title="Sync status with First Delivery for selected orders"
                      >
                        <FaSync /> {syncSelectedStatusesMutation.isPending ? 'Syncing...' : `Sync Statuses (${selectedOrderIds.size})`}
                      </button>
                    )}
                </>
            )}
            <button className="btn btn-primary" onClick={openNewOrderModal}>
            <FaPlus /> New Order
            </button>
            {(user.role === 'admin' || user.role === 'manager') && (
              <button
                type="button"
                className="btn btn-secondary"
                title="Refresh Shopify order line items from your store (run Import Products in Shopify settings first for best results)"
                disabled={shopifyOrdersSyncMutation.isPending}
                onClick={() => shopifyOrdersSyncMutation.mutate()}
              >
                <FaSync /> {shopifyOrdersSyncMutation.isPending ? 'Syncing…' : 'Sync Shopify'}
              </button>
            )}
            {(user.role === 'admin' || user.role === 'manager' || user.role === 'staff') && (
              <button
                type="button"
                className="btn btn-secondary"
                title="Fetch First Delivery status for orders in 'Remis au transporteur' and update local statuses"
                disabled={syncAllStatusesMutation.isPending}
                onClick={() => syncAllStatusesMutation.mutate()}
              >
                <FaSync /> {syncAllStatusesMutation.isPending ? 'Syncing Statuses…' : 'Sync All Statuses'}
              </button>
            )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Orders</h3>
          <div className="stat-value">{statsData?.total?.count || 0}</div>
          <div className="stat-label">{statsData?.total?.amount?.toFixed(2)} dt</div>
        </div>
        <div className="stat-card">
          <h3>Pending</h3>
          <div className="stat-value" style={{ color: 'var(--warning-color)' }}>
            {statsData?.pending?.count || 0}
          </div>
           <div className="stat-label">{statsData?.pending?.amount?.toFixed(2)} dt</div>
        </div>
        <div className="stat-card">
          <h3>Confirmed</h3>
          <div className="stat-value" style={{ color: 'var(--purple-color, #9c27b0)' }}>
             {statsData?.confirmed?.count || 0}
          </div>
           <div className="stat-label">{statsData?.confirmed?.amount?.toFixed(2)} dt</div>
        </div>
        <div className="stat-card">
          <h3>In Process</h3>
          <div className="stat-value" style={{ color: 'var(--info-color)' }}>
             {statsData?.processing?.count || 0}
          </div>
           <div className="stat-label">{statsData?.processing?.amount?.toFixed(2)} dt</div>
        </div>
        <div className="stat-card">
          <h3>Prêt à préparer</h3>
          <div className="stat-value" style={{ color: '#0f766e' }}>
            {statsData?.readyToPrepare?.count ?? 0}
          </div>
          <div className="stat-label">{(statsData?.readyToPrepare?.amount ?? 0).toFixed(2)} dt</div>
        </div>
        <div className="stat-card">
          <h3>Remis transporteur</h3>
          <div className="stat-value" style={{ color: '#b45309' }}>
            {statsData?.atCarrier?.count ?? 0}
          </div>
          <div className="stat-label">{(statsData?.atCarrier?.amount ?? 0).toFixed(2)} dt</div>
        </div>
        <div className="stat-card">
          <h3>Completed</h3>
          <div className="stat-value" style={{ color: 'var(--success-color)' }}>
             {statsData?.completed?.count || 0}
          </div>
           <div className="stat-label">{statsData?.completed?.amount?.toFixed(2)} dt</div>
        </div>
         <div className="stat-card">
          <h3>Cancelled</h3>
          <div className="stat-value" style={{ color: 'var(--danger-color)' }}>
             {statsData?.cancelled?.count || 0}
          </div>
           <div className="stat-label">{statsData?.cancelled?.amount?.toFixed(2)} dt</div>
        </div>
        <div className="stat-card">
          <h3>NRP</h3>
          <div className="stat-value" style={{ color: 'var(--secondary-color, #6c757d)' }}>
             {statsData?.nrp?.count || 0}
          </div>
           <div className="stat-label">{statsData?.nrp?.amount?.toFixed(2)} dt</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
             {/* Search and Filters */}
             <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="search-box" style={{ flex: 1, minWidth: '300px' }}>
                    <FaSearch className="search-icon" />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div style={{ minWidth: '200px' }}>
                      <select 
                          className="form-control" 
                          value={productFilter} 
                          onChange={(e) => setProductFilter(e.target.value)}
                      >
                          <option value="">All Products</option>
                          {productsData?.data?.map(product => (
                              <option key={product._id} value={product._id}>
                                  {product.name}
                              </option>
                          ))}
                      </select>
                  </div>
                  <div style={{ minWidth: '200px' }}>
                      <select
                          className="form-control"
                          value={stockFilter}
                          onChange={(e) => setStockFilter(e.target.value)}
                          title="Only orders in « Prêt à préparer » are matched: In stock / Out of stock use catalog shelf quantities. Other statuses are hidden when this filter is set."
                      >
                          <option value="">All Stock</option>
                          <option value="available">In Stock</option>
                          <option value="unavailable">Out of Stock</option>
                      </select>
                  </div>
             </div>

             {/* Status Tabs */}
             <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                {statusGroups.map((group) => (
                    <button
                        key={group.value}
                        onClick={() => setStatusFilter(group.value)}
                        className={`status-tab ${statusFilter === group.value ? 'active' : ''}`}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '9999px',
                            border: statusFilter === group.value ? '1px solid var(--primary-color)' : '1px solid transparent',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: statusFilter === group.value ? '600' : '500',
                            backgroundColor: statusFilter === group.value ? 'var(--primary-color)' : 'var(--bg-secondary)',
                            color: statusFilter === group.value ? 'white' : 'var(--text-secondary)',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {group.label}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                    <input 
                        type="checkbox" 
                        checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                        onChange={toggleAllSelection}
                    />
                </th>
                <th title="Catalog / shelf stock — shown only for « Prêt à préparer »">Stock</th>
                <th>Phone</th>
                <th>Products</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan="11" style={{ textAlign: 'center' }}>No orders found</td></tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order._id}>
                    <td>
                        <input 
                            type="checkbox" 
                            checked={selectedOrderIds.has(order._id)}
                            onChange={() => toggleOrderSelection(order._id)}
                        />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {(() => {
                        if (!isPretAPreparerOrder(order)) {
                          return (
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }} title="Stock column applies only to « Prêt à préparer »">
                              —
                            </span>
                          );
                        }
                        const shelf = getOrderStockDisplay(order);
                        if (shelf === 'none') {
                          return <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>—</span>;
                        }
                        if (shelf === 'ok') {
                          return (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: '#dcfce7',
                                color: '#16a34a',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                border: '2px solid #86efac'
                              }}
                              title="In stock — catalog / shelf quantities"
                            >
                              ✓
                            </span>
                          );
                        }
                        if (shelf === 'out') {
                          return (
                            <button
                              type="button"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: '#fee2e2',
                                color: '#dc2626',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                border: '2px solid #fca5a5',
                                cursor: 'pointer'
                              }}
                              title="Out of stock on shelf — click for details"
                              onClick={() => setOutOfStockOrder(order)}
                            >
                              ✕
                            </button>
                          );
                        }
                        return (
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '600' }} title="Could not verify all lines">
                            ?
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: '600' }}>{order.customer?.telephone || '—'}</span>
                        {order.customer?.telephone && (
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}
                            title="Copy phone number"
                            onClick={() => {
                              navigator.clipboard.writeText(order.customer.telephone);
                              toast.success('Phone number copied!', { autoClose: 1500 });
                            }}
                          >
                            <FaCopy size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                        <div style={{ maxWidth: '300px' }}>
                            {order.items?.map((item, idx) => {
                              const isAvailable = getLineItemStockMapAvailability(item, order);
                              return (
                                <div key={idx} style={{ fontSize: '0.85rem', marginBottom: '2px', display: 'flex', alignItems: 'center' }}>
                                    <strong>{item.productName}</strong>
                                    {item.colorName && <span className="text-gray-600 ml-1">- {item.colorName}</span>}
                                    {item.sizeLabel && <span className="text-gray-600 ml-1">- {item.sizeLabel}</span>}
                                    {item.quantity > 1 && <span className="badge badge-sm badge-secondary" style={{ marginLeft: '5px' }}>x{item.quantity}</span>}
                                    {(isAvailable === true || isAvailable === false || isAvailable === null) && (
                                    <span style={{ marginLeft: '5px', display: 'inline-flex', alignItems: 'center' }}>
                                      {isAvailable === true && (
                                        <FaCheck className="text-green-500" title="In stock" />
                                      )}
                                      {isAvailable === false && (
                                        <FaTimes className="text-red-500" title="Out of stock" />
                                      )}
                                      {isAvailable === null && productsData?.data && (
                                        <FaQuestionCircle className="text-gray-400" title="Stock unknown (product not found or variant not matched)" />
                                      )}
                                    </span>
                                    )}
                                </div>
                            )})}
                        </div>
                    </td>
                    <td>{order.customer?.nom || 'Walk-in Customer'}</td>
                    <td>{order.items?.length || 0} items</td>
                    <td><strong>{order.total?.toFixed(2)} dt</strong></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                        {canOpsOrders ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                          <select
                            className={`badge ${getStatusBadge(order.status)}`}
                            value={canonicalStatusLabel(order.status)}
                            title={
                              isGovernorateIncompleteForConfirmation(order.customer?.gouvernerat)
                                ? 'Choisissez un gouvernorat réel (modifier la commande) avant de confirmer.'
                                : undefined
                            }
                            onChange={(e) => {
                              const next = e.target.value;
                              const pending = isGovernorateIncompleteForConfirmation(order.customer?.gouvernerat);
                              const wantsConfirm =
                                (next === 'Confirmé' || next === 'Confirmée') &&
                                !['confirmé', 'confirmée'].includes((order.status || '').toLowerCase());
                              if (wantsConfirm && pending) {
                                toast.error('Renseignez un gouvernorat valide avant de confirmer (adresse non disponible).');
                                return;
                              }
                              updateStatusMutation.mutate({ id: order._id, status: next });
                            }}
                            style={{ cursor: 'pointer', border: 'none' }}
                          >
                            {statuses.map((status) => (
                              <option
                                key={status}
                                value={status}
                                disabled={
                                  status === 'Confirmé' &&
                                  isGovernorateIncompleteForConfirmation(order.customer?.gouvernerat)
                                }
                              >
                                {status}
                              </option>
                            ))}
                          </select>
                          {isGovernorateIncompleteForConfirmation(order.customer?.gouvernerat) &&
                            (order.status || '').toLowerCase() === 'en attente' && (
                            <span style={{ fontSize: '0.72rem', color: '#b45309', maxWidth: '200px', lineHeight: 1.3 }}>
                              Gouvernorat à compléter avant confirmation
                            </span>
                          )}
                          </div>
                        ) : (
                          <span className={`badge ${getStatusBadge(order.status)}`}>
                              {canonicalStatusLabel(order.status)}
                          </span>
                        )}
                        {order.isExchange && (
                          <span className="badge badge-warning" title="Commande échange">Échange</span>
                        )}
                      </div>
                    </td>
                    <td>
                        {order.deliveryBarcode ? (
                            <span className="badge badge-info" title={order.deliveryBarcode}>
                                Sent <small>({order.deliveryState || 0})</small>
                            </span>
                        ) : (
                            <span className="badge badge-secondary">Not Sent</span>
                        )}
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                      {(() => {
                        if (!isPretAPreparerOrder(order)) return null;
                        const stock = getOrderStockDisplay(order);
                        if (stock === 'ok') {
                          return (
                            <span style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                              <FaCheck
                                className="text-green-500"
                                title="In stock (catalog / shelf — « Prêt à préparer » only)"
                                size={20}
                              />
                            </span>
                          );
                        }
                        if (stock === 'out') {
                          return (
                            <button
                              className="btn btn-sm"
                              style={{ marginRight: '10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px' }}
                              title="Out of stock — click for details"
                              type="button"
                              onClick={() => setOutOfStockOrder(order)}
                            >
                              <FaExclamationTriangle size={14} /> Out
                            </button>
                          );
                        }
                        if (stock === 'unknown') {
                          return (
                            <span style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                              <FaQuestionCircle className="text-gray-400" title="Could not verify (products loading or variant not matched)" size={20} />
                            </span>
                          );
                        }
                        return null;
                      })()}

                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}
                        style={{ marginRight: '5px' }}
                        title="View Details & QR"
                      >
                        <FaEye />
                      </button>

                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}
                        style={{ marginRight: '5px' }}
                        title="Show Scan QR"
                      >
                        <FaQrcode />
                      </button>

                      {canOpsOrders && (
                          <>
                              {!order.deliveryBarcode &&
                              (order.status === 'Préparé' ||
                                order.status === 'Confirmé' ||
                                order.status === 'Confirmée' ||
                                order.status?.toLowerCase() === 'confirmé') ? (
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => {
                                        if(window.confirm(`Send Order ${order.orderNumber} to Delivery?`)) {
                                            sendToDeliveryMutation.mutate(order._id);
                                        }
                                    }}
                                    style={{ marginRight: '5px' }}
                                    title="Send to Delivery"
                                  >
                                    <FaTruck />
                                  </button>
                              ) : !order.deliveryBarcode ? null : (
                                  <>
                                    <button
                                        className="btn btn-sm btn-info"
                                        onClick={() => syncStatusMutation.mutate(order._id)}
                                        style={{ marginRight: '5px' }}
                                        title="Sync Status"
                                    >
                                        <FaSync />
                                    </button>
                                    {order.status !== 'Annulée' && order.status !== 'Annulé' && (
                                        <button
                                            className="btn btn-sm btn-warning"
                                            onClick={() => {
                                                if(window.confirm('Cancel delivery for this order?')) {
                                                    cancelDeliveryMutation.mutate(order._id);
                                                }
                                            }}
                                            style={{ marginRight: '5px' }}
                                            title="Cancel Delivery"
                                        >
                                            <FaBan />
                                        </button>
                                    )}
                                  </>
                              )}

                              <button
                                className="btn btn-sm btn-info"
                                onClick={() => openEditModal(order)}
                                style={{ marginRight: '5px' }}
                                title="Edit Order"
                              >
                                <FaEdit />
                              </button>

                              {isManagerish && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => {
                                  if (window.confirm('Delete this order?')) deleteMutation.mutate(order._id);
                                }}
                                title="Delete Order"
                              >
                                <FaTrash />
                              </button>
                              )}
                          </>
                      )}

                      {user.role === 'supplier' && (order.status === 'Confirmé' || order.status === 'Confirmée') && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => updateStatusMutation.mutate({ id: order._id, status: 'Préparé' })}
                            style={{ marginRight: '5px' }}
                            title="Mark as Prepared"
                          >
                            <FaBoxOpen className="mr-1" /> Ready
                          </button>
                      )}

                      {user.role === 'delivery_man' && (
                          <>
                            {(order.status === 'Préparé') && (
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => updateStatusMutation.mutate({ id: order._id, status: 'Expédié' })}
                                    style={{ marginRight: '5px' }}
                                    title="Pick Up Order"
                                >
                                    <FaShippingFast className="mr-1" /> Pick Up
                                </button>
                            )}
                            {order.status === 'Expédié' && (
                                <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => updateStatusMutation.mutate({ id: order._id, status: 'Livré' })}
                                    style={{ marginRight: '5px' }}
                                    title="Mark Delivered"
                                >
                                    <FaCheck className="mr-1" /> Delivered
                                </button>
                            )}
                          </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '10px 0' }}>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Showing <span style={{ fontWeight: '600' }}>{((page - 1) * limit) + 1}</span> to <span style={{ fontWeight: '600' }}>{Math.min(page * limit, pagination.total)}</span> of <span style={{ fontWeight: '600' }}>{pagination.total}</span> results
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
                <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary btn-sm"
                    style={{ opacity: page === 1 ? 0.5 : 1 }}
                >
                    Previous
                </button>
                
                {/* Simple page numbers */}
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    // Show 5 pages around current page logic can be complex, let's keep it simple for now or implement better logic
                    // If pages > 5, this simple map is insufficient.
                    // Better to just show current page and prev/next for now to keep it clean, 
                    // or standard [1] ... [current-1] [current] [current+1] ... [last]
                    
                    let p = page;
                    if (pagination.pages <= 5) return i + 1;
                    // Center around current page
                    if (page <= 3) return i + 1;
                    if (page >= pagination.pages - 2) return pagination.pages - 4 + i;
                    return page - 2 + i;
                }).map(p => (
                    <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        {p}
                    </button>
                ))}

                <button 
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="btn btn-secondary btn-sm"
                    style={{ opacity: page === pagination.pages ? 0.5 : 1 }}
                >
                    Next
                </button>
            </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingOrder ? `Edit Order ${editingOrder.orderNumber}` : "Create New Order"}>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Add products</label>

            {!variantPickerProduct ? (
              <>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Search by product name, SKU, color or size…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    autoComplete="off"
                  />
                  <FaSearch className="absolute right-4 top-3.5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Products with variants open a list where you can filter and add each size/color.
                </p>

                {productSearch.trim() && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">No products match.</div>
                    ) : (
                      <>
                        {filteredProducts.slice(0, 25).map((product) => {
                          const nVar = product.variants?.length || 0;
                          const hasVariants = nVar > 0;
                          const totalStock = hasVariants
                            ? product.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0)
                            : Number(product.quantity ?? product.totalQuantity ?? 0);
                          return (
                            <button
                              key={product._id}
                              type="button"
                              onClick={() => {
                                if (hasVariants) {
                                  setVariantPickerProduct(product);
                                  setVariantFilter('');
                                } else {
                                  addItemToOrder(product, null);
                                }
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex justify-between items-center gap-3 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-gray-800 truncate">{product.name}</div>
                                <div className="text-sm text-gray-500 truncate">
                                  {product.sku && <span className="text-gray-400 mr-2">{product.sku}</span>}
                                  {hasVariants ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-800">
                                      {nVar} variant{nVar !== 1 ? 's' : ''} — choose…
                                    </span>
                                  ) : (
                                    <span className="text-xs text-green-700">Add to order</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-bold text-gray-900">{product.price ?? 0} dt</div>
                                <div
                                  className={`text-xs ${totalStock > 0 ? 'text-green-600' : 'text-red-600'}`}
                                >
                                  Stock: {totalStock}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {filteredProducts.length > 25 && (
                          <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t">
                            Refine search ({filteredProducts.length} products).
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-lg text-gray-900 leading-tight">
                      {variantPickerProduct.name}
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      {variantPickerProduct.variants?.length || 0} variants — filter, then add
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary flex-shrink-0"
                    onClick={() => {
                      setVariantPickerProduct(null);
                      setVariantFilter('');
                    }}
                  >
                    ← Back to search
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Filter: color, size or SKU…"
                    value={variantFilter}
                    onChange={(e) => setVariantFilter(e.target.value)}
                    autoComplete="off"
                  />
                  <FaSearch className="absolute right-3 top-3 text-gray-400 text-sm" />
                </div>

                <div className="max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white">
                  {variantPickerRows.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">No variants match this filter.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-gray-100 text-gray-700 shadow-sm">
                        <tr>
                          <th className="text-left font-semibold px-3 py-2">Color</th>
                          <th className="text-left font-semibold px-3 py-2">Size</th>
                          <th className="text-left font-semibold px-3 py-2 hidden sm:table-cell">SKU</th>
                          <th className="text-right font-semibold px-3 py-2">Stock</th>
                          <th className="px-2 py-2 w-24" />
                        </tr>
                      </thead>
                      <tbody>
                        {variantPickerRows.map((v) => {
                          const stock = Number(v.quantity) || 0;
                          const color =
                            typeof v.colorId === 'object' && v.colorId?.name
                              ? v.colorId.name
                              : '—';
                          const size =
                            typeof v.sizeId === 'object' && v.sizeId?.label
                              ? String(v.sizeId.label)
                              : '—';
                          return (
                            <tr
                              key={v._id}
                              className="border-t border-gray-100 hover:bg-blue-50/50"
                            >
                              <td className="px-3 py-2 font-medium text-gray-800">{color}</td>
                              <td className="px-3 py-2 text-gray-700">{size}</td>
                              <td className="px-3 py-2 text-gray-500 text-xs hidden sm:table-cell font-mono">
                                {v.sku || '—'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className={stock > 0 ? 'text-green-700 font-medium' : 'text-red-600'}>
                                  {stock}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary w-full"
                                  onClick={() => addItemToOrder(variantPickerProduct, v, true)}
                                  title="Add one unit (or increase qty if already in order)"
                                >
                                  <FaPlus className="inline mr-1" style={{ fontSize: '0.7rem' }} />
                                  Add
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Bundle pricing</label>
            <div
              className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
              style={{ marginTop: '4px' }}
            >
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={bundleOrderEnabled}
                  onChange={(e) => onToggleBundleOrder(e.target.checked)}
                />
                This order is a bundle (one subtotal for all lines — catalog prices are not used per line)
              </label>
              {bundleOrderEnabled && (
                <div className="mt-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Bundle subtotal (dt)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    style={{ maxWidth: '200px' }}
                    value={bundleSubtotalInput}
                    onChange={(e) => setBundleSubtotalInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-600">
                    Unit prices in the table are a split of this total (by catalog proportions). Change products with
                    remove + add above; the bundle total scales when qty or lines change.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Order Items</label>
            {orderItems.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No items added</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit price</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bundleOrderEnabled ? orderItemsDisplayed : orderItems).map((item) => (
                      <tr key={item.itemKey}>
                        <td>
                          <strong>{item.productName}</strong>
                          <br />
                          <small>{item.sku}</small>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.itemKey, e.target.value)}
                            className="form-control"
                            style={{ width: '70px' }}
                          />
                        </td>
                        <td>
                          <span className={bundleOrderEnabled ? 'text-gray-600' : ''}>
                            {Number(item.unitPrice).toFixed(2)} dt
                          </span>
                          {bundleOrderEnabled && (
                            <span
                              className="text-muted"
                              style={{ fontSize: '0.65rem', display: 'block' }}
                            >
                              from bundle split
                            </span>
                          )}
                        </td>
                        <td>
                          <strong>{(Number(item.unitPrice) * item.quantity).toFixed(2)} dt</strong>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => removeItem(item.itemKey)}
                          >
                            <FaTimes />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'right' }}>Subtotal (lines):</td>
                      <td>{calculateItemsSubtotal().toFixed(2)} dt</td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'right' }}>Shipping:</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={shipping}
                          onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                          className="form-control"
                          style={{ width: '100px' }}
                        /> dt
                      </td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'right' }}><strong>Total:</strong></td>
                      <td><strong style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>{calculateGrandTotal().toFixed(2)} dt</strong></td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Customer Info (Optional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input type="text" className="form-control" placeholder="Name (Nom)" value={customer.nom}
                onChange={(e) => setCustomer({ ...customer, nom: e.target.value })} />
              
              <select className="form-control" value={source}
                onChange={(e) => setSource(e.target.value)}>
                <option value="Direct">Direct</option>
                <option value="Website">Website</option>
                <option value="Phone">Phone</option>
                <option value="Social Media">Social Media</option>
                <option value="Autre">Autre</option>
              </select>

              <select className="form-control" value={customer.gouvernerat}
                onChange={(e) => setCustomer({ ...customer, gouvernerat: e.target.value })}>
                <option value="" disabled>Select Governorate</option>
                <option value={GOVERNORATE_ADDRESS_UNAVAILABLE}>{GOVERNORATE_ADDRESS_UNAVAILABLE}</option>
                {tunisiaGovernorates.map(gov => (
                  <option key={gov} value={gov}>{gov}</option>
                ))}
              </select>
                
              <input type="text" className="form-control" placeholder="City" value={customer.ville}
                onChange={(e) => setCustomer({ ...customer, ville: e.target.value })} />

              <input type="tel" className="form-control" placeholder="Phone" value={customer.telephone}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, ''); // keep only numbers
                  if (val.startsWith('216')) {
                    val = val.slice(3);
                  }
                  if (val.length > 8) {
                    val = val.slice(0, 8);
                  }
                  setCustomer({ ...customer, telephone: val });
                }} />
                
              <input type="tel" className="form-control" placeholder="Phone 2 (Optional)" value={customer.telephone2}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (val.startsWith('216')) {
                    val = val.slice(3);
                  }
                  if (val.length > 8) {
                    val = val.slice(0, 8);
                  }
                  setCustomer({ ...customer, telephone2: val });
                }} />
                
              <input type="text" className="form-control" placeholder="Address" value={customer.adresse} style={{gridColumn: 'span 2'}}
                onChange={(e) => setCustomer({ ...customer, adresse: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '500' }}>
              <input
                type="checkbox"
                checked={isExchange}
                onChange={(e) => setIsExchange(e.target.checked)}
              />
              Échange (remplacement / retour produit)
            </label>
          </div>

          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="Add any notes for the order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}
            disabled={orderItems.length === 0 || createMutation.isPending || updateOrderMutation.isPending}>
            {editingOrder 
              ? (updateOrderMutation.isPending ? 'Updating...' : 'Update Order') 
              : (createMutation.isPending ? 'Creating...' : 'Create Order')
            }
          </button>
        </form>
      </Modal>

      <Modal isOpen={isBordereauModalOpen} onClose={() => setIsBordereauModalOpen(false)} title="Generate Bordereau">
        <div className="p-4">
            <h3 className="text-lg font-bold mb-4">Select Delivery Man (Optional)</h3>
            
            <div className="form-group mb-4">
                <label className="block text-gray-700">Delivery Agent</label>
                <select 
                    className="form-control"
                    value={selectedDeliveryMan}
                    onChange={(e) => setSelectedDeliveryMan(e.target.value)}
                >
                    <option value="">-- Unassigned (Print for Later Scan) --</option>
                    {deliveryMenData?.map(dm => (
                        <option key={dm._id} value={dm._id}>{dm.name}</option>
                    ))}
                </select>
                <small className="text-gray-500">Leave empty to create a manifest that is claimed via scanning.</small>
            </div>

            <div className="bg-gray-50 p-3 rounded mb-4">
                <p><strong>Selected Orders:</strong> {selectedOrderIds.size}</p>
                <p className="text-sm text-gray-500">This will generate a PDF manifest.</p>
            </div>

            <button 
                className="btn btn-primary w-full"
                disabled={createBordereauMutation.isPending}
                onClick={() => createBordereauMutation.mutate()}
            >
                {createBordereauMutation.isPending ? 'Generating...' : 'Generate & Download PDF'}
            </button>
        </div>
      </Modal>

      <Modal isOpen={!!outOfStockOrder} onClose={() => setOutOfStockOrder(null)} title={`Out of Stock — ${outOfStockOrder?.orderNumber || ''}`}>
        {outOfStockOrder && (
          <div>
            <p style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Items that are out of stock or have insufficient quantity (catalog / shelf):
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {outOfStockOrder.items?.map((item, idx) => {
                const detail = getItemStockDetail(item);
                if (detail.available !== false) return null;
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                    <div>
                      <strong>{item.productName}</strong>
                      {item.colorName && <span style={{ color: '#6b7280', marginLeft: '6px' }}>- {item.colorName}</span>}
                      {item.sizeLabel && <span style={{ color: '#6b7280', marginLeft: '6px' }}>- {item.sizeLabel}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.85rem' }}>
                        <span style={{ color: '#dc2626', fontWeight: '700' }}>{detail.have ?? '?'}</span>
                        <span style={{ color: '#6b7280' }}> / {detail.need} needed</span>
                      </span>
                      <FaTimes className="text-red-500" size={14} />
                    </div>
                  </div>
                );
              })}
              {outOfStockOrder.items?.every((item) => getItemStockDetail(item).available !== false) && (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>No out-of-stock items found.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={`Order ${selectedOrder?.orderNumber || ''}`}>
        {selectedOrder && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`badge ${getStatusBadge(selectedOrder.status)}`}>
                  {canonicalStatusLabel(selectedOrder.status)}
                </span>
                <span style={{ fontFamily: 'monospace', fontWeight: '600', fontSize: '0.95rem', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {selectedOrder.orderNumber}
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)', display: 'inline-flex' }}
                    title="Copy order number"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedOrder.orderNumber);
                      toast.success('Order number copied!', { autoClose: 1500 });
                    }}
                  >
                    <FaCopy size={12} />
                  </button>
                </span>
              </div>
              <span>{new Date(selectedOrder.createdAt).toLocaleString()}</span>
            </div>

            <h4>Customer</h4>
            <p><strong>Name:</strong> {selectedOrder.customer?.nom || 'N/A'}</p>
            <p><strong>Source:</strong> {selectedOrder.source || 'Direct'}</p>
            {selectedOrder.isExchange && (
              <p><span className="badge badge-warning">Échange</span></p>
            )}
            {selectedOrder.customer?.telephone && <p><strong>Phone:</strong> {selectedOrder.customer.telephone}</p>}
            {selectedOrder.customer?.telephone2 && <p><strong>Phone 2:</strong> {selectedOrder.customer.telephone2}</p>}
            {selectedOrder.customer?.adresse && <p><strong>Address:</strong> {selectedOrder.customer.adresse}, {selectedOrder.customer.ville}, {selectedOrder.customer.gouvernerat}</p>}

            {selectedOrder.notes && <h4 style={{ marginTop: '15px' }}>Notes</h4>}
            {selectedOrder.notes && <p>{selectedOrder.notes}</p>}
            
            <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h4 style={{marginTop: 0, marginBottom: '10px'}}>Internal Delivery QR</h4>
                <QRCodeCanvas 
                    value={selectedOrder.orderNumber} 
                    size={128}
                    level={"H"}
                    includeMargin={true}
                />
                <p style={{marginTop: '5px', fontSize: '0.9em', color: '#666'}}>Scan this to assign to Delivery Man</p>
                <p className="font-mono font-bold mt-1 text-lg">{selectedOrder.orderNumber}</p>
            </div>

            {selectedOrder.deliveryBarcode && (
                <div style={{ marginTop: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px' }}>
                    <h4 style={{marginTop: 0}}>Delivery Info</h4>
                    <p><strong>Barcode:</strong> {selectedOrder.deliveryBarcode}</p>
                    <p><strong>State Code:</strong> {selectedOrder.deliveryState}</p>
                    {selectedOrder.pickupDate && <p><strong>Pickup Date:</strong> {new Date(selectedOrder.pickupDate).toLocaleDateString()}</p>}
                    {selectedOrder.deliveredDate && <p><strong>Delivered Date:</strong> {new Date(selectedOrder.deliveredDate).toLocaleDateString()}</p>}
                    <div style={{ marginTop: '10px' }}>
                         <button className="btn btn-sm btn-info" onClick={() => syncStatusMutation.mutate(selectedOrder._id)} style={{marginRight: '5px'}}>
                            <FaSync /> Sync Status
                         </button>
                         <button className="btn btn-sm btn-warning" onClick={() => cancelDeliveryMutation.mutate(selectedOrder._id)}>
                            <FaBan /> Cancel Delivery
                         </button>
                    </div>
                </div>
            )}

            <h4 style={{ marginTop: '15px' }}>Items</h4>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '10px' }}>
              {isPretAPreparerOrder(selectedOrder)
                ? 'Line icons reflect catalog / shelf quantities for preparation.'
                : 'Stock icons are shown only when the order is « Prêt à préparer ».'}
            </p>
            {selectedOrder.items?.map((item, idx) => {
              const isAvailable = getLineItemStockMapAvailability(item, selectedOrder);
              return (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div><strong>{item.productName}</strong><br /><small>{item.quantity} x {item.unitPrice?.toFixed(2)} dt</small></div>
                  {(isAvailable === true || isAvailable === false || isAvailable === null) && (
                  <span className="ml-2" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {isAvailable === true && <FaCheck className="text-green-500" title="In stock" />}
                    {isAvailable === false && <FaTimes className="text-red-500" title="Out of stock" />}
                    {isAvailable === null && productsData?.data && (
                      <FaQuestionCircle className="text-gray-400" title="Stock unknown (product not found or variant not matched)" />
                    )}
                  </span>
                  )}
                </div>
                <strong>{item.totalPrice?.toFixed(2)} dt</strong>
              </div>
            )})}

            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{selectedOrder.subtotal?.toFixed(2)} dt</span></div>
              {selectedOrder.tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax</span><span>{selectedOrder.tax.toFixed(2)} dt</span></div>}
              {selectedOrder.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-color)' }}><span>Discount</span><span>-{selectedOrder.discount.toFixed(2)} dt</span></div>}
              {selectedOrder.shipping > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Shipping</span><span>{selectedOrder.shipping.toFixed(2)} dt</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 'bold', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <span>Total</span><span>{selectedOrder.total?.toFixed(2)} dt</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
