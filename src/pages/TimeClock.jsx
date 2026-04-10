import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaClock, FaSignInAlt, FaSignOutAlt, FaUsers } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function formatDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function durationLabel(clockInAt, clockOutAt) {
  if (!clockInAt || !clockOutAt) return '—';
  const ms = new Date(clockOutAt) - new Date(clockInAt);
  if (ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
}

export default function TimeClock() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const hasOrg = Boolean(user?.organization?._id || user?.organization);

  const { data: statusRes, isLoading: statusLoading } = useQuery({
    queryKey: ['time-clock-status'],
    queryFn: async () => {
      const res = await api.get('/time-clock/status');
      return res.data;
    }
  });

  const { data: myEntriesRes, isLoading: myLoading } = useQuery({
    queryKey: ['time-clock-my-entries'],
    queryFn: async () => {
      const res = await api.get('/time-clock/my-entries?limit=30');
      return res.data;
    }
  });

  const { data: teamRes, isLoading: teamLoading } = useQuery({
    queryKey: ['time-clock-team-entries'],
    queryFn: async () => {
      const res = await api.get('/time-clock/team-entries?limit=50');
      return res.data;
    },
    enabled: Boolean(isManager && hasOrg)
  });

  const clockInMut = useMutation({
    mutationFn: () => api.post('/time-clock/clock-in'),
    onSuccess: () => {
      toast.success('Clocked in');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock-my-entries'] });
      if (isManager) queryClient.invalidateQueries({ queryKey: ['time-clock-team-entries'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Clock in failed');
    }
  });

  const clockOutMut = useMutation({
    mutationFn: () => api.post('/time-clock/clock-out'),
    onSuccess: () => {
      toast.success('Clocked out');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock-my-entries'] });
      if (isManager) queryClient.invalidateQueries({ queryKey: ['time-clock-team-entries'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Clock out failed');
    }
  });

  const clockedIn = statusRes?.data?.clockedIn;
  const activeEntry = statusRes?.data?.activeEntry;
  const myEntries = myEntriesRes?.data || [];
  const teamEntries = teamRes?.data || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <FaClock style={{ marginRight: '10px', verticalAlign: 'middle' }} />
          Time clock
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
          Clock in and out is tied to your logged-in account.
        </p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ gridColumn: '1 / -1', maxWidth: '520px' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Status</h3>
          {statusLoading ? (
            <div className="loading" style={{ marginTop: '12px' }}>
              Loading…
            </div>
          ) : (
            <>
              <div
                className="stat-value"
                style={{
                  color: clockedIn ? 'var(--success-color)' : 'var(--text-secondary)',
                  fontSize: '1.5rem',
                  marginTop: '8px'
                }}
              >
                {clockedIn ? 'Clocked in' : 'Clocked out'}
              </div>
              {clockedIn && activeEntry?.clockInAt && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Since {formatDt(activeEntry.clockInAt)}
                </p>
              )}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={clockedIn || clockInMut.isPending}
                  onClick={() => clockInMut.mutate()}
                >
                  <FaSignInAlt style={{ marginRight: '8px' }} />
                  Clock in
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!clockedIn || clockOutMut.isPending}
                  onClick={() => clockOutMut.mutate()}
                >
                  <FaSignOutAlt style={{ marginRight: '8px' }} />
                  Clock out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="page-header" style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>My recent shifts</h2>
      </div>
      {myLoading ? (
        <div className="loading">Loading history…</div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Clock in</th>
                <th>Clock out</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {myEntries.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No entries yet.
                  </td>
                </tr>
              ) : (
                myEntries.map((row) => (
                  <tr key={row._id}>
                    <td>{formatDt(row.clockInAt)}</td>
                    <td>{row.clockOutAt ? formatDt(row.clockOutAt) : <em>Open</em>}</td>
                    <td>{durationLabel(row.clockInAt, row.clockOutAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {isManager && hasOrg && (
        <>
          <div className="page-header" style={{ marginTop: '40px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              <FaUsers style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Team (organization)
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.875rem' }}>
              Recent clock activity for members in your organization.
            </p>
          </div>
          {teamLoading ? (
            <div className="loading">Loading team…</div>
          ) : (
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Clock in</th>
                    <th>Clock out</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {teamEntries.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No team entries yet.
                      </td>
                    </tr>
                  ) : (
                    teamEntries.map((row) => (
                      <tr key={row._id}>
                        <td>
                          {row.user?.name || '—'}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {row.user?.email}
                          </div>
                        </td>
                        <td>{formatDt(row.clockInAt)}</td>
                        <td>{row.clockOutAt ? formatDt(row.clockOutAt) : <em>Open</em>}</td>
                        <td>{durationLabel(row.clockInAt, row.clockOutAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
