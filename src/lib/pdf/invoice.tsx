import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { InvoiceIssuerInfo } from "@/lib/settings";

/**
 * 納品書 PDF テンプレート。
 *
 * docs/orders-invoice-batch-spec.md Section 4-1 のレイアウトに準拠する。
 *
 * ## フォント
 * 日本語フォント (Noto Sans JP) を @react-pdf/renderer に登録する。
 * Vercel の serverless では node_modules 内ファイルへ path アクセスが不安定
 * なため、Google Fonts の生 TTF を CDN URL でロードする。@react-pdf は
 * 内部で fetch → キャッシュしてくれる (関数の warm 実行間で保持)。
 */

// Google の公式 Noto CJK JP を使う。@react-pdf は URL を fetch して
// フォントを取り込む。CDN 依存を減らしたい場合は、public/fonts/ に
// 直接置いて `/fonts/xxx.otf` で参照する形に切り替える。
// (仕様書 4-2 通り。ホスト先は運用時に env で差し替えられるように分岐)
const NOTO_SANS_JP_REGULAR_URL =
  process.env.NEXT_PUBLIC_INVOICE_FONT_REGULAR_URL ??
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf";
const NOTO_SANS_JP_BOLD_URL =
  process.env.NEXT_PUBLIC_INVOICE_FONT_BOLD_URL ??
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Bold.otf";

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: NOTO_SANS_JP_REGULAR_URL, fontWeight: "normal" },
      { src: NOTO_SANS_JP_BOLD_URL, fontWeight: "bold" },
    ],
  });
  // 日本語の禁則処理をゆるく (改行が行末にはみ出ない)。
  Font.registerHyphenationCallback((word) => [word]);
  fontRegistered = true;
}

export type InvoiceLine = {
  productName: string;
  variantName?: string | null;
  unitPrice: number;
  quantity: number;
};

export type InvoiceDocumentProps = {
  /** 発行番号 (納品書 No.)。例: "AV-20260625-0001"。 */
  invoiceNumber: string;
  /** 発行日 (JST 表示用文字列)。例: "2026-06-25"。 */
  issuedAt: string;
  /** 宛名 (購入者)。 */
  recipient: {
    name: string;
    postalCode?: string | null;
    address?: string | null;
  };
  /** 明細。 */
  lines: InvoiceLine[];
  /** 送料 (円)。0 の場合は行として非表示。 */
  shippingFee: number;
  /** 合計 (円)。lines 小計 + shippingFee と一致する想定。 */
  totalAmount: number;
  /** 発行元情報。 */
  issuer: InvoiceIssuerInfo;
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: "#111827",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLabel: { fontSize: 9, color: "#6b7280" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 8,
  },
  addressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  addressBlock: { width: "48%" },
  addressBlockLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 6,
  },
  issuerName: { fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  addressText: { fontSize: 10, lineHeight: 1.4, marginBottom: 1 },
  body: { fontSize: 10, lineHeight: 1.6, marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#111827",
    paddingBottom: 6,
    fontSize: 9,
    color: "#374151",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 6,
    fontSize: 10,
  },
  colName: { flex: 4 },
  colUnit: { flex: 1, textAlign: "right" },
  colQty: { flex: 1, textAlign: "right" },
  colSubtotal: { flex: 1.2, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 4,
    fontSize: 10,
  },
  totalLabel: { width: 100, textAlign: "right" },
  totalValue: { width: 100, textAlign: "right" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderColor: "#111827",
    fontSize: 12,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    fontSize: 10,
    lineHeight: 1.6,
    color: "#374151",
  },
  variant: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
});

/**
 * 単一注文の納品書ページ。
 * 一括DL (連結PDF) 時は同じ Document 内で複数回呼び出せるように独立コンポーネント化。
 */
