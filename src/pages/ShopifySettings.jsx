import React, { useState, useEffect } from 'react';
import api, { syncShopifyOrdersAllBatches } from '../services/api';
import { toast } from 'react-toastify';
import {
  FaShopify, FaSave, FaFlask, FaCopy, FaToggleOn, FaToggleOff,
  FaInfoCircle, FaCheckCircle, FaExclamationTriangle, FaDownload,
  FaBoxes, FaCheck, FaSyncAlt, FaTimesCircle, FaKey
} from 'react-icons/fa';

const ShopifySettings = () => {
  const [settings, setSettings] = useState({
    shopDomain: '',
    webhookSecret: '',
    enabled: false,
    webhookUrl: '',
    oauthCallbackUrl: '',
    oauthPublicOrigin: '',
    hasSecret: false,
    hasAccessToken: false,
    clientId: '',
    hasOAuthCredentials: false,
    hasClientSecret: false,
    requiredAdminApiScopes: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [oauthSecretInput, setOauthSecretInput] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showOauthSecret, setShowOauthSecret] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [resyncing, setResyncing] = useState(false);
  const [resyncResults, setResyncResults] = useState(null);
  const [resyncSkip, setResyncSkip] = useState(0);
  const [resyncLimit, setResyncLimit] = useState(100);
  const [resyncUpdateCustomer, setResyncUpdateCustomer] = useState(false);
  const [fullSyncing, setFullSyncing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [rayons, setRayons] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRayon, setSelectedRayon] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('shopify_oauth');
    if (oauth) {
      if (oauth === 'success') {
        toast.success('Shopify connected! Access token saved.');
      } else {
        toast.error(decodeURIComponent(params.get('message') || 'OAuth failed'));
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
    fetchSettings();
    fetchCategoriesAndRayons();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/webhooks/shopify/settings');
      setSettings(data.data);
      setSecretInput('');
      setTokenInput('');
    } catch (error) {
      if (error.response?.status !== 403) {
        toast.error('Failed to load Shopify settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesAndRayons = async () => {
    try {
      const [catRes, rayRes] = await Promise.all([
        api.get('/categories'),
        api.get('/rayons')
      ]);
      setCategories(catRes.data.data || catRes.data || []);
      setRayons(rayRes.data.data || rayRes.data || []);
    } catch {
      // non-critical
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        shopDomain: settings.shopDomain,
        enabled: settings.enabled,
        clientId: settings.clientId || undefined
      };
      if (secretInput) payload.webhookSecret = secretInput;
      if (tokenInput) payload.accessToken = tokenInput;
      if (oauthSecretInput) payload.clientSecret = oauthSecretInput;

      const { data } = await api.put('/webhooks/shopify/settings', payload);
      setSettings(data.data);
      setSecretInput('');
      setTokenInput('');
      setOauthSecretInput('');
      setShowSecret(false);
      setShowToken(false);
      setShowOauthSecret(false);
      toast.success('Shopify settings saved successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data } = await api.post('/webhooks/shopify/test');
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResults(null);
    try {
      const payload = {};
      if (selectedCategory) payload.categoryId = selectedCategory;
      if (selectedRayon) payload.rayonId = selectedRayon;

      const { data } = await api.post('/webhooks/shopify/import-products', payload);
      setImportResults(data.data);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleResyncOrders = async () => {
    setResyncing(true);
    setResyncResults(null);
    try {
      const skip = Math.max(0, parseInt(String(resyncSkip), 10) || 0);
      const limit = Math.min(500, Math.max(1, parseInt(String(resyncLimit), 10) || 100));
      const { data } = await api.post('/webhooks/shopify/resync-orders', {
        skip,
        limit,
        updateCustomer: resyncUpdateCustomer
      });
      setResyncResults(data.data);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Resync failed');
    } finally {
      setResyncing(false);
    }
  };

  /** Import products from Shopify, then resync every linked order in batches. */
  const handleSyncAllData = async () => {
    if (!settings.hasAccessToken) {
      toast.error('Save your Shopify Admin API token first, then try again.');
      return;
    }
    setFullSyncing(true);
    setImportResults(null);
    setResyncResults(null);
    try {
      const importPayload = {};
      if (selectedCategory) importPayload.categoryId = selectedCategory;
      if (selectedRayon) importPayload.rayonId = selectedRayon;

      toast.info('Step 1/2: Importing products from Shopify…');
      const importRes = await api.post('/webhooks/shopify/import-products', importPayload);
      setImportResults(importRes.data.data);
      toast.success(importRes.data.message || 'Products imported');

      toast.info('Step 2/2: Resyncing all Shopify orders…');
      const agg = await syncShopifyOrdersAllBatches({
        updateCustomer: resyncUpdateCustomer,
        batchSize: 200,
        onBatch: (r) => setResyncResults({ ...r })
      });
      setResyncResults({
        totalMatching: agg.totalMatching,
        skip: agg.totalMatching,
        limit: 200,
        processed:
          agg.totalUpdated + agg.totalFailed + agg.totalSkipped,
        updated: agg.totalUpdated,
        failed: agg.totalFailed,
        skipped: agg.totalSkipped,
        errors: agg.errors.slice(0, 80)
      });
      const ir = importRes.data?.data || {};
      toast.success(
        `Sync complete: ${agg.totalUpdated} order(s) updated · ${ir.created ?? 0} products created · ${ir.updated ?? 0} products refreshed in catalog`
      );
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Sync failed');
    } finally {
      setFullSyncing(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(settings.webhookUrl);
    toast.info('Webhook URL copied to clipboard');
  };

  const copyOAuthCallbackUrl = () => {
    if (settings.oauthCallbackUrl) {
      navigator.clipboard.writeText(settings.oauthCallbackUrl);
      toast.info('OAuth callback URL copied — add it in your Shopify app settings');
    }
  };

  const handleOAuthConnect = async () => {
    setOauthConnecting(true);
    try {
      const { data } = await api.get('/webhooks/shopify/oauth/install-url', {
        params: { shop: settings.shopDomain || undefined }
      });
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error('No install URL returned');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not start OAuth');
    } finally {
      setOauthConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-green-100 rounded-xl">
          <FaShopify className="text-3xl text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopify Integration</h1>
          <p className="text-gray-500">Connect your Shopify store to sync orders and products</p>
        </div>
      </div>

      {/* One-click sync: products + all orders */}
      <div className="rounded-xl border-2 border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sync data from Shopify</h2>
            <p className="mt-1 text-sm text-gray-600">
              Imports / updates products (using category & rayon below), then refreshes <strong>all</strong> Shopify-linked orders so line items match your catalog. This can take a minute on large stores.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSyncAllData}
            disabled={fullSyncing || importing || resyncing || !settings.hasAccessToken}
            className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {fullSyncing ? (
              <>
                <FaSyncAlt className="animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <FaSyncAlt className="text-lg" />
                Sync data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${settings.enabled ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        {settings.enabled ? (
          <>
            <FaCheckCircle className="text-green-500 text-xl flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Integration Active</p>
              <p className="text-sm text-green-600">Shopify orders will be automatically imported into your dashboard</p>
            </div>
          </>
        ) : (
          <>
            <FaExclamationTriangle className="text-yellow-500 text-xl flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-800">Integration Disabled</p>
              <p className="text-sm text-yellow-600">Enable the integration and configure your webhook to start receiving orders</p>
            </div>
          </>
        )}
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Enable Shopify Webhook</h3>
            <p className="text-sm text-gray-500 mt-1">Toggle to activate or deactivate the Shopify integration</p>
          </div>
          <button
            onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
            className="text-3xl focus:outline-none"
          >
            {settings.enabled ? (
              <FaToggleOn className="text-green-500" />
            ) : (
              <FaToggleOff className="text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-900 text-lg">Configuration</h3>

        {/* Shop Domain */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shopify Shop Domain</label>
          <input
            type="text"
            value={settings.shopDomain}
            onChange={(e) => setSettings(prev => ({ ...prev, shopDomain: e.target.value }))}
            placeholder="your-store.myshopify.com"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
          />
          <p className="text-xs text-gray-400 mt-1">Your Shopify store URL (e.g. my-store.myshopify.com)</p>
        </div>

        {/* OAuth — Client ID & Secret */}
        <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/50 space-y-4">
          <div className="flex items-center gap-2">
            <FaKey className="text-indigo-600" />
            <h4 className="font-semibold text-gray-900">Connect with Shopify (OAuth)</h4>
          </div>
          <p className="text-sm text-gray-600">
            Create a <strong>custom app</strong> in Shopify Admin → Settings → Apps → Develop apps. Copy the <strong>Client ID</strong> and <strong>Client secret</strong> from API credentials.
            Add the callback URL below under <strong>Allowed redirection URL(s)</strong>, then save these fields and click <strong>Connect with Shopify</strong>.
          </p>

          {settings.oauthPublicOrigin && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <strong>Fix “matching hosts” error:</strong> In your Shopify app, set <strong>App URL</strong> (Application URL) to exactly{' '}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">{settings.oauthPublicOrigin}</code>
              {' '}(same domain as the callback URL — no <code className="text-xs">localhost</code> if the callback uses production).
              Use <code className="text-xs">www</code> consistently everywhere if your site uses it.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              type="text"
              value={settings.clientId || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, clientId: e.target.value }))}
              placeholder="From Shopify app — API key / Client ID"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client secret</label>
            {settings.hasClientSecret && !showOauthSecret ? (
              <div className="flex items-center gap-2">
                <input type="text" value="••••••••••••••••" disabled className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
                <button type="button" onClick={() => setShowOauthSecret(true)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">Change</button>
              </div>
            ) : (
              <input
                type="password"
                value={oauthSecretInput}
                onChange={(e) => setOauthSecretInput(e.target.value)}
                placeholder="Client secret from Shopify app"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            )}
          </div>

          {settings.oauthCallbackUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OAuth callback URL (paste in Shopify app)</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs break-all">{settings.oauthCallbackUrl}</code>
                <button type="button" onClick={copyOAuthCallbackUrl} className="p-2.5 bg-gray-100 rounded-lg hover:bg-gray-200" title="Copy">
                  <FaCopy />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOAuthConnect}
              disabled={oauthConnecting || !settings.hasOAuthCredentials || !settings.shopDomain?.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {oauthConnecting ? <FaSyncAlt className="animate-spin" /> : <FaKey />}
              {oauthConnecting ? 'Redirecting…' : 'Connect with Shopify'}
            </button>
            <p className="text-xs text-gray-500 self-center">
              Save Client ID & secret first, then connect. Shop domain must be <code className="bg-gray-100 px-1 rounded">*.myshopify.com</code>
            </p>
          </div>
        </div>

        {/* Webhook Secret */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret (HMAC)</label>
          {settings.hasSecret && !showSecret ? (
            <div className="flex items-center gap-2">
              <input type="text" value="••••••••••••••••" disabled className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
              <button onClick={() => setShowSecret(true)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">Change</button>
            </div>
          ) : (
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Paste your Shopify webhook signing secret"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
            />
          )}
          <p className="text-xs text-gray-400 mt-1">Found in Shopify Admin &gt; Settings &gt; Notifications &gt; Webhooks</p>
        </div>

        {/* Access Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Admin API Access Token</label>
          {settings.hasAccessToken && !showToken ? (
            <div className="flex items-center gap-2">
              <input type="text" value="••••••••••••••••" disabled className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
              <button onClick={() => setShowToken(true)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">Change</button>
            </div>
          ) : (
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste your Shopify Admin API access token"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
            />
          )}
          <p className="text-xs text-gray-400 mt-1">Optional if you use OAuth above. Otherwise paste the Admin API token from Develop apps → API credentials.</p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
        >
          <FaSave />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Import Products */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <FaDownload className="text-purple-500" />
          <h3 className="font-semibold text-gray-900 text-lg">Import Products from Shopify</h3>
        </div>
        <p className="text-sm text-gray-500">
          Fetch all products from your Shopify store and import them with their SKUs, prices, and variants.
          Existing products (matched by Shopify ID or SKU) will be updated.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            >
              <option value="">Auto-create "Shopify Import"</option>
              {categories.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Rayon</label>
            <select
              value={selectedRayon}
              onChange={(e) => setSelectedRayon(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            >
              <option value="">Auto-create "Shopify"</option>
              {rayons.map(r => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleImport}
          disabled={importing || !settings.hasAccessToken}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
        >
          {importing ? (
            <>
              <FaSyncAlt className="animate-spin" />
              Importing products...
            </>
          ) : (
            <>
              <FaDownload />
              Import All Products
            </>
          )}
        </button>

        {!settings.hasAccessToken && (
          <p className="text-xs text-orange-600">
            <strong>Step 1:</strong> Paste your Shopify Admin API token (starts with <code className="bg-orange-100 px-1 rounded">shpat_</code>) in the field above.
            <br />
            <strong>Step 2:</strong> Click <strong>Save Settings</strong> — then this button will unlock. (The token is only stored after you save.)
          </p>
        )}

        {/* Import Results */}
        {importResults && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
            <h4 className="font-semibold text-gray-800">Import Results</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-lg border text-center">
                <FaBoxes className="text-gray-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-800">{importResults.total}</p>
                <p className="text-xs text-gray-500">Total Found</p>
              </div>
              <div className="bg-white p-3 rounded-lg border text-center">
                <FaCheck className="text-green-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-600">{importResults.created}</p>
                <p className="text-xs text-gray-500">Created</p>
              </div>
              <div className="bg-white p-3 rounded-lg border text-center">
                <FaSyncAlt className="text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-600">{importResults.updated}</p>
                <p className="text-xs text-gray-500">Updated</p>
              </div>
              <div className="bg-white p-3 rounded-lg border text-center">
                <FaTimesCircle className="text-red-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-500">{importResults.errors?.length || 0}</p>
                <p className="text-xs text-gray-500">Errors</p>
              </div>
            </div>

            {importResults.errors?.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-red-700 mb-1">Errors:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResults.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded">
                      <strong>{err.title}</strong>: {err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resync orders — fix line items on orders imported before ID fix */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <FaSyncAlt className="text-teal-600" />
          <h3 className="font-semibold text-gray-900 text-lg">Resync Shopify orders</h3>
        </div>
        <p className="text-sm text-gray-500">
          Fetches each order again from Shopify (Admin API) and rebuilds <strong>line items</strong>, totals, and payment status using your current catalog (same logic as new webhooks).
          Use this after <strong>Import All Products</strong> so variant/product IDs are correct. Oldest orders are processed first.
          If you have many orders, run multiple times with <strong>Skip</strong> set to the previous batch size (e.g. 0, then 100, then 200).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skip (offset)</label>
            <input
              type="number"
              min={0}
              value={resyncSkip}
              onChange={(e) => setResyncSkip(e.target.value === '' ? 0 : Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limit (max 500)</label>
            <input
              type="number"
              min={1}
              max={500}
              value={resyncLimit}
              onChange={(e) => setResyncLimit(e.target.value === '' ? 100 : Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={resyncUpdateCustomer}
                onChange={(e) => setResyncUpdateCustomer(e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Also refresh customer from Shopify
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResyncOrders}
          disabled={resyncing || !settings.hasAccessToken}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
        >
          {resyncing ? (
            <>
              <FaSyncAlt className="animate-spin" />
              Resyncing orders…
            </>
          ) : (
            <>
              <FaSyncAlt />
              Resync orders (batch)
            </>
          )}
        </button>

        {resyncResults && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-sm">
            <h4 className="font-semibold text-gray-800">Resync results</h4>
            <p className="text-gray-600">
              Shopify-linked orders in DB: <strong>{resyncResults.totalMatching}</strong>
              {' · '}Updated: <strong className="text-teal-700">{resyncResults.updated}</strong>
              {' · '}Failed: <strong className="text-red-600">{resyncResults.failed}</strong>
              {' · '}Skipped (no lines): <strong>{resyncResults.skipped}</strong>
            </p>
            <p className="text-xs text-gray-500">
              Batch: skip {resyncResults.skip}, limit {resyncResults.limit}, processed {resyncResults.processed}
            </p>
            {resyncResults.errors?.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1 mt-2">
                {resyncResults.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
                    <strong>{err.orderNumber || '—'}</strong>: {err.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Webhook URL */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-lg">Webhook URL</h3>
        <p className="text-sm text-gray-500">Copy this URL and add it as a webhook in your Shopify Admin panel.</p>

        <div className="flex items-center gap-2">
          <code className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 break-all font-mono">
            {settings.webhookUrl || 'Save settings first to generate the webhook URL'}
          </code>
          {settings.webhookUrl && (
            <button
              onClick={copyWebhookUrl}
              className="flex-shrink-0 p-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
              title="Copy URL"
            >
              <FaCopy />
            </button>
          )}
        </div>

        {/* Test Button */}
        <button
          onClick={handleTest}
          disabled={testing || !settings.enabled}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          <FaFlask />
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {/* Setup Instructions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FaInfoCircle className="text-blue-500" />
          <h3 className="font-semibold text-gray-900 text-lg">Setup Instructions</h3>
        </div>

        <ol className="space-y-3 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">1</span>
            <span>Go to your <strong>Shopify Admin</strong> &gt; <strong>Settings</strong> &gt; <strong>Notifications</strong> &gt; <strong>Webhooks</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">2</span>
            <span>Click <strong>"Create webhook"</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">3</span>
            <span>Set the <strong>Event</strong> to <strong>"Order creation"</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">4</span>
            <span>Set <strong>Format</strong> to <strong>JSON</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">5</span>
            <span>Paste the <strong>Webhook URL</strong> from above</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">6</span>
            <span>Copy the <strong>Signing Secret</strong> from Shopify and paste it above as the <strong>Webhook Secret</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">7</span>
            <span>Enable the integration and click <strong>Save Settings</strong></span>
          </li>
        </ol>

        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>Admin API token scopes:</strong> Open your custom app → <strong>Configuration</strong> →{' '}
            <strong>Admin API integration</strong> → <strong>Admin API access scopes</strong> and enable at least:{' '}
            <code className="rounded bg-purple-100 px-1">read_products</code>,{' '}
            <code className="rounded bg-purple-100 px-1">read_inventory</code>, and{' '}
            <code className="rounded bg-purple-100 px-1">read_orders</code>{' '}
            (<strong>read_orders</strong> is required for <strong>Sync data</strong>, order resync, and pulling orders from Shopify; without it Shopify returns “merchant approval for read_orders”).
            Then <strong>Save</strong>, click <strong>Install app</strong>, approve the permissions, and copy the new <strong>Admin API access token</strong> here (or use <strong>Connect with Shopify</strong>, which requests the same scopes).
          </p>
          {settings.requiredAdminApiScopes && (
            <p className="mt-2 text-xs text-purple-700 font-mono break-all">
              OAuth scope string: {settings.requiredAdminApiScopes}
            </p>
          )}
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-950">
            <strong>Already connected but see a read_orders error?</strong> Your token was probably created before{' '}
            <code className="bg-amber-100 px-1 rounded">read_orders</code> was enabled. Add the scope in Shopify,
            reinstall the app, then paste the <strong>new</strong> token and <strong>Save Settings</strong> (or run <strong>Connect with Shopify</strong> again).
          </p>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Product matching:</strong> Orders are linked using <strong>Shopify variant ID</strong> and <strong>product ID</strong> (saved when you use <strong>Import All Products</strong>), then <strong>SKU</strong> (normalized), then <strong>title</strong> (including titles like &quot;Product — Color / Size&quot;). Run import again after changing Shopify so IDs stay in sync.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShopifySettings;
