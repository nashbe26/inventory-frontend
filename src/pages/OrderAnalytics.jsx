import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FaShoppingCart,
  FaChartPie,
  FaLayerGroup,
  FaCalendarAlt,
  FaCoins
} from 'react-icons/fa';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
  Line
} from 'recharts';
import api from '../services/api';

const PIE_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EF4444',
  '#06B6D4',
  '#EC4899',
  '#84CC16',
  '#64748B',
  '#F97316'
];

const STACK_KEYS = [
  { key: 'pending', name: 'En attente', color: '#FBBF24' },
  { key: 'confirmed', name: 'Confirmé(e)', color: '#A78BFA' },
  { key: 'prepared', name: 'Préparé', color: '#60A5FA' },
  { key: 'shipping', name: 'Expédition / transport', color: '#2563EB' },
  { key: 'delivered', name: 'Livré(e)', color: '#34D399' },
  { key: 'cancelled', name: 'Annulé(e)', color: '#F87171' },
  { key: 'nrp', name: 'NRP', color: '#9CA3AF' },
  { key: 'other', name: 'Autre', color: '#D1D5DB' }
];

function StatTile({ title, count, amount, accent }) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm bg-white ${accent || 'border-gray-200'}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{count ?? 0}</p>
      <p className="mt-1 text-sm text-gray-600">
        {(amount ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DA
      </p>
    </div>
  );
}

