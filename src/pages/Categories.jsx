import ReferenceDataPage from '../components/ReferenceDataPage';
import { categoryService } from '../services';

export default function Categories() {
  return (
    <ReferenceDataPage
      title="Categories"
      singular="Category"
      description="Product families — Hauts, Bas, Robes. Every style belongs to one."
      service={categoryService}
      queryKey="categories"
      emptyDescription="A category groups styles into a family. Styles require one, so add at least a few before building the catalogue."
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Hauts' },
        { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'HAUT',
          hint: 'Short reference, used in style codes and reports.' },
        { key: 'description', label: 'Description', type: 'textarea',
          placeholder: 'T-shirts, chemises, blouses, polos' }
      ]}
    />
  );
}
