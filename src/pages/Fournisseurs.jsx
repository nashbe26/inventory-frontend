import ReferenceDataPage from '../components/ReferenceDataPage';
import { fournisseurService } from '../services';

export default function Fournisseurs() {
  return (
    <ReferenceDataPage
      title="Suppliers"
      singular="Supplier"
      description="Who the fabric and finished goods come from. Styles reference a supplier so deliveries can be traced back."
      service={fournisseurService}
      queryKey="fournisseurs"
      searchKeys={['name', 'code', 'email', 'phone']}
      emptyDescription="A style can name its supplier, which makes a delivery traceable back to where the stock came from."
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Textiles Sfax SARL' },
        { key: 'code', label: 'Code', type: 'text', placeholder: 'TSF',
          hint: 'Optional short reference.' },
        { key: 'email', label: 'Email', type: 'text', placeholder: 'contact@example.tn' },
        { key: 'phone', label: 'Phone', type: 'text', placeholder: '+216 …' },
        { key: 'address', label: 'Address', type: 'textarea' }
      ]}
      columns={[
        { key: 'name', header: 'Supplier', render: (f) => (
          <div className="min-w-0">
            <div className="font-medium text-content truncate">{f.name}</div>
            {f.address ? (
              <div className="text-sm text-content-muted truncate">{f.address}</div>
            ) : null}
          </div>
        ) },
        { key: 'code', header: 'Code', mono: true, render: (f) => f.code || '—' },
        { key: 'email', header: 'Email', render: (f) =>
          f.email ? <a className="text-accent hover:underline" href={`mailto:${f.email}`}>{f.email}</a> : '—'
        },
        { key: 'phone', header: 'Phone', render: (f) =>
          f.phone ? <span className="whitespace-nowrap">{f.phone}</span> : '—'
        }
      ]}
    />
  );
}