export function InvoicePage(props: InvoiceDocumentProps) {
  ensureFontRegistered();
  const subtotal = props.lines.reduce(
    (s, l) => s + l.unitPrice * l.quantity,
    0,
  );
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>発行日: {props.issuedAt}</Text>
        <Text style={styles.headerLabel}>
          納品書 No. {props.invoiceNumber}
        </Text>
      </View>

      <Text style={styles.title}>納 品 書</Text>

      <View style={styles.addressRow}>
        <View style={styles.addressBlock}>
          <Text style={styles.addressBlockLabel}>宛名</Text>
          <Text style={styles.recipientName}>{props.recipient.name} 様</Text>
          {props.recipient.postalCode && (
            <Text style={styles.addressText}>
              〒{props.recipient.postalCode}
            </Text>
          )}
          {props.recipient.address && (
            <Text style={styles.addressText}>{props.recipient.address}</Text>
          )}
        </View>
        <View style={styles.addressBlock}>
          <Text style={styles.addressBlockLabel}>発行元</Text>
          <Text style={styles.issuerName}>{props.issuer.companyName}</Text>
          {props.issuer.postalCode && (
            <Text style={styles.addressText}>〒{props.issuer.postalCode}</Text>
          )}
          {props.issuer.address && (
            <Text style={styles.addressText}>{props.issuer.address}</Text>
          )}
          {(props.issuer.phone || props.issuer.email) && (
            <Text style={styles.addressText}>
              {[props.issuer.phone, props.issuer.email]
                .filter(Boolean)
                .join(" / ")}
            </Text>
          )}
          {props.issuer.representative && (
            <Text style={styles.addressText}>
              代表: {props.issuer.representative}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.body}>
        平素は格別のご高配を賜り、誠にありがとうございます。{"\n"}
        下記のとおり納品いたしましたのでご査収ください。
      </Text>

      <View style={styles.tableHeader}>
        <Text style={styles.colName}>商品名</Text>
        <Text style={styles.colUnit}>単価</Text>
        <Text style={styles.colQty}>数量</Text>
        <Text style={styles.colSubtotal}>小計</Text>
      </View>
      {props.lines.map((l, idx) => (
        <View key={`${l.productName}-${idx}`} style={styles.tableRow}>
          <View style={styles.colName}>
            <Text>{l.productName}</Text>
            {l.variantName && (
              <Text style={styles.variant}>{l.variantName}</Text>
            )}
          </View>
          <Text style={styles.colUnit}>{yen(l.unitPrice)}</Text>
          <Text style={styles.colQty}>{l.quantity}</Text>
          <Text style={styles.colSubtotal}>
            {yen(l.unitPrice * l.quantity)}
          </Text>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>小計</Text>
        <Text style={styles.totalValue}>{yen(subtotal)}</Text>
      </View>
      {props.shippingFee > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>送料</Text>
          <Text style={styles.totalValue}>{yen(props.shippingFee)}</Text>
        </View>
      )}
      <View style={styles.grandTotalRow}>
        <Text style={styles.totalLabel}>合計</Text>
        <Text style={styles.totalValue}>{yen(props.totalAmount)}</Text>
      </View>

      {props.issuer.footerMessage && (
        <View style={styles.footer}>
          <Text>{props.issuer.footerMessage}</Text>
        </View>
      )}
    </Page>
  );
}

/**
 * 単一納品書ドキュメント。個別DL用。
 * 一括連結 PDF は InvoicePage を並べた別 Document を作る。
 */
export function InvoiceDocument(props: InvoiceDocumentProps) {
  return (
    <Document title={`納品書_${props.invoiceNumber}`}>
      <InvoicePage {...props} />
    </Document>
  );
}

/**
 * 複数注文の連結 PDF ドキュメント。1ファイルに全件が並ぶ (仕様書 5-3)。
 */
export function InvoiceBundleDocument({
  invoices,
  title,
}: {
  invoices: InvoiceDocumentProps[];
  title: string;
}) {
  return (
    <Document title={title}>
      {invoices.map((inv) => (
        <InvoicePage key={inv.invoiceNumber} {...inv} />
      ))}
    </Document>
  );
}
