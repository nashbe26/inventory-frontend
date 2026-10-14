import { stockService } from '../../services';
import { LABEL_SIZES, loadSizeId } from './labelQueue';

/** The label size chosen on the Print labels page (remembered per browser). */
export const currentLabelSize = () => LABEL_SIZES.find((s) => s.id === loadSizeId()) || LABEL_SIZES[0];

/**
 * Build the labels PDF on the server and hand it to the browser as a download.
 *
 * @param {Array} rows  [{ name, color, size, code, barcode, price, count }] — see pdfRows
 * @param {{ id, w, h }} [size]  defaults to the remembered label size
 * @returns {Promise<number>} labels in the file
 */
export async function downloadLabelsPdf(rows, size = currentLabelSize()) {
  const res = await stockService.dochettes({ labels: rows, widthMm: size.w, heightMm: size.h });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `labels-${size.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return rows.reduce((a2, r) => a2 + r.count, 0);
}
