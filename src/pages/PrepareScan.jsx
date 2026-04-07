import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FaBarcode, FaBoxOpen, FaCheck, FaHistory } from 'react-icons/fa';
import api from '../services/api';

function normalizeScanInput(raw) {
  if (raw == null) return '';
  return String(raw).trim().replace(/§/g, '-');
}

export default function PrepareScan() {
  const [code, setCode] = useState('');
  const [lastOrder, setLastOrder] = useState(null);
  const inputRef = useRef(null);
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
    inputRef.current?.focus();
  }, []);

  const prepareMutation = useMutation({
    mutationFn: async (token) => {
      const id = encodeURIComponent(token);
      const res = await api.put(`/orders/${id}`, { status: 'Préparé' });
      return res.data;
    },
    onSuccess: (data) => {
      const order = data?.data;
      setLastOrder(order);
      toast.success(
        order?.orderNumber
          ? `Commande ${order.orderNumber} — statut : Préparé`
          : 'Commande marquée comme Préparé',
        { autoClose: 3500 }
      );
      setCode('');
      inputRef.current?.focus();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['prepare-history'] });
      setTimeout(() => setLastOrder(null), 8000);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Échec de la mise à jour';
      toast.error(message);
      setCode('');
      inputRef.current?.focus();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const token = normalizeScanInput(code);
    if (token) prepareMutation.mutate(token);
  };

  return (
    <div>
      <div className="page-header">
        <h1>
          <FaBoxOpen /> Préparation — scan
        </h1>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Scanner la commande</h3>
        <p style={{ color: '#555', marginBottom: '12px' }}>
          Scannez le <strong>code-barres transporteur</strong> (First Delivery) sur l’étiquette colis, ou saisissez le{' '}
          <strong>numéro de commande</strong>. La commande doit être au statut <strong>Confirmé(e)</strong> pour être
          passée en <strong>Préparé</strong> (fournisseurs).
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Code-barres ou N° commande</label>
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Scan ou saisie puis Entrée…"
              autoComplete="off"
              style={{
                fontSize: '1.2rem',
                padding: '15px',
                border: '2px solid #27ae60'
              }}
            />
            <small>Le champ reprend le focus après chaque scan.</small>
          </div>
          <button
            type="submit"
            className="btn btn-success"
            disabled={!normalizeScanInput(code) || prepareMutation.isPending}
          >
            <FaBarcode /> {prepareMutation.isPending ? 'Traitement…' : 'Marquer Préparé'}
          </button>
        </form>
      </div>

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
          Enregistrement des passages en <strong>Préparé</strong> (page scan, ou modification depuis la liste des
          commandes). Les entrées plus anciennes n’avaient pas encore cet historique.
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
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleString()
                            : '—'}
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
                      <td>
                        {row.userId?.name || row.userId?.email || '—'}
                      </td>
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
