/**
 * Turn the order sheet file into rows the server can compare.
 *
 * Reads .xlsx in the browser (read-excel-file) and .csv by hand, finds the
 * header row, and maps the sheet's own column names — "Nom et Prénom", "GSM",
 * "Désignation", "Qté", "P.U", "Frais de livraison"… — to fixed field names.
 * Interpreting the values (dates, statuses, phones) is the server's job.
 */
import { readSheet } from 'read-excel-file/browser';

const norm = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Field → header spellings, most specific first. A header matches a field when
 * its normalised text starts with, or equals, one of the spellings. Fields are
 * tried in this order and each column is used once, so "Tel 2" is claimed by
 * phone2 before phone sees it.
 */
export const FIELDS = [
  { key: 'date', label: 'Date', required: true, names: ['date'] },
  { key: 'phone2', label: 'Phone 2', names: ['gsm 2', 'gsm2', 'tel 2', 'tel2', 'telephone 2'] },
  { key: 'phone', label: 'Phone (GSM)', names: ['gsm', 'tel', 'telephone', 'phone', 'mobile', 'numero'] },
  { key: 'name', label: 'Customer name', names: ['nom et prenom', 'nom', 'client', 'name'] },
  { key: 'designation', label: 'Article (Désignation)', required: true, names: ['designation', 'article', 'produit', 'product'] },
  { key: 'quantity', label: 'Quantity', names: ['qte', 'qt', 'quantite', 'qty'] },
  { key: 'unitPrice', label: 'Unit price (P.U)', names: ['p u', 'pu', 'prix unitaire', 'prix'] },
  { key: 'shipping', label: 'Delivery fee', names: ['frais de livraison', 'frais', 'livraison'] },
  { key: 'total', label: 'Total (incl. delivery)', names: ['total', 'prix total', 'montant'] },
  { key: 'source', label: 'Source', names: ['source', 'canal'] },
  { key: 'confirmation', label: 'Confirmation', names: ['confirmation', 'statut', 'etat', 'status'] },
  { key: 'observations', label: 'Observations', names: ['observation', 'remarque', 'commentaire', 'note'] },
  { key: 'governorate', label: 'Governorate', names: ['gouvernorat', 'gouvernerat', 'region'] },
  { key: 'city', label: 'City', names: ['ville', 'delegation', 'cite'] },
  { key: 'address', label: 'Address', names: ['adresse', 'address'] }
];

/** Which column holds each field, from one header row. */
export function mapColumns(headerRow) {
  const headers = headerRow.map(norm);
  const used = new Set();
  const columns = {};
  for (const f of FIELDS) {
    const idx = headers.findIndex(
      (h, i) => !used.has(i) && h && f.names.some((n) => h === n || h.startsWith(`${n} `) || (n.length > 3 && h.startsWith(n)))
    );
    if (idx >= 0) {
      columns[f.key] = idx;
      used.add(idx);
    }
  }
  return columns;
}

const hasEnough = (columns) => columns.date != null && columns.designation != null && (columns.phone != null || columns.name != null);

/** The header row is the first of the top 15 rows that maps the required columns. */
export function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const columns = mapColumns(rows[i] || []);
    if (hasEnough(columns)) return { index: i, columns };
  }
  return null;
}

/**
 * An Excel date cell arrives as a Date whose UTC fields are the date and time as
 * written in the sheet. Send them as written: "YYYY-MM-DD", plus " HH:mm" when
 * the cell has a time of day (a form's timestamp).
 */
