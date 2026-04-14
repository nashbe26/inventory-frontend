import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FaBarcode, FaCheck, FaHistory, FaTruck } from 'react-icons/fa';
import api from '../services/api';

function normalizeScanInput(raw) {
  if (raw == null) return '';
  return String(raw).trim().replace(/§/g, '-');
}

export default function DispatchScan() {
  const [code, setCode] = useState('');
  const [lastOrder, setLastOrder] = useState(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();
  const [historyPage, setHistoryPage] = useState(1);

  const { data: historyPayload, isLoading: historyLoading } = useQuery({
    queryKey: ['dispatch-history', historyPage],
    queryFn: async () => {
      const res = await api.get('/delivery/dispatch-history', {
        params: { page: historyPage, limit: 40 }
      });
      return res.data;
    },
    staleTime: 15_000
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const dispatchMutation = useMutation({
    mutationFn: async (token) => {
      const res = await api.post('/delivery/send-scan', { token });
      return res.data;
    },
    onSuccess: (data) => {
      const order = data?.order;
      if (data?.alreadyRemis) {
        setLastOrder(order);
        toast.info(
          order?.orderNumber
            ? `Commande ${order.orderNumber} — déjà « Remis au transporteur » (code : ${data.deliveryBarcode})`
            : data?.message || 'Déjà remis au transporteur',
          { autoClose: 5000 }
        );
        setCode('');
        inputRef.current?.focus();
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        setTimeout(() => setLastOrder(null), 10000);
        return;
      }
      setLastOrder(order);
      if (data?.deliveryBarcode) {
        toast.success(
          order?.orderNumber
            ? `Commande ${order.orderNumber} — statut : Remis au transporteur (code : ${data.deliveryBarcode})`
            : 'Statut mis à jour — Remis au transporteur',
          { autoClose: 4000 }
        );
      } else {
        toast.warning('Réponse inattendue — vérifiez la commande dans la liste.');
      }
      setCode('');
      inputRef.current?.focus();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-history'] });
      setTimeout(() => setLastOrder(null), 10000);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Échec de la mise à jour (remise transporteur)';
      toast.error(message);
      setCode('');
      inputRef.current?.focus();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const token = normalizeScanInput(code);
    if (token) dispatchMutation.mutate(token);
  };

  return (
    <div>
      <div className="page-header">
        <h1>
          <FaTruck /> Expédition — scan transporteur
        </h1>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Remise au transporteur (scan)</h3>
        <p style={{ color: '#555', marginBottom: '12px' }}>
          La commande doit <strong>déjà</strong> avoir été envoyée à First Delivery (liste ou envoi groupé) et avoir un{' '}
          <strong>code transport</strong>. Ce scan ne rappelle pas l’API First Delivery : il met seulement le statut à{' '}
          <strong>Remis au transporteur</strong>. Identifiants acceptés : numéro de commande, id interne, ou code-barres
          transporteur.
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
                border: '2px solid #2980b9'
              }}
            />
            <small>Accès : administrateurs, managers et employés (équipe expédition).</small>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!normalizeScanInput(code) || dispatchMutation.isPending}
          >
            <FaBarcode /> {dispatchMutation.isPending ? 'Traitement…' : 'Valider remise transporteur'}
          </button>
        </form>
      </div>

      {lastOrder && (
        <div
          className="card"
          style={{
            marginBottom: '20px',
            backgroundColor: '#e8f4fc',
            border: '2px solid #2980b9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <FaCheck style={{ color: '#2980b9', fontSize: '1.75rem' }} />
            <h2 style={{ margin: 0, color: '#1a5276' }}>Remis au transporteur</h2>
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
          <FaHistory /> Historique des expéditions transporteur
        </h3>
        <p style={{ color: '#555', marginBottom: '12px' }}>
          Chaque ligne = passage en <strong>Remis au transporteur</strong> via ce scan (la commande avait déjà un code First
          Delivery). Pas d’appel API transporteur sur cette page.
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
                    <th>Code transport</th>
                    <th>Scan / réf.</th>
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
                        <span className="badge badge-info">{row.deliveryBarcode}</span>
                      </td>
                      <td>
                        {row.scannedToken ? (
                          <code style={{ fontSize: '0.85rem' }}>{row.scannedToken}</code>
                        ) : (
                          <span className="text-gray-500">Liste / groupé</span>
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
