import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Telegram Hub",
  description: "Telegram Web Communication Hub"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
