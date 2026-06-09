import path from "node:path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

/** ファイル名/キーの拡張子から Content-Type を返す。 */
export function contentTypeFor(key: string): string {
  return MIME[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}
