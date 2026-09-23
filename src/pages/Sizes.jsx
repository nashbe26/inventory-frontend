import { useQuery } from '@tanstack/react-query';
import ReferenceDataPage from '../components/ReferenceDataPage';
import { sizeService } from '../services';
import { Badge } from '../components/ui/Primitives';

export default function Sizes() {
  /* Offer the scales that already exist, so a typo does not silently create a
     new one. Free text is still allowed for genuinely new scales. */
  const { data: scales } = useQuery({
    queryKey: ['size-scales'],
    queryFn: async () => (await sizeService.getScales()).data.data
  });

  return (
    <ReferenceDataPage
      title="Sizes"
      singular="Size"
      description="Grouped into scales, so a garment offers apparel sizes and never shoe sizes."
      service={sizeService}
      queryKey="sizes"
      searchKeys={['label', 'value', 'scale']}
      emptyDescription="A style picks one scale, and its colourways generate a SKU per size in that scale."
      fields={[
        { key: 'label', label: 'Label', type: 'text', required: true, placeholder: 'M',
          hint: 'What appears on the size grid and the label.' },
        { key: 'value', label: 'Value', type: 'text', required: true, placeholder: 'M',
          hint: 'Uppercased internal value; usually the same as the label.' },
        {
          key: 'scale',
          label: 'Scale',
          type: 'text',
          required: true,
          defaultValue: 'Général',
          placeholder: 'Vêtements',
          hint: (scales || []).length
            ? `Existing scales: ${scales.map((s) => s.scale).join(', ')}`
            : 'e.g. Vêtements, Chaussures EU, Taille unique'
        },
        {
          key: 'order',
          label: 'Sort order',
          type: 'number',
          defaultValue: 0,
          min: 0,
          /* The form previously wrote `sortOrder`, which is not a field on the
             schema — so the value was silently discarded and sizes never
             sorted. It writes `order` now. */
          hint: 'Position within the scale. Leave gaps (10, 20, 30) so sizes can be inserted later.'
        }
      ]}
      columns={[
        { key: 'label', header: 'Label', render: (s) => (
          <span className="font-medium text-content">{s.label}</span>
        ) },
        { key: 'scale', header: 'Scale', render: (s) => (
          <Badge tone="neutral">{s.scale || 'Général'}</Badge>
        ) },
        { key: 'value', header: 'Value', mono: true, render: (s) => s.value || '—' },
        { key: 'order', header: 'Order', align: 'right', render: (s) => s.order ?? 0 }
      ]}
    />
  );
}
