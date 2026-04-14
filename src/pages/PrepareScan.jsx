import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FaBarcode, FaBoxOpen, FaCheck, FaHistory, FaSearch, FaUndo } from 'react-icons/fa';
import api from '../services/api';

function normalizeScanInput(raw) {
  if (raw == null) return '';
  return String(raw).trim().replace(/§/g, '-');
}

/** Même règle que l’API : seulement « Prêt à préparer » (après Confirmé dans le workflow). */
function orderStatusAllowsPrepareScan(s) {
  if (!s) return false;
  const n = String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return n === 'pret a preparer';
}

export default function PrepareScan() {
  const [orderToken, setOrderToken] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [productCode, setProductCode] = useState('');
  const [lastOrder, setLastOrder] = useState(null);
  const orderInputRef = useRef(null);
  const productInputRef = useRef(null);
  const queryClient = useQueryClient();
  const [historyPage, setHistoryPage] = useState(1);

  const { data: historyPayload, isLoading: historyLoading } = useQuery({
    queryKey: ['prepare-history', historyPage],
    queryFn: async () => {
      const res = await api.get('/orders/prepare-history', {
        params: { page: historyPage, limit: 40 }
      });
      return res.data;
    },
    staleTime: 15_000
  });

  useEffect(() => {
    if (activeOrder) {
      productInputRef.current?.focus();
    } else {
      orderInputRef.current?.focus();
    }
  }, [activeOrder]);

  const loadOrderMutation = useMutation({
    mutationFn: async (token) => {
      const id = encodeURIComponent(token);
      const res = await api.get(`/orders/${id}`);
      return res.data.data;
    },
    onSuccess: (order) => {
      if (!orderStatusAllowsPrepareScan(order.status)) {
        toast.error(
          'La commande doit être au statut « Prêt à préparer » pour la préparation (En attente → Confirmé → Prêt à préparer → …).'
        );
        setOrderToken('');
        orderInputRef.current?.focus();
        return;
      }
      setActiveOrder(order);
      setOrderToken('');
      setProductCode('');
      toast.success(`Commande ${order.orderNumber} — scannez les articles.`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Commande introuvable');
      setOrderToken('');
      orderInputRef.current?.focus();
    }
  });

  const itemScanMutation = useMutation({
    mutationFn: async ({ token, barcode }) => {
      const res = await api.post('/orders/prepare-item-scan', {
        orderToken: token,
        barcode
      });
      return res.data;
    },
    onSuccess: (data) => {
      const order = data.data;
      setProductCode('');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['prepare-history'] });
      if (data.orderCompleted) {
        setLastOrder(order);
        setActiveOrder(null);
        toast.success(data.message || 'Commande — Préparé', { autoClose: 4000 });
        orderInputRef.current?.focus();
        setTimeout(() => setLastOrder(null), 8000);
      } else {
        setActiveOrder(order);
        toast.success(data.message || 'Ligne préparée', { autoClose: 2500 });
        productInputRef.current?.focus();
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Scan impossible');
      setProductCode('');
      productInputRef.current?.focus();
    }
  });

  const finalizeMutation = useMutation({
    mutationFn: async (orderId) => {
      const id = encodeURIComponent(orderId);
      const res = await api.put(`/orders/${id}`, { status: 'Préparé' });
      return res.data;
    },
    onSuccess: (data) => {
      const order = data?.data;
      setLastOrder(order);
      setActiveOrder(null);
      setProductCode('');
      toast.success(
        order?.orderNumber
          ? `Commande ${order.orderNumber} — Préparé`
          : 'Commande marquée comme Préparé',
        { autoClose: 3500 }
      );
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['prepare-history'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      orderInputRef.current?.focus();
      setTimeout(() => setLastOrder(null), 8000);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Échec de la finalisation');
    }
  });

  const handleLoadOrder = (e) => {
    e.preventDefault();
    const token = normalizeScanInput(orderToken);
    if (token) loadOrderMutation.mutate(token);
  };

  const handleProductScan = (e) => {
    e.preventDefault();
    const barcode = normalizeScanInput(productCode);
    if (!barcode || !activeOrder) return;
    const token =
      activeOrder.orderNumber ||
      activeOrder.deliveryBarcode ||
      activeOrder._id;
    itemScanMutation.mutate({ token, barcode });
  };

  const pendingCount = activeOrder?.items?.filter((it) => !it.stockDeductedAtPrepare).length ?? 0;

  return (
    <div>
      <div className="page-header">
        <h1>
          <FaBoxOpen /> Préparation — scan
        </h1>
        <p style={{ color: '#555', marginTop: '8px', maxWidth: '720px' }}>
          Workflow : <strong>En attente</strong> → <strong>Confirmé</strong> → <strong>Prêt à préparer</strong> →
          remis au transporteur → livré / non livré (First). Ici : chargez une commande au statut{' '}
          <strong>Prêt à préparer</strong>, scannez chaque <strong>code-barres / SKU</strong> ; le stock diminue de la{' '}
          <strong>quantité sur la ligne</strong>. Quand la dernière ligne est scannée, la commande passe automatiquement en{' '}
          <strong>Préparé</strong> (les marqueurs de préparation par article sont effacés).
        </p>
      </div>

      {!activeOrder ? (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3>
            <FaSearch /> 1 — Charger la commande
          </h3>
          <p style={{ color: '#555', marginBottom: '12px' }}>
            Code transport First Delivery, <strong>n° de commande</strong>, ou ID Mongo — statut{' '}
            <strong>Prêt à préparer</strong> requis.
          </p>
          <form onSubmit={handleLoadOrder}>
            <div className="form-group">
              <label>Commande</label>
              <input
                ref={orderInputRef}
                type="text"
                value={orderToken}
                onChange={(e) => setOrderToken(e.target.value)}
                placeholder="Scan ou saisie puis Entrée…"
                autoComplete="off"
                style={{
                  fontSize: '1.2rem',
                  padding: '15px',
                  border: '2px solid #27ae60'
                }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-success"
              disabled={!normalizeScanInput(orderToken) || loadOrderMutation.isPending}
            >
              <FaBarcode /> {loadOrderMutation.isPending ? 'Chargement…' : 'Charger'}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ marginTop: 0 }}>Commande {activeOrder.orderNumber}</h3>
                <p style={{ color: '#555', margin: 0 }}>
                  Statut : <strong>{activeOrder.status}</strong>
                  {pendingCount > 0 ? (
                    <span className="badge badge-warning" style={{ marginLeft: '8px' }}>
                      {pendingCount} ligne(s) à scanner
                    </span>
                  ) : (
                    <span className="badge badge-success" style={{ marginLeft: '8px' }}>
                      Stock OK — finalisez
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setActiveOrder(null);
                  setProductCode('');
                  orderInputRef.current?.focus();
                }}
              >
                <FaUndo /> Autre commande
              </button>
            </div>

            <h4 style={{ marginTop: '20px' }}>
              <FaBarcode /> 2 — Scanner les articles (code-barres variante ou SKU)
            </h4>
            <form onSubmit={handleProductScan}>
              <div className="form-group">
                <input
                  ref={productInputRef}
                  type="text"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="Scan produit puis Entrée…"
                  autoComplete="off"
                  style={{
                    fontSize: '1.15rem',
                    padding: '12px',
                    border: '2px solid #6366f1'
                  }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!normalizeScanInput(productCode) || itemScanMutation.isPending}
              >
                {itemScanMutation.isPending ? 'Traitement…' : 'Enregistrer la ligne'}
              </button>
            </form>

            <div style={{ marginTop: '20px' }}>
              <h4>Lignes</h4>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>SKU</th>
                      <th>Qté</th>
                      <th>Stock déduit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrder.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.productName}</td>
                        <td>
                          <code style={{ fontSize: '0.85rem' }}>{it.sku || '—'}</code>
                        </td>
                        <td>{it.quantity}</td>
                        <td>
                          {it.stockDeductedAtPrepare ? (
                            <span className="badge badge-success">
                              <FaCheck /> Oui
                            </span>
                          ) : (
                            <span className="badge badge-secondary">En attente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <button
                type="button"
                className={pendingCount > 0 ? 'btn btn-secondary' : 'btn btn-success'}
                disabled={finalizeMutation.isPending || !activeOrder?._id}
                onClick={() => finalizeMutation.mutate(String(activeOrder._id))}
              >
                {finalizeMutation.isPending
                  ? '…'
                  : pendingCount > 0
                    ? 'Marquer Préparé sans scanner le reste (déduit les lignes restantes)'
                    : 'Marquer Préparé'}
              </button>
              {pendingCount > 0 && (
                <p style={{ color: '#555', marginTop: '8px', fontSize: '0.9rem' }}>
                  Il reste {pendingCount} ligne(s) à scanner — ou utilisez le bouton pour tout déduire et passer en
                  Préparé.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {lastOrder && (
        <div
          className="card"
          style={{
            marginBottom: '20px',
            backgroundColor: '#d4edda',
            border: '2px solid #28a745'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <FaCheck style={{ color: '#28a745', fontSize: '1.75rem' }} />
            <h2 style={{ margin: 0, color: '#155724' }}>Préparé</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <strong>Commande</strong>
              <br />
              {lastOrder.orderNumber}
            </div>
            <div>
              <strong>Statut</strong>
              <br />
              {lastOrder.status}
            </div>
            <div>
              <strong>Client</strong>
              <br />
              {lastOrder.customer?.nom || '—'}
            </div>
            {lastOrder.deliveryBarcode && (
              <div>
                <strong>Code transport</strong>
                <br />
                <span className="badge badge-info">{lastOrder.deliveryBarcode}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3>
          <FaHistory /> Historique des préparations
        </h3>
        <p style={{ color: '#555', marginBottom: '12px' }}>
          Passages en <strong>Préparé</strong> (finalisation depuis cette page ou la liste commandes).
        </p>

        {historyLoading && !historyPayload?.data?.length ? (
          <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Chargement…</p>
        ) : !historyPayload?.data?.length ? (
          <p style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
            Aucune entrée pour l’instant.
          </p>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date / heure</th>
                    <th>Commande</th>
                    <th>Ancien statut</th>
                    <th>Scan / saisie</th>
                    <th>Utilisateur</th>
                  </tr>
                </thead>
                <tbody>
                  {historyPayload.data.map((row) => (
                    <tr key={row._id}>
                      <td>
                        <small>
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                        </small>
                      </td>
                      <td>
                        <strong>{row.orderNumber}</strong>
                      </td>
                      <td>{row.previousStatus || '—'}</td>
                      <td>
                        {row.scannedToken ? (
                          <code style={{ fontSize: '0.85rem' }}>{row.scannedToken}</code>
                        ) : (
                          <span className="text-gray-500">Interface commandes</span>
                        )}
                      </td>
                      <td>{row.userId?.name || row.userId?.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyPayload.pagination && historyPayload.pagination.pages > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'center',
                  marginTop: '16px',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                <span style={{ alignSelf: 'center', color: '#555' }}>
                  Page {historyPayload.pagination.page} / {historyPayload.pagination.pages}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={!historyPayload.pagination.hasMore}
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
