import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FaCheck, FaCut, FaSearch } from 'react-icons/fa';
import { tailoringService } from '../services';
import { Badge, Button, DataTable, EmptyState, PageHeader, Tabs } from '../components/ui/Primitives';
import { ORDER_STATUS } from '../config/orderStatus';
import { statusOf, statusTone } from './orders/orderModel';

const EMPTY = {
  to_cut: {
    title: 'Nothing to cut',
    description: 'When a new Shopify order wants more than the stock can cover, the missing articles appear here.'
  },
  cut: { title: 'Nothing being sewn', description: 'Articles you mark as cut wait here until they are tailored.' },
  tailored: { title: 'Nothing tailored yet', description: 'Finished articles are listed here once they are added to stock.' },
  cancelled: { title: 'Nothing cancelled', description: 'Articles no longer needed are listed here.' }
};

/** Why an open job may no longer be worth finishing. Null while its order still wants it. */
function orderWarning(job) {
  if (!job.order) return 'Order deleted';
  const status = statusOf(job.order);
  return status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.RETURNED ? `Order ${status}` : null;
}

const article = (job) => [job.colorName, job.sizeLabel].filter(Boolean).join(' / ');

export default function Tailoring() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('to_cut');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['tailoring', status, page],
    queryFn: async () => (await tailoringService.list({ status, page, limit: 50 })).data
  });

  const jobs = data?.data || [];
  const counts = data?.counts;
  const isOpen = status === 'to_cut' || status === 'cut';

  const mutationFor = (request, success) => ({
    mutationFn: request,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tailoring'] });
      toast.success(success(res.data.data));
    },
    onError: (e) => {
      // The job may have moved under us, so show its real state.
      queryClient.invalidateQueries({ queryKey: ['tailoring'] });
      toast.error(e.response?.data?.message || 'Could not update this job');
    }
  });

  const cut = useMutation(mutationFor((job) => tailoringService.cut(job._id), (j) => `${j.skuCode} marked cut`));
  const tailored = useMutation(
    mutationFor((job) => tailoringService.tailored(job._id), (j) => `${j.quantity} × ${j.skuCode} added to stock`)
  );
  const cancel = useMutation(mutationFor((job) => tailoringService.cancel(job._id), (j) => `${j.skuCode} cancelled`));

  const checkOrders = useMutation({
    mutationFn: () => tailoringService.checkOpenOrders(),
    onSuccess: (res) => {
      const { checked, listed, failed } = res.data.data;
      queryClient.invalidateQueries({ queryKey: ['tailoring'] });
      const summary = `${checked} open order(s) checked, ${listed} article(s) added to the list`;
      if (failed) toast.warning(`${summary}, ${failed} failed`);
      else toast.success(summary);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not check open orders')
  });

  const busy = cut.isPending || tailored.isPending || cancel.isPending;

  const tab = (value, label) => ({ value, label, count: counts?.[value] });

  const columns = [
    { key: 'order', header: 'Order', mono: true, render: (j) => j.orderNumber || '—' },
    {
      key: 'article',
      header: 'Article',
      render: (j) => (
        <div>
          <div className="font-medium">{j.productName}</div>
          <div className="text-sm text-content-secondary">{article(j)}</div>
          <div className="font-mono text-xs text-content-muted">{j.skuCode}</div>
        </div>
      )
    },
    { key: 'qty', header: 'To make', align: 'right', render: (j) => <span className="font-medium">{j.quantity}</span> },
    { key: 'stock', header: 'In stock now', align: 'right', render: (j) => j.skuId?.quantityOnHand ?? '—' },
    {
      key: 'orderStatus',
      header: 'Order status',
      render: (j) => {
        const warning = isOpen ? orderWarning(j) : null;
        if (warning) return <Badge tone="danger">{warning}</Badge>;
        return j.order ? <Badge tone={statusTone(j.order.status)}>{statusOf(j.order)}</Badge> : '—';
      }
    }
  ];

  if (status === 'cancelled') {
    columns.push({
      key: 'reason',
      header: 'Reason',
      render: (j) => <span className="text-content-secondary">{j.cancelReason || '—'}</span>
    });
  }

  if (isOpen) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: (j) => (
        <div className="flex flex-wrap justify-end gap-2">
          {status === 'to_cut' ? (
            <Button size="sm" icon={FaCut} disabled={busy} onClick={() => cut.mutate(j)}>Mark cut</Button>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            icon={FaCheck}
            disabled={busy}
            onClick={() => window.confirm(`Mark as tailored and add ${j.quantity} × ${j.skuCode} to stock?`) && tailored.mutate(j)}
          >
            Mark tailored
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => window.confirm(`Cancel ${j.quantity} × ${j.skuCode}? No stock is added.`) && cancel.mutate(j)}
          >
            Cancel
          </Button>
        </div>
      )
    });
  }

  return (
    <div>
      <PageHeader
        title="Tailoring"
        description="Articles to make because a new Shopify order wanted more than the stock could cover. Marking one tailored adds it to stock."
      >
        <Button
          icon={FaSearch}
          onClick={() => checkOrders.mutate()}
          disabled={checkOrders.isPending}
          title="List what open Shopify orders still need and the stock cannot cover"
        >
          {checkOrders.isPending ? 'Checking…' : 'Check open orders'}
        </Button>
      </PageHeader>

      <Tabs
        className="mb-4"
        value={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
        options={[tab('to_cut', 'To cut'), tab('cut', 'To sew'), tab('tailored', 'Tailored'), tab('cancelled', 'Cancelled')]}
      />

      <DataTable
        loading={isLoading}
        rows={jobs}
        page={data?.pagination?.page}
        pages={data?.pagination?.pages}
        total={data?.pagination?.total}
        onPage={setPage}
        columns={columns}
        empty={<EmptyState icon={FaCut} {...EMPTY[status]} />}
      />
    </div>
  );
}
