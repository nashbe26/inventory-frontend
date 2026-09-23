import ReferenceDataPage from '../components/ReferenceDataPage';
import { materialService } from '../services';
import { Badge } from '../components/ui/Primitives';

const STATUS_TONE = { active: 'success', inactive: 'neutral', out_of_stock: 'danger' };

export default function Materials() {
  return (
    <ReferenceDataPage
      title="Fabrics"
      singular="Fabric"
      description="Composition, weight and care — the attributes that end up on a garment label."
      service={materialService}
      queryKey="materials"
      searchKeys={['name', 'composition']}
      emptyDescription="A style references one fabric. Recording composition and weight here means labels and cost estimates can be generated from it later."
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Jersey coton' },
        {
          key: 'composition',
          label: 'Composition',
          type: 'text',
          placeholder: '95% coton, 5% élasthanne',
          hint: 'As printed on the care label. Free text, because real labels carry blends, linings and trims.'
        },
        {
          key: 'weightGsm',
          label: 'Weight (g/m²)',
          type: 'number',
          placeholder: '200',
          hint: 'Grams per square metre — the standard textile measure. A jersey is ~200, a denim ~340.'
        },
        {
          key: 'widthCm',
          label: 'Roll width (cm)',
          type: 'number',
          placeholder: '150',
          hint: 'Used when estimating how much fabric a garment consumes.'
        },
        {
          key: 'careInstructions',
          label: 'Care instructions',
          type: 'text',
          placeholder: 'Lavage 30°C, ne pas blanchir'
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          defaultValue: 'active',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'out_of_stock', label: 'Out of stock' }
          ]
        },
        { key: 'description', label: 'Notes', type: 'textarea' }
      ]}
      columns={[
        { key: 'name', header: 'Fabric', render: (m) => (
          <span className="font-medium text-content">{m.name}</span>
        ) },
        { key: 'composition', header: 'Composition', render: (m) => m.composition || '—' },
        { key: 'weightGsm', header: 'Weight', align: 'right', render: (m) =>
          m.weightGsm ? `${m.weightGsm} g/m²` : '—'
        },
        { key: 'widthCm', header: 'Width', align: 'right', render: (m) =>
          m.widthCm ? `${m.widthCm} cm` : '—'
        },
        { key: 'status', header: 'Status', render: (m) => (
          <Badge tone={STATUS_TONE[m.status] || 'neutral'}>
            {(m.status || 'active').replace(/_/g, ' ')}
          </Badge>
        ) }
      ]}
    />
  );
}
