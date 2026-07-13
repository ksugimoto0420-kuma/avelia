import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Avelia FunClub",
    template: "%s | Avelia FunClub",
  },
  description:
    "アイドル・アーティストのオンライン特典会・サイン会、直筆サイン入りグッズのファン向けショップ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
