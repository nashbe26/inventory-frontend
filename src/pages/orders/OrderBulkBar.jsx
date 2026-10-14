import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FaClipboardList, FaFileAlt, FaFileDownload, FaPrint, FaSync, FaTruck, FaTruckLoading } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../../services/api';
import Modal from '../../components/Modal';
import { BulkActions, Button } from '../../components/ui/Primitives';
import { ORDER_STATUS } from '../../config/orderStatus';
import { statusOf } from './orderModel';

/**
 * Run `fn` on the subset of the selection an action applies to, saying how
 * many were skipped rather than failing the whole batch.
 */
function onEligible(selected, predicate, { none, verb }, fn) {
  const eligible = selected.filter(predicate);
  if (!eligible.length) return toast.warning(none);
  if (eligible.length < selected.length) {
    toast.info(`${verb} ${eligible.length} of ${selected.length} selected — the rest do not qualify.`);
  }
  fn(eligible);
}

/** Actions for the selected orders: carrier hand-off, documents, manifests. */
export default function OrderBulkBar({ selected, onClear, canOps, isManager, actions }) {
  const [bordereauOpen, setBordereauOpen] = useState(false);
  const [driver, setDriver] = useState('');

  const { data: drivers = [] } = useQuery({
    queryKey: ['deliveryMen'],
    queryFn: async () => (await api.get('/internal-delivery/analytics')).data.map((s) => s.user).filter(Boolean),
    enabled: bordereauOpen && isManager
  });

  const ids = (list) => list.map((o) => o._id);
  const withBarcode = (o) => Boolean(o.deliveryBarcode);
  const withLabel = (o) => Boolean(o.deliveryPdf);

  return (
    <>
      <BulkActions count={selected.length} onClear={onClear}>
        {canOps && (
          <Button size="sm" icon={FaTruck} disabled={actions.sendBulkToCarrier.isPending}
            onClick={() =>
              onEligible(selected, (o) => statusOf(o) === ORDER_STATUS.CONFIRMED && !o.deliveryBarcode,
                { none: 'Only confirmed orders not yet sent can go to First Delivery.', verb: 'Sending' },
                (list) => actions.sendBulkToCarrier.mutate(ids(list)))
            }>
            Send to carrier
          </Button>
        )}
        {canOps && (
          <Button size="sm" icon={FaClipboardList} disabled={actions.printPackingManifest.isPending}
            title="Articles and the First Delivery barcode for each order, for the packing team"
            onClick={() =>
              onEligible(selected, withBarcode,
                { none: 'The packing manifest needs orders already sent to First Delivery.', verb: 'Including' },
                (list) => actions.printPackingManifest.mutate(ids(list)))
            }>
            Packing manifest
          </Button>
        )}
        {canOps && (
          <Button size="sm" icon={FaPrint} disabled={actions.printInvoices.isPending}
            onClick={() => actions.printInvoices.mutate(ids(selected))}>
            Print orders
          </Button>
        )}
        {canOps && (
          <Button size="sm" icon={FaPrint} disabled={actions.openCarrierLabels.isPending}
            title="Open each carrier label and mark the orders Imprimé"
            onClick={() =>
              onEligible(selected, withLabel,
                { none: 'None of the selected orders has a carrier label yet.', verb: 'Opening' },
                (list) => actions.openCarrierLabels.mutate(list))
            }>
            Open labels
          </Button>
        )}
        {canOps && (
          <Button size="sm" icon={FaFileDownload} disabled={actions.downloadCarrierLabels.isPending}
            onClick={() =>
              onEligible(selected, withLabel,
                { none: 'None of the selected orders has a carrier label yet.', verb: 'Downloading' },
                (list) => actions.downloadCarrierLabels.mutate(ids(list)))
            }>
            {actions.downloadCarrierLabels.isPending ? 'Building PDF…' : 'Labels PDF'}
          </Button>
        )}
        {isManager && (
          <Button size="sm" icon={FaFileAlt} onClick={() => setBordereauOpen(true)}>
            Bordereau
          </Button>
        )}
        {canOps && (
          <Button size="sm" icon={FaTruckLoading} disabled={actions.requestPickup.isPending}
            onClick={() =>
              onEligible(selected, withBarcode,
                { none: 'A pickup needs orders already sent to First Delivery.', verb: 'Requesting pickup for' },
                (list) => actions.requestPickup.mutate(ids(list)))
            }>
            Request pickup
          </Button>
        )}
        {canOps && (
          <Button size="sm" icon={FaSync} disabled={actions.syncCarrierStatuses.isPending}
            onClick={() =>
              onEligible(selected, withBarcode,
                { none: 'None of the selected orders is with First Delivery.', verb: 'Syncing' },
                (list) => actions.syncCarrierStatuses.mutate(ids(list)))
            }>
            {actions.syncCarrierStatuses.isPending ? 'Syncing…' : 'Sync statuses'}
          </Button>
        )}
      </BulkActions>

      <Modal isOpen={bordereauOpen} onClose={() => setBordereauOpen(false)} title="New bordereau">
        <div className="space-y-4">
          <p className="text-sm text-content-secondary">
            A delivery manifest for {selected.length} order(s). Name a driver now, or leave it unassigned and let
            the driver claim it by scanning the QR on the printed sheet.
          </p>
          <select className="form-control" value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="">Unassigned — claim by scan</option>
            {drivers.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setBordereauOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={actions.createBordereau.isPending}
              onClick={() =>
                actions.createBordereau.mutate(
                  { orderIds: ids(selected), deliveryManId: driver },
                  { onSuccess: () => { setBordereauOpen(false); setDriver(''); } }
                )
              }
            >
              {actions.createBordereau.isPending ? 'Generating…' : 'Generate PDF'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
