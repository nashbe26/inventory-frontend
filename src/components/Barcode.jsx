import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Renders a SKU's barcode string as a scannable barcode.
 *
 * CODE128 on purpose: it encodes the exact string we store on the SKU, whatever
 * its length or characters, and a scan reads back that same string — which is
 * what /stock/lookup matches on. (EAN-13 would reject codes with a wrong check
 * digit; the symbology is irrelevant to our lookup, so robustness wins.)
 */
export default function Barcode({ value, height = 48, width = 1.6, fontSize = 12, displayValue = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, String(value), {
        format: 'CODE128',
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
