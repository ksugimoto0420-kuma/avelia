// ストレージ上のパス命名規約。
//
// docs/storage-strategy.md Section 4 参照。
// 「domain/entityId/purpose」の形で prefix を作り、実際のファイル名は
// ドライバーが addRandomSuffix で付与する (Immutable 運用)。
//
// 呼び出し側は末尾のファイル名を意識しない — Driver.put(buffer, filename, opts)
// の filename にオリジナル名を渡すと、Driver 側で pathPrefix と組み合わせて
// 最終的な key を生成する。

export const StoragePaths = {
  /** 商品サムネイル画像。 */
  productThumbnail(productId: string): string {
    return `products/${productId}/thumbnail`;
  },
  /** イベントバナー画像。 */
  eventBanner(eventId: string): string {
    return `events/${eventId}/banner`;
  },
  /** 写真集PDF原本 (SHARED配信用)。 */
  photobookOriginal(productId: string, version: string): string {
    return `photobooks/${productId}/${version}`;
  },
  /** サイン合成済み写真集 (個別納品)。 */
  photobookSigned(orderId: string): string {
    return `photobooks-signed/${orderId}`;
  },
  /** サイン合成済み動画 (個別納品)。 */
  videoSigned(orderId: string): string {
    return `videos-signed/${orderId}`;
  },
  /** 管理者アップロードの作業用素材。 */
  adminUpload(userId: string, yyyymmdd: string): string {
    return `admin/${userId}/${yyyymmdd}`;
  },
  /** サイン用ベース画像 (管理者用の原本)。 */
  deliveryBaseImage(digitalContentId: string): string {
    return `deliveries/base-image/${digitalContentId}`;
  },
  /** CSV エクスポート出力先。 */
  csvExport(yyyymmdd: string): string {
    return `admin/csv/${yyyymmdd}`;
  },
  /** 一時ファイル (PDF生成中間物など)。 */
  tempFile(sessionId: string): string {
    return `tmp/${sessionId}`;
  },
};
