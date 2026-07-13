import { renderToBuffer } from "@react-pdf/renderer";
import {
  InvoiceBundleDocument,
  InvoiceDocument,
  type InvoiceDocumentProps,
} from "./invoice";

/**
 * 単一注文の納品書 PDF をバッファで返す。
 * Route Handler から Response body に流すだけの想定。
 */
export async function renderInvoiceBuffer(
  props: InvoiceDocumentProps,
): Promise<Buffer> {
  const buf = await renderToBuffer(InvoiceDocument(props));
  return Buffer.from(buf);
}

/**
 * 複数注文をまとめた連結 PDF (1ファイル) を返す。
 */
export async function renderInvoiceBundleBuffer(
  invoices: InvoiceDocumentProps[],
  title: string,
): Promise<Buffer> {
  const buf = await renderToBuffer(
    InvoiceBundleDocument({ invoices, title }),
  );
  return Buffer.from(buf);
}