export const cellValue = (v) => {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const iso = v.toISOString();
    const time = iso.slice(11, 16);
    return time === '00:00' ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${time}`;
  }
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/* ----------------------------------------- columns from content (no header) */

const GOVERNORATES = [
  'ariana', 'beja', 'ben arous', 'bizerte', 'gabes', 'gafsa', 'jendouba', 'kairouan',
  'kasserine', 'kebili', 'le kef', 'kef', 'mahdia', 'la manouba', 'manouba', 'medenine', 'monastir',
  'nabeul', 'sfax', 'sidi bouzid', 'siliana', 'sousse', 'tataouine', 'tozeur', 'tunis', 'zaghouan'
];
const STATUS_WORDS = ['confirm', 'annul', 'attente', 'nrp', 'livr', 'retour', 'echange', 'injoignable', 'rappel', 'pret', 'prepar', 'expedi'];

const text = (v) => (v instanceof Date ? '' : String(v ?? '').trim());
const looks = {
  date: (v) => v instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(text(v)) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(text(v)),
  phone: (v) => {
    const d = text(v).replace(/[\s+().-]/g, '');
    return /^\d+$/.test(d) && (d.length === 8 || (d.length === 11 && d.startsWith('216')) || (d.length === 13 && d.startsWith('00216')));
  },
  governorate: (v) => GOVERNORATES.includes(norm(v)),
  // "SET FOLA - Noir / L" — a variant title — or at least words then "/ size".
  article: (v) => /[a-z]{2}.*\s\/\s*\S/i.test(text(v)) || /[a-z]{2}.* - .+/i.test(text(v)),
  money: (v) => typeof v === 'number' ? v > 0 && v < 100000 : /^\d{1,5}([.,]\d{1,3})?$/.test(text(v)),
  status: (v) => STATUS_WORDS.some((w) => norm(v).includes(w)),
  words: (v) => /[a-z؀-ۿ]{2}/i.test(text(v)) && !/^\d+$/.test(text(v))
};

/**
 * Which column holds what, when the sheet has no header row — judged from the
 * values. Each column's score for a field is the share of its filled cells
 * that look right; a field takes the best column above a threshold, and each
 * column is used once. City and address have no recognisable shape, so they
 * are taken positionally: the two text columns after the governorate, which is
 * how the order form lays them out. The person can correct any of it.
 */
export function inferColumns(grid) {
  const sample = grid.filter((r) => r && r.some((c) => text(c) || c instanceof Date)).slice(0, 200);
  const width = Math.max(0, ...sample.map((r) => r.length));
  const used = new Set();
  const columns = {};

  const stats = Array.from({ length: width }, (_, i) => {
    const values = sample.map((r) => r[i]).filter((v) => v instanceof Date || text(v) !== '');
    const share = (test) => (values.length ? values.filter(test).length / values.length : 0);
    return {
      i,
      filled: sample.length ? values.length / sample.length : 0,
      ...Object.fromEntries(Object.entries(looks).map(([k, test]) => [k, share(test)]))
    };
  });

  const pick = (field, kind, { min = 0.8, filled = 0.5, near } = {}) => {
    const best = stats
      .filter((c) => !used.has(c.i) && c[kind] >= min && c.filled >= filled)
      .sort((a, b) => b[kind] - a[kind] || (near != null ? Math.abs(a.i - near) - Math.abs(b.i - near) : a.i - b.i))[0];
    if (best) { columns[field] = best.i; used.add(best.i); }
  };

  pick('date', 'date');
  pick('phone', 'phone');
  pick('governorate', 'governorate', { min: 0.6 });
  pick('designation', 'article', { min: 0.6 });
  pick('total', 'money', { near: columns.designation });
  pick('confirmation', 'status', { min: 0.5, filled: 0 });
  pick('phone2', 'phone', { min: 0.8, filled: 0.05 });

  // Name: the first text column between the date and the phone, else right after the date.
  const nameCol = stats.find((c) => !used.has(c.i) && c.words >= 0.8 && c.filled >= 0.5 &&
    (columns.date == null || c.i > columns.date) && (columns.phone == null || c.i < columns.phone));
  if (nameCol) { columns.name = nameCol.i; used.add(nameCol.i); }

  if (columns.governorate != null) {
    for (const [field, offset] of [['city', 1], ['address', 2]]) {
      const i = columns.governorate + offset;
      if (i < width && !used.has(i) && stats[i].filled >= 0.3) { columns[field] = i; used.add(i); }
    }
  }
  return columns;
}

/** Spreadsheet letters for a column index: 0 → A, 26 → AA. */
export const columnLetter = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/* ------------------------------------------------------------------ csv */

/** The file's text, as UTF-8 when it is valid UTF-8, else Windows-1252 (Excel's "CSV"). */
async function readText(file) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

/** RFC-4180-ish: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = [';', ',', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best, ';');

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ----------------------------------------------------------------- read */

const isEmptyRow = (cells) => !cells.some((c) => c instanceof Date || (c != null && String(c).trim() !== ''));

/**
 * Read an order sheet file into a grid and a first guess at its columns.
 *
 * A header row is used when one is found in the first rows; otherwise the
 * columns are recognised from their content (an order form's sheet has no
 * titles). Either way the guess is only a starting point — the import page
 * lets the person reassign any column before comparing.
 *
 * @returns {Promise<{ grid, headerIndex, columns, inferred, dataRows }>}
 *   headerIndex is -1 when there is no header row.
 * @throws when the file cannot be read.
 */
export async function readOrderSheet(file) {
  const name = file.name.toLowerCase();
  let grid;
  if (name.endsWith('.xlsx')) {
    grid = await readSheet(file);
  } else if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    grid = parseCsv(await readText(file));
  } else {
    throw new Error('Use an .xlsx or .csv file. (For an old .xls file, open it in Excel and save as .xlsx.)');
  }

  const header = findHeader(grid);
  const headerIndex = header ? header.index : -1;
  const columns = header ? header.columns : inferColumns(grid);
  const dataRows = grid.slice(headerIndex + 1).filter((r) => r && !isEmptyRow(r)).length;
  return { grid, headerIndex, columns, inferred: !header, dataRows };
}

/** True when the mapping has what an order needs. */
export const columnsReady = (columns) =>
  columns.date != null && columns.designation != null && (columns.phone != null || columns.name != null);

/**
 * Rows for the server, from the grid and the (possibly corrected) columns.
 * `rowNumber` is the row as the spreadsheet numbers it (1-based).
 */
export function buildRows(grid, headerIndex, columns) {
  const rows = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i] || [];
    if (isEmptyRow(cells)) continue;
    const row = { rowNumber: i + 1 };
    for (const [key, idx] of Object.entries(columns)) {
      if (idx != null) row[key] = cellValue(cells[idx]);
    }
    rows.push(row);
  }
  return rows;
}

/** A few non-empty values from a column, to show what it holds. */
export function columnSamples(grid, headerIndex, idx, count = 2) {
  const out = [];
  for (let i = headerIndex + 1; i < grid.length && out.length < count; i++) {
    const v = cellValue(grid[i]?.[idx]);
    if (v != null && v !== '') out.push(String(v));
  }
  return out;
}
