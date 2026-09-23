import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import Modal from './Modal';
import {
  PageHeader,
  Button,
  Toolbar,
  SearchInput,
  DataTable,
  EmptyState
} from './ui/Primitives';

/**
 * One implementation for the catalogue reference screens — categories,
 * colours, sizes, rayons, materials.
 *
 * These were five near-identical files: the same list, the same modal form,
 * the same three mutations, each drifting slightly from the others. That
 * duplication is why nothing matched. A page is now a field config.
 *
 * fields: [{ key, label, type, required, options, hint, placeholder, width,
 *            help, defaultValue }]
 *   type: text | textarea | number | select | color
 * columns: optional DataTable columns; defaults to one per field.
 */
export default function ReferenceDataPage({
  title,
  description,
  singular,
  service,
  queryKey,
  fields,
  columns,
  searchKeys = ['name', 'label', 'code'],
  emptyDescription
}) {
  const queryClient = useQueryClient();
  const [isOpen, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');

  const { data: rows, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await service.getAll()).data.data
  });

  const blank = () =>
    Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? '']));

  const close = () => { setOpen(false); setEditing(null); setForm(blank()); };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  const createMutation = useMutation({
    mutationFn: service.create,
    onSuccess: () => { invalidate(); toast.success(`${singular} created`); close(); },
    onError: (e) => toast.error(e.response?.data?.message || `Could not create the ${singular.toLowerCase()}`)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => service.update(id, data),
    onSuccess: () => { invalidate(); toast.success(`${singular} updated`); close(); },
    onError: (e) => toast.error(e.response?.data?.message || `Could not update the ${singular.toLowerCase()}`)
  });

  const deleteMutation = useMutation({
    mutationFn: service.delete,
    onSuccess: () => { invalidate(); toast.success(`${singular} deleted`); },
    onError: (e) => toast.error(e.response?.data?.message || `Could not delete the ${singular.toLowerCase()}`)
  });

  const open = (row = null) => {
    if (row) {
      setEditing(row);
      setForm(Object.fromEntries(fields.map((f) => [f.key, row[f.key] ?? f.defaultValue ?? ''])));
    } else {
      setEditing(null);
      setForm(blank());
    }
    setOpen(true);
  };

  const submit = (e) => {
    e.preventDefault();
    // Numbers arrive from inputs as strings; send them as numbers or omit them.
    const payload = { ...form };
    fields.forEach((f) => {
      if (f.type === 'number') {
        payload[f.key] = payload[f.key] === '' ? undefined : Number(payload[f.key]);
      }
    });
    if (editing) updateMutation.mutate({ id: editing._id, data: payload });
    else createMutation.mutate(payload);
  };

  const remove = (row) => {
    const name = row.name || row.label || 'this record';
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(row._id);
    }
  };

  const filtered = (rows || []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q));
  });

  const cols = [
    ...(columns || fields.filter((f) => f.type !== 'textarea').map((f) => ({
      key: f.key,
      header: f.label,
      align: f.type === 'number' ? 'right' : undefined,
      render: (row) => row[f.key] ?? '—'
    }))),
    {
      key: '_actions',
      header: '',
      width: '96px',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" className="btn-icon" title="Edit"
            onClick={(e) => { e.stopPropagation(); open(row); }}>
            <FaEdit />
          </Button>
          <Button variant="ghost" size="sm" className="btn-icon text-danger" title="Delete"
            onClick={(e) => { e.stopPropagation(); remove(row); }}>
            <FaTrash />
          </Button>
        </div>
      )
    }
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <PageHeader title={title} description={description}>
        <Button variant="primary" icon={FaPlus} onClick={() => open()}>
          Add {singular.toLowerCase()}
        </Button>
      </PageHeader>

      {(rows?.length || 0) > 8 ? (
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${title.toLowerCase()}…`} />
        </Toolbar>
      ) : null}

      <DataTable
        loading={isLoading}
        rows={filtered}
        columns={cols}
        empty={
          search ? (
            <EmptyState
              title={`No ${title.toLowerCase()} match "${search}"`}
              action={<Button onClick={() => setSearch('')}>Clear search</Button>}
            />
          ) : (
            <EmptyState
              title={`No ${title.toLowerCase()} yet`}
              description={emptyDescription}
              action={
                <Button variant="primary" icon={FaPlus} onClick={() => open()}>
                  Add the first {singular.toLowerCase()}
                </Button>
              }
            />
          )
        }
      />

      <Modal isOpen={isOpen} onClose={close} title={editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}>
        <form onSubmit={submit}>
          {fields.map((f) => (
            <div key={f.key} className="mb-4">
              <label className="mb-1.5 block text-base font-medium text-content">
                {f.label}
                {f.required ? <span className="ml-1 text-danger">*</span> : null}
              </label>

              {f.type === 'textarea' ? (
                <textarea
                  className="form-control !h-auto py-2"
                  rows={3}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : f.type === 'select' ? (
                <select
                  className="form-control"
                  required={f.required}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                >
                  {f.placeholder ? <option value="">{f.placeholder}</option> : null}
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === 'color' ? (
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="form-control !w-14 !p-1"
                    value={form[f.key] || '#000000'}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                  <input
                    className="form-control font-mono"
                    required={f.required}
                    placeholder="#000000"
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </div>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  step={f.type === 'number' ? (f.step ?? 1) : undefined}
                  min={f.type === 'number' ? (f.min ?? 0) : undefined}
                  className="form-control"
                  required={f.required}
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}

              {f.hint ? <p className="mt-1 text-sm text-content-muted">{f.hint}</p> : null}
            </div>
          ))}

          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={close} type="button">Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : `Create ${singular.toLowerCase()}`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
