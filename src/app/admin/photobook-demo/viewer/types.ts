/**
 * PhotobookViewer 共通型。
 * PhotobookDemo.tsx の Step3 から渡される最小限の情報のみを扱う。
 */

export type ViewerPage = {
  pageNumber: number;
  width: number;
  height: number;
  /** PDFをレンダリングした JPEG dataURL */
  dataUrl: string;
};

export type ViewerSignature = {
  pageNumber: number;
  /** 0〜1 のページ内相対座標 */
  xRatio: number;
  yRatio: number;
  /** 0〜1 のサイズ（ページ幅に対する比率） */
  widthRatio: number;
  /** サイン PNG (data URL) */
  imagePng: string;
};

export type ViewerMode = "single" | "spread";
