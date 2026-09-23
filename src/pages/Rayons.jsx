import ReferenceDataPage from '../components/ReferenceDataPage';
import { rayonService } from '../services';

export default function Rayons() {
  return (
    <ReferenceDataPage
      title="Rayons"
      singular="Rayon"
      description="Physical locations in the warehouse — where stock actually sits."
      service={rayonService}
      queryKey="rayons"
      emptyDescription="A rayon is a section or aisle. Styles reference one so pickers know where to go."
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Réserve principale' },
        { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'R-PRIN' },
        { key: 'location', label: 'Location', type: 'text', placeholder: 'Stock courant',
          hint: 'Free text — an aisle, a floor, a room.' },
        { key: 'description', label: 'Description', type: 'textarea' }
      ]}
    />
  );
}
