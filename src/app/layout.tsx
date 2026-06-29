import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D 파쿠우우우르",
  description: "비 내리는 도시 위, 둥둥 떠 있는 플랫폼을 건너가는 3D 파쿠르 게임",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
