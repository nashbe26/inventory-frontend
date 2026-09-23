import ReferenceDataPage from '../components/ReferenceDataPage';
import { colorService } from '../services';

export default function Colors() {
  return (
    <ReferenceDataPage
      title="Colours"
      singular="Colour"
      description="The palette a colourway can be created from."
      service={colorService}
      queryKey="colors"
      emptyDescription="A colourway pairs a style with a colour, so the palette has to exist before any style can be built out."
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Bleu marine' },
        { key: 'hexCode', label: 'Hex code', type: 'color', required: true,
          defaultValue: '#000000', hint: 'Approximate screen colour; match it to a real fabric swatch.' }
      ]}
      columns={[
        {
          key: 'swatch',
          header: '',
          width: '44px',
          render: (c) => (
            <span
              className="block h-5 w-5 rounded border border-border-strong"
              style={{ background: c.hexCode || '#ccc' }}
              aria-hidden="true"
            />
          )
        },
        { key: 'name', header: 'Name', render: (c) => (
          <span className="font-medium text-content">{c.name}</span>
        ) },
        { key: 'hexCode', header: 'Hex', mono: true, render: (c) => c.hexCode || '—' }
      ]}
    />
  );
}
