import React from 'react';

/**
 * Interface primitives.
 *
 * These exist because 36 pages previously shared 3 components, so every table,
 * filter bar, badge and empty state was re-implemented inline — which is why
 * nothing matched. Anything used on more than one screen belongs here.
 *
 * Styling reads from the tokens in styles/tokens.css. Components accept
 * `className` so a page can adjust layout, but never colour or size.
 */

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ Button */

const BUTTON_VARIANTS = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  danger: 'btn btn-danger',
  ghost: 'btn btn-ghost'
};

export function Button({
  variant = 'secondary',
  size,
  icon: Icon,
  children,
  className,
  ...rest
}) {
  return (
    <button
      type="button"
      className={cx(BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.secondary,
        size === 'sm' && 'btn-sm', className)}
      {...rest}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- PageHeader */

/**
 * A title row, not a card. `description` gives the page one line of context —
 * most screens previously opened with a bare noun and no explanation.
 */
export function PageHeader({ title, description, children }) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-subtitle">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ title, actions, children, className, padded = true }) {
  return (
    <section className={cx('card', !padded && 'p-0', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 mb-4">
          {title ? <h3 className="!mb-0">{title}</h3> : <span />}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------- Badge */

const TONES = {
  neutral: 'badge badge-neutral',
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  danger: 'badge badge-danger',
  info: 'badge badge-info',
  accent: 'badge badge-primary'
};

export function Badge({ tone = 'neutral', children, className }) {
  return <span className={cx(TONES[tone] || TONES.neutral, className)}>{children}</span>;
}

/**
 * Stock health, derived in one place so every screen agrees on what "low"
 * means and which colour says so.
 */
export function StockBadge({ quantity, threshold = 10 }) {
  const qty = Number(quantity) || 0;
  if (qty === 0) return <Badge tone="danger">Out of stock</Badge>;
  if (qty <= threshold) return <Badge tone="warning">Low · {qty}</Badge>;
  return <Badge tone="success">In stock · {qty}</Badge>;
}

/* ---------------------------------------------------------------- StatTile */

/**
 * One anatomy for every statistic: label, value, optional delta or hint.
 *
 * Deliberately has no colour prop. The old dashboard gave each of six tiles a
 * different colour, which signalled nothing — the eye reads "important" six
 * times and learns nothing. Emphasis belongs to `tone`, used only when a
 * number is genuinely actionable (stock at zero).
 */
export function StatTile({ label, value, hint, tone = 'default', icon: Icon }) {
  const valueClass = {
    default: 'text-content',
    danger: 'text-danger',
    warning: 'text-warning',
    success: 'text-success'
  }[tone] || 'text-content';

  return (
    <div className="stat-card">
      <h3>
        {Icon ? <Icon className="inline mr-1.5 opacity-50 align-[-1px]" aria-hidden="true" /> : null}
        {label}
      </h3>
      <div className={cx('stat-value', valueClass)}>{value}</div>
      {hint ? <p className="stat-label">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------- EmptyState */

/**
 * The products table previously rendered headers, a void, then "Page 1 of 0".
 * An empty result has to say so, and say what to do next.
 */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      {Icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-sunken text-content-muted">
          <Icon aria-hidden="true" />
        </div>
      ) : null}
      <p className="text-md font-medium text-content">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-base text-content-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded bg-surface-hover', className)} />;
}

/** Placeholder rows that match the table's real geometry, so nothing jumps. */
export function TableSkeleton({ rows = 6, columns = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c}>
              <Skeleton className={cx('h-4', c === 0 ? 'w-40' : 'w-16')} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/* ----------------------------------------------------------------- Toolbar */

/**
 * Search and filters in one bordered strip rather than a separate floating
 * card, so a screen reads as toolbar-then-data instead of four stacked slabs.
 */
export function Toolbar({ children, className }) {
  return (
    <div className={cx('mb-4 flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cx('search-box flex-1 min-w-[220px]', className)}>
      <svg className="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Select({ value, onChange, options, placeholder, className }) {
  return (
    <select
      className={cx('form-control w-auto min-w-[150px]', className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/* -------------------------------------------------------------- Pagination */

/**
 * Renders nothing for a single page, and never says "Page 1 of 0" — an empty
 * result is the table's business, not the pager's.
 */
export function Pagination({ page, pages, total, onPage }) {
  if (!pages || pages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
      <p className="text-sm text-content-secondary">
        Page {page} of {pages}
        {typeof total === 'number' ? ` · ${total} result${total === 1 ? '' : 's'}` : ''}
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- DataTable */

/**
 * One table implementation for every list screen.
 *
 * columns: [{ key, header, align, width, render(row) }]
 * Handles its own loading, empty and paged states so no page has to render a
 * bare "Loading…" string again.
 */
export function DataTable({
  columns,
  rows,
  rowKey = (r) => r._id,
  loading,
  empty,
  page,
  pages,
  total,
  onPage,
  onRowClick
}) {
  const showEmpty = !loading && (!rows || rows.length === 0);

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.align === 'right' ? 'num' : undefined}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>

        {loading ? (
          <TableSkeleton columns={columns.length} />
        ) : showEmpty ? null : (
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'num' : c.mono ? 'mono' : undefined}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>

      {showEmpty ? empty : null}
      <Pagination page={page} pages={pages} total={total} onPage={onPage} />
    </div>
  );
}