export default function OrderAnalytics() {
  const [periodDays, setPeriodDays] = useState(30);
  const [chartDays, setChartDays] = useState(30);

  const { data: orderStats, isLoading: loadingStats } = useQuery({
    queryKey: ['orders', 'stats'],
    queryFn: () => api.get('/orders/stats').then((r) => r.data.data)
  });

  const { data: statusBreakdown = [], isLoading: loadingBreakdown } = useQuery({
    queryKey: ['orders', 'status-breakdown'],
    queryFn: () => api.get('/orders/analytics/status-breakdown').then((r) => r.data.data)
  });

  const { data: revenueStats } = useQuery({
    queryKey: ['orders', 'revenue-stats'],
    queryFn: () => api.get('/orders/analytics/revenue-stats').then((r) => r.data.data)
  });

  const { data: dailyRevenue = [], isLoading: loadingDailyRev } = useQuery({
    queryKey: ['orders', 'daily-revenue', chartDays],
    queryFn: () =>
      api.get(`/orders/analytics/daily-revenue?days=${chartDays}`).then((r) => r.data.data)
  });

  const { data: dailyStatus = [], isLoading: loadingDailyStatus } = useQuery({
    queryKey: ['orders', 'daily-status', chartDays],
    queryFn: () =>
      api.get(`/orders/analytics/daily-status?days=${chartDays}`).then((r) => r.data.data)
  });

  const { data: topProducts = [], isLoading: loadingTop } = useQuery({
    queryKey: ['orders', 'top-selling', periodDays],
    queryFn: () =>
      api
        .get(`/orders/analytics/top-selling?period=${periodDays}&limit=12`)
        .then((r) => r.data.data)
  });

  const pieData = useMemo(
    () =>
      (statusBreakdown || [])
        .filter((r) => r.count > 0)
        .map((r) => ({
          name: r.status,
          value: r.count,
          amount: r.amount
        })),
    [statusBreakdown]
  );

  const revenueChartData = useMemo(
    () =>
      (dailyRevenue || []).map((d) => ({
        ...d,
        label: d.date
          ? new Date(d.date).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short'
            })
          : ''
      })),
    [dailyRevenue]
  );

  const statusChartData = useMemo(
    () =>
      (dailyStatus || []).map((d) => ({
        ...d,
        label: d.date
          ? new Date(d.date).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short'
            })
          : ''
      })),
    [dailyStatus]
  );

  const loading = loadingStats || loadingBreakdown;

  return (
    <div className="p-6 md:p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FaShoppingCart className="text-blue-600" />
            Analytique des commandes
          </h1>
          <p className="text-gray-500 mt-1">
            Vue globale des volumes, statuts et ventes pour votre organisation
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-200">
            <FaCalendarAlt className="text-gray-400" />
            Graphiques (jours)
            <select
              className="border-0 bg-transparent font-medium text-gray-800 focus:ring-0 cursor-pointer"
              value={chartDays}
              onChange={(e) => setChartDays(Number(e.target.value))}
            >
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-200">
            Top produits (jours)
            <select
              className="border-0 bg-transparent font-medium text-gray-800 focus:ring-0 cursor-pointer"
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
            >
              <option value={7}>7</option>
              <option value={30}>30</option>
              <option value={90}>90</option>
              <option value={365}>365</option>
            </select>
          </label>
        </div>
      </div>

      {/* Revenue snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-start gap-4">
          <div className="p-3 rounded-lg bg-green-50 text-green-600">
            <FaCoins className="text-xl" />
          </div>
          <div>
            <p className="text-sm text-gray-500">CA aujourd&apos;hui</p>
            <p className="text-xl font-bold text-gray-900">
              {(revenueStats?.today?.totalRevenue ?? 0).toLocaleString('fr-FR')} DA
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {revenueStats?.today?.totalOrders ?? 0} commandes (hors annulées)
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-start gap-4">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <FaLayerGroup className="text-xl" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Cette semaine</p>
            <p className="text-xl font-bold text-gray-900">
              {(revenueStats?.thisWeek?.totalRevenue ?? 0).toLocaleString('fr-FR')} DA
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {revenueStats?.thisWeek?.totalOrders ?? 0} commandes
              {revenueStats?.thisWeek?.change != null && (
                <span
                  className={
                    revenueStats.thisWeek.change >= 0 ? ' text-green-600' : ' text-red-600'
                  }
                >
                  {' '}
                  · {revenueStats.thisWeek.change >= 0 ? '+' : ''}
                  {Number(revenueStats.thisWeek.change).toFixed(1)} % vs sem. préc.
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-start gap-4">
          <div className="p-3 rounded-lg bg-violet-50 text-violet-600">
            <FaChartPie className="text-xl" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Ce mois-ci</p>
            <p className="text-xl font-bold text-gray-900">
              {(revenueStats?.thisMonth?.totalRevenue ?? 0).toLocaleString('fr-FR')} DA
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {revenueStats?.thisMonth?.totalOrders ?? 0} commandes
              {revenueStats?.thisMonth?.change != null && (
                <span
                  className={
                    revenueStats.thisMonth.change >= 0 ? ' text-green-600' : ' text-red-600'
                  }
                >
                  {' '}
                  · {revenueStats.thisMonth.change >= 0 ? '+' : ''}
                  {Number(revenueStats.thisMonth.change).toFixed(1)} % vs mois préc.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Grouped stats */}
      <h2 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-blue-500 pl-3">
        Répartition par étape (toutes commandes)
      </h2>
      {loading ? (
        <p className="text-gray-500 mb-8">Chargement des statistiques…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-10">
          <StatTile title="Total" count={orderStats?.total?.count} amount={orderStats?.total?.amount} />
          <StatTile
            title="En attente"
            count={orderStats?.pending?.count}
            amount={orderStats?.pending?.amount}
            accent="border-amber-200 bg-amber-50/30"
          />
          <StatTile
            title="Confirmé"
            count={orderStats?.confirmed?.count}
            amount={orderStats?.confirmed?.amount}
            accent="border-violet-200 bg-violet-50/30"
          />
          <StatTile
            title="En cours"
            count={orderStats?.processing?.count}
            amount={orderStats?.processing?.amount}
            accent="border-blue-200 bg-blue-50/30"
          />
          <StatTile
            title="Livré"
            count={orderStats?.completed?.count}
            amount={orderStats?.completed?.amount}
            accent="border-emerald-200 bg-emerald-50/30"
          />
          <StatTile
            title="Annulé"
            count={orderStats?.cancelled?.count}
            amount={orderStats?.cancelled?.amount}
            accent="border-red-200 bg-red-50/30"
          />
          <StatTile title="NRP" count={orderStats?.nrp?.count} amount={orderStats?.nrp?.amount} />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FaChartPie className="text-blue-500" />
            Commandes par statut exact
          </h2>
          {loadingBreakdown ? (
            <p className="text-gray-500 py-12 text-center">Chargement…</p>
          ) : pieData.length === 0 ? (
            <p className="text-gray-400 py-12 text-center">Aucune commande</p>
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _n, props) => [
                      `${value} cmd · ${(props.payload.amount ?? 0).toLocaleString('fr-FR')} DA`,
                      'Détail'
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Détail par statut (tableau)
          </h2>
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Statut</th>
                  <th className="text-right px-3 py-2">Commandes</th>
                  <th className="text-right px-3 py-2">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statusBreakdown.map((row) => (
                  <tr key={row.status} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{row.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-700">
                      {row.amount.toLocaleString('fr-FR')} DA
                    </td>
                  </tr>
                ))}
                {statusBreakdown.length === 0 && !loadingBreakdown && (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-gray-400">
                      Aucune donnée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            CA et volume de commandes par jour
          </h2>
          {loadingDailyRev ? (
            <p className="text-gray-500 py-12 text-center">Chargement…</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(val, key) =>
                      key === 'revenue'
                        ? [`${Number(val).toLocaleString('fr-FR')} DA`, 'CA']
                        : [val, 'Commandes']
                    }
                  />
                  <Legend />
                  <Bar yAxisId="right" dataKey="orders" name="Commandes" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    name="CA (DA)"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Nouvelles commandes par jour (répartition statut)
          </h2>
          {loadingDailyStatus ? (
            <p className="text-gray-500 py-12 text-center">Chargement…</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {STACK_KEYS.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="st"
                      name={s.name}
                      fill={s.color}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          Top produits ({periodDays} derniers jours)
        </h2>
        {loadingTop ? (
          <p className="text-gray-500 py-8 text-center">Chargement…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">Produit</th>
                  <th className="text-left px-4 py-3">SKU</th>
                  <th className="text-center px-4 py-3">Qté</th>
                  <th className="text-center px-4 py-3">Lignes cmd</th>
                  <th className="text-right px-4 py-3">CA lignes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topProducts.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.productName || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.sku || '—'}</td>
                    <td className="px-4 py-3 text-center">{p.totalQuantity}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.orderCount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">
                      {p.totalRevenue.toLocaleString('fr-FR')} DA
                    </td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">
                      Aucune vente sur cette période
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
