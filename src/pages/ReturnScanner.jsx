import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FaUndo } from 'react-icons/fa';
import api from '../services/api';
import {
  PageHeader,
  Card,
  ScanField,
  ScanResult,
  DataTable,
  EmptyState,
  Badge
} from '../components/ui/Primitives';

const time = (d) =>
  d instanceof Date && !Number.isNaN(d.getTime())
    ? d.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

export default function ReturnScanner() {
  const [barcode, setBarcode] = useState('');
  const [scanned, setScanned] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['scan-history', historyPage],
    queryFn: async () =>
      (await api.get('/scan/history/all', { params: { limit: 50, skip: historyPage * 50 } })).data,
    staleTime: 30000
  });

  useEffect(() => {
    if (!historyData?.data) return;
    setScanHistory(
      historyData.data
        .filter((r) => r.actionType === 'return')
        .map((r) => ({
          id: r._id,
          name: r.productName,
          sku: r.sku,
          color: r.color,
          size: r.size,
          before: r.quantityBefore,
          after: r.quantityAfter,
          at: new Date(r.scannedAt),
          user: r.userId?.firstName
            ? `${r.userId.firstName} ${r.userId.lastName || ''}`.trim()
            : null
        }))
    );
  }, [historyData]);

  const scanMutation = useMutation({
    mutationFn: async (value) => (await api.post('/scan/return', { barcode: value })).data,
    onSuccess: (data) => {
      setScanned(data.data);
      toast.success(data.message, { autoClose: 2000 });
      queryClient.invalidateQueries({ queryKey: ['scan-history'] });
      setHistoryPage(0);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      setBarcode('');
      inputRef.current?.focus();
      setTimeout(() => setScanned(null), 4000);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Scan failed');
      setBarcode('');
      inputRef.current?.focus();
    }
  });

  const submit = () => {
    const code = barcode.trim();
    if (code) scanMutation.mutate(code);
  };

  return (
    <div>
      <PageHeader
        title="Return scanner"
        description="Scanning here puts one unit back into stock. Use the preparation scanner to take stock out."
      />

      <Card>
        <ScanField
          inputRef={inputRef}
          value={barcode}
          onChange={setBarcode}
          onSubmit={submit}
          disabled={scanMutation.isPending}
          tone="success"
          action="Return"
          placeholder="Scan a barcode or type a SKU…"
          hint="Accepts barcodes and SKUs. Each scan adds one unit; the field refocuses itself so a hardware scanner keeps working."
        />

        {scanned ? (
          <ScanResult
            tone="success"
            title={scanned.product}
            subtitle={`${scanned.color || ''}${scanned.color && scanned.size ? ' · ' : ''}${scanned.size || ''}`}
            detail={scanned.sku}
            right={
              <>
                <div className="text-2xl font-semibold tabular-nums leading-none text-success">
                  {scanned.remainingQuantity}
                </div>
                <div className="text-sm text-content-muted">in stock</div>
              </>
            }
          />
        ) : null}
      </Card>

      <Card title="Recent returns" padded={false}>
        <div className="px-5 pb-5">
          <DataTable
            loading={isLoading}
            rows={scanHistory}
            rowKey={(r) => r.id}
            columns={[
              { key: 'name', header: 'Product', render: (r) => (
                <div className="min-w-0">
                  <div className="font-medium text-content truncate">{r.name}</div>
                  <div className="font-mono text-sm text-content-muted truncate">{r.sku}</div>
                </div>
              ) },
              { key: 'variant', header: 'Variant', render: (r) =>
                [r.color, r.size].filter(Boolean).join(' · ') || '—'
              },
              { key: 'change', header: 'Stock', render: (r) => (
                <Badge tone="success">
                  {r.before} → {r.after}
                </Badge>
              ) },
              { key: 'user', header: 'By', render: (r) => r.user || '—' },
              { key: 'at', header: 'Time', align: 'right', render: (r) => (
                <span className="whitespace-nowrap text-content-secondary">{time(r.at)}</span>
              ) }
            ]}
            empty={
              <EmptyState
                icon={FaUndo}
                title="No returns yet"
                description="Returns scanned on this screen appear here, newest first."
              />
            }
          />
        </div>
      </Card>
    </div>
  );
}
