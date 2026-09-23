import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  styleService,
  categoryService,
  rayonService,
  materialService,
  fournisseurService,
  sizeService
} from '../services';
import { FaArrowLeft, FaSave } from 'react-icons/fa';
import { PageHeader, Button, Card } from '../components/ui/Primitives';

/** One field row: label, control, and an optional line of guidance beneath. */
function Field({ label, hint, required, children }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-base font-medium text-content">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-sm text-content-muted">{hint}</p> : null}
    </div>
  );
}

export default function StyleForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    categoryId: '',
    rayonId: '',
    materialId: '',
    fournisseurId: '',
    sizeScale: '',
    season: '',
    retailPrice: '',
    costPrice: '',
    status: 'active'
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: async () => (await categoryService.getAll()).data.data });
  const { data: rayons } = useQuery({ queryKey: ['rayons'], queryFn: async () => (await rayonService.getAll()).data.data });
  const { data: materials } = useQuery({ queryKey: ['materials'], queryFn: async () => (await materialService.getAll()).data.data });
  const { data: fournisseurs } = useQuery({ queryKey: ['fournisseurs'], queryFn: async () => (await fournisseurService.getAll()).data.data });
  const { data: scales } = useQuery({ queryKey: ['size-scales'], queryFn: async () => (await sizeService.getScales()).data.data });

  const { data: existing } = useQuery({
    queryKey: ['style', id],
    queryFn: async () => (await styleService.getOne(id)).data.data,
    enabled: isEditing
  });

  useEffect(() => {
    if (!existing) return;
    setForm({
      code: existing.code || '',
      name: existing.name || '',
      description: existing.description || '',
      categoryId: existing.categoryId?._id || existing.categoryId || '',
      rayonId: existing.rayonId?._id || existing.rayonId || '',
      materialId: existing.materialId?._id || existing.materialId || '',
      fournisseurId: existing.fournisseurId?._id || existing.fournisseurId || '',
      sizeScale: existing.sizeScale || '',
      season: existing.season || '',
      retailPrice: existing.retailPrice ?? '',
      costPrice: existing.costPrice ?? '',
      status: existing.status || 'active'
    });
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? styleService.update(id, payload) : styleService.create(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['styles'] });
      toast.success(isEditing ? 'Style updated' : 'Style created');
      navigate(`/styles/${res.data.data._id}`);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Could not save the style')
  });

  const submit = (e) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      retailPrice: form.retailPrice === '' ? undefined : Number(form.retailPrice),
      costPrice: form.costPrice === '' ? undefined : Number(form.costPrice)
    });
  };

  /* Margin shown live while pricing, rather than after saving. */
  const retail = Number(form.retailPrice);
  const cost = Number(form.costPrice);
  const marginPct = retail > 0 && cost >= 0 && form.retailPrice !== '' && form.costPrice !== ''
    ? ((retail - cost) / retail) * 100
    : null;

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Edit style' : 'New style'}
        description={
          isEditing
            ? 'Colourways and stock are managed from the style page.'
            : 'Create the design first; colourways and their size grids come next.'
        }
      >
        <Button icon={FaArrowLeft} onClick={() => navigate('/styles')}>Back</Button>
      </PageHeader>

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        <div>
          <Card title="Design">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Style code" required hint="Your internal reference, e.g. CHM-001.">
                <input className="form-control" value={form.code} onChange={set('code')} required placeholder="CHM-001" />
              </Field>
              <Field label="Name" required>
                <input className="form-control" value={form.name} onChange={set('name')} required placeholder="Chemise Oxford" />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                className="form-control !h-auto py-2"
                rows={3}
                value={form.description}
                onChange={set('description')}
                placeholder="Cut, fit, detailing…"
              />
            </Field>

            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Category" required>
                <select className="form-control" value={form.categoryId} onChange={set('categoryId')} required>
                  <option value="">Select a category</option>
                  {(categories || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </Field>
              <Field
                label="Size scale"
                required
                hint="Fixes which sizes this style's SKUs are cut in — a shirt should never offer shoe sizes."
              >
                <select className="form-control" value={form.sizeScale} onChange={set('sizeScale')} required>
                  <option value="">Select a scale</option>
                  {(scales || []).map((s) => (
                    <option key={s.scale} value={s.scale}>{s.scale} ({s.count} sizes)</option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card title="Fabric and supply">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Material">
                <select className="form-control" value={form.materialId} onChange={set('materialId')}>
                  <option value="">None</option>
                  {(materials || []).map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}{m.weightGsm ? ` — ${m.weightGsm} g/m²` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Supplier">
                <select className="form-control" value={form.fournisseurId} onChange={set('fournisseurId')}>
                  <option value="">None</option>
                  {(fournisseurs || []).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </Field>
              <Field label="Storage location">
                <select className="form-control" value={form.rayonId} onChange={set('rayonId')}>
                  <option value="">None</option>
                  {(rayons || []).map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Season" hint="Free text — SS26, AW26, Permanent.">
                <input className="form-control" value={form.season} onChange={set('season')} placeholder="SS26" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6">
          <Card title="Pricing">
            <Field label="Retail price">
              <input type="number" step="0.01" min="0" className="form-control" value={form.retailPrice} onChange={set('retailPrice')} placeholder="0.00" />
            </Field>
            <Field label="Cost price">
              <input type="number" step="0.01" min="0" className="form-control" value={form.costPrice} onChange={set('costPrice')} placeholder="0.00" />
            </Field>

            {marginPct !== null ? (
              <div className="rounded-md border border-border bg-surface-sunken px-3 py-2">
                <div className="text-sm text-content-secondary">Gross margin</div>
                <div className={`text-lg font-semibold tabular-nums ${marginPct < 0 ? 'text-danger' : 'text-content'}`}>
                  {marginPct.toFixed(1)}%
                  <span className="ml-2 text-base font-normal text-content-secondary">
                    {(retail - cost).toFixed(2)} DT per unit
                  </span>
                </div>
              </div>
            ) : null}
          </Card>

          <Card title="Status">
            <Field label="Status" hint="Draft keeps a style out of picking and reporting until it is ready.">
              <select className="form-control" value={form.status} onChange={set('status')}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </Field>

            <div className="flex gap-2">
              <Button
                variant="primary"
                icon={FaSave}
                type="submit"
                disabled={mutation.isPending}
                className="flex-1"
              >
                {mutation.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Create style'}
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
