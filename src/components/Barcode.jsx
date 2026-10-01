import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/** True when a string is a valid EAN-13 (13 digits with a correct check digit). */
export function isValidEan13(v) {
  const s = String(v || '');
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(s[12]);
}

/**
 * Renders a SKU's barcode string.
 *
 * Our generated SKU barcodes are valid EAN-13 (prefix 20 + sequence + check
 * digit), so they render as EAN-13 — the retail standard, and what the user's
 * scanner/POS expects. Anything that is not a valid EAN-13 (a placeholder code,
 * a legacy value) falls back to CODE128, which encodes any string. Either way a
 * scan reads back the exact value, which is what /stock/lookup matches on.
 */
export default function Barcode({ value, height = 48, width = 1.6, fontSize = 12, displayValue = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    const ean = isValidEan13(value);
    try {
      JsBarcode(ref.current, String(value), {
        format: ean ? 'EAN13' : 'CODE128',
        height,
        width,
        fontSize,
        displayValue,
        margin: 4,
        background: '#ffffff'
      });
    } catch {
      // An unrenderable value leaves the svg empty rather than throwing.
    }
  }, [value, height, width, fontSize, displayValue]);

  return <svg ref={ref} />;
}
