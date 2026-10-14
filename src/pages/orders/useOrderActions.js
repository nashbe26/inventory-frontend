import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import api, { syncShopifyOrdersAllBatches } from '../../services/api';
import { downloadFile } from '../../services';

/** Hand a PDF blob to the browser as a download. */
function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

/** A blob request's error body arrives as a Blob too; read the message out of it. */
async function messageOf(error, fallback) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || error?.message || fallback;
}

/**
 * Every server action the order screen can take, in one place.
 *
 * Each mutation refreshes what it can have changed: the order list and tab
 * counts always, and the SKU catalogue when stock may have moved (a status
 * change can pick or restock; deleting restocks).
 */
export function useOrderActions({ onSelectionDone } = {}) {
  const qc = useQueryClient();

  const refresh = ({ stock = false } = {}) => {
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['orderStats'] });
    // A status change moves orders in or out of « Confirmé » / « Prêt à préparer ».
    qc.invalidateQueries({ queryKey: ['orderStockCheck'] });
    if (stock) qc.invalidateQueries({ queryKey: ['skuCatalog'] });
  };

  const fail = (fallback) => async (error) => toast.error(await messageOf(error, fallback));

  /** A stock shortage is the form's to present (it asks to save anyway), not a toast. */
  const failUnlessShortage = (fallback) => async (error) => {
    if (error?.response?.data?.code === 'STOCK_SHORTAGE') return;
    toast.error(await messageOf(error, fallback));
  };

  const done = () => onSelectionDone?.();

  const create = useMutation({
    mutationFn: async (payload) => (await api.post('/orders', payload)).data,
    onSuccess: (res) => {
      refresh();
      toast.success(`Order ${res.data.orderNumber} created`);
    },
    onError: failUnlessShortage('Could not create the order')
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }) => (await api.patch(`/orders/${id}`, payload)).data,
    onSuccess: (res) => {
      refresh();
      toast.success(`Order ${res.data.orderNumber} updated`);
    },
    onError: failUnlessShortage('Could not update the order')
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }) => (await api.put(`/orders/${id}`, { status })).data,
    onSuccess: (res) => {
      refresh({ stock: true });
      toast.success(`${res.data.orderNumber} → ${res.data.status}`);
    },
    onError: fail('Could not change the status')
  });

  const remove = useMutation({
    mutationFn: async (id) => (await api.delete(`/orders/${id}`)).data,
    onSuccess: () => {
      refresh({ stock: true });
      toast.success('Order deleted');
    },
    onError: fail('Could not delete the order')
  });

  /* ------------------------------------------------- First Delivery (carrier) */

  const sendToCarrier = useMutation({
    mutationFn: async (id) => (await api.post(`/delivery/send/${id}`)).data,
    onSuccess: () => {
      refresh();
      toast.success('Sent to First Delivery — now « Prêt à préparer »');
    },
    onError: fail('Could not send the order to First Delivery')
  });

  const sendBulkToCarrier = useMutation({
    mutationFn: async (ids) => (await api.post('/delivery/bulk-send', { orderIds: ids })).data,
    onSuccess: (data) => {
      refresh();
      const saved = data.savedWithBarcode ?? data.count ?? 0;
      const total = data.count ?? 0;
      if (data.saveErrors?.length) {
        toast.warning(`First Delivery: ${saved}/${total} received a barcode. Check the server log for the rest.`);
      } else {
        toast.success(`${saved} order(s) sent to First Delivery`);
      }
      done();
    },
    onError: fail('Bulk send failed')
  });

  const syncCarrierStatus = useMutation({
    mutationFn: async (id) => (await api.put(`/delivery/sync/${id}`)).data,
    onSuccess: (data) => {
      refresh({ stock: true });
      toast.info(`Carrier status: ${data.data?.status || 'updated'}`);
    },
    onError: fail('Could not sync the carrier status')
  });

  const syncCarrierStatuses = useMutation({
    /** No ids: every order at the carrier. */
    mutationFn: async (ids) =>
      (await api.put('/delivery/sync-all-statuses', { intervalMs: 1000, ...(ids ? { orderIds: ids } : {}) })).data,
    onSuccess: (data) => {
      refresh({ stock: true });
      const s = data?.stats || {};
      toast.success(`Carrier sync: ${s.statusUpdated || 0} updated, ${s.errors || 0} error(s)`);
      done();
    },
    onError: fail('Carrier sync failed')
  });

  const cancelCarrier = useMutation({
    mutationFn: async (id) => (await api.post(`/delivery/cancel/${id}`)).data,
    onSuccess: () => {
      refresh();
      toast.success('Delivery cancelled at First Delivery');
    },
    onError: fail('Could not cancel the delivery')
  });

  const requestPickup = useMutation({
    mutationFn: async (ids) => (await api.post('/delivery/pickup', { orderIds: ids })).data,
    onSuccess: () => {
      toast.success('Pickup requested');
      done();
    },
    onError: fail('Could not request a pickup')
  });

  /* ------------------------------------------------------- documents / PDFs */

  const openCarrierLabels = useMutation({
    /** Opens each stored label, then marks those orders Imprimé. */
    mutationFn: async (orders) => {
      orders.forEach((o) => window.open(o.deliveryPdf, '_blank'));
      await api.post('/delivery/bulk-mark-printed', { orderIds: orders.map((o) => o._id) });
      return orders.length;
    },
    onSuccess: (n) => {
      refresh();
      toast.success(`Opened ${n} label(s) and marked them Imprimé`);
      done();
    },
    onError: fail('Could not open the labels')
  });

  const downloadCarrierLabels = useMutation({
    mutationFn: async (ids) =>
      (await api.post('/delivery/bulk-convert-pdf', { orderIds: ids }, { responseType: 'blob' })).data,
    onSuccess: (blob) => {
      refresh();
      saveBlob(blob, `delivery-labels-${Date.now()}.pdf`);
      done();
    },
    onError: fail('Could not build the labels PDF')
  });

  const printInvoices = useMutation({
    mutationFn: async (ids) =>
      (await api.post('/orders/print', { orderIds: ids }, { responseType: 'blob' })).data,
    onSuccess: (blob) => saveBlob(blob, `orders-${Date.now()}.pdf`),
    onError: fail('Could not print the orders')
  });

  const printPackingManifest = useMutation({
    mutationFn: async (ids) =>
      (await api.post('/orders/packaging-manifest', { orderIds: ids }, { responseType: 'blob' })).data,
    onSuccess: (blob) => {
      saveBlob(blob, `manifest-preparation-${Date.now()}.pdf`);
      toast.success('Packing manifest ready');
    },
    onError: fail('Could not build the packing manifest')
  });

  const createBordereau = useMutation({
    mutationFn: async ({ orderIds, deliveryManId }) =>
      (await api.post('/bordereaux', { orderIds, deliveryManId: deliveryManId || null })).data,
    onSuccess: (res) => {
      refresh();
      toast.success(`Bordereau ${res.data.code} created`);
      // Fetched with the auth header, never ?token= in the URL (AUDIT H-3).
      downloadFile(`/bordereaux/${res.data._id}/pdf`, `bordereau-${res.data.code}.pdf`).catch(() =>
        toast.error('Bordereau created, but its PDF could not be downloaded')
      );
      done();
    },
    onError: fail('Could not create the bordereau')
  });

  /* ---------------------------------------------------------------- Shopify */

  const syncShopify = useMutation({
    mutationFn: () => syncShopifyOrdersAllBatches({ batchSize: 200 }),
    onSuccess: (r) => {
      refresh();
      toast.success(
        `Shopify: ${r.totalUpdated} updated${r.totalFailed ? `, ${r.totalFailed} failed` : ''} (${r.totalMatching} linked)`
      );
    },
    onError: fail('Shopify sync failed')
  });

  return {
    create,
    update,
    setStatus,
    remove,
    sendToCarrier,
    sendBulkToCarrier,
    syncCarrierStatus,
    syncCarrierStatuses,
    cancelCarrier,
    requestPickup,
    openCarrierLabels,
    downloadCarrierLabels,
    printInvoices,
    printPackingManifest,
    createBordereau,
    syncShopify
  };
}
